// Shared auth + App Check + rate-limit guard for the Vercel API routes (server-only; never import from the client).
//
//   export default withApiGuard(handler, { route: "hunt" });
//
// Behaviour (all env flags are read per request, so a Vercel env change + redeploy is all that's needed):
// - Rate limiting is ALWAYS on. Key = verified Firebase uid when a valid ID token is sent, otherwise client IP.
//   Store: Upstash Redis / Vercel KV REST API when UPSTASH_REDIS_REST_URL+TOKEN (or KV_REST_API_URL+TOKEN) are set,
//   otherwise an in-memory fixed window per serverless instance (BEST-EFFORT ONLY: each warm instance has its own
//   counters and they reset on cold start, so the real ceiling is limit × instances).
// - REQUIRE_API_AUTH=true  → requests without a valid `Authorization: Bearer <Firebase ID token>` get 401.
//   Default off, so signed-out users keep working; a valid token is still verified and used as the rate-limit key.
// - REQUIRE_APP_CHECK=true → requests without a valid `X-Firebase-AppCheck` token get 401. Default off.
// - Verification uses the Firebase Admin SDK, configured from FIREBASE_SERVICE_ACCOUNT (the service-account JSON,
//   raw or base64) or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.
// - If a flag is on but the Admin SDK isn't configured, requests fail closed with 503 (misconfiguration is visible).

export interface GuardOptions {
  /** Short route name, used in rate-limit keys and logs. */
  route: string;
  /** Requests per window per identity. Default RATE_LIMIT_PER_MIN (env) or 20. */
  limit?: number;
  /** Window length in seconds. Default 60. */
  windowSec?: number;
}

export interface Verifier {
  verifyIdToken(token: string): Promise<{ uid: string }>;
  verifyAppCheck(token: string): Promise<{ appId: string }>;
}

export interface RateStore {
  /** Increment the counter for key in the current window; returns the new count. */
  hit(key: string, windowSec: number): Promise<number>;
}

type Handler = (req: any, res: any) => unknown | Promise<unknown>;

const flag = (name: string) => /^(1|true|yes|on)$/i.test(String(process.env[name] || "").trim());

// ---------- rate-limit stores ----------

export function memoryStore(): RateStore {
  const buckets = new Map<string, { n: number; resetAt: number }>();
  return {
    async hit(key, windowSec) {
      const now = Date.now();
      if (buckets.size > 5000) for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
      const b = buckets.get(key);
      if (!b || b.resetAt <= now) {
        buckets.set(key, { n: 1, resetAt: now + windowSec * 1000 });
        return 1;
      }
      b.n += 1;
      return b.n;
    },
  };
}

