import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { getGlossaryPrompt } from "../i18n/glossary";
import { currencySymbol as currencySymbolFor } from "./currencyPref";
import {
  alignProseRanges, calibratedConfidence, confidenceLabel, decideBuy, evidenceCheck, normaliseConfidence, reconcileNegotiation, sanitizeDeep,
  type PriceBasis, type ScoreBand,
} from "./appraisalMath";
import { lotFactsPrompt, type LotFacts } from "./lotFetch";
import { convertApprox } from "./budget";

/** Fixed seed + temperature 0: the same input gives the same appraisal (fix 9). */
export const APPRAISAL_SEED = 20261009;

export interface AppraisalExtra {
  /** What was read from the pasted lot link (server-side, /api/lot); null = a link was given but could not be read */
  lotFacts?: LotFacts | null;
}

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
- Typical European/French auction hammer ranges for reference (period, decent condition):
  * Provincial walnut commode, 18th c.: €300–€1,200 (or equivalent in ${targetCurrency})
  * Paris veneered commode, Louis XV/XVI, stamped by a minor maître with JME: €700–€2,500 (or equivalent in ${targetCurrency})
  * Important stamped Paris pieces with original marble and bronzes in good condition: €3,000+ (or equivalent in ${targetCurrency})
  * Transition chiffonnier: €800–€2,000 (or equivalent in ${targetCurrency})
  * 18th c. provincial armoire: €100–€600 (or equivalent in ${targetCurrency})
  * Vaisselier/buffet deux-corps 18th–19th c.: €150–€900 (or equivalent in ${targetCurrency})
  * 20th c. reproductions: €50–€300 (or equivalent in ${targetCurrency})
- NEVER multiply value because the user claims a stamp or "18th century" in their typed text. A user's text claim is unverified. Only raise value for a stamp when a photograph of the stamp is provided and it is clearly legible.
- Reduce value for replaced marble, replaced/later bronzes, veneer losses, woodworm, restorations, and "partly period" or marriage pieces.
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
- item_summary.reproduction_risk = true only when something specific suggests a later copy that could be passed off as period.

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
                    construction_evidence: { type: Type.STRING, description: "Construction details actually seen (joints, saw marks, nails/screws, oxidation), or 'none shown'." }
                  },
                  required: ["title", "category", "likely_origin", "likely_style", "likely_period", "value_tier", "snap_judgement", "confidence", "confidence_score", "confidence_breakdown", "confidence_reason", "confidence_improvement_suggestions", "evidence_gaps", "period_certainty", "reproduction_risk", "construction_evidence"]
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
                "item_summary", "buy_decision", "price_guidance", "dealer_take",
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
  return postProcessAppraisal(result, {
    query, hasPhotos, askingPrice, isAuction, premiumPct, targetCurrency, currencySymbol, language, sellerType, lotUrl,
    lotFacts, fetchedEstimate, eurTo, category,
  });
};

export interface PostProcessContext {
  query: string; hasPhotos: boolean; askingPrice?: number; isAuction: boolean; premiumPct: number; targetCurrency: string;
  currencySymbol: string; language: string; sellerType?: string; lotUrl?: string;
  lotFacts?: LotFacts | null; fetchedEstimate: boolean; eurTo: (eur: number) => number;
  category?: string;
}

/**
 * Everything the app does to the model's JSON (exported so the accuracy harness can re-apply it to a captured answer):
 * consistent negotiation figures, the verdict (hammer vs hammer), calibrated confidence, text clean-up.
 */
