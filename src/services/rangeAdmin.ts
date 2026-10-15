// Admin: clear a saved shared range (POST /api/range-store/clear). Protected by RANGE_ADMIN_TOKEN (server env var),
// compared in constant time; refused when the env var is unset. The piece hash is range_source.key in an appraisal.
import { createHash, timingSafeEqual } from "node:crypto";
import { redisEnv, upstashClient, validKey, RANGE_KEY_PREFIX, type RedisLike } from "./rangeStore.js";

export const MIN_ADMIN_TOKEN_LENGTH = 24;
/** A pasted env value often carries a trailing newline / spaces or wrapping quotes: normalise both sides the same way. */
export const normaliseToken = (v: unknown): string => String(v ?? '').trim().replace(/^(["'])(.*)\1$/s, '$2').trim();
/** Constant time: both sides are hashed to 32 bytes first, so lengths never leak. */
export const tokenMatches = (given: unknown, expected: string | undefined): boolean => {
  const e = normaliseToken(expected), g = typeof given === "string" ? normaliseToken(given) : "";
  if (e.length < MIN_ADMIN_TOKEN_LENGTH || !g) return false;
  const a = createHash("sha256").update(g).digest(), b = createHash("sha256").update(e).digest();
  return timingSafeEqual(a, b);
};
const bearer = (h: unknown): string => { const m = /^Bearer\s+(.+)$/i.exec(String(h || "")); return m ? m[1].trim() : ""; };

export const handleRangeClear = async (req: { method?: string; headers?: Record<string, any>; body?: any },
  deps: { env?: Record<string, string | undefined>; redis?: RedisLike | null } = {}): Promise<{ status: number; body: Record<string, unknown> }> => {
  const env = deps.env || process.env;
  if (req.method !== "POST" && req.method !== "DELETE") return { status: 405, body: { ok: false, error: "method_not_allowed" } };
  if (normaliseToken(env.RANGE_ADMIN_TOKEN).length < MIN_ADMIN_TOKEN_LENGTH) return { status: 503, body: { ok: false, error: "admin_not_configured" } };
  if (!tokenMatches(bearer(req.headers?.authorization ?? req.headers?.Authorization), env.RANGE_ADMIN_TOKEN)) {
    // server log only (never the value): helps tell a pasted-whitespace or wrong-value problem apart
    const raw = String(env.RANGE_ADMIN_TOKEN);
    console.warn(`Range admin: unauthorized (server token length ${normaliseToken(raw).length}${raw !== raw.trim() ? ", had surrounding whitespace" : ""}${/^["']/.test(raw.trim()) ? ", was quoted" : ""}).`);
    return { status: 401, body: { ok: false, error: "unauthorized" } };
  }
  let body = req.body; if (typeof body === "string") { try { body = JSON.parse(body || "{}"); } catch { body = {}; } }
  const key = String(body?.piece_key || "").trim().toLowerCase();
  if (!validKey(key)) return { status: 400, body: { ok: false, error: "bad_piece_key" } };
  let redis = deps.redis;
  if (redis === undefined) { const e = redisEnv(env); redis = e ? upstashClient(e.url, e.token) : null; }
  if (!redis || !redis.del) return { status: 503, body: { ok: false, error: "store_not_configured" } };
  try {
    const n = await redis.del(RANGE_KEY_PREFIX + key);
    console.log(`Range store: cleared ${key} (${n ? "deleted" : "not found"}).`);
    return { status: 200, body: { ok: true, piece_key: key, deleted: n > 0 } };
  } catch (e: any) {
    console.error("Range store clear failed:", e?.message || e);
    return { status: 502, body: { ok: false, error: "store_error" } };
  }
};