export function upstashStore(url: string, token: string, fetchImpl: typeof fetch = fetch): RateStore {
  return {
    async hit(key, windowSec) {
      const windowKey = `rl:${key}:${Math.floor(Date.now() / 1000 / windowSec)}`;
      const r = await fetchImpl(`${url.replace(/\/$/, "")}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify([["INCR", windowKey], ["EXPIRE", windowKey, String(windowSec + 5)]]),
      });
      if (!r.ok) throw new Error(`rate store HTTP ${r.status}`);
      const out = (await r.json()) as Array<{ result?: number }>;
      return Number(out?.[0]?.result ?? 0);
    },
  };
}

let defaultStore: RateStore | null = null;
function getDefaultStore(): RateStore {
  if (defaultStore) return defaultStore;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  defaultStore = url && token ? upstashStore(url, token) : memoryStore();
  return defaultStore;
}

// ---------- Firebase Admin verifier (lazy) ----------

let adminVerifier: Promise<Verifier | null> | null = null;
function loadServiceAccount(): Record<string, string> | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    return JSON.parse(text);
  }
  const { FIREBASE_PROJECT_ID: projectId, FIREBASE_CLIENT_EMAIL: clientEmail, FIREBASE_PRIVATE_KEY: key } = process.env;
  if (projectId && clientEmail && key) return { projectId, clientEmail, privateKey: key.replace(/\\n/g, "\n") };
  return null;
}
function getAdminVerifier(): Promise<Verifier | null> {
  if (adminVerifier) return adminVerifier;
  adminVerifier = (async () => {
    const sa = loadServiceAccount();
    if (!sa) return null;
    const { initializeApp, getApps, cert } = await import("firebase-admin/app");
    const { getAuth } = await import("firebase-admin/auth");
    const { getAppCheck } = await import("firebase-admin/app-check");
    const app = getApps().find((a) => a.name === "api-guard") || initializeApp({ credential: cert(sa as any) }, "api-guard");
    return {
      verifyIdToken: (t: string) => getAuth(app).verifyIdToken(t),
      verifyAppCheck: (t: string) => getAppCheck(app).verifyToken(t),
    };
  })().catch((e) => {
    console.error("[apiGuard] Firebase Admin init failed:", String(e?.message || e).slice(0, 200));
    adminVerifier = null;
    return null;
  });
  return adminVerifier;
}

// ---------- helpers ----------

function header(req: any, name: string): string {
  const v = req?.headers?.[name] ?? req?.headers?.[name.toLowerCase()];
  return Array.isArray(v) ? String(v[0] || "") : String(v || "");
}

export function clientIp(req: any): string {
  const xff = header(req, "x-forwarded-for").split(",")[0].trim();
  return xff || header(req, "x-real-ip") || req?.socket?.remoteAddress || "unknown";
}

function deny(res: any, status: number, error: string, extra: Record<string, string> = {}) {
  for (const [k, v] of Object.entries(extra)) res.setHeader(k, v);
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json({ ok: false, success: false, error });
}

// ---------- the wrapper ----------

export function withApiGuard(
  handler: Handler,
  opts: GuardOptions,
  deps: { verifier?: () => Promise<Verifier | null>; store?: RateStore } = {},
): Handler {
  return async (req: any, res: any) => {
    const requireAuth = flag("REQUIRE_API_AUTH");
    const requireAppCheck = flag("REQUIRE_APP_CHECK");
    const bearer = header(req, "authorization").match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || "";
    const appCheckToken = header(req, "x-firebase-appcheck").trim();

    const verifier = bearer || appCheckToken || requireAuth || requireAppCheck
      ? await (deps.verifier || getAdminVerifier)()
      : null;
    if ((requireAuth || requireAppCheck) && !verifier) {
      console.error(`[apiGuard] ${opts.route}: enforcement is on but Firebase Admin is not configured`);
      return deny(res, 503, "Server authentication is not configured");
    }

    // App Check
    if (requireAppCheck) {
      if (!appCheckToken) return deny(res, 401, "Missing App Check token");
      try {
        await verifier!.verifyAppCheck(appCheckToken);
      } catch {
        return deny(res, 401, "Invalid App Check token");
      }
    }

    // Firebase ID token
    let uid: string | null = null;
    if (bearer && verifier) {
      try {
        uid = (await verifier.verifyIdToken(bearer)).uid;
      } catch {
        if (requireAuth) return deny(res, 401, "Invalid or expired sign-in token", { "WWW-Authenticate": "Bearer" });
      }
    }
    if (requireAuth && !uid) return deny(res, 401, "Sign-in required", { "WWW-Authenticate": "Bearer" });

    // Rate limit (always on; fails open if the shared store is unreachable)
    const limit = opts.limit ?? (Number(process.env.RATE_LIMIT_PER_MIN) || 20);
    const windowSec = opts.windowSec ?? 60;
    const key = `${opts.route}:${uid ? `u:${uid}` : `ip:${clientIp(req)}`}`;
    try {
      const count = await (deps.store || getDefaultStore()).hit(key, windowSec);
      res.setHeader("X-RateLimit-Limit", String(limit));
      res.setHeader("X-RateLimit-Remaining", String(Math.max(0, limit - count)));
      if (count > limit) return deny(res, 429, "Too many requests, please wait a minute", { "Retry-After": String(windowSec) });
    } catch (e: any) {
      console.error(`[apiGuard] ${opts.route}: rate store error, allowing request:`, String(e?.message || e).slice(0, 120));
    }

    if (req && typeof req === "object") (req as any).authUid = uid;
    return handler(req, res);
  };
}
