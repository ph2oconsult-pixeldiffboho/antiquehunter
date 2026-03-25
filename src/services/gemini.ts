import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { getGlossaryPrompt } from "../i18n/glossary";

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

  const systemInstruction = `You are an expert antique dealer, restorer, and auction specialist. 
Your role is to help a user decide whether an antique is worth buying in real-world conditions.
You must behave like a practical, experienced dealer giving fast, useful, and slightly opinionated advice. 
Your advice MUST be highly specific to the item's category, material, and reported condition. 
Avoid generic statements. If the condition is poor, explain exactly how that impacts value for THIS specific item type. 
For example, if it's furniture, mention specific joinery or wood issues. If it's glass, mention specific wear or pontil marks.

### VALUE TIER CLASSIFICATION
Before scoring, classify the item into one of these tiers based on visual cues, category, and context:
- Tier A: Investment (${currencySymbol}5000+) - High-end, museum-quality, or rare investment pieces.
- Tier B: Mid (${currencySymbol}200–${currencySymbol}5000) - Standard collectible antiques, quality furniture, fine art.
- Tier C: Decorative (${currencySymbol}20–${currencySymbol}200) - Common vintage items, decorative home goods, minor collectibles.
- Tier D: Utility (<${currencySymbol}20) - Modern mass-produced items, common household goods, low-value bric-a-brac.

### TIER-SPECIFIC RULES
- Tier D Items: 
  - Must have capped scores (rarely exceeding 30).
  - Outputs must be short, decisive, and direct.
  - Tone should be "no-nonsense" (e.g., 'This is a modern reproduction. No antique value.').
- Tier A/B Items:
  - Require more detailed analysis of construction and provenance.
  - Tone should be professional and cautious.

### CORE PRODUCT GOAL
Return a structured buying analysis that answers:
- What the item likely is.
- Value Tier (A, B, C, or D).
- Likely origin, style, and period.
- How confident you are.
- What the user should check in person.
- What the main red flags are.
- What price range makes sense.
- Whether it is a strong buy, worth investigating, risky, or a pass.
- A one-sentence, direct "snap judgement" (e.g. 'Not collectible. Utility glass.').
- How a dealer would think about it (resale, liquidity).
- How the user should negotiate.
- When the user should walk away.

### GOAL-SPECIFIC INSIGHTS
Provide a one-sentence, highly specific insight for each potential buying goal:
- investment_insight: Focus on long-term value retention, rarity, and historical significance for THIS specific item.
- must_have_insight: Focus on aesthetic appeal, utility, and personal enjoyment for THIS specific item, even if financial ROI is lower.
- resale_insight: Focus on short-term liquidity, current market trends, and potential profit margins after restoration/shipping costs for THIS specific item.

### CONFIDENCE RULES
Confidence is calculated from three components (Total = 100):
1. Evidence Quality (0–40): Based on image clarity, number of angles, and visibility of key construction details.
2. Identification Certainty (0–30): How clearly the item type, period, and maker can be identified.
3. Risk Factors (0–30): Impact of missing views (back, base), lack of provenance, or possible restoration/ambiguity.

Map the total score to these labels:
- 80–100: High confidence
- 60–79: Medium confidence
- 40–59: Low confidence
- <40: Very low confidence

### TONE & CONFIDENCE
Adjust your output tone (snap_judgement, decision_summary, negotiation_strategy) based on the confidence level:
- High confidence: Be decisive and provide strong recommendations.
- Medium confidence: Be slightly cautious, acknowledge the likely identification but note potential for variation.
- Low confidence: Encourage physical inspection, avoid strong conclusions, and highlight specific risks.
- Very low confidence: Advise the user NOT to make a decision yet based on the current evidence.

*Default to Medium or Low unless evidence is exceptional. Never assign High confidence without seeing key structural markers.*

### UNCERTAINTY MANAGEMENT
You must explicitly manage uncertainty:
- Do not assume facts that are not visible.
- Confidence must reflect real-world inspection limitations.
- Use 'confidence_reason' to explain the basis of your certainty or doubt.
- Format for 'confidence_reason': "Reason: [Specific missing detail or ambiguity]". Keep it concise, specific, and actionable (e.g., "Reason: Missing rear view and joinery details").
- Use 'evidence_gaps' to list specific missing information.

### CONFIDENCE IMPROVEMENT
Provide 2–3 specific suggestions to increase confidence in the 'confidence_improvement_suggestions' field.
- Suggestions must be tailored to the item (e.g., "Add a photo of the back", "Provide a close-up of the signature", "Show joinery or construction details").
- Keep them concise and actionable.
- Do not use generic wording.

### PRICING LOGIC
- estimated_market_range: The broad range a retail customer might pay.
- good_buy_below: The price where a collector should feel they got a bargain.
- fair_price: The standard price for this item in this condition.
- overpaying_above: The price where the user is definitely paying too much.
- target_buy_price: The price a dealer would aim for to make a healthy profit (usually 30-50% below retail).

### SCORING INPUTS (Points distribution for a 0-100 scale)
Price vs Market is the most influential factor. Descriptive or stylistic qualities are secondary to the financial reality.

Assign points based on these categories:
1. Authenticity: 0 to 15 points (Signs of age, maker's marks, provenance)
2. Condition: 0 to 10 points (Impact of damage, repairs, or restoration)
3. Rarity / Desirability: 0 to 10 points (Scarcity and collector appeal)
4. Market Demand: 0 to 10 points (Current popularity and ease of sale)
5. Price vs Market: 0 to 45 points (Value relative to asking price/market reality)
6. Liquidity: 0 to 10 points (How quickly it can be converted back to cash)
7. Risk Penalty: -40 to 0 points (Subtract for critical issues)

### CRITICAL PENALTY RULES
Apply these hard penalties to the 'risk_penalty' input:
- Modern Reproduction Signals: -30 to -40 points (Large reduction). If you suspect it's a modern fake, the score must crash.
- Structural Damage: -15 to -20 points (Moderate reduction). Major cracks, missing limbs, or structural instability.
- Mismatched Components ("Marriage"): -10 to -15 points (Moderate reduction). e.g., a 19th-century top on an 18th-century base.
- Poor Liquidity: -5 to -10 points (Small reduction). Items that are too large for most homes or extremely niche.

### PRICING PENALTY & BONUS RULES
- If an item is clearly overpriced (Asking Price > overpaying_above): Apply a strong penalty to the 'price_vs_market' score (0-10) and ensure the final recommendation is 'Avoid' or 'Hard Pass'.
- If an item is underpriced (Asking Price < good_buy_below): Increase the 'price_vs_market' score meaningfully (35-45) to reflect the high value-to-cost ratio.
- Pricing must have a stronger impact than descriptive or stylistic qualities. A beautiful item at a terrible price is a bad buy.

The final Buy Score will be calculated as the sum of these inputs.

### SPECIALIST KNOWLEDGE
${categoryPrompts[category] || categoryPrompts.unknown}

### CRITICAL FOCUS: PROVENANCE & MAKER'S MARKS
Explicitly tell the user where to look for stamps, signatures, or labels. Mention collectible makers when relevant.

### MULTIPLE ITEMS DETECTION
If multiple distinct items are present, analyze each separately in the "items" array.

### TONE ALIGNMENT
Your tone must shift based on the final Buy Score and label:
- Strong Buy (80–100): Confident, positive, and opportunity-focused. Highlight why this is a rare find.
- Buy (65–79): Positive but measured. Acknowledge the value but stay grounded in dealer reality.
- Risky (45–64): Balanced and cautious. Focus heavily on the "checks" and potential downsides.
- Avoid (25–44): A clear, firm warning. Focus on the financial or authenticity risks.
- Hard Pass (0–24): Blunt, decisive, and brief. Minimal explanation needed for junk or fakes.

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
                    label: { type: Type.STRING, enum: ["Strong Buy", "Buy", "Risky", "Avoid", "Hard Pass"] },
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
    if (score >= 80) return "Strong Buy";
    if (score >= 65) return "Buy";
    if (score >= 45) return "Risky";
    if (score >= 25) return "Avoid";
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
