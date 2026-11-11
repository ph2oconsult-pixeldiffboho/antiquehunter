// 1stDibs asking-price comparables (not sales) for the dealer / antique-shop walk-away only.
// Auction, brocante, flea-market and Leboncoin / private venues stay on sold comps and are unchanged.
// Every figure is computed here; the model never writes these prices.
//
// Discount: 0.85 (15% off the median ask). Typical 1stDibs / top-dealer negotiation is 10–20% off
// the asking price (1stDibs "Suggest a Price"; buyer/dealer reports of a 10–20% margin already in
// the ticket price; 5–20% is the usual range of accepted offers on specialist marketplaces). The
// midpoint is 15%. We do not also subtract the 1stDibs seller commission: that fee is already in
// the ask, and the buyer faces the asking price. Asking prices are labelled as such wherever they
// surface; they are not recorded sales.

import { matchSoldComps, pieceFeatures, type PieceFeatures, type SoldLot } from "./soldComps.js";

export const DIBS_DISCOUNT = 0.85;
export const DIBS_DISCOUNT_PCT = 15;
export const DIBS_MIN_COMPS = 4;
export const DIBS_MIN_SCORE = 4;
/** 1stDibs asks span a wide quality range. The walk-away only moves when the discounted
 *  median sits in the same price tier as the current (sold-comps) dealer high: no more than
 *  1.5× above it (the app's existing dealer overpriced factor) and no less than two-thirds
 *  of it. Outside that band the listings still set a labelled replacement value, but they
 *  do not move the walk-away. */
export const DIBS_MAX_UPLIFT = 1.5;
export const DIBS_MIN_RATIO = 2 / 3;

export type DibsOrigin = 'FR' | 'UK' | 'NORDIC' | 'OTHER';

export interface DibsLot {
  id: string; u: string; t: string; ask: number; d: string; src: '1stDibs' | string;
  rg: 'FR' | 'NORDIC'; origin: DibsOrigin; typology?: string; period?: string | null;
  stamp?: string | null; dims_cm?: string | null; location?: string | null; title?: string;
}

export interface DibsComp extends DibsLot { score: number; matched: string[]; }

export interface DibsCompsResponse {
  ok: boolean; comps: DibsComp[]; pool: number; features?: PieceFeatures; error?: string;
}

export type DibsAnchorMode = 'applied' | 'replacement_only' | 'too_few' | 'none';
export interface DibsAnchor {
  mode: DibsAnchorMode;
  walkAway: number;
  replacementAsk: number;
  medianAskEur: number;
  n: number;
  used: DibsComp[];
  discount: number;
  note: string;
}

const asSold = (l: DibsLot): SoldLot => ({
  id: l.id, u: l.u, t: l.t, h: l.ask, d: l.d, src: String(l.src || '1stDibs'), rg: l.rg,
});

/** Period queries only take period comps; style-only queries only take later-style comps. */
const closeEnough = (p: PieceFeatures, c: { matched: string[] }) => {
  if (p.styleOnly) return c.matched.includes('later_style');
  const periodish = c.matched.includes('period') || c.matched.includes('period_piece') || c.matched.includes('century');
  return periodish && !c.matched.includes('later_style');
};

const originOf = (text: string, hint?: DibsOrigin): DibsOrigin => {
  if (hint && hint !== 'OTHER') return hint;
  const t = String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/\b(swedish|sweden|suedois\w*|sverige|svensk|danish|denmark|danois|danmark|scandinav\w*|norwegian|norway|norge|nordic|gustavi\w*|gustaviansk\w*)\b/.test(t)) return 'NORDIC';
  if (/\b(english|england|welsh|wales|british|britain|great britain|\buk\b|scottish|scotland|irish|ireland)\b/.test(t)) return 'UK';
  if (/\b(french|france|francais)\b/.test(t)) return 'FR';
  return 'OTHER';
};

const originsOk = (a: DibsOrigin, b: DibsOrigin) =>
  a === 'OTHER' || b === 'OTHER' || a === b;

/** Best close 1stDibs asking-price comparables. The listing itself (same URL or id) is never used. */
export const matchDibsComps = (pool: DibsLot[], text: string, o: { lotUrl?: string; regionHint?: string; max?: number } = {}): { comps: DibsComp[]; features: PieceFeatures } => {
  const p = pieceFeatures(text, o.regionHint);
  const selfOrigin = originOf(text);
  // Reuse sold-comp scoring (type, region, period, style, century, materials, size), then keep only
  // close matches (period, century or style-tier) of the same origin when both are known.
  const raw = matchSoldComps(pool.map(asSold), text, { lotUrl: o.lotUrl, regionHint: o.regionHint, max: pool.length });
  const lotId = (o.lotUrl || '').match(/id-(f_\d+)/)?.[1] || (o.lotUrl || '').match(/(f_\d+)/)?.[1];
  const byId = new Map(pool.map(l => [l.id, l]));
  const out: DibsComp[] = [];
  for (const c of raw.comps) {
    if (o.lotUrl && (c.u === o.lotUrl || (lotId && (c.id === lotId || c.u.includes(lotId))))) continue;
    if (c.score < DIBS_MIN_SCORE || !closeEnough(p, c)) continue;
    const src = byId.get(c.id);
    if (!src) continue;
    if (!originsOk(selfOrigin, src.origin)) continue;
    out.push({ ...src, score: c.score, matched: c.matched });
  }
  out.sort((a, b) => b.score - a.score || b.d.localeCompare(a.d) || a.id.localeCompare(b.id));
  return { comps: out.slice(0, o.max ?? 10), features: p };
};

