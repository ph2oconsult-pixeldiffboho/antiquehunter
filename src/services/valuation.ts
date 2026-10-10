// Authoritative valuation object: every panel (market range, buy score, negotiate, teaser)
// must read from a validated Valuation. Fees / offers / ceilings are computed here in code —
// never invented in model prose. Pure functions; unit-tested.
import { convertApprox } from "./budget.js";

export type PriceBasis = 'hammer' | 'all_in' | 'asking' | 'estimate';
export type EvidenceKind = 'user_fact' | 'catalogue_claim' | 'photo_feature' | 'model_hypothesis' | 'unknown';

export interface MoneyRange {
  low: number;
  high: number;
  currency: string;
  basis: PriceBasis;
  provisional?: boolean;
}

export interface ValuationInputs {
  currency: string;
  isAuction: boolean;
  /** Buyer's premium % (VAT-inclusive if that is how the house quotes it). */
  premiumPct: number;
  askingPrice?: number | null;
  hasPhotos: boolean;
  /** Expected hammer range (auction) or all-in market range (private/dealer). */
  market: MoneyRange;
  /** Dealer retail range when buying from a shop (optional; evidence-based). */
  dealerRetail?: MoneyRange | null;
  /** Restoration allowance in the same currency (separate, never folded into walk-away silently). */
  restorationAllowance?: number;
  /** Target margin fraction for a dealer-style buy (0–1); unused for private retail buys. */
  marginFraction?: number;
}

export interface Valuation {
  currency: string;
  isAuction: boolean;
  premiumPct: number;
  /** Expected hammer (auction) or market all-in (private). */
  expectedHammer: MoneyRange;
  /** Buyer cost = hammer × (1 + premium/100) at auction; else same as market. */
  buyerCost: MoneyRange;
  dealerRetail: MoneyRange | null;
  /** Suggested acquisition price for the stated buying goal (smart-buy). */
  suggestedAcquisition: number | null;
  /** Max bid after costs / restoration / margin — NOT automatically market high. */
  maxBidHammer: number | null;
  maxBidAllIn: number | null;
  walkAway: number;
  overpayingAbove: number;
  restorationAllowance: number;
  askingPrice: number | null;
  /** No asking price → no price-dependent buy score. */
  buyScoreAllowed: boolean;
  provisional: boolean;
  textOnly: boolean;
  notes: string[];
}

const roundMoney = (x: number): number =>
  x >= 10000 ? Math.round(x / 500) * 500 : x >= 1000 ? Math.round(x / 50) * 50 : Math.round(x / 10) * 10;

const num = (x: unknown): number => {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
};

/** All-in from hammer given a premium that already includes VAT when the house quotes it that way. */
export const allInFromHammer = (hammer: number, premiumPct: number): number =>
  Math.round(hammer * (1 + Math.max(0, premiumPct) / 100));

export const hammerFromAllIn = (allIn: number, premiumPct: number): number => {
  const p = Math.max(0, premiumPct);
  return p >= 100 ? allIn : Math.round(allIn / (1 + p / 100));
};

/**
 * Build the single valuation object. Walk-away, smart-buy and max bid are derived here so every
 * panel agrees. Max bid is NOT blindly the top of the market range: at auction it is the hammer
 * that keeps all-in ≤ walk-away after restoration; without an ask, buyScoreAllowed is false.
 */
