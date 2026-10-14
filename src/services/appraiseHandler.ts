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

/** The only model this endpoint will run. Client-supplied model values are ignored. */
export const APPRAISAL_MODEL = "gemini-3.1-flash-lite";
/**
 * Models tried, in order, once the primary is exhausted (429/5xx after retries) or gone (404).
 * The primary and this fallback are the stable Gemini 3 Flash-Lite ids from ai.google.dev/gemini-api/docs/models (checked 14 Oct 2026),
 * multimodal and supporting responseSchema + thinkingLevel. Still server-pinned; clients cannot pick.
 */
export const FALLBACK_MODELS = ["gemini-3.5-flash-lite"];
/** Upstream statuses after which the next model is tried (404 = model id retired). */
export const FALLBACK_STATUSES = [404, 429, 500, 503];
/** Don't start a new model call after this much time; leaves room for one call inside maxDuration 60 s. */
export const ATTEMPT_DEADLINE_MS = 40_000;

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
  body: { text?: string; error?: string; code?: string; model?: string };
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

type Generate = (args: { contents: unknown; config: unknown; model: string }) => Promise<{ text?: string }>;
const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const handleAppraiseRequest = async (
  rawBody: unknown,
  deps: { generate?: Generate; sleep?: (ms: number) => Promise<void>; now?: () => number } = {},
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
      config: args.config as any,
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
      try {
        const response = await generate({ contents, config: configFor(model, cfg), model });
        console.log(`Appraisal served by ${model}${m > 0 ? " (fallback)" : ""}, attempt ${attempt + 1}.`);
        return { status: 200, body: { text: response.text ?? "", model } };
      } catch (error: any) {
        const status = upstreamStatus(error);
        lastStatus = status;
        const retry = status !== null && RETRYABLE_STATUSES.includes(status) && attempt < retries;
        const next = !retry && status !== null && FALLBACK_STATUSES.includes(status) && m < models.length - 1;
        console.error(`Error running appraisal model ${model} (upstream ${status ?? "unknown"}, attempt ${attempt + 1}${retry ? ", retrying" : next ? ", trying fallback" : ""}):`, error?.message || error);
        if (retry) { await sleep(RETRY_DELAYS_MS[attempt]); continue; }
        if (next) break;
        return failureFor(status);
      }
    }
  }
  return failureFor(lastStatus);
};
