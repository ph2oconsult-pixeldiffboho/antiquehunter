import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { getGlossaryPrompt } from "../i18n/glossary";
import { allInCost, maxHammerForMarketHigh, priceBandScore } from "./appraisalMath";

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
  buyerPremiumRate?: number
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
  const currencySymbol = targetCurrency === 'EUR' ? '€' : targetCurrency === 'USD' ? '$' : targetCurrency === 'JPY' ? '¥' : targetCurrency === 'AUD' ? 'A$' : targetCurrency === 'CNY' ? '¥' : '£';
  const isAuction = (sellerType || '').toLowerCase().includes('auction') || !!(lotUrl && (lotUrl.includes('drouot') || lotUrl.includes('interencheres') || lotUrl.includes('saleroom') || lotUrl.includes('liveauctioneers') || lotUrl.includes('sothebys') || lotUrl.includes('christies') || lotUrl.includes('bonhams')));
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
- If a listing or auction estimate is given by the user, treat it as a strong anchor: your market range should normally sit within 0.7x–2.0x of that estimate unless you give a specific, documented reason.

### AUCTION & LISTING LINK PRIORITY (CRITICAL)
${lotUrl ? `A SPECIFIC LOT / LISTING LINK HAS BEEN PROVIDED: ${lotUrl}
- **PRIMARY EVIDENCE SOURCE**: You MUST treat this link as the primary reference for this appraisal. Prioritize extracting, analyzing, and referencing any estimates (low/high auction estimate), starting bids, catalog descriptions, dimensions, condition reports, and provenance details associated with this specific lot or listing URL (e.g. from Drouot, Interencheres, Sotheby's, Christie's, Bonhams, The Saleroom, LiveAuctioneers, eBay, 1stDibs, etc.).
- **PRICE ANCHORING**: Use the auction house's printed catalog estimate or listing price found at this URL as the authoritative anchor. Your estimated_market_range hammer price MUST directly align with this estimate (normally within 0.7x–1.5x) unless visible physical condition defects or unverified attribution justify a divergence.
- **CATALOG ATTRIBUTION CITATION**: In item_summary.confidence_reason and pricing_reasoning, explicitly cite the catalog estimate and listing context from the provided link (e.g. "Anchored to auction house catalog estimate for this lot at ${lotUrl}...").` : '- When an auction or listing URL is provided, prioritize fetching and using its official catalog estimate, lot dimensions, and descriptions as the primary anchor.'}

### PRICE RELATIONSHIP CONSTRAINTS (MANDATORY MATHEMATICAL RULES)
All prices MUST be in ${targetCurrency} and respect these strict inequalities:
1. opening_offer <= target_price_low <= target_price_high <= walk_away_price
2. walk_away_price <= estimated_market_range_high (never bid/pay above what the item is worth)${isAuction ? `
   For this auction lot: walk_away_price is the MAXIMUM HAMMER BID and walk_away_price x ${(1 + premiumPct / 100).toFixed(2)} (hammer + ${premiumPct}% buyer's premium) MUST be <= estimated_market_range_high.` : ''}
3. estimated_market_range_low <= estimated_market_range_high
4. good_buy_below <= estimated_market_range_low (dealer smart buy threshold)
5. overpaying_above > estimated_market_range_high (where buying becomes uncommercial)
6. fair_price_low <= fair_price_high (retail market tier)
7. fair_price_low >= estimated_market_range_low and fair_price_high >= estimated_market_range_high (retail is never below auction/market level)

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
- In pricing_reasoning, dealer_take, and negotiation_strategy, explicitly highlight the Buyer's Premium surcharge and warn that maximum paddle bids must be calculated as: Maximum Hammer Bid = Total Budget ÷ ${(1 + premiumPct / 100).toFixed(2)}. Walk-away price MUST be framed as the maximum hammer bid.` : ''}

