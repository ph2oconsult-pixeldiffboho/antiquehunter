// Pure pricing / scoring rules for appraisals (unit-tested in scripts/check-hunt-logic.ts).

export interface ScoreBand { min: number; max: number }

/** Which price band the effective (all-in) price falls in. The verdict label and reason are derived from this. */
export type PriceBasis =
  | 'strong_buy'   // at or below market low
  | 'good_buy'     // market low .. market mid
  | 'fair'         // market mid .. market high
  | 'overpriced'   // above the walk-away price / market high (up to retail high)
  | 'walk_away'    // above retail high
  | 'high_risk'    // serious authenticity/condition risk seen in photos caps the verdict
  | 'no_price';    // no asking price given: no deal verdict

export interface PriceScore {
  score: number;
  band: ScoreBand;
  basis: PriceBasis;
}

export const PRICE_BANDS: Record<Exclude<PriceBasis, 'high_risk' | 'no_price'>, ScoreBand> = {
  strong_buy: { min: 80, max: 95 },
  good_buy: { min: 65, max: 80 },
  fair: { min: 45, max: 65 },
  overpriced: { min: 15, max: 34 },
  walk_away: { min: 1, max: 14 },
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/** Price multiplier for the buyer's premium (auctions only). */
export const premiumFactor = (premiumPct: number, isAuction: boolean): number =>
  isAuction ? 1 + (num(premiumPct)) / 100 : 1;

/** All-in cost: hammer/asking price plus buyer's premium (auctions only). Rounded once. */
export const allInCost = (price: number, premiumPct: number, isAuction: boolean): number =>
  Math.round(num(price) * premiumFactor(premiumPct, isAuction));

/**
 * Buy score from the effective price (asking, or hammer x (1 + premium) at auction)
 * against the market range and the top of the retail range:
 *  - at or below market low        -> strong_buy 80..95 (cheaper = higher)
 *  - market low .. market mid      -> good_buy   80..65
 *  - market mid .. market high     -> fair       65..45
 *  - above market high (<= retail) -> overpriced 34..15
 *  - above retail high             -> walk_away  14..1
 */
export const priceBandScore = (effectivePrice: number, marketLow: number, marketHigh: number, retailHigh?: number): PriceScore | null => {
  const price = num(effectivePrice);
  const low = Math.max(0, num(marketLow));
  const high = Math.max(low, num(marketHigh));
  if (!(price > 0) || !(high > 0)) return null;
  const mid = (low + high) / 2;
  const retail = Math.max(high, num(retailHigh) || high * 2);

  if (price <= low) {
    const r = low > 0 ? clamp(price / low, 0, 1) : 1;
    return { score: Math.round(95 - 15 * r), band: PRICE_BANDS.strong_buy, basis: 'strong_buy' };
  }
  if (price <= mid) {
    const r = mid > low ? (price - low) / (mid - low) : 1;
    return { score: Math.round(80 - 15 * r), band: PRICE_BANDS.good_buy, basis: 'good_buy' };
  }
  if (price <= high) {
    const r = high > mid ? (price - mid) / (high - mid) : 1;
    return { score: Math.round(65 - 20 * r), band: PRICE_BANDS.fair, basis: 'fair' };
  }
  if (price <= retail) {
    const r = retail > high ? (price - high) / (retail - high) : 1;
    return { score: Math.round(34 - 19 * r), band: PRICE_BANDS.overpriced, basis: 'overpriced' };
  }
  return { score: clamp(Math.round(14 * retail / price), 1, 14), band: PRICE_BANDS.walk_away, basis: 'walk_away' };
};

/** Max hammer bid such that hammer x (1 + premium) <= market high. */
export const maxHammerForMarketHigh = (marketHigh: number, premiumPct: number): number =>
  Math.floor(num(marketHigh) / (1 + num(premiumPct) / 100));

/** Clamp a goal-adjusted score so it never leaves the price band set by the server. */
export const clampToBand = (score: number, band?: ScoreBand | null): number =>
  band ? clamp(score, band.min, band.max) : clamp(score, 0, 100);

/** Fallback when an older saved appraisal has no price_basis: derive the band from the score alone. */
export const basisFromScore = (score: number): PriceBasis => {
  if (score >= 80) return 'strong_buy';
  if (score >= 65) return 'good_buy';
  if (score >= 45) return 'fair';
  if (score >= 15) return 'overpriced';
  return 'walk_away';
};

export interface NegotiationFigures {
  good_buy_below: number;   // "Smart buy" (in the units the user pays: hammer at auction)
  opening_offer: number;
  target_price_low: number;
  target_price_high: number;
  walk_away_price: number;  // max hammer bid at auction
}

/**
 * Make the smart-buy / negotiation figures consistent with each other and with the buy-score bands.
 * Like with like (fix 3): the market range is in the units the user pays at the fall of the hammer (hammer prices at
 * auction, the asking price otherwise), so the figures are compared directly; the all-in cost is shown separately.
 *  - smart buy: within [market low, market mid] (i.e. a "good buy" or better)
 *  - walk-away: the top of the market range (the most a well-informed buyer pays); never below the smart buy
 *  - opening offer <= smart buy <= walk-away; opening <= target low <= target high <= walk-away
 * `premiumPct` / `isAuction` are kept for callers; they no longer change the figures.
 */
export const reconcileNegotiation = (
  model: Partial<Record<keyof NegotiationFigures, unknown>>,
  marketLow: number,
  marketHigh: number,
  _premiumPct: number,
  _isAuction: boolean
): NegotiationFigures => {
  const low = Math.max(0, num(marketLow));
  const high = Math.max(low, num(marketHigh));
  const mid = (low + high) / 2;

  const smartMin = Math.ceil(low);
  const smartMax = Math.floor(mid);
  const modelSmart = num(model.good_buy_below);
  const smart = Math.round(clamp(modelSmart > 0 ? modelSmart : low, smartMin, Math.max(smartMin, smartMax)));

  const walk = Math.max(smart, Math.round(high));

  const modelOpen = num(model.opening_offer);
  const opening = Math.round(Math.min(smart, modelOpen > 0 ? modelOpen : smart * 0.8));

  const modelTh = num(model.target_price_high);
  const targetHigh = Math.round(clamp(modelTh > 0 ? modelTh : walk * 0.9, opening, walk));
  const modelTl = num(model.target_price_low);
  const targetLow = Math.round(clamp(modelTl > 0 ? modelTl : targetHigh * 0.85, opening, targetHigh));

  return { good_buy_below: smart, opening_offer: opening, target_price_low: targetLow, target_price_high: targetHigh, walk_away_price: walk };
};

// ---------------------------------------------------------------------------
// Prose clean-up: never show JSON field names, keep restated ranges equal to the cards
// ---------------------------------------------------------------------------

const FIELD_WORDS: Array<[RegExp, string]> = [
  [/fair_price(?:_low|_high)?/gi, 'fair retail price'],
  [/estimated_market_range(?:_low|_high)?/gi, 'market range'],
  [/market_range(?:_low|_high)?/gi, 'market range'],
  [/good_buy_below/gi, 'smart-buy price'],
  [/overpaying_above/gi, 'overpaying threshold'],
  [/walk_away_price/gi, 'walk-away price'],
  [/opening_offer/gi, 'opening offer'],
  [/target_price(?:_low|_high)?/gi, 'target price'],
  [/target_buy_price(?:_low|_high)?/gi, 'dealer buying price'],
  [/price_vs_market/gi, 'price versus market'],
  [/risk_penalty/gi, 'risk'],
  [/rarity_desirability/gi, 'rarity'],
  [/market_demand/gi, 'demand'],
  [/scoring_inputs/gi, 'scoring'],
  [/price_guidance/gi, 'price guidance'],
  [/buy_decision/gi, 'buy decision'],
  [/negotiation_strategy/gi, 'negotiation strategy'],
  [/dealer_take/gi, "dealer's view"],
  [/value_tier/gi, 'value tier'],
  [/confidence_breakdown/gi, 'confidence'],
  [/pricing_reasoning/gi, 'pricing notes'],
  [/teaser_insight/gi, 'insight'],
];

/** Replace raw JSON field names ("The 'fair_price' of ...") with plain words. */
export const sanitizeProse = (text: string): string => {
  if (!text || typeof text !== 'string') return text;
  let out = text;
  for (const [re, word] of FIELD_WORDS) {
    // Drop quotes/backticks around the field name too
    const quoted = new RegExp(`(["'\`‘’“”]?)(${re.source})\\1`, 'gi');
    out = out.replace(quoted, word);
  }
  return out.replace(/\b(fair retail price|market range|smart-buy price)\s+price\b/gi, '$1');
};

/** Apply sanitizeProse to every string inside an object (arrays and nested objects included). */
export const sanitizeDeep = <T>(value: T): T => {
  if (typeof value === 'string') return sanitizeProse(value) as unknown as T;
  if (Array.isArray(value)) return value.map(v => sanitizeDeep(v)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(value as any)) out[k] = sanitizeDeep(v);
    return out;
  }
  return value;
};

