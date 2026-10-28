// Buyer motivation + budget (optional appraisal inputs) and the over-walk-away negotiation plan.
// Pure and unit-tested. Every figure is computed here from the app's own walk-away and range; the model supplies none.
import { CASH_CAP_FR_RESIDENT_EUR } from './negotiation.js';
import { convertApprox } from './budget.js';
import { venueOf, isPrivateSeller } from './venueGuidance.js';

export type Motivation = 'browsing' | 'would_like' | 'fills_gap';
export const MOTIVATIONS: Motivation[] = ['browsing', 'would_like', 'fills_gap'];
/** "Fills a gap": the best-and-final may go up to this much over the walk-away (and never over the budget). */
export const GAP_PREMIUM_PCT = 15;
/** "Just browsing": the ceiling sits this far under the walk-away. */
export const BROWSING_FACTOR = 0.9;
/** Cash price: this much below the best-and-final (cash is a lever, not a second ceiling). */
export const CASH_DISCOUNT = 0.08;

export const parseMotivation = (m: unknown): Motivation | undefined => MOTIVATIONS.includes(m as Motivation) ? m as Motivation : undefined;
export const parseBudget = (b: unknown): number | undefined => { const n = Number(b); return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined; };

const nice = (x: number) => x <= 0 ? 0 : x < 1000 ? Math.round(x / 10) * 10 : x < 10000 ? Math.round(x / 50) * 50 : Math.round(x / 100) * 100;
const niceDown = (x: number) => x <= 0 ? 0 : x < 1000 ? Math.floor(x / 10) * 10 : x < 10000 ? Math.floor(x / 50) * 50 : Math.floor(x / 100) * 100;

export type MotivationVerdict = 'unchanged' | 'walk_away' | 'negotiate' | 'premium' | 'over_budget';
export interface OfferPlan {
  venue: 'dealer' | 'private' | 'market' | 'auction';
  opening_offer?: number;
  cash_price?: number | null;           // null: cash does not apply (dealer above the €1,000 French cap)
  cash_capped?: boolean;
  best_and_final?: number;
  max_hammer?: number; max_all_in?: number; premium_pct?: number; // auction
  over_walk_away?: number;              // > 0 when the best-and-final / max bid is above the walk-away (fills a gap)
  premium_cap_pct?: number;
}
export interface MotivationDecision {
  motivation?: Motivation; budget?: number;
  price: number;           // compared like with like: hammer at auction, asking otherwise
  outlay: number;          // what the buyer pays: all-in at auction, asking otherwise (compared with the budget)
  walkAway: number; walkAwayAllIn?: number;
  over: boolean;           // price above the walk-away
  gap: number;             // price - walk-away (when over)
  verdict: MotivationVerdict;
  overBudget: boolean; budgetGap: number;
  plan: OfferPlan | null;
}

/** Need More Evidence is overridden by the motivation verdict when a motivation was given and the price is above the
 *  walk-away (at auction the hammer vs the hammer walk-away, i.e. the all-in vs the all-in walk-away), or over budget. */
export const overridesNeedEvidence = (md: MotivationDecision | null | undefined, basis: string): boolean =>
  !!md && basis === 'need_evidence' && md.verdict !== 'unchanged' && (md.over || md.overBudget);

/**
 * Run on an item that went through applyVenueGuidance. Returns null when there is no price or no walk-away.
 * No motivation -> the "I'd like it" behaviour; below the walk-away and within budget -> 'unchanged'; the plan is still built when the
 * price is above fair value (the smart buy) or the walk-away.
 */
