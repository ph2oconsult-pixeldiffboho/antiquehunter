// Vercel serverless function: clear one saved shared range (admin only, see src/services/rangeAdmin.ts).
import { handleRangeClear } from "../../src/services/rangeAdmin.js";

export default async function handler(req: any, res: any) {
  const { status, body } = await handleRangeClear({ method: req.method, headers: req.headers, body: req.body });
  res.setHeader("Cache-Control", "no-store");
  if (status === 405) res.setHeader("Allow", "POST, DELETE");
  return res.status(status).json(body);
}
