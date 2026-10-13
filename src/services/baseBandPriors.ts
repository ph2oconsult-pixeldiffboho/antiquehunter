// Base-band priors when comps do not anchor: evidence-graded style/condition discounts,
// category soft caps, and width calibration to typical residual spreads. Pure; not lot-tuned.

export type PeriodCertainty = 'confirmed_period' | 'probable_period' | 'ambiguous' | 'later_style_or_revival' | string;

export interface BandPriorInput {
  marketLow: number;
  marketHigh: number;
  category?: string;
  periodCertainty?: PeriodCertainty;
  styleNote?: string | null;
  title?: string;
  query?: string;
  defects?: Array<{ severity: string }>;
  /** Evidence ledger claims (catalogue wording). */
  claims?: string[];
  compsAnchored?: boolean;
  /**
   * Is a 'later style / revival' verdict backed by real evidence? (catalogue or user says "de style" / copy /
   * reproduction, or a modern construction cue). false = the verdict rests on appearance only → hypothesis.
   * undefined = legacy behaviour (treated as evidenced).
   */
  styleEvidence?: boolean;
  /**
   * Text-only run: the model already read the condition wording in the description, so the regex condition
   * discount on that same text is not applied again (only graded major/structural defects count).
   */
  textOnly?: boolean;
}

export interface BandPriorResult {
  low: number;
  high: number;
  factors: string[];
  styleDiscount: number;
  conditionDiscount: number;
  categoryCapApplied: boolean;
  widthCalibrated: boolean;
}

const roundBand = (x: number): number =>
  x >= 10000 ? Math.round(x / 500) * 500 : x >= 1000 ? Math.round(x / 50) * 50 : Math.round(x / 10) * 10;

/** Detect "style X" / "de style X" without époque/period claim. */
export const isStyleNotPeriod = (periodCertainty?: string, styleNote?: string | null, text?: string): boolean => {
  if (periodCertainty === 'confirmed_period' || periodCertainty === 'probable_period') return false;
  if (periodCertainty === 'later_style_or_revival') return true;
  if (styleNote && String(styleNote).trim()) return true;
  const t = String(text || '');
  const styleClaim = /\bde\s+style\b|\bin\s+the\s+style\s+of\b|\bstyle\s+(?:of\s+)?(?:Louis|Charles|Empire|Restoration|Restauration|Directoire|Régence|Regence|Napoleon|Napoléon|Art\s*Deco|Art\s*Nouveau|Queen\s*Anne|Georgian|Victorian)\b/i.test(t);
  const periodClaim = /\b[ée]poque\b|\bperiod\b|\bfin\s+(xvii|xviii|xix|17|18|19)/i.test(t);
  return styleClaim && !periodClaim;
};

/**
 * Evidence-graded style discount (multiplies the HIGH; low is pulled more gently).
 * - Strong: catalogue "de style X" / later_style_or_revival with no period claim → 0.70
 * - Soft: style_note only or ambiguous wording → 0.85
 * - None: confirmed/probable period → 1
 */
export const styleDiscountOf = (
  periodCertainty?: string, styleNote?: string | null, text?: string, claims?: string[],
): { factor: number; note: string | null } => {
  if (periodCertainty === 'confirmed_period' || periodCertainty === 'probable_period') {
    return { factor: 1, note: null };
  }
  const blob = `${text || ''} ${(claims || []).join(' ')}`;
  // A technique word ("Boulle-style marquetry", "Savonnerie-style") next to an explicit period claim
  // ("Napoleon III period", "18th century", "époque") is not a style-not-period statement.
  const periodClaim = /\b[ée]poque\b|\bperiod\b|\b(1[6-9]th|xvii|xviii|xix)e?\s*(century|si[èe]cle|s\.)|\b(xvii|xviii|xix)e\b/i.test(blob);
  if (periodCertainty !== 'later_style_or_revival' && periodClaim && !/\bde\s+style\b|\bin\s+the\s+style\s+of\b/i.test(blob)) {
    return { factor: 1, note: null };
  }
  const strongStyle = periodCertainty === 'later_style_or_revival'
    || /\bde\s+style\b|\bin\s+the\s+style\s+of\b/i.test(blob);
  const softStyle = !!(styleNote && String(styleNote).trim())
    || (periodCertainty === 'ambiguous' && /\bstyle\b/i.test(blob));
  if (strongStyle) return { factor: 0.70, note: 'style_strong' };
  if (softStyle) return { factor: 0.85, note: 'style_soft' };
  return { factor: 1, note: null };
};

