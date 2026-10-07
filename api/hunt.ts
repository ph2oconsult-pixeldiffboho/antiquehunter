// Vercel serverless function for "Find Me an Antique".
// Mirrors the Express route in server.ts (which Vercel does not run).
// Requires GEMINI_API_KEY to be set in the Vercel project's environment variables.
import { huntAntiquesLive } from "../src/services/hunting.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { query, geographies, platforms, priceRange, currency, language } = body;
    if (!query) {
      return res.status(200).json({ success: false, error: "Search query is required" });
    }

    const results = await huntAntiquesLive({
      query,
      geographies: geographies || [],
      platforms: platforms || [],
      priceRange,
      currency,
      language: language || "en",
    });

    return res.status(200).json({ success: true, results });
  } catch (error: any) {
    console.error("Error executing hunt:", error);
    return res.status(200).json({ success: false, error: error?.message || "Sourcing check failed" });
  }
}
