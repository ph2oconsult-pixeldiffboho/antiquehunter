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
const APPRAISAL_MODEL = "gemini-3.1-flash-lite-preview";

/** Guard against oversized bodies (appraisals carry inline base64 images). */
const MAX_BODY_BYTES = 8 * 1024 * 1024;

export interface AppraiseHttpResult {
  status: number;
  body: { text?: string; error?: string; code?: string };
}

export const handleAppraiseRequest = async (rawBody: unknown): Promise<AppraiseHttpResult> => {
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set; /api/appraise cannot run.");
    return { status: 500, body: { error: "Server is not configured", code: "no_key" } };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: APPRAISAL_MODEL,
      contents,
      // responseMimeType/responseSchema/thinkingConfig/temperature/seed are built by the
      // caller and passed through unchanged, preserving the existing appraisal behaviour.
      config: config && typeof config === "object" ? config : undefined,
    });
    return { status: 200, body: { text: response.text ?? "" } };
  } catch (error: any) {
    console.error("Error running appraisal model:", error?.message || error);
    return { status: 502, body: { error: "Model request failed", code: "model_error" } };
  }
};
