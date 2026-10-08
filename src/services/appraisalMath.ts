// Pure pricing / scoring rules for appraisals (unit-tested in scripts/check-hunt-logic.ts).

export interface ScoreBand { min: number; max: number }

export interface PriceScore {
  score: number;
  band: ScoreBand;
  basis: 'below_market' | 'within_market' | 'above_market' | 'above_retail';
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** All-in cost: hammer/asking price plus buyer's premium (auctions only). Rounded once. */
export const allInCost = (price: number, premiumPct: number, isAuction: boolean): number =>
  Math.round((Number(price) || 0) * (isAuction ? 1 + (Number(premiumPct) || 0) / 100 : 1));

/**
 * Buy score from the price actually paid (incl. premium) against the market (hammer) and retail ranges.
 *  - at or below market low   -> 80..95 (cheaper = higher)
 *  - within the market range  -> 70..50
 *  - above market high        -> 34..15 (up to retail high)
 *  - above retail high        -> 14..1
 */
export const priceBandScore = (allIn: number, marketLow: number, marketHigh: number, retailHigh?: number): PriceScore | null => {
  const price = Number(allIn);
  let low = Math.max(0, Number(marketLow) || 0);
  let high = Math.max(low, Number(marketHigh) || 0);
  if (!(price > 0) || !(high > 0)) return null;
  const retail = Math.max(high, Number(retailHigh) || high * 2);

  if (price <= low) {
    const r = low > 0 ? clamp(price / low, 0, 1) : 1;
    return { score: Math.round(95 - 15 * r), band: { min: 80, max: 95 }, basis: 'below_market' };
  }
  if (price <= high) {
    const r = high > low ? (price - low) / (high - low) : 1;
    return { score: Math.round(70 - 20 * r), band: { min: 50, max: 70 }, basis: 'within_market' };
  }
  if (price <= retail) {
    const r = retail > high ? (price - high) / (retail - high) : 1;
    return { score: Math.round(34 - 19 * r), band: { min: 15, max: 34 }, basis: 'above_market' };
  }
  return { score: clamp(Math.round(14 * retail / price), 1, 14), band: { min: 1, max: 14 }, basis: 'above_retail' };
};

/** Max hammer bid such that hammer x (1 + premium) <= market high. */
export const maxHammerForMarketHigh = (marketHigh: number, premiumPct: number): number =>
  Math.floor((Number(marketHigh) || 0) / (1 + (Number(premiumPct) || 0) / 100));

/** Clamp a goal-adjusted score so it never leaves the price band set by the server. */
export const clampToBand = (score: number, band?: ScoreBand | null): number =>
  band ? clamp(score, band.min, band.max) : clamp(score, 0, 100);
