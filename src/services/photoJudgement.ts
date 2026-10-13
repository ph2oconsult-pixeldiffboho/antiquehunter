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
  /** Structured alterations check from the model (item_summary.alterations). */
  alterations?: { later_additions?: string[]; marriage?: string; composed_of_parts?: string; reconstruction?: string } | null;
  low: number;
  high: number;
  /** App/model category (furniture, mirrors, rug_textile, painting_art, chandelier_lighting…) */
  category?: string;
  /** Model's own confidence label (high / medium / low / very_low) */
  confidence?: string;
  /** Model's reproduction_risk flag */
  reproductionRisk?: boolean;
  /** Number of defects the model listed */
  defectCount?: number;
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

/** Top-tier names whose stamp can justify a large multiple (kept short and general). */
const TOP_MAKER_RE = /\b(riesener|oeben|bvrb|van\s+risen\s?burgh|weisweiler|carlin|cressent|roentgen|leleu|dubois|jacob|desmalter|bellang[ée]|hache|delanois|tilliard|foliot|s[ée]n[ée]|gourdin|boulle\s+(andr[ée]|charles)|andr[ée][\s-]+charles\s+boulle|majorelle|gall[ée]|ruhlmann|linke|sormani|zwiener|beurdeley)(?![a-z])/i;
/** Upper level for stamped pieces by recorded, non-top maîtres at regional auction (EUR hammer). */
export const STAMPED_MINOR_HIGH_CAP = 3000;
const FURNITURE_CATS = new Set(['furniture', 'bedroom_furniture', 'chairs', 'mirrors']);
const NON_FURNITURE_RE = /\b(rug|carpet|tapis|tapestry|tapisserie|textile|portiere|porti[èe]re|verdure|aubusson|painting|tableau|oil\s+on|huile|canvas|toile|portrait|landscape|watercolou?r|print|engraving|lamp|lighting|chandelier|lustre|sconce|applique|wall\s+light|candelabr\w*|bronze\s+sculpture|sculpture|statue|vase|porcelain|ceramic|clock|pendule)\b/i;
/** Text runs: an unsupported period / stamp claim, cheap-material wording, explicit "style" wording. */
export const TEXT_THIN_LOW_RATIO = 5;
export const TEXT_CLAIM_HIGH_FACTOR = 0.85;
export const TEXT_CHEAP_FACTOR = 0.6;
export const TEXT_STYLE_FACTOR = 0.8;
const TEXT_PERIOD_RE = /\b(d'?[ée]poque|period|1[6-9]th[\s-]century|xviii|1700-tal)\b/i;
const TEXT_STAMP_RE = /\b(stamp\w*|estampill\w*|jme|sign[ée]e?|signed)\b/i;
const TEXT_CHEAP_RE = /\b(stuc\w*|stucco|p[âa]te\s+dor[ée]e|gilded\s+paste|resin|r[ée]sine|pampilles|crystal\s+drops|m[ée]tal|metal|laiton|brass|plaster|pl[âa]tre|r[ée]gule|spelter|composition)\b/i;
const TEXT_STYLE_RE = /\b(de\s+style|dans\s+le\s+style|in\s+the\s+style|style\s+(louis|empire|rocaille|r[ée]gence|napol|george|gustav)|[a-zé]+[\s-]+style\b|stil)\b/i;
/** Model-signal floor: the model's raw upper figure below which a thinly evidenced piece is widened down to the cheap end. */
export const CHEAP_FLOOR_MAX_HIGH = 1500;

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
    && !['dealer_label', 'doubtful_stamp', 'mentioned'].includes(String(i.makerStatus || ''))
    && !['dealer_label', 'doubtful_stamp'].includes(String(i.modelMakerStatus || ''))
    && (['stamp_visible_in_photo', 'stamped_stated', 'stamped_confirmed'].includes(String(i.modelMakerStatus || ''))
      || ['stamp_in_photo', 'stamped_stated', 'stamped_confirmed'].includes(String(i.makerStatus || ''))
      || STAMP_IN_TEXT_RE.test(String(i.modelText || '').slice(0, 400)));
  if (photoStamp) {
    // The period label may stand on construction evidence, but the price premium never rests on a photo-read
    // stamp alone (the model now asserts construction more readily, which used to bypass this cap).
    if (!periodBuilt && pc === 'confirmed_period') { pc = 'probable_period'; factors.push('photo_stamp_period_capped'); }
    if (!periodBuilt) confidenceCap = Math.min(confidenceCap, 60);
    if (pc === 'confirmed_period' || pc === 'probable_period') {
      // The stamped premium is unproven: widen downward to the unstamped level, trim the top.
      low = low * 0.6; high = high * 0.9;
      factors.push('photo_stamp_uplift_capped');
      notes.push('A stamp read from a photo is not proof of period on its own: confidence and the stamped premium are capped until construction (dovetails, secondary woods, back, mounts) is checked and the stamp is confirmed.');
    }
  }

  // 2. Later additions / marriages / composed of parts, while the model still treated it as fully period
  const addText = `${i.modelText} ${i.constructionEvidence || ''} ${i.userText}`;
  const alt = i.alterations || null;
  const altFlag = !!alt && ((Array.isArray(alt.later_additions) && alt.later_additions.filter(x => String(x || '').trim()).length > 0)
    || ['yes', 'possible'].includes(String(alt.marriage)) || ['yes', 'possible'].includes(String(alt.composed_of_parts))
    || ['yes', 'possible'].includes(String(alt.reconstruction)));
  if ((altFlag || hasAdditionsCue(addText)) && (pc === 'confirmed_period' || (i.hasPhotos && pc === 'probable_period'))) {
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

  // 4. Stamped level: a stamp (read or stated) by a recorded but not top-tier maître does not take a provincial-auction
  //    piece into high four figures. Cap the top at STAMPED_MINOR_HIGH_CAP unless a top maker is named.
  const anyStamp = photoStamp || (STAMP_IN_TEXT_RE.test(i.userText) && /\b(stamp|estampill|jme)/i.test(i.userText));
  const topMaker = TOP_MAKER_RE.test(`${i.userText} ${String(i.modelText || '').slice(0, 600)}`);
  const cat = String(i.category || '').toLowerCase();
  // The picked category can be wrong (a carpet filed under furniture), so the model's title / the user's text naming a
  // non-furniture object also keeps the cap off.
  const namesOther = NON_FURNITURE_RE.test(`${i.userText} ${String(i.modelText || '').slice(0, 120)}`);
  const isFurniture = (FURNITURE_CATS.has(cat) || !cat || cat === 'unknown') && !namesOther;
  if (anyStamp && !topMaker && isFurniture && high > STAMPED_MINOR_HIGH_CAP) {
    high = STAMPED_MINOR_HIGH_CAP;
    low = Math.min(low, high / 3);
    factors.push('stamped_minor_maker_cap');
    notes.push('A stamp by a recorded maker who is not a top name adds a premium, not a multiple: the top of the range is capped at the level such stamped pieces typically make at regional auction.');
  }

  // 5. Model-signal floor. In the dev set the model gives cheap lots and €1k–5k lots the same mid-hundreds raw range, so
  //    the upper figure cannot be cut without losing the €1k–5k hits. Instead, when the model's own signals are thin
  //    (raw upper figure in the hundreds, period not confirmed, no stamp, no period construction, and not high
  //    confidence, or reproduction risk / defects flagged), the low end is opened down to the cheap level.
  const thin = high <= CHEAP_FLOOR_MAX_HIGH && pc !== 'confirmed_period' && !anyStamp && !periodBuilt
    && (i.confidence !== 'high' || i.reproductionRisk === true || (i.defectCount || 0) > 0 || pc === 'later_style_or_revival');
  if (i.hasPhotos && thin && low > high / 6) {
    low = high / 6;
    factors.push('model_signal_cheap_floor');
    notes.push('The model\'s own signals are thin (mid-hundreds estimate, period unconfirmed, no stamp or construction evidence): the lower figure is opened to the level such pieces often make when they turn out later or tired.');
  }

  // 6. Text runs (no photos, so nothing can corroborate a claim). The words "period" or "stamped" in a description
  //    are not evidence on their own: while the model's own signals stay thin (period not confirmed, low confidence),
  //    the claim does not lift the top and the low end is opened to the cheap level. Cheap-material wording (stucco,
  //    gilded paste, metal, resin, crystal drops) and explicit "style" wording without a period claim lower the band.
  //    Never uses an auction estimate (app users do not have one).
  if (!i.hasPhotos) {
    const t = String(i.userText || '');
    const thinText = pc !== 'confirmed_period' && (i.confidence === 'low' || i.confidence === 'very_low');
    if (thinText && (TEXT_PERIOD_RE.test(t) || TEXT_STAMP_RE.test(t)) && !topMaker) {
      high = Math.max(low * 1.5, high * TEXT_CLAIM_HIGH_FACTOR);
      factors.push('text_claim_unsupported_high_tempered');
      notes.push('The period or stamp claim comes from the description only, with no photo showing construction or the mark: it is not allowed to lift the upper figure on its own.');
    }
    if (thinText && low > high / TEXT_THIN_LOW_RATIO) {
      low = high / TEXT_THIN_LOW_RATIO;
      factors.push('text_thin_low_opened');
    }
    if (TEXT_CHEAP_RE.test(t)) { low *= TEXT_CHEAP_FACTOR; high *= TEXT_CHEAP_FACTOR; factors.push('text_cheap_material'); }
    if (TEXT_STYLE_RE.test(t) && !TEXT_PERIOD_RE.test(t)) { low *= TEXT_STYLE_FACTOR; high *= TEXT_STYLE_FACTOR; factors.push('text_style_wording'); }
  }

  if (low > 0 && high / low > 6) low = high / 6;
  return { low: r(Math.max(10, low)), high: r(Math.max(low, high)), periodCertainty: pc, confidenceCap, factors, notes };
};