const STYLE_WORDS_RE = /\b(de\s+style|dans\s+le\s+(gout|go[uû]t|style)|in\s+the\s+style\s+of|style\s+(louis|charles|empire|restauration|restoration|directoire|regence|régence|napol|transition|gustavian|georgian|regency|victorian|queen|henri|renaissance)|[a-z]+[\s-]+style\b|revival|reproduction|repro\b|copie|copy|later\s+(copy|version|made)|fac[\s-]?simile|xxe|20th[\s-]+century|vingtieme|modern)/i;
const MODERN_CONSTRUCTION_RE = /\b(plywood|contreplaqu\w*|contre-plaqu\w*|mdf|particle\s?board|chipboard|agglom\w*|staples?|agrafes?|phillips|cross-head|machine[\s-]+(cut\s+)?dovetails?|machine[\s-]+made|wire\s+nails?|modern\s+screws?|vis\s+modernes?|aggloméré|isorel|hardboard|formica|polyurethane)\b/i;

/**
 * Evidence for a later-style / revival verdict that does not come from the look of the piece: the catalogue or the
 * user's own words, or a modern construction cue actually reported. The model's own style label is NOT evidence.
 */
export const styleEvidenceOf = (i: { userOrCatalogueText?: string; constructionEvidence?: string }): boolean => {
  if (STYLE_WORDS_RE.test(String(i.userOrCatalogueText || ''))) return true;
  const ce = String(i.constructionEvidence || '');
  if (/^\s*(none(\s+shown)?|n\/a|-)?\s*$/i.test(ce)) return false;
  return MODERN_CONSTRUCTION_RE.test(ce) && !/\b(no|without|not|aucun\w*|sans)\s+(\w+\s+){0,3}(plywood|mdf|staples|phillips|machine|wire|modern)/i.test(ce);
};

/** Condition discount — evidence-graded; structural hits the high harder than the low. */
export const conditionDiscountOf = (defects?: Array<{ severity: string }>, text?: string): { factorHigh: number; factorLow: number; note: string | null } => {
  let worst = 0;
  for (const d of defects || []) {
    const s = String(d.severity || '');
    if (s === 'structural') worst = Math.max(worst, 3);
    else if (s === 'major') worst = Math.max(worst, 2);
    else if (s === 'moderate') worst = Math.max(worst, 1);
  }
  const t = String(text || '').toLowerCase();
  if (/\b(fendu|cassé|broken|structural)\b/.test(t)) worst = Math.max(worst, 3);
  else if (/\b(accidents?\s+et\s+manques?|manques?\s+importants?|heavy\s+damage|severe)\b/.test(t)) worst = Math.max(worst, 2);
  else if (/\b(fentes?|soul[èe]vements?|accidents?|manques?|restor[ée]e?s?|restored|chips?|cracks?)\b/.test(t)) worst = Math.max(worst, 1);
  const map: Record<number, { factorHigh: number; factorLow: number; note: string | null }> = {
    0: { factorHigh: 1, factorLow: 1, note: null },
    1: { factorHigh: 0.90, factorLow: 0.95, note: 'condition_moderate' },
    2: { factorHigh: 0.75, factorLow: 0.85, note: 'condition_major' },
    3: { factorHigh: 0.55, factorLow: 0.70, note: 'condition_structural' },
  };
  return map[worst];
};

/** Soft category prior caps (unsigned / provincial auction hammer). */
export const CATEGORY_PRIOR_HIGH_EUR: Record<string, number> = {
  chandelier_lighting: 550,
  lighting: 550,
  lamp: 400,
  mirrors: 700,
  mirror: 700,
  decorative_object: 500,
};

export const categoryPriorHigh = (category?: string): number | null => {
  const k = String(category || '').toLowerCase().replace(/[\s/&-]+/g, '_');
  if (CATEGORY_PRIOR_HIGH_EUR[k] != null) return CATEGORY_PRIOR_HIGH_EUR[k];
  if (/chandelier|lustre|lighting|lampe|appliques?/.test(k)) return CATEGORY_PRIOR_HIGH_EUR.chandelier_lighting;
  if (/mirror|miroir/.test(k)) return CATEGORY_PRIOR_HIGH_EUR.mirrors;
  return null;
};

/**
 * Target high/low width ratios by mid-band (honest residual spreads for text-only provincial
 * appraisals). Expand a too-narrow band around its mid; never shrink below the discounted range.
 */
