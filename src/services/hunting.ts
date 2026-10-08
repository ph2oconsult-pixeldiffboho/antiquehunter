import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import {
  allowedDomainsFor,
  auctionetFacts,
  auctionetSearchUrl,
  cleanText,
  failsPeriodRule,
  formatEstimate,
  formatSaleDate,
  hostMatches,
  hostOf,
  interencheresItemApiUrl,
  interencheresLotId,
  isAllowedHost,
  isGenericUrl,
  isGroundingRedirect,
  isSpecificListingUrl,
  modernYearInTitle,
  parseInterencheresItem,
  parsePage,
  platformLabelForUrl,
  type AuctionetItem,
  type PageFacts,
  type Verification,
} from "./huntValidation.js";
import {
  auctionetCurrencyRegion,
  checkGeography,
  domainRegions,
  itemTypesInQuery,
  localQueries,
  matchesItemType,
  platformsForRegions,
  regionsFor,
  type LocalQueries,
  type Region,
} from "./huntGeo.js";

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
  /** No longer set: the model's guessed estimate/date for unreadable pages is never shown (it was often wrong). */
  searchHint?: string;
  checkStatus?: number; // HTTP status seen when checking the page (0 = timeout/network error)
  /** Buyer's premium in % when the auction house publishes it (Interencheres) */
  buyerPremiumPct?: number;
  /** How the listing was found: web search (Gemini) or the Auctionet public API */
  source?: 'web_search' | 'auctionet_api';
}

export interface HuntResults {
  marketBrief: string;
  matches: HuntMatch[];
  dealerClosingTip: string;
  message?: string;
  /** Shown above the results, e.g. when web search timed out but Auctionet lots were found directly */
  notice?: string;
  /** What was actually searched (after applying the geography filter) */
  searched?: { regions: string[] | null; platforms: string[]; ignoredPlatforms: string[] };
  stats: {
    returned: number; verified: number; unverified: number; dropped: number; dropReasons: Record<string, number>;
    timingMs?: { gemini: number; validation: number; total: number; auctionet?: number };
    geminiError?: string;
  };
}

export const UNVERIFIED_PRICE = "Estimate: check listing";
export const NO_VERIFIED_MESSAGE = "No verified live listings found – try widening the budget or sources";

const MODEL = "gemini-3.5-flash";
// Time budget (Vercel maxDuration is 60 s; keep well under it incl. cold start):
// Gemini <= 38 s, link validation <= 10 s total, whole request <= 50 s. The Auctionet API search runs in
// parallel with Gemini (<= 8 s), so a Gemini timeout can still return real Auctionet lots.
export const GEMINI_TIMEOUT_MS = 38_000;
export const VALIDATION_BUDGET_MS = 10_000;
export const FUNCTION_BUDGET_MS = 50_000;
export const AUCTIONET_BUDGET_MS = 8_000;
const FETCH_TIMEOUT_MS = 5_000;
const REDIRECT_TIMEOUT_MS = 2_500;
const MAX_RESULTS = 4;
const MAX_AUCTIONET_DIRECT = 3;

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
};

