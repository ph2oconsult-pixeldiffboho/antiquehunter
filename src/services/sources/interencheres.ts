// Interencheres (interencheres.com) keyword search.
// GET https://www.interencheres.com/recherche/lots?search=<keywords> is a server-rendered page with one card per lot:
//   <a href="/<category>/<sale-slug>-<saleId>/lot-<lotId>.html" id="<lotId>"> … Estimation : 300 € - 500 € …
//   <title (cut with "…")> … Live|Chrono|Catalogue … dd/mm/yyyy | "À 14h00" (today) … Proposé par <house>
// Enrichment (full description, exact date, city, fees) uses the lot JSON already used by the app
// (asgardgw.interencheres.com/v2/items/<id>, parsed by parseInterencheresItem).
// NOTE: Interencheres answers 403 to Vercel's servers (US and Paris regions, checked 8 Oct 2026), so on Vercel this
// only works through FETCH_RELAY_URL (see fetchSource.ts).
import type { DirectLot } from "./directTypes.js";

export const interencheresSearchUrl = (keywords: string) =>
  `https://www.interencheres.com/recherche/lots?search=${encodeURIComponent(keywords)}`;

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
const strip = (s: string) => decode(s.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' | '))
  .replace(/\s+/g, ' ').replace(/(\s*\|\s*)+/g, ' | ').replace(/^\s*\|\s*|\s*\|\s*$/g, '').trim();
const money = (s?: string) => (s ? Number(s.replace(/[^\d]/g, '')) || undefined : undefined);

/** Paris wall-clock time -> Date (CET/CEST, last Sunday of March / October rule). */
export const parisDate = (y: number, mo: number, d: number, h = 12, mi = 0): Date => {
  const lastSunday = (month: number) => { const x = new Date(Date.UTC(y, month + 1, 0)); return x.getUTCDate() - x.getUTCDay(); };
  const dstStart = Date.UTC(y, 2, lastSunday(2), 1);
  const dstEnd = Date.UTC(y, 9, lastSunday(9), 1);
  const guess = Date.UTC(y, mo - 1, d, h, mi) - 3600_000; // assume CET
  const offset = guess >= dstStart - 3600_000 && guess < dstEnd ? 2 : 1;
  return new Date(Date.UTC(y, mo - 1, d, h - offset, mi));
};

const parisToday = (now: number) => {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now)).split('-').map(Number);
  return { y: p[0], m: p[1], d: p[2] };
};

export const parseInterencheresSearch = (html: string, now = Date.now()): DirectLot[] => {
  const out: DirectLot[] = [];
  const seen = new Set<string>();
  const re = /<a\s+href="(\/[^"]*\/lot-(\d+)\.html)"([^>]*)>([\s\S]*?)<\/a>/g;
  for (const m of html.matchAll(re)) {
    const id = m[2];
    if (seen.has(id) || !new RegExp(`\\bid="${id}"`).test(m[3])) continue;
    seen.add(id);
    const parts = strip(m[4]).split(' | ').map(x => x.trim()).filter(Boolean);
    const text = parts.join(' | ');
    const est = text.match(/Estimation\s*: \| ([\d\s\u202f\u00a0.]+)\s*€(?: \| - \| ([\d\s\u202f\u00a0.]+)\s*€)?/);
    const typeIdx = parts.findIndex(p => /^(Live|Chrono|Catalogue|Online)$/i.test(p));
    const type = typeIdx >= 0 ? parts[typeIdx].toLowerCase() : '';
    let title = typeIdx > 0 ? parts[typeIdx - 1] : '';
    if (/^(Déjà vu|Premium|\d+\/\d+|€)$/i.test(title)) title = '';
    const houseIdx = parts.findIndex(p => /^Propos[ée] par$/i.test(p));
    const house = houseIdx >= 0 ? parts[houseIdx + 1] : undefined;
    let saleDate: Date | undefined;
    let dateOnly = false;
    const after = typeIdx >= 0 ? parts.slice(typeIdx + 1, houseIdx > typeIdx ? houseIdx : undefined).join(' ') : '';
    const dmy = after.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\D+(\d{1,2})h(\d{2}))?/);
    const today = after.match(/À\s*(\d{1,2})h(\d{2})/i);
    if (dmy) {
      saleDate = parisDate(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]), dmy[4] ? Number(dmy[4]) : 23, dmy[5] ? Number(dmy[5]) : 59);
      dateOnly = !dmy[4];
    } else if (today) {
      const t = parisToday(now);
      saleDate = parisDate(t.y, t.m, t.d, Number(today[1]), Number(today[2]));
    }
    const img = m[4].match(/<img[^>]*src="((?:https?:)?\/\/thumbor-indbupload\.interencheres\.com\/[^"]+)"/)?.[1];
    out.push({
      site: 'interencheres',
      id,
      url: 'https://www.interencheres.com' + m[1],
      title: title || 'Lot ' + id,
      estimateLow: est ? money(est[1]) : undefined,
      estimateHigh: est ? money(est[2]) : undefined,
      currency: 'EUR',
      saleDate,
      dateOnly,
      saleType: type === 'chrono' || type === 'online' ? 'online' : type === 'catalogue' ? 'catalogue' : type ? 'live' : undefined,
      house: house ? house.replace(/\s+/g, ' ') : undefined,
      countryId: 75,
      city: undefined,
      image: img ? (img.startsWith('//') ? 'https:' + img : img) : undefined,
    });
  }
  return out;
};