const AMOUNT = String.raw`(\d{1,3}(?:[ .,\u00a0\u202f]\d{3})+|\d+)`;
const SYM = String.raw`(?:€|£|\$|A\$|¥|kr|EUR|GBP|USD|SEK|AUD|JPY|CNY)`;
const parseAmount = (s: string) => Number(s.replace(/[ .,\u00a0\u202f]/g, ''));

/**
 * If the prose restates the market or retail range right after naming it ("the fair retail price of €200–€400")
 * and the figures differ from the cards, replace them with the card figures so text and cards always agree.
 */
export const alignProseRanges = (
  text: string,
  ranges: { market: [number, number]; retail: [number, number] },
  fmt: (n: number) => string
): string => {
  if (!text || typeof text !== 'string') return text;
  const re = new RegExp(
    String.raw`\b(market range|market value|hammer range|auction range|estimated market|fair retail price|retail range|retail price|retail value|fair price|retail)([^.;:\d€£$¥]{0,30}?)` +
    String.raw`(${SYM}\s?)?${AMOUNT}(\s?${SYM})?\s?(?:–|—|-|to|à)\s?(${SYM}\s?)?${AMOUNT}(\s?${SYM})?`,
    'gi'
  );
  return text.replace(re, (whole, label: string, gap: string, s1, a1: string, s2, s3, a2: string, s4) => {
    if (!(s1 || s2 || s3 || s4)) return whole; // not clearly money
    const kind = /retail|fair/i.test(label) ? 'retail' : 'market';
    const [lo, hi] = ranges[kind];
    if (!(lo > 0 && hi > 0)) return whole;
    if (parseAmount(a1) === Math.round(lo) && parseAmount(a2) === Math.round(hi)) return whole;
    return `${label}${gap}${fmt(lo)}–${fmt(hi)}`;
  });
};

