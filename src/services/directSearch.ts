// Direct search of French auction sites (Drouot, Interencheres): real, current lots read from the sites' own
// search pages, filtered on the server (type, period, geography, all-in budget, live only), enriched from lot
// pages when needed, and converted to the app's HuntMatch shape. Gemini only ranks and explains these lots.
//
// Volume: ONE search page per site per hunt (a second one only if the first finds nothing at all), then lot pages /
// lot JSON for at most a handful of top candidates. Everything is cached in memory for a few minutes/hours.
import { fetchSource, relayConfig, type SourceResponse } from "./sources/fetchSource.js";
import { drouotSearchUrl, parseDrouotLotPage, parseDrouotSearch, DROUOT_COUNTRIES, DROUOT_FRANCE_COUNTRY_ID } from "./sources/drouot.js";
import { interencheresSearchUrl, parseInterencheresSearch } from "./sources/interencheres.js";
import type { DirectLot, DirectSite } from "./sources/directTypes.js";
import { failsPeriodRule, formatEstimate, formatSaleDate, interencheresItemApiUrl, modernYearInTitle, parseInterencheresItem } from "./huntValidation.js";
import { materialsInQuery, matchesItemType, matchesStyle, normalise, regionsInLocation, type Region } from "./huntGeo.js";
import { frenchSiteQueries, frenchSiteQuery, impliedStyleMatch, partlyPeriodProblem, pieceProblem, requestedStyleOnlyProblem } from "./pieceWords.js";
import { allIn, budgetMax, budgetMin, convertApprox, DEFAULT_PREMIUM_PCT } from "./budget.js";

export const DIRECT_SEARCH_BUDGET_MS = 6_000;   // search pages
export const DIRECT_ENRICH_BUDGET_MS = 4_000;   // lot pages / lot JSON
const SEARCH_TTL_MS = 15 * 60_000;
const LOT_TTL_MS = 6 * 60 * 60_000;
const MAX_ENRICH = 24;
export const MAX_DIRECT_RESULTS = 15;
const LIVE_SALE_GRACE_MS = 6 * 3600_000; // a live sale that started a few hours ago may not have reached the lot yet

export const SITE_DOMAIN: Record<DirectSite, string> = { drouot: 'drouot.com', interencheres: 'interencheres.com' };
export const SITE_LABEL: Record<DirectSite, string> = { drouot: 'Drouot', interencheres: 'Interencheres' };

export interface DirectParams { query: string; priceRange?: string; currency?: string; periodOnly?: boolean }
export interface DirectPlan { regions: Set<Region> | null; itemTypes: string[]; allowedDomains: string[] }

export interface DirectSourceStat {
  site: DirectSite; query: string; status: number; ms: number; found: number; kept: number;
  viaRelay: boolean; cached: boolean; parsedFrom?: string; error?: string; enriched?: number;
}

export interface DirectCandidate {
  lot: DirectLot;
  score: number;
  premiumPct: number;
  premiumAssumed: boolean;
  allInLow?: number;      // in the user's currency
  allInHigh?: number;
  styleMatch: boolean | null;
  region?: Region | null; // null = not known yet (needs the lot page)
}

/** Not a period piece for this request: "style", XXe, copies, partly period / old parts, or "de style <requested 18th-c. style>" made later. */
export const periodProblemFor = (query: string, title?: string, description?: string) =>
  failsPeriodRule(title, description) || modernYearInTitle(title) || partlyPeriodProblem(title, description) || requestedStyleOnlyProblem(query, title, description);

/** Sites to search directly for this plan (only the auction sites the user's platforms/regions include). */
export const directSitesFor = (plan: DirectPlan): DirectSite[] =>
  (Object.keys(SITE_DOMAIN) as DirectSite[]).filter(s => plan.allowedDomains.includes(SITE_DOMAIN[s]));

/** Region of a lot: Interencheres = France; Drouot from the sale's country id, else from the city text. */
export const lotRegion = (lot: DirectLot): Region | null => {
  if (lot.site === 'interencheres') return 'France';
  if (lot.countryId != null) {
    const known = DROUOT_COUNTRIES[lot.countryId];
    if (known) return known.region;
  }
  const found = regionsInLocation([lot.city, lot.house].filter(Boolean).join(', '));
  if (found.size === 1) return Array.from(found)[0];
  if (found.size > 1) return found.has('France') ? 'France' : Array.from(found)[0];
  return null; // unknown (e.g. a foreign country id whose city is not in our lists): not shown when regions are set
};

