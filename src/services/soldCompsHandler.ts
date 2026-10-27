// POST /api/sold-comps: comparable sold lots for a piece (server side; the 1.5 MB data file stays out of the client bundle).
import { readFileSync } from "fs";
import path from "path";
import { matchSoldComps, type SoldLot, type SoldCompsResponse } from "./soldComps.js";

let POOL: SoldLot[] | null = null;
/** The sold-lot pool (src/data/soldComps.json, shipped with the function via vercel.json includeFiles). */
export const soldPool = (): SoldLot[] => {
  if (!POOL) {
    try { POOL = JSON.parse(readFileSync(path.join(process.cwd(), "src/data/soldComps.json"), "utf8")).lots || []; }
    catch { POOL = []; }
  }
  return POOL!;
};

export const handleSoldCompsRequest = (raw: unknown): { status: number; body: SoldCompsResponse } => {
  const pool = soldPool();
  let b: any = raw;
  if (typeof b === 'string') { try { b = JSON.parse(b || '{}'); } catch { return { status: 400, body: { ok: false, comps: [], pool: pool.length, error: 'bad_request' } }; } }
  const text = String(b?.text || '').slice(0, 4000);
  if (text.trim().length < 3) return { status: 400, body: { ok: false, comps: [], pool: pool.length, error: 'text_required' } };
  if (!pool.length) return { status: 503, body: { ok: false, comps: [], pool: 0, error: 'pool_unavailable' } };
  const r = matchSoldComps(pool, text, { lotUrl: typeof b?.lotUrl === 'string' ? b.lotUrl : undefined, regionHint: b?.region === 'NORDIC' ? 'NORDIC' : undefined });
  return { status: 200, body: { ok: true, comps: r.comps, pool: pool.length, features: r.features } };
};
