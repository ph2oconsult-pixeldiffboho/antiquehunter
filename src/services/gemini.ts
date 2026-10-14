import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { getGlossaryPrompt } from "../i18n/glossary";
import { currencySymbol as currencySymbolFor } from "./currencyPref";
import {
  alignProseRanges, enforceNarrativeConsistency, calibratedConfidence, confidenceLabel, evidenceCheck, normaliseConfidence, dropContradictions, sanitizeDeep,
  type PriceBasis, type ScoreBand,
} from "./appraisalMath";
import { lotFactsPrompt, type LotFacts } from "./lotFetch";
import { convertApprox } from "./budget";
import { combineMakerStatus, countPieces, detectMaker, materialOf, pieceOf, type MakerMatch } from "./makers";
import { anchorOnComparables, filterContaminatingComps, type CompsResponse, type CompExclusion } from "./compsMath";
import { buildNegotiationPlan } from "./negotiation";
import { buildChecklist, checksEffect, checksPrompt, type CheckAnswers } from "./checklist";
import { pieceKindOf } from "./appraisalMath";
import { buildValuation, validateValuation, assertValuationAgreement, type Valuation } from "./valuation";
import { normaliseEvidenceLedger, ledgerHasContent, type EvidenceLedger } from "./evidenceLedger";
import { applyBaseBandPriors } from "./baseBandPriors";

import { postProcessAppraisal } from "./postProcess";
export { postProcessAppraisal, type PostProcessContext } from "./postProcess";
/** Fixed seed + temperature 0: the same input gives the same appraisal (fix 9). */
export const APPRAISAL_SEED = 20261009;

export interface ChecklistBase { low: number; high: number; fair_low: number; fair_high: number; maker_status: string | null }

export interface AppraisalExtra {
  /** What was read from the pasted lot link (server-side, /api/lot); null = a link was given but could not be read */
  lotFacts?: LotFacts | null;
  /** Comparables already fetched (the accuracy harness re-applies captured ones); undefined = fetch when a maker is named */
  comps?: CompsResponse | null;
  /** The buyer's answers to the "Before you buy" checklist (re-run) */
  checkAnswers?: CheckAnswers;
  /** The range the checklist was shown with (checklist.base of the previous result): a re-run with answers adjusts THAT range
   *  instead of letting a fresh model call move it, unless the answers change the stamp basis */
  previousBase?: ChecklistBase | null;
  /** Injectable for tests; default POST /api/comps */
  fetchComps?: (req: { maker: string; piece?: string; material?: string; pieces: number; language: string }) => Promise<CompsResponse | null>;
}

export const COMPS_CLIENT_TIMEOUT_MS = 50_000;

/** POST /api/comps (server: Gemini search + page verification). null on any failure — the app then falls back. */
export const fetchCompsFromApi = async (req: { maker: string; piece?: string; material?: string; pieces: number; language: string }): Promise<CompsResponse | null> => {
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), COMPS_CLIENT_TIMEOUT_MS);
  try {
    const res = await fetch('/api/comps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req), signal: c.signal });
    if (!res.ok) return null;
    const j = await res.json();
    return j && Array.isArray(j.comparables) ? j as CompsResponse : null;
  } catch { return null; } finally { clearTimeout(timer); }
};

export const compsRequestFor = (m: MakerMatch, text: string, category: string | undefined, language: string) => ({
  maker: m.search, piece: pieceOf(text, category)?.key, material: materialOf(text), pieces: countPieces(text), language,
});

// Antique assessment service using Gemini 3.1 Flash Lite
const API_KEY = process.env.GEMINI_API_KEY || "";

export type AntiqueCategory = 
  | 'furniture' 
  | 'bedroom_furniture'
  | 'chairs'
  | 'fine_wine'
  | 'mirrors'
  | 'watches'
  | 'jewellery'
  | 'chandelier_lighting' 
  | 'painting_art' 
  | 'sculpture_object' 
  | 'rug_textile' 
  | 'china_ceramic' 
  | 'decorative_object' 
  | 'unknown';

