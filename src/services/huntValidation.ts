// Pure helpers used by the "Find Me an Antique" backend to validate AI search results.
// No network access here so these can be unit-tested (see scripts/check-hunt-logic.ts).

export type Verification = 'verified' | 'unverified';

// Selectable platform name -> hostnames that count as that platform.
export const PLATFORM_DOMAINS: Record<string, string[]> = {
  interencheres: ['interencheres.com'],
  drouot: ['drouot.com'],
  leboncoin: ['leboncoin.fr'],
  "christie's": ['christies.com'],
  "sotheby's": ['sothebys.com'],
  ebay: ['ebay.fr', 'ebay.co.uk', 'ebay.com', 'ebay.de', 'ebay.it', 'ebay.es', 'ebay.nl', 'ebay.be'],
  auctionet: ['auctionet.com'],
  bukowskis: ['bukowskis.com'],
  'the saleroom': ['the-saleroom.com'],
  'easylive auction': ['easyliveauction.com'],
  bonhams: ['bonhams.com'],
  catawiki: ['catawiki.com'],
  selency: ['selency.fr', 'selency.com'],
};

export const DEFAULT_PLATFORMS = ['Interencheres', 'Drouot', 'LeBonCoin', "Christie's", "Sotheby's", 'eBay'];

const normPlatform = (p: string) => String(p || '').trim().toLowerCase();

export const allowedDomainsFor = (platforms: string[]): string[] => {
  const list = platforms && platforms.length > 0 ? platforms : DEFAULT_PLATFORMS;
  const out = new Set<string>();
  for (const p of list) {
    for (const d of PLATFORM_DOMAINS[normPlatform(p)] || []) out.add(d);
  }
  return Array.from(out);
};

export const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
};

export const hostMatches = (host: string, domain: string) => host === domain || host.endsWith('.' + domain);

export const isAllowedHost = (url: string, allowedDomains: string[]): boolean => {
  const host = hostOf(url);
  return !!host && allowedDomains.some(d => hostMatches(host, d));
};

export const platformLabelForUrl = (url: string): string | null => {
  const host = hostOf(url);
  const labels: Record<string, string> = {
    interencheres: 'Interencheres', drouot: 'Drouot', leboncoin: 'LeBonCoin', "christie's": "Christie's",
    "sotheby's": "Sotheby's", ebay: 'eBay', auctionet: 'Auctionet', bukowskis: 'Bukowskis',
    'the saleroom': 'The Saleroom', 'easylive auction': 'easyLive Auction', bonhams: 'Bonhams', catawiki: 'Catawiki', selency: 'Selency',
  };
  for (const [key, domains] of Object.entries(PLATFORM_DOMAINS)) {
    if (domains.some(d => hostMatches(host, d))) return labels[key];
  }
  return null;
};

export const isGroundingRedirect = (url: string) => /^https?:\/\/vertexaisearch\.cloud\.google\.com\/grounding-api-redirect\//i.test(url);

