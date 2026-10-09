// Server side of "real auction comparables" (POST /api/comps): Gemini with Google Search proposes past results for a
// maker's piece; every one is opened and verified from the page itself (compsMath.verifyComparable) before it is
// returned. Nothing unverified is ever returned. Budget: Gemini <= 30 s, page checks <= 10 s, whole request <= 45 s.
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { houseOf, verifyComparable, type CompClaim, type Comparable, type CompsResponse } from "./compsMath.js";
import { findMaker, PIECES, fold } from "./makers.js";
import { isGroundingRedirect } from "./huntValidation.js";

const MODEL = "gemini-3.5-flash";
/** Fast model for memory-based candidates (verified from their pages like everything else). */
const FAST_MODEL = "gemini-3.1-flash-lite-preview";
export const COMPS_GEMINI_TIMEOUT_MS = 20_000;
export const COMPS_VERIFY_BUDGET_MS = 10_000;
export const COMPS_TOTAL_BUDGET_MS = 32_000;
const FETCH_TIMEOUT_MS = 6_000;
const MAX_CANDIDATES = 15;
export const MAX_COMPS = 6;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9,fr;q=0.8',
  'Upgrade-Insecure-Requests': '1', 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Site': 'none', 'Sec-Fetch-User': '?1',
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


/** Narrower searches run in parallel (one long search often exceeds the budget). */
export const COMPS_SEARCH_SCOPES = [
  "Christie's lot pages (christies.com/en/lot/..., onlineonly.christies.com)",
  "Christie's and Sotheby's lot pages, searching in French (\"estampillé\", \"attribué à\", \"adjugé\")",
  "Christie's lot pages for pairs and sets (\"pair of\", \"set of four\", \"paire de\", \"suite de\")",
  "Bonhams (bonhams.com) lot pages",
  "Sotheby's (sothebys.com) lot pages",
  "French houses: Artcurial, Ader, Tajan, Millon, Aguttes, Drouot, Interenchères",
  "European houses: Auctionet, Dorotheum, Koller, Lempertz, Bukowskis, Bruun Rasmussen",
]

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

export const buildCompsPrompt = (r: CompsRequest, scope = COMPS_SEARCH_SCOPES.join('; ')): string => {
  const piece = PIECES.find(p => p.key === r.piece);
  const what = piece ? `${piece.en} (${piece.fr})` : 'furniture';
  const site = /Christie/.test(scope) ? 'site:christies.com ' : /Bonhams/.test(scope) ? 'site:bonhams.com ' : '';
  return `Find past auction RESULTS (sold lots, with the price realised / hammer price) for ${what} by the French maker ${r.maker}${r.material ? `, ideally in ${r.material}` : ''}.
Prefer sales from 2018 onwards; include stamped ("estampillé", "stamped") and attributed ("attribué à") lots and say which.
Where to look: ${scope}. Use Google searches such as: ${site}${r.maker} ${piece ? piece.fr.split(/[ ,/]/)[0] : ''} ; ${site}${r.maker} ${piece ? piece.en.split(/[ ,/]/)[0] : ''} sold. One or two searches are enough.
Copy each URL EXACTLY from the search results - never construct or guess a lot number. If you are not sure of a URL, leave the result out.
Return up to 6 results. Each must be ONE lot page URL that shows the sold price (not a search page, not a dealer's shop listing, not an unsold lot).
Give the price exactly as printed on the page, its currency, the sale date, the number of pieces in the lot, and whether the price includes the buyer's premium.
Never invent a result: only return pages you actually found.`;
};