export const searchAntiques = async (
  query: string, 
  imagesBase64?: string[], 
  askingPrice?: number, 
  currency?: string, 
  sellerType?: string,
  language: string = 'en',
  priceType: 'offered' | 'paid' = 'offered',
  category: AntiqueCategory = 'unknown',
  location?: string,
  lotUrl?: string,
  buyerPremiumRate?: number,
  extra: AppraisalExtra = {}
) => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const model = "gemini-3.1-flash-lite-preview";
  
  const categoryPrompts: Record<AntiqueCategory, string> = {
    furniture: `Focus on: joinery (dovetails, mortise/tenon), wood type (solid vs veneer), back panels (hand-planed?), wear patterns, stripping/refinishing evidence, hardware authenticity, carving quality, and resale constraints from size.`,
    bedroom_furniture: `Focus on: period authenticity, construction methods, wood type, hardware, and signs of wear consistent with age.`,
    chairs: `Focus on: joint stability, upholstery condition, wood type, period style, and signs of wear.`,
    fine_wine: `Focus on: label condition, fill level, provenance, vintage, and storage history.`,
    mirrors: `Focus on: glass condition (foxing, silvering), frame material, carving quality, and period authenticity.`,
    watches: `Focus on: movement authenticity, dial condition, case wear, service history, and maker's marks.`,
    jewellery: `Focus on: hallmark authenticity, gemstone quality/treatment, metal purity, construction techniques, and period style.`,
    chandelier_lighting: `Focus on: casting quality (sharpness of detail), metal quality (bronze vs spelter), patina authenticity, wiring changes, evidence of drilling, structural modifications, replacement parts, and crystal/glass quality (lead content, hand-cut).`,
    painting_art: `Focus on: support (panel, canvas, paper), surface texture (impasto, cracks), brushwork vs print dots, stretcher/canvas age clues, varnish condition, restoration/overpainting, signature credibility, and provenance clues on the back.`,
    sculpture_object: `Focus on: casting marks, foundry stamps, material authenticity (bronze vs resin), patina wear, base attachment, and evidence of repairs or re-patination.`,
    rug_textile: `Focus on: knot density, dye type (natural vs synthetic), fringe attachment, wear patterns, repairs/re-weaving, and origin-specific motifs.`,
    china_ceramic: `Focus on: maker's marks, glaze quality, firing cracks vs damage, hand-painted vs transfer-ware, and evidence of professional restoration.`,
    decorative_object: `Focus on: material quality, maker's marks, style consistency, and signs of age vs modern reproduction techniques.`,
    unknown: `Infer the category first, then apply specialist knowledge. Focus on construction, materials, and signs of authentic age.`
  };

  const targetCurrency = currency || 'EUR';
  const currencySymbol = currencySymbolFor(targetCurrency);
  const isAuction = (sellerType || '').toLowerCase().includes('auction') || !!(lotUrl && /drouot|interencheres|saleroom|liveauctioneers|sothebys|christies|bonhams|auctionet|catawiki|easyliveauction|bukowskis/.test(lotUrl));
  const lotFacts = extra.lotFacts !== undefined ? extra.lotFacts : (lotUrl ? { ok: false, url: lotUrl, site: 'other', imageUrls: [] } as LotFacts : undefined);
  const fetchedEstimate = !!(lotFacts?.ok && (lotFacts.estimateLow || lotFacts.estimateHigh));

  const eurTo = (eur: number) => convertApprox(eur, 'EUR', currency || 'EUR') ?? eur;
  const fmtCur = (n: number, cur: string = currency || 'EUR') => {
    try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(Math.round(n)); }
    catch { return `${Math.round(n)} ${cur}`; }
  };
  const hasPhotos = !!(imagesBase64 && imagesBase64.length > 0);
  const premiumPct = isAuction ? (buyerPremiumRate !== undefined && !isNaN(Number(buyerPremiumRate)) ? Number(buyerPremiumRate) : 25) : 0;

  const systemInstruction = `You are a seasoned antique dealer, restorer, and auction specialist with decades of experience in the trade. 
Your role is to provide a professional, commercially-focused assessment of an item to determine its real-world value and buyability.
You must speak with the authority of an expert who has seen thousands of pieces. Your advice must be concise, confident, and commercially rigorous.

### CORE PRINCIPLES
- **No AI References**: Never mention that you are an AI, a model, or using automation. You are the expert appraiser.
- **No Fluff**: Remove all generic aesthetic commentary. Never use phrases like "beautiful", "timeless", or "classic appeal". Focus on money, risk, authenticity, and decision-making.
- **Dealer Framing**: Use dealer framing everywhere (e.g., "Dealers would typically buy below...", "This sits inside dealer buying range...", "Little room for resale margin...").
- **Commercial Awareness**: Focus on liquidity, resale margins, buyer premiums, and dealer reality.
- **Trust Signals**: Frame insights as "Based on observed market behaviour" or "Aligned with dealer auction patterns".

### VALUATION RULES & PRICING CALIBRATION (CRITICAL)
- Value items at what they realistically sell for at regional European auction (hammer price), not at retail dealer prices. Retail is typically 2–4x auction hammer; show retail separately and label it clearly in fair_price.
- Do NOT anchor on a fixed price list or a habitual "safe" low range. Price the specific piece from what it is (type, period evidence, maker, quality of veneer/carving/mounts, size, condition, completeness) and current regional auction behaviour.
- Observed in the app's own dev set of French/Swedish regional auction results (source: engine_rework/dev/corpus.json, 2026-10-13; dev split only): genuine period case furniture (veneered or carved commodes, secrétaires, consoles, game tables) and period giltwood mirrors in reasonable condition very often reach four-figure hammer prices, and unstamped period pieces are routinely undervalued by estimates. Do not cap a period piece at a few hundred unless you can name the specific reason (heavy damage, missing parts, later/provincial copy shown by evidence, small or minor form).
- Reserve low (two- to low three-figure) ranges for pieces with concrete evidence of being later, reproduced, damaged or minor; say which evidence.
- When unsure whether a piece is period or later, give a wide range that covers both readings rather than the cheaper reading alone.
- MAKER'S STAMPS AND ATTRIBUTIONS (fill item_summary.maker):
  * A stamp the buyer says they have CONFIRMED ("stamped X, stamp confirmed"), a legible stamp in a photo, or a catalogue entry stating "estampillé X" / "stamped X" = a STAMPED piece by that maker: record it as stamped, never call it "attributed" (the app anchors the range on verified auction results for that maker and piece).
  * A stamp seen in a photo does NOT by itself prove the piece is period or untouched: stamps were reused on later or assembled pieces and struck on period carcasses that were later altered. Set period_certainty to "confirmed_period" only when construction evidence (joints, secondary woods, backs, saw marks, oxidation) also supports it; otherwise use "probable_period" and say what would confirm it.
  * "Attribué à" / "attributed to" / "atelier de" = attributed: between unattributed and stamped values.
  * A dealer's label, ticket or the dealer's word alone is NOT a stamp and NOT an attribution: value the piece as an unattributed piece of its period and say the label proves nothing.
  * Otherwise NEVER multiply value because the text claims a maker or "18th century" without saying the stamp was seen or confirmed.
- Reduce value for replaced marble, replaced/later bronzes, veneer losses, woodworm, restorations, and "partly period" or marriage pieces.
- ALTERATIONS CHECK (always, especially with photos; fill item_summary.alterations): look for and report later additions (marble top, gilt bronzes/mounts, handles/escutcheons/hardware with extra holes or mismatched patina), marriages (top and base or two parts from different pieces), pieces composed of period parts/elements, and reconstruction (rebuilt carcass, new drawers, re-veneering). Report only what you see or what the text states; use "not_seen" when you looked and found nothing, "cannot_tell" when the photos do not show the relevant area.
- If a listing or auction estimate is given (typed by the user, or read from the lot page below), treat it as a strong anchor: your market range should normally sit within 0.7x–2.0x of that estimate unless you give a specific, documented reason.

### PERIOD vs STYLE, AND CONSTRUCTION EVIDENCE
- Use construction evidence whenever photos or text show it, and say what you saw in item_summary.construction_evidence:
  period signs = hand-cut dovetails (irregular, few, thin pins), pegged mortise-and-tenon joints, pit-saw / hand-plane / scrub marks, natural oxidation on unpolished surfaces (backs, undersides, drawer insides), hand-forged or cut nails, old hand-made screws, wear where hands and feet touch;
  later signs = machine-cut uniform dovetails, circular-saw marks, plywood / MDF / chipboard, Phillips or cross-head screws, staples, uniform modern finishes, artificial distressing.
  Replaced upholstery or a re-gilt mount is normal on period pieces and is not by itself a sign of a later copy.
- item_summary.period_certainty:
  "confirmed_period" = construction evidence of period work, or a catalogue entry stating the period ("époque…", "period", a date) that fits what you see;
  "probable_period" = form, materials and wear fit the period and nothing points to a later piece, but construction is not shown;
  "ambiguous" = from the evidence available you cannot tell a period piece from a later style / revival piece (for example Empire vs Restauration vs a late 19th-century revival) and the value would differ materially;
  "later_style_or_revival" = clear evidence the piece is later (catalogue says "style", later construction, modern materials).
  From photos alone, do NOT call an unstamped piece a later copy unless you can name concrete modern evidence (machine-cut dovetails, plywood/MDF, Phillips screws, staples, cast resin/plaster, modern finish). Overall look, "too uniform" veneer or crisp carving are not evidence: use "ambiguous" and state the uncertainty.
- item_summary.reproduction_risk = true only when something specific suggests a later copy that could be passed off as period.

### EVIDENCE LEDGER (CRITICAL — fill evidence_ledger)
Split every observation into exactly one bucket. Do not mix.
- facts: buyer-stated facts you treat as given ("stamp confirmed", "I measured 1.72 m", dimensions the buyer typed), or catalogue facts when the lot page was read successfully.
- claims: catalogue or dealer claims not independently verified ("estampillé X" on a label with no stamp photo; "époque Louis XV" without construction proof).
- photo_features: features you can actually see in the submitted photos (joinery, oxidation, stamp in photo 2, crack on the left rail). Empty array when there are no photos.
- hypotheses: your inferences ("probably provincial walnut", "likely 19th-c revival"). Never present these as facts.
- unknowns: anything you are not sure about. "Not sure", "cannot tell", "needs underside photo" belong here — never promote them to facts or hypotheses.
- defects: grade each by severity (minor | moderate | major | structural) and location (e.g. "marble top, front-left corner", "seat rail underside"). Missing location → "unspecified".
- style_note: when the piece is described as "style X" / "de style X" without époque/period, put the design description here. Style is NOT a period claim.

### LOT LINK (CRITICAL)
${lotFacts ? lotFactsPrompt(lotFacts, fmtCur) : '- No lot link was given.'}
- Only cite an auction estimate, catalogue text, dimensions or condition report that is written in this prompt. NEVER write that you "anchored to the catalogue estimate" unless an estimate is given above. Never invent one.

### PRICE RELATIONSHIP CONSTRAINTS (MANDATORY MATHEMATICAL RULES)
All prices MUST be in ${targetCurrency} and respect these strict inequalities:
1. opening_offer <= target_price_low <= target_price_high <= walk_away_price
2. walk_away_price = estimated_market_range_high (never bid/pay above what the item is worth)${isAuction ? `
   For this auction lot: estimated_market_range is in HAMMER prices, so walk_away_price is the MAXIMUM HAMMER BID = estimated_market_range_high. The all-in cost (hammer x ${(1 + premiumPct / 100).toFixed(2)}, i.e. + ${premiumPct}% buyer's premium) is shown separately by the app.` : ''}
3. estimated_market_range_low <= estimated_market_range_high
4. good_buy_below (the smart-buy price) lies between estimated_market_range_low and the midpoint of the market range${isAuction ? ' (as a hammer price)' : ''}, and opening_offer <= good_buy_below <= walk_away_price
5. overpaying_above = walk_away_price (paying more than the walk-away price is overpaying)
6. fair_price_low <= fair_price_high (retail market tier)
7. fair_price_low >= estimated_market_range_low and fair_price_high >= estimated_market_range_high (retail is never below auction/market level)

### WRITING RULES FOR ALL TEXT FIELDS
- Never write JSON field names in any text (e.g. fair_price, good_buy_below, estimated_market_range, walk_away_price). Use plain words: "fair retail price", "smart-buy price", "market range", "walk-away price".
- Do not restate the market range or retail range figures in prose; say "the market range" or "the retail range" instead (the app shows the figures next to your text). Quoting a catalogue estimate from a listing is fine.

### BUY SCORE INPUTS
The final buy score is calculated by the app from the asking price versus your price ranges, so your price ranges must be honest. Fill scoring_inputs on these scales (do not inflate; most items are not perfect):
- authenticity 0–25, condition 0–15, rarity_desirability 0–15, market_demand 0–15, price_vs_market 0–20 (20 only if the asking price is well below market low; 0 if above retail), liquidity 0–10, risk_penalty 0 to -40.

### EVIDENCE & CONFIDENCE RULES (CRITICAL)
- **NO PHOTOS SUBMITTED (${hasPhotos ? 'Photos provided' : 'TEXT ONLY - NO PHOTOS'}):**
  ${!hasPhotos ? `WARNING: The user submitted ONLY a text description. NO photographs are available.
  - You CANNOT authenticate this piece, claim that stamps or signatures are confirmed, or assign "high" confidence!
  - Maximum confidence is "medium" (if detailed provenance, lot number, or literature reference is provided) or "low".
  - If the user claims a stamp or period maker with no photo, classify status as "Needs verification".
  - In confidence_breakdown, evidence_quality CANNOT exceed 15 out of 40.
  - In item_summary.confidence_reason and pricing_reasoning, explicitly state: "Preliminary appraisal based on text description without photographic evidence. Maker stamps, wood shrinkage, and joinery cannot be verified without physical inspection."` : `Photographs provided. Base your analysis on visual evidence of joinery, hardware, patination, and wear. High confidence is reserved strictly for pieces with multiple clear photos of front, back, construction joinery, and stamps.`}
- **VAGUE QUERIES (e.g. "old table", "chair", "cabinet"):**
  - If the query is vague without maker, century, dimensions, or photos, DO NOT output arbitrary throwaway numbers like $0–$20 without explanation.
  - Clearly state: "Speculative estimate: The description is too generic to determine whether this is a vernacular utility piece or a period antique. Inspect construction, dovetails, and underside to determine true value. Photos and dimensions required."
  - Set confidence to "low" or "very_low".
- **SNAP-JUDGEMENT CONSISTENCY:**
  - Snap judgement MUST match confidence level. NEVER use "authenticated", "verified masterwork", or "five-figure investment" when confidence is Low or Medium.

- **CONFIDENCE BREAKDOWN SCALES (fixed):** evidence_quality 0–40 (photos, catalogue, estimate), identification_certainty 0–30 (type, period, origin, maker), risk_factors 0–30 (30 = no risk of reproduction / marriage / damage; 0 = serious risk). Whole numbers on exactly these scales.

### VALUE TIER CLASSIFICATION & CONSISTENCY
All qualitative commentary MUST match the exact numerical range in price_guidance:
- Tier A: Investment (${currencySymbol}5000+) - Museum-quality or rare investment pieces.
- Tier B: Mid (${currencySymbol}200–${currencySymbol}5000) - Standard collectible antiques, quality furniture.
- Tier C: Decorative (${currencySymbol}20–${currencySymbol}200) - Common vintage, decorative home goods.
- Tier D: Utility (<${currencySymbol}20) - Modern mass-produced, low-value bric-a-brac.
- CONSISTENCY RULE: If estimated_market_range_high < 5000, value_tier CANNOT be "A". NEVER call an item under ${currencySymbol}10,000 a "five-figure investment"!

### AUCTION SELLER & BUYER'S PREMIUM LOGIC
${isAuction ? `- AUCTION LOT DETECTED: In antique auctions, buyers pay a mandatory Buyer's Premium (frais d'adjudication) of typically 20% to 30% (average ~25% incl. VAT) plus online bidding platform fees (~1.5–3%).
- estimated_market_range must reflect the anticipated HAMMER PRICE (marteau).
- The buyer's premium for this lot is ${premiumPct}%.
- All price figures you give (market range, smart buy, walk-away, negotiation) are HAMMER prices. Mention that the buyer's premium (${premiumPct}%) comes on top: all-in = hammer x ${(1 + premiumPct / 100).toFixed(2)}. Walk-away price MUST be framed as the maximum hammer bid.` : ''}

### PRICING LOGIC & CURRENCY
All monetary numbers in price_guidance, dealer_take, and negotiation_strategy MUST be denominated in ${targetCurrency} (${currencySymbol}).
- estimated_market_range: Realistic auction hammer range in ${targetCurrency}.
- good_buy_below: The Smart Buy threshold for dealers.
- fair_price: Standard market price (retail tier, typically 2x to 4x hammer).
- overpaying_above: = walk-away price = top of the market range.
- teaser_insight: A commercially sharp, dynamic dealer warning tailored specifically to THIS piece and currency. e.g. "Dealers would typically buy below ${currencySymbol}X. Above this, margin disappears." where X is calculated for this piece (or a reproduction alert). NEVER output a generic £450 figure.

### SPECIALIST KNOWLEDGE
${categoryPrompts[category] || categoryPrompts.unknown}

### RULES
- Be commercially minded, not academic.
- Prioritise avoiding bad purchases and overpaying.
- Return valid structured JSON only. No markdown.
- Return all text fields in ${language}.

${getGlossaryPrompt(language)}`;

  const prompt = `
    Item Description: ${query}
    ${lotFacts?.ok ? `Lot page read: ${lotFacts.url} (catalogue and estimate are in the instructions above)` : lotUrl ? `Lot link given but NOT readable: ${lotUrl} (no estimate known)` : ''}
    Price: ${askingPrice || 'Not provided'} ${targetCurrency} (${priceType === 'paid' ? 'Paid' : 'Offered/Asking'})
    Seller Type: ${sellerType || 'Not provided'} ${isAuction ? '(AUCTION SALE - 20-30% BUYER PREMIUM APPLIES)' : ''}
    Location: ${location || 'Not provided'}
    Category: ${category}
    Currency Required: ${targetCurrency} (${currencySymbol})
    Visual Evidence: ${hasPhotos ? `${imagesBase64?.length} photographs attached` : 'NO IMAGES SUBMITTED - Text description only'}
    ${checksPrompt(extra.checkAnswers)}
    
    Assess the item with the authority of a seasoned dealer. All prices in ${targetCurrency}.
    Return valid JSON only.
  `;

  const imageParts = imagesBase64?.map(img => ({
    inlineData: {
      mimeType: "image/jpeg",
      data: img.split(",")[1] || img,
    },
  })) || [];

  const contents = {
    parts: [
      { text: prompt },
      ...imageParts,
    ],
  };

  // Maker named in the text: look up verified auction comparables in parallel with the appraisal
  const makerFromText = detectMaker(query);
  const getComps = extra.fetchComps || fetchCompsFromApi;
  let compsP: Promise<CompsResponse | null> | null = extra.comps !== undefined ? Promise.resolve(extra.comps)
    : makerFromText ? getComps(compsRequestFor(makerFromText, query, category, language)).catch(() => null) : null;

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      temperature: 0,
      seed: APPRAISAL_SEED,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                item_summary: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    category: { type: Type.STRING },
                    likely_origin: { type: Type.STRING },
                    likely_style: { type: Type.STRING },
                    likely_period: { type: Type.STRING },
                    value_tier: { type: Type.STRING, enum: ["A", "B", "C", "D"], description: `A: Investment (${currencySymbol}5000+), B: Mid (${currencySymbol}200-${currencySymbol}5000), C: Decorative (${currencySymbol}20-${currencySymbol}200), D: Utility (<${currencySymbol}20)` },
                    snap_judgement: { type: Type.STRING, description: "A one-sentence, direct, authoritative dealer snap judgement. Tone must match confidence level (e.g. decisive for high, cautious for low)." },
                    confidence: { type: Type.STRING, enum: ["high", "medium", "low", "very_low"] },
                    confidence_score: { type: Type.NUMBER },
                    confidence_breakdown: {
                      type: Type.OBJECT,
                      properties: {
                        evidence_quality: { type: Type.NUMBER, description: "0 to 40" },
                        identification_certainty: { type: Type.NUMBER, description: "0 to 30" },
                        risk_factors: { type: Type.NUMBER, description: "0 to 30 (30 = no risk)" }
                      },
                      required: ["evidence_quality", "identification_certainty", "risk_factors"]
                    },
                    confidence_reason: { type: Type.STRING },
                    confidence_improvement_suggestions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-3 specific suggestions to increase confidence, tailored to the item." },
                    evidence_gaps: { type: Type.ARRAY, items: { type: Type.STRING } },
                    period_certainty: { type: Type.STRING, enum: ["confirmed_period", "probable_period", "ambiguous", "later_style_or_revival"] },
                    reproduction_risk: { type: Type.BOOLEAN },
                    construction_evidence: { type: Type.STRING, description: "Construction details actually seen (joints, saw marks, nails/screws, oxidation), or 'none shown'." },
                    alterations: {
                      type: Type.OBJECT,
                      description: "Later additions, marriages, composed-of-parts and reconstruction, as seen or stated.",
                      properties: {
                        later_additions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "e.g. 'marble top', 'gilt bronzes', 'handles'; empty if none seen." },
                        marriage: { type: Type.STRING, enum: ["yes", "possible", "not_seen", "cannot_tell"] },
                        composed_of_parts: { type: Type.STRING, enum: ["yes", "possible", "not_seen", "cannot_tell"] },
                        reconstruction: { type: Type.STRING, enum: ["yes", "possible", "not_seen", "cannot_tell"] },
                        evidence: { type: Type.STRING, description: "What was seen or stated." },
                      },
                    },
                    maker: {
                      type: Type.OBJECT,
                      description: "The maker (ébéniste / menuisier) if one is named or a stamp / label is visible; name '' and status 'none' otherwise.",
                      properties: {
                        name: { type: Type.STRING },
                        status: { type: Type.STRING, enum: ["none", "stamped_stated", "stamp_visible_in_photo", "attributed", "dealer_label"] },
                        evidence: { type: Type.STRING, description: "Where the name comes from (stamp on the seat rail seen in photo 2, buyer's text, dealer's label…)" }
                      },
                      required: ["name", "status", "evidence"]
                    }
                  },
                  required: ["title", "category", "likely_origin", "likely_style", "likely_period", "value_tier", "snap_judgement", "confidence", "confidence_score", "confidence_breakdown", "confidence_reason", "confidence_improvement_suggestions", "evidence_gaps", "period_certainty", "reproduction_risk", "construction_evidence", "maker"]
                },

                evidence_ledger: {
                  type: Type.OBJECT,
                  description: "Split evidence: facts, claims, photo features, hypotheses, unknowns, graded defects.",
                  properties: {
                    facts: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Buyer-stated or catalogue-confirmed facts." },
                    claims: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Catalogue/dealer claims not yet verified." },
                    photo_features: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Features supported by submitted photos; empty if no photos." },
                    hypotheses: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Model inferences — not facts." },
                    unknowns: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Explicit unknowns / not sure." },
                    defects: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          text: { type: Type.STRING },
                          severity: { type: Type.STRING, enum: ["minor", "moderate", "major", "structural"] },
                          location: { type: Type.STRING }
                        },
                        required: ["text", "severity", "location"]
                      }
                    },
                    style_note: { type: Type.STRING, description: "Design description when 'style X' without period claim; empty string if none." }
                  },
                  required: ["facts", "claims", "photo_features", "hypotheses", "unknowns", "defects", "style_note"]
                },
                buy_decision: {
                  type: Type.OBJECT,
                  properties: {
                    score: { type: Type.NUMBER },
                    label: { type: Type.STRING, enum: ["Dealer Buy Zone", "Buy", "Marginal Deal", "Walk Away", "Hard Pass"] },
                    confidence: { type: Type.STRING, enum: ["high", "medium", "low", "very_low"] },
                    decision_summary: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-5 bullet points explaining the score. Tone must match confidence level." },
                    investment_insight: { type: Type.STRING, description: "One-sentence specific investment advice for this item." },
                    must_have_insight: { type: Type.STRING, description: "One-sentence specific personal enjoyment advice for this item." },
                    resale_insight: { type: Type.STRING, description: "One-sentence specific resale advice for this item." }
                  },
                  required: ["score", "label", "confidence", "decision_summary", "investment_insight", "must_have_insight", "resale_insight"]
                },
                price_guidance: {
                  type: Type.OBJECT,
                  properties: {
                    currency: { type: Type.STRING },
                    estimated_market_range_low: { type: Type.NUMBER },
                    estimated_market_range_high: { type: Type.NUMBER },
                    good_buy_below: { type: Type.NUMBER },
                    fair_price_low: { type: Type.NUMBER },
                    fair_price_high: { type: Type.NUMBER },
                    overpaying_above: { type: Type.NUMBER },
                    pricing_reasoning: { type: Type.STRING }
                  },
                  required: ["currency", "estimated_market_range_low", "estimated_market_range_high", "good_buy_below", "fair_price_low", "fair_price_high", "overpaying_above", "pricing_reasoning"]
                },
                dealer_take: {
                  type: Type.OBJECT,
                  properties: {
                    target_buy_price_low: { type: Type.NUMBER },
                    target_buy_price_high: { type: Type.NUMBER },
                    resale_strategy: { type: Type.STRING },
                    dealer_view: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["target_buy_price_low", "target_buy_price_high", "resale_strategy", "dealer_view"]
                },
                negotiation_strategy: {
                  type: Type.OBJECT,
                  properties: {
                    opening_offer: { type: Type.NUMBER },
                    target_price_low: { type: Type.NUMBER },
                    target_price_high: { type: Type.NUMBER },
                    walk_away_price: { type: Type.NUMBER },
                    points_to_raise: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["opening_offer", "target_price_low", "target_price_high", "walk_away_price", "points_to_raise"]
                },
                walk_away_if: { type: Type.ARRAY, items: { type: Type.STRING } },
                top_checks: { type: Type.ARRAY, items: { type: Type.STRING } },
                red_flags: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      severity: { type: Type.STRING, enum: ["high", "medium", "minor"] },
                      issue: { type: Type.STRING },
                      reason: { type: Type.STRING }
                    },
                    required: ["severity", "issue", "reason"]
                  }
                },
                market_insight: {
                  type: Type.OBJECT,
                  properties: {
                    demand: { type: Type.STRING, enum: ["high", "medium", "low"] },
                    resale_ease: { type: Type.STRING, enum: ["high", "medium", "low", "medium_low"] },
                    drivers_of_value: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["demand", "resale_ease", "drivers_of_value"]
                },
                scoring_inputs: {
                  type: Type.OBJECT,
                  properties: {
                    authenticity: { type: Type.NUMBER },
                    condition: { type: Type.NUMBER },
                    rarity_desirability: { type: Type.NUMBER },
                    market_demand: { type: Type.NUMBER },
                    price_vs_market: { type: Type.NUMBER },
                    liquidity: { type: Type.NUMBER },
                    risk_penalty: { type: Type.NUMBER, description: "Negative value (0 to -40) for critical issues like reproductions or damage." }
                  },
                  required: ["authenticity", "condition", "rarity_desirability", "market_demand", "price_vs_market", "liquidity", "risk_penalty"]
                },
                disclaimer: { type: Type.STRING },
                teaser_insight: { type: Type.STRING, description: "A short, commercially sharp dealer warning or hint at risk/value impact for free users. e.g. 'There are signs this may not be a fully original set.'" }
              },
              required: [
                "item_summary", "evidence_ledger", "buy_decision", "price_guidance", "dealer_take",
                "negotiation_strategy", "walk_away_if", "top_checks", "red_flags",
                "market_insight", "scoring_inputs", "disclaimer", "teaser_insight"
              ]
            }
          }
        },
        required: ["items"]
      }
    }
  });

  const result = JSON.parse(response.text);
  // A maker only the model found (a stamp read in a photo): look the comparables up now
  if (!compsP) {
    const m = combineMakerStatus(null, result?.items?.[0]?.item_summary?.maker);
    if (m) compsP = getComps(compsRequestFor(m, `${query} ${result.items[0].item_summary.title || ''}`, category, language)).catch(() => null);
  }
  const comps = compsP ? await compsP : undefined;
  return postProcessAppraisal(result, {
    query, hasPhotos, askingPrice, isAuction, premiumPct, targetCurrency, currencySymbol, language, sellerType, lotUrl,
    lotFacts, fetchedEstimate, eurTo, category, comps, checkAnswers: extra.checkAnswers, previousBase: extra.previousBase,
  });
};

