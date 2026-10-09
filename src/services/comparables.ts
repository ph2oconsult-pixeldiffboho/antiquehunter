// Fix 4: real comparable sales for the appraisal. A small dataset of sold lots (hammer prices from Drouot and Auctionet
// results, see scripts/build-comparables.ts) is searched for the 3–5 lots closest to the piece being appraised
// (same type, region, period/style, "style" vs period, maker stamp, wood, catalogue words). The model is given those
// real hammer prices instead of fixed price ranges. Pure functions; the dataset is loaded lazily.
import { itemTypesInQuery, materialsInQuery, normalise, regionsInLocation, styleInQuery, ITEM_TYPES } from "./huntGeo.js";
import { failsPeriodRule, modernYearInTitle } from "./huntValidation.js";
import { headType, partlyPeriodProblem } from "./pieceWords.js";

export interface SoldComparable {
  id: string;            // 'drouot-35127780' / 'auctionet-4601099'
  url: string;
  title: string;
  hammer: number;        // hammer price in EUR (before buyer's premium)
  estLow?: number;       // auction house estimate in EUR, when published
  estHigh?: number;
  date: string;          // sale day, YYYY-MM-DD
  house?: string;
  place?: string;        // city / country
  region: 'France' | 'Sweden' | 'United Kingdom' | 'Europe';
  type: string;          // ITEM_TYPES key
  style?: string;        // e.g. 'Louis XV', 'gustavien'
  later: 0 | 1;          // "style", later copy, 20th century, partly period
  century: 0 | 17 | 18 | 19 | 20;
  stamped: 0 | 1;
  mats: string[];        // French material words
}

export interface PieceFeatures {
  type: string | null;
  region: SoldComparable['region'] | null;
  style?: string;
  later: 0 | 1;
  century: SoldComparable['century'];
  stamped: 0 | 1;
  mats: string[];
  tokens: Set<string>;
}

const STOP = new Set(['avec', 'dans', 'pour', 'sous', 'deux', 'trois', 'quatre', 'cinq', 'ouvrant', 'ouvre', 'tiroirs', 'tiroir', 'reposant',
  'pieds', 'plateau', 'dessus', 'hauteur', 'largeur', 'profondeur', 'with', 'from', 'the', 'and', 'drawers', 'drawer', 'over', 'upon', 'raised',
  'height', 'width', 'depth', 'circa', 'cm', 'och', 'med', 'samt', 'cirka', 'höjd', 'hojd', 'bredd', 'djup', 'longueur', 'accidents', 'manques',
  'restaurations', 'usures', 'siecle', 'century', 'epoque', 'period', 'style', 'travail', 'bois', 'wood', 'traces', 'quelques', 'ainsi']);

export const tokensOf = (text: string): Set<string> =>
  new Set(normalise(text).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length >= 4 && !STOP.has(w) && !/^\d+$/.test(w)));

export const centuryOf = (text: string): SoldComparable['century'] => {
  const t = normalise(text);
  if (/(xx(e|eme)?\b|20th|19[0-9]\d|1900-tal|edwardian|art deco|mid[\s-]century|modern)/.test(t)) return 20;
  if (/(xix|19th|18[0-9]\d|1800-tal|napoleon iii|louis[\s-]*philippe|restauration|charles x|victorian|biedermeier|empire|directoire)/.test(t)) return 19;
  if (/(xviii|18th|17[0-9]\d|1700-tal|louis xv|louis xvi|regence|transition|gustavian|george (ii|iii)|rokoko)/.test(t)) return 18;
  if (/(xvii\b|xviie|17th|16[0-9]\d|1600-tal|louis xiii|louis xiv)/.test(t)) return 17;
  return 0;
};

