// "Negotiate" (dealer, shop or private purchases) and "Bidding tips" (auctions), shown in the "Before you buy" section.
// Pure and unit-tested; built from the app's own range / walk-away (never the model's prose). Texts: i18n negotiate.*.
import { convertApprox } from "./budget.js";
import { fold } from "./makers.js";
import type { CheckAnswers, CheckItem } from "./checklist.js";

/**
 * French cash-payment caps, Code monétaire et financier art. D112-3 (in force since 1 Oct 2018, checked 9 Oct 2026 on
 * Légifrance mirrors), applying art. L112-6 I:
 *  - 1° payer with a French tax domicile, or paying for a business: €1,000 in cash;
 *  - 3° payer with no French tax domicile, buying privately, paying a person listed in art. L561-2 (which includes
 *    antique and art dealers): €15,000 (2°: €10,000 when the payee is not listed in L561-2).
 * Payments between private individuals are not capped by D112-3 (a written receipt is the proof of payment).
 */
export const CASH_CAP_FR_RESIDENT_EUR = 1_000;
export const CASH_CAP_FR_NON_RESIDENT_EUR = 15_000;
export const CASH_DISCOUNT_PCT: [number, number] = [5, 10];

export type SellerKind = 'dealer' | 'private' | 'auction';
export const sellerKindOf = (sellerType: string | undefined, isAuction: boolean): SellerKind =>
  isAuction ? 'auction' : /shop|dealer|antiquaire|gallery|galerie/i.test(sellerType || '') ? 'dealer' : 'private';

const nice = (x: number) => x <= 0 ? 0 : x < 1000 ? Math.round(x / 10) * 10 : x < 10000 ? Math.round(x / 50) * 50 : Math.round(x / 100) * 100;

export interface NegotiationInput {
  sellerType?: string; isAuction: boolean;
  /** 'market' (brocante / flea market) or 'private' when known; dealer / auction come from sellerType */
  venue?: 'market' | 'private' | 'dealer' | 'auction'; askingPrice?: number; currency: string;
  walkAway: number;            // the app's walk-away (dealer: all-in price; auction: max hammer)
  openingOffer?: number;       // the app's reconciled opening offer (<= smart buy)
  targetHigh?: number;         // the app's reconciled target high (<= walk-away)
  dealerLow?: number;          // dealer mode: the bottom of the dealer range (offers are anchored toward it)
  premiumPct?: number;         // auction buyer's premium
  checklist?: CheckItem[]; answers?: CheckAnswers;
  maker?: string | null; period?: string; text?: string; pieces?: number; pieceKind?: string;
}

export interface NegotiationPlan {
  kind: SellerKind;
  opening_offer?: number; happy_at?: number; walk_away: number; asking?: number;
  asking_over_walk_pct?: number;           // how far the asking price is above the walk-away (dealer / private)
  payment?: { mode: 'cash' | 'cash_private_receipt' | 'cash_market' | 'transfer'; discount_pct: [number, number]; discount_amount?: [number, number]; cap_eur: number; cap_non_resident_eur: number; over_cap: boolean };
  levers: Array<{ id: 'bundle' | 'flaws' | 'delivery' | 'timing'; flaws?: string[] }>;
  invoice: { terms: string[] };
  bidding?: { max_hammer: number; max_all_in: number; premium_pct: number };
  stretch_to?: number;                     // "fills a gap": the agreed stretch above the walk-away
}

/** Cash discount in money (5–10 % of the price paid): fine rounding on small sums; omitted when it rounds to nothing,
 * so the card never shows an empty "(—–—)". */
export const discountAmount = (mode: string, base: number): [number, number] | null => {
  if (mode === 'transfer' || !(base > 0)) return null;
  const r = (x: number) => base < 200 ? Math.round(x) : nice(x);
  const lo = r(base * 0.05), hi = r(base * 0.10);
  return lo > 0 && hi > lo ? [lo, hi] : null;
};

/** The Negotiate card uses the offer plan's computed figures (motivation.ts): opening = plan opening, happy at =
 * best-and-final; above the walk-away ("fills a gap" stretch) the card says so instead of "never go above". */
export const alignWithOfferPlan = (plan: NegotiationPlan | null | undefined, offer: { opening_offer?: number; best_and_final?: number; max_hammer?: number; max_all_in?: number; over_walk_away?: number } | null | undefined): NegotiationPlan | null | undefined => {
  if (!plan || !offer) return plan;
  if (plan.kind === 'auction') {
    if (!(Number(offer.max_hammer) > 0) || !plan.bidding) return plan;
    return { ...plan, bidding: { ...plan.bidding, max_hammer: offer.max_hammer!, max_all_in: Number(offer.max_all_in) || plan.bidding.max_all_in }, stretch_to: (offer.over_walk_away || 0) > 0 ? offer.max_hammer : undefined };
  }
  if (!(Number(offer.best_and_final) > 0)) return plan;
  const happy = offer.best_and_final!;
  const opening = Math.min(happy, Number(offer.opening_offer) || plan.opening_offer || happy);
  const da = plan.payment ? discountAmount(plan.payment.mode, happy) : null;
  const payment = plan.payment ? { ...plan.payment, discount_amount: da || undefined } : undefined;
  if (payment && !da) delete payment.discount_amount;
  return { ...plan, opening_offer: opening, happy_at: happy, payment, stretch_to: (offer.over_walk_away || 0) > 0 ? happy : undefined };
};