const firstSentence = (s?: string) => String(s || '').split(/(?<=[.;!?])\s|\n/)[0].slice(0, 200);
const TOY_WORDS = /(^|[^a-zà-ÿ])(jouets?|poup[ée]es?|dinette|maquettes?|miniatures?|doll'?s?|dolls'? house|toys?)([^a-zà-ÿ]|$)/i;
const PERIOD_HINT = /([ée]poque|XVIII|XIX|18th|19th|1[78]\d\d|vers 1[78]|circa 1[78])/i;

/** Decide whether a lot can be shown, and score it. `requireRegion` = the lot page has been read (or never will be). */
export const evaluateLot = (lot: DirectLot, params: DirectParams, plan: DirectPlan, now = Date.now(), requireRegion = false):
  { candidate?: DirectCandidate; dropReason?: string } => {
  if (lot.soldOrEnded) return { dropReason: 'sold_or_ended' };
  if (lot.saleDate) {
    const t = lot.saleDate.getTime();
    const cutoff = lot.saleType === 'online' || lot.dateOnly ? now : now - LIVE_SALE_GRACE_MS;
    if (t < cutoff) return { dropReason: 'past_sale' };
  }
  if (!matchesItemType(plan.itemTypes, lot.title, firstSentence(lot.description))) return { dropReason: 'not_requested_type' };
  // "Fauteuil de bureau", "Lampe de bureau" for a desk; a plain "bureau" for "secrétaire à abattant"
  const piece = pieceProblem(params.query, plan.itemTypes, lot.title, firstSentence(lot.description));
  if (piece) return { dropReason: piece };
  // Doll's-house / toy / miniature furniture ("JOUETS. Ensemble de 6 meubles de poupée : un buffet…")
  if (plan.itemTypes.length && TOY_WORDS.test(`${lot.title} ${firstSentence(lot.description)}`)) return { dropReason: 'not_requested_type' };
  if (params.periodOnly !== false && periodProblemFor(params.query, lot.title, lot.description)) return { dropReason: 'not_period' };

  const region = lotRegion(lot);
  if (plan.regions) {
    if (region && !plan.regions.has(region)) return { dropReason: 'geo_location_mismatch' };
    if (!region && requireRegion) return { dropReason: 'geo_location_unknown' };
  }

  const premiumAssumed = !(lot.premiumPct && lot.premiumPct > 0);
  const premiumPct = premiumAssumed ? DEFAULT_PREMIUM_PCT : lot.premiumPct!;
  const low = lot.estimateLow ?? lot.estimateHigh ?? lot.startingPrice;
  const high = lot.estimateHigh ?? lot.estimateLow ?? lot.startingPrice;
  const conv = (n?: number) => (n ? convertApprox(allIn(n, premiumPct), lot.currency, params.currency || 'EUR') ?? undefined : undefined);
  const allInLow = conv(low);
  const allInHigh = conv(high);
  const max = budgetMax(params.priceRange);
  const min = budgetMin(params.priceRange);
  if (max && allInLow && allInLow > max) return { dropReason: 'over_budget' };
  const hasEstimate = !!(lot.estimateLow || lot.estimateHigh);
  if (min && hasEstimate && allInHigh && allInHigh < min * 0.8) return { dropReason: 'under_budget' };

  const text = `${lot.title} ${lot.description || ''}`;
  const styleMatch = matchesStyle(params.query, text);
  const normText = normalise(text);
  let score = 0;
  if (styleMatch === true) score += 3;
  if (styleMatch === false) score += impliedStyleMatch(params.query, text) ? 1.5 : -1;
  if (materialsInQuery(params.query).some(m => m.match.some(w => normText.includes(w)))) score += 1;
  if (PERIOD_HINT.test(text)) score += 1;
  if (hasEstimate) score += 1; else if (lot.startingPrice) score += 0.3; else score -= 1;
  if (max && allInHigh && allInHigh <= max) score += 1;
  if (lot.image) score += 0.3;
  if (!premiumAssumed) score += 0.2;
  if (lot.saleDate && lot.saleDate.getTime() - now < 14 * 86400_000) score += 0.5;
  return { candidate: { lot, score: Math.round(score * 10) / 10, premiumPct, premiumAssumed, allInLow, allInHigh, styleMatch, region } };
};

// ---------------------------------------------------------------------------
// Network: search pages and enrichment
// ---------------------------------------------------------------------------

const SEARCHERS: Record<DirectSite, { url: (q: string) => string; parse: (html: string, now: number) => { lots: DirectLot[]; from: string } }> = {
  drouot: { url: drouotSearchUrl, parse: (html) => { const r = parseDrouotSearch(html); return { lots: r.lots, from: `${r.from}:${r.lang}` }; } },
  interencheres: { url: interencheresSearchUrl, parse: (html, now) => ({ lots: parseInterencheresSearch(html, now), from: 'cards' }) },
};

