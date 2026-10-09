// Vercel serverless function: verified auction comparables for a maker's piece (see src/services/compsSearch.ts).
// Requires GEMINI_API_KEY in the Vercel project's environment variables.
import { handleCompsRequest } from "../src/services/compsSearch.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const { status, body } = await handleCompsRequest(req.body);
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}