// Search pages, category / SEO landing pages and other non-listing URLs.
export const isGenericUrl = (url: string): boolean => {
  const u = String(url || '').toLowerCase();
  if (!/^https?:\/\//.test(u)) return true;
  if (u.includes('search?') || u.includes('/search/') || u.includes('/category') || u.includes('/categorie')) return true;
  if (/[?&](search|q|query|text|keywords?|_nkw)=/.test(u)) return true;
  const host = hostOf(u);
  let path = '';
  try { path = new URL(u).pathname; } catch { return true; }
  if (hostMatches(host, 'leboncoin.fr') && (path.startsWith('/ck/') || path.startsWith('/recherche') || path.startsWith('/c/') || path.startsWith('/cl/'))) return true;
  if (host.startsWith('ebay.') && (path.startsWith('/b/') || path.startsWith('/sch/') || path.startsWith('/e/') || path.startsWith('/str/'))) return true;
  if (path === '/' || path === '') return true;
  return false;
};

// URL shapes that point at ONE specific lot / ad on each platform.
const SPECIFIC_PATTERNS: Array<[string, RegExp]> = [
  ['interencheres.com', /\/lot-\d+\.html/],
  ['drouot.com', /\/l\/\d+/],
  ['leboncoin.fr', /^\/(ad\/[^/]+\/\d+|[a-z_]+\/\d+\.htm)/],
  ['ebay.', /\/itm\/(\d+|[^/]+\/\d+)/],
  ['christies.com', /(\/lot\/|\/lot-\d+|^\/s\/[^/]+\/[^/]+\/\d+)/],
  ['sothebys.com', /\/buy\/auction\/\d{4}\/[^/]+\/[^/?#]+/],
  ['auctionet.com', /^\/(en|sv|de|fr|es|fi|da|nb)\/\d+-/],
  ['bukowskis.com', /(\/lots\/\d+|\/auctions\/\d+\/\d+-)/],
  ['the-saleroom.com', /\/lot-[0-9a-f]{8}-[0-9a-f-]{20,}/i],
  ['easyliveauction.com', /^\/catalogue\/lot\/[0-9a-f]{16,}\//i],
  ['bonhams.com', /\/auction\/\d+\/lot\/\d+/],
  ['catawiki.com', /\/l\/\d+/],
  ['selency.fr', /^\/p\/[A-Za-z0-9]{6,}/],
  ['selency.com', /^\/p\/[A-Za-z0-9]{6,}/],
];

export const isSpecificListingUrl = (url: string): boolean => {
  if (isGenericUrl(url)) return false;
  const host = hostOf(url);
  let path = '';
  try { path = new URL(url).pathname; } catch { return false; }
  for (const [domain, re] of SPECIFIC_PATTERNS) {
    const match = domain.endsWith('.') ? host.startsWith(domain) : hostMatches(host, domain);
    if (match) return re.test(path);
  }
  return false; // unknown host: we cannot tell, treat as not specific
};

// Text clean-up: NFC, repair the specific corruption seen in Gemini output
// (é -> TAB, à -> NUL, € -> U+2001), then strip remaining control characters.
export const cleanText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  let s = String(value);
  s = s.replace(/([A-Za-zÀ-ÿ])\t([A-Za-zÀ-ÿ])/g, '$1é$2');
  s = s.replace(/([A-Za-zÀ-ÿ ])\u0000([A-Za-zÀ-ÿ ])/g, '$1à$2');
  s = s.replace(/\u2001(?=\s?\d)/g, '€');
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uFFFD]/g, '');
  s = s.replace(/[\u2000-\u200A\u202F\u205F]/g, ' ');
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, '');
  try { s = s.normalize('NFC'); } catch { /* ignore */ }
  return s.replace(/[ \t]{2,}/g, ' ').trim();
};

export const decodeEntities = (s: string): string =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;|&apos;/g, "'")
   .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
   .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
   .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));

