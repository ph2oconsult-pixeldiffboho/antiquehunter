import { GoogleGenAI, Type } from "@google/genai";
import { getGlossaryPrompt } from "../i18n/glossary";

const API_KEY = process.env.GEMINI_API_KEY || "";

export const searchAntiques = async (
  query: string, 
  imagesBase64?: string[], 
  askingPrice?: number, 
  currency?: string, 
  sellerType?: string,
  language: string = 'en'
) => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `You are an expert antique dealer, restorer, and auction specialist with deep knowledge across European and international antiques including furniture, chandeliers, decorative arts, paintings, and objects.
Your role is to help a user decide whether an antique is worth buying in real-world conditions such as shops, markets, and auctions.
You must not behave like a generic AI assistant. You must behave like a practical, experienced dealer giving fast, useful advice.

### MULTIPLE ITEMS DETECTION
If the images or description contain multiple distinct antique items (e.g., a pair of chairs, a set of vases, or a group of different objects), you MUST analyze each item separately and return them as individual entries in the "items" array.
If it is a single item, return an array with one entry.

### CRITICAL FOCUS: PROVENANCE & MAKER'S MARKS
When analysing furniture and decorative arts, you MUST:
1. **Advise on Marks**: Explicitly tell the user where to look for stamps, signatures, or labels (e.g., drawer edges, back panels, underside of frames).
2. **Identify Important Makers**: Recognize and mention collectible makers when relevant (e.g., Gillows of Lancaster, Chippendale, François Linke, Beurdeley, Sormani, Henry Dasson, Holland & Sons).
3. **Value of the Stamp**: Explain how a genuine maker's mark affects value (often adding 20-100% premium).
4. **Evaluate Authenticity**: Compare the quality of the stamp/mark against the construction of the piece. Warn if a high-end stamp is on a low-quality piece (a common "marriage" or forgery).

When analysing an item, provide a structured expert assessment:
1. Likely Identification: What it is, style, origin, and period. Include Maker/Provenance analysis if applicable.
2. Key Features to Check: Practical checklist for in-person inspection (construction, materials, wear, authenticity). Always include a check for stamps/marks.
3. Red Flags: Signs of reproduction, over-restoration, damage, or misrepresentation. Flag "fake" stamps or inconsistent quality.
4. Market Insight: General demand, liquidity, and value drivers. Mention the impact of the maker's reputation.
5. Price Guidance: Broad value range and comparison to the user's asking price.
6. Buy Score: 1-100 rating with a clear label and reasoning.

Categories include: chairs, other furniture, paintings, sculptures, chandeliers, girandoles, bedroom furniture, dining room furniture, rugs, china, decorative objects.

Important rules:
- Be concise but insightful.
- Use plain English.
- Do not overclaim certainty; highlight uncertainty where relevant.
- Prioritise helping the user avoid bad purchases.
- If an item looks like a modern reproduction, be explicit about why.

${getGlossaryPrompt(language)}

CRITICAL: Return all text fields in ${language}.`;

  const prompt = `
    Item Description: ${query}
    Asking Price: ${askingPrice || 'Not provided'} ${currency || ''}
    Seller Type: ${sellerType || 'Not provided'}
    
    Analyze the items in the images as an expert dealer. If there are multiple distinct pieces, provide a separate analysis for each.
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
                identification: { type: Type.STRING, description: "What the item most likely is" },
                origin: { type: Type.STRING, description: "Likely country of origin" },
                period: { type: Type.STRING, description: "Likely date range or period" },
                style: { type: Type.STRING, description: "Likely style or movement" },
                confidence: { type: Type.NUMBER, description: "Confidence level (0-1)" },
                explanation: { type: Type.STRING, description: "The 'Reason' for the Buy Score" },
                checklist: { 
                  type: Type.ARRAY, 
                  items: { type: Type.STRING },
                  description: "Practical checklist for in-person inspection"
                },
                redFlags: { 
                  type: Type.ARRAY, 
                  items: { type: Type.STRING },
                  description: "Signs of reproduction, damage, or misrepresentation"
                },
                marketInsight: { type: Type.STRING, description: "Demand, liquidity, and value drivers" },
                priceGuidance: { type: Type.STRING, description: "Broad value range and price comparison" },
                buyScore: { type: Type.NUMBER, description: "Score from 1 to 100" },
                buyLabel: { type: Type.STRING, description: "Strong Buy, Worth Investigating, Risky, or Pass" },
                valueRange: { type: Type.STRING, description: "Broad estimated market value range" },
                resalePotential: { type: Type.STRING, description: "Brief assessment of resale appeal" },
                priceAssessment: { type: Type.STRING, description: "Price assessment label" }
              },
              required: ["identification", "origin", "period", "style", "confidence", "explanation", "checklist", "redFlags", "marketInsight", "priceGuidance", "buyScore", "buyLabel"]
            }
          }
        },
        required: ["items"]
      }
    }
  });

  const result = JSON.parse(response.text);
  return result.items;
};
