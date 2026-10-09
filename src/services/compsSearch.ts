// Server side of "real auction comparables" (POST /api/comps): Gemini with Google Search proposes past results for a
// maker's piece; every one is opened and verified from the page itself (compsMath.verifyComparable) before it is
// returned. Nothing unverified is ever returned. Budget: Gemini <= 30 s, page checks <= 10 s, whole request <= 45 s.
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { verifyComparable, type CompClaim, type Comparable, type CompsResponse } from "./compsMath.js";
import { findMaker, PIECES, fold } from "./makers.js";
import { isGroundingRedirect } from "./huntValidation.js";

const MODEL = "gemini-3.5-flash";
/** The fast model does the scoped searches (every result is verified from its own page anyway); the slower model runs one broad search alongside. */
const FAST_MODEL = "gemini-3.1-flash-lite-preview";
export const COMPS_GEMINI_TIMEOUT_MS = 36_000;
const COMPS_SLOW_GRACE_MS = 4_000;
export const COMPS_VERIFY_BUDGET_MS = 9_000;
export const COMPS_TOTAL_BUDGET_MS = 46_000;
const FETCH_TIMEOUT_MS = 6_000;
const MAX_CANDIDATES = 15;
export const MAX_COMPS = 6;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9,fr;q=0.8',
};

export interface CompsRequest { maker: string; piece?: string; material?: string; pieces?: number; language?: string }

const withDeadline = async <T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> => {
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), Math.max(1, ms));
  try { return await run(c.signal); } finally { clearTimeout(timer); }
};

const resolveRedirect = async (url: string, ms: number): Promise<string> => {
  if (!isGroundingRedirect(url)) return url;
  try {
    return await withDeadline(Math.min(2_500, ms), async (signal) => {
      const res = await fetch(url, { method: 'GET', redirect: 'manual', headers: HEADERS, signal });
      const loc = res.headers.get('location');
      return loc ? new URL(loc, url).toString() : url;
    });
  } catch { return url; }
};

const fetchHtml = async (url: string, ms: number): Promise<{ status: number; html?: string; finalUrl: string }> => {
  try {
    return await withDeadline(Math.min(FETCH_TIMEOUT_MS, ms), async (signal) => {
      const res = await fetch(url, { method: 'GET', redirect: 'follow', headers: HEADERS, signal });
      if (!res.ok) return { status: res.status, finalUrl: res.url || url };
      return { status: res.status, html: (await res.text()).slice(0, 2_000_000), finalUrl: res.url || url };
    });
  } catch { return { status: 0, finalUrl: url }; }
};

const schema = {
  type: Type.OBJECT,
  properties: {
    results: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          url: { type: Type.STRING, description: "The lot page URL exactly as found (not a search page)." },
          house: { type: Type.STRING },
          sale_date: { type: Type.STRING, description: "YYYY-MM-DD" },
          title: { type: Type.STRING },
          pieces: { type: Type.NUMBER, description: "Number of chairs / pieces in the lot." },
          stamp_status: { type: Type.STRING, enum: ["stamped", "attributed", "by"] },
          price: { type: Type.NUMBER, description: "The sold price exactly as printed on the page." },
          currency: { type: Type.STRING },
          price_includes_fees: { type: Type.BOOLEAN },
        },
        required: ["url", "house", "title", "price", "currency"],
      },
    },
  },
  required: ["results"],
};

/** Three narrower searches run in parallel (one long search often exceeds the budget). */
export const COMPS_SEARCH_SCOPES = [
  "Christie's (christies.com and onlineonly.christies.com lot pages)",
  "Bonhams (bonhams.com) and Sotheby's (sothebys.com) lot pages",
  "French and European houses: Artcurial, Ader, Tajan, Millon, Aguttes, Drouot, Interenchères, Auctionet, Dorotheum, Koller",
];