// ---------------------------------------------------------------------------
// Final buy decision (used by gemini.ts after the model answers; unit-tested with the road-test cases)
// ---------------------------------------------------------------------------

export interface BuyDecisionInput {
  askingPrice?: number;      // price as entered (hammer at auction)
  isAuction: boolean;
  premiumPct: number;        // buyer's premium, auctions only
  hasPhotos: boolean;
  marketLow: number;
  marketHigh: number;
  retailHigh: number;
  /** Smart-buy price in the units the user pays (hammer at auction). Caps the verdict at "Fair" above it. */
  smartBuy?: number;
  /** Walk-away price (max hammer bid at auction). Above it the verdict is never better than "Overpriced". */
  walkAway?: number;
  riskPenalty?: number;      // model's scoring_inputs.risk_penalty (0 .. -40)
  itemScore?: number;        // sum of the model's scoring_inputs (used only when no price is given)
  valueTier?: string;
}

/** Why the market band was overridden: the price is above the smart-buy or the walk-away price. */
export type VerdictCap = 'above_smart_buy' | 'above_walk_away';

export interface BuyDecision {
  score: number;
  band: ScoreBand;
  basis: PriceBasis;
  effectivePrice: number;    // 0 when no price
  cap?: VerdictCap;
  smartBuyAllIn?: number;
  walkAwayAllIn?: number;
  /** The price compared with the market range: hammer at auction, asking price otherwise */
  comparePrice?: number;
}

/**
 * Final verdict. Bands are contiguous and consistent with the negotiation figures
 * (effective = all-in at auction; smart buy / walk-away converted to all-in the same way):
 *   effective <= market low                  -> Strong Buy
 *   market low < effective <= smart buy       -> Good Buy
 *   smart buy < effective <= walk-away        -> Fair Price      (never Good/Strong above the smart buy)
 *   walk-away < effective <= retail high      -> Overpriced      (never Fair or better above the walk-away)
 *   effective > retail high                   -> Walk Away
 * The market-range bands still apply on top (e.g. above market high is Overpriced even with no walk-away).
 */