export const buildValuation = (i: ValuationInputs): Valuation => {
  const currency = i.currency || 'EUR';
  const prem = Math.max(0, num(i.premiumPct));
  const marketLow = Math.max(0, num(i.market.low));
  const marketHigh = Math.max(marketLow, num(i.market.high));
  const notes: string[] = [];
  const provisional = !!i.market.provisional || !i.hasPhotos;
  if (!i.hasPhotos) notes.push('text_only_provisional');

  const expectedHammer: MoneyRange = i.isAuction
    ? { low: marketLow, high: marketHigh, currency, basis: 'hammer', provisional }
    : { low: marketLow, high: marketHigh, currency, basis: 'all_in', provisional };

  const buyerCost: MoneyRange = i.isAuction
    ? { low: allInFromHammer(marketLow, prem), high: allInFromHammer(marketHigh, prem), currency, basis: 'all_in', provisional }
    : { ...expectedHammer, basis: 'all_in' };

  const dealerRetail = i.dealerRetail && i.dealerRetail.high > 0
    ? { low: Math.max(0, num(i.dealerRetail.low)), high: Math.max(num(i.dealerRetail.low), num(i.dealerRetail.high)), currency, basis: 'asking' as PriceBasis, provisional: i.dealerRetail.provisional }
    : null;

  // Walk-away: dealer retail high when buying at a shop; else market high (hammer at auction).
  const walkAway = dealerRetail ? dealerRetail.high : marketHigh;
  const overpayingAbove = walkAway;

  // Smart-buy / suggested acquisition: mid of lower half of the range the buyer pays against.
  const bandLow = dealerRetail ? dealerRetail.low : marketLow;
  const bandHigh = walkAway;
  const suggestedAcquisition = bandHigh > 0 ? roundMoney(bandLow + (bandHigh - bandLow) * 0.35) : null;

  const restoration = Math.max(0, num(i.restorationAllowance));
  const margin = Math.min(0.5, Math.max(0, num(i.marginFraction)));

  // Max bid: at auction, hammer such that all-in + restoration ≤ walkAway × (1 - margin)
  let maxBidHammer: number | null = null;
  let maxBidAllIn: number | null = null;
  if (i.isAuction && walkAway > 0) {
    const budget = walkAway * (1 - margin) - restoration;
    maxBidHammer = budget > 0 ? roundMoney(budget / (1 + prem / 100)) : 0;
    maxBidAllIn = maxBidHammer != null ? allInFromHammer(maxBidHammer, prem) : null;
    if (maxBidHammer != null && maxBidHammer > marketHigh) {
      // Never imply the top of the market is automatically a safe max bid above evidence
      maxBidHammer = marketHigh;
      maxBidAllIn = allInFromHammer(maxBidHammer, prem);
      notes.push('max_bid_capped_at_market_high');
    }
  } else if (!i.isAuction && suggestedAcquisition != null) {
    maxBidAllIn = Math.max(0, roundMoney(suggestedAcquisition - restoration));
    maxBidHammer = maxBidAllIn;
  }

  const asking = num(i.askingPrice) > 0 ? num(i.askingPrice) : null;

  return {
    currency,
    isAuction: !!i.isAuction,
    premiumPct: prem,
    expectedHammer,
    buyerCost,
    dealerRetail,
    suggestedAcquisition,
    maxBidHammer,
    maxBidAllIn,
    walkAway: roundMoney(walkAway),
    overpayingAbove: roundMoney(overpayingAbove),
    restorationAllowance: restoration,
    askingPrice: asking,
    buyScoreAllowed: asking != null,
    provisional,
    textOnly: !i.hasPhotos,
    notes,
  };
};

/** Validate a Valuation: walk-away agreement, no hammer/all-in mix on the same field, etc. */
export const validateValuation = (v: Valuation): string[] => {
  const errs: string[] = [];
  if (v.walkAway !== v.overpayingAbove) errs.push('walk_away_ne_overpaying');
  if (v.expectedHammer.low > v.expectedHammer.high) errs.push('hammer_range_inverted');
  if (v.buyerCost.low > v.buyerCost.high) errs.push('buyer_cost_inverted');
  if (v.isAuction && v.expectedHammer.basis !== 'hammer') errs.push('auction_hammer_basis');
  if (v.isAuction && v.buyerCost.basis !== 'all_in') errs.push('auction_buyer_cost_basis');
  if (!v.buyScoreAllowed && v.askingPrice != null) errs.push('ask_without_score_flag');
  if (v.buyScoreAllowed && (v.askingPrice == null || v.askingPrice <= 0)) errs.push('score_without_ask');
  if (v.maxBidHammer != null && v.maxBidHammer > v.walkAway * 1.01 && v.isAuction) errs.push('max_bid_above_walk_away');
  return errs;
};

export const convertRange = (r: MoneyRange, to: string): MoneyRange => {
  if (r.currency === to) return r;
  const lo = convertApprox(r.low, r.currency, to);
  const hi = convertApprox(r.high, r.currency, to);
  return { ...r, low: lo ?? r.low, high: hi ?? r.high, currency: to };
};
