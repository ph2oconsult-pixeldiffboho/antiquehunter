// Shared request handling for POST /api/hunt.
// Used by the Vercel function (api/hunt.ts) and the local Express server (server.ts),
// so local dev and production behave the same.
import { huntAntiquesLive, HuntTimeoutError } from "./hunting.js";

export interface HuntHttpResult {
  status: number;
  body: { success: boolean; results?: unknown; error?: string; code?: string };
}

export const handleHuntRequest = async (rawBody: unknown): Promise<HuntHttpResult> => {
  let body: any = rawBody;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch {
      return { status: 400, body: { success: false, error: "Invalid JSON body", code: "bad_request" } };
    }
  }
  body = body || {};
  const { query, geographies, platforms, priceRange, currency, language, periodOnly } = body;
  if (!query || typeof query !== "string" || !query.trim()) {
    return { status: 400, body: { success: false, error: "Search query is required", code: "bad_request" } };
  }

  try {
    const results = await huntAntiquesLive({
      query: query.trim().slice(0, 500),
      geographies: Array.isArray(geographies) ? geographies.map(String) : [],
      platforms: Array.isArray(platforms) ? platforms.map(String) : [],
      priceRange: priceRange ? String(priceRange).slice(0, 100) : undefined,
      currency: currency ? String(currency) : "EUR",
      language: language ? String(language) : "en",
      periodOnly: periodOnly !== false,
    });
    return { status: 200, body: { success: true, results } };
  } catch (error: any) {
    console.error("Error executing hunt:", error);
    if (error instanceof HuntTimeoutError) {
      return { status: 200, body: { success: false, error: error.message, code: "timeout" } };
    }
    return { status: 200, body: { success: false, error: error?.message || "Sourcing check failed", code: "search_failed" } };
  }
};
