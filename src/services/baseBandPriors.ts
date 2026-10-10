// Base-band priors when comps do not anchor: style-vs-period discount, condition grading,
// and category priors (lighting). Pure; never tunes to a single lot. Applied before buildValuation.

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
  /** True when verified comps already anchored the range — priors become soft notes only. */
  compsAnchored?: boolean;
}

export interface BandPriorResult {
  low: number;
  high: number;
  factors: string[];
  styleDiscount: number;      // 1 = none
  conditionDiscount: number;  // 1 = none
  categoryCapApplied: boolean;
}

const roundBand = (x: number): number =>
  x >= 10000 ? Math.round(x / 500) * 500 : x >= 1000 ? Math.round(x / 50) * 50 : Math.round(x / 10) * 10;

/** Detect "style X" / "de style X" without époque/period claim. */
export const isStyleNotPeriod = (periodCertainty?: string, styleNote?: string | null, text?: string): boolean => {
  // Confirmed / probable period from construction or catalogue wins over wording.
  if (periodCertainty === 'confirmed_period' || periodCertainty === 'probable_period') return false;
  if (periodCertainty === 'later_style_or_revival') return true;
  if (styleNote && String(styleNote).trim()) return true;
  const t = String(text || '');
  // Prefer explicit "de style X" / "in the style of" — avoid matching "Empire-Style" compounds alone.
  const styleClaim = /\bde\s+style\b|\bin\s+the\s+style\s+of\b|\bstyle\s+(?:of\s+)?(?:Louis|Charles|Empire|Restoration|Restauration|Directoire|Régence|Regence|Napoleon|Napoléon|Art\s*Deco|Art\s*Nouveau|Queen\s*Anne|Georgian|Victorian)\b/i.test(t);
  const periodClaim = /\b[ée]poque\b|\bperiod\b|\bfin\s+(xvii|xviii|xix|17|18|19)/i.test(t);
  return styleClaim && !periodClaim;
};

/** Condition discount from graded defects + catalogue condition words in the text. */
export const conditionDiscountOf = (defects?: Array<{ severity: string }>, text?: string): { factor: number; note: string | null } => {
  let worst = 0; // 0 ok … 3 structural
  for (const d of defects || []) {
    const s = String(d.severity || '');
    if (s === 'structural') worst = Math.max(worst, 3);
    else if (s === 'major') worst = Math.max(worst, 2);
    else if (s === 'moderate') worst = Math.max(worst, 1);
  }
  const t = String(text || '').toLowerCase();
  // Catalogue shorthand common at French provincial sales
  if (/\b(fendu|cassé|broken|structural)\b/.test(t)) worst = Math.max(worst, 3);
  else if (/\b(accidents?\s+et\s+manques?|manques?\s+importants?|heavy\s+damage|severe)\b/.test(t)) worst = Math.max(worst, 2);
  else if (/\b(fentes?|soul[èe]vements?|accidents?|manques?|restor[ée]e?s?|restored|chips?|cracks?)\b/.test(t)) worst = Math.max(worst, 1);
  const map: Record<number, { factor: number; note: string | null }> = {
    0: { factor: 1, note: null },
    1: { factor: 0.85, note: 'condition_moderate' },
    2: { factor: 0.65, note: 'condition_major' },
    3: { factor: 0.45, note: 'condition_structural' },
  };
  return map[worst];
};

/**
 * Soft category prior caps (auction hammer, unsigned / provincial, decent condition).
 * Used only to pull an unanchored model high down when it wildly exceeds the prior.
 * Not a floor — never inflate a low model range.
 */
export const CATEGORY_PRIOR_HIGH_EUR: Record<string, number> = {
  chandelier_lighting: 450,
  lighting: 450,
  lamp: 350,
  mirrors: 600,
  mirror: 600,
  decorative_object: 400,
};

export const categoryPriorHigh = (category?: string): number | null => {
  const k = String(category || '').toLowerCase().replace(/[\s/&-]+/g, '_');
  if (CATEGORY_PRIOR_HIGH_EUR[k] != null) return CATEGORY_PRIOR_HIGH_EUR[k];
  if (/chandelier|lustre|lighting|lampe|appliques?/.test(k)) return CATEGORY_PRIOR_HIGH_EUR.chandelier_lighting;
  if (/mirror|miroir/.test(k)) return CATEGORY_PRIOR_HIGH_EUR.mirrors;
  return null;
};

export const applyBaseBandPriors = (i: BandPriorInput): BandPriorResult => {
  let low = Math.max(0, Number(i.marketLow) || 0);
  let high = Math.max(low, Number(i.marketHigh) || low);
  const factors: string[] = [];
  let styleDiscount = 1;
  let conditionDiscount = 1;
  let categoryCapApplied = false;

  if (i.compsAnchored) {
    // Comps already set the band; only record soft notes for UI, do not move numbers.
    if (isStyleNotPeriod(i.periodCertainty, i.styleNote, `${i.query || ''} ${i.title || ''}`)) factors.push('style_not_period_note');
    const cond = conditionDiscountOf(i.defects, `${i.query || ''} ${i.title || ''}`);
    if (cond.note) factors.push(cond.note + '_note');
    return { low: roundBand(low), high: roundBand(high), factors, styleDiscount: 1, conditionDiscount: 1, categoryCapApplied: false };
  }

  const text = `${i.query || ''} ${i.title || ''}`;
  if (isStyleNotPeriod(i.periodCertainty, i.styleNote, text)) {
    // Style / revival pieces typically trade well below period equivalents at provincial auction.
    styleDiscount = 0.55;
    factors.push('style_vs_period_discount');
  }

  const cond = conditionDiscountOf(i.defects, text);
  conditionDiscount = cond.factor;
  if (cond.note) factors.push(cond.note);

  const factor = styleDiscount * conditionDiscount;
  if (factor < 1) {
    // Pull the high down; keep low from collapsing below a useful floor of ~40% of original low.
    high = Math.max(low * 0.5, high * factor);
    low = Math.max(10, low * Math.max(0.4, factor));
    if (low > high) low = high * 0.6;
  }

  const prior = categoryPriorHigh(i.category) ?? categoryPriorHigh(text);
  if (prior != null && high > prior * 1.25) {
    // Model high wildly above category prior with no comps → cap toward prior (keep some headroom).
    high = Math.min(high, prior * 1.15);
    if (low > high) low = Math.max(20, high * 0.4);
    categoryCapApplied = true;
    factors.push('category_prior_cap');
  }

  return {
    low: roundBand(low),
    high: roundBand(Math.max(low, high)),
    factors,
    styleDiscount,
    conditionDiscount,
    categoryCapApplied,
  };
};
