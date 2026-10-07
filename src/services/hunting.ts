import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import {
  allowedDomainsFor,
  cleanText,
  failsPeriodRule,
  formatEstimate,
  formatSaleDate,
  hostMatches,
  hostOf,
  isAllowedHost,
  isGenericUrl,
  isGroundingRedirect,
  isSpecificListingUrl,
  parsePage,
  platformLabelForUrl,
  type Verification,
} from "./huntValidation.js";

export interface HuntParams {
  query: string;
  geographies: string[];
  platforms: string[];
  priceRange?: string;
  currency?: string;
  language?: string;
  periodOnly?: boolean;
}

export interface HuntMatch {
  title: string;
  url: string;
  platform: string;
  price: string;
  location: string;
  date?: string;
  description?: string;
  dealerAnalysis: string;
  imageUrl?: string;
  verification: Verification;
  verificationNote?: string;
  checkStatus?: number; // HTTP status seen when checking the page (0 = timeout/network error)
  checkedVia?: 'direct' | 'google';
}

export interface HuntResults {
  marketBrief: string;
  matches: HuntMatch[];
  dealerClosingTip: string;
  message?: string;
  stats: { returned: number; verified: number; unverified: number; dropped: number; dropReasons: Record<string, number>; secondCheck?: string };
}

export const NO_VERIFIED_MESSAGE = "No verified live listings found – try widening the budget or sources";

const MODEL = "gemini-3.5-flash";
const GEMINI_TIMEOUT_MS = 45_000;
const FUNCTION_BUDGET_MS = 56_000; // Vercel maxDuration is 60s
const FETCH_TIMEOUT_MS = 5_000;
const REDIRECT_TIMEOUT_MS = 3_000;
const MAX_RESULTS = 4;

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
};

export class HuntTimeoutError extends Error {
  constructor() {
    super("The live search took too long (over 45 seconds). Please try again or narrow the search.");
    this.name = "HuntTimeoutError";
  }
}

const withDeadline = async <T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, ms));
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
};

const resolveRedirect = async (url: string, budgetMs: number): Promise<string> => {
  if (!isGroundingRedirect(url)) return url;
  try {
    return await withDeadline(Math.min(REDIRECT_TIMEOUT_MS, budgetMs), async (signal) => {
      const res = await fetch(url, { method: 'GET', redirect: 'manual', headers: BROWSER_HEADERS, signal });
      const loc = res.headers.get('location');
      return loc ? new URL(loc, url).toString() : url;
    });
  } catch {
    return url;
  }
};

interface FetchOutcome { status: number; finalUrl: string; html?: string; error?: string }

const fetchPage = async (url: string, budgetMs: number): Promise<FetchOutcome> => {
  try {
    return await withDeadline(Math.min(FETCH_TIMEOUT_MS, budgetMs), async (signal) => {
      const res = await fetch(url, { method: 'GET', redirect: 'follow', headers: BROWSER_HEADERS, signal });
      const finalUrl = res.url || url;
      if (!res.ok) return { status: res.status, finalUrl };
      const html = (await res.text()).slice(0, 1_500_000);
      return { status: res.status, finalUrl, html };
    });
  } catch (err: any) {
    return { status: 0, finalUrl: url, error: err?.name === 'AbortError' ? 'timeout' : String(err?.message || err) };
  }
};