export const TARGET_WIDTH_BY_MID: Array<{ maxMid: number; ratio: number }> = [
  { maxMid: 300, ratio: 2.8 },
  { maxMid: 1000, ratio: 2.4 },
  { maxMid: 5000, ratio: 2.2 },
  { maxMid: Infinity, ratio: 2.0 },
];

export const targetWidthRatio = (mid: number): number => {
  for (const b of TARGET_WIDTH_BY_MID) if (mid <= b.maxMid) return b.ratio;
  return 2.0;
};

export const calibrateWidth = (low: number, high: number): { low: number; high: number; calibrated: boolean } => {
  if (!(low > 0 && high >= low)) return { low, high, calibrated: false };
  const mid = (low + high) / 2;
  const target = targetWidthRatio(mid);
  const current = high / low;
  if (current >= target * 0.95) return { low, high, calibrated: false };
  // Expand symmetrically in log-space around mid
  const half = Math.sqrt(target);
  let nLo = mid / half;
  let nHi = mid * half;
  // Never raise the high above a previously discounted high by more than the expand;
  // never drop the low below a floor of 40% of original low after discount.
  nLo = Math.min(low, nLo);
  nHi = Math.max(high, nHi);
  // If still too narrow (e.g. low was already tiny), force the ratio on the high side
  if (nHi / nLo < target) nHi = nLo * target;
  return { low: nLo, high: nHi, calibrated: true };
};

export const applyBaseBandPriors = (i: BandPriorInput): BandPriorResult => {
  let low = Math.max(0, Number(i.marketLow) || 0);
  let high = Math.max(low, Number(i.marketHigh) || low);
  const factors: string[] = [];
  let styleDiscount = 1;
  let conditionDiscount = 1;
  let categoryCapApplied = false;
  let widthCalibrated = false;

  if (i.compsAnchored) {
    if (isStyleNotPeriod(i.periodCertainty, i.styleNote, `${i.query || ''} ${i.title || ''}`)) factors.push('style_not_period_note');
    const cond = conditionDiscountOf(i.defects, `${i.query || ''} ${i.title || ''}`);
    if (cond.note) factors.push(cond.note + '_note');
    return { low: roundBand(low), high: roundBand(high), factors, styleDiscount: 1, conditionDiscount: 1, categoryCapApplied: false, widthCalibrated: false };
  }

  const text = `${i.query || ''} ${i.title || ''}`;
  const style = styleDiscountOf(i.periodCertainty, i.styleNote, text, i.claims);
  styleDiscount = style.factor;
  // Fix: a later-style / revival call from appearance alone is a hypothesis, not a fact. Keep the period-piece upper
  // bound (no discount on the high) and widen the range downward by the style factor instead.
  let styleHypothesis = false;
  if (i.styleEvidence === false && i.periodCertainty === 'later_style_or_revival' && styleDiscount < 1) {
    styleHypothesis = true;
    factors.push('style_hypothesis_widened_down');
    low = Math.max(10, low * 0.55);
    styleDiscount = 1;
  } else if (style.note) factors.push(style.note);

  const cond = i.textOnly
    ? conditionDiscountOf((i.defects || []).filter(d => ['major', 'structural'].includes(String(d.severity || ''))), '')
    : conditionDiscountOf(i.defects, text);
  conditionDiscount = cond.factorHigh;
  if (cond.note) factors.push(cond.note);

  if (styleDiscount < 1 || cond.factorHigh < 1) {
    high = Math.max(low * 0.6, high * styleDiscount * cond.factorHigh);
    low = Math.max(10, low * Math.max(0.55, styleDiscount * cond.factorLow));
    if (low > high) low = high * 0.55;
  }

  const prior = categoryPriorHigh(i.category) ?? categoryPriorHigh(text);
  if (prior != null && high > prior * 1.35) {
    high = Math.min(high, prior * 1.2);
    if (low > high) low = Math.max(20, high * 0.45);
    categoryCapApplied = true;
    factors.push('category_prior_cap');
  }

  if (styleHypothesis && low > 0 && high / low < 3) low = high / 3;
  const cal = calibrateWidth(low, high);
  low = cal.low; high = cal.high; widthCalibrated = cal.calibrated;
  if (widthCalibrated) factors.push('width_calibrated');

  return {
    low: roundBand(low),
    high: roundBand(Math.max(low, high)),
    factors,
    styleDiscount,
    conditionDiscount,
    categoryCapApplied,
    widthCalibrated,
  };
};
