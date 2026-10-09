// Fix 5: when the user pastes a lot link, read the lot page on the server and give the appraisal its REAL catalogue
// text, estimate, fees and photos. Nothing is invented: a field is only set when it was read from the page / API.
// The hammer result of an already-sold lot is never returned (the appraisal must not see it).
import { fetchSource } from "./sources/fetchSource.js";
import { parseDrouotLotPage } from "./sources/drouot.js";
import { parseJsLiteralAfter } from "./sources/jsLiteral.js";
import { cleanText, hostMatches, hostOf, interencheresItemApiUrl, interencheresLotId, parseInterencheresItem, parsePage } from "./huntValidation.js";
import { auctionetSearchUrl, type AuctionetItem } from "./huntValidation.js";

export interface LotFacts {
  ok: boolean;
  url: string;
  site: 'drouot' | 'auctionet' | 'interencheres' | 'other';
  title?: string;
  description?: string;
  estimateLow?: number;
  estimateHigh?: number;
  currency?: string;
  premiumPct?: number;
  saleDate?: string;      // ISO
  house?: string;
  city?: string;
  imageUrls: string[];
  /** Photos as data URLs (JPEG), read on the server so the browser does not hit cross-origin limits */
  images?: string[];
  /** The sale has ended (the result is NOT returned) */
  ended?: boolean;
  error?: string;
}

const LOT_TTL = 30 * 60_000;
const DROUOT_PHOTO = 'https://cdn.drouot.com/d/lot/ftall/';

/** Photo paths in a Drouot lot page ("578/185541/67b9…"), unique, in page order. */
export const drouotPhotoUrls = (html: string, max = 4): string[] => {
  const i = html.indexOf('data:{lot:');
  const block = i >= 0 ? html.slice(i, i + 80_000) : html;
  const out: string[] = [];
  for (const m of block.matchAll(/path:"(\d+\/\d+\/[0-9a-f]{16,})"/g)) {
    const u = DROUOT_PHOTO + m[1];
    if (!out.includes(u)) out.push(u);
    if (out.length >= max) break;
  }
  return out;
};

/** Full catalogue description of a Drouot lot (the search parser keeps only 600 characters). */
export const drouotFullDescription = (html: string): string | undefined => {
  const d: any = parseJsLiteralAfter(html, 'data:{lot:');
  const s = String(d?.lot?.description || '').replace(/\r/g, '').trim();
  return s ? cleanText(s.replace(/\n+/g, ' \n ')).slice(0, 2000) : undefined;
};

/** Item id from an Auctionet item URL (/en/5401614-…). Event URLs (/en/events/…/345-…) carry a lot number instead. */
export const auctionetItemId = (url: string): string | null => url.match(/auctionet\.com\/[a-z]{2}\/(\d+)-/)?.[1] || null;

/** Auctionet has no public single-item endpoint: search the item's title and pick the item with the same id. */
export const pickAuctionetItem = (json: any, id: string): AuctionetItem | null =>
  ((json?.items || []) as AuctionetItem[]).find(it => String(it?.id) === id) || null;

const stripHtml = (s: unknown) => cleanText(String(s || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));

const toDataUrls = async (urls: string[], deadline: number): Promise<string[]> => {
  const out = await Promise.all(urls.slice(0, 3).map(async u => {
    const left = deadline - Date.now();
    if (left < 300) return null;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), left);
    try {
      const r = await fetch(u, { signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (AntiqueHunter lot reader)' } });
      if (!r.ok) return null;
      const type = r.headers.get('content-type') || 'image/jpeg';
      if (!type.startsWith('image/')) return null;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 1_500_000) return null;
      return `data:${type.split(';')[0]};base64,${buf.toString('base64')}`;
    } catch { return null; } finally { clearTimeout(t); }
  }));
  return out.filter(Boolean) as string[];
};

