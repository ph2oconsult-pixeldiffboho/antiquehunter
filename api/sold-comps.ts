// Vercel serverless function: comparable sold lots (Drouot / Auctionet results, fees stripped) for a piece with no
// verified maker anchor. See src/services/soldComps.ts. No secrets, no outside calls.
import { handleSoldCompsRequest } from "../src/services/soldCompsHandler.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const { status, body } = handleSoldCompsRequest(req.body);
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}
