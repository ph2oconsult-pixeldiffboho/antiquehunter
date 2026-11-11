// POST /api/dibs-comps: comparable 1stDibs asking-price listings for a piece (server side; the
// data file stays out of the client bundle). Asking prices, not sales.
import { readFileSync } from "fs";
import path from "path";
import { matchDibsComps, type DibsLot, type DibsCompsResponse } from "./dibsComps.js";

let POOL: DibsLot[] | null = null;
/** The 1stDibs asking-price pool (src/data/dibsComps.json, shipped with the function via vercel.json includeFiles). */
export const dibsPool = (): DibsLot[] => {
  if (!POOL) {
    try { POOL = JSON.parse(readFileSync(path.join(process.cwd(), "src/data/dibsComps.json"), "utf8")).lots || []; }
    catch { POOL = []; }
  }
  return POOL!;
};

export const handleDibsCompsRequest = (raw: unknown): { status: number; body: DibsCompsResponse } => {
  const pool = dibsPool();
  let b: any = raw;
  if (typeof b === 'string') { try { b = JSON.parse(b || '{}'); } catch { return { status: 400, body: { ok: false, comps: [], pool: pool.length, error: 'bad_request' } }; } }
  const text = String(b?.text || '').slice(0, 4000);
  if (text.trim().length < 3) return { status: 400, body: { ok: false, comps: [], pool: pool.length, error: 'text_required' } };
  if (!pool.length) return { status: 503, body: { ok: false, comps: [], pool: 0, error: 'pool_unavailable' } };
  const r = matchDibsComps(pool, text, { lotUrl: typeof b?.lotUrl === 'string' ? b.lotUrl : undefined, regionHint: b?.region === 'NORDIC' ? 'NORDIC' : undefined });
  return { status: 200, body: { ok: true, comps: r.comps, pool: pool.length, features: r.features } };
};