// Fix 2: several keyword queries per site (the user's piece word + style, + century, + "époque", + form words),
// run in parallel and merged. Interencheres often blocks the server: its other queries only run when the first one answers.
export const SITE_QUERY_COUNT: Record<DirectSite, number> = { drouot: 6, interencheres: 2 };

export const siteQueries = (site: DirectSite, query: string): string[] => {
  const qs = frenchSiteQueries(query, SITE_QUERY_COUNT[site]);
  return qs.length ? qs : [frenchSiteQuery(query)];
};

const searchSite = async (site: DirectSite, params: DirectParams, deadline: number): Promise<{ lots: DirectLot[]; stat: DirectSourceStat }> => {
  const queries = siteQueries(site, params.query);
  const one = async (q: string) => {
    const left = deadline - Date.now();
    if (left < 300) return null;
    const res: SourceResponse = await fetchSource(SEARCHERS[site].url(q), { timeoutMs: Math.min(5_000, left), ttlMs: SEARCH_TTL_MS });
    const parsed = res.body ? SEARCHERS[site].parse(res.body, Date.now()) : { lots: [], from: 'none' };
    return { q, res, parsed };
  };
  const ok = (r: Awaited<ReturnType<typeof one>>) => !!r && r.res.status >= 200 && r.res.status < 300;
  let outs: Array<Awaited<ReturnType<typeof one>>>;
  if (site === 'interencheres') {
    const first = await one(queries[0]);
    outs = [first, ...(ok(first) ? await Promise.all(queries.slice(1).map(one)) : [])];
  } else {
    outs = await Promise.all(queries.map(one));
  }
  const done = outs.filter(Boolean) as Array<NonNullable<Awaited<ReturnType<typeof one>>>>;
  const seen = new Set<string>();
  const lots: DirectLot[] = [];
  for (const o of done) for (const l of o.parsed.lots) if (!seen.has(l.id)) { seen.add(l.id); lots.push(l); }
  const good = done.find(o => o.res.status >= 200 && o.res.status < 300);
  const ref = good || done[0];
  const stat: DirectSourceStat = {
    site, query: done.map(o => o.q).join(' | ') || queries[0], status: ref?.res.status ?? 0,
    ms: Math.max(0, ...done.map(o => o.res.ms)), found: lots.length, kept: 0,
    viaRelay: done.some(o => o.res.viaRelay), cached: done.length > 0 && done.every(o => o.res.cached),
    parsedFrom: ref?.parsed.from, ...(ref?.res.error && !good ? { error: ref.res.error } : {}),
  };
  return { lots, stat };
};

// Drouot house -> sale country cache (from lot pages), so lots from known foreign houses are not fetched again
const houseCountry = new Map<string, { countryId?: number; city?: string }>();

const enrichLot = async (lot: DirectLot, deadline: number, siteReachable: Record<DirectSite, boolean>): Promise<DirectLot> => {
  const left = deadline - Date.now();
  if (left < 300) return lot;
  if (lot.site === 'drouot') {
    const res = await fetchSource(lot.url, { timeoutMs: Math.min(3_500, left), ttlMs: LOT_TTL_MS });
    const facts = res.body ? parseDrouotLotPage(res.body) : null;
    if (!facts) return lot;
    if (facts.houseId) houseCountry.set(facts.houseId, { countryId: facts.countryId, city: facts.city });
    return mergeFacts(lot, facts);
  }
  if (lot.site === 'interencheres' && siteReachable.interencheres) {
    const res = await fetchSource(interencheresItemApiUrl(lot.id), { timeoutMs: Math.min(3_500, left), ttlMs: LOT_TTL_MS, accept: 'application/json' });
    let json: any = null;
    try { json = res.body ? JSON.parse(res.body) : null; } catch { json = null; }
    const f = json ? parseInterencheresItem(json) : null;
    if (!f) return lot;
    return mergeFacts(lot, {
      title: f.title, description: f.description, estimateLow: f.estimateLow, estimateHigh: f.estimateHigh,
      currency: f.estimateCurrency, premiumPct: f.buyerPremiumPct, saleDate: f.saleDate, dateOnly: f.saleDate ? false : lot.dateOnly,
      city: f.location?.replace(/,\s*France$/, ''), image: f.image, soldOrEnded: f.soldOrEnded, enriched: true,
    });
  }
  return lot;
};