export const decideBuy = (i: BuyDecisionInput): BuyDecision => {
  const asking = num(i.askingPrice);
  // Shown to the user (all-in at auction) …
  const effective = asking > 0 ? allInCost(asking, i.premiumPct, i.isAuction) : 0;
  const smartAllIn = num(i.smartBuy) > 0 ? allInCost(num(i.smartBuy), i.premiumPct, i.isAuction) : 0;
  const walkAllIn = num(i.walkAway) > 0 ? allInCost(num(i.walkAway), i.premiumPct, i.isAuction) : 0;
  const extra = { smartBuyAllIn: smartAllIn || undefined, walkAwayAllIn: walkAllIn || undefined, comparePrice: asking || undefined };
  // … but compared like with like (fix 3): the hammer / asking price against the hammer / asking-price market range
  const smartCmp = num(i.smartBuy);
  const walkCmp = num(i.walkAway);
  let ps = asking > 0 ? priceBandScore(asking, i.marketLow, i.marketHigh, i.retailHigh) : null;
  let cap: VerdictCap | undefined;
  if (ps) {
    const retail = Math.max(num(i.marketHigh), num(i.retailHigh) || num(i.marketHigh) * 2);
    // Above the walk-away: never Fair or better. Scores use min() with the market-band score so the
    // score never rises as the price rises.
    if (walkCmp > 0 && asking > walkCmp && ps.basis !== 'walk_away') {
      const r = retail > walkCmp ? clamp((asking - walkCmp) / (retail - walkCmp), 0, 1) : 0;
      const capped = Math.round(34 - 19 * r);
      const score = ps.basis === 'overpriced' ? Math.min(capped, ps.score) : capped;
      ps = { score: clamp(score, PRICE_BANDS.overpriced.min, PRICE_BANDS.overpriced.max), band: PRICE_BANDS.overpriced, basis: 'overpriced' };
      cap = 'above_walk_away';
    // Above the smart buy (but within the walk-away): never Good Buy or better
    } else if (smartCmp > 0 && asking > smartCmp && ['strong_buy', 'good_buy', 'fair'].includes(ps.basis)) {
      const top = walkCmp > smartCmp ? walkCmp : Math.max(smartCmp, num(i.marketHigh));
      const r = top > smartCmp ? clamp((asking - smartCmp) / (top - smartCmp), 0, 1) : 0;
      const capped = Math.round(64 - 19 * r);
      if (ps.basis !== 'fair') cap = 'above_smart_buy';
      const score = ps.basis === 'fair' ? Math.min(capped, ps.score) : capped;
      ps = { score: clamp(score, PRICE_BANDS.fair.min, PRICE_BANDS.fair.max), band: PRICE_BANDS.fair, basis: 'fair' };
    }
    // A serious authenticity/condition problem SEEN IN PHOTOS (reproduction, marriage, major damage) caps the verdict
    // whatever the price. Text-only appraisals are NOT capped: there the model's risk penalty mostly reflects
    // "cannot verify without photos" (shown as low confidence), and capping it made every text appraisal "Walk Away".
    if (i.hasPhotos && num(i.riskPenalty) <= -25 && ps.score > 40) {
      return { score: 40, band: { min: 40, max: 40 }, basis: 'high_risk', effectivePrice: effective, ...extra };
    }
    return { score: ps.score, band: ps.band, basis: ps.basis, effectivePrice: effective, cap, ...extra };
  }
  // No price: we cannot judge the deal; the score reflects the item only and stays below "Good buy"
  let score = clamp(Math.round(num(i.itemScore)), 1, 60);
  if (i.valueTier === 'D') score = Math.min(score, 30); // utility items never look like good buys
  return { score, band: { min: score, max: score }, basis: 'no_price', effectivePrice: 0, ...extra };
};

/** Which reason text to show for a verdict (the cap reasons cite the smart-buy / walk-away figures). */
export const reasonKeyFor = (basis: PriceBasis, cap?: VerdictCap): string =>
  cap === 'above_walk_away' ? 'reason_above_walk_away'
  : cap === 'above_smart_buy' ? 'reason_above_smart_buy'
  : `reason_${basis}`;

// ---------------------------------------------------------------------------
// Price input parsing (appraisal + hunt forms)
// ---------------------------------------------------------------------------

/**
 * Parse a typed price: accepts digits with spaces / commas / dots as thousand or decimal separators and strips
 * currency symbols/codes ("€1 500", "1.500,50", "£1,250", "900 EUR"). Returns null for anything else (letters, empty).
 */