export const buildCompsPrompt = (r: CompsRequest, scope = COMPS_SEARCH_SCOPES.join('; ')): string => {
  const piece = PIECES.find(p => p.key === r.piece);
  const what = piece ? `${piece.en} (${piece.fr})` : 'furniture';
  return `Find past auction RESULTS (sold lots, with the price realised / hammer price) for ${what} by the French maker ${r.maker}${r.material ? `, ideally in ${r.material}` : ''}.
Prefer sales from 2018 onwards; include stamped ("estampillé", "stamped") and attributed ("attribué à") lots and say which.
Search: ${scope}. Be quick: one or two searches are enough.
Return up to 6 results. Each must be ONE lot page URL that shows the sold price (not a search page, not a dealer's shop listing, not an unsold lot).
Give the price exactly as printed on the page, its currency, the sale date, the number of pieces in the lot, and whether the price includes the buyer's premium.
Never invent a result: only return pages you actually found.`;
};

export interface CompsDeps {
  /** Gemini + Google Search (injectable for tests): the JSON text and the grounding page URLs */
  search?: (prompt: string, signal: AbortSignal, model?: string) => Promise<{ text: string; grounded: string[] }>;
  fetchHtml?: (url: string, ms: number) => Promise<{ status: number; html?: string; finalUrl: string }>;
}

