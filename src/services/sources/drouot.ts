// Drouot (drouot.com) keyword search and lot pages.
// Search: GET https://drouot.com/fr/s?query=<keywords>. The server-rendered page embeds the result data
// (data:{lots:[…], breakdowns:{breakdownAuctioneer:{id:{name}}}}) with full description, estimates, sale date,
// buyer's premium (saleFees) and sale status. The same URL sometimes comes back as the ENGLISH page
// (cached language variant): both are handled, with an HTML-card fallback (Estimation / Estimate, Mise à prix /
// Starting price) if the embedded data ever disappears.
// Lot page: GET https://drouot.com/fr/l/<id>-<slug> embeds data:{lot:{…, saleInfo:{address:{city,country}, auctioneerCard}}}.
import { parseJsLiteralAfter } from "./jsLiteral.js";
import type { DirectLot } from "./directTypes.js";

export const DROUOT_FRANCE_COUNTRY_ID = 75;
// Drouot's own country ids seen on lot pages (only used for display / geography; unknown ids => use the city)
export const DROUOT_COUNTRIES: Record<number, { name: string; region: 'France' | 'United Kingdom' | 'United States' | 'Europe' }> = {
  75: { name: 'France', region: 'France' },
};

export const drouotSearchUrl = (keywords: string) => `https://drouot.com/fr/s?query=${encodeURIComponent(keywords)}`;

const PHOTO_BASE = 'https://cdn.drouot.com/d/lot/ftall/';

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
const clean = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim();
const firstLine = (s: string) => {
  const line = String(s || '').split(/\n/).map(x => x.trim()).find(Boolean) || '';
  return line.length > 160 ? line.slice(0, 157).replace(/\s+\S*$/, '') + '…' : line;
};
/** Some houses start the description with the lot number ("419 Buffet vaisselier…"): drop it from the title. */
export const stripLotNumber = (title: string, lotNumber?: number) =>
  lotNumber && new RegExp(`^${lotNumber}(\\s*[-.):]\\s*|\\s+)`).test(title) ? title.replace(new RegExp(`^${lotNumber}(\\s*[-.):]\\s*|\\s+)`), '').trim() || title : title;
const num = (v: unknown) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : undefined);

const ENDED_STATUSES = /^(ENDED|CLOSED|FINISHED|TERMINATED|CANCELED|CANCELLED|ARCHIVED|RESULTS?)$/i;

/** Page language from the html tag or the lot links (the FR url sometimes serves the EN page). */
export const drouotPageLang = (html: string): 'fr' | 'en' | string => {
  const tag = html.match(/<html[^>]*\blang="([a-z]{2})/i)?.[1];
  if (tag) return tag.toLowerCase();
  return /href="\/en\/l\/\d+/.test(html) ? 'en' : 'fr';
};

const lotFromData = (o: any, houses: Record<string, string>): DirectLot | null => {
  const id = o?.id;
  if (typeof id !== 'number') return null;
  const description = clean(String(o.description || '').replace(/\r/g, '')) ? String(o.description).replace(/\r/g, '').trim() : '';
  const type = String(o.saleType || '').toUpperCase();
  const online = type === 'ONLINE';
  const ts = online ? (num(o.bidEndDate) || num(o.date)) : num(o.date);
  const low = num(o.lowEstim);
  const high = num(o.highEstim);
  const start = !low && !high && o.displayStartingPrice !== false ? num(o.nextBid) : undefined;
  // Always link the French page (Drouot resolves the lot by id, whatever the slug language)
  const href = `/fr/l/${id}${o.slug ? '-' + String(o.slug).replace(/[^a-z0-9-]/gi, '') : ''}`;
  return {
    site: 'drouot',
    id: String(id),
    url: 'https://drouot.com' + href,
    title: stripLotNumber(firstLine(description), num(o.num)) || clean(o.slug).replace(/-/g, ' '),
    description: clean(description).slice(0, 600) || undefined,
    estimateLow: low,
    estimateHigh: high,
    startingPrice: start,
    currency: String(o.currencyId || 'EUR'),
    premiumPct: num(o.saleFees) && o.saleFees < 50 ? o.saleFees : undefined,
    saleDate: ts ? new Date(ts * 1000) : undefined,
    saleType: online ? 'online' : 'live',
    house: o.auctioneerId != null ? clean(houses[String(o.auctioneerId)]) || undefined : undefined,
    houseId: o.auctioneerId != null ? String(o.auctioneerId) : undefined,
    image: o.photo?.path ? PHOTO_BASE + o.photo.path : undefined,
    lotNumber: num(o.num),
    soldOrEnded: !!num(o.result) || ENDED_STATUSES.test(String(o.saleStatus || '')),
  };
};

// Fallback: read the visible lot cards (FR or EN labels)
const strip = (s: string) => decode(s.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' | ')).replace(/\s+/g, ' ').replace(/(\s*\|\s*)+/g, ' | ').trim();
const money = (s: string) => Number(s.replace(/[^\d]/g, '')) || undefined;