/** JSON from a free-text answer (```json fences or surrounding prose tolerated). */
export const parseLooseJson = (text: string): any => {
  const t = String(text || '').replace(/```(?:json)?/gi, '');
  try { return JSON.parse(t); } catch { /* fall through */ }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* ignore */ } }
  return {};
};

export interface CompsDeps {
  /** Gemini + Google Search (injectable for tests): the JSON text and the grounding page URLs */
  search?: (prompt: string, signal: AbortSignal, model?: string) => Promise<{ text: string; grounded: string[]; queries?: number }>;
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
      // with or without a schema the preview runs reported 0 grounding chunks / web queries; the schema gives more candidates
      config: { tools: [{ googleSearch: {} }], thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }, responseMimeType: 'application/json', responseSchema: schema, abortSignal: signal } as any,
    });
    const gm = response?.candidates?.[0]?.groundingMetadata || {};
    const chunks = gm.groundingChunks || [];
    return { text: String(response?.text || '{}'), grounded: chunks.map((c: any) => c?.web?.uri).filter(Boolean), queries: (gm.webSearchQueries || []).length };
  });
  const getHtml = deps.fetchHtml || fetchHtml;
  const drop = (r: string) => { out.stats.dropped[r] = (out.stats.dropped[r] || 0) + 1; };

  // 1. Gemini + Google Search: candidate results (claimed), plus the pages it actually grounded on
  let claims: CompClaim[] = [];
  let grounded: string[] = [];
  const g0 = Date.now();
  const searchMs: number[] = [];
  // gemini-3.5-flash + search took 30 s+ (timed out) in every preview run, so only the fast model is used; it reported
  // 0 web searches, so its candidates are treated as leads only: each is kept only if its own page verifies it.
  const jobs: Array<[string, string]> = COMPS_SEARCH_SCOPES.map(sc => [sc, FAST_MODEL] as [string, string]);
  const run = (scope: string, model: string, i: number) => withDeadline(COMPS_GEMINI_TIMEOUT_MS, (signal) => Promise.race([
    search(buildCompsPrompt(req, scope), signal, model),
    new Promise<never>((_, rej) => signal.addEventListener('abort', () => rej(Object.assign(new Error('timeout'), { name: 'AbortError' })))),
  ])).finally(() => { searchMs[i] = Date.now() - g0; });
  const promises = jobs.map(([scope, model], i) => run(scope, model, i));
  const settled = await Promise.allSettled(promises);
  const errors: string[] = [];
  let webQueries = 0;
  const perJob: number[] = [];
  for (const s of settled) {
    perJob.push(s.status === 'fulfilled' ? (parseLooseJson(s.value.text).results || []).length : -1);
    if (s.status === 'rejected') { const e: any = s.reason; errors.push(e?.name === 'AbortError' ? 'search_timeout' : String(e?.message || e).slice(0, 120)); continue; }
    try { claims.push(...(parseLooseJson(s.value.text).results || []).filter((c: any) => c && c.url)); } catch { /* unparsable answer: grounding pages still checked */ }
    grounded.push(...(s.value.grounded || []));
    webQueries += Number(s.value.queries) || 0;
  }
  if (errors.length === settled.length) out.error = errors[0];
  else if (errors.length) out.partial = errors;
  const geminiMs = Date.now() - g0;

  // 2. Verify every candidate from its own page (claimed URLs first, then grounding pages not already claimed)
  const deadline = Math.min(Date.now() + COMPS_VERIFY_BUDGET_MS, startedAt + COMPS_TOTAL_BUDGET_MS);
  const remaining = () => deadline - Date.now();
  const v0 = Date.now();
  const isAsset = (u: string) => /\.(jpe?g|png|gif|webp|svg|pdf|css|js)(\?|#|$)/i.test(u) || /\/_next\/image|\/CatCache\/|\/image\?src=/i.test(u);
  // the model sometimes copies the grounding redirect itself: resolve those too
  const claimUrls = await Promise.all(claims.map(c => resolveRedirect(c.url, remaining())));
  claims = claims.map((c, i) => ({ ...c, url: claimUrls[i] })).filter(c => !isAsset(c.url) && !isGroundingRedirect(c.url));
  const resolved = (await Promise.all(grounded.slice(0, MAX_CANDIDATES * 2).map(u => resolveRedirect(u, remaining())))).filter(u => !isAsset(u));
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
  // houses whose pages refuse the server (bot protection) are reported, not silently skipped
  cands.slice(0, MAX_CANDIDATES).forEach((c, i) => {
    if ((results[i] as any).reason !== 'http_403') return;
    const h = houseOf(c.url).house;
    const label = h ? `${h} (pages blocked to our server)` : null;
    if (label && !out.unreachable.includes(label)) out.unreachable.push(label);
  });
  out.checked = cands.slice(0, MAX_CANDIDATES).map((c, i) => ({ url: c.url.slice(0, 200), result: (results[i] as any).comp ? 'verified' : String((results[i] as any).reason || 'unverified') }));
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
  out.stats.grounded = grounded.length; out.stats.webQueries = webQueries; out.stats.claimed = claims.length;
  out.stats.timingMs = { claimsPerSearch: perJob, gemini: geminiMs, searches: searchMs, verify: Date.now() - v0, total: Date.now() - startedAt };
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