export const postProcessAppraisal = (result: any, ctx: PostProcessContext) => {
  const { query, hasPhotos, askingPrice, isAuction, premiumPct, targetCurrency, currencySymbol, language, sellerType, lotUrl, lotFacts, fetchedEstimate, eurTo, category } = ctx;
  
  // Scoring configuration for easy tuning
  // Verdict label comes from the price band (never from the model), so label, reason and score always agree
  const getBuyLabel = (basis: PriceBasis) => ({
    strong_buy: "Strong Buy",
    good_buy: "Good Buy",
    fair: "Fair Price",
    overpriced: "Overpriced",
    walk_away: "Walk Away",
    high_risk: "High Risk",
    no_price: "Needs a Price",
    need_evidence: "Need More Evidence",
  } as Record<PriceBasis, string>)[basis];

  // One source of truth for confidence: confidenceLabel() (appraisalMath.ts) from the calibrated score is used for
  // item_summary.confidence AND buy_decision.confidence, and the UI renders both through the same analysis.confidence_* labels.

  // Calculate Buy Score in code based on scoring_inputs
  const items = result.items.map((item: any) => {
    const s = item.scoring_inputs;
    const c = item.item_summary.confidence_breakdown;
    
    // Confidence (fix 6): the breakdown back on its fixed scales, then calibrated with what the app knows about the
    // evidence (real estimate read from the lot page, photos)
    const nb = normaliseConfidence(c);
    Object.assign(c, nb);
    const words = query.trim().split(/\s+/).length;
    let confScore = calibratedConfidence(nb, {
      hasPhotos, fetchedEstimate, closeComparables: 0,
      vague: words <= 3 && !hasPhotos && !lotFacts?.ok,
    });
    
    // Strict Evidence Grounding:
    // If NO photos were provided, confidence can NEVER be high, and evidence quality must be capped.
    if (!hasPhotos) {
      c.evidence_quality = Math.min(c.evidence_quality || 12, 14);
      if (!item.item_summary.confidence_reason.includes('photographic') && !item.item_summary.confidence_reason.includes('photos')) {
        item.item_summary.confidence_reason = `Unverified: Evaluated without physical photographs. Stamped marks, joinery, and authenticity cannot be confirmed without visual inspection. ${item.item_summary.confidence_reason}`;
      }
      if (!item.price_guidance.pricing_reasoning.includes('photos') && !item.price_guidance.pricing_reasoning.includes('photographs')) {
        item.price_guidance.pricing_reasoning = `Preliminary text-only appraisal without photos. Actual valuation depends on physical condition and construction. ${item.price_guidance.pricing_reasoning}`;
      }
    }

    // Vague queries (e.g. "old table", "chair") with no details
    if (words <= 3 && !hasPhotos && !lotFacts?.ok) {
      item.item_summary.confidence_reason = `Speculative estimate: Query '${query}' is too generic with no images or provenance. ${item.item_summary.confidence_reason}`;
      item.price_guidance.pricing_reasoning = `Speculative valuation: A generic '${query}' can range from a modern utility piece to fine period antique. Inspect construction before relying on numbers. ${item.price_guidance.pricing_reasoning}`;
    }

    const finalConfScore = Math.max(1, Math.min(100, Math.round(confScore)));
    const confLabel = confidenceLabel(finalConfScore);

    // "Need more evidence": period not established -> no firm buy verdict, provisional range, ask for evidence
    const evidence = evidenceCheck({
      periodCertainty: item.item_summary.period_certainty,
      reproductionRisk: item.item_summary.reproduction_risk,
      confidence: confLabel,
      typedText: query,
      lotPageRead: !!lotFacts?.ok,
      hasPhotos,
      category,
      title: `${item.item_summary.title || ''} ${query || ''}`,
      styleText: `${item.item_summary.likely_style || ''} ${item.item_summary.likely_period || ''}`,
    });

    // Value Tier Consistency Check:
    // If estimated market range is under 5000, it cannot be Tier A ("Investment")
    const maxEstimate = Number(item.price_guidance.estimated_market_range_high) || 0;
    if (maxEstimate < 5000 && item.item_summary.value_tier === 'A') {
      item.item_summary.value_tier = maxEstimate >= 200 ? 'B' : maxEstimate >= 20 ? 'C' : 'D';
    }

    // Fix contradictory qualitative text (e.g. calling an €800 piece a "five-figure investment")
    const cleanContradictions = (text: string) => {
      if (!text) return text;
      if (maxEstimate < 10000) {
        return text.replace(/five-figure\s*(investment|sum|value)?/gi, 'three-to-four-figure')
                   .replace(/5-figure\s*(investment|sum|value)?/gi, 'modest mid-tier')
                   .replace(/museum-grade/gi, 'collectible quality');
      }
      return text;
    };

    item.item_summary.snap_judgement = cleanContradictions(item.item_summary.snap_judgement);
    item.buy_decision.investment_insight = cleanContradictions(item.buy_decision.investment_insight);
    item.buy_decision.resale_insight = cleanContradictions(item.buy_decision.resale_insight);

    // Mathematical Price Relationship Consistency & Correction
    const pg = item.price_guidance;
    const ns = item.negotiation_strategy;

    // Ensure positive numbers
    pg.estimated_market_range_low = Math.max(0, Number(pg.estimated_market_range_low) || 0);
    pg.estimated_market_range_high = Math.max(pg.estimated_market_range_low, Number(pg.estimated_market_range_high) || pg.estimated_market_range_low * 1.5);
    const rawMidEur = convertApprox((pg.estimated_market_range_low + pg.estimated_market_range_high) / 2, targetCurrency, 'EUR') ?? 0;
    
    // Retail bounds: fair_price_low <= fair_price_high
    pg.fair_price_low = Math.max(pg.estimated_market_range_low, Number(pg.fair_price_low) || Math.round(pg.estimated_market_range_low * 1.5));
    pg.fair_price_high = Math.max(pg.fair_price_low, pg.estimated_market_range_high, Number(pg.fair_price_high) || Math.round(pg.estimated_market_range_high * 2));

    // Smart buy + negotiation figures, consistent with the buy-score bands:
    // smart buy within [market low, market mid]; opening <= smart buy <= walk-away;
    // opening <= target low <= target high <= walk-away; walk-away = market high (auction: max hammer bid)
    const nf = reconcileNegotiation(
      { good_buy_below: pg.good_buy_below, ...(ns || {}) },
      pg.estimated_market_range_low, pg.estimated_market_range_high, premiumPct, isAuction
    );
    pg.good_buy_below = nf.good_buy_below;
    // "Overpaying" starts exactly at the walk-away price (same units: hammer at auction), so every price maps to
    // one band: <= smart buy (good) / <= walk-away (fair) / above walk-away (overpriced) / above retail (walk away)
    pg.overpaying_above = nf.walk_away_price;
    if (ns) {
      ns.opening_offer = nf.opening_offer;
      ns.target_price_low = nf.target_price_low;
      ns.target_price_high = nf.target_price_high;
      ns.walk_away_price = nf.walk_away_price;
    }
    const dt = item.dealer_take;
    if (dt) {
      dt.target_buy_price_low = Math.max(0, Math.round(Number(dt.target_buy_price_low) || 0));
      dt.target_buy_price_high = Math.max(dt.target_buy_price_low, Math.round(Number(dt.target_buy_price_high) || 0));
    }

    // Ensure currency consistency
    item.price_guidance.currency = targetCurrency;

    // Teaser: any figure in it must be the app's own smart-buy / walk-away (the model's teaser sometimes quoted a
    // "buy below" figure above the market high). Qualitative teasers without money amounts are kept.
    const teaserHasMoney = /(\d[\d\s.,]*\s?(€|£|\$|kr|eur|gbp|usd|sek))|((€|£|\$)\s?\d)/i.test(String(item.teaser_insight || ''));
    if (!item.teaser_insight || teaserHasMoney) {
      if (item.price_guidance?.good_buy_below) {
        const money = (n: number) => { try { return new Intl.NumberFormat(language || 'en', { style: 'currency', currency: targetCurrency, maximumFractionDigits: 0 }).format(Math.round(n)); } catch { return `${currencySymbol}${Math.round(n)}`; } };
        item.teaser_insight = `Dealers would typically buy below ${money(item.price_guidance.good_buy_below)}${isAuction ? ' (hammer)' : ''}. Above ${money(nf.walk_away_price)}, you are overpaying.`;
      } else {
        item.teaser_insight = `Dealers typically negotiate 30–50% below retail on this category.`;
      }
    }

    const calculatedScore = 
      (s.authenticity || 0) +
      (s.condition || 0) +
      (s.rarity_desirability || 0) +
      (s.market_demand || 0) +
      (s.price_vs_market || 0) +
      (s.liquidity || 0) +
      (s.risk_penalty || 0);

    // Buy score is driven by the price compared like with like (hammer vs the hammer range at auction; all-in shown separately),
    // not by the model's self-scored inputs (which tended to sum to 100 -> a constant 90 in the UI).
    const decision = decideBuy({
      askingPrice: Number(askingPrice),
      isAuction,
      premiumPct,
      hasPhotos,
      marketLow: pg.estimated_market_range_low,
      marketHigh: pg.estimated_market_range_high,
      retailHigh: pg.fair_price_high,
      smartBuy: nf.good_buy_below,
      walkAway: nf.walk_away_price,
      riskPenalty: Number(s.risk_penalty) || 0,
      itemScore: calculatedScore,
      valueTier: item.item_summary.value_tier,
      needsEvidence: evidence.required,
    });
    const allIn = decision.effectivePrice;
    const finalScore = decision.score;
    const scoreBand: ScoreBand = decision.band;
    const basis: PriceBasis = decision.basis;
    const cappedScore = Math.max(1, Math.min(100, Math.round(finalScore)));

    // Text clean-up: no JSON field names in prose, and restated market/retail ranges must equal the cards
    const fmtMoney = (n: number) => {
      try {
        return new Intl.NumberFormat(language || 'en', { style: 'currency', currency: targetCurrency, maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(Math.round(n));
      } catch {
        return `${currencySymbol}${Math.round(n).toLocaleString()}`;
      }
    };
    const ranges = {
      market: [pg.estimated_market_range_low, pg.estimated_market_range_high] as [number, number],
      retail: [pg.fair_price_low, pg.fair_price_high] as [number, number],
    };
    const align = (v: any): any => typeof v === 'string' ? alignProseRanges(v, ranges, fmtMoney)
      : Array.isArray(v) ? v.map(align)
      : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, align(x)]))
      : v;
    const cleaned: any = align(sanitizeDeep(item));
    item = cleaned;
    if (evidence.required) item.price_guidance = { ...item.price_guidance, provisional: true };

    return {
      ...item,
      evidence_check: evidence,
      appraisal_inputs: {
        lot_page_read: !!lotFacts?.ok, estimate_read: fetchedEstimate, band_factor: 1, raw_mid_eur: Math.round(rawMidEur),
      },
      seller_context: {
        sellerType: sellerType || 'Market/Fair',
        isAuction,
        lotUrl: lotUrl || null,
        buyerPremiumRate: premiumPct,
        allInPrice: allIn || null
      },
      item_summary: {
        ...item.item_summary,
        confidence: confLabel,
        confidence_score: finalConfScore
      },
      buy_decision: {
        ...item.buy_decision,
        score: cappedScore,
        score_band: scoreBand,
        price_basis: basis,
        price_cap: decision.cap || null,
        smart_buy_all_in: decision.smartBuyAllIn || null,
        walk_away_all_in: decision.walkAwayAllIn || null,
        effective_price: allIn || null,
        compare_price: decision.comparePrice || null,
        label: getBuyLabel(basis),
        confidence: confLabel
      }
    };
  });

  return items;
};
