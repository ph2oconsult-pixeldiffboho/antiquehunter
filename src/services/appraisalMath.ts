// Pure pricing / scoring rules for appraisals (unit-tested in scripts/check-hunt-logic.ts).

export interface ScoreBand { min: number; max: number }

/** Which price band the effective (all-in) price falls in. The verdict label and reason are derived from this. */
export type PriceBasis =
  | 'strong_buy'   // at or below market low
  | 'good_buy'     // market low .. market mid
  | 'fair'         // market mid .. market high
  | 'overpriced'   // above market high (up to retail high)
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
 * Market range is compared with the effective (all-in) price, so at auction the hammer figures are
 * the effective figure divided by (1 + premium).
 *  - smart buy: effective cost within [market low, market mid] (i.e. a "good buy" or better)
 *  - walk-away: effective cost <= market high, and >= smart buy
 *  - opening offer <= smart buy <= walk-away; opening <= target low <= target high <= walk-away
 */
export const reconcileNegotiation = (
  model: Partial<Record<keyof NegotiationFigures, unknown>>,
  marketLow: number,
  marketHigh: number,
  premiumPct: number,
  isAuction: boolean
): NegotiationFigures => {
  const f = premiumFactor(premiumPct, isAuction);
  const low = Math.max(0, num(marketLow));
  const high = Math.max(low, num(marketHigh));
  const mid = (low + high) / 2;
  const toPaid = (effective: number) => Math.floor(effective / f);

  const smartMin = Math.ceil(low / f);
  const smartMax = toPaid(mid);
  const modelSmart = num(model.good_buy_below);
  const smart = Math.round(clamp(modelSmart > 0 ? modelSmart : low / f, smartMin, Math.max(smartMin, smartMax)));

  const walkCap = toPaid(high);
  const modelWalk = num(model.walk_away_price);
  const walk = Math.max(smart, Math.round(Math.min(walkCap, modelWalk > 0 ? modelWalk : walkCap)));

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
  riskPenalty?: number;      // model's scoring_inputs.risk_penalty (0 .. -40)
  itemScore?: number;        // sum of the model's scoring_inputs (used only when no price is given)
  valueTier?: string;
}

export interface BuyDecision {
  score: number;
  band: ScoreBand;
  basis: PriceBasis;
  effectivePrice: number;    // 0 when no price
}

export const decideBuy = (i: BuyDecisionInput): BuyDecision => {
  const asking = num(i.askingPrice);
  const effective = asking > 0 ? allInCost(asking, i.premiumPct, i.isAuction) : 0;
  const ps = effective > 0 ? priceBandScore(effective, i.marketLow, i.marketHigh, i.retailHigh) : null;
  if (ps) {
    // A serious authenticity/condition problem SEEN IN PHOTOS (reproduction, marriage, major damage) caps the verdict
    // whatever the price. Text-only appraisals are NOT capped: there the model's risk penalty mostly reflects
    // "cannot verify without photos" (shown as low confidence), and capping it made every text appraisal "Walk Away".
    if (i.hasPhotos && num(i.riskPenalty) <= -25 && ps.score > 40) {
      return { score: 40, band: { min: 40, max: 40 }, basis: 'high_risk', effectivePrice: effective };
    }
    return { score: ps.score, band: ps.band, basis: ps.basis, effectivePrice: effective };
  }
  // No price: we cannot judge the deal; the score reflects the item only and stays below "Good buy"
  let score = clamp(Math.round(num(i.itemScore)), 1, 60);
  if (i.valueTier === 'D') score = Math.min(score, 30); // utility items never look like good buys
  return { score, band: { min: score, max: score }, basis: 'no_price', effectivePrice: 0 };
};
