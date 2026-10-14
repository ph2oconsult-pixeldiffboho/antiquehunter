// Shared request handling for POST /api/appraise.
// The item appraisal used to call Gemini directly from the browser, which meant the
// GEMINI_API_KEY was inlined into the public client bundle (via Vite `define`). The model
// call now happens here, server-side, so the key never leaves the server.
//
// The browser builds the prompt + response schema (no secret) and POSTs { contents, config }.
// The model is pinned here so a caller cannot pick a different (more expensive) model.
//
// NOTE: like /api/hunt and /api/comps, this endpoint is currently unauthenticated. It should
// be put behind auth and/or rate limiting + Firebase App Check before/along with this change,
// otherwise it can be used as a proxy to spend Gemini quota.
import { GoogleGenAI } from "@google/genai";
import { redisEnv, upstashClient, resolveSharedRange, type RedisLike } from "./rangeStore.js";

/** The only model this endpoint will run. Client-supplied model values are ignored. */
export const APPRAISAL_MODEL = "gemini-3.1-flash-lite";
/**
 * Models tried, in order, once the primary is exhausted (429/5xx after retries) or gone (404).
 * The primary and this fallback are the stable Gemini 3 Flash-Lite ids from ai.google.dev/gemini-api/docs/models (checked 14 Oct 2026),
 * multimodal and supporting responseSchema + thinkingLevel. Still server-pinned; clients cannot pick.
 */
export const FALLBACK_MODELS = ["gemini-3.5-flash-lite"];
/** Upstream statuses after which the next model is tried (404 = model id retired). */
export const FALLBACK_STATUSES = [404, 429, 500, 503, 504];
/** Don't start a new model call after this much time. */
export const ATTEMPT_DEADLINE_MS = 40_000;
/** Per-call cap for every model except the last one in the chain, so a hung call fails over in time. */
export const CALL_TIMEOUT_MS = 18_000;
/** Whole-request budget for model calls, under Vercel's maxDuration 60 s (leaves ~5 s for cold start + response). */
export const TOTAL_BUDGET_MS = 55_000;
/** Pseudo upstream status used for a call we aborted on timeout (treated like a 504: fall over, no same-model retry). */
export const TIMEOUT_STATUS = 504;

/** Timeout for the next call: 18 s while another model can still follow, otherwise whatever budget remains. */
export const callTimeoutFor = (elapsedMs: number, isLastModel: boolean): number => {
  const remaining = Math.max(0, TOTAL_BUDGET_MS - elapsedMs);
  return isLastModel ? remaining : Math.min(CALL_TIMEOUT_MS, remaining);
};

/** Config for a given model: thinkingLevel is a Gemini 3 feature, so drop it for any non-Gemini-3 model. */
export const configFor = (model: string, config: any): any => {
  if (!config || typeof config !== "object") return undefined;
  if (/^gemini-3/.test(model) || !config.thinkingConfig) return config;
  const { thinkingConfig, ...rest } = config;
  return rest;
};

/** Guard against oversized bodies (appraisals carry inline base64 images). */
const MAX_BODY_BYTES = 8 * 1024 * 1024;

export interface AppraiseHttpResult {
  status: number;
  body: { text?: string; error?: string; code?: string; model?: string; range_store?: string; shared_range?: unknown };
}

/** Upstream statuses worth retrying (rate limit, transient server error, overloaded model). */
export const RETRYABLE_STATUSES = [429, 500, 503];
/** Backoff before retry 1 and retry 2. Worst case stays well inside the 60 s maxDuration. */
export const RETRY_DELAYS_MS = [1000, 3000];

/** HTTP status reported by the Gemini SDK error (ApiError.status), or parsed from its message. */
export const upstreamStatus = (error: any): number | null => {
  const s = Number(error?.status ?? error?.code);
  if (s >= 400 && s < 600) return s;
  const m = String(error?.message || "").match(/\b(400|401|403|404|429|500|502|503|504)\b/);
  return m ? Number(m[1]) : null;
};

/** What the client sees for a failed model call: the upstream status class plus a stable code. */
export const failureFor = (status: number | null): AppraiseHttpResult => {
  if (status === 429) return { status: 429, body: { error: "Model rate limit reached", code: "rate_limited" } };
  if (status === 500 || status === 503 || status === 504) return { status: 503, body: { error: "Model is busy", code: "model_busy" } };
  if (status === 400) return { status: 400, body: { error: "Model could not process the input", code: "bad_input" } };
  return { status: 502, body: { error: "Model request failed", code: "model_error" } };
};

