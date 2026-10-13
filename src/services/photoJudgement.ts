// Photo judgement guards (engine; pure, not lot-tuned).
// 1. A stamp or maker read from a photo is a claim, not proof of period: without period construction evidence it
//    cannot by itself mean "confirmed period" or carry the full stamped price.
// 2. Signs of later additions (marble, bronzes), marriages or pieces composed of parts are discounted when the
//    model still called the piece period.
// 3. A "later copy / revival" verdict from the look of the piece alone is a hypothesis: the range is widened both
//    ways (more so when period construction or veneer signs were seen), never cut steeply.

export interface PhotoJudgementInput {
  hasPhotos: boolean;
  /** The buyer's own words / catalogue text (stamp named here = stated, not read from a photo). */
  userText: string;
  periodCertainty?: string;
  /** Maker status as reported by the model ('stamp_visible_in_photo' etc.). */
  modelMakerStatus?: string;
  /** Combined maker status after makers.ts (null when the maker is not in the known list). */
  makerStatus?: string | null;
  constructionEvidence?: string;
  /** Model prose that may mention additions / marriages (title, condition, reasoning, ledger). */
  modelText: string;
  /** Is a later-style verdict backed by catalogue / user words or a modern construction cue? */
  styleEvidence: boolean;
  low: number;
  high: number;
}

export interface PhotoJudgementResult {
  low: number;
  high: number;
  periodCertainty?: string;
  /** Upper bound for the calibrated confidence score (100 = no cap). */
  confidenceCap: number;
  factors: string[];
  notes: string[];
}

const PERIOD_CONSTRUCTION_RE = /\b(hand[\s-]?cut|hand[\s-]?sawn|hand[\s-]?planed|hand[\s-]?made\s+(nails?|screws?)|pegged|chevill\w*|queue[s]?\s+d'aronde\s+(irr[ée]guli|main)|irregular\s+dovetails?|wide\s+dovetails?|forged\s+nails?|hand[\s-]?forged|oxidi[sz]ed|old\s+oxidation|saw[\s-]?cut\s+veneer|thick\s+veneer|period\s+(construction|joinery|secondary)|scie\s+[àa]\s+main|tool\s+marks?|scrub[\s-]?plane|gesso|mortise[\s-]+and[\s-]+tenon|oak\s+(carcass|secondary)|pine\s+(carcass|secondary|backboards?))\b/i;
const NEGATED_PERIOD_RE = /\b(no|without|not|lacks?|absence\s+of)\s+(\w+\s+){0,3}(hand[\s-]?cut|pegged|period|oxidi[sz]ed|gesso|thick\s+veneer)/i;
const ADDITIONS_RE = /\b(later\s+(marble|top|mounts?|bronzes?|ormolu|gilt[\s-]?bronzes?|additions?|added|elements?)|(marble|top|mounts?|bronzes?|ornamentation|ormolu)\s+(added|replaced|of\s+a\s+later\s+date)\s*(later)?|added\s+later|ajout\w*\s+(post[ée]rieur\w*|plus\s+tard)|rapport[ée]e?s?\s+post[ée]rieur\w*|post[ée]rieur\w*|marriage|married|mari[ée]|composed\s+of\s+(period\s+)?(components|elements|parts)|made\s+up\s+(of|from)|assembled\s+from|compos[ée]e?\s+d'[ée]l[ée]ments|constitu[ée]e?\s+d'[ée]l[ée]ments|period\s+(components|elements|parts)|r[ée]assembl\w*|re-?assembled)\b/i;
const NEGATED_ADD_RE = /\b(no|not|without|aucun\w*|sans)\s+(\w+\s+){0,3}(marriage|later\s+additions?|added|replaced|assembled)/i;

const r = (x: number) => x >= 10000 ? Math.round(x / 500) * 500 : x >= 1000 ? Math.round(x / 50) * 50 : Math.round(x / 10) * 10;

export const hasPeriodConstruction = (ce?: string): boolean => {
  const s = String(ce || '');
  return PERIOD_CONSTRUCTION_RE.test(s) && !NEGATED_PERIOD_RE.test(s);
};

export const hasAdditionsCue = (text: string): boolean => ADDITIONS_RE.test(text) && !NEGATED_ADD_RE.test(text);

const STAMP_IN_TEXT_RE = /\b(stamped|stamp|estampill\w*|estampille|sign[ée]e?|signed|marked|bears?\s+a\s+\w*\s*mark|porte\s+(une\s+)?(estampille|marque)|jme)\b/i;

export const applyPhotoJudgement = (i: PhotoJudgementInput): PhotoJudgementResult => {
  let low = Math.max(0, Number(i.low) || 0);
  let high = Math.max(low, Number(i.high) || low);
  let pc = i.periodCertainty;
  let confidenceCap = 100;
  const factors: string[] = [];
  const notes: string[] = [];
  if (!(high > 0)) return { low, high, periodCertainty: pc, confidenceCap, factors, notes };
  const periodBuilt = hasPeriodConstruction(i.constructionEvidence);

  // 1. Stamp / maker read from a photo only (the buyer's text did not state it)
  const photoStamp = i.hasPhotos && !STAMP_IN_TEXT_RE.test(i.userText)
    && (i.modelMakerStatus === 'stamp_visible_in_photo' || i.makerStatus === 'stamp_in_photo');
  if (photoStamp && !periodBuilt) {
    if (pc === 'confirmed_period') { pc = 'probable_period'; factors.push('photo_stamp_period_capped'); }
    confidenceCap = Math.min(confidenceCap, 60);
    if (pc === 'confirmed_period' || pc === 'probable_period') {
      // The stamped premium is unproven: widen downward to the unstamped level, trim the top.
      low = low * 0.6; high = high * 0.9;
      factors.push('photo_stamp_uplift_capped');
      notes.push('A stamp read from a photo is not proof of period on its own: confidence and the stamped premium are capped until construction (dovetails, secondary woods, back, mounts) is checked and the stamp is confirmed.');
    }
  }

  // 2. Later additions / marriages / composed of parts, while the model still treated it as fully period
  const addText = `${i.modelText} ${i.constructionEvidence || ''} ${i.userText}`;
  if (hasAdditionsCue(addText) && (pc === 'confirmed_period' || (i.hasPhotos && pc === 'probable_period'))) {
    low = low * 0.8; high = high * 0.75;
    if (pc === 'confirmed_period') pc = 'probable_period';
    confidenceCap = Math.min(confidenceCap, 55);
    factors.push('additions_or_marriage_discount');
    notes.push('Signs of later additions (marble, bronzes), a marriage or a piece composed of parts: discounted, since buyers pay much less than for an untouched period piece.');
  }

  // 3. Later-style verdict from appearance only → hypothesis, widened both ways
  if (i.hasPhotos && pc === 'later_style_or_revival' && !i.styleEvidence) {
    const up = periodBuilt ? 2.0 : 1.5;
    high = high * up;
    factors.push(periodBuilt ? 'revival_hypothesis_period_signs_widened_up' : 'revival_hypothesis_widened_up');
    notes.push(periodBuilt
      ? 'The "later copy" reading comes from photos only, yet period construction or veneer signs were seen: kept as a hypothesis, with the upper figure covering a period piece.'
      : 'The "later copy" reading comes from photos only: kept as a hypothesis, so the upper figure also covers the case that it is period.');
  }

  if (low > 0 && high / low > 6) low = high / 6;
  return { low: r(Math.max(10, low)), high: r(Math.max(low, high)), periodCertainty: pc, confidenceCap, factors, notes };
};
