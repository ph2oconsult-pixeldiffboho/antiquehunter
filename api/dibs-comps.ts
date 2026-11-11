// Vercel serverless function: comparable 1stDibs asking-price listings (not sales) for the
// dealer / antique-shop walk-away. See src/services/dibsComps.ts. No secrets, no outside calls.
import { handleDibsCompsRequest } from "../src/services/dibsCompsHandler.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const { status, body } = handleDibsCompsRequest(req.body);
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}