export const buildNegotiationPlan = (i: NegotiationInput): NegotiationPlan => {
  const kind = sellerKindOf(i.sellerType, i.isAuction);
  const walk = Math.max(0, Math.round(i.walkAway || 0));
  const t = fold(`${i.text || ''} ${i.period || ''}`);
  // invoice wording: period always; the stamp when a maker is claimed; original mounts / marble / glass when relevant
  const terms = ['epoque'];
  if (i.maker) terms.push('estampille');
  if (/\b(bronzes?|ormolu|mounts?|dore(e|s|es)?)\b/.test(t)) terms.push('bronzes');
  if (/\b(marble|marbre)\b/.test(t)) terms.push('marbre');
  if (i.pieceKind === 'mirror') terms.push('glace');
  terms.push('restaurations');
  const invoice = { terms };

  if (kind === 'auction') {
    const prem = Number(i.premiumPct) || 0;
    return { kind, walk_away: walk, levers: [], invoice, bidding: { max_hammer: walk, max_all_in: Math.round(walk * (1 + prem / 100)), premium_pct: prem } };
  }

  // Suggested opening offer and "happy at" price: from the app's own figures, NEVER above the walk-away.
  const ask = Number(i.askingPrice) > 0 ? Number(i.askingPrice) : undefined;
  let happy: number, opening: number;
  const dLow = Number(i.dealerLow) > 0 ? Math.min(walk, Number(i.dealerLow)) : 0;
  if (dLow && ask && ask <= walk) {
    // dealer range known and the asking price within the walk-away: aim between the dealer low and the asking price
    happy = Math.min(walk, ask * 0.93, Math.max(dLow, (dLow + ask) / 2));
    opening = Math.min(happy * 0.95, Math.max(dLow, ask * 0.8));
  } else if (dLow) {
    // asking above the dealer high (or no price): anchor on the dealer low
    happy = Math.min(walk, i.targetHigh && i.targetHigh > 0 ? i.targetHigh : (dLow + walk) / 2);
    opening = Math.min(happy * 0.95, Math.max(i.openingOffer && i.openingOffer > 0 ? i.openingOffer : 0, dLow));
  } else if (ask && ask <= walk) {
    // the asking price is already within the app's range: negotiate down from it
    happy = Math.min(walk, ask * 0.93);
    opening = ask * 0.85;
  } else {
    happy = Math.min(walk, i.targetHigh && i.targetHigh > 0 ? i.targetHigh : walk * 0.9);
    opening = Math.max(i.openingOffer && i.openingOffer > 0 ? i.openingOffer : 0, happy * 0.85);
  }
  happy = Math.min(walk, nice(happy)); opening = Math.min(happy, nice(opening));
  if (walk <= 0) { happy = 0; opening = 0; }

  // Payment leverage. The amount actually paid is ~ the "happy at" price.
  const paidEur = convertApprox(happy || ask || walk, i.currency, 'EUR') ?? (happy || ask || walk);
  const market = kind === 'private' && i.venue === 'market';
  const mode: 'cash' | 'cash_private_receipt' | 'cash_market' | 'transfer' = market ? (paidEur <= CASH_CAP_FR_RESIDENT_EUR ? 'cash_market' : 'transfer') : kind === 'private' ? 'cash_private_receipt' : paidEur <= CASH_CAP_FR_RESIDENT_EUR ? 'cash' : 'transfer';
  const base = happy || ask || 0;
  const payment = { mode, over_cap: paidEur > CASH_CAP_FR_RESIDENT_EUR, discount_pct: CASH_DISCOUNT_PCT, cap_eur: CASH_CAP_FR_RESIDENT_EUR, cap_non_resident_eur: CASH_CAP_FR_NON_RESIDENT_EUR,
    ...(discountAmount(mode, base) ? { discount_amount: discountAmount(mode, base)! } : {}) };

  const flaws = (i.checklist || []).filter(c => i.answers?.[c.id] === 'no' && c.id !== 'invoice_wording' && c.id !== 'provenance_condition_report').map(c => c.id);
  const levers: NegotiationPlan['levers'] = [{ id: 'bundle' }];
  if (flaws.length) levers.unshift({ id: 'flaws', flaws });
  levers.push({ id: 'delivery' }, { id: 'timing' });
  return {
    kind, opening_offer: opening, happy_at: happy, walk_away: walk, asking: ask,
    asking_over_walk_pct: ask && walk > 0 && ask > walk ? Math.round((ask / walk - 1) * 100) : undefined,
    payment, levers, invoice,
  };
};