type Generate = (args: { contents: unknown; config: unknown; model: string; signal?: AbortSignal }) => Promise<{ text?: string }>;
const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const handleAppraiseRequest = async (
  rawBody: unknown,
  deps: { generate?: Generate; sleep?: (ms: number) => Promise<void>; now?: () => number; redis?: RedisLike | null } = {},
): Promise<AppraiseHttpResult> => {
  let body: any = rawBody;
  if (typeof body === "string") {
    if (body.length > MAX_BODY_BYTES) {
      return { status: 413, body: { error: "Request too large", code: "too_large" } };
    }
    try {
      body = JSON.parse(body || "{}");
    } catch {
      return { status: 400, body: { error: "Invalid JSON body", code: "bad_request" } };
    }
  }
  body = body || {};

  const { contents, config } = body;
  if (!contents || typeof contents !== "object") {
    return { status: 400, body: { error: "contents is required", code: "bad_request" } };
  }

  let generate = deps.generate;
  if (!generate) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not set; /api/appraise cannot run.");
      return { status: 500, body: { error: "Server is not configured", code: "no_key" } };
    }
    const ai = new GoogleGenAI({ apiKey });
    generate = (args) => ai.models.generateContent({
      model: args.model,
      contents: args.contents as any,
      // responseMimeType/responseSchema/thinkingConfig/temperature/seed are built by the
      // caller and passed through unchanged, preserving the existing appraisal behaviour.
      config: { ...((args.config as any) || {}), ...(args.signal ? { abortSignal: args.signal } : {}) } as any,
    });
  }
  const sleep = deps.sleep || defaultSleep;
  const now = deps.now || Date.now;
  const started = now();
  const cfg = config && typeof config === "object" ? config : undefined;
  let lastStatus: number | null = null;

  const models = [APPRAISAL_MODEL, ...FALLBACK_MODELS];
  for (let m = 0; m < models.length; m++) {
    const model = models[m];
    // Primary gets the retry schedule; each fallback gets a single attempt
    const retries = m === 0 ? RETRY_DELAYS_MS.length : 0;
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (now() - started > ATTEMPT_DEADLINE_MS) {
        console.error(`Appraisal model time budget spent before trying ${model}; giving up (last upstream ${lastStatus ?? "unknown"}).`);
        return failureFor(lastStatus);
      }
      const timeoutMs = callTimeoutFor(now() - started, m === models.length - 1);
      const ctrl = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        // Race the call against the timer too, in case the SDK ignores the abort signal
        const response = await Promise.race([
          generate({ contents, config: configFor(model, cfg), model, signal: ctrl.signal }),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => { ctrl.abort(); reject(Object.assign(new Error(`timed out after ${timeoutMs} ms`), { status: TIMEOUT_STATUS, timedOut: true })); }, timeoutMs);
          }),
        ]);
        console.log(`Appraisal served by ${model}${m > 0 ? " (fallback)" : ""}, attempt ${attempt + 1}.`);
        const text = response.text ?? "";
        // Shared range store: the main model's range is canonical; a fallback answer only reads it (rangeStore.ts)
        let redis: RedisLike | null = null;
        if (deps.redis !== undefined) redis = deps.redis;
        else { const env = redisEnv(); redis = env ? upstashClient(env.url, env.token) : null; }
        const sr = body.piece_key ? await resolveSharedRange(redis, body.piece_key, text, model, m === 0) : { status: redis ? 'no_key' : 'off' };
        console.log(`Range store: ${sr.status}${redisEnv() ? ` (${redisEnv()!.names})` : ' (no KV_REST_API_* / UPSTASH_REDIS_REST_* env)'}.`);
        return { status: 200, body: { text, model, range_store: sr.status, ...((sr as any).range ? { shared_range: (sr as any).range } : {}) } };
      } catch (error: any) {
        const status = error?.timedOut ? TIMEOUT_STATUS : upstreamStatus(error);
        lastStatus = status;
        // A timed-out model is not retried (it would eat the budget); the next model is tried instead
        const retry = status !== null && status !== TIMEOUT_STATUS && RETRYABLE_STATUSES.includes(status) && attempt < retries;
        const next = !retry && status !== null && FALLBACK_STATUSES.includes(status) && m < models.length - 1;
        console.error(`Error running appraisal model ${model} (upstream ${status ?? "unknown"}, attempt ${attempt + 1}${retry ? ", retrying" : next ? ", trying fallback" : ""}):`, error?.message || error);
        if (retry) { await sleep(RETRY_DELAYS_MS[attempt]); continue; }
        if (next) break;
        return failureFor(status);
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
  }
  return failureFor(lastStatus);
};
