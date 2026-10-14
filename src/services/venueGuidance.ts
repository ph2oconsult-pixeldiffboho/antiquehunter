// Venue-aware guidance (client-side, shared). The server prices every lot on the auction scale
// (price_guidance.estimated_market_range_*) and, for non-auction sellers, adds the dealer range (fair_price_*).
// - Auction: unchanged (hammer range, max bid).
// - Antique Shop: unchanged dealer range (PR #12), plus a note that shops cost more but quality is more guaranteed.
// - Market/Fair (brocante, flea market): its own bargain band at or below auction level; the walk-away is the auction
//   high; the verdict notes that bargains are possible but quality is not guaranteed.
import { bandScore, type VerdictBands } from './appraisalMath';
import { sellerKindOf, buildNegotiationPlan } from './negotiation';

export type Venue = 'auction' | 'market' | 'dealer';
/** Above the walk-away (auction high), a market price is "Overpriced" up to this multiple, then "Walk Away". */
export const MARKET_OVER_FACTOR = 1.5;

export const venueOf = (sc: { isAuction?: boolean; sellerType?: string } | undefined | null): Venue => {
  const isAuction = !!sc?.isAuction || /auction/i.test(String(sc?.sellerType || ''));
  const k = sellerKindOf(sc?.sellerType, isAuction);
  return k === 'auction' ? 'auction' : k === 'dealer' ? 'dealer' : 'market';
};

/** Market/Fair vs a private or estate seller: same market bands, different note. */
export const MARKET_WORDS_RE = /market|fair|brocante|flea|puces|vide[\s-]?grenier|march[ée]|foire|car[\s-]?boot/i;
export const isPrivateSeller = (sc: { sellerType?: string } | undefined | null): boolean =>
  venueOf(sc) === 'market' && !!String(sc?.sellerType || '').trim() && !MARKET_WORDS_RE.test(String(sc?.sellerType));
/** Low end used when the auction low is 0 or missing: a fraction of the high, so no figure is ever shown as €0. */
export const MISSING_LOW_FRACTION = 1 / 3;

const r = (x: number) => x >= 1000 ? Math.round(x / 50) * 50 : x > 0 ? Math.max(5, Math.round(x / 5) * 5) : 0;

/** Market bands from the auction range: <= auction low strong buy; <= auction mid good buy (the bargain band);
 *  <= auction high fair (walk-away); <= 1.5x auction high overpriced; above: walk away. */
export const marketBands = (auctionLow: number, auctionHigh: number): VerdictBands => {
  const hi0 = Math.max(0, Number(auctionHigh) || 0);
  const lo0 = Math.max(0, Number(auctionLow) || 0);
  const lo = lo0 > 0 ? Math.min(lo0, Math.max(hi0, lo0)) : hi0 * MISSING_LOW_FRACTION, hi = Math.max(lo, hi0);
  return { strongTop: lo, goodTop: (lo + hi) / 2, fairTop: hi, overTop: hi * MARKET_OVER_FACTOR };
};

export const marketFigures = (auctionLow: number, auctionHigh: number) => {
  const b = marketBands(auctionLow, auctionHigh);
  const walk = r(b.fairTop), smart = Math.min(walk, r(b.goodTop));
  const opening = Math.max(Math.min(smart, r(b.strongTop * 0.85)), Math.min(smart, 5));
  const targetLow = Math.min(smart, Math.max(opening, r(b.strongTop)));
  return { bargain_low: r(b.strongTop), bargain_high: smart, good_buy_below: smart, opening_offer: opening,
    target_price_low: targetLow, target_price_high: smart, walk_away_price: walk };
};

/** Returns the item as the given venue should show it. Auction items are returned unchanged (same object). */
/** Rebuilds the Negotiate plan's figures and payment tip from the venue figures (levers / invoice wording are kept). */
const rebuildPlan = (item: any, venue: 'market' | 'private' | 'dealer', walk: number, dealerLow?: number, openingOffer?: number, targetHigh?: number) => {
  const old = item.negotiation_plan;
  if (!old || !(walk > 0)) return old;
  const ask = Number(item.buy_decision?.compare_price || item.buy_decision?.effective_price || item.seller_context?.allInPrice) || undefined;
  const p = buildNegotiationPlan({ sellerType: item.seller_context?.sellerType, isAuction: false, venue, askingPrice: ask, currency: item.price_guidance?.currency || 'EUR',
    walkAway: walk, dealerLow, openingOffer, targetHigh });
  return { ...old, kind: p.kind, opening_offer: p.opening_offer, happy_at: p.happy_at, walk_away: p.walk_away, asking: p.asking, asking_over_walk_pct: p.asking_over_walk_pct, payment: p.payment };
};