export const motivationDecision = (item: Record<string, any> | null | undefined): MotivationDecision | null => {
  if (!item) return null;
  const sc = item.seller_context || {};
  const venue0 = venueOf(sc);
  const venue: OfferPlan['venue'] = venue0 === 'market' ? (isPrivateSeller(sc) ? 'private' : 'market') : venue0;
  const isAuction = venue === 'auction';
  const bd = item.buy_decision || {}, pg = item.price_guidance || {};
  const walkAway = Math.round(Number(item.negotiation_strategy?.walk_away_price) || Number(item.walk_away_threshold?.hammer) || 0);
  const premiumPct = isAuction ? (Number(sc.buyerPremiumRate) || 0) : 0;
  const price = Math.round(isAuction ? (Number(bd.compare_price) || Number(sc.askingPrice) || 0) : (Number(bd.effective_price) || Number(sc.allInPrice) || 0));
  if (!(price > 0) || !(walkAway > 0)) return null;
  const outlay = isAuction ? Math.round(price * (1 + premiumPct / 100)) : price;
  const motivation = parseMotivation(sc.motivation);
  // no motivation given: the "I'd like it" behaviour (always a decisive verdict)
  const effMotivation: Motivation = motivation || 'would_like';
  const budget = parseBudget(sc.budget);
  const budgetEur = budget; // the budget is typed in the appraisal's currency
  const over = price > walkAway;
  const gap = over ? price - walkAway : 0;
  const overBudget = !!budgetEur && outlay > budgetEur;
  const budgetGap = overBudget ? outlay - budgetEur! : 0;
  let verdict: MotivationVerdict = 'unchanged';
  if (overBudget) verdict = 'over_budget';
  else if (over && effMotivation === 'browsing') verdict = 'walk_away';
  else if (over && effMotivation === 'would_like') verdict = 'negotiate';
  else if (over && effMotivation === 'fills_gap') verdict = budgetEur ? 'premium' : 'negotiate';

  const fairValue = Math.min(walkAway, Number(pg.good_buy_below) || walkAway);
  // auctions always get the plan (max bid as hammer + all-in), whatever the estimate
  const needPlan = isAuction || price > fairValue || over;
  let plan: OfferPlan | null = null;
  if (needPlan) {
    // premium allowed only for "fills a gap" with a budget that covers it
    const premiumCap = niceDown(walkAway * (1 + GAP_PREMIUM_PCT / 100));
    const stretch = effMotivation === 'fills_gap' && !!budgetEur;
    // "Just browsing" is more cautious than "I'd like it": a lower ceiling and a lower opening
    const cautious = effMotivation === 'browsing';
    const ceiling = cautious ? niceDown(walkAway * BROWSING_FACTOR) : walkAway;
    if (isAuction) {
      const budgetHammer = budgetEur ? niceDown(budgetEur / (1 + premiumPct / 100)) : Infinity;
      let maxHammer = stretch ? Math.max(walkAway, Math.min(premiumCap, budgetHammer)) : Math.min(ceiling, budgetHammer);
      maxHammer = Math.max(0, Math.round(maxHammer));
      plan = { venue, max_hammer: maxHammer, max_all_in: Math.round(maxHammer * (1 + premiumPct / 100)), premium_pct: premiumPct,
        over_walk_away: maxHammer > walkAway ? maxHammer - walkAway : 0, premium_cap_pct: GAP_PREMIUM_PCT };
    } else {
      let best = stretch ? Math.max(walkAway, Math.min(premiumCap, niceDown(budgetEur!))) : ceiling;
      if (budgetEur) best = Math.min(best, niceDown(budgetEur));
      best = Math.min(best, price);           // never offer more than they ask
      const low = Number(pg.estimated_market_range_low) || 0;
      const opening = Math.min(best, nice(Math.max(low, Math.min(walkAway, best) * (cautious ? 0.65 : 0.75))));
      const cashRaw = nice(Math.max(opening, best * (1 - CASH_DISCOUNT)));
      const cashEur = convertApprox(cashRaw, pg.currency || 'EUR', 'EUR') ?? cashRaw;
      const capped = venue === 'dealer' && cashEur > CASH_CAP_FR_RESIDENT_EUR;
      plan = { venue, opening_offer: opening, best_and_final: best, cash_price: capped ? null : cashRaw, cash_capped: capped,
        over_walk_away: best > walkAway ? best - walkAway : 0, premium_cap_pct: GAP_PREMIUM_PCT };
    }
  }
  return { motivation, budget, price, outlay, walkAway, walkAwayAllIn: isAuction ? Math.round(walkAway * (1 + premiumPct / 100)) : undefined,
    over, gap, verdict, overBudget, budgetGap, plan };
};
