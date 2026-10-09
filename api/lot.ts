// Vercel serverless function: read a pasted lot link (Drouot, Auctionet, Interencheres, other sites' meta tags)
// so the appraisal uses the real catalogue text, estimate and photos. Never returns the hammer result.
import { fetchLotFacts } from "../src/services/lotFetch.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const url = String(req.body?.url || "").trim();
  const facts = await fetchLotFacts(url, { withImages: req.body?.images !== false, timeoutMs: 9_000 }).catch((e: any) => ({ ok: false, url, site: "other", imageUrls: [], error: String(e?.message || e).slice(0, 120) }));
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json(facts);
}