/** The "how to buy" box shows the same offers as the Negotiate box: opening offer, and the range up to "happy at". */
const withPlanOffers = (ns: any, plan: any) => plan && Number(plan.happy_at) > 0
  ? { ...ns, opening_offer: plan.opening_offer, target_price_low: plan.opening_offer, target_price_high: plan.happy_at, walk_away_price: plan.walk_away }
  : ns;

export const applyVenueGuidance = <T extends Record<string, any>>(item: T): T => {
  if (!item) return item;
  const venue = venueOf(item.seller_context);
  if (venue === 'auction') return item;
  const noteKey = isPrivateSeller(item.seller_context) ? 'analysis.venue_note_private' : 'analysis.venue_note_market';
  if (venue === 'dealer') {
    const ns0 = item.negotiation_strategy || {};
    const plan = rebuildPlan(item, 'dealer', Number(ns0.walk_away_price) || Number(item.price_guidance?.fair_price_high) || 0, Number(item.price_guidance?.fair_price_low) || undefined, Number(ns0.opening_offer) || undefined, Number(ns0.target_price_high) || undefined);
    return { ...item, venue, venue_note_key: 'analysis.venue_note_dealer', negotiation_plan: plan, negotiation_strategy: withPlanOffers(ns0, plan) };
  }
  const pg = item.price_guidance || {};
  const lo = Number(pg.estimated_market_range_low) || 0, hi = Number(pg.estimated_market_range_high) || 0;
  if (!(hi > 0)) return { ...item, venue, venue_note_key: noteKey };
  const f = marketFigures(lo, hi);
  const bd = { ...(item.buy_decision || {}) };
  const price = Number(bd.effective_price || item.seller_context?.allInPrice) || 0;
  const keepRisk = ['high_risk', 'need_evidence', 'no_price'].includes(bd.price_basis);
  if (price > 0 && !keepRisk) {
    const s = bandScore(price, marketBands(lo, hi));
    if (s) { bd.score = s.score; bd.score_band = s.band; bd.price_basis = s.basis; }
  }
  bd.price_scale = 'market';
  bd.market_bands = { bargain_low: f.bargain_low, bargain_high: f.bargain_high, walk_away: f.walk_away_price, overpriced_to: r(hi * MARKET_OVER_FACTOR) };
  const ns1 = { ...(item.negotiation_strategy || {}), opening_offer: f.opening_offer, target_price_low: f.target_price_low, target_price_high: f.target_price_high, walk_away_price: f.walk_away_price };
  const plan = rebuildPlan({ ...item, buy_decision: bd }, isPrivateSeller(item.seller_context) ? 'private' : 'market', f.walk_away_price, undefined, f.opening_offer, f.target_price_high);
  return {
    ...item, venue, venue_note_key: noteKey, buy_decision: bd, negotiation_plan: plan,
    price_guidance: { ...pg, good_buy_below: f.good_buy_below, overpaying_above: f.walk_away_price, market_bargain_low: f.bargain_low, market_bargain_high: f.bargain_high },
    negotiation_strategy: withPlanOffers(ns1, plan),
    // the red walk-away line and the Need More Evidence text read this: keep it on the venue's walk-away
    ...(item.walk_away_threshold ? { walk_away_threshold: { ...item.walk_away_threshold, hammer: f.walk_away_price, all_in: null } } : {}),
  };
};

export type ProvisionalRangeKind = 'auction_hammer' | 'auction_equivalent';
export interface NeedEvidenceWalkAway { walkAway: number; allIn: number | null; isAuction: boolean; premiumPct: number; venue: Venue; rangeKind: ProvisionalRangeKind }

/**
 * Need More Evidence: the app's provisional walk-away for the selected venue (the same figure as the red walk-away
 * line: negotiation walk-away, else walk_away_threshold), and which kind of range the provisional range is. The
 * provisional range is always price_guidance.estimated_market_range_* (the auction scale): hammer at auction,
 * auction-equivalent for shops, private sellers and markets. Run on an item that went through applyVenueGuidance.
 */
export const needEvidenceWalkAway = (item: Record<string, any> | null | undefined): NeedEvidenceWalkAway | null => {
  if (!item) return null;
  const venue = venueOf(item.seller_context);
  const wt = item.walk_away_threshold || {};
  const walkAway = Math.round(Number(item.negotiation_strategy?.walk_away_price) || Number(wt.hammer) || 0);
  if (!(walkAway > 0)) return null;
  const isAuction = venue === 'auction';
  const premiumPct = Number(wt.premium_pct ?? item.seller_context?.buyerPremiumRate) || 0;
  const allIn = isAuction ? Math.round(walkAway * (1 + premiumPct / 100)) : null;
  return { walkAway, allIn, isAuction, premiumPct, venue, rangeKind: isAuction ? 'auction_hammer' : 'auction_equivalent' };
};

