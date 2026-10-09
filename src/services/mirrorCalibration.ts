// Size-aware calibration of the market (auction hammer) range for wall mirrors and trumeaux.
//
// Why: the model reads the dimensions but barely weights them. On 30 calibration mirrors (sold at Drouot / London,
// 2026) it over-valued small "period" mirrors (2.5-5x the hammer) and under-valued large ones (0.3-0.4x).
// Reference: 45 real sold mirrors (Drouot results harvested from the public lot pages + the calibration split of the
// mirror test set; no lot from a held-out lot's sale), log(hammer) fitted on log(frame area):
//   hammer_eur ~= exp(5.465) * area_m2^0.869   ->  0.5 m2 ~ EUR 130, 1 m2 ~ EUR 240, 2 m2 ~ EUR 430, 3 m2 ~ EUR 610
// The calibrated mid (of low/high) is the geometric mean of the model's mid and that size reference (weight 0.5, chosen by
// leave-one-out on the calibration split only); the model's own range width is kept.
// Tested and NOT used (they did not improve the leave-one-out error on the calibration split; the model already reads
// them from the text): period vs style, gilt vs painted, stucco, crest/fronton, parcloses, replaced vs original glass.
// They are still parsed and reported so the reasoning can say what was seen.
// Data and scripts: antique-hunter-benchmark/mirror_calib/ (reference_mirrors.json, lots_mirrors.json, fit2.py).
import { convertApprox } from './budget';

export const MIRROR_REF = { intercept: 5.4653, areaExp: 0.8688, modelWeight: 0.5, minAreaM2: 0.15, maxAreaM2: 4, maxShift: 3 } as const;

export interface MirrorDims { heightCm: number; widthCm: number | null }
export interface MirrorFeatures {
  dims: MirrorDims | null;
  areaM2: number | null;
  areaEstimated: boolean;
  period: boolean; style: boolean; gilt: boolean; painted: boolean; stucco: boolean; carved: boolean;
  crest: boolean; parcloses: boolean; trumeau: boolean; glass: 'original' | 'replaced' | null;
}

const num = (s: string) => Number(s.replace(',', '.'));
const okCm = (h: number) => h >= 25 && h <= 400;

/** Height x width in cm from a catalogue line or the buyer's words ("1.7 m x 1.2 m", "H. 168 L. 124 cm", "107cm w x 149cm t",
 *  "164 x 91cm", "Haut. 60 cm", "60 x 40 in"). The first number of "A x B cm" is taken as the height (French catalogue use). */
export const parseDimensionsCm = (text: string): MirrorDims | null => {
  const t = ` ${String(text || '')} `.replace(/×/g, 'x').replace(/(\d),(\d)/g, '$1.$2');
  const N = '(\\d{2,3}(?:\\.\\d+)?)';
  const ret = (h: number, w: number | null) => okCm(h) ? { heightCm: Math.round(h), widthCm: w && w >= 15 && w <= 400 ? Math.round(w) : null } : null;
  let m = t.match(/(\d(?:\.\d+)?)\s*m(?:ètres?|etres?)?\s*x\s*(\d(?:\.\d+)?)\s*m\b/i);
  if (m) return ret(num(m[1]) * 100, num(m[2]) * 100);
  m = t.match(new RegExp(`${N}\\s*(?:in\\b|inches|")?\\s*(?:h(?:igh)?\\b)?\\s*x\\s*${N}\\s*(?:in\\b|inches|")`, 'i'));
  if (m) return ret(num(m[1]) * 2.54, num(m[2]) * 2.54);
  m = t.match(new RegExp(`${N}\\s*cm\\s*(?:w|wide)\\b\\s*x\\s*${N}\\s*cm\\s*(?:h|high|t|tall)\\b`, 'i'));
  if (m) return ret(num(m[2]), num(m[1]));
  const hh = t.match(new RegExp(`${N}\\s*cm\\s*(?:high|tall|h\\b)`, 'i')), ww = t.match(new RegExp(`${N}\\s*cm\\s*(?:wide|w\\b)`, 'i'));
  if (hh) return ret(num(hh[1]), ww ? num(ww[1]) : null);
  m = t.match(new RegExp(`\\b(?:H|Haut|Hauteur|Height)\\.?\\s*[_:.]?\\s*:?\\s*${N}\\s*(?:cm)?[^0-9]{0,25}?\\b(?:L|l|W|Larg|Largeur|Width)\\.?\\s*[_:.]?\\s*:?\\s*${N}`));
  if (m) return ret(num(m[1]), num(m[2]));
  m = t.match(new RegExp(`${N}\\s*(?:cm)?\\s*x\\s*${N}\\s*cm`, 'i'));
  if (m) return ret(num(m[1]), num(m[2]));
  m = t.match(new RegExp(`\\b(?:H|Haut|Hauteur|Height)\\.?\\s*[_:.]?\\s*:?\\s*${N}\\s*cm`, 'i'));
  if (m) return ret(num(m[1]), null);
  const lone = [...t.matchAll(new RegExp(`${N}\\s*cm\\b`, 'gi'))];
  if (lone.length === 1) return ret(num(lone[0][1]), null);
  return null;
};

