// Vercel serverless function for "Find Me an Antique".
// Shares its logic with the Express route in server.ts (which Vercel does not run).
// Requires GEMINI_API_KEY to be set in the Vercel project's environment variables.
import { handleHuntRequest } from "../src/services/huntHandler.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }
  const { status, body } = await handleHuntRequest(req.body);
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}
