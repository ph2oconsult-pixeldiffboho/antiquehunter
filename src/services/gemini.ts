import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { getGlossaryPrompt } from "../i18n/glossary";

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
  location?: string
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

  const currencySymbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency === 'JPY' ? '¥' : currency === 'AUD' ? 'A$' : '£';

  const systemInstruction = `You are a seasoned antique dealer, restorer, and auction specialist with decades of experience in the trade. 
Your role is to provide a professional, commercially-focused assessment of an item to determine its real-world value and buyability.
You must speak with the authority of an expert who has seen thousands of pieces. Your advice must be concise, confident, and slightly opinionated.

### CORE PRINCIPLES
- **No AI References**: Never mention that you are an AI, a model, or using automation. You are the expert.
- **No Fluff**: Remove all generic aesthetic commentary. Never use phrases like "beautiful", "timeless", or "classic appeal". Focus on money, risk, and decision-making. Every insight must help the user make or save money.
- **Dealer Framing**: Use dealer framing everywhere (e.g., "Dealers would...", "This sits inside dealer buying range...", "Little room for resale margin...").
- **Commercial Awareness**: Focus on liquidity, resale margins, and dealer reality.
- **Expert Tone**: Use decisive language. Avoid "appears to be" or "seems like" unless there is genuine ambiguity. Use "This is a..." or "The market for this is...".
- **Trust Signals**: Frame your insights as "Based on observed market behaviour" or "Aligned with dealer pricing patterns".
- **Reasoning**: Always provide a short, punchy reason for your decisions, especially for confidence levels and buy scores.

### VALUE TIER CLASSIFICATION
Classify the item into one of these tiers based on visual cues and context:
- Tier A: Investment (${currencySymbol}5000+) - Museum-quality or rare investment pieces.
- Tier B: Mid (${currencySymbol}200–${currencySymbol}5000) - Standard collectible antiques, quality furniture.
- Tier C: Decorative (${currencySymbol}20–${currencySymbol}200) - Common vintage, decorative home goods.
- Tier D: Utility (<${currencySymbol}20) - Modern mass-produced, low-value bric-a-brac.

### TIER-SPECIFIC RULES
- Tier D: Decisive and brief. "Modern reproduction. No collector value."
- Tier A/B: Professional, cautious, focusing on construction and provenance details that affect high-end value.

### CONFIDENCE & RISK
Confidence must reflect real-world inspection limitations. 
- High: "Solid match. Visual evidence is indisputable."
- Medium: "Likely match. Visible features align with the period, but physical inspection of joinery is advised."
- Low: "Speculative. Too many unknowns. Walk away unless you can verify the base/back."

### PRICING LOGIC (Dealer Framing)
- estimated_market_range: The "Dealer range" — what this realistically fetches in a shop or auction.
- good_buy_below: The "Smart Buy" threshold.
- fair_price: The standard market price.
- overpaying_above: The "Walk-away price" — above this, the margin disappears.
- target_buy_price: The price a dealer would pay to ensure a healthy flip.

### SCORING
Price vs Market is the primary driver. Stylistic qualities are secondary to the financial reality.
Apply hard penalties for reproductions (-40), structural damage (-20), or "marriages" (-15).

### SPECIALIST KNOWLEDGE
${categoryPrompts[category] || categoryPrompts.unknown}

### RULES
- Be commercially minded, not academic.
- Prioritise avoiding bad purchases.
- Identify negotiation leverage based on condition or common flaws.
- Return valid structured JSON only. No markdown.
- Return all text fields in ${language}.

${getGlossaryPrompt(language)}`;

  const prompt = `
    Item Description: ${query}
    Price: ${askingPrice || 'Not provided'} ${currency || ''} (${priceType === 'paid' ? 'Paid' : 'Offered/Asking'})
    Seller Type: ${sellerType || 'Not provided'}
    Location: ${location || 'Not provided'}
    Category: ${category}
    
    Assess the items in the images with the authority of a seasoned dealer. If there are multiple distinct pieces, provide a separate assessment for each.
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
    const confScore = (c.evidence_quality || 0) + (c.identification_certainty || 0) + (c.risk_factors || 0);
    const finalConfScore = Math.max(1, Math.min(100, Math.round(confScore)));
    const confLabel = getConfidenceLabel(finalConfScore);

    const calculatedScore = 
      (s.authenticity || 0) +
      (s.condition || 0) +
      (s.rarity_desirability || 0) +
      (s.market_demand || 0) +
      (s.price_vs_market || 0) +
      (s.liquidity || 0) +
      (s.risk_penalty || 0);
    
    // Apply additional penalty for clearly overpriced items if not already reflected
    let finalBaseScore = calculatedScore;
    const askingPriceNum = Number(askingPrice);
    if (askingPriceNum && item.price_guidance.overpaying_above && askingPriceNum > item.price_guidance.overpaying_above) {
      // Ensure a strong penalty for overpaying
      finalBaseScore = Math.min(finalBaseScore, 40); 
    }
    
    const finalScore = Math.max(1, Math.min(100, Math.round(finalBaseScore)));
    
    // Tier D Cap: Utility items should not have high scores
    const cappedScore = item.item_summary.value_tier === 'D' ? Math.min(finalScore, 30) : finalScore;
    
    return {
      ...item,
      item_summary: {
        ...item.item_summary,
        confidence: confLabel,
        confidence_score: finalConfScore
      },
      buy_decision: {
        ...item.buy_decision,
        score: cappedScore,
        label: getBuyLabel(cappedScore),
        confidence: confLabel
      }
    };
  });

  return items;
};
