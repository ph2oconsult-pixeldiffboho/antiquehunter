import { GoogleGenAI, Type } from "@google/genai";
import { getGlossaryPrompt } from "../i18n/glossary";

const API_KEY = process.env.GEMINI_API_KEY || "";

export type AntiqueCategory = 
  | 'furniture' 
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
  const model = "gemini-3-flash-preview";
  
  const categoryPrompts: Record<AntiqueCategory, string> = {
    furniture: `Focus on: joinery (dovetails, mortise/tenon), wood type (solid vs veneer), back panels (hand-planed?), wear patterns, stripping/refinishing evidence, hardware authenticity, carving quality, and resale constraints from size.`,
    chandelier_lighting: `Focus on: casting quality (sharpness of detail), metal quality (bronze vs spelter), patina authenticity, wiring changes, evidence of drilling, structural modifications, replacement parts, and crystal/glass quality (lead content, hand-cut).`,
    painting_art: `Focus on: support (panel, canvas, paper), surface texture (impasto, cracks), brushwork vs print dots, stretcher/canvas age clues, varnish condition, restoration/overpainting, signature credibility, and provenance clues on the back.`,
    sculpture_object: `Focus on: casting marks, foundry stamps, material authenticity (bronze vs resin), patina wear, base attachment, and evidence of repairs or re-patination.`,
    rug_textile: `Focus on: knot density, dye type (natural vs synthetic), fringe attachment, wear patterns, repairs/re-weaving, and origin-specific motifs.`,
    china_ceramic: `Focus on: maker's marks, glaze quality, firing cracks vs damage, hand-painted vs transfer-ware, and evidence of professional restoration.`,
    decorative_object: `Focus on: material quality, maker's marks, style consistency, and signs of age vs modern reproduction techniques.`,
    unknown: `Infer the category first, then apply specialist knowledge. Focus on construction, materials, and signs of authentic age.`
  };

  const systemInstruction = `You are an expert antique dealer, restorer, and auction specialist. 
Your role is to help a user decide whether an antique is worth buying in real-world conditions.
You must behave like a practical, experienced dealer giving fast, useful, and slightly opinionated advice.

### CORE PRODUCT GOAL
Return a structured buying analysis that answers:
- What the item likely is.
- Likely origin, style, and period.
- How confident you are.
- What the user should check in person.
- What the main red flags are.
- What price range makes sense.
- Whether it is a strong buy, worth investigating, risky, or a pass.
- How a dealer would think about it (resale, liquidity).
- How the user should negotiate.
- When the user should walk away.

### CONFIDENCE RULES
Set confidence based on evidence quality:
- HIGH: Construction clearly visible, multiple authenticity indicators confirmed, minimal uncertainty.
- MEDIUM: Plausible identification, some uncertainty remains, key structural elements not confirmed.
- LOW: Limited or unclear images, conflicting signals, important details missing.

*Default to MEDIUM unless strong evidence justifies HIGH. Never assign HIGH confidence without clear structural evidence.*

### UNCERTAINTY MANAGEMENT
You must explicitly manage uncertainty:
- Do not assume facts that are not visible.
- Confidence must reflect real-world inspection limitations.
- Use 'confidence_reason' to explain the basis of your certainty or doubt.
- Use 'evidence_gaps' to list specific missing information (e.g., 'back of canvas not shown', 'underside of chair not visible').

### PRICING LOGIC
- estimated_market_range: The broad range a retail customer might pay.
- good_buy_below: The price where a collector should feel they got a bargain.
- fair_price: The standard price for this item in this condition.
- overpaying_above: The price where the user is definitely paying too much.
- target_buy_price: The price a dealer would aim for to make a healthy profit (usually 30-50% below retail).

### SCORING INPUTS (Points distribution for a 0-100 scale)
Assign points based on these categories:
- identification_confidence: 0 to 15 points (How sure are you about the ID?)
- authenticity_signals: 0 to 15 points (Signs of age, maker's marks, etc.)
- condition_and_restoration: 0 to 15 points (Impact of damage or repairs)
- price_vs_market: 0 to 20 points (Value relative to asking price)
- resale_liquidity: 0 to 15 points (How easily can it be sold?)
- rarity_desirability: 0 to 20 points (Market demand and scarcity)
- risk_penalty: -20 to 0 points (Subtract for major red flags or high uncertainty)

The final Buy Score will be calculated as the sum of these inputs.

### SPECIALIST KNOWLEDGE
${categoryPrompts[category] || categoryPrompts.unknown}

### CRITICAL FOCUS: PROVENANCE & MAKER'S MARKS
Explicitly tell the user where to look for stamps, signatures, or labels. Mention collectible makers when relevant.

### MULTIPLE ITEMS DETECTION
If multiple distinct items are present, analyze each separately in the "items" array.

### RULES
- Be commercially minded, not academic.
- Prioritise avoiding bad purchases.
- Identify negotiation leverage.
- Flag uncertainty clearly.
- Return valid structured JSON only. No markdown formatting.
- Return all text fields in ${language}.

${getGlossaryPrompt(language)}`;

  const prompt = `
    Item Description: ${query}
    Price: ${askingPrice || 'Not provided'} ${currency || ''} (${priceType === 'paid' ? 'Paid' : 'Offered/Asking'})
    Seller Type: ${sellerType || 'Not provided'}
    Location: ${location || 'Not provided'}
    Category: ${category}
    
    Analyze the items in the images as an expert dealer. If there are multiple distinct pieces, provide a separate analysis for each.
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
                    confidence: { type: Type.STRING, enum: ["high", "medium", "low"] },
                    confidence_reason: { type: Type.STRING },
                    evidence_gaps: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["title", "category", "likely_origin", "likely_style", "likely_period", "confidence", "confidence_reason", "evidence_gaps"]
                },
                buy_decision: {
                  type: Type.OBJECT,
                  properties: {
                    score: { type: Type.NUMBER },
                    label: { type: Type.STRING, enum: ["Strong Buy", "Worth Investigating", "Risky", "Pass"] },
                    confidence: { type: Type.STRING, enum: ["high", "medium", "low"] },
                    decision_summary: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["score", "label", "confidence", "decision_summary"]
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
                    identification_confidence: { type: Type.NUMBER },
                    authenticity_signals: { type: Type.NUMBER },
                    condition_and_restoration: { type: Type.NUMBER },
                    price_vs_market: { type: Type.NUMBER },
                    resale_liquidity: { type: Type.NUMBER },
                    rarity_desirability: { type: Type.NUMBER },
                    risk_penalty: { type: Type.NUMBER }
                  },
                  required: ["identification_confidence", "authenticity_signals", "condition_and_restoration", "price_vs_market", "resale_liquidity", "rarity_desirability", "risk_penalty"]
                },
                disclaimer: { type: Type.STRING }
              },
              required: [
                "item_summary", "buy_decision", "price_guidance", "dealer_take",
                "negotiation_strategy", "walk_away_if", "top_checks", "red_flags",
                "market_insight", "scoring_inputs", "disclaimer"
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
    if (score >= 80) return "Strong Buy";
    if (score >= 65) return "Worth Investigating";
    if (score >= 50) return "Risky";
    return "Pass";
  };

  // Calculate Buy Score in code based on scoring_inputs
  const items = result.items.map((item: any) => {
    const s = item.scoring_inputs;
    const calculatedScore = 
      (s.identification_confidence || 0) +
      (s.authenticity_signals || 0) +
      (s.condition_and_restoration || 0) +
      (s.price_vs_market || 0) +
      (s.resale_liquidity || 0) +
      (s.rarity_desirability || 0) +
      (s.risk_penalty || 0);
    
    const finalScore = Math.max(1, Math.min(100, Math.round(calculatedScore)));
    
    return {
      ...item,
      buy_decision: {
        ...item.buy_decision,
        score: finalScore,
        label: getBuyLabel(finalScore)
      }
    };
  });

  return items;
};
