// Auction comparables for a maker's piece: page parsers (Christie's, Bonhams, generic result pages), the
// stamped / attributed classification, per-piece prices, and the range anchored on them. Pure (unit-tested);
// the network side is in compsSearch.ts (server only).
import { convertApprox } from "./budget.js";
import { countPieces, findMaker, fold, materialOf, type MakerStatus } from "./makers.js";
import { decodeEntities } from "./huntValidation.js";

export type CompStamp = 'stamped' | 'by' | 'attributed';

export interface Comparable {
  url: string;
  house: string;
  date?: string;            // YYYY-MM-DD (or YYYY)
  title: string;
  pieces: number;
  stamp: CompStamp;
  material?: string;
  price: number;            // as published
  currency: string;
  feesIncluded: boolean;    // published price includes the buyer's premium
  allInEur: number;         // with fees
  hammerEur: number;        // without fees
  perPieceAllInEur: number;
  perPieceHammerEur: number;
  verifiedBy: 'christies_lot_data' | 'bonhams_page' | 'price_on_page';
}

export interface CompsResponse {
  ok: boolean;
  maker?: string;
  piece?: string;
  comparables: Comparable[];
  /** Sources that were searched, and those that could not be read (e.g. Drouot results need an account) */
  searched: string[];
  unreachable: string[];
  stats: { candidates: number; verified: number; dropped: Record<string, number>; timingMs?: Record<string, number | number[]> };
  error?: string;
  partial?: string[];
  /** Every candidate page checked, with the verification outcome (transparency / debugging). */
  checked?: Array<{ url: string; result: string }>;
}

/** Typical buyer's premium incl. VAT, used to move between hammer and all-in when a house publishes only one. */
export const ASSUMED_PREMIUM_PCT = 27;

export const HOUSES: Array<{ re: RegExp; house: string; feesIncluded: boolean | null }> = [
  { re: /(^|\.)christies\.com$/, house: "Christie's", feesIncluded: true },
  { re: /(^|\.)sothebys\.com$/, house: "Sotheby's", feesIncluded: true },
  { re: /(^|\.)bonhams\.com$/, house: 'Bonhams', feesIncluded: true },
  { re: /(^|\.)phillips\.com$/, house: 'Phillips', feesIncluded: true },
  { re: /(^|\.)artcurial\.com$/, house: 'Artcurial', feesIncluded: null },
  { re: /(^|\.)drouot\.com$/, house: 'Drouot', feesIncluded: false },
  { re: /(^|\.)interencheres\.com$/, house: 'Interenchères', feesIncluded: false },
  { re: /(^|\.)auctionet\.com$/, house: 'Auctionet', feesIncluded: false },
  { re: /(^|\.)(invaluable|liveauctioneers|the-saleroom|lot-tissimo|lotsearch|veryimportantlot)\.(com|net|de)$/, house: '', feesIncluded: null },
  { re: /(^|\.)(dorotheum|koller|bukowskis|uppsalaauktion|lempertz|tajan|millon|aguttes|ader-paris|piasa|rouillac|osenat|gros-delettrez|beaussant-lefevre|delon-hoebanx|adjug-art|gazette-drouot)\.(com|fr|ch|at|se|de|net)$/, house: '', feesIncluded: null },
];

export const houseOf = (url: string): { house: string; feesIncluded: boolean | null } => {
  let host = '';
  try { host = new URL(url).hostname.toLowerCase(); } catch { return { house: '', feesIncluded: null }; }
  for (const h of HOUSES) if (h.re.test(host)) return { house: h.house || host.replace(/^www\./, ''), feesIncluded: h.feesIncluded };
  return { house: host.replace(/^www\./, ''), feesIncluded: null };
};

