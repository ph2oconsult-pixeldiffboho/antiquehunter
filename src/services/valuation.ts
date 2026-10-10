// Authoritative valuation object: every panel (market range, buy score, negotiate, teaser)
// must read from a validated Valuation. Fees / offers / ceilings are computed here in code —
// never invented in model prose. Pure functions; unit-tested.
import { convertApprox } from "./budget.js";
import { dealerBands, saneDealerRange, decideBuy, type VerdictBands, type BuyDecision } from "./appraisalMath.js";

export type PriceBasis = 'hammer' | 'all_in' | 'asking' | 'estimate';
export type EvidenceKind = 'user_fact' | 'catalogue_claim' | 'photo_feature' | 'model_hypothesis' | 'unknown';
export type DealerEvidence = 'none' | 'assumption' | 'comps';

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
  /**
   * Optional dealer retail range. Only used when dealerEvidence is 'assumption' or 'comps'.
   * Never invent by multiplying the auction range (no ×1.3/×1.6).
   */
  dealerRetail?: MoneyRange | null;
  dealerEvidence?: DealerEvidence;
  restorationAllowance?: number;
  marginFraction?: number;
  riskPenalty?: number;
  itemScore?: number;
  valueTier?: string;
  needsEvidence?: boolean;
}

export interface Valuation {
  currency: string;
  isAuction: boolean;
  premiumPct: number;
  expectedHammer: MoneyRange;
  buyerCost: MoneyRange;
  dealerRetail: MoneyRange | null;
  dealerEvidence: DealerEvidence;
  suggestedAcquisition: number | null;
  openingOffer: number | null;
  targetHigh: number | null;
  maxBidHammer: number | null;
  maxBidAllIn: number | null;
  walkAway: number;
  overpayingAbove: number;
  restorationAllowance: number;
  askingPrice: number | null;
  buyScoreAllowed: boolean;
  provisional: boolean;
  textOnly: boolean;
  notes: string[];
  /** Bands for decideBuy (dealer mode only when dealer evidence exists). */
  bands: VerdictBands | null;
  decision: BuyDecision | null;
}

const roundMoney = (x: number): number =>
  x >= 10000 ? Math.round(x / 500) * 500 : x >= 1000 ? Math.round(x / 50) * 50 : Math.round(x / 10) * 10;

const num = (x: unknown): number => {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
};

export const allInFromHammer = (hammer: number, premiumPct: number): number =>
  Math.round(hammer * (1 + Math.max(0, premiumPct) / 100));

export const hammerFromAllIn = (allIn: number, premiumPct: number): number => {
  const p = Math.max(0, premiumPct);
  return p >= 100 ? allIn : Math.round(allIn / (1 + p / 100));
};

/**
 * Resolve dealer retail: never invent ×1.3/×1.6 from the auction range.
 * - 'comps': use provided dealerRetail as evidence-based
 * - 'assumption': use model-stated retail, labelled as assumption (must be >= auction mid after sane clamp)
 * - 'none' / missing: no dealer range
 */
