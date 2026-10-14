// Vercel serverless function: run the item appraisal through Gemini on the server.
// The GEMINI_API_KEY stays in the Vercel project's environment and is never shipped to the
// browser (it used to be inlined into the client bundle). Shares its logic with appraiseHandler.
import { handleAppraiseRequest } from "../src/services/appraiseHandler.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { status, body } = await handleAppraiseRequest(req.body);
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}
