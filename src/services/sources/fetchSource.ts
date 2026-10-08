// Fetch helper for the direct auction-site searches (Interencheres, Drouot).
// - Identifies the app politely and keeps volume low (short in-memory cache, one search page per site per hunt).
// - Optional relay: some sites refuse requests from Vercel's servers (Interencheres answers 403 from both
//   Vercel's US and Paris regions). If FETCH_RELAY_URL is set, requests to the hosts in FETCH_RELAY_HOSTS
//   (default: interencheres.com) go through it instead:
//     GET ${FETCH_RELAY_URL}?url=<encoded target url>   with header  X-Relay-Key: ${FETCH_RELAY_KEY}
//   The relay must answer with the target's status code and body, and should only allow the auction hosts.
// No relay is configured by default; without it those hosts are fetched directly (and usually blocked).

export const DIRECT_USER_AGENT = 'AntiqueHunter/1.0 (+https://antiquehunter.vercel.app; personal antique-search tool, low volume)';

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': DIRECT_USER_AGENT,
  'Accept': 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
};

export interface SourceResponse {
  status: number;          // 0 = timeout / network error
  body?: string;
  ms: number;
  viaRelay: boolean;
  cached: boolean;
  error?: string;
}

interface CacheEntry { expires: number; value: SourceResponse }
const cache = new Map<string, CacheEntry>();
const MAX_CACHE_ENTRIES = 300;
const MAX_BODY_CHARS = 2_000_000;

export const clearSourceCache = () => cache.clear();

const hostOf = (url: string) => { try { return new URL(url).hostname.toLowerCase(); } catch { return ''; } };

export const relayConfig = (env: Record<string, string | undefined> = process.env) => {
  const url = (env.FETCH_RELAY_URL || '').trim();
  const key = (env.FETCH_RELAY_KEY || '').trim();
  const hosts = (env.FETCH_RELAY_HOSTS || 'interencheres.com').split(',').map(h => h.trim().toLowerCase()).filter(Boolean);
  return url ? { url, key, hosts } : null;
};

/** The URL actually requested (relay or direct) for a target URL. */
export const requestUrlFor = (target: string, env: Record<string, string | undefined> = process.env): { url: string; viaRelay: boolean; headers: Record<string, string> } => {
  const relay = relayConfig(env);
  const host = hostOf(target);
  if (relay && relay.hosts.some(h => host === h || host.endsWith('.' + h))) {
    const sep = relay.url.includes('?') ? '&' : '?';
    return { url: `${relay.url}${sep}url=${encodeURIComponent(target)}`, viaRelay: true, headers: relay.key ? { 'X-Relay-Key': relay.key } : {} };
  }
  return { url: target, viaRelay: false, headers: {} };
};

/**
 * GET a page or JSON document with a timeout and a short cache.
 * ttlMs applies to successful (2xx) answers; blocks (403/429) are remembered for 10 minutes so a blocked site
 * is not hit again on every hunt.
 */
export const fetchSource = async (target: string, opts: { timeoutMs: number; ttlMs: number; accept?: string }): Promise<SourceResponse> => {
  const now = Date.now();
  const hit = cache.get(target);
  if (hit && hit.expires > now) return { ...hit.value, cached: true, ms: 0 };
  const req = requestUrlFor(target);
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, opts.timeoutMs));
  let value: SourceResponse;
  try {
    const res = await fetch(req.url, {
      method: 'GET',
      redirect: 'follow',
      headers: { ...DEFAULT_HEADERS, ...(opts.accept ? { Accept: opts.accept } : {}), ...req.headers },
      signal: controller.signal,
    });
    const body = res.ok ? (await res.text()).slice(0, MAX_BODY_CHARS) : undefined;
    value = { status: res.status, body, ms: Date.now() - started, viaRelay: req.viaRelay, cached: false };
  } catch (err: any) {
    value = { status: 0, ms: Date.now() - started, viaRelay: req.viaRelay, cached: false, error: err?.name === 'AbortError' ? 'timeout' : String(err?.message || err).slice(0, 120) };
  } finally {
    clearTimeout(timer);
  }
  const ttl = value.status >= 200 && value.status < 300 ? opts.ttlMs : (value.status === 403 || value.status === 429) ? 10 * 60_000 : 0;
  if (ttl > 0) {
    if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value as string);
    cache.set(target, { expires: now + ttl, value });
  }
  return value;
};