const buildPrompts = (params: HuntParams, allowedDomains: string[]) => {
  const { query, geographies, platforms, priceRange, currency = "EUR", language = "en", periodOnly = true } = params;
  const geographyText = geographies.length > 0 ? geographies.join(", ") : "Europe";
  const platformText = platforms.length > 0 ? platforms.join(", ") : "Interencheres, Drouot, LeBonCoin, Christie's, Sotheby's, eBay";
  const today = new Date().toISOString().slice(0, 10);

  const systemInstruction = `You are a premium antique finder and professional dealer.
Your goal is to search the live web for the user's requested antique and return REAL, currently buyable listings.

IMPORTANT RULES:
1. Today's date is ${today}. Use the googleSearch tool. Only return auction lots whose sale date is AFTER today, or classified ads that are still active. Never return past or closed sales.
2. Only return listings hosted on these sites: ${allowedDomains.join(", ")} (platforms: ${platformText}). Never return any other website.
3. Every url MUST be the page of ONE specific lot or ad (e.g. interencheres.com/.../lot-123.html, drouot.com/l/123, leboncoin.fr/ad/..., ebay.../itm/...). NEVER return search results pages, category pages, sale catalogue pages or keyword landing pages (leboncoin /ck/ or /recherche, ebay /b/ or /sch/).
4. Copy the url exactly as it appears in the search grounding results. Never invent or guess a url, title, price or date. If you cannot find a real matching listing, return fewer matches (an empty list is acceptable).
5. Return at most ${MAX_RESULTS} matches.
${periodOnly ? `6. PERIOD PIECES ONLY: the user wants authentic period pieces. Exclude anything described as "style", "de style", "XXe", "20e siècle", "20th century", reproduction, copy, "copie" or "d'après".` : ''}
7. All text content must be in the user's selected language: '${language}'.
8. Return structured JSON only.`;

  const promptText = `Find real, live or upcoming antique listings matching:
Query: ${query}
Geographies: ${geographyText}
Platforms: ${platformText}
Budget: ${priceRange || "No budget given"}
Currency: ${currency}
${periodOnly ? 'Period pieces only: yes' : 'Period pieces only: no'}

Return at most ${MAX_RESULTS} specific listings in the structure below.`;

  return { systemInstruction, promptText };
};

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    marketBrief: { type: Type.STRING, description: "A 2-3 sentence dealer brief on availability, typical rates and sourcing difficulty for this piece in these areas." },
    matches: {
      type: Type.ARRAY,
      description: `At most ${MAX_RESULTS} real listings found during live web search.`,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Title of the listing as shown on the page." },
          url: { type: Type.STRING, description: "Exact url of ONE specific lot or ad page, copied from the grounding results." },
          platform: { type: Type.STRING, description: "Platform name (e.g. 'Interencheres', 'Drouot', 'LeBonCoin', 'eBay', 'Auctionet')." },
          price: { type: Type.STRING, description: "Price or estimate exactly as listed, with currency symbol." },
          location: { type: Type.STRING },
          date: { type: Type.STRING, description: "Auction sale date or 'Active classified'." },
          description: { type: Type.STRING, description: "Brief summary of condition, era and design as listed." },
          dealerAnalysis: { type: Type.STRING, description: "Sharp field-note evaluation: price reasonability, authenticity checks needed, buy or walk away." }
        },
        required: ["title", "url", "platform", "price", "location", "dealerAnalysis"]
      }
    },
    dealerClosingTip: { type: Type.STRING, description: "One sourcing insider tip for negotiating or auditing this type of antique." }
  },
  required: ["marketBrief", "matches", "dealerClosingTip"]
};

// Validate one AI result against the live web. Returns null (+reason) if it must be dropped.
export const validateMatch = async (
  match: any,
  params: HuntParams,
  allowedDomains: string[],
  deadline: number
): Promise<{ match?: HuntMatch; dropReason?: string }> => {
  const remaining = () => deadline - Date.now();
  const rawUrl = String(match?.url || '').trim();
  if (!/^https?:\/\//i.test(rawUrl)) return { dropReason: 'no_url' };

  const url = await resolveRedirect(rawUrl, remaining());
  if (isGroundingRedirect(url)) return { dropReason: 'unresolved_redirect' };
  if (isGenericUrl(url)) return { dropReason: 'generic_page' };
  if (!isAllowedHost(url, allowedDomains)) return { dropReason: 'platform_not_selected' };

  const title = cleanText(match.title);
  const description = cleanText(match.description);
  if (params.periodOnly !== false && failsPeriodRule(title, description)) return { dropReason: 'not_period' };

  const page = remaining() > 500 ? await fetchPage(url, remaining()) : { status: 0, finalUrl: url, error: 'no_time' } as FetchOutcome;
  const finalUrl = page.finalUrl || url;
  if (page.status === 404 || page.status === 410) return { dropReason: 'dead_link' };
  if (finalUrl !== url && (isGenericUrl(finalUrl) || !isAllowedHost(finalUrl, allowedDomains))) return { dropReason: 'redirected_to_generic' };

  const result: HuntMatch = {
    title,
    url: finalUrl,
    platform: platformLabelForUrl(finalUrl) || cleanText(match.platform),
    price: cleanText(match.price),
    location: cleanText(match.location),
    date: cleanText(match.date) || undefined,
    description: description || undefined,
    dealerAnalysis: cleanText(match.dealerAnalysis),
    verification: 'unverified',
    checkStatus: page.status,
  };

  if (page.status >= 200 && page.status < 300 && page.html) {
    if (!isSpecificListingUrl(finalUrl)) return { dropReason: 'not_a_listing' };
    const facts = parsePage(finalUrl, page.html);
    if (facts.soldOrEnded) return { dropReason: 'sold_or_ended' };
    if (facts.saleDate && facts.saleDate.getTime() < Date.now()) return { dropReason: 'past_sale' };
    if (params.periodOnly !== false && failsPeriodRule(facts.title, facts.description)) return { dropReason: 'not_period' };
    if (facts.title) {
      // Catalogue titles are often cut ("…"): fall back to the start of the real catalogue description
      result.title = facts.title.endsWith('…') && facts.description
        ? facts.description.slice(0, 120).replace(/\s+\S*$/, '') + '…'
        : facts.title;
    }
    if (facts.description) result.description = facts.description;
    if (facts.saleDate) result.date = formatSaleDate(facts.saleDate);
    const est = formatEstimate(facts.estimateLow, facts.estimateHigh, facts.estimateCurrency || 'EUR');
    if (est) result.price = est;
    else if (['interencheres.com', 'drouot.com'].some(d => hostMatches(hostOf(finalUrl), d))) result.price = 'No estimate published';
    if (facts.image) result.imageUrl = facts.image;
    result.verification = 'verified';
    result.checkedVia = 'direct';
    return { match: result };
  }

  // Page could not be read (bot protection, timeout...). Keep only specific listing URLs, flagged.
  if (!isSpecificListingUrl(finalUrl)) return { dropReason: page.status ? `unreadable_generic_${page.status}` : 'unreadable_generic' };
  result.verificationNote = page.status === 403 || page.status === 429
    ? 'Site blocks automated checks – open the link to confirm it is still live.'
    : 'Could not load the page in time – open the link to confirm it is still live.';
  return { match: result };
};

const URL_CHECK_MIN_MS = 12_000;
const URL_CHECK_MAX_MS = 20_000;

const urlCheckSchema = {
  type: Type.OBJECT,
  properties: {
    pages: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          url: { type: Type.STRING },
          loaded: { type: Type.BOOLEAN, description: "true only if you could read this exact page and it shows one specific lot or ad" },
          title: { type: Type.STRING, description: "Lot / ad title exactly as on the page" },
          sale_date_iso: { type: Type.STRING, description: "Sale or closing date-time as ISO 8601 with offset, copied from the page; empty if none" },
          estimate_low: { type: Type.NUMBER, description: "Low estimate or asking price as printed, 0 if none" },
          estimate_high: { type: Type.NUMBER, description: "High estimate as printed, 0 if none" },
          currency: { type: Type.STRING },
          sold_or_closed: { type: Type.BOOLEAN, description: "true if the page says sold, adjugé, closed, ended, withdrawn or the sale date has passed" }
        },
        required: ["url", "loaded", "sold_or_closed"]
      }
    }
  },
  required: ["pages"]
};

