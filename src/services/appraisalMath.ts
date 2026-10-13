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
  | 'need_evidence' // period vs style/revival unclear: no buy verdict until more evidence is added
  | 'no_price';    // no asking price given: no deal verdict

export interface PriceScore {
  score: number;
  band: ScoreBand;
  basis: PriceBasis;
}

export const PRICE_BANDS: Record<Exclude<PriceBasis, 'high_risk' | 'no_price' | 'need_evidence'>, ScoreBand> = {
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
  const low = Math.max(0, num(marketLow));
  const high = Math.max(low, num(marketHigh));
  if (!(high > 0)) return null;
  return bandScore(effectivePrice, { strongTop: low, goodTop: (low + high) / 2, fairTop: high, overTop: Math.max(high, num(retailHigh) || high * 2) });
};

/** Upper edges of the verdict bands: <= strongTop Strong Buy, <= goodTop Good Buy, <= fairTop Fair, <= overTop Overpriced, above: Walk Away */
export interface VerdictBands { strongTop: number; goodTop: number; fairTop: number; overTop: number }

export const bandScore = (effectivePrice: number, b: VerdictBands): PriceScore | null => {
  const price = num(effectivePrice);
  const low = Math.max(0, num(b.strongTop)), mid = Math.max(low, num(b.goodTop)), high = Math.max(mid, num(b.fairTop)), retail = Math.max(high, num(b.overTop));
  if (!(price > 0) || !(high > 0)) return null;
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

// ---------------------------------------------------------------------------
// Dealer, shop and private asking prices are judged against the DEALER (retail) range, not the auction range
// ---------------------------------------------------------------------------

/** "Walk Away" starts this far above the dealer high (between the dealer high and here: "Overpriced") */
export const DEALER_WALK_AWAY_FACTOR = 1.5;

/** The dealer range, always present and sane: dealer low >= auction mid, dealer high >= auction high and >= dealer low. */
export const saneDealerRange = (auctionLow: number, auctionHigh: number, dealerLow?: number, dealerHigh?: number) => {
  const lo = Math.max(0, num(auctionLow)), hi = Math.max(lo, num(auctionHigh)), mid = (lo + hi) / 2;
  const rawLow = num(dealerLow) > 0 ? num(dealerLow) : Math.round(lo * 1.5);
  const rawHigh = num(dealerHigh) > 0 ? num(dealerHigh) : Math.round(hi * 2);
  const low = Math.round(Math.max(rawLow, mid));
  const high = Math.round(Math.max(rawHigh, hi, low));
  return { low, high, clamped: low !== Math.round(num(dealerLow)) || high !== Math.round(num(dealerHigh)) };
};

/** Dealer-mode bands: Strong Buy <= auction mid; Good Buy <= the LOWER of auction high and dealer low; Fair <= dealer high; Overpriced <= 1.5x dealer high */
export const dealerBands = (auctionLow: number, auctionHigh: number, dealerLow: number, dealerHigh: number): VerdictBands => {
  const lo = Math.max(0, num(auctionLow)), hi = Math.max(lo, num(auctionHigh)), mid = (lo + hi) / 2;
  const dLow = num(dealerLow) > 0 ? num(dealerLow) : hi;
  const dHigh = Math.max(hi, num(dealerHigh), dLow);
  return { strongTop: mid, goodTop: Math.min(dHigh, Math.max(mid, Math.min(hi, dLow))), fairTop: dHigh, overTop: dHigh * DEALER_WALK_AWAY_FACTOR };
};

// Model prose that contradicts the app's verdict (dealer mode): "too expensive" / "full retail" next to a Fair verdict,
// "a bargain" next to Overpriced. Such sentences are dropped (the verdict and its explanation come from the bands).
const TOO_HIGH = /(too expensive|over-?priced|overpay(ing)?|over-?paying|full[- ]retail|retail[- ]level|top[- ]of[- ](the )?retail|high[- ]retail|top retail|walk away|poor value|not a (good|great) (buy|deal)|above (the )?market|steep price|pricey|trop cher|surpay|sur[ée]valu|plein tarif|prix fort|d[ée]tail (plein|haut)|haut(e)? (du |de )?(gamme du )?d[ée]tail|fourchette haute du d[ée]tail|au-dessus du (prix du )?march[ée]|passez votre chemin|mauvaise affaire|trop [ée]lev[ée])/i;
const TOO_LOW = /(good buy|great buy|strong buy|bargain|great deal|good deal|fair price|well[- ]priced|reasonably priced|good value|bonne affaire|bon achat|excellent achat|prix correct|prix raisonnable|bien plac[ée])/i;

/** Drops the sentences of `text` that contradict the verdict basis; returns the kept text and how many were dropped. */
export const dropContradictions = (text: string, basis: PriceBasis): { text: string; removed: number } => {
  if (!text || typeof text !== 'string') return { text, removed: 0 };
  const re = ['strong_buy', 'good_buy', 'fair'].includes(basis) ? TOO_HIGH : ['overpriced', 'walk_away'].includes(basis) ? TOO_LOW : null;
  if (!re) return { text, removed: 0 };
  const parts = text.match(/[^.!?;]+[.!?;]*["»”']?\s*/g) || [text];
  const kept = parts.filter(p => !re.test(p));
  if (kept.length === parts.length) return { text, removed: 0 };
  // a kept fragment that followed a dropped one starts a sentence now
  const out = kept.map(p => p.replace(/^(\s*)(\p{Ll})/u, (_m, sp: string, c: string) => sp + c.toUpperCase())).join('').trim().replace(/;$/, '.');
  return { text: out, removed: parts.length - kept.length };
};

/**
 * Dealer-mode negotiation figures: walk-away = dealer high; smart buy = top of the Good Buy band; the opening offer is
 * anchored toward the dealer low (never below the auction mid, never above the smart buy); targets between the dealer
 * low and the walk-away. All <= the walk-away.
 */
export const reconcileDealerNegotiation = (b: VerdictBands, dealerLow: number): NegotiationFigures => {
  const walk = Math.round(b.fairTop);
  const smart = Math.round(Math.min(walk, b.goodTop));
  const dLow = Math.min(walk, Math.max(0, num(dealerLow)));
  const opening = Math.round(Math.min(smart, Math.max(b.strongTop, dLow * 0.9)));
  const targetLow = Math.round(clamp(dLow, opening, walk));
  const targetHigh = Math.round(clamp((dLow + walk) / 2, targetLow, walk));
  return { good_buy_below: smart, opening_offer: opening, target_price_low: targetLow, target_price_high: targetHigh, walk_away_price: walk };
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

/** Canonical money figures from the valuation object that prose may quote. */
export type AllowedMoney = {
  marketLow: number; marketHigh: number;
  retailLow?: number; retailHigh?: number;
  smartBuy?: number; walkAway?: number; opening?: number;
  asking?: number | null; buyerCostLow?: number; buyerCostHigh?: number;
  maxBidHammer?: number | null; maxBidAllIn?: number | null;
};

const allowedSet = (a: AllowedMoney): Set<number> => {
  const s = new Set<number>();
  for (const n of [a.marketLow, a.marketHigh, a.retailLow, a.retailHigh, a.smartBuy, a.walkAway, a.opening, a.asking, a.buyerCostLow, a.buyerCostHigh, a.maxBidHammer, a.maxBidAllIn]) {
    if (n != null && Number(n) > 0) s.add(Math.round(Number(n)));
  }
  return s;
};

const MONEY_RE = new RegExp(
  String.raw`(${SYM}\s?)?${AMOUNT}(\s?${SYM})?`,
  'gi'
);

/**
 * Strip or blank out euro/£/$ figures in prose that are not in the valuation object.
 * Range phrases already aligned by alignProseRanges are kept. Catalogue estimate
 * mentions (estimate / estimation / mise à prix) are left alone.
 */
export const stripMismatchedMoney = (text: string, allowed: AllowedMoney): { text: string; stripped: number } => {
  if (!text || typeof text !== 'string') return { text, stripped: 0 };
  const ok = allowedSet(allowed);
  if (!ok.size) return { text, stripped: 0 };
  let stripped = 0;
  // Protect catalogue-estimate phrases
  const protectedSpans: Array<[number, number]> = [];
  const prot = /\b(catalogue estimate|estimation|mise à prix|estimate of|estimée?\s+[àa])\b[^.;]{0,40}/gi;
  let m: RegExpExecArray | null;
  while ((m = prot.exec(text))) protectedSpans.push([m.index, m.index + m[0].length]);
  const isProtected = (i: number) => protectedSpans.some(([a, b]) => i >= a && i < b);

  const out = text.replace(MONEY_RE, (whole, s1, amt: string, s2, offset: number) => {
    if (!(s1 || s2)) return whole; // bare number without currency symbol — leave (years, dims)
    if (isProtected(offset)) return whole;
    const n = parseAmount(amt);
    if (!Number.isFinite(n) || n <= 0) return whole;
    if (ok.has(Math.round(n))) return whole;
    // Within 1% of an allowed figure (rounding noise)
    for (const a of ok) if (Math.abs(a - n) / a < 0.01) return whole;
    stripped++;
    return s1 || s2 ? `${s1 || ''}${s2 || ''}[…]`.replace(/\s+/g, '') : whole;
  });
  // Clean awkward leftovers like "€[…]" → remove the token
  const cleaned = out.replace(/(?:€|£|\$|EUR|GBP|USD)\s*\[…\]/g, '').replace(/\s{2,}/g, ' ').replace(/\s+([.,;])/g, '$1').trim();
  return { text: cleaned, stripped };
};

/**
 * Put valuation numbers into key prose fields and strip mismatched euro figures.
 * Returns the updated item fields plus a count of stripped tokens.
 */
export const enforceNarrativeConsistency = (
  fields: { pricing_reasoning?: string; snap_judgement?: string; teaser_insight?: string; resale_insight?: string; decision_summary?: string[] },
  allowed: AllowedMoney,
  fmt: (n: number) => string,
): { fields: typeof fields; stripped: number } => {
  const ranges = {
    market: [allowed.marketLow, allowed.marketHigh] as [number, number],
    retail: [allowed.retailLow || allowed.marketLow, allowed.retailHigh || allowed.marketHigh] as [number, number],
  };
  let stripped = 0;
  const one = (s?: string) => {
    if (!s) return s;
    const aligned = alignProseRanges(s, ranges, fmt);
    const r = stripMismatchedMoney(aligned, allowed);
    stripped += r.stripped;
    return r.text;
  };
  const out = {
    pricing_reasoning: one(fields.pricing_reasoning),
    snap_judgement: one(fields.snap_judgement),
    teaser_insight: one(fields.teaser_insight),
    resale_insight: one(fields.resale_insight),
    decision_summary: Array.isArray(fields.decision_summary) ? fields.decision_summary.map(x => one(x) || '').filter(Boolean) : fields.decision_summary,
  };
  // Ensure pricing_reasoning mentions the market range from the valuation object
  if (out.pricing_reasoning && allowed.marketLow > 0 && allowed.marketHigh > 0) {
    const compact = out.pricing_reasoning.replace(/[€£$\s]/g, '');
    const hasRange = compact.includes(String(allowed.marketLow)) && compact.includes(String(allowed.marketHigh));
    if (!hasRange && !/market range|auction range|hammer/i.test(out.pricing_reasoning)) {
      out.pricing_reasoning = `${out.pricing_reasoning} Market range ${fmt(allowed.marketLow)}–${fmt(allowed.marketHigh)}.`.trim();
    }
  }
  return { fields: out, stripped };
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
  /** The period is not established (see evidenceCheck): never Strong Buy / Good Buy / Fair, show "Need more evidence" */
  needsEvidence?: boolean;
  /** Dealer / shop / private mode: the bands from dealerBands() (the asking price is judged against the dealer range) */
  bands?: VerdictBands;
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
  let ps = asking > 0 ? (i.bands ? bandScore(asking, i.bands) : priceBandScore(asking, i.marketLow, i.marketHigh, i.retailHigh)) : null;
  let cap: VerdictCap | undefined;
  if (ps) {
    const retail = i.bands ? Math.max(i.bands.fairTop, i.bands.overTop) : Math.max(num(i.marketHigh), num(i.retailHigh) || num(i.marketHigh) * 2);
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
    // Period not established: a price that only looks good if the piece is period gets no buy verdict.
    // Overpriced / Walk Away stay (they hold whatever the period turns out to be).
    if (i.needsEvidence && ['strong_buy', 'good_buy', 'fair'].includes(ps.basis)) {
      return { score: 50, band: { min: 50, max: 50 }, basis: 'need_evidence', effectivePrice: effective, ...extra };
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

// ---------------------------------------------------------------------------
// "Need more evidence": when the period is not established (period vs style / revival ambiguous, a possible
// reproduction, or low confidence on a bare description), no firm buy verdict; ask for the evidence that settles it.
// ---------------------------------------------------------------------------

export type PeriodCertainty = 'confirmed_period' | 'probable_period' | 'ambiguous' | 'later_style_or_revival';
export type EvidenceReason = 'period_ambiguous' | 'possible_reproduction' | 'low_confidence_brief' | 'period_not_confirmed';
export type EvidenceAsk = 'underside_back' | 'drawer_joints' | 'hardware_mounts' | 'seat_frame_webbing' | 'stamp_label' | 'catalogue_or_link' | 'photos';
export type PieceKind = 'case' | 'seating' | 'mirror' | 'table' | 'other';

export interface EvidenceCheckInput {
  periodCertainty?: string;          // model's item_summary.period_certainty
  reproductionRisk?: boolean;        // model's item_summary.reproduction_risk
  confidence: string;                // app's calibrated label (high / medium / low / very_low)
  typedText: string;                 // what the user typed (not the default photo prompt)
  lotPageRead: boolean;
  hasPhotos: boolean;
  category?: string;
  title?: string;
  styleText?: string;                // model's likely_style + likely_period
  constructionEvidence?: string;     // model's item_summary.construction_evidence
}

/** A concrete sign of later manufacture named by the model (replaced upholstery alone is not one). */
export const laterSignIn = (text: string): boolean =>
  /(staple|screw|machine[- ]?(cut|made|carv)|circular[- ]saw|band[- ]?saw|plywood|wire nail|phillips|mdf|chipboard|particle ?board|router|agrafe|\bvis\b|contre-?plaqu|scie circulaire|scie m[ée]canique|clous? (de )?tr[ée]fil|agglom[ée]r)/i.test(String(text || ''));

export interface EvidenceCheck {
  required: boolean;
  reasons: EvidenceReason[];
  pieceKind: PieceKind;
  asks: EvidenceAsk[];
}

/** A short note ("four 19th century armchairs") rather than a catalogue entry. */
export const isBriefInput = (typed: string, lotPageRead: boolean): boolean =>
  !lotPageRead && String(typed || '').trim().split(/\s+/).filter(Boolean).length < 12;

const KIND_WORDS: [PieceKind, RegExp][] = [
  ['seating', /(arm\s?chair|chair|fauteuil|chaise|berg[eè]re|sofa|settee|canap[eé]|banquette|stool|tabouret|bench|marquise|cabriolet|stol\b|stolar|f[åa]t[öo]lj|soffa)/i],
  ['case', /(commode|chest|drawers|armoire|wardrobe|buffet|bahut|vaisselier|dresser|secr[eé]taire|secretary|bureau|desk|cabinet|chiffonni|semainier|bonneti|encoignure|cupboard|sideboard|byr[åa]|sk[åa]p|sk[äa]nk|linen press|tallboy|bookcase|biblioth)/i],
  ['mirror', /(mirror|miroir|trumeau|glace|spegel|looking glass)/i],
  ['table', /(table|gu[eé]ridon|console|bord\b)/i],
];

/** Kind of piece (decides which evidence to ask for): from the app category, else from the title words. */
export const pieceKindOf = (category?: string, title?: string): PieceKind => {
  if (category === 'chairs') return 'seating';
  if (category === 'mirrors') return 'mirror';
  const t = String(title || '');
  // the first piece word of the title wins ("Commode with mirror" is a case piece)
  let best: { kind: PieceKind; pos: number } | null = null;
  for (const [kind, re] of KIND_WORDS) {
    const m = re.exec(t);
    if (m && (!best || m.index < best.pos)) best = { kind, pos: m.index };
  }
  return best ? best.kind : 'other';
};

/** What to ask for, specific to the kind of piece. */
export const evidenceAsks = (kind: PieceKind, opts: { hasPhotos: boolean; hasCatalogue: boolean }): EvidenceAsk[] => {
  const asks: EvidenceAsk[] = [];
  if (!opts.hasPhotos) asks.push('photos');
  asks.push('underside_back');
  if (kind === 'case') asks.push('drawer_joints');
  if (kind === 'seating') asks.push('seat_frame_webbing');
  asks.push('hardware_mounts', 'stamp_label');
  if (!opts.hasCatalogue) asks.push('catalogue_or_link');
  return asks;
};

/**
 * The description states the period the way a catalogue does ("Époque Louis XV", "Restoration period", "circa 1780",
 * "1700-tal"), not just a style or a century ("Louis XV style", "19th century").
 */
export const periodStatedIn = (text: string): boolean => {
  const t = String(text || '');
  if (/(d'?\s*[ée]poque|[ée]poque\s*[:A-Z]|\bvers\s+1[6-9]\d\d|\b(restoration|restauration|regency|georgian|victorian|empire|louis[\s-]*(xiv|xv|xvi|philippe)|napol[eé]on\s*iii|gustavian|directoire|transition)\s+period\b|\bperiod\s*:|\bcirca\s*1[6-9]\d\d|\bc\.\s?1[6-9]\d\d|\b1[6-9]\d\d\s*[-–]\s*1[6-9]\d\d\b|\b1[6-9]\d0[- ]?tal)/i.test(t)) return true;
  return /\b(george\s+(i|ii|iii|iv)|william\s+iv|queen\s+anne)\b(?![\s-]*(style|revival))/i.test(t) && !/\bstyle\b/i.test(t);
};

/** A dating in a catalogue entry ("XVIIIe siècle", "fin du XIXe", "18th century", "1800-tal"), style pieces included. */
export const centuryStatedIn = (text: string): boolean =>
  /\b([xvi]+(e|[eè]me)\s+s(i[eè]cle|\.)|(1[6-9]|20)(th|st)\s+century|1[6-9]00\s*-?\s*tal|1[6-9]00-talet)/i.test(String(text || ''));

export const evidenceCheck = (i: EvidenceCheckInput): EvidenceCheck => {
  const reasons: EvidenceReason[] = [];
  const pc = String(i.periodCertainty || '');
  // A possible later copy matters when the piece is not already identified (and priced) as a later piece, and the
  // description does not already state the period (an auction catalogue entry "Restoration period" is the house's
  // attribution; the model's generic "could be a copy" caution should not block the verdict then).
  const brief = isBriefInput(i.typedText, i.lotPageRead);
  // A catalogue that already dates the piece, or declares it a "style" piece, has answered the period question.
  const dated = periodStatedIn(i.typedText) || (!brief && (centuryStatedIn(i.typedText) || /\b(style|stil)\b/i.test(String(i.typedText || ''))));
  // A catalogue entry that states the period ("Restoration period", "d'époque", "circa 1780") is the auction house's
  // attribution: the model's doubt sends it back only when it names a concrete later sign (staples, screws, machine
  // cuts...), not on the general look.
  const catalogueDated = !brief && periodStatedIn(i.typedText);
  if (pc === 'ambiguous' && !(catalogueDated && !laterSignIn(i.constructionEvidence || ''))) reasons.push('period_ambiguous');
  if (i.reproductionRisk === true && pc !== 'later_style_or_revival' && !dated) reasons.push('possible_reproduction');
  if ((i.confidence === 'low' || i.confidence === 'very_low') && brief) reasons.push('low_confidence_brief');
  // Photos (or a short note) only: a period call, or a "revival of a historic style" call, cannot be confirmed from the
  // look of the piece alone (the same photos are read one day as period, the next as a later revival). Ask, unless the
  // model already flagged it for another reason.
  const historicStyle = /(revival|\bstyle\b|\bn[ée]o|\bneo-|in the manner|napol[eé]on\s*iii|second empire|empire|restoration|restauration|regency|louis|georgian|george|victorian|gustavian|gustaviansk|directoire|baroque|rococo|renaissance|queen anne|william|charles x|transition)/i;
  if (!reasons.length && brief && (pc === 'probable_period' || (pc === 'later_style_or_revival' && historicStyle.test(String(i.styleText || '')))))
    reasons.push('period_not_confirmed');
  const pieceKind = pieceKindOf(i.category, i.title);
  return {
    required: reasons.length > 0,
    reasons,
    pieceKind,
    asks: evidenceAsks(pieceKind, { hasPhotos: i.hasPhotos, hasCatalogue: !brief }),
  };
};
