// Cheap-piece calibration (shared, pure; figures computed here, never by the model).
// Rebuilt from the ideas in old PRs #25 (unsupported claims / style and cheap-material wording) and #27 (thin evidence),
// on today's engine. Factors are carried over from those PRs unchanged; they were NOT re-tuned on the sealed set.
//  1. "Style" wording with no period claim ("dans le style Louis XVI", "Louis XV style"): the piece is a later copy,
//     the band is lowered ×0.8 (text and photo runs: the words come from the description).
//  2. Cheap-material wording in a text-only run (stucco, gilded paste, resin, metal with crystal drops, spelter,
//     plaster): ×0.6. With photos the model sees the material, so the rule is off.
//  3. Thin evidence (period not confirmed, low / very low confidence, no stamp, no verified comparables): the low end
//     is opened to high / 5, because nothing supports a floor that high. The high (walk-away) is not touched by this
//     step, so a good piece is never pushed below what it can fetch only because the evidence is thin.
// Never runs on comparables-anchored ranges or on a checklist re-run (its base is already set).

export const STYLE_FACTOR = 0.8;
export const CHEAP_MATERIAL_FACTOR = 0.6;
export const THIN_LOW_RATIO = 5;

const PERIOD_RE = /(d'?\s?[ée]poque|\bperiod\b|\bp[ée]riode\b|\b1[6-9]th[\s-]century\b|\bxviii\w*\b|\b1700-tal\w*)/i;
const STYLE_RE = /(\bde\s+style\b|\bdans\s+le\s+style\b|\bin\s+the\s+style\b|\bstyle\s+(louis|empire|rocaille|r[ée]gence|napol[ée]on|george|gustav\w*|directoire|restauration|dauphinois|transition|renaissance)|\b(louis\s+x[vi]+|empire|r[ée]gence|george\s+i+|gustavian|rococo|regency)[\s-]style\b|\b\w+stil\b|\bstil\b)/i;
const CHEAP_RE = /(\bstuc\w*|\bstucco\b|\bp[âa]te\s+dor[ée]e\b|\bgilded\s+paste\b|\br[ée]sine\b|\bresin\b|\bpampilles\b|\bspelter\b|\br[ée]gule\b|\bpl[âa]tre\b|\bplaster\b)/i;
const STAMPED = ['stamped_confirmed', 'stamped_stated', 'stamp_in_photo'];

export interface CalibrationInput {
  low: number; high: number; hasPhotos: boolean;
  /** the buyer's text (description / catalogue entry) */
  text: string;
  periodCertainty?: string; confidence?: string; makerStatus?: string | null; compsAnchored?: boolean;
}
export interface Calibration { low: number; high: number; factor: number; factors: string[] }

const r = (x: number) => x >= 1000 ? Math.round(x / 50) * 50 : x >= 100 ? Math.round(x / 10) * 10 : Math.max(0, Math.round(x / 5) * 5);

export const isThinEvidence = (i: CalibrationInput): boolean =>
  !i.compsAnchored && i.periodCertainty !== 'confirmed_period' && (i.confidence === 'low' || i.confidence === 'very_low')
  && !STAMPED.includes(String(i.makerStatus || ''));

export const calibrateRange = (i: CalibrationInput): Calibration => {
  let low = Math.max(0, Number(i.low) || 0), high = Math.max(low, Number(i.high) || 0);
  const factors: string[] = [];
  if (!(high > 0) || i.compsAnchored || STAMPED.includes(String(i.makerStatus || ''))) return { low, high, factor: 1, factors };
  const t = String(i.text || '');
  let f = 1;
  if (STYLE_RE.test(t) && !PERIOD_RE.test(t)) { f *= STYLE_FACTOR; factors.push('style_wording'); }
  if (!i.hasPhotos && CHEAP_RE.test(t)) { f *= CHEAP_MATERIAL_FACTOR; factors.push('cheap_material'); }
  low *= f; high *= f;
  if (isThinEvidence(i) && low > high / THIN_LOW_RATIO) { low = high / THIN_LOW_RATIO; factors.push('thin_evidence_low'); }
  if (!factors.length) return { low: i.low, high: i.high, factor: 1, factors };
  return { low: r(low), high: Math.max(r(low), r(high)), factor: f, factors };
};