const mergeFacts = (lot: DirectLot, f: Partial<DirectLot>): DirectLot => {
  const out: DirectLot = { ...lot };
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== null && v !== '') (out as any)[k] = v;
  out.soldOrEnded = !!(lot.soldOrEnded || f.soldOrEnded);
  out.enriched = true;
  return out;
};

const parisDay = (d?: Date) => {
  if (!d) return '';
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); }
  catch { return d.toISOString().slice(0, 10); }
};

/** Same estimate + same sale day + same start of title = the same lot listed on two sites. */
export const crossListingKey = (lot: DirectLot): string =>
  `${lot.estimateLow || ''}-${lot.estimateHigh || ''}-${parisDay(lot.saleDate)}-${normalise(lot.title).replace(/[^a-z0-9]/g, '').slice(0, 28)}`;

export interface DirectSearchResult {
  candidates: DirectCandidate[];
  stats: DirectSourceStat[];
  dropped: Record<string, number>;
  /** Domains whose search page was actually read (Gemini web search does not need to cover them) */
  coveredDomains: string[];
  ms: { search: number; enrich: number };
}

/** Phase 1: search pages (one per site), quick filters. */
export const searchDirectSites = async (params: DirectParams, plan: DirectPlan, deadline: number, now = Date.now()) => {
  const sites = directSitesFor(plan);
  const outcomes = await Promise.all(sites.map(s => searchSite(s, params, deadline).catch(err => ({
    lots: [] as DirectLot[], stat: { site: s, query: '', status: 0, ms: 0, found: 0, kept: 0, viaRelay: false, cached: false, error: String(err?.message || err).slice(0, 120) } as DirectSourceStat,
  }))));
  return { outcomes, now };
};

