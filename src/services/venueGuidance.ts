// Venue-aware guidance (client-side, shared). The server prices every lot on the auction scale
// (price_guidance.estimated_market_range_*) and, for non-auction sellers, adds the dealer range (fair_price_*).
// - Auction: unchanged (hammer range, max bid).
// - Antique Shop: unchanged dealer range (PR #12), plus a note that shops cost more but quality is more guaranteed.
// - Market/Fair (brocante, flea market): its own bargain band at or below auction level; the walk-away is the auction
//   high; the verdict notes that bargains are possible but quality is not guaranteed.
import { bandScore, type VerdictBands } from './appraisalMath';
import { sellerKindOf } from './negotiation';

export type Venue = 'auction' | 'market' | 'dealer';
/** Above the walk-away (auction high), a market price is "Overpriced" up to this multiple, then "Walk Away". */
export const MARKET_OVER_FACTOR = 1.5;

export const venueOf = (sc: { isAuction?: boolean; sellerType?: string } | undefined | null): Venue => {
  const isAuction = !!sc?.isAuction || /auction/i.test(String(sc?.sellerType || ''));
  const k = sellerKindOf(sc?.sellerType, isAuction);
  return k === 'auction' ? 'auction' : k === 'dealer' ? 'dealer' : 'market';
};

const r = (x: number) => x >= 1000 ? Math.round(x / 50) * 50 : Math.max(0, Math.round(x / 5) * 5);

/** Market bands from the auction range: <= auction low strong buy; <= auction mid good buy (the bargain band);
 *  <= auction high fair (walk-away); <= 1.5x auction high overpriced; above: walk away. */
export const marketBands = (auctionLow: number, auctionHigh: number): VerdictBands => {
  const lo = Math.max(0, Number(auctionLow) || 0), hi = Math.max(lo, Number(auctionHigh) || 0);
  return { strongTop: lo, goodTop: (lo + hi) / 2, fairTop: hi, overTop: hi * MARKET_OVER_FACTOR };
};

export const marketFigures = (auctionLow: number, auctionHigh: number) => {
  const b = marketBands(auctionLow, auctionHigh);
  const walk = r(b.fairTop), smart = Math.min(walk, r(b.goodTop));
  const opening = Math.min(smart, r(b.strongTop * 0.85));
  const targetLow = Math.min(smart, Math.max(opening, r(b.strongTop)));
  return { bargain_low: r(b.strongTop), bargain_high: smart, good_buy_below: smart, opening_offer: opening,
    target_price_low: targetLow, target_price_high: smart, walk_away_price: walk };
};

/** Returns the item as the given venue should show it. Auction items are returned unchanged (same object). */
export const applyVenueGuidance = <T extends Record<string, any>>(item: T): T => {
  if (!item) return item;
  const venue = venueOf(item.seller_context);
  if (venue === 'auction') return item;
  if (venue === 'dealer') return { ...item, venue, venue_note_key: 'analysis.venue_note_dealer' };
  const pg = item.price_guidance || {};
  const lo = Number(pg.estimated_market_range_low) || 0, hi = Number(pg.estimated_market_range_high) || 0;
  if (!(hi > 0)) return { ...item, venue, venue_note_key: 'analysis.venue_note_market' };
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
  return {
    ...item, venue, venue_note_key: 'analysis.venue_note_market', buy_decision: bd,
    price_guidance: { ...pg, good_buy_below: f.good_buy_below, overpaying_above: f.walk_away_price, market_bargain_low: f.bargain_low, market_bargain_high: f.bargain_high },
    negotiation_strategy: { ...(item.negotiation_strategy || {}), opening_offer: f.opening_offer, target_price_low: f.target_price_low, target_price_high: f.target_price_high, walk_away_price: f.walk_away_price },
  };
};