// Words that indicate a later "style" piece, copy or 20th-century item.
const NON_PERIOD_PATTERNS: RegExp[] = [
  /\bstyle\b/i,
  /\bde style\b/i,
  /\bXXe\b/,
  /\bXX(e|è|ème|eme)\s*(s\.|si[eè]cle)?/,
  /\b20(e|è|ème|eme)\s*si[eè]cle/i,
  /\b20th[\s-]*c(entury|\.)?/i,
  /\bmid[\s-]century\b/i,
  /\breproductions?\b/i,
  /\bcopies?\b/i,
  /\bcopie\b/i,
  /\bd['’]apr[eè]s\b/i,
  /\bstil\b/i,           // Swedish: "gustaviansk stil"
  /\b19\d0-tal\w*/i,       // Swedish: "1900-tal", "1900-talets mitt"
  /\bikea\b/i,            // e.g. IKEA "1700-talsserie" reproductions
];

export const failsPeriodRule = (...texts: Array<string | undefined | null>): string | null => {
  const joined = texts.filter(Boolean).join(' \n ');
  for (const re of NON_PERIOD_PATTERNS) {
    const m = joined.match(re);
    if (m) return m[0];
  }
  return null;
};

/** A 20th/21st-century year in a lot TITLE ("Byrå, gustaviansk stil, Tibro, 1985") means it is not a period piece. */
export const modernYearInTitle = (title: string | undefined | null): string | null => {
  const m = String(title || '').match(/(^|[^\d])(19\d\d|20[0-2]\d)(?![\d-]*tal)(?!\s*(mm|cm|m)\b)($|[^\d])/i);
  return m ? m[2] : null;
};

export interface PageFacts {
  title?: string;
  description?: string;
  image?: string;
  saleDate?: Date;
  estimateLow?: number;
  estimateHigh?: number;
  estimateCurrency?: string;
  soldOrEnded?: boolean;
  /** Where the lot is (sale city / country) when the page or API says so */
  location?: string;
  /** Buyer's premium in % when published (Interencheres) */
  buyerPremiumPct?: number;
}

const metaContent = (html: string, prop: string): string | undefined => {
  const a = new RegExp(`<meta[^>]*(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i');
  const b = new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, 'i');
  const m = html.match(a) || html.match(b);
  return m ? decodeEntities(m[1]) : undefined;
};

const visibleText = (html: string) =>
  decodeEntities(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');

const toNumber = (s: string) => Number(s.replace(/[\s\u00a0\u202f.,](?=\d{3}\b)/g, '').replace(',', '.'));

export const parsePage = (url: string, html: string): PageFacts => {
  const facts: PageFacts = {};
  const host = hostOf(url);
  const ogTitle = metaContent(html, 'og:title');
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const rawTitle = ogTitle || (titleTag ? decodeEntities(titleTag) : undefined);
  const lotNo = rawTitle?.match(/-\s*\d{6,}-(\d+)\s*(\||$)/)?.[1];
  if (rawTitle) {
    facts.title = cleanText(rawTitle.split(' | ')[0].replace(/\s+/g, ' ')
      .replace(/\s*[–-]\s*(Interencheres\.com|Drouot\.com|Drouot|Auctionet|Bukowskis|eBay|leboncoin)\s*$/i, '')
      .replace(/\s*-\s*\d{6,}-\d+\s*$/, '')
      .replace(/\s*(\.\.\.|…)\s*$/, '…'));
  }
  const rawDesc = metaContent(html, 'og:description') || metaContent(html, 'description');
  if (rawDesc) {
    let d = rawDesc.replace(/^En détail\s*:\s*/i, '');
    if (lotNo) d = d.replace(new RegExp(`^Lot\\s*${lotNo}`), '');
    facts.description = cleanText(d.replace(/\s+/g, ' ')).slice(0, 400);
  }
  const img = metaContent(html, 'og:image') || metaContent(html, 'twitter:image');
  if (img && /^https?:\/\//i.test(img)) facts.image = img;

  const text = visibleText(html);

  if (hostMatches(host, 'interencheres.com')) {
    // Timed online sales ("Date de clôture") have an end_at; live sales only a start_at
    // (sale end and this lot's own closing time); the earliest one is when this lot closes.
    const ends = Array.from(html.matchAll(/end_at:"(\d{4}-\d{2}-\d{2}T[\d:.]+Z)"/g)).map(m => new Date(m[1]).getTime()).filter(n => !isNaN(n));
    const iso = html.match(/start_at:"(\d{4}-\d{2}-\d{2}T[\d:.]+Z)"/);
    if (ends.length > 0) facts.saleDate = new Date(Math.min(...ends));
    else if (iso) facts.saleDate = new Date(iso[1]);
    else {
      const fr = text.match(/Date(?: de clôture)?\s+(\d{2})\/(\d{2})\/(\d{4})(?:\s+à\s+(\d{1,2})h(\d{2}))?/);
      if (fr) facts.saleDate = new Date(`${fr[3]}-${fr[2]}-${fr[1]}T${(fr[4] || '23').padStart(2, '0')}:${fr[5] || '59'}:00+02:00`);
    }
    const est = text.match(/Estimation\s+([\d\s\u00a0\u202f.,]+)\s*€\s*-\s*([\d\s\u00a0\u202f.,]+)\s*€/);
    if (est) { facts.estimateLow = toNumber(est[1]); facts.estimateHigh = toNumber(est[2]); facts.estimateCurrency = 'EUR'; }
    if (/\bAdjugé\s+[\d\s]+\s*€/.test(text)) facts.soldOrEnded = true;
  } else if (hostMatches(host, 'drouot.com')) {
    const block = html.slice(Math.max(0, html.indexOf('data:{lot:')), Math.max(0, html.indexOf('data:{lot:')) + 60000);
    const d = block.match(/[,{]date:(\d{9,11})\b/);
    if (d) facts.saleDate = new Date(Number(d[1]) * 1000);
    const lo = block.match(/[,{]lowEstim:(\d+(?:\.\d+)?)/);
    const hi = block.match(/[,{]highEstim:(\d+(?:\.\d+)?)/);
    const cur = block.match(/[,{]currencyId:"([A-Z]{3})"/);
    if (lo && Number(lo[1]) > 0) facts.estimateLow = Number(lo[1]);
    if (hi && Number(hi[1]) > 0) facts.estimateHigh = Number(hi[1]);
    if (cur) facts.estimateCurrency = cur[1];
    const res = block.match(/[,{]result:(\d+(?:\.\d+)?)/);
    if (res && Number(res[1]) > 0) facts.soldOrEnded = true;
  } else if (hostMatches(host, 'auctionet.com')) {
    const itemId = url.match(/\/(\d+)-/)?.[1];
    const at = itemId ? html.indexOf(`"id":${itemId},"auction_id"`) : -1;
    const seg = at >= 0 ? html.slice(at, at + 1500) : '';
    const state = seg.match(/"state":"([a-z_]+)"/)?.[1];
    if (state && /^(sold|unsold|ended|closed|withdrawn|cancelled|canceled)$/.test(state)) facts.soldOrEnded = true;
    const ends = seg.match(/"ends_at":(\d{9,11})/);
    if (ends) facts.saleDate = new Date(Number(ends[1]) * 1000);
    const est = seg.match(/"estimate":(\d+)/);
    const upper = seg.match(/"upper_estimate":(\d+)/);
    const cur = seg.match(/"currency":"([A-Z]{3})"/);
    if (est) { facts.estimateLow = Number(est[1]); facts.estimateHigh = upper ? Number(upper[1]) : undefined; facts.estimateCurrency = cur?.[1] || 'SEK'; }
    if (/This auction is closed|Auktionen är avslutad|Auktionen avslutad/i.test(text)) facts.soldOrEnded = true;
  } else if (hostMatches(host, 'easyliveauction.com')) {
    if (/\bHammer\s*(£|€|\$)\s?[\d,]+/.test(text) || /\bClosed\b/.test(text) || /\bLot (Sold|Unsold|Withdrawn)\b/i.test(text)) facts.soldOrEnded = true;
    const est = text.match(/Estimate\s*(£|€|\$)\s?([\d,]+)\s*-\s*(?:£|€|\$)\s?([\d,]+)/);
    if (est) {
      facts.estimateLow = toNumber(est[2]); facts.estimateHigh = toNumber(est[3]);
      facts.estimateCurrency = est[1] === '£' ? 'GBP' : est[1] === '€' ? 'EUR' : 'USD';
    }
    // "+ Calendar 2026-10-01 10:00:00 2026-10-04 20:00:00 Europe/London": the second timestamp is when the sale ends
    const cal = text.match(/Calendar\s+(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}):\d{2}\s+(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}):\d{2}\s+Europe\/London/);
    if (cal) facts.saleDate = new Date(`${cal[3]}T${cal[4]}:00+01:00`);
  } else {
    // Generic signals of a closed/sold listing
    if (/"availability"\s*:\s*"(https?:\/\/schema\.org\/)?(OutOfStock|SoldOut|Discontinued)"/i.test(html)) facts.soldOrEnded = true;
    if (/\b(This listing (has ended|was ended)|Cette annonce est terminée|Price realised|Prix réalisé|Lot closed|Sold for [£$€]|Auktionen avslutad|Avslutad|Klubbat pris|Hammer price|Auction ended|This auction is closed)\b/i.test(text)) facts.soldOrEnded = true;
    const endIso = html.match(/"(?:endDate|end_date|ends_at|endTime)"\s*:\s*"(\d{4}-\d{2}-\d{2}T[^"]+)"/);
    if (endIso) facts.saleDate = new Date(endIso[1]);
  }
  if (facts.saleDate && isNaN(facts.saleDate.getTime())) delete facts.saleDate;
  return facts;
};

export const formatEstimate = (low?: number, high?: number, currency = 'EUR'): string | undefined => {
  if (!low && !high) return undefined;
  const fmt = (n: number) => {
    try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n); }
    catch { return `${Math.round(n)} ${currency}`; }
  };
  if (low && high) return `Estimate ${fmt(low)} – ${fmt(high)}`;
  return `Estimate ${fmt((low || high) as number)}`;
};

export const formatSaleDate = (d: Date): string => {
  try {
    return 'Auction: ' + new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d) + ' (Paris)';
  } catch {
    return 'Auction: ' + d.toISOString();
  }
};

// ---------------------------------------------------------------------------
// Interencheres lot data (JSON). interencheres.com pages block server requests (403 from Vercel), but the
// same public, unauthenticated JSON the site's own pages load in the browser is available per lot at
// https://asgardgw.interencheres.com/v2/items/{lotId}. It gives the real estimate, sale date, city and fees.
// ---------------------------------------------------------------------------

export const interencheresLotId = (url: string): string | null => {
  if (!hostMatches(hostOf(url), 'interencheres.com')) return null;
  return url.match(/\/lot-(\d+)\.html/)?.[1] || null;
};

export const interencheresItemApiUrl = (lotId: string) => `https://asgardgw.interencheres.com/v2/items/${encodeURIComponent(lotId)}`;

const absUrl = (u: unknown): string | undefined => {
  const s = String(u || '');
  if (!s) return undefined;
  if (s.startsWith('//')) return 'https:' + s;
  return /^https?:\/\//i.test(s) ? s : undefined;
};

export const parseInterencheresItem = (json: any): PageFacts | null => {
  const d = json?.data;
  if (!d || typeof d !== 'object' || !d.id) return null;
  const facts: PageFacts = {};
  const fr = d.title_translations?.['fr-FR'] || d.title_translations?.['en-US'];
  const descFr = d.description_translations?.['fr-FR'] || d.description || d.description_translations?.['en-US'];
  if (descFr) facts.description = cleanText(String(descFr).replace(/\s+/g, ' ')).slice(0, 400);
  if (fr) {
    const t = cleanText(String(fr).replace(/\s+/g, ' '));
    // Titles are cut ("Commode dite \"Parisienne\" en chêne, la façade légèrement gal…"): prefer the full description start
    facts.title = /…$|\.\.\.$/.test(t) && facts.description ? facts.description.slice(0, 120).replace(/\s+\S*$/, '') + '…' : t;
  }
  const est = d.pricing?.estimates;
  if (est && (Number(est.min) > 0 || Number(est.max) > 0)) {
    if (Number(est.min) > 0) facts.estimateLow = Number(est.min);
    if (Number(est.max) > 0) facts.estimateHigh = Number(est.max);
    facts.estimateCurrency = String(d.sale?.currency || 'EUR');
  }
  // Timed sales close per lot (online.end_at); live sales take place at sale.datetime
  const when = d.online?.end_at || d.sale?.datetime || d.sale?.start_at;
  if (when) { const dt = new Date(when); if (!isNaN(dt.getTime())) facts.saleDate = dt; }
  const media = Array.isArray(d.medias) ? d.medias.find((m: any) => m?.type === 'item_picture') || d.medias[0] : null;
  const img = absUrl(media?.url);
  if (img) facts.image = img;
  const addr = d.sale?.address;
  if (addr?.city) facts.location = [addr.city, addr.country === 'FR' ? 'France' : addr.country].filter(Boolean).join(', ');
  const fee = Number(d.sale?.options?.commission_rate?.voluntary ?? d.sale?.options?.commission_rate?.judicial);
  if (fee > 0 && fee < 50) facts.buyerPremiumPct = fee;
  if (d.status && d.status !== 'confirmed') facts.soldOrEnded = true;
  if (d.states?.hidden || d.states?.suppressed || d.sale?.states?.canceled) facts.soldOrEnded = true;
  if (d.sale?.live?.has_ended || d.sale?.live?.result_is_confirmed) facts.soldOrEnded = true;
  if (d.pricing?.adjudication || d.adjudication || d.result?.amount) facts.soldOrEnded = true;
  return facts;
};

// ---------------------------------------------------------------------------
// Auctionet public API (https://auctionet.com/api/v2/items.json?q=...): real, current lots with estimate,
// end time, house city and photos. Used to search Swedish sources directly instead of relying on web search.
// ---------------------------------------------------------------------------

export interface AuctionetItem {
  id: number; title?: string; description?: string; currency?: string; estimate?: number; upper_estimate?: number | null;
  state?: string; hammered?: boolean; ends_at?: number; location?: string; house?: string; url?: string;
  images?: Array<{ w640?: string; thumb?: string }>;
}

export const auctionetSearchUrl = (q: string, perPage = 20) =>
  `https://auctionet.com/api/v2/items.json?q=${encodeURIComponent(q)}&per_page=${perPage}`;

const stripHtml = (s: unknown) => cleanText(decodeEntities(String(s || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' '));

export const auctionetFacts = (it: AuctionetItem, now = Date.now()): PageFacts & { live: boolean } => {
  const facts: PageFacts & { live: boolean } = { live: false };
  facts.title = cleanText(it.title || '');
  facts.description = stripHtml(it.description).slice(0, 400);
  if (Number(it.estimate) > 0) {
    facts.estimateLow = Number(it.estimate);
    if (Number(it.upper_estimate) > 0) facts.estimateHigh = Number(it.upper_estimate);
    facts.estimateCurrency = it.currency || 'SEK';
  }
  if (it.ends_at) facts.saleDate = new Date(Number(it.ends_at) * 1000);
  if (it.images?.[0]?.w640) facts.image = it.images[0].w640;
  facts.location = [it.location, it.house].filter(Boolean).join(' · ');
  facts.soldOrEnded = !!it.hammered || (it.state ? it.state !== 'published' : false);
  facts.live = !facts.soldOrEnded && !!facts.saleDate && facts.saleDate.getTime() > now;
  return facts;
};