const lotsFromCards = (html: string): DirectLot[] => {
  const out: DirectLot[] = [];
  const seen = new Set<string>();
  const re = /<a href="(\/(fr|en)\/l\/(\d+)-[^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
  for (const m of html.matchAll(re)) {
    if (seen.has(m[3])) continue;
    seen.add(m[3]);
    const t = strip(m[4]);
    const title = clean(decode(m[4].match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1]?.replace(/<[^>]+>/g, '') || ''));
    const est = t.match(/(Estimation|Estimate) \| ([\d\s\u202f\u00a0,.]+?)\s*(?:-\s*([\d\s\u202f\u00a0,.]+?))?\s*(€|EUR|£|\$)/);
    const sp = t.match(/(Mise à prix|Starting price|Starting bid) \| ([\d\s\u202f\u00a0,.]+?)\s*(€|EUR|£|\$)/);
    const sym = (est?.[4] || sp?.[3] || '€');
    out.push({
      site: 'drouot',
      id: m[3],
      url: `https://drouot.com/fr/l/${m[3]}${m[1].replace(/^\/(fr|en)\/l\/\d+/, '')}`,
      title: title || firstLine(t),
      description: title || undefined,
      estimateLow: est ? money(est[2]) : undefined,
      estimateHigh: est && est[3] ? money(est[3]) : undefined,
      startingPrice: !est && sp ? money(sp[2]) : undefined,
      currency: sym === '£' ? 'GBP' : sym === '$' ? 'USD' : 'EUR',
      saleType: /\bonline\b/i.test(t) ? 'online' : 'live',
      image: m[4].match(/<img[^>]*src="(https:\/\/cdn\.drouot\.com\/[^"]+)"/)?.[1],
    });
  }
  return out;
};

export interface DrouotSearchParse { lang: string; lots: DirectLot[]; total?: number; from: 'data' | 'cards' | 'none' }

export const parseDrouotSearch = (html: string): DrouotSearchParse => {
  const lang = drouotPageLang(html);
  const data: any = parseJsLiteralAfter(html, 'data:{lots:');
  if (data && Array.isArray(data.lots)) {
    const houses: Record<string, string> = {};
    for (const [hid, v] of Object.entries<any>(data.breakdowns?.breakdownAuctioneer || {})) if (v?.name) houses[hid] = v.name;
    const lots = data.lots.map((o: any) => lotFromData(o, houses)).filter(Boolean) as DirectLot[];
    return { lang, lots, total: typeof data.totalItems === 'number' ? data.totalItems : undefined, from: 'data' };
  }
  const cards = lotsFromCards(html);
  return { lang, lots: cards, from: cards.length ? 'cards' : 'none' };
};

/** Facts from a Drouot lot page (full description, city/country, house, fees, status). */
export const parseDrouotLotPage = (html: string): Partial<DirectLot> | null => {
  const d: any = parseJsLiteralAfter(html, 'data:{lot:');
  const lot = d?.lot;
  if (!lot || typeof lot.id !== 'number') return null;
  const online = String(lot.saleType || '').toUpperCase() === 'ONLINE';
  const ts = online ? (num(lot.bidEndDate) || num(lot.date)) : num(lot.date);
  const addr = lot.saleInfo?.address || {};
  const description = String(lot.description || '').replace(/\r/g, '').trim();
  const fees = num(lot.fees) ?? num(lot.saleFees);
  return {
    id: String(lot.id),
    title: stripLotNumber(firstLine(description), num(lot.num)) || undefined,
    description: clean(description).slice(0, 600) || undefined,
    estimateLow: num(lot.lowEstim),
    estimateHigh: num(lot.highEstim),
    currency: lot.currencyId ? String(lot.currencyId) : undefined,
    premiumPct: fees && fees < 50 ? fees : undefined,
    saleDate: ts ? new Date(ts * 1000) : undefined,
    saleType: online ? 'online' : 'live',
    house: clean(lot.saleInfo?.auctioneerCard?.link?.auctioneerName) || undefined,
    houseId: lot.auctioneerId != null ? String(lot.auctioneerId) : undefined,
    city: clean(addr.city) || undefined,
    countryId: typeof addr.country === 'number' ? addr.country : undefined,
    image: lot.photo?.path ? PHOTO_BASE + lot.photo.path : undefined,
    lotNumber: num(lot.num),
    soldOrEnded: !!num(lot.result) || ENDED_STATUSES.test(String(lot.saleStatus || '')) || ENDED_STATUSES.test(String(lot.saleInfo?.status || '')),
    enriched: true,
  };
};
