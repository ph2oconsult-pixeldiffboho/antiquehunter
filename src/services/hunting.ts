import { GoogleGenAI, Type } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY || "";

export interface HuntParams {
  query: string;
  geographies: string[];
  platforms: string[];
  priceRange?: string;
  currency?: string;
  language?: string;
}

export const huntAntiquesLive = async (params: HuntParams) => {
  if (!API_KEY) {
    throw new Error("GEMINI_API_KEY is not defined in the environment.");
  }

  const ai = new GoogleGenAI({
    apiKey: API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  const { query, geographies, platforms, priceRange, currency = "USD", language = "en" } = params;

  const geographyText = geographies.length > 0 ? geographies.join(", ") : "Global markets";
  const platformText = platforms.length > 0 ? platforms.join(", ") : "recognized antique platforms (Interencheres, Drouot, LeBonCoin, Christie's, Sotheby's, eBay)";

  const systemInstruction = `You are a premium antique finder, sourcing specialist, and professional dealer. 
Your goal is to search the live web for the user's requested antique item and return high-quality matching search results. 
Adopt an authoritative, sharp, and commercially realistic tone. You avoid retail traps and analyze listings to verify if they are good deals for the buyer.

IMPORTANT RULES:
1. Use the googleSearch tool to browse the live web. Focus on active or upcoming auctions, estate sales, and classified listings in ${geographyText}.
2. Target platforms MUST include or heavily prioritize: ${platformText}.
3. Look for authentic pieces, and provide a dealer's sharp assessment on the matches found.
4. If you find live URL links in the grounding results, include them EXACTLY in your 'url' string parameter.
5. All text content must be returned in the user's selected language: '${language}'.
6. Return structured JSON only. No extra markdown tags or wrapper text outside the JSON structure.`;

  const promptText = `Find actual live or upcoming antique listings matching the following criteria:
Query: ${query}
Geographies/Selected Areas: ${geographyText}
Target Platforms and Sites: ${platformText}
Target Price/Budget: ${priceRange || "Competitive market rates"}
Currency: ${currency}

Scour the specified geographies and recognized websites for active pieces or active auction listings. 
Return the best matched listings in the database structure below.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            marketBrief: {
              type: Type.STRING,
              description: "A 2-3 sentence dealer state-of-the-market brief regarding availability, typical rates, and sourcing difficulty for this specific piece in these areas."
            },
            matches: {
              type: Type.ARRAY,
              description: "A list of realistic matches or active listings found during live web sourcing.",
              items: {
                type: Type.OBJECT,
                properties: {
                  title: {
                    type: Type.STRING,
                    description: "Title or designation of the antique found (e.g., '19th Century French Walnut Commodes')."
                  },
                  url: {
                    type: Type.STRING,
                    description: "Direct real website URL to the listing (Interencheres, Drouot, LeBonCoin, Christie's, or eBay) - must match live URL or google search grounding link."
                  },
                  platform: {
                    type: Type.STRING,
                    description: "Single-word or official brand name of the source (e.g. 'Interencheres', 'Drouot', 'LeBonCoin', 'eBay', 'Christie's')."
                  },
                  price: {
                    type: Type.STRING,
                    description: "The price, reserve, or starting estimate (e.g. 'Asking €850', 'Estimate €1,200 - €1,800'). Use correct currency symbol."
                  },
                  location: {
                    type: Type.STRING,
                    description: "Location of the seller, auction house, or piece (e.g., 'Paris, France', 'London, UK')."
                  },
                  date: {
                    type: Type.STRING,
                    description: "Listing date, auction closing date, or status (e.g. 'Auction: June 15, 2026', 'Active Classified')."
                  },
                  description: {
                    type: Type.STRING,
                    description: "A brief summary of the item condition, era, and design details as listed."
                  },
                  dealerAnalysis: {
                    type: Type.STRING,
                    description: "Your sharp field-note evaluation of this listing. Mention price reasonability, authenticity checks needed (flaws, handles, wood joints), and whether a dealer would jump on it or walk away."
                  }
                },
                required: ["title", "url", "platform", "price", "location", "dealerAnalysis"]
              }
            },
            dealerClosingTip: {
              type: Type.STRING,
              description: "One ultimate sourcing insider tip for negotiating or auditing this specific model of antique."
            }
          },
          required: ["marketBrief", "matches", "dealerClosingTip"]
        }
      }
    });

    if (response.text) {
      const parsed = JSON.parse(response.text.trim());
      
      // Enhance urls with search grounding where they might be missing or generic
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (groundingChunks && parsed.matches) {
        parsed.matches = parsed.matches.map((match: any, index: number) => {
          // If the model did not output a real URL but wrote a placeholder or empty string, or we have groundings, map them!
          if ((!match.url || match.url.includes("example") || match.url.length < 10) && groundingChunks.length > 0) {
            // Find a grounding chunk that contains or suggests the platform, or fallback to any available
            const chunk = groundingChunks.find((c: any) => 
               c.web?.uri && (c.web.uri.toLowerCase().includes(match.platform.toLowerCase()) || c.web.title.toLowerCase().includes(match.title.toLowerCase()))
            ) || groundingChunks[index % groundingChunks.length];
            
            if (chunk && chunk.web?.uri) {
              match.url = chunk.web.uri;
            }
          }
          return match;
        });
      }

      return parsed;
    }

    throw new Error("Empty response from AI sourcing engine.");
  } catch (error) {
    console.error("Live hunt service failed:", error);
    throw error;
  }
};
