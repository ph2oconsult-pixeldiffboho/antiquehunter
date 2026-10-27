// Comparable sales for pieces with no verified maker anchor (unstamped, or a stamp with no verified maker results).
// Pure and shared: the server matches the buyer's piece against real sold lots (src/data/soldComps.json, built by
// scripts/accuracy/build_sold_comps.py from Drouot and Auctionet results, fees stripped to the hammer); the app then
// computes the range from the matched hammers here. The model never sets these figures; it only writes prose.

import { countPieces } from "./makers.js";

export interface SoldLot { id: string; u: string; t: string; h: number; f?: number; d: string; src: string; house?: string; city?: string; rg: string }
export interface SoldComp extends SoldLot { score: number; matched: string[]; pieces: number; perPieceH: number }
export interface SoldCompsResponse { ok: boolean; comps: SoldComp[]; pool: number; features?: PieceFeatures; error?: string }

const fold = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’`]/g, "'");

/** Piece types, most specific first (a "commode-scriban" is a scriban). Swedish/English words cover Auctionet titles. */
const TYPES: Array<[string, RegExp]> = [
  ['chiffonnier', /\b(chiffonn?ier|chiffonniere|semainier|chiffonje|tallboy|chest[\s-]on[\s-]chest)\b/],
  ['scriban', /\b(scriban|bureau\s+de\s+pente|bureau[\s-]bookcase|slant[\s-]front|klaffbyra|skrivbyra|skrivchiffonje)\b/],
  ['secretaire', /\b(secretaire|sekretar|secretary)\b/],
  ['commode', /\b(commode|chest\s+of\s+drawers|byra|kommod|sauteuse)\b/],
  ['armoire', /\b(armoire|wardrobe|linen\s+press|kladskap|linneskap|bonnetiere|garde[\s-]robe)\b/],
  ['encoignure', /\b(encoignure|corner\s+cupboard|hornskap)\b/],
  ['buffet', /\b(buffet|vaisselier|enfilade|sideboard|skank|dresser|confiturier|bahut|homme\s+debout)\b/],
  ['bookcase', /\b(bibliotheque|vitrine|bookcase|vitrinskap|bokhylla|display\s+cabinet)\b/],
  ['mirror', /\b(miroirs?|glaces?|trumeaux?|mirrors?|speglar|spegel|pier\s+glass|psyche)\b/],
  ['console', /\b(console|konsolbord)\b/],
  ['desk', /\b(bureau|writing\s+desk|skrivbord|bonheur[\s-]du[\s-]jour|desk)\b/],
  ['dressing_table', /\b(coiffeuse|poudreuse|dressing\s+table)\b/],
  ['table', /\b(table|gueridon|bord|tea\s+table)\b/],
  ['seat', /\b(fauteuils?|chaises?|bergeres?|canape|sofa|chairs?|armchairs?|stol|stolar|fatolj|soffa)\b/],
  ['cabinet', /\b(cabinet|cupboard|skap)\b/],
];
const PERIODS: Array<[string, RegExp]> = [
  ['louis_xiv', /\blouis\s*(xiv|14)\b/], ['regence', /\b(regence|regency\s+period)\b/],
  ['transition', /\btransition\b/], ['louis_xv', /\b(louis\s*(xv|15)|rococo|rokoko)\b/], ['louis_xvi', /\b(louis\s*(xvi|16)|gustavian\w*|gustaviansk\w*)\b/],
  ['directoire', /\b(directoire|consulat)\b/], ['empire', /\bempire\b/], ['restauration', /\b(restauration|charles\s*x|karl\s+johan)\b/],
  ['louis_philippe', /\blouis[\s-]philippe\b/], ['napoleon_iii', /\b(napoleon\s*(iii|3)|second\s+empire)\b/],
  ['art_nouveau', /\b(art\s+nouveau|jugend)\b/], ['art_deco', /\bart\s+deco\b/], ['georgian', /\b(george\s+i{1,3}|georgian)\b/], ['victorian', /\b(victorian|edwardian)\b/],
];
const CENTURY: Array<[string, RegExp]> = [
  ['c17', /\b(xviie|xvii(e|eme)?\s+siecle|17th[\s-]century|1600-tal)/], ['c18', /\b(xviiie|xviii(e|eme)?\b|18th[\s-]century|1700-tal|17[0-9]{2}\b)/],
  ['c19', /\b(xixe|xix(e|eme)?\b|19th[\s-]century|1800-tal|18[0-9]{2}\b)/], ['c20', /\b(xxe|xx(e|eme)?\s+siecle|20th[\s-]century|1900-tal|19[0-9]{2}\b)/],
];
const MATERIALS: Array<[string, RegExp]> = [
  ['mahogany', /\b(acajou|mahogany|mahogny)\b/], ['walnut', /\b(noyer|walnut|valnot)\b/], ['cherry', /\b(merisier|cherry|kors?bar)\b/],
  ['oak', /\b(chene|oak|ek)\b/], ['fruitwood', /\b(fruitier|fruitwood|frukttra)\b/], ['pine', /\b(pin|sapin|pine|furu|tall)\b/],
  ['precious_veneer', /\b(bois\s+de\s+(rose|violette)|palissandre|amarante|kingwood|tulipwood|rosewood|jacaranda)\b/],
  ['marquetry', /\b(marquet\w*|intarsia|inlaid|inlay)\b/], ['painted', /\b(laque\w*|peint\w*|painted|malad)\b/],
  ['gilt', /\b(dore|doree|giltwood|gilt|forgylld)\b/], ['marble', /\b(marbre|marble|marmor)\b/], ['bronze', /\bbronzes?\b/],
];
const REGIONAL = /\b(lyonnais\w*|provencal\w*|dauphinois\w*|bordelais\w*|normand\w*|breton\w*|alsacien\w*|lorrain\w*|basque|parisien\w*|hache|nantais\w*|malouin\w*)\b/;
const STYLE_ONLY = /(\bde\s+style\b|\bdans\s+le\s+style\b|\bin\s+the\s+style\b|\bstyle\s+(louis|empire|regence|napoleon|directoire|restauration|transition|gustav)|[\s-]style\b|\w+-stil\b|\bstil\b)/;
const PERIOD_WORD = /(\bd'?\s?epoque\b|\bperiod\b|\bepoque\s+(louis|regence|transition|empire|directoire|restauration|napoleon))/;

/** Largest catalogue dimension in cm ("H. 120 cm", "87 x 44 cm", "höjd 77 cm"); null when none is given. */
export const sizeOf = (t: string): number | null => {
  const nums: number[] = [];
  for (const m of t.matchAll(/(\d{2,3}(?:[.,]\d)?)\s*(?:x\s*(\d{2,3}(?:[.,]\d)?)\s*)?(?:x\s*(\d{2,3}(?:[.,]\d)?)\s*)?cm\b/g))
    for (const g of [m[1], m[2], m[3]]) if (g) nums.push(Number(g.replace(',', '.')));
  const big = nums.filter(n => n >= 15 && n <= 400);
  return big.length ? Math.max(...big) : null;
};

export interface PieceFeatures { type: string | null; periods: string[]; centuries: string[]; materials: string[]; regional: string | null; styleOnly: boolean; region: 'FR' | 'NORDIC'; pieces: number; sizeCm: number | null; sizeWord: 'small' | 'large' | null }

export const pieceFeatures = (text: string, regionHint?: string): PieceFeatures => {
  const t = fold(text);
  const head = t.slice(0, 160);
  const type = (TYPES.find(([, re]) => re.test(head)) || TYPES.find(([, re]) => re.test(t)) || [null])[0] as string | null;
  const periods = PERIODS.filter(([, re]) => re.test(t)).map(([k]) => k);
  const centuries = CENTURY.filter(([, re]) => re.test(t)).map(([k]) => k);
  const materials = MATERIALS.filter(([, re]) => re.test(t)).map(([k]) => k);
  const regional = t.match(REGIONAL)?.[1]?.replace(/(ais|aise|al|ale|ois|oise|ien|ienne|and|ande|on|onne)e?s?$/, '') || null;
  const styleOnly = STYLE_ONLY.test(t) && !PERIOD_WORD.test(t);
  const region = regionHint === 'NORDIC' || /auctionet\.com|\b(sweden|swedish|sverige|svensk|danmark|norge|gustavian|gustaviansk|karl\s+johan|allmoge)\b|\b\w+-tal\b/.test(t) ? 'NORDIC' : 'FR';
  return { type, periods, centuries, materials, regional, styleOnly, region, pieces: Math.max(1, countPieces(text)), sizeCm: sizeOf(t), sizeWord: /\b(petite?s?|small|liten|litet|sma)\b/.test(head) ? 'small' : /\b(grande?s?|importante?s?|large|stor|stort)\b/.test(head) ? 'large' : null };
};

/** Similarity of a sold lot to the piece; null when the lot cannot be a comparable (other type, other market, the lot itself). */
export const scoreLot = (p: PieceFeatures, lotF: PieceFeatures): { score: number; matched: string[] } | null => {
  if (!p.type || lotF.type !== p.type) return null;
  if (lotF.region !== p.region) return null;
  let score = 1; const matched = ['type'];
  if (p.periods.length) {
    const same = p.periods.some(x => lotF.periods.includes(x));
    if (same) { score += 3; matched.push('period'); }
    else if (lotF.periods.length) score -= 2;
  }
  if (p.styleOnly === lotF.styleOnly) { score += 1; if (!p.styleOnly && p.periods.length) matched.push('period_piece'); else if (p.styleOnly) matched.push('later_style'); }
  else score -= 2;
  if (p.centuries.length && lotF.centuries.length) { if (p.centuries.some(x => lotF.centuries.includes(x))) { score += 1; matched.push('century'); } else score -= 1; }
  const mats = p.materials.filter(m => lotF.materials.includes(m));
  score += Math.min(3, mats.length) * 1; if (mats.length) matched.push(...mats);
  if (p.regional && lotF.regional === p.regional) { score += 1; matched.push('regional'); }
  if (p.sizeCm && lotF.sizeCm) {
    const r = Math.max(p.sizeCm, lotF.sizeCm) / Math.min(p.sizeCm, lotF.sizeCm);
    if (r <= 1.3) { score += 2; matched.push('size'); } else if (r > 1.8) score -= 3;
  } else if (p.sizeWord && lotF.sizeWord) { if (p.sizeWord === lotF.sizeWord) { score += 1; matched.push('size'); } else score -= 2; }
  return { score, matched };
};

const FEATURE_CACHE = new Map<string, PieceFeatures>();
const lotFeatures = (l: SoldLot) => {
  const k = `${l.src}:${l.id}`; let f = FEATURE_CACHE.get(k);
  if (!f) { f = pieceFeatures(l.t, l.rg); FEATURE_CACHE.set(k, f); }
  return f;
};

const firstWords = (s: string, n = 12) => fold(s).replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean).slice(0, n).join(' ');

/** Minimum similarity for a comparable: type + period (or type + two other matches when no period is known). */
export const MIN_SCORE = 4;
export const MAX_SOLD_COMPS = 10;

/** Best comparables from the pool. The lot itself (same URL, or a catalogue text that starts the same way) is never used. */
export const matchSoldComps = (pool: SoldLot[], text: string, o: { lotUrl?: string; regionHint?: string; max?: number } = {}): { comps: SoldComp[]; features: PieceFeatures } => {
  const p = pieceFeatures(text, o.regionHint);
  if (!p.type) return { comps: [], features: p };
  const self = firstWords(text);
  const lotId = (o.lotUrl || '').match(/\/l\/(\d+)/)?.[1] || (o.lotUrl || '').match(/lot-(\d+)/)?.[1];
  const out: SoldComp[] = [];
  for (const l of pool) {
    if (o.lotUrl && (l.u === o.lotUrl || (lotId && l.u.includes(lotId)))) continue;
    if (self.length > 30 && firstWords(l.t) === self) continue;
    const lf = lotFeatures(l);
    const s = scoreLot(p, lf);
    if (!s || s.score < MIN_SCORE) continue;
    out.push({ ...l, score: s.score, matched: s.matched, pieces: lf.pieces, perPieceH: Math.round(l.h / lf.pieces) });
  }
  out.sort((a, b) => b.score - a.score || b.d.localeCompare(a.d));
  return { comps: out.slice(0, o.max ?? MAX_SOLD_COMPS), features: p };
};

const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b); if (!s.length) return 0;
  const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
};
const round = (x: number) => x >= 10000 ? Math.round(x / 500) * 500 : x >= 1000 ? Math.round(x / 50) * 50 : Math.round(x / 10) * 10;

/** Comps needed to anchor the range; fewer are shown with a confidence note and the model's range stays (calibrated). */
export const MIN_ANCHOR_COMPS = 4;
/** A stamped piece with no verified maker results: the market for the type caps the range at this multiple of the comps' upper quartile. */
export const STAMP_CAP_MULT = 3;
/**
 * Unstamped cap gate (cross-validated on the dev set, see PR #50): cap only on close matches (type + region + period or
 * century [+ material]), enough of them, not too dispersed, not wildly cheaper than the appraiser's low (a description
 * match cannot see quality), and never pull the high below a share of the appraiser's high.
 */
const NON_MAT = new Set(['type', 'period', 'period_piece', 'later_style', 'century', 'regional', 'size']);
export const SOLD_CFG = { needMat: false, minClose: 6, maxDisp: 3, skipRatio: 0, capMult: 4, minHighShare: 0 };
/** Blend: weight of the comparables = n / (n + BLEND_K), at most BLEND_MAX, scaled down when their P75/P25 exceeds BLEND_DISP. */
export const BLEND_K = 6;
export const BLEND_MAX = 0.6;
export const BLEND_DISP = 2.5;

export type SoldAnchorMode = 'anchored' | 'capped' | 'too_few' | 'none';
export interface SoldAnchor {
  mode: SoldAnchorMode; low: number; high: number; used: SoldComp[]; medianHammerEur: number; n: number;
  basis: 'hammer' | 'all_in'; note: string; weight?: number;
}

/**
 * The range from the comparables' hammers (venue-aware: at auction the hammer; elsewhere the auction all-in, which the
 * dealer tier is then built on). Unstamped → anchored on the quartiles (widened to ±20% of the median at least).
 * Stamped without verified maker results → only capped (a stamp can lift a piece above its type, but not without limit).
 */
export const anchorOnSoldComps = (comps: SoldComp[], o: { pieces?: number; stamped: boolean; isAuction: boolean; premiumPct: number; modelLow: number; modelHigh: number; eurTo: (eur: number) => number }): SoldAnchor => {
  const basis: 'hammer' | 'all_in' = o.isAuction ? 'hammer' : 'all_in';
  const base = { low: o.modelLow, high: o.modelHigh, used: comps, medianHammerEur: 0, n: comps.length, basis };
  if (!comps.length) return { ...base, mode: 'none', note: 'none' };
  // Outliers (a lot of several pieces read as one, a famous provenance) never move the range: beyond 4x the median out
  const m0 = quantile(comps.map(c => c.perPieceH), 0.5);
  const kept = comps.filter(c => c.perPieceH <= m0 * 4 && c.perPieceH >= m0 / 4);
  if (kept.length < comps.length) { comps = kept; base.used = kept; base.n = kept.length; }
  const fee = (c: SoldComp) => o.isAuction ? 1 : 1 + (c.f ?? o.premiumPct) / 100;
  const n = Math.max(1, o.pieces || 1);
  const vals = comps.map(c => c.perPieceH * n * fee(c));
  const med = quantile(vals, 0.5);
  const medianHammerEur = Math.round(quantile(comps.map(c => c.perPieceH * n), 0.5));
  if (comps.length < MIN_ANCHOR_COMPS) return { ...base, medianHammerEur, mode: 'too_few', note: 'too_few' };
  const lo = o.eurTo(Math.min(quantile(vals, 0.25), med * 0.8));
  const hi = o.eurTo(Math.max(quantile(vals, 0.75), med * 1.2));
  // Unstamped with an appraiser range: same cap rule as a stamp (measured: blending the noisy comps median in lowered
  // calibration and walk-away safety on the dev set; capping keeps the harmful-high gain). No model range: comps alone.
  if (!o.stamped && o.modelHigh > 0) {
    const close = comps.filter(c => (c.matched.includes('period') || c.matched.includes('century')) && (!SOLD_CFG.needMat || c.matched.some(m => !NON_MAT.has(m))));
    const cv = close.map(c => c.perPieceH * n * fee(c));
    const disp = cv.length ? quantile(cv, 0.75) / Math.max(1, quantile(cv, 0.25)) : Infinity;
    const cmed = cv.length ? o.eurTo(quantile(cv, 0.5)) : 0;
    if (close.length < SOLD_CFG.minClose || disp > SOLD_CFG.maxDisp || (SOLD_CFG.skipRatio > 0 && cmed * SOLD_CFG.skipRatio < o.modelLow))
      return { ...base, ...(close.length < SOLD_CFG.minClose ? { n: close.length, used: close } : {}), medianHammerEur, mode: close.length < SOLD_CFG.minClose ? 'too_few' : 'none', note: close.length < SOLD_CFG.minClose ? 'too_few' : 'not_close' };
    const cap = Math.max(o.eurTo(quantile(cv, 0.75) * SOLD_CFG.capMult), o.modelHigh * SOLD_CFG.minHighShare);
    if (!(o.modelHigh > cap)) return { ...base, medianHammerEur, mode: 'none', note: 'within_cap' };
    const high = round(cap);
    return { ...base, low: Math.min(round(o.modelLow), high), high, medianHammerEur, n: close.length, used: close, mode: 'capped', note: 'type_capped' };
  }
  if (o.stamped) {
    const cap = o.eurTo(quantile(vals, 0.75) * STAMP_CAP_MULT);
    if (!(o.modelHigh > cap)) return { ...base, medianHammerEur, mode: 'none', note: 'within_cap' };
    const high = round(cap);
    const low = round(Math.min(o.modelLow, Math.max(hi, high / 3)));
    return { ...base, low: Math.min(low, high), high, medianHammerEur, mode: 'capped', note: o.stamped ? 'stamp_capped' : 'type_capped' };
  }
  // Blend with the appraiser's range in log space: more (and tighter) comparables weigh more; never fully replace it,
  // since a description match cannot see quality, condition or size the way the appraisal does.
  const disp = quantile(vals, 0.75) / Math.max(1, quantile(vals, 0.25));
  const w = o.modelLow > 0 && o.modelHigh > 0 ? Math.min(BLEND_MAX, comps.length / (comps.length + BLEND_K)) * Math.min(1, BLEND_DISP / disp) : 1;
  const mix = (m: number, c: number) => Math.exp((1 - w) * Math.log(Math.max(1, m)) + w * Math.log(Math.max(1, c)));
  const low = round(o.modelLow > 0 ? mix(o.modelLow, lo) : lo), high = round(o.modelHigh > 0 ? mix(o.modelHigh, hi) : hi);
  return { ...base, low, high: Math.max(low, high), medianHammerEur, mode: 'anchored', note: 'anchored', weight: Math.round(w * 100) / 100 };
};

/**
 * The code-written pricing lead and confidence note (EN/FR). Never asks for more evidence: the verdict always stands,
 * thin evidence only lowers how much weight the range deserves.
 */
export const soldCompsProse = (a: SoldAnchor, o: { language: string; isAuction: boolean; model: { low: number; high: number }; stamped: boolean; evidenceThin: boolean; fmt: (eur: number) => string }): { lead: string; note: string | null } => {
  const fr = String(o.language || '').toLowerCase().startsWith('fr');
  const med = a.medianHammerEur ? o.fmt(a.medianHammerEur) : '';
  const basis = fr ? (o.isAuction ? 'au marteau' : 'frais inclus') : (o.isAuction ? 'hammer' : 'incl. buyer fees');
  if (a.mode === 'anchored') return {
    lead: fr ? `Fourchette calculée sur ${a.n} ventes comparables (même type, époque/style et matériaux ; médiane ${med} au marteau, frais retirés), en ${basis}.`
             : `Range computed from ${a.n} comparable sales (same type, period/style and materials; median ${med} hammer, fees stripped), shown ${basis}.`,
    note: a.n < 6 ? (fr ? `Confiance modérée : ${a.n} comparables seulement.` : `Moderate confidence: only ${a.n} comparables.`) : null,
  };
  if (a.mode === 'capped' && !o.stamped) return {
    lead: fr ? `Fourchette plafonnée à ${STAMP_CAP_MULT}× le haut des ${a.n} ventes comparables (même type, époque/style, matériaux, taille ; médiane ${med} au marteau, frais retirés), en ${basis}.`
             : `Range capped at ${STAMP_CAP_MULT}× the upper quartile of ${a.n} comparable sales (same type, period/style, materials, size; median ${med} hammer, fees stripped), shown ${basis}.`,
    note: a.n < 6 ? (fr ? `Confiance modérée : ${a.n} comparables seulement.` : `Moderate confidence: only ${a.n} comparables.`) : null,
  };
  if (a.mode === 'capped') return {
    lead: fr ? `Estampille sans résultats vérifiés pour ce maître : fourchette plafonnée à ${STAMP_CAP_MULT}× le haut des ${a.n} ventes comparables du type (médiane ${med} au marteau).`
             : `Stamp with no verified results for this maker: range capped at ${STAMP_CAP_MULT}× the upper quartile of ${a.n} comparable sales of the type (median ${med} hammer).`,
    note: fr ? `Confiance limitée : la valeur d'une estampille mineure dépend de la qualité ; vérifiez-la.` : `Limited confidence: a minor maker's stamp is worth what the quality supports; check it.`,
  };
  if (a.note === 'not_close') return { lead: '', note: fr ? `${a.n} ventes du type listées pour référence (médiane ${med} au marteau) : trop disparates ou d'une autre gamme pour fixer la fourchette, qui reste l'estimation de l'expert.` : `${a.n} sales of the type listed for reference (median ${med} hammer): too varied or a different quality tier to set the range, which stays the appraiser's estimate.` };
  if (a.note === 'within_cap') return { lead: '', note: fr ? `Fourchette cohérente avec ${a.n} ventes comparables du type (médiane ${med} au marteau).` : `Range consistent with ${a.n} comparable sales of the type (median ${med} hammer).` };
  const few = a.mode === 'too_few' && a.n > 0;
  const note = few
    ? (fr ? `Confiance faible : seulement ${a.n} vente${a.n > 1 ? 's' : ''} comparable${a.n > 1 ? 's' : ''} (médiane ${med} au marteau) ; la fourchette reste l'estimation de l'expert.`
          : `Low confidence: only ${a.n} comparable sale${a.n > 1 ? 's' : ''} (median ${med} hammer); the range is the appraiser's estimate.`)
    : (fr ? `Confiance faible : aucune vente comparable dans nos résultats ; la fourchette reste l'estimation de l'expert.`
          : `Low confidence: no comparable sales in our results; the range is the appraiser's estimate.`);
  const thin = o.evidenceThin ? (fr ? ` Époque non établie : ne payez pas un prix d'époque sans l'avoir vérifiée.` : ` Period not established: do not pay a period price until it is checked.`) : '';
  return { lead: `${note}${thin}`, note: `${note}${thin}` };
};