### PRICING LOGIC & CURRENCY
All monetary numbers in price_guidance, dealer_take, and negotiation_strategy MUST be denominated in ${targetCurrency} (${currencySymbol}).
- estimated_market_range: Realistic dealer shop or auction hammer range in ${targetCurrency}.
- good_buy_below: The Smart Buy threshold for dealers.
- fair_price: Standard market price (retail tier, typically 2x to 4x hammer).
- overpaying_above: Walk-away price above which profit disappears.
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
    ${lotUrl ? `PRIMARY SOURCE - Auction / Listing URL: ${lotUrl}
    (IMPORTANT: Prioritize fetching official auction catalog estimates, starting bid, description, measurements, and lot details from this link as the primary benchmark for this appraisal.)` : ''}
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
                        evidence_quality: { type: Type.NUMBER },
                        identification_certainty: { type: Type.NUMBER },
                        risk_factors: { type: Type.NUMBER }
                      },
                      required: ["evidence_quality", "identification_certainty", "risk_factors"]
                    },
                    confidence_reason: { type: Type.STRING },
                    confidence_improvement_suggestions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-3 specific suggestions to increase confidence, tailored to the item." },
                    evidence_gaps: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["title", "category", "likely_origin", "likely_style", "likely_period", "value_tier", "snap_judgement", "confidence", "confidence_score", "confidence_breakdown", "confidence_reason", "confidence_improvement_suggestions", "evidence_gaps"]
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
  
  // Scoring configuration for easy tuning
  const getBuyLabel = (score: number) => {
    if (score >= 80) return "Dealer Buy Zone";
    if (score >= 65) return "Buy";
    if (score >= 45) return "Marginal Deal";
    if (score >= 25) return "Walk Away";
    return "Hard Pass";
  };

  const getConfidenceLabel = (score: number) => {
    if (score >= 80) return "high";
    if (score >= 60) return "medium";
    if (score >= 40) return "low";
    return "very_low";
  };

  // Calculate Buy Score in code based on scoring_inputs
  const items = result.items.map((item: any) => {
    const s = item.scoring_inputs;
    const c = item.item_summary.confidence_breakdown;
    
    // Calculate confidence score from breakdown
    let confScore = (c.evidence_quality || 0) + (c.identification_certainty || 0) + (c.risk_factors || 0);
    
    // Strict Evidence Grounding:
    // If NO photos were provided, confidence can NEVER be high, and evidence quality must be capped.
    if (!hasPhotos) {
      confScore = Math.min(confScore, 50);
      c.evidence_quality = Math.min(c.evidence_quality || 12, 14);
      if (!item.item_summary.confidence_reason.includes('photographic') && !item.item_summary.confidence_reason.includes('photos')) {
        item.item_summary.confidence_reason = `Unverified: Evaluated without physical photographs. Stamped marks, joinery, and authenticity cannot be confirmed without visual inspection. ${item.item_summary.confidence_reason}`;
      }
      if (!item.price_guidance.pricing_reasoning.includes('photos') && !item.price_guidance.pricing_reasoning.includes('photographs')) {
        item.price_guidance.pricing_reasoning = `Preliminary text-only appraisal without photos. Actual valuation depends on physical condition and construction. ${item.price_guidance.pricing_reasoning}`;
      }
    }

    // Vague queries (e.g. "old table", "chair") with no details
    const words = query.trim().split(/\s+/).length;
    if (words <= 3 && !hasPhotos) {
      confScore = Math.min(confScore, 35);
      item.item_summary.confidence_reason = `Speculative estimate: Query '${query}' is too generic with no images or provenance. ${item.item_summary.confidence_reason}`;
      item.price_guidance.pricing_reasoning = `Speculative valuation: A generic '${query}' can range from a modern utility piece to fine period antique. Inspect construction before relying on numbers. ${item.price_guidance.pricing_reasoning}`;
    }

    const finalConfScore = Math.max(1, Math.min(100, Math.round(confScore)));
    const confLabel = getConfidenceLabel(finalConfScore);

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
    
    // Rule: market_low <= market_high, and overpaying > market_high
    pg.overpaying_above = Math.max(pg.estimated_market_range_high + 1, Number(pg.overpaying_above) || Math.round(pg.estimated_market_range_high * 1.25));
    
    // Rule: good_buy_below <= market_low (or reasonable discount)
    if (!pg.good_buy_below || pg.good_buy_below > pg.estimated_market_range_low) {
      pg.good_buy_below = Math.round(pg.estimated_market_range_low * 0.8) || Math.round(pg.estimated_market_range_low);
    }

    // Retail bounds: fair_price_low <= fair_price_high
    pg.fair_price_low = Math.max(pg.estimated_market_range_low, Number(pg.fair_price_low) || Math.round(pg.estimated_market_range_low * 1.5));
    pg.fair_price_high = Math.max(pg.fair_price_low, pg.estimated_market_range_high, Number(pg.fair_price_high) || Math.round(pg.estimated_market_range_high * 2));

    // Negotiation Strategy: first_offer <= walk_in_low <= walk_in_high <= walk_away <= estimated_market_range_high
    if (ns) {
      // Auctions: walk-away is the max hammer bid, and hammer + buyer's premium must stay <= market high
      const walkAwayCap = isAuction ? maxHammerForMarketHigh(pg.estimated_market_range_high, premiumPct) : pg.estimated_market_range_high;
      ns.walk_away_price = Math.round(Math.min(walkAwayCap, Number(ns.walk_away_price) || walkAwayCap));
      ns.target_price_high = Math.min(ns.walk_away_price, Number(ns.target_price_high) || Math.round(ns.walk_away_price * 0.9));
      ns.target_price_low = Math.min(ns.target_price_high, Number(ns.target_price_low) || Math.round(ns.target_price_high * 0.85));
      ns.opening_offer = Math.min(ns.target_price_low, Number(ns.opening_offer) || Math.round(ns.target_price_low * 0.8));
    }

    // Ensure currency consistency
    item.price_guidance.currency = targetCurrency;

    // Ensure dynamic teaser insight (never generic £450)
    if (!item.teaser_insight || item.teaser_insight.includes('450') || item.teaser_insight.includes('£')) {
      if (item.price_guidance?.good_buy_below) {
        item.teaser_insight = `Dealers would typically buy below ${currencySymbol}${Math.round(item.price_guidance.good_buy_below)}. Above this, margin disappears.`;
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

    // Buy score is driven by the price actually paid (incl. buyer's premium) vs the ranges,
    // not by the model's self-scored inputs (which tended to sum to 100 -> a constant 90 in the UI).
    const askingPriceNum = Number(askingPrice);
    const allIn = askingPriceNum > 0 ? allInCost(askingPriceNum, premiumPct, isAuction) : 0;
    const priceScore = allIn > 0
      ? priceBandScore(allIn, pg.estimated_market_range_low, pg.estimated_market_range_high, pg.fair_price_high)
      : null;

    let finalScore: number;
    let scoreBand: { min: number; max: number } | null = null;
    if (priceScore) {
      finalScore = priceScore.score;
      scoreBand = priceScore.band;
      // Severe authenticity risk (reproduction, marriage, major damage) caps the score whatever the price
      if ((Number(s.risk_penalty) || 0) <= -25) {
        finalScore = Math.min(finalScore, 40);
        scoreBand = { min: Math.min(scoreBand.min, finalScore), max: Math.min(scoreBand.max, 40) };
      }
    } else {
      // No price given: we cannot judge the deal, so the score reflects the item only and stays below "Buy"
      finalScore = Math.max(1, Math.min(60, Math.round(calculatedScore)));
      scoreBand = { min: 1, max: 60 };
    }
    
    // Tier D Cap: Utility items should not have high scores
    let cappedScore = item.item_summary.value_tier === 'D' ? Math.min(finalScore, 30) : finalScore;
    if (item.item_summary.value_tier === 'D' && scoreBand) scoreBand = { min: Math.min(scoreBand.min, cappedScore), max: Math.min(scoreBand.max, 30) };
    cappedScore = Math.max(1, Math.min(100, Math.round(cappedScore)));
    
    return {
      ...item,
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
        price_basis: priceScore ? priceScore.basis : 'no_price',
        label: getBuyLabel(cappedScore),
        confidence: confLabel
      }
    };
  });

  return items;
};