const LATER_RE = /(\bmodern\b|contemporary|mid[\s-]century|\bvintage\b|reproduction|\brevival\b|in the manner of|in the taste of|\bcopy\b|\bkopia\b|\bstyle\b|-stil\b|\bstil\b|1900-tal|\bxx(e|eme)\b|20th)/i;
const STAMP_RE = /(estampill|stamped|\bjme\b|sign[ée]|signed|attribu[ée]|attributed|ma[iî]tre|maker'?s mark)/i;

/** Type of piece: from the words of the text (the first piece word of the title wins), else null. */
export const pieceTypeOf = (title: string, more = ''): string | null => {
  const head = headType(title);
  if (head && ITEM_TYPES[head]) return head;
  const t = itemTypesInQuery(`${title} ${more}`);
  return t[0] || null;
};

/** Region from a location ("Lyon, France", "Sweden") or, failing that, from the language of the text. */
export const regionOf = (location: string | undefined, text: string): SoldComparable['region'] | null => {
  const found = regionsInLocation(location || '');
  for (const r of ['France', 'Sweden', 'United Kingdom'] as const) if (found.has(r)) return r;
  if (found.has('Europe')) return 'Europe';
  const t = normalise(text);
  if (/(byra|skap|spegel|gustaviansk|1[78]00-tal|allmoge|sengustaviansk)/.test(t)) return 'Sweden';
  if (/(george (ii|iii|iv)|victorian|regency|chest of drawers|linen press|mahogany)/.test(t)) return 'United Kingdom';
  if (/(commode|miroir|armoire|epoque|secretaire|buffet|noyer|placage|estampill)/.test(t)) return 'France';
  return null;
};

export const featuresOf = (text: string, location?: string): PieceFeatures => {
  const firstLine = text.split(/\n|\. /)[0] || text;
  return {
    type: pieceTypeOf(firstLine, text.slice(0, 300)),
    region: regionOf(location, text),
    style: styleInQuery(text)?.fr,
    later: failsPeriodRule(text) || modernYearInTitle(firstLine) || partlyPeriodProblem(text) || LATER_RE.test(text) ? 1 : 0,
    century: centuryOf(text),
    stamped: STAMP_RE.test(text) ? 1 : 0,
    mats: materialsInQuery(text).map(m => m.fr),
    tokens: tokensOf(text),
  };
};

/** Similarity of a sold lot to the piece (higher = closer). -Infinity = a different type of piece. */
export const similarity = (p: PieceFeatures, c: SoldComparable, cTokens?: Set<string>): number => {
  if (p.type && c.type !== p.type) return -Infinity;
  let s = 0;
  if (p.type) s += 6;
  if (p.region && c.region === p.region) s += 3;
  if (p.style && c.style === p.style) s += 2;
  else if (p.style && c.style && c.style !== p.style) s -= 1;
  s += p.later === c.later ? 2 : -3;
  if (p.century && c.century === p.century) s += 1;
  if (p.stamped && c.stamped) s += 2;
  for (const m of p.mats) if (c.mats.includes(m)) s += 1;
  const ct = cTokens || tokensOf(c.title);
  let inter = 0;
  for (const w of p.tokens) if (ct.has(w)) inter++;
  const union = p.tokens.size + ct.size - inter;
  s += union ? 6 * inter / union : 0;
  return s;
};

export interface ComparableMatch { comp: SoldComparable; score: number }

/** The n closest sold lots (at most 2 per auction house, so one sale does not dominate). */
export const findComparables = (data: SoldComparable[], text: string, location?: string, n = 5, excludeIds: Set<string> = new Set()): ComparableMatch[] => {
  const p = featuresOf(text, location);
  const scored: ComparableMatch[] = [];
  for (const c of data) {
    if (excludeIds.has(c.id)) continue;
    const score = similarity(p, c);
    if (score > -Infinity) scored.push({ comp: c, score });
  }
  scored.sort((a, b) => b.score - a.score || b.comp.date.localeCompare(a.comp.date));
  const perHouse = new Map<string, number>();
  const out: ComparableMatch[] = [];
  for (const m of scored) {
    const h = m.comp.house || m.comp.id;
    if ((perHouse.get(h) || 0) >= 2) continue;
    perHouse.set(h, (perHouse.get(h) || 0) + 1);
    out.push(m);
    if (out.length >= n) break;
  }
  return out;
};

export const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Comparable sales as prompt lines, prices converted to the user's currency (approx.). */
export const comparablesPrompt = (matches: ComparableMatch[], toCurrency: (eur: number) => number, fmt: (n: number) => string): string => {
  if (!matches.length) return '';
  const lines = matches.map((m, i) => {
    const c = m.comp;
    const est = c.estLow ? ` (estimate ${fmt(toCurrency(c.estLow))}${c.estHigh && c.estHigh !== c.estLow ? `–${fmt(toCurrency(c.estHigh))}` : ''})` : '';
    return `${i + 1}. ${c.title} — ${[c.house, c.place].filter(Boolean).join(', ')}, ${c.date.slice(0, 7)}: HAMMER ${fmt(toCurrency(c.hammer))}${est}`;
  });
  const med = median(matches.map(m => m.comp.hammer));
  return `${lines.join('\n')}\nMedian hammer of these sales: ${fmt(toCurrency(med))}.`;
};

let cache: SoldComparable[] | null = null;
/** Load the bundled sold-lot dataset (a separate chunk, fetched only when an appraisal runs). */
export const loadComparables = async (): Promise<SoldComparable[]> => {
  if (cache) return cache;
  const mod: any = await import("../data/soldComparables.json");
  cache = (mod.default || mod) as SoldComparable[];
  return cache;
};