const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b); if (!s.length) return 0;
  const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
};
const round = (x: number) => x >= 10000 ? Math.round(x / 500) * 500 : x >= 1000 ? Math.round(x / 50) * 50 : Math.round(x / 10) * 10;

/**
 * Dealer walk-away from comparable 1stDibs asking prices: 15% below their median, never below the
 * auction high (a shop walk-away is never below what the piece would make at auction). Fallback:
 * the current dealer high, when there are too few close comps.
 */
export const dealerWalkAwayFromDibs = (comps: DibsComp[], o: {
  auctionHigh: number; dealerHigh: number; eurTo: (eur: number) => number;
}): DibsAnchor => {
  const base = { walkAway: o.dealerHigh, replacementAsk: 0, medianAskEur: 0, n: comps.length, used: comps, discount: DIBS_DISCOUNT, note: 'none' as string };
  if (!comps.length) return { ...base, mode: 'none', note: 'none' };
  const m0 = quantile(comps.map(c => c.ask), 0.5);
  const kept = comps.filter(c => c.ask <= m0 * 4 && c.ask >= m0 / 4);
  const used = kept.length ? kept : comps;
  if (used.length < DIBS_MIN_COMPS) return { ...base, used, n: used.length, medianAskEur: Math.round(quantile(used.map(c => c.ask), 0.5) || 0), mode: 'too_few', note: 'too_few' };
  const medianAskEur = quantile(used.map(c => c.ask), 0.5);
  const replacementAsk = round(o.eurTo(medianAskEur));
  const ceiling = round(o.eurTo(medianAskEur * DIBS_DISCOUNT));
  const auctionHigh = Math.max(0, o.auctionHigh || 0);
  const dealerHigh = Math.max(0, o.dealerHigh || 0);
  const baseOut = { replacementAsk, medianAskEur: Math.round(medianAskEur), n: used.length, used, discount: DIBS_DISCOUNT };
  // Same-tier gate: a 1stDibs median far above or below the sold-comps dealer high is a
  // different quality of piece (a later-style commode vs a stamped Paris one). Show the
  // asking-price replacement value, but leave the walk-away where it is.
  if (dealerHigh > 0 && (ceiling > dealerHigh * DIBS_MAX_UPLIFT || ceiling < dealerHigh * DIBS_MIN_RATIO)) {
    return { ...baseOut, mode: 'replacement_only', walkAway: dealerHigh, note: 'different_tier' };
  }
  const walkAway = Math.max(auctionHigh, ceiling);
  return { ...baseOut, mode: 'applied', walkAway, note: 'discounted_median' };
};

/** Code-written EN/FR note. Always labels the figures as asking prices, not sales. */
export const dibsCompsProse = (a: DibsAnchor, o: { language: string; fmt: (eur: number) => string }): { lead: string; replacement: string | null } => {
  const fr = String(o.language || '').toLowerCase().startsWith('fr');
  if (a.n < DIBS_MIN_COMPS || (a.mode !== 'applied' && a.mode !== 'replacement_only')) return { lead: '', replacement: null };
  const med = o.fmt(a.medianAskEur);
  const walk = o.fmt(a.walkAway);
  const rep = o.fmt(a.replacementAsk);
  const replacement = fr
    ? `Valeur de remplacement chez un marchand haut de gamme : ${rep} (prix demandé médian sur 1stDibs pour ${a.n} pièces similaires ; prix demandés, pas des ventes).`
    : `Replacement at a top dealer: ${rep} (median 1stDibs asking price of ${a.n} similar listings; asking prices, not sales).`;
  if (a.mode === 'replacement_only') {
    const lead = fr
      ? `Les ${a.n} annonces 1stDibs comparables (prix demandé médian ${med}) sont d'une autre gamme de prix que la fourchette marchand, donc elles ne déplacent pas le prix plafond en boutique. Ce sont des prix demandés, pas des ventes constatées.`
      : `The ${a.n} comparable 1stDibs listings (median asking price ${med}) sit in a different price tier from the dealer range, so they do not move the shop walk-away. These are asking prices, not recorded sales.`;
    return { lead, replacement };
  }
  const lead = fr
    ? `Prix plafond en boutique calculé sur ${a.n} annonces 1stDibs comparables (même type, origine, époque/style ; prix demandé médian ${med}, moins ${DIBS_DISCOUNT_PCT} % de négociation typique) : ${walk}. Ce sont des prix demandés, pas des ventes constatées.`
    : `Shop walk-away computed from ${a.n} comparable 1stDibs listings (same type, origin, period/style; median asking price ${med}, less a typical ${DIBS_DISCOUNT_PCT}% negotiation): ${walk}. These are asking prices, not recorded sales.`;
  return { lead, replacement };
};
