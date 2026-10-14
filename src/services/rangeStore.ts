// Shared range store (server side, Upstash Redis REST). The main model's range for a piece (priceCache.pieceKey) is
// stored once and served to every user and device; a fallback model's range is never stored as canonical.
// Missing env vars, a slow or failing Redis: the store is skipped (current behaviour), within RANGE_STORE_TIMEOUT_MS.
export const RANGE_STORE_TIMEOUT_MS = 800;
export const RANGE_STORE_TTL_S = 90 * 24 * 3600;
export const RANGE_KEY_PREFIX = 'ah:range:v1:';

export interface SharedRange { low: number; high: number; fair_low: number; fair_high: number; model: string; ts: number }
export type RangeStoreStatus = 'off' | 'hit' | 'stored' | 'miss' | 'error' | 'no_key';
export interface RedisLike { get(key: string): Promise<string | null>; setNx(key: string, value: string, ttlS: number): Promise<boolean> }

/** Vercel's Upstash integration names the vars KV_REST_API_* (or UPSTASH_REDIS_REST_* when connected directly). */
export const redisEnv = (env: Record<string, string | undefined> = process.env): { url: string; token: string; names: string } | null => {
  const pairs: Array<[string, string]> = [['KV_REST_API_URL', 'KV_REST_API_TOKEN'], ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']];
  for (const [u, t] of pairs) if (env[u] && env[t]) return { url: String(env[u]).replace(/\/+$/, ''), token: String(env[t]), names: u.replace(/_URL$/, '_*') };
  return null;
};

/** Minimal Upstash REST client (no dependency): POST [command...] to the base URL. */
export const upstashClient = (url: string, token: string, fetchFn: typeof fetch = fetch, timeoutMs = RANGE_STORE_TIMEOUT_MS): RedisLike => {
  const cmd = async (args: (string | number)[]) => {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), timeoutMs);
    try {
      const r = await fetchFn(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args), signal: c.signal });
      if (!r.ok) throw new Error(`redis ${r.status}`);
      const j: any = await r.json();
      if (j?.error) throw new Error(String(j.error));
      return j?.result;
    } finally { clearTimeout(t); }
  };
  return {
    get: async (k) => { const v = await cmd(['GET', k]); return typeof v === 'string' ? v : null; },
    setNx: async (k, v, ttl) => (await cmd(['SET', k, v, 'NX', 'EX', ttl])) === 'OK',
  };
};

/** The range in a model answer (items[0].price_guidance), or null. */
export const rangeOfAnswer = (text: string): Omit<SharedRange, 'model' | 'ts'> | null => {
  try {
    const pg = JSON.parse(text)?.items?.[0]?.price_guidance;
    const r = { low: Number(pg?.estimated_market_range_low) || 0, high: Number(pg?.estimated_market_range_high) || 0, fair_low: Number(pg?.fair_price_low) || 0, fair_high: Number(pg?.fair_price_high) || 0 };
    return r.high > 0 && r.low >= 0 && r.high >= r.low ? r : null;
  } catch { return null; }
};

export const validKey = (k: unknown): k is string => typeof k === 'string' && /^[0-9a-f]{8,64}$/.test(k);

/**
 * Primary answer: store it if the key is new (SET NX); if one is already stored, serve the stored one.
 * Fallback answer: serve the stored range if any; never store. Any error / timeout -> { status: 'error' } and no range.
 */
export const resolveSharedRange = async (redis: RedisLike | null, key: unknown, text: string, model: string, primary: boolean, now = Date.now()):
  Promise<{ status: RangeStoreStatus; range?: SharedRange }> => {
  if (!redis) return { status: 'off' };
  if (!validKey(key)) return { status: 'no_key' };
  const k = RANGE_KEY_PREFIX + key;
  try {
    if (primary) {
      const fresh = rangeOfAnswer(text);
      if (fresh) {
        const rec: SharedRange = { ...fresh, model, ts: now };
        if (await redis.setNx(k, JSON.stringify(rec), RANGE_STORE_TTL_S)) return { status: 'stored', range: rec };
      }
    }
    const raw = await redis.get(k);
    if (!raw) return { status: 'miss' };
    const r = JSON.parse(raw) as SharedRange;
    return r && r.high > 0 ? { status: 'hit', range: r } : { status: 'miss' };
  } catch (e: any) {
    console.error('Range store skipped:', e?.message || e);
    return { status: 'error' };
  }
};