export const resolveDealerRetail = (
  marketLow: number, marketHigh: number,
  rawDealer: MoneyRange | null | undefined,
  evidence: DealerEvidence | undefined,
): { dealer: MoneyRange | null; evidence: DealerEvidence; notes: string[] } => {
  const notes: string[] = [];
  const ev = evidence || (rawDealer && rawDealer.high > 0 ? 'assumption' : 'none');
  if (ev === 'none' || !rawDealer || !(rawDealer.high > 0)) {
    notes.push('no_dealer_evidence');
    return { dealer: null, evidence: 'none', notes };
  }
  const sane = saneDealerRange(marketLow, marketHigh, rawDealer.low, rawDealer.high);
  if (sane.clamped) notes.push('dealer_range_clamped_to_auction');
  if (ev === 'assumption') notes.push('dealer_range_labelled_assumption');
  return {
    dealer: { low: sane.low, high: sane.high, currency: rawDealer.currency || 'EUR', basis: 'asking', provisional: rawDealer.provisional || ev === 'assumption' },
    evidence: ev,
    notes,
  };
};

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

  const resolved = i.isAuction
    ? { dealer: null as MoneyRange | null, evidence: 'none' as DealerEvidence, notes: [] as string[] }
    : resolveDealerRetail(marketLow, marketHigh, i.dealerRetail, i.dealerEvidence);
  notes.push(...resolved.notes);
  const dealerRetail = resolved.dealer;
  const dealerEvidence = resolved.evidence;

  const walkAway = dealerRetail ? dealerRetail.high : marketHigh;
  const overpayingAbove = walkAway;

  const bandLow = dealerRetail ? dealerRetail.low : marketLow;
  const suggestedAcquisition = walkAway > 0 ? roundMoney(bandLow + (walkAway - bandLow) * 0.35) : null;
  // Opening ~90% of smart-buy toward the band low; target high ~ midway smart→walk
  const openingOffer = suggestedAcquisition != null ? roundMoney(Math.min(suggestedAcquisition, Math.max(bandLow, suggestedAcquisition * 0.9))) : null;
  const targetHigh = suggestedAcquisition != null ? roundMoney(Math.min(walkAway, suggestedAcquisition + (walkAway - suggestedAcquisition) * 0.5)) : null;

  const restoration = Math.max(0, num(i.restorationAllowance));
  const margin = Math.min(0.5, Math.max(0, num(i.marginFraction)));

  let maxBidHammer: number | null = null;
  let maxBidAllIn: number | null = null;
  if (i.isAuction && walkAway > 0) {
    const budget = walkAway * (1 - margin) - restoration;
    maxBidHammer = budget > 0 ? roundMoney(budget / (1 + prem / 100)) : 0;
    maxBidAllIn = maxBidHammer != null ? allInFromHammer(maxBidHammer, prem) : null;
    if (maxBidHammer != null && maxBidHammer > marketHigh) {
      maxBidHammer = marketHigh;
      maxBidAllIn = allInFromHammer(maxBidHammer, prem);
      notes.push('max_bid_capped_at_market_high');
    }
  } else if (!i.isAuction && suggestedAcquisition != null) {
    maxBidAllIn = Math.max(0, roundMoney((targetHigh ?? suggestedAcquisition) - restoration));
    maxBidHammer = maxBidAllIn;
  }

  const asking = num(i.askingPrice) > 0 ? num(i.askingPrice) : null;
  const bands: VerdictBands | null = (!i.isAuction && dealerRetail)
    ? dealerBands(marketLow, marketHigh, dealerRetail.low, dealerRetail.high)
    : null;

  const decision = asking != null ? decideBuy({
    askingPrice: asking,
    isAuction: i.isAuction,
    premiumPct: prem,
    hasPhotos: i.hasPhotos,
    marketLow,
    marketHigh,
    retailHigh: dealerRetail?.high ?? marketHigh,
    smartBuy: suggestedAcquisition ?? marketLow,
    walkAway,
    riskPenalty: i.riskPenalty || 0,
    itemScore: i.itemScore || 0,
    valueTier: i.valueTier,
    needsEvidence: i.needsEvidence,
    bands: bands || undefined,
  }) : null;

  return {
    currency,
    isAuction: !!i.isAuction,
    premiumPct: prem,
    expectedHammer,
    buyerCost,
    dealerRetail,
    dealerEvidence,
    suggestedAcquisition,
    openingOffer,
    targetHigh,
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
    bands,
    decision,
  };
};

export const validateValuation = (v: Valuation): string[] => {
  const errs: string[] = [];
  if (v.walkAway !== v.overpayingAbove) errs.push('walk_away_ne_overpaying');
  if (v.expectedHammer.low > v.expectedHammer.high) errs.push('hammer_range_inverted');
  if (v.buyerCost.low > v.buyerCost.high) errs.push('buyer_cost_inverted');
  if (v.isAuction && v.expectedHammer.basis !== 'hammer') errs.push('auction_hammer_basis');
  if (v.isAuction && v.buyerCost.basis !== 'all_in') errs.push('auction_buyer_cost_basis');
  if (!v.buyScoreAllowed && v.askingPrice != null) errs.push('ask_without_score_flag');
  if (v.buyScoreAllowed && (v.askingPrice == null || v.askingPrice <= 0)) errs.push('score_without_ask');
  if (v.maxBidHammer != null && v.isAuction && v.maxBidHammer > v.walkAway * 1.01) errs.push('max_bid_above_walk_away');
  if (v.openingOffer != null && v.suggestedAcquisition != null && v.openingOffer > v.suggestedAcquisition + 1) errs.push('opening_above_smart');
  if (v.suggestedAcquisition != null && v.suggestedAcquisition > v.walkAway + 1) errs.push('smart_above_walk');
  if (v.targetHigh != null && v.targetHigh > v.walkAway + 1) errs.push('target_above_walk');
  if (v.dealerEvidence === 'none' && v.dealerRetail) errs.push('dealer_without_evidence');
  return errs;
};

/** Assert walk-away, overpaying warning, buy-score threshold and opening offer cannot diverge. */
export const assertValuationAgreement = (v: Valuation): void => {
  const errs = validateValuation(v);
  if (errs.length) throw new Error(`valuation_disagree: ${errs.join(',')}`);
  if (v.walkAway !== v.overpayingAbove) throw new Error('walk_ne_overpaying');
  if (v.decision && v.buyScoreAllowed) {
    // decision used the same walkAway / smartBuy
    if (v.suggestedAcquisition == null) throw new Error('decision_without_smart');
  }
};

export const convertRange = (r: MoneyRange, to: string): MoneyRange => {
  if (r.currency === to) return r;
  const lo = convertApprox(r.low, r.currency, to);
  const hi = convertApprox(r.high, r.currency, to);
  return { ...r, low: lo ?? r.low, high: hi ?? r.high, currency: to };
};