export const findComparables = async (req: CompsRequest, apiKey: string | undefined, now = Date.now(), deps: CompsDeps = {}): Promise<CompsResponse> => {
  const startedAt = now;
  const maker = findMaker(req.maker);
  const piece = PIECES.find(p => p.key === req.piece) || null;
  const out: CompsResponse = { ok: false, maker: maker?.name || req.maker, piece: piece?.key, comparables: [], searched: ["Christie's", "Bonhams", "Sotheby's", 'Artcurial', 'Auctionet', 'web search'], unreachable: ['Drouot (results need an account)'], stats: { candidates: 0, verified: 0, dropped: {} } };
  if (!maker) { out.error = 'unknown_maker'; return out; }
  if (!apiKey && !deps.search) { out.error = 'no_api_key'; return out; }
  const search = deps.search || (async (prompt: string, signal: AbortSignal, model = MODEL) => {
    const ai = new GoogleGenAI({ apiKey: apiKey! });
    const response: any = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { tools: [{ googleSearch: {} }], thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }, responseMimeType: 'application/json', responseSchema: schema, abortSignal: signal } as any,
    });
    const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    return { text: String(response?.text || '{}'), grounded: chunks.map((c: any) => c?.web?.uri).filter(Boolean) };
  });
  const getHtml = deps.fetchHtml || fetchHtml;
  const drop = (r: string) => { out.stats.dropped[r] = (out.stats.dropped[r] || 0) + 1; };

  // 1. Gemini + Google Search: candidate results (claimed), plus the pages it actually grounded on
  let claims: CompClaim[] = [];
  let grounded: string[] = [];
  const g0 = Date.now();
  const searchMs: number[] = [];
  const jobs: Array<[string, string]> = [...COMPS_SEARCH_SCOPES.map(sc => [sc, FAST_MODEL] as [string, string]), [COMPS_SEARCH_SCOPES.join('; '), MODEL]];
  // Once the fast scoped searches are back with enough candidates, the broad (slow) search gets only a short grace period.
  let cutSlow: () => void = () => {};
  const slowCut = new Promise<never>((_, rej) => { cutSlow = () => rej(Object.assign(new Error('cut'), { name: 'AbortError' })); });
  slowCut.catch(() => {});
  const run = (scope: string, model: string, i: number) => withDeadline(COMPS_GEMINI_TIMEOUT_MS, (signal) => Promise.race([
    search(buildCompsPrompt(req, scope), signal, model),
    new Promise<never>((_, rej) => signal.addEventListener('abort', () => rej(Object.assign(new Error('timeout'), { name: 'AbortError' })))),
    ...(model === MODEL && i === jobs.length - 1 ? [slowCut] : []),
  ])).finally(() => { searchMs[i] = Date.now() - g0; });
  const promises = jobs.map(([scope, model], i) => run(scope, model, i));
  Promise.allSettled(promises.slice(0, -1)).then(fast => {
    const n = fast.reduce((a, f) => a + (f.status === 'fulfilled' ? (f.value.grounded?.length || 0) + ((() => { try { return (JSON.parse(f.value.text || '{}').results || []).length; } catch { return 0; } })()) : 0), 0);
    if (n >= 4) setTimeout(cutSlow, COMPS_SLOW_GRACE_MS);
  });
  const settled = await Promise.allSettled(promises);
  const errors: string[] = [];
  for (const s of settled) {
    if (s.status === 'rejected') { const e: any = s.reason; errors.push(e?.name === 'AbortError' ? 'search_timeout' : String(e?.message || e).slice(0, 120)); continue; }
    try { claims.push(...(JSON.parse(s.value.text || '{}').results || []).filter((c: any) => c && c.url)); } catch { /* unparsable answer: grounding pages still checked */ }
    grounded.push(...(s.value.grounded || []));
  }
  if (errors.length === settled.length) out.error = errors[0];
  else if (errors.length) out.partial = errors;
  const geminiMs = Date.now() - g0;

  // 2. Verify every candidate from its own page (claimed URLs first, then grounding pages not already claimed)
  const deadline = Math.min(Date.now() + COMPS_VERIFY_BUDGET_MS, startedAt + COMPS_TOTAL_BUDGET_MS);
  const remaining = () => deadline - Date.now();
  const v0 = Date.now();
  const resolved = await Promise.all(grounded.slice(0, MAX_CANDIDATES * 2).map(u => resolveRedirect(u, remaining())));
  const norm = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/$/, '');
  const seen = new Set<string>();
  const cands: Array<{ url: string; claim: CompClaim | null }> = [];
  for (const c of claims) { const k = norm(c.url); if (!seen.has(k) && /^https?:\/\//.test(c.url)) { seen.add(k); cands.push({ url: c.url, claim: c }); } }
  for (const u of resolved) { const k = norm(u); if (!seen.has(k) && !isGroundingRedirect(u)) { seen.add(k); cands.push({ url: u, claim: claims.find(c => norm(c.url) === k) || null }); } }
  out.stats.candidates = cands.length;
  const pieceRe = piece && piece.key !== 'chair' ? piece.re : piece ? /\b(chairs?|chaises?|fauteuils?|armchairs?)\b/ : null;
  const results = await Promise.all(cands.slice(0, MAX_CANDIDATES).map(async ({ url, claim }) => {
    if (remaining() < 500) return { reason: 'no_time' };
    const page = await getHtml(url, remaining());
    if (!page.html) return { reason: page.status ? `http_${page.status}` : 'unreachable' };
    try { return verifyComparable(page.html, page.finalUrl || url, claim, maker.key, pieceRe); } catch { return { reason: 'parse_error' }; }
  }));
  const comps: Comparable[] = [];
  const lotSeen = new Set<string>();
  for (const r of results as Array<{ comp?: Comparable; reason?: string }>) {
    if (!r.comp) { drop(r.reason || 'unverified'); continue; }
    const k = `${r.comp.house}|${r.comp.title.slice(0, 40)}|${r.comp.price}`;
    if (lotSeen.has(k)) { drop('duplicate'); continue; }
    lotSeen.add(k); comps.push(r.comp);
  }
  // Same material first, then most recent
  comps.sort((a, b) => (Number(b.material === req.material) - Number(a.material === req.material)) || String(b.date || '').localeCompare(String(a.date || '')));
  out.comparables = comps.slice(0, MAX_COMPS);
  out.stats.verified = out.comparables.length;
  out.stats.timingMs = { gemini: geminiMs, searches: searchMs, verify: Date.now() - v0, total: Date.now() - startedAt };
  out.ok = true;
  return out;
};

export const handleCompsRequest = async (rawBody: unknown, apiKey = process.env.GEMINI_API_KEY): Promise<{ status: number; body: CompsResponse | { ok: false; error: string } }> => {
  let body: any = rawBody;
  if (typeof body === 'string') { try { body = JSON.parse(body || '{}'); } catch { return { status: 400, body: { ok: false, error: 'Invalid JSON body' } }; } }
  body = body || {};
  const makerText = String(body.maker || '').slice(0, 120);
  if (!makerText.trim()) return { status: 400, body: { ok: false, error: 'maker is required' } };
  const res = await findComparables({
    maker: makerText, piece: body.piece ? String(body.piece).slice(0, 30) : undefined,
    material: body.material ? String(body.material).slice(0, 30) : undefined,
    pieces: Number(body.pieces) || 1, language: String(body.language || 'en').slice(0, 5),
  }, apiKey);
  return { status: 200, body: res };
};

/** For tests: the same maker/piece decisions without the network. */
export const compsQueryFor = (text: string) => ({ maker: findMaker(text)?.key || null, text: fold(text) });