export const parsePriceInput = (raw: string): number | null => {
  let s = String(raw ?? '').trim();
  if (!s) return null;
  s = s.replace(/(€|£|\$|¥|kr\.?|sek|eur|gbp|usd|aud|cny|jpy)/gi, '').replace(/[\s\u00a0\u202f']/g, '');
  if (!s || !/^\d[\d.,]*$/.test(s)) return null;
  const lastSep = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
  const decimals = lastSep >= 0 ? s.length - lastSep - 1 : 0;
  // A last separator followed by 1-2 digits is the decimal separator ("1.500,50", "99.5"); 3 digits = thousands ("1,500")
  const n = decimals === 1 || decimals === 2
    ? Number(s.slice(0, lastSep).replace(/[.,]/g, '') + '.' + s.slice(lastSep + 1))
    : Number(s.replace(/[.,]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Keep only characters that can be part of a price while typing (digits, separators, spaces). */
export const sanitizePriceTyping = (raw: string): string => String(raw ?? '').replace(/[^\d.,\s]/g, '').slice(0, 15);

/** Budget: one amount or a range ("1500", "1 500 €", "500 – 2000"); numbers only. */
export const parseBudget = (raw: string): number[] | null => {
  const parts = raw.split(/\s*(?:–|—|-|to|à)\s*/i).map(p => p.trim()).filter(Boolean);
  if (!parts.length || parts.length > 2) return null;
  const nums = parts.map(p => parsePriceInput(p));
  return nums.every((n): n is number => n !== null) ? nums : null;
};


// ---------------------------------------------------------------------------
// Fix 6: confidence on fixed scales. The model is asked for evidence 0–40, identification 0–30, risk 0–30 (30 = no
// risk), but used to answer on 0–1, 0–10 or 0–100 scales; the app summed them, so 0.9+0.9+0.8 showed "very low"
// and 80+85+90 "high". Values are put back on the fixed scales before they are used.
// ---------------------------------------------------------------------------

export const CONFIDENCE_SCALES = { evidence_quality: 40, identification_certainty: 30, risk_factors: 30 } as const;
export type ConfidenceBreakdown = Record<keyof typeof CONFIDENCE_SCALES, number>;

export const normaliseConfidence = (raw: Partial<Record<keyof typeof CONFIDENCE_SCALES, unknown>> | null | undefined): ConfidenceBreakdown => {
  const keys = Object.keys(CONFIDENCE_SCALES) as Array<keyof typeof CONFIDENCE_SCALES>;
  const v = keys.map(k => Math.abs(num(raw?.[k])));
  const maxV = Math.max(0, ...v);
  // Two or more values above their scale = the model used another scale for all three; a single one = just clamp it
  const over = keys.filter((k, i) => v[i] > CONFIDENCE_SCALES[k]).length >= 2;
  const out = {} as ConfidenceBreakdown;
  keys.forEach((k, i) => {
    const max = CONFIDENCE_SCALES[k];
    let x = v[i];
    if (maxV > 0 && maxV <= 1) x = x * max;                          // fractions
    else if (over && maxV <= 10) x = (x / 10) * max;                  // 0–10 scale
    else if (over && maxV <= 100) x = (x / 100) * max;                // percentages
    out[k] = Math.round(clamp(x, 0, max));
  });
  return out;
};

export interface ConfidenceEvidence {
  hasPhotos: boolean;
  /** The auction house estimate was read from the lot page */
  fetchedEstimate: boolean;
  /** Comparable sales of the same type and region */
  closeComparables: number;
  /** max ÷ min hammer of the comparables shown (narrow = the market for this kind of piece is consistent) */
  comparableSpread?: number;
  /** Text-only query of very few words */
  vague: boolean;
}

/**
 * Calibrated confidence 1–100: half the model's own (normalised) breakdown, half what the app knows about the
 * evidence behind the price (a real estimate, close comparable sales with consistent prices, photos).
 */
export const calibratedConfidence = (b: ConfidenceBreakdown, e: ConfidenceEvidence): number => {
  const model = b.evidence_quality + b.identification_certainty + b.risk_factors;
  let ev = 20;
  if (e.fetchedEstimate) ev += 35;
  ev += 25 * Math.min(1, e.closeComparables / 3);
  if (e.comparableSpread && e.closeComparables >= 2) ev += e.comparableSpread <= 2.5 ? 10 : e.comparableSpread <= 5 ? 4 : -6;
  if (e.hasPhotos) ev += 10;
  let score = 0.5 * model + 0.5 * clamp(ev, 0, 100);
  if (!e.hasPhotos) score = Math.min(score, 59);
  if (e.vague) score = Math.min(score, 35);
  return Math.round(clamp(score, 1, 100));
};

export const confidenceLabel = (score: number): 'high' | 'medium' | 'low' | 'very_low' =>
  score >= 75 ? 'high' : score >= 55 ? 'medium' : score >= 35 ? 'low' : 'very_low';