export class HuntTimeoutError extends Error {
  constructor() {
    super("The live search took too long (over 38 seconds). Please try again or narrow the search.");
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

const fetchJson = async (url: string, budgetMs: number): Promise<{ status: number; json?: any }> => {
  try {
    return await withDeadline(Math.min(FETCH_TIMEOUT_MS, budgetMs), async (signal) => {
      const res = await fetch(url, { method: 'GET', headers: { ...BROWSER_HEADERS, Accept: 'application/json' }, signal });
      if (!res.ok) return { status: res.status };
      return { status: res.status, json: await res.json() };
    });
  } catch {
    return { status: 0 };
  }
};

// ---------------------------------------------------------------------------
// Search plan: which regions / platforms / sites, and the local-language search words
// ---------------------------------------------------------------------------

export interface HuntPlan {
  regions: Set<Region> | null;
  platforms: string[];
  ignoredPlatforms: string[];
  allowedDomains: string[];
  itemTypes: string[];
  local: LocalQueries;
  useAuctionet: boolean;
}

export const planHunt = (params: HuntParams): HuntPlan => {
  const regions = regionsFor(params.geographies || []);
  const { platforms, ignored } = platformsForRegions(params.platforms || [], regions);
  // Site list for the prompt and the filter: drop country-specific domains outside the selected regions
  // (e.g. ebay.fr when only the United Kingdom is selected)
  const allowedDomains = allowedDomainsFor(platforms).filter(d => {
    if (!regions) return true;
    const r = domainRegions('https://' + d + '/');
    return r === 'multi' || r === null || r.some(x => regions.has(x));
  });
  const useAuctionet = allowedDomains.includes('auctionet.com') && (!regions || regions.has('Sweden') || regions.has('Europe'));
  return { regions, platforms, ignoredPlatforms: ignored, allowedDomains, itemTypes: itemTypesInQuery(params.query), local: localQueries(params.query), useAuctionet };
};

const buildPrompts = (params: HuntParams, plan: HuntPlan) => {
  const allowedDomains = plan.allowedDomains;
  const { query, priceRange, currency = "EUR", language = "en", periodOnly = true } = params;
  const regionText = plan.regions ? Array.from(plan.regions).join(", ") : "anywhere";
  const platformText = plan.platforms.length > 0 ? plan.platforms.join(", ") : "Interencheres, Drouot, LeBonCoin, Christie's, Sotheby's, eBay";
  const today = new Date().toISOString().slice(0, 10);
  const sv = plan.local.sv.length ? plan.local.sv.map(q => `"${q}"`).join(", ") : '';
  const fr = plan.local.fr.length ? plan.local.fr.map(q => `"${q}"`).join(", ") : '';
  const en = plan.local.en.length ? plan.local.en.map(q => `"${q}"`).join(", ") : '';
  const swedish = !!plan.regions && (plan.regions.has('Sweden') || plan.regions.has('Europe'));
  const localHints = [
    fr && plan.allowedDomains.some(d => /interencheres|drouot|leboncoin|selency|ebay\.fr/.test(d)) ? `- French sites: search in French, e.g. ${fr}.` : '',
    sv && plan.allowedDomains.some(d => /auctionet|bukowskis/.test(d)) ? `- Swedish sites (auctionet.com, bukowskis.com): search in Swedish, e.g. ${sv}${swedish ? ` – run searches such as "site:auctionet.com ${plan.local.sv[0]}" and "site:bukowskis.com ${plan.local.sv[0]}"` : ''}. "1700-tal" = 18th century, "1800-tal" = 19th century.` : '',
    en && plan.allowedDomains.some(d => /saleroom|easylive|ebay\.co\.uk|bonhams|christies|sothebys/.test(d)) ? `- UK / international sites: search in English, e.g. ${en}.` : '',
  ].filter(Boolean).join("\n");

  const systemInstruction = `You are a premium antique finder and professional dealer.
Your goal is to search the live web for the user's requested antique and return REAL, currently buyable listings.

IMPORTANT RULES:
1. Today's date is ${today}. Use the googleSearch tool. Only return auction lots whose sale date is AFTER today, or classified ads that are still active. Never return past or closed sales.
2. GEOGRAPHY (STRICT): ${plan.regions ? `only return pieces that are physically located and sold in: ${regionText}. Never return a listing located in any other country, even if it matches well. Put the real city and country in "location".` : 'any country.'}
3. Only return listings hosted on these sites: ${allowedDomains.join(", ")} (platforms: ${platformText}). Never return any other website.
4. Every url MUST be the page of ONE specific lot or ad (e.g. interencheres.com/.../lot-123.html, drouot.com/l/123, leboncoin.fr/ad/..., ebay.../itm/..., the-saleroom.com/.../lot-<id>, auctionet.com/en/123-...). NEVER return search results pages, category pages, sale catalogue pages or keyword landing pages (leboncoin /ck/ or /recherche, ebay /b/ or /sch/).
5. Only return pieces of the type the user asked for${plan.itemTypes.length ? ` (${plan.itemTypes.join(", ")})` : ''}: never substitute another kind of furniture.
6. Copy the url exactly as it appears in the search grounding results. Never invent or guess a url, title, price or date. If you cannot find a real matching listing, return fewer matches (an empty list is acceptable).
7. Return at most ${MAX_RESULTS} matches.
${periodOnly ? `8. PERIOD PIECES ONLY: the user wants authentic period pieces (18th–19th century). Exclude anything described as "style", "de style", "XXe", "20e siècle", "20th century", reproduction, copy, "copie", "d'après", "stil", "1900-tal".` : ''}
9. All text content must be in the user's selected language: '${language}'.
10. Return structured JSON only.
${localHints ? `\nSEARCH TIPS:\n${localHints}` : ''}`;

  const promptText = `Find real, live or upcoming antique listings matching:
Query: ${query}
Location (strict): ${plan.regions ? regionText + ' only' : 'anywhere'}
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

const periodProblem = (title?: string, description?: string): string | null =>
  failsPeriodRule(title, description) || modernYearInTitle(title);

/** Apply facts read from the lot page / API to a result. Returns a drop reason when the facts rule it out. */
const applyFacts = (result: HuntMatch, facts: PageFacts, params: HuntParams, plan: HuntPlan): string | null => {
  if (facts.soldOrEnded) return 'sold_or_ended';
  if (facts.saleDate && facts.saleDate.getTime() < Date.now()) return 'past_sale';
  if (params.periodOnly !== false && periodProblem(facts.title, facts.description)) return 'not_period';
  if (facts.title || facts.description) {
    if (!matchesItemType(plan.itemTypes, facts.title, facts.description)) return 'not_requested_type';
  }
  if (facts.location) {
    const geo = checkGeography(result.url, [facts.location], plan.regions);
    if (!geo.ok) return geo.reason;
    result.location = facts.location;
  }
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
  else if (['interencheres.com', 'drouot.com'].some(d => hostMatches(hostOf(result.url), d))) result.price = 'No estimate published';
  else result.price = UNVERIFIED_PRICE;  // never keep the model's figure
  if (facts.image) result.imageUrl = facts.image;
  if (facts.buyerPremiumPct) result.buyerPremiumPct = facts.buyerPremiumPct;
  result.verification = 'verified';
  return null;
};

// Validate one AI result against the live web. Returns null (+reason) if it must be dropped.
/** Does a fetched page actually show this lot (not a bot-check, consent or search page)? */
export const pageShowsLot = (html: string, title: string | undefined, facts: PageFacts): boolean => {
  if (facts.estimateLow || facts.estimateHigh || facts.saleDate || facts.soldOrEnded) return true;
  const norm = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const text = norm(String(html).replace(/&[a-z]+;|&#\d+;/gi, " "));
  const words = Array.from(new Set(norm(String(title || '')).split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !/^\d+$/.test(w))));
  if (!words.length) return text.length > 2000;
  const found = words.filter(w => text.includes(w)).length;
  return found >= Math.min(2, words.length);
};

export const validateMatch = async (
  match: any,
  params: HuntParams,
  allowedDomainsOrPlan: string[] | HuntPlan,
  deadline: number
): Promise<{ match?: HuntMatch; dropReason?: string }> => {
  const plan: HuntPlan = Array.isArray(allowedDomainsOrPlan)
    ? { ...planHunt(params), allowedDomains: allowedDomainsOrPlan }
    : allowedDomainsOrPlan;
  const allowedDomains = plan.allowedDomains;
  const remaining = () => deadline - Date.now();
  const rawUrl = String(match?.url || '').trim();
  if (!/^https?:\/\//i.test(rawUrl)) return { dropReason: 'no_url' };

  const url = await resolveRedirect(rawUrl, remaining());
  if (isGroundingRedirect(url)) return { dropReason: 'unresolved_redirect' };
  if (isGenericUrl(url)) return { dropReason: 'generic_page' };
  if (!isAllowedHost(url, allowedDomains)) return { dropReason: 'platform_not_selected' };

  const title = cleanText(match.title);
  const description = cleanText(match.description);
  const modelLocation = cleanText(match.location);
  if (params.periodOnly !== false && periodProblem(title, description)) return { dropReason: 'not_period' };
  if (!matchesItemType(plan.itemTypes, title, description)) return { dropReason: 'not_requested_type' };
  // Geography: country-specific sites are checked on the URL alone; multi-country sites need a matching location
  const siteGeo = checkGeography(url, [modelLocation], plan.regions);
  if (!siteGeo.ok && siteGeo.reason !== 'geo_location_unknown') return { dropReason: siteGeo.reason };

  const result: HuntMatch = {
    title,
    url,
    platform: platformLabelForUrl(url) || cleanText(match.platform),
    price: UNVERIFIED_PRICE,
    location: modelLocation,
    date: undefined,
    description: description || undefined,
    dealerAnalysis: cleanText(match.dealerAnalysis),
    verification: 'unverified',
    source: 'web_search',
  };

  // Interencheres blocks server requests to its pages, but serves the lot's public JSON (estimate, date, city)
  const ieLot = interencheresLotId(url);
  if (ieLot && remaining() > 500) {
    const api = await fetchJson(interencheresItemApiUrl(ieLot), remaining());
    result.checkStatus = api.status;
    if (api.status === 404 || api.status === 410) return { dropReason: 'dead_link' };
    const facts = api.json ? parseInterencheresItem(api.json) : null;
    if (facts) {
      const drop = applyFacts(result, facts, params, plan);
      return drop ? { dropReason: drop } : { match: result };
    }
  }

  const page = remaining() > 500 ? await fetchPage(url, remaining()) : { status: 0, finalUrl: url, error: 'no_time' } as FetchOutcome;
  const finalUrl = page.finalUrl || url;
  if (result.checkStatus === undefined) result.checkStatus = page.status;
  if (page.status === 404 || page.status === 410) return { dropReason: 'dead_link' };
  if (finalUrl !== url && (isGenericUrl(finalUrl) || !isAllowedHost(finalUrl, allowedDomains))) return { dropReason: 'redirected_to_generic' };
  result.url = finalUrl;
  result.platform = platformLabelForUrl(finalUrl) || result.platform;

  let shownLot = false;
  if (page.status >= 200 && page.status < 300 && page.html) {
    if (!isSpecificListingUrl(finalUrl)) return { dropReason: 'not_a_listing' };
    const facts = parsePage(finalUrl, page.html);
    // A 200 can still be a bot-check / consent page: only trust it if it shows this lot
    shownLot = pageShowsLot(page.html, result.title, facts);
  }
  if (shownLot) {
    const facts = parsePage(finalUrl, page.html!);
    const drop = applyFacts(result, facts, params, plan);
    if (drop) return { dropReason: drop };
    // multi-country site whose page gave no location: the search result's location must match
    if (!facts.location && !siteGeo.ok) return { dropReason: siteGeo.reason };
    return { match: result };
  }

  // Page could not be read (bot protection, timeout...). Keep only specific listing URLs, flagged.
  if (!isSpecificListingUrl(finalUrl)) return { dropReason: page.status ? `unreadable_generic_${page.status}` : 'unreadable_generic' };
  // Multi-country site with no readable location: we cannot tell the country, so it is not shown
  if (!siteGeo.ok) return { dropReason: siteGeo.reason };
  // The model's price/date for an unread page is a guess from search snippets (often wrong, e.g. €80–120 shown
  // for a lot estimated €50–60): never show it, not even as a hint. The user opens the listing to check.
  result.price = UNVERIFIED_PRICE;
  result.date = undefined;
  result.verificationNote = page.status === 403 || page.status === 429 || page.status === 202 || (page.status >= 200 && page.status < 300)
    ? 'Site blocks automated checks: estimate, sale date and availability are not confirmed – open the listing to check.'
    : 'Page did not load in time: estimate, sale date and availability are not confirmed – open the listing to check.';
  return { match: result };
};

// ---------------------------------------------------------------------------
// Auctionet: search the public API directly (verified data, no web search needed)
// ---------------------------------------------------------------------------

// Approximate rates, ONLY used to compare an estimate with the user's budget (never shown).
const APPROX_EUR: Record<string, number> = { EUR: 1, SEK: 0.088, DKK: 0.134, NOK: 0.086, GBP: 1.17, USD: 0.92 };

/** Upper end of the typed budget ("2000 EUR", "500 – 2000 EUR"), in the user's currency. */
export const budgetMax = (priceRange?: string): number | null => {
  const nums = String(priceRange || '').replace(/(\d)[\s\u00a0.,](?=\d{3}\b)/g, '$1').match(/\d+(?:[.,]\d+)?/g);
  if (!nums) return null;
  const vals = nums.map(n => Number(n.replace(',', '.'))).filter(n => n > 0);
  return vals.length ? Math.max(...vals) : null;
};

export const withinBudget = (estimateLow: number | undefined, estCurrency: string | undefined, maxBudget: number | null, budgetCurrency = 'EUR'): boolean => {
  if (!maxBudget || !estimateLow) return true;
  const a = APPROX_EUR[String(estCurrency || '').toUpperCase()];
  const b = APPROX_EUR[String(budgetCurrency || '').toUpperCase()];
  if (!a || !b) return true;
  return estimateLow * a <= maxBudget * b * 1.1;
};

export const auctionetToMatch = (it: AuctionetItem, params: HuntParams, plan: HuntPlan, now = Date.now()): { match?: HuntMatch; dropReason?: string } => {
  const f = auctionetFacts(it, now);
  if (!it.url || !/^https:\/\/auctionet\.com\//.test(it.url)) return { dropReason: 'no_url' };
  if (!f.live) return { dropReason: 'sold_or_ended' };
  if (params.periodOnly !== false && periodProblem(f.title, f.description)) return { dropReason: 'not_period' };
  if (!matchesItemType(plan.itemTypes, f.title, f.description)) return { dropReason: 'not_requested_type' };
  const currencyRegion = auctionetCurrencyRegion(it.currency);
  const geo = checkGeography(it.url, [f.location, currencyRegion === 'Sweden' ? 'Sweden' : ''], plan.regions);
  if (!geo.ok) return { dropReason: geo.reason };
  if (!withinBudget(f.estimateLow, f.estimateCurrency, budgetMax(params.priceRange), params.currency)) return { dropReason: 'over_budget' };
  const est = formatEstimate(f.estimateLow, f.estimateHigh, f.estimateCurrency || 'SEK');
  return {
    match: {
      title: f.title || 'Auctionet lot',
      url: it.url,
      platform: 'Auctionet',
      price: est || 'No estimate published',
      location: [it.location, currencyRegion === 'Sweden' ? 'Sweden' : ''].filter(Boolean).join(', '),
      date: f.saleDate ? formatSaleDate(f.saleDate) : undefined,
      description: f.description || undefined,
      dealerAnalysis: `Found directly on Auctionet (${it.house || 'auction house'}). Estimate and closing time are from the auction house; ask for a condition report and photos of the back, drawers and any stamp before bidding.`,
      imageUrl: f.image,
      verification: 'verified',
      source: 'auctionet_api',
    },
  };
};

export const searchAuctionet = async (params: HuntParams, plan: HuntPlan, deadline: number): Promise<{ matches: HuntMatch[]; dropped: Record<string, number> }> => {
  const queries = Array.from(new Set([...plan.local.sv.slice(0, 2), params.query.trim()])).filter(Boolean).slice(0, 3);
  const seen = new Set<number>();
  const items: AuctionetItem[] = [];
  await Promise.all(queries.map(async q => {
    const r = await fetchJson(auctionetSearchUrl(q, 30), deadline - Date.now());
    for (const it of (r.json?.items || []) as AuctionetItem[]) {
      if (it && typeof it.id === 'number' && !seen.has(it.id)) { seen.add(it.id); items.push(it); }
    }
  }));
  const dropped: Record<string, number> = {};
  const matches: HuntMatch[] = [];
  for (const it of items) {
    const o = auctionetToMatch(it, params, plan);
    if (o.match) matches.push(o.match);
    else dropped[o.dropReason || 'other'] = (dropped[o.dropReason || 'other'] || 0) + 1;
  }
  // Soonest-closing first (these are live, timed online auctions)
  const endsAt = (m: HuntMatch) => items.find(i => i.url === m.url)?.ends_at || 0;
  matches.sort((a, b) => endsAt(a) - endsAt(b));
  return { matches: matches.slice(0, MAX_AUCTIONET_DIRECT), dropped };
};

export const huntAntiquesLive = async (params: HuntParams): Promise<HuntResults> => {
  const startedAt = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in the environment.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const plan = planHunt(params);
  const { systemInstruction, promptText } = buildPrompts(params, plan);

  // Auctionet API search runs alongside the web search
  let auctionetMs = 0;
  const auctionetP = plan.useAuctionet
    ? searchAuctionet(params, plan, startedAt + AUCTIONET_BUDGET_MS)
        .catch(() => ({ matches: [] as HuntMatch[], dropped: {} as Record<string, number> }))
        .finally(() => { auctionetMs = Date.now() - startedAt; })
    : Promise.resolve({ matches: [] as HuntMatch[], dropped: {} as Record<string, number> });

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new HuntTimeoutError());
    }, GEMINI_TIMEOUT_MS);
  });

  let parsed: any = null;
  let geminiError: Error | null = null;
  try {
    const response: any = await Promise.race([
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
    const text = response?.text;
    if (!text) throw new Error("The search engine returned an empty response.");
    try {
      parsed = JSON.parse(String(text).trim());
    } catch {
      throw new Error("The search engine returned an unreadable response.");
    }
  } catch (err: any) {
    geminiError = (err instanceof HuntTimeoutError || controller.signal.aborted) ? new HuntTimeoutError() : err;
  } finally {
    if (timer) clearTimeout(timer);
  }

  const geminiDone = Date.now();
  const auctionet = await auctionetP;
  if (geminiError && auctionet.matches.length === 0) throw geminiError;

  // Validation gets at most VALIDATION_BUDGET_MS, and never runs past the overall function budget
  const deadline = Math.min(geminiDone + VALIDATION_BUDGET_MS, startedAt + FUNCTION_BUDGET_MS);
  const rawMatches: any[] = parsed && Array.isArray(parsed.matches) ? parsed.matches.slice(0, MAX_RESULTS + 2) : [];
  const outcomes = await Promise.all(rawMatches.map(m => validateMatch(m, params, plan, deadline)));

  const seen = new Set<string>();
  const matches: HuntMatch[] = [];
  const dropReasons: Record<string, number> = {};
  const key = (u: string) => u.match(/auctionet\.com\/[a-z]{2}\/(\d+)-/)?.[1] ? `auctionet:${u.match(/auctionet\.com\/[a-z]{2}\/(\d+)-/)![1]}` : u.replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '');
  for (const o of outcomes) {
    if (o.match && !seen.has(key(o.match.url))) {
      seen.add(key(o.match.url));
      matches.push(o.match);
    } else {
      const reason = o.dropReason || 'duplicate';
      dropReasons[reason] = (dropReasons[reason] || 0) + 1;
    }
  }
  // Add Auctionet API lots not already found by the web search
  for (const m of auctionet.matches) {
    if (!seen.has(key(m.url))) { seen.add(key(m.url)); matches.push(m); }
  }
  // Verified listings first; keep at most MAX_AUCTIONET_DIRECT Auctionet API lots so web results still show
  matches.sort((a, b) => (a.verification === b.verification ? 0 : a.verification === 'verified' ? -1 : 1));
  const finalMatches = matches.slice(0, MAX_RESULTS + (auctionet.matches.length ? 1 : 0));

  const results: HuntResults = {
    marketBrief: cleanText(parsed?.marketBrief),
    matches: finalMatches,
    dealerClosingTip: cleanText(parsed?.dealerClosingTip),
    searched: { regions: plan.regions ? Array.from(plan.regions) : null, platforms: plan.platforms, ignoredPlatforms: plan.ignoredPlatforms },
    stats: {
      returned: rawMatches.length + auctionet.matches.length,
      verified: finalMatches.filter(m => m.verification === 'verified').length,
      unverified: finalMatches.filter(m => m.verification === 'unverified').length,
      dropped: rawMatches.length + auctionet.matches.length - finalMatches.length,
      dropReasons,
      timingMs: { gemini: geminiDone - startedAt, validation: Date.now() - geminiDone, total: Date.now() - startedAt, auctionet: auctionetMs },
      ...(geminiError ? { geminiError: geminiError.name === 'HuntTimeoutError' ? 'timeout' : String(geminiError.message).slice(0, 120) } : {}),
    },
  };
  if (geminiError) results.notice = 'The web search took too long, so only lots found directly on Auctionet are shown.';
  if (finalMatches.length === 0) results.message = NO_VERIFIED_MESSAGE;
  return results;
};