const normUrl = (u: string) => String(u || '').trim().replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();

/**
 * Some sites (e.g. Interencheres, Bukowskis, eBay) block requests from cloud servers.
 * For those listings we ask Gemini's URL-context tool (fetched by Google) to read the page.
 * Only facts read from the page are used; if Google cannot read it either, the listing stays 'unverified'.
 */
const confirmViaUrlContext = async (
  ai: GoogleGenAI,
  candidates: HuntMatch[],
  params: HuntParams,
  deadline: number,
  dropReasons: Record<string, number>,
  report: (note: string) => void
): Promise<HuntMatch[]> => {
  const remaining = deadline - Date.now();
  if (candidates.length === 0) return candidates;
  if (remaining < URL_CHECK_MIN_MS) { report(`skipped: only ${Math.round(remaining / 1000)}s left`); return candidates; }
  const budget = Math.min(URL_CHECK_MAX_MS, remaining - 2_000);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('url_check_timeout')); }, budget);
    });
    const today = new Date().toISOString();
    const response: any = await Promise.race([
      ai.models.generateContent({
        model: MODEL,
        contents: `Now is ${today}. Read each of these pages with the URL context tool and report only what the page itself says. Never guess: if you cannot read a page, set loaded=false.\n${candidates.map(c => c.url).join('\n')}`,
        config: {
          tools: [{ urlContext: {} }],
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: urlCheckSchema,
          abortSignal: controller.signal,
        }
      }),
      timeout,
    ]);
    const parsed = JSON.parse(String(response?.text || '{}'));
    const retrieval: Record<string, string> = {};
    for (const m of response?.candidates?.[0]?.urlContextMetadata?.urlMetadata || []) {
      if (m?.retrievedUrl) retrieval[normUrl(m.retrievedUrl)] = String(m.urlRetrievalStatus || '');
    }
    const byUrl = new Map<string, any>();
    for (const p of parsed?.pages || []) byUrl.set(normUrl(p.url), p);

    report(`google read: ${candidates.map(c => `${retrieval[normUrl(c.url)] || 'no_status'}/${byUrl.get(normUrl(c.url))?.loaded ?? 'n/a'}`).join(', ')}`);
    const out: HuntMatch[] = [];
    for (const c of candidates) {
      const page = byUrl.get(normUrl(c.url));
      const status = retrieval[normUrl(c.url)];
      const googleRead = status === 'URL_RETRIEVAL_STATUS_SUCCESS' && page?.loaded === true;
      if (!googleRead) { out.push(c); continue; }
      const saleDate = page.sale_date_iso ? new Date(page.sale_date_iso) : undefined;
      const title = cleanText(page.title);
      if (page.sold_or_closed) { dropReasons.sold_or_ended = (dropReasons.sold_or_ended || 0) + 1; continue; }
      if (saleDate && !isNaN(saleDate.getTime()) && saleDate.getTime() < Date.now()) { dropReasons.past_sale = (dropReasons.past_sale || 0) + 1; continue; }
      if (params.periodOnly !== false && failsPeriodRule(title)) { dropReasons.not_period = (dropReasons.not_period || 0) + 1; continue; }
      const confirmed: HuntMatch = { ...c, verification: 'verified', checkedVia: 'google', verificationNote: undefined };
      if (title) confirmed.title = title;
      if (saleDate && !isNaN(saleDate.getTime())) confirmed.date = formatSaleDate(saleDate);
      const est = formatEstimate(Number(page.estimate_low) || undefined, Number(page.estimate_high) || undefined, /^[A-Z]{3}$/.test(page.currency || '') ? page.currency : 'EUR');
      if (est) confirmed.price = est;
      out.push(confirmed);
    }
    return out;
  } catch (err: any) {
    console.warn('URL-context check skipped:', err?.message || err);
    report(`error: ${String(err?.message || err).slice(0, 160)}`);
    return candidates;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export const huntAntiquesLive = async (params: HuntParams): Promise<HuntResults> => {
  const startedAt = Date.now();
  const deadline = startedAt + FUNCTION_BUDGET_MS;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in the environment.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const allowedDomains = allowedDomainsFor(params.platforms || []);
  const { systemInstruction, promptText } = buildPrompts(params, allowedDomains);

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new HuntTimeoutError());
    }, GEMINI_TIMEOUT_MS);
  });

  let response: any;
  try {
    response = await Promise.race([
      ai.models.generateContent({
        model: MODEL,
        contents: promptText,
        config: {
          systemInstruction,
          tools: [{ googleSearch: {} }],
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema,
          abortSignal: controller.signal,
        }
      }),
      timeout,
    ]);
  } catch (err: any) {
    if (err instanceof HuntTimeoutError || controller.signal.aborted) throw new HuntTimeoutError();
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }

  const text = response?.text;
  if (!text) throw new Error("The search engine returned an empty response.");
  let parsed: any;
  try {
    parsed = JSON.parse(String(text).trim());
  } catch {
    throw new Error("The search engine returned an unreadable response.");
  }

  const rawMatches: any[] = Array.isArray(parsed.matches) ? parsed.matches.slice(0, MAX_RESULTS + 2) : [];
  const outcomes = await Promise.all(rawMatches.map(m => validateMatch(m, params, allowedDomains, deadline)));

  const seen = new Set<string>();
  const matches: HuntMatch[] = [];
  const dropReasons: Record<string, number> = {};
  for (const o of outcomes) {
    if (o.match && !seen.has(o.match.url)) {
      seen.add(o.match.url);
      matches.push(o.match);
    } else {
      const reason = o.dropReason || 'duplicate';
      dropReasons[reason] = (dropReasons[reason] || 0) + 1;
    }
  }
  // Second opinion for pages our server could not read (bot protection / timeouts)
  const unreadable = matches.filter(m => m.verification === 'unverified');
  let secondCheck: string | undefined;
  if (unreadable.length > 0) {
    const confirmed = await confirmViaUrlContext(ai, unreadable, params, deadline, dropReasons, (note) => { secondCheck = note; });
    const keep = new Set(confirmed.map(m => m.url));
    const replaced = new Map(confirmed.map(m => [m.url, m]));
    for (let i = matches.length - 1; i >= 0; i--) {
      if (matches[i].verification !== 'unverified') continue;
      if (!keep.has(matches[i].url)) matches.splice(i, 1);
      else matches[i] = replaced.get(matches[i].url)!;
    }
  }

  // Verified listings first
  matches.sort((a, b) => (a.verification === b.verification ? 0 : a.verification === 'verified' ? -1 : 1));
  const finalMatches = matches.slice(0, MAX_RESULTS);

  const results: HuntResults = {
    marketBrief: cleanText(parsed.marketBrief),
    matches: finalMatches,
    dealerClosingTip: cleanText(parsed.dealerClosingTip),
    stats: {
      returned: rawMatches.length,
      verified: finalMatches.filter(m => m.verification === 'verified').length,
      unverified: finalMatches.filter(m => m.verification === 'unverified').length,
      dropped: rawMatches.length - finalMatches.length,
      dropReasons,
      secondCheck,
    },
  };
  if (finalMatches.length === 0) results.message = NO_VERIFIED_MESSAGE;
  return results;
};