export const mirrorFeatures = (text: string): MirrorFeatures => {
  const s = String(text || '').toLowerCase();
  const dims = parseDimensionsCm(text);
  const areaEstimated = !!dims && !dims.widthCm;
  const areaM2 = dims ? (dims.heightCm * (dims.widthCm || dims.heightCm * 0.65)) / 1e4 : null;
  const period = /[ée]poque (louis|r[ée]gence|xviii|napol|restauration|empire|louis-philippe)|d'[ée]poque|xviii(e|ème|°)? si[eè]cle|18th[- ]century|\bperiod\b/.test(s) && !/\bde style|\bstyle (louis|r[ée]gence)/.test(s);
  return {
    dims, areaM2, areaEstimated, period, style: /\bstyle\b/.test(s) && !period,
    gilt: /dor[ée]|gilt|dorure|gold/.test(s), painted: /peint|laqu|painted|rechamp|cream|cr[eè]me/.test(s), stucco: /stuc|p[âa]te|composition|gesso/.test(s),
    carved: /sculpt|carved|ajour/.test(s), crest: /fronton|crest|pediment/.test(s), parcloses: /par[e]?-?closes?|marginal/.test(s),
    trumeau: /trumeau|overmantel|haut de chemin/.test(s),
    glass: /rapport[ée]e?|remplac[ée]e?|replaced|new glass/.test(s) ? 'replaced' : /mercure|mercury|glace d'origine|original (mercury )?glass|glass (is )?original/.test(s) ? 'original' : null,
  };
};

/** Size reference (EUR hammer) for a mirror of that frame area */
export const mirrorSizeReferenceEur = (areaM2: number) => {
  const a = Math.min(MIRROR_REF.maxAreaM2, Math.max(MIRROR_REF.minAreaM2, areaM2));
  return Math.exp(MIRROR_REF.intercept + MIRROR_REF.areaExp * Math.log(a));
};

export interface MirrorCalibration {
  applied: boolean;
  reason: 'no_size' | 'calibrated';
  features: MirrorFeatures;
  reference_eur?: number;
  factor?: number;
  low?: number; high?: number; fair_low?: number; fair_high?: number;
}

const nice = (x: number) => x >= 1000 ? Math.round(x / 50) * 50 : x >= 100 ? Math.round(x / 10) * 10 : Math.max(5, Math.round(x / 5) * 5);

/** Moves the model's market range (and its retail tier, by the same factor) towards the size reference; the width is kept. */
export const calibrateMirrorRange = (r: { low: number; high: number; fairLow?: number; fairHigh?: number }, text: string, currency: string): MirrorCalibration => {
  const features = mirrorFeatures(text);
  if (!features.areaM2 || !(r.low > 0) || !(r.high >= r.low)) return { applied: false, reason: 'no_size', features };
  const refEur = mirrorSizeReferenceEur(features.areaM2);
  const ref = convertApprox(refEur, 'EUR', currency) ?? refEur;
  const mid = (r.low + r.high) / 2;
  const w = MIRROR_REF.modelWeight;
  const target = Math.exp(w * Math.log(mid) + (1 - w) * Math.log(ref));
  const factor = Math.min(MIRROR_REF.maxShift, Math.max(1 / MIRROR_REF.maxShift, target / mid));
  const low = nice(r.low * factor), high = Math.max(low, nice(r.high * factor));
  const fair_low = Math.max(low, nice((r.fairLow || r.low * 1.5) * factor));
  const fair_high = Math.max(fair_low, high, nice((r.fairHigh || r.high * 2) * factor));
  return { applied: true, reason: 'calibrated', features, reference_eur: Math.round(refEur), factor: Math.round(factor * 100) / 100, low, high, fair_low, fair_high };
};