/** Phase 2: filter, enrich the best few from their lot pages, re-filter with the full facts, order. */
export const finishDirect = async (
  phase1: Awaited<ReturnType<typeof searchDirectSites>>, params: DirectParams, plan: DirectPlan, enrichDeadline: number,
): Promise<DirectSearchResult> => {
  const started = Date.now();
  const dropped: Record<string, number> = {};
  const drop = (r: string) => { dropped[r] = (dropped[r] || 0) + 1; };
  const reachable: Record<DirectSite, boolean> = { drouot: false, interencheres: false };
  const seen = new Set<string>();
  let first: DirectCandidate[] = [];
  for (const { lots, stat } of phase1.outcomes) {
    reachable[stat.site] = stat.status >= 200 && stat.status < 300;
    for (const lot of lots) {
      const key = `${lot.site}:${lot.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const known = lot.houseId ? houseCountry.get(lot.houseId) : undefined;
      const l = known && lot.countryId == null ? { ...lot, countryId: known.countryId, city: known.city } : lot;
      const o = evaluateLot(l, params, plan, phase1.now, false);
      if (o.candidate) first.push(o.candidate); else drop(o.dropReason || 'other');
    }
  }
  first.sort((a, b) => b.score - a.score);
  // Enrich the best candidates (Drouot: country/city/house/fees; Interencheres: full description, exact time, fees)
  const toEnrich = first.slice(0, MAX_ENRICH);
  const rest = first.slice(MAX_ENRICH);
  const enrichedCount: Record<DirectSite, number> = { drouot: 0, interencheres: 0 };
  const enriched = await Promise.all(toEnrich.map(async c => {
    const lot = await enrichLot(c.lot, enrichDeadline, reachable).catch(() => c.lot);
    if (lot.enriched) enrichedCount[lot.site]++;
    return lot;
  }));
  const finalList: DirectCandidate[] = [];
  for (const lot of enriched) {
    // A Drouot lot whose page could not be read keeps its search facts; its region must still be known to pass
    const o = evaluateLot(lot, params, plan, phase1.now, true);
    if (o.candidate) finalList.push(o.candidate); else drop(o.dropReason || 'other');
  }
  // Lots beyond the enrichment cap are only kept when their region is already known
  for (const c of rest) {
    const o = evaluateLot(c.lot, params, plan, phase1.now, true);
    if (o.candidate) finalList.push(o.candidate); else drop(o.dropReason === 'geo_location_unknown' ? 'not_checked' : (o.dropReason || 'other'));
  }
  finalList.sort((a, b) => b.score - a.score);
  // The same lot is often listed on both Drouot and Interencheres: keep the best-scored copy
  const deduped: DirectCandidate[] = [];
  const dupSeen = new Set<string>();
  for (const c of finalList) {
    const k = crossListingKey(c.lot);
    if (dupSeen.has(k)) { drop('cross_listed'); continue; }
    dupSeen.add(k);
    deduped.push(c);
  }
  finalList.length = 0;
  finalList.push(...deduped);
  const stats = phase1.outcomes.map(o => ({
    ...o.stat,
    kept: finalList.filter(c => c.lot.site === o.stat.site).length,
    enriched: enrichedCount[o.stat.site],
  }));
  return {
    candidates: finalList,
    stats,
    dropped,
    coveredDomains: stats.filter(s => s.status >= 200 && s.status < 300).map(s => SITE_DOMAIN[s.site]),
    ms: { search: Math.max(0, ...phase1.outcomes.map(o => o.stat.ms)), enrich: Date.now() - started },
  };
};

// ---------------------------------------------------------------------------
// Conversion to the app's result shape
// ---------------------------------------------------------------------------

const fmtMoney = (n: number, currency: string) => {
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n); }
  catch { return `${Math.round(n)} ${currency}`; }
};

export const formatSaleDay = (d: Date): string => {
  try { return 'Auction: ' + new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', year: 'numeric' }).format(d) + ' (Paris)'; }
  catch { return 'Auction: ' + d.toISOString().slice(0, 10); }
};

/** "All-in ≈ €258 – €386 incl. 28.8% fees" (in the user's currency). */
export const allInLabel = (c: DirectCandidate, currency = 'EUR'): string | undefined => {
  if (!c.allInLow) return undefined;
  const range = c.allInHigh && c.allInHigh !== c.allInLow ? `${fmtMoney(c.allInLow, currency)} – ${fmtMoney(c.allInHigh, currency)}` : fmtMoney(c.allInLow, currency);
  const fees = c.premiumAssumed ? `~${c.premiumPct}% fees assumed` : `incl. ${c.premiumPct}% fees`;
  const start = !c.lot.estimateLow && !c.lot.estimateHigh && c.lot.startingPrice ? ' (from the starting price)' : '';
  return `All-in ≈ ${range} ${fees}${start}`;
};

export const templateAnalysis = (c: DirectCandidate, query: string): string => {
  const l = c.lot;
  const where = [l.house, l.city].filter(Boolean).join(', ');
  const style = c.styleMatch === false ? ' The catalogue text does not name the style you asked for – check the photos.' : '';
  return `Found directly on ${SITE_LABEL[l.site]}${where ? ` (${where})` : ''}. Estimate, sale date${c.premiumAssumed ? '' : ' and fees'} are from the auction house.${style} Ask for a condition report and photos of the back, drawers and any stamp before bidding.`;
};

export interface DirectMatchFields {
  title: string; url: string; platform: string; price: string; location: string; date?: string; description?: string;
  dealerAnalysis: string; imageUrl?: string; verification: 'verified'; buyerPremiumPct?: number;
  source: 'drouot_search' | 'interencheres_search'; house?: string; allInEstimate?: string; premiumAssumed?: boolean; lotNumber?: number;
  allInLow?: number; allInHigh?: number; premiumPct?: number;
}

export const candidateToMatch = (c: DirectCandidate, params: DirectParams, analysis?: string): DirectMatchFields => {
  const l = c.lot;
  const est = formatEstimate(l.estimateLow, l.estimateHigh, l.currency || 'EUR');
  const price = est || (l.startingPrice ? `Starting price ${fmtMoney(l.startingPrice, l.currency || 'EUR')}` : 'No estimate published');
  const country = l.site === 'interencheres' || l.countryId === DROUOT_FRANCE_COUNTRY_ID ? 'France' : (l.countryId != null ? DROUOT_COUNTRIES[l.countryId]?.name : undefined);
  return {
    title: l.title,
    url: l.url,
    platform: SITE_LABEL[l.site],
    price,
    // Never the house name as a location (fix 9): city + country, else the region the lot was placed in
    location: [l.city, country].filter(Boolean).join(', ') || (c.region || ''),
    date: l.saleDate ? (l.dateOnly ? formatSaleDay(l.saleDate) : formatSaleDate(l.saleDate)) : undefined,
    description: l.description && l.description !== l.title ? l.description : undefined,
    dealerAnalysis: analysis || templateAnalysis(c, params.query),
    imageUrl: l.image,
    verification: 'verified',
    ...(c.premiumAssumed ? {} : { buyerPremiumPct: c.premiumPct }),
    source: l.site === 'drouot' ? 'drouot_search' : 'interencheres_search',
    house: l.house,
    allInEstimate: allInLabel(c, params.currency || 'EUR'),
    premiumAssumed: c.premiumAssumed,
    lotNumber: l.lotNumber,
    allInLow: c.allInLow,
    allInHigh: c.allInHigh,
    premiumPct: c.premiumPct,
  };
};

export const relayConfigured = () => !!relayConfig();
