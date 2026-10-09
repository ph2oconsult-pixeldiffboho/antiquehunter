// Step 2 valuation: real comparable sales blended with the model's price range. A dataset of sold lots (hammer prices
// from Drouot and Auctionet results, see scripts/build-comparables.ts) is searched for the lots closest to the piece
// (same type, region, period vs "style", century/style, maker stamp or attribution, wood, size, catalogue words).
// The model still prices the piece with the original fixed price ranges; the app then moves that range towards the
// median hammer of the close comparables, by how many there are and how well they agree (blendWithComparables), and
// sets the confidence from that agreement (comparablesConfidence). Pure functions; the dataset is loaded lazily.
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
  stamped: 0 | 1;        // maker's stamp / signature / attribution
  mats: string[];        // French material words
  size?: number;         // largest dimension in cm, when the catalogue gives one
}

export interface PieceFeatures {
  type: string | null;
  region: SoldComparable['region'] | null;
  style?: string;
  later: 0 | 1;
  century: SoldComparable['century'];
  stamped: 0 | 1;
  mats: string[];
  size?: number;
  tokens: Set<string>;
}

/** Largest dimension in cm from catalogue text ("H. 84 cm - L. 131 cm", "84 x 131 x 69 cm", "Höjd 81, 130 x 46 cm", "122cm x 50cm"). */
export const sizeOf = (text: string): number | undefined => {
  const t = String(text || '').replace(/(\d),(\d)/g, '$1.$2');
  const nums: number[] = [];
  // every 2–3 digit number in the 45 characters before a "cm" (covers "84 x 131 x 69 cm", "H. 237 – L. 158 cm", "Höjd ca 162, bredd ca 121 cm")
  for (const m of t.matchAll(/cm(?![a-z])/gi)) {
    const win = t.slice(Math.max(0, (m.index || 0) - 45), (m.index || 0) + 2);
    for (const n of win.matchAll(/(?<![\d.])(\d{2,3})(?:\.\d+)?(?![\d])/g)) nums.push(Number(n[1]));
  }
  const ok = nums.filter(n => n >= 15 && n <= 400);
  return ok.length ? Math.max(...ok) : undefined;
};

/** Head of a catalogue entry that is not furniture although it contains a furniture word ("service à glace en argent", "bracelet semainier en or"). */
export const NOT_FURNITURE_RE = /(^|[^a-zà-ÿ])(en argent|silver|or jaune|or gris|gold|bracelet|bague|collier|montre|huile sur|oil on|toile|gravure|lithograph\w*|dessin|photograph\w*|livre|book|porcelaine|fa[iï]ence|tapis|rug|lustre|lamp|lampe|pendule|clock|tableau)(?![a-zà-ÿ])/i;

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
const STAMP_RE = /(estampill|stamped|\bjme\b|sign[ée]|signed|attribu[ée]|attributed|ma[iî]tre|maker'?s mark|stämpel|stampel|signerad|märkt|markt)/i;

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
    size: sizeOf(text),
    tokens: tokensOf(text),
  };
};

/** Similarity of a sold lot to the piece (higher = closer). -Infinity = a different type of piece. */
export const similarity = (p: PieceFeatures, c: SoldComparable, cTokens?: Set<string>): number => {
  if (p.type && c.type !== p.type) return -Infinity;
  // a period piece is never priced from later copies / 20th-century pieces, and the other way round
  if (p.later !== c.later) return -Infinity;
  if (p.century && c.century && Math.abs(p.century - c.century) > 1) return -Infinity;
  let s = 0;
  if (p.type) s += 6;
  if (p.region && c.region === p.region) s += 3;
  else if (p.region && c.region !== p.region) s -= 3;
  if (p.style && c.style === p.style) s += 2;
  else if (p.style && c.style && c.style !== p.style) s -= 1;
  s += 2;
  if (p.century && c.century === p.century) s += 1;
  else if (p.century && c.century && c.century !== p.century) s -= 1;
  s += p.stamped === c.stamped ? (p.stamped ? 2 : 0) : -1.5;
  for (const m of p.mats) if (c.mats.includes(m)) s += 1;
  if (p.size && c.size) s -= Math.min(3, 2 * Math.abs(Math.log(p.size / c.size)));
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

/** Summary of the close comparables: how many, median hammer, interquartile spread (as a ratio p75/p25). */
export interface ComparableStats { n: number; median: number; p25: number; p75: number; spread: number }
const quantile = (sorted: number[], q: number) => {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
};
export const comparableStats = (matches: ComparableMatch[], minScore = COMP_MIN_SCORE): ComparableStats => {
  const close = matches.filter(m => m.score >= minScore).map(m => m.comp.hammer).sort((a, b) => a - b);
  if (!close.length) return { n: 0, median: 0, p25: 0, p75: 0, spread: Infinity };
  const p25 = quantile(close, 0.25), p75 = quantile(close, 0.75);
  return { n: close.length, median: median(close), p25, p75, spread: p25 > 0 ? p75 / p25 : Infinity };
};

// Fitted on the calibration half of the test set only (scripts/accuracy/fit_blend.mts); never on the holdout lots.
export const COMP_MIN_SCORE = 14;      // type + region + period/style flag + century/stamp/material or catalogue words in common
export const COMP_N = 5;               // closest lots considered
export const COMP_WEIGHT = 0.5;        // weight of the comparables' median when they are many and agree
export const COMP_MAX_SHIFT = 2.5;     // the model's range is never moved by more than ×/÷ 2.5

/** Weight given to the comparables: full weight with >= 4 close lots that agree (p75/p25 <= 4), less otherwise. */
export const comparableWeight = (st: ComparableStats, w = COMP_WEIGHT): number => {
  if (st.n < 2) return 0;
  const count = Math.min(1, st.n / 4);
  const agree = st.spread <= 4 ? 1 : 0.4;
  return w * count * agree;
};

/**
 * Moves the model's range (EUR) towards the comparables' median hammer, in log space, keeping the model's width.
 * Returns the factor applied to both ends (1 = unchanged).
 */
export const blendFactor = (modelLowEur: number, modelHighEur: number, st: ComparableStats, w = COMP_WEIGHT): number => {
  const weight = comparableWeight(st, w);
  if (!weight || !(modelLowEur > 0) || !(modelHighEur > 0) || !(st.median > 0)) return 1;
  const mid = Math.sqrt(modelLowEur * modelHighEur);
  const f = Math.exp(weight * Math.log(st.median / mid));
  return Math.min(COMP_MAX_SHIFT, Math.max(1 / COMP_MAX_SHIFT, f));
};

/**
 * Confidence from the comparables (0–100 cap): many close sales that agree with each other and with the final range
 * allow "high"; few or scattered sales cap it at "medium"/"low".
 */
export const comparablesConfidenceCap = (st: ComparableStats, finalLowEur: number, finalHighEur: number): number => {
  if (st.n < 2) return 54;                                  // no real evidence: at most "low"
  const inRange = st.median >= finalLowEur * 0.8 && st.median <= finalHighEur * 1.25;
  if (st.n >= 4 && st.spread <= 2.5 && inRange) return 100; // may be "high"
  if (st.n >= 3 && st.spread <= 4) return 74;               // at most "medium"
  return 54;
};

let cache: SoldComparable[] | null = null;
/** Load the bundled sold-lot dataset (a separate chunk, fetched only when an appraisal runs). */
export const loadComparables = async (): Promise<SoldComparable[]> => {
  if (cache) return cache;
  const mod: any = await import("../data/soldComparables.json");
  cache = (mod.default || mod) as SoldComparable[];
  return cache;
};