/** Stamped ("estampillé", "stamped P. BELLANGE"), attributed ("attribué à", "atelier de", trace of a stamp), or the house's "BY X". */
export const classifyStamp = (text: string): CompStamp => {
  const t = fold(text);
  if (/\b(attribu\w*|attr\.|workshop|atelier|entourage|circle\s+of|manner\s+of|dans\s+le\s+gout|style\s+of|probably|probablement|trace\s+of\s+a\s+stamp|traces?\s+d'estampille)\b/.test(t)) return 'attributed';
  if (/\b(estampill\w*|stamped|stamp|signed|signe\w*|branded)\b/.test(t)) return 'stamped';
  return 'by';
};

const num = (s: unknown): number => {
  const n = Number(String(s ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const jsonStr = (chunk: string, key: string): string | undefined => {
  const m = chunk.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
  if (!m) return undefined;
  try { return JSON.parse(`"${m[1]}"`); } catch { return m[1]; }
};
const jsonNum = (chunk: string, key: string): number => {
  const m = chunk.match(new RegExp(`"${key}"\\s*:\\s*"?([\\d.]+)"?`));
  return m ? Number(m[1]) : 0;
};

export interface ParsedLot { title: string; description?: string; price: number; currency: string; date?: string }

/** Christie's lot pages (www and onlineonly) carry the lot data as JSON: title, description, price realised (with premium), end date. */
export const parseChristiesLot = (html: string, url: string): ParsedLot | null => {
  const id = url.match(/lot-(\d+)/)?.[1] || url.match(/\/(\d+)(?:[/?#]|$)/)?.[1];
  if (!id) return null;
  const re = new RegExp(`"object_id"\\s*:\\s*"?${id}"?`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const start = m.index;
    const next = html.indexOf('"object_id"', start + 20);
    const chunk = html.slice(Math.max(0, start - 3000), next > 0 ? Math.min(next, start + 8000) : start + 8000);
    const local = html.slice(start, next > 0 ? next : start + 8000);
    const price = jsonNum(local, 'price_realised');
    const txt = jsonStr(local, 'price_realised_txt') || '';
    const currency = (txt.match(/\b([A-Z]{3})\b/)?.[1]) || '';
    const title = [jsonStr(local, 'title_primary_txt'), jsonStr(local, 'title_secondary_txt')].filter(Boolean).join(', ');
    if (!title || !price || !currency) continue;
    const date = (jsonStr(local, 'end_date') || jsonStr(chunk, 'end_date') || '').slice(0, 10) || undefined;
    const details = html.match(/chr-lot-section__accordion--text">([\s\S]{0,4000}?)<\/span>/)?.[1];
    const description = jsonStr(local, 'description_txt') || (details ? pageText(details) : '');
    return { title: decodeEntities(title), description: decodeEntities(description), price, currency, date };
  }
  return null;
};

const metaContent = (html: string, prop: string): string | undefined => {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i'))
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i'));
  return m ? decodeEntities(m[1]) : undefined;
};
export const pageTitle = (html: string): string =>
  metaContent(html, 'og:title') || decodeEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '').trim();
export const pageText = (html: string): string =>
  decodeEntities(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');

const CUR_SYM: Array<[RegExp, string]> = [[/^US\$|^\$|^USD/i, 'USD'], [/^£|^GBP/i, 'GBP'], [/^€|^EUR/i, 'EUR'], [/^CHF/i, 'CHF'], [/^SEK|^kr/i, 'SEK'], [/^HK\$/i, 'HKD']];
const curOf = (s: string): string => { for (const [re, c] of CUR_SYM) if (re.test(s.trim())) return c; return ''; };

/** Bonhams lot pages: "Sold for US$4,096 inc. premium". */
export const parseBonhamsLot = (html: string, claimPrice?: number): ParsedLot | null => {
  const text = pageText(html);
  const all = [...text.matchAll(/Sold for\s*(US\$|HK\$|AU\$|CHF|€|£|\$|EUR|GBP|USD)\s?([\d,.]+)\s*inc\.?\s*premium/gi)];
  if (!all.length) return null;
  const pick = (claimPrice && all.find(a => Math.abs(num(a[2]) - claimPrice) <= Math.max(2, claimPrice * 0.01))) || all[0];
  const title = pageTitle(html).replace(/^Bonhams[^:]*:\s*/i, '');
  const head = title.slice(0, 40);
  const at = head ? text.indexOf(head, Math.max(0, text.indexOf(head) + 1)) : -1; // the lot's own heading (after the page <title>)
  const from = at >= 0 ? at : Math.max(0, text.indexOf(pick[0]) - 200);
  return { title, price: num(pick[2]), currency: curOf(pick[1]), description: text.slice(from, from + 1500) };
};

const RESULT_WORDS = /(adjug|r[ée]sultat|sold|vendu|realis|realiz|hammer|marteau|prix|price)/i;

/** Any other result page: the claimed price must be printed on the page next to a result word. */
export const priceOnPage = (html: string, price: number): boolean => {
  if (!(price > 0)) return false;
  const text = pageText(html);
  const n = Math.round(price);
  const forms = new Set([String(n), n.toLocaleString('en-US'), n.toLocaleString('en-US').replace(/,/g, ' '), n.toLocaleString('en-US').replace(/,/g, '.'), n.toLocaleString('en-US').replace(/,/g, '\u202f'), n.toLocaleString('en-US').replace(/,/g, '\u00a0')]);
  for (const f of forms) {
    let i = text.indexOf(f);
    while (i >= 0) {
      const before = text[i - 1], after = text[i + f.length];
      if (!(before && /\d/.test(before)) && !(after && /\d/.test(after))) {
        if (RESULT_WORDS.test(text.slice(Math.max(0, i - 150), i + f.length + 60))) return true;
      }
      i = text.indexOf(f, i + 1);
    }
  }
  return false;
};

export interface CompClaim { url: string; house?: string; sale_date?: string; title?: string; pieces?: number; stamp_status?: string; price?: number; currency?: string; price_includes_fees?: boolean }

const yearOk = (d?: string) => { const y = Number(String(d || '').slice(0, 4)); return y >= 1990 && y <= 2100; };

/**
 * A comparable only from what the page itself shows: the maker in the lot title/description, the piece type, and a
 * sold price (Christie's lot data, Bonhams "Sold for … inc. premium", or the claimed price printed next to a result
 * word). Returns null (with the reason) when the page does not prove it.
 */
export const verifyComparable = (
  html: string, url: string, claim: CompClaim | null, makerKey: string, pieceRe: RegExp | null,
): { comp?: Comparable; reason?: string } => {
  const { house, feesIncluded: houseFees } = houseOf(url);
  let parsed: ParsedLot | null = null;
  let verifiedBy: Comparable['verifiedBy'] = 'price_on_page';
  if (/christies\.com$/.test(new URL(url).hostname)) {
    parsed = parseChristiesLot(html, url);
    if (!parsed) return { reason: 'christies_no_result' };
    verifiedBy = 'christies_lot_data';
  } else if (/bonhams\.com$/.test(new URL(url).hostname)) {
    parsed = parseBonhamsLot(html, claim?.price);
    if (!parsed) return { reason: 'bonhams_no_result' };
    verifiedBy = 'bonhams_page';
  } else {
    if (!claim?.price || !priceOnPage(html, claim.price)) return { reason: 'price_not_on_page' };
    const t = pageTitle(html);
    parsed = { title: t || claim.title || '', description: pageText(html).slice(0, 4000), price: claim.price, currency: String(claim.currency || 'EUR').toUpperCase() };
  }
  const lotText = `${parsed.title} ${parsed.description || ''}`;
  const maker = findMaker(`${parsed.title}. ${(parsed.description || '').slice(0, 1500)}`);
  if (!maker || maker.key !== makerKey) {
    // the maker may be named further down the house's description
    const m2 = findMaker(lotText);
    if (!m2 || m2.key !== makerKey) return { reason: 'maker_not_on_page' };
  }
  if (pieceRe && !pieceRe.test(fold(parsed.title)) && !pieceRe.test(fold((parsed.description || '').slice(0, 600)))) return { reason: 'other_piece' };
  const currency = parsed.currency || String(claim?.currency || '').toUpperCase();
  const eur = convertApprox(parsed.price, currency, 'EUR');
  if (!eur || eur <= 0) return { reason: 'currency' };
  const fees = houseFees ?? (claim?.price_includes_fees ?? false);
  const allInEur = Math.round(fees ? eur : eur * (1 + ASSUMED_PREMIUM_PCT / 100));
  const hammerEur = Math.round(fees ? eur / (1 + ASSUMED_PREMIUM_PCT / 100) : eur);
  const pieces = Math.max(1, countPieces(parsed.title) > 1 ? countPieces(parsed.title) : countPieces(lotText.slice(0, 800)) || Number(claim?.pieces) || 1);
  const date = parsed.date || (yearOk(claim?.sale_date) ? String(claim!.sale_date).slice(0, 10) : undefined);
  if (date && !html.includes(date.slice(0, 4)) && verifiedBy === 'price_on_page') return { comp: undefined, reason: 'date_not_on_page' };
  return {
    comp: {
      url, house: house || claim?.house || '', date, title: parsed.title.slice(0, 200), pieces,
      stamp: classifyStamp(lotText.slice(0, 1500)), material: materialOf(lotText.slice(0, 1500)),
      price: parsed.price, currency, feesIncluded: fees, allInEur, hammerEur,
      perPieceAllInEur: Math.round(allInEur / pieces), perPieceHammerEur: Math.round(hammerEur / pieces), verifiedBy,
    },
  };
};

// ---------------------------------------------------------------------------
// Anchoring the range on the comparables
// ---------------------------------------------------------------------------

export interface CompsAnchor {
  applied: boolean;
  reason: 'anchored' | 'too_few' | 'not_stamped' | 'none';
  group: 'stamped' | 'attributed' | null;
  used: Comparable[];
  perPieceMedianEur: number;
  pieces: number;
  low: number;   // in the target currency, for `pieces` pieces (hammer at auction, all-in elsewhere)
  high: number;
  basis: 'hammer' | 'all_in';
}

const quantile = (xs: number[], q: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return 0;
  const pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
};

/**
 * The market range from verified comparables: per-piece prices (hammer when buying at auction, all-in otherwise —
 * like with like), scaled to the number of pieces. A stamp anchors on stamped (or the house's "by") results, an
 * attribution on attributed ones; a dealer's label never anchors. Needs >= 2 matching results; same material
 * preferred when >= 2 share it; results since 2018 preferred when >= 2 exist.
 */
export const anchorOnComparables = (
  comps: Comparable[], o: { status: MakerStatus | null; pieces: number; material?: string; isAuction: boolean; eurTo: (eur: number) => number },
): CompsAnchor => {
  const group = o.status === 'stamped_confirmed' || o.status === 'stamped_stated' || o.status === 'stamp_in_photo' ? 'stamped'
    : o.status === 'attributed' ? 'attributed' : null;
  const empty = (reason: CompsAnchor['reason']): CompsAnchor => ({ applied: false, reason, group, used: [], perPieceMedianEur: 0, pieces: o.pieces, low: 0, high: 0, basis: o.isAuction ? 'hammer' : 'all_in' });
  if (!comps.length) return empty('none');
  if (!group) return empty('not_stamped');
  let pool = comps.filter(c => group === 'stamped' ? c.stamp !== 'attributed' : c.stamp === 'attributed');
  if (pool.length < 2) return empty('too_few');
  const recent = pool.filter(c => Number(String(c.date || '').slice(0, 4)) >= 2018);
  if (recent.length >= 2) pool = recent;
  if (o.material) { const same = pool.filter(c => c.material === o.material); if (same.length >= 2) pool = same; }
  const per = pool.map(c => o.isAuction ? c.perPieceHammerEur : c.perPieceAllInEur);
  const med = quantile(per, 0.5);
  const n = Math.max(1, o.pieces);
  const low = Math.min(quantile(per, 0.25), med * 0.85) * n;
  const high = Math.max(quantile(per, 0.75), med * 1.15) * n;
  const round = (x: number) => x >= 10000 ? Math.round(x / 500) * 500 : x >= 1000 ? Math.round(x / 50) * 50 : Math.round(x / 10) * 10;
  return {
    applied: true, reason: 'anchored', group, used: pool, perPieceMedianEur: Math.round(med), pieces: n,
    low: round(o.eurTo(low)), high: round(o.eurTo(high)), basis: o.isAuction ? 'hammer' : 'all_in',
  };
};