export const fetchLotFacts = async (rawUrl: string, opts: { withImages?: boolean; timeoutMs?: number } = {}): Promise<LotFacts> => {
  const url = String(rawUrl || '').trim();
  const deadline = Date.now() + (opts.timeoutMs ?? 9_000);
  const host = hostOf(url);
  const fail = (site: LotFacts['site'], error: string): LotFacts => ({ ok: false, url, site, imageUrls: [], error });
  if (!/^https?:\/\//i.test(url) || !host) return fail('other', 'invalid_url');
  const left = () => Math.max(500, deadline - Date.now() - 2500);
  let facts: LotFacts;

  if (hostMatches(host, 'drouot.com')) {
    const res = await fetchSource(url, { timeoutMs: left(), ttlMs: LOT_TTL });
    const lot = res.body ? parseDrouotLotPage(res.body) : null;
    if (!lot) return fail('drouot', res.status ? `status_${res.status}` : (res.error || 'unreadable'));
    facts = {
      ok: true, url, site: 'drouot', title: lot.title, description: drouotFullDescription(res.body!) || lot.description,
      estimateLow: lot.estimateLow, estimateHigh: lot.estimateHigh, currency: lot.currency || 'EUR', premiumPct: lot.premiumPct,
      saleDate: lot.saleDate?.toISOString(), house: lot.house, city: lot.city, imageUrls: drouotPhotoUrls(res.body!), ended: !!lot.soldOrEnded,
    };
  } else if (hostMatches(host, 'auctionet.com')) {
    const res = await fetchSource(url, { timeoutMs: left(), ttlMs: LOT_TTL });
    const page = res.body ? parsePage(url, res.body) : null;
    // event URLs: the item id is in the photo file name ("large_item_5401614_…")
    const id = auctionetItemId(url) || page?.image?.match(/item_(\d+)_/)?.[1] || null;
    if (!id || !page?.title) return fail('auctionet', res.status ? `status_${res.status}` : (res.error || 'unreadable'));
    const api = await fetchSource(auctionetSearchUrl(page.title.replace(/[.…]+$/, ''), 50), { timeoutMs: left(), ttlMs: LOT_TTL, accept: 'application/json' });
    let it: AuctionetItem | null = null;
    try { it = api.body ? pickAuctionetItem(JSON.parse(api.body), id) : null; } catch { it = null; }
    facts = {
      ok: true, url, site: 'auctionet', title: cleanText(it?.title || page.title),
      description: it ? stripHtml(it.description).slice(0, 2000) : page.description,
      // the estimate only from the API (in the house's currency); the page shows it in the visitor's currency
      estimateLow: Number(it?.estimate) > 0 ? Number(it!.estimate) : undefined,
      estimateHigh: Number(it?.upper_estimate) > 0 ? Number(it!.upper_estimate) : undefined,
      currency: it?.currency, house: it?.house, city: it?.location || undefined,
      saleDate: it?.ends_at ? new Date(it.ends_at * 1000).toISOString() : undefined,
      imageUrls: (it?.images || []).map(i => i.w640 || i.thumb).filter(Boolean).slice(0, 4) as string[],
      ended: it ? (it.state ? it.state !== 'published' : !!it.hammered) : !!page.soldOrEnded,
    };
    if (!facts.imageUrls.length && page.image) facts.imageUrls = [page.image];
  } else if (hostMatches(host, 'interencheres.com')) {
    const lotId = interencheresLotId(url);
    const res = lotId ? await fetchSource(interencheresItemApiUrl(lotId), { timeoutMs: left(), ttlMs: LOT_TTL, accept: 'application/json' }) : null;
    let f = null;
    try { f = res?.body ? parseInterencheresItem(JSON.parse(res.body)) : null; } catch { f = null; }
    if (!f) return fail('interencheres', res?.status ? `status_${res.status}` : (res?.error || 'unreadable'));
    facts = {
      ok: true, url, site: 'interencheres', title: f.title, description: f.description, estimateLow: f.estimateLow, estimateHigh: f.estimateHigh,
      currency: f.estimateCurrency || 'EUR', premiumPct: f.buyerPremiumPct, saleDate: f.saleDate?.toISOString(), city: f.location,
      imageUrls: f.image ? [f.image] : [], ended: !!f.soldOrEnded,
    };
  } else {
    const res = await fetchSource(url, { timeoutMs: left(), ttlMs: LOT_TTL });
    if (!res.body) return fail('other', res.status ? `status_${res.status}` : (res.error || 'unreadable'));
    const p = parsePage(url, res.body);
    if (!p.title && !p.description) return fail('other', 'unreadable');
    facts = {
      ok: true, url, site: 'other', title: p.title, description: p.description, estimateLow: p.estimateLow, estimateHigh: p.estimateHigh,
      currency: p.estimateCurrency, premiumPct: p.buyerPremiumPct, saleDate: p.saleDate?.toISOString(), city: p.location,
      imageUrls: p.image ? [p.image] : [], ended: !!p.soldOrEnded,
    };
  }
  if (opts.withImages !== false && facts.imageUrls.length) facts.images = await toDataUrls(facts.imageUrls, deadline);
  return facts;
};

/** The lot facts as prompt text. Only what was read; says so when the estimate is missing. */
export const lotFactsPrompt = (f: LotFacts | null | undefined, fmt: (n: number, cur: string) => string = (n, c) => `${Math.round(n)} ${c}`): string => {
  if (!f) return '';
  if (!f.ok) return `LOT LINK: ${f.url}\nThe lot page could NOT be read. You have NOT seen its catalogue, estimate or photos: do not mention, guess or "anchor to" any catalogue estimate for this lot.`;
  const est = f.estimateLow || f.estimateHigh
    ? `${fmt(f.estimateLow || f.estimateHigh!, f.currency || 'EUR')}${f.estimateHigh && f.estimateLow && f.estimateHigh !== f.estimateLow ? ` – ${fmt(f.estimateHigh, f.currency || 'EUR')}` : ''} (hammer, before fees)`
    : 'none published on the page';
  return [
    `LOT LINK (read from the auction site): ${f.url}`,
    f.house || f.city ? `Auction house: ${[f.house, f.city].filter(Boolean).join(', ')}` : '',
    f.title ? `Catalogue title: ${f.title}` : '',
    f.description ? `Catalogue description: ${f.description}` : '',
    `Auction house estimate: ${est}`,
    f.premiumPct ? `Buyer's premium published by the sale: ${f.premiumPct}%` : '',
    f.ended ? 'This sale has ended (the result is not given to you).' : '',
    f.images?.length ? `${f.images.length} catalogue photo(s) from the lot page are attached.` : '',
  ].filter(Boolean).join('\n');
};
