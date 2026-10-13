import {
  alignProseRanges, enforceNarrativeConsistency, calibratedConfidence, confidenceLabel, evidenceCheck, normaliseConfidence, dropContradictions, sanitizeDeep,
  pieceKindOf, type PriceBasis, type ScoreBand,
} from "./appraisalMath";
import { type LotFacts } from "./lotFetch";
import { convertApprox } from "./budget";
import { combineMakerStatus, countPieces, detectMaker, materialOf } from "./makers";
import { anchorOnComparables, filterContaminatingComps, type CompsResponse, type CompExclusion } from "./compsMath";
import { buildNegotiationPlan } from "./negotiation";
import { buildChecklist, checksEffect, type CheckAnswers } from "./checklist";
import { buildValuation, validateValuation, assertValuationAgreement, type Valuation } from "./valuation";
import { normaliseEvidenceLedger, type EvidenceLedger } from "./evidenceLedger";
import { applyBaseBandPriors, styleEvidenceOf } from "./baseBandPriors";
import { pieceOf } from "./makers";
import { applyPhotoJudgement } from "./photoJudgement";
import type { ChecklistBase } from "./gemini";

/** Appraisal post-processing (engine). Split out of gemini.ts so the model-call file stays thin. */
export interface PostProcessContext {
  query: string; hasPhotos: boolean; askingPrice?: number; isAuction: boolean; premiumPct: number; targetCurrency: string;
  /** Benchmark leak control: drop the subject lot / same house+sale from comps. */
  excludeComps?: CompExclusion | null;
  currencySymbol: string; language: string; sellerType?: string; lotUrl?: string;
  lotFacts?: LotFacts | null; fetchedEstimate: boolean; eurTo: (eur: number) => number;
  category?: string;
  /** Verified auction comparables (null = lookup failed; undefined = not looked up) */
  comps?: CompsResponse | null;
  checkAnswers?: CheckAnswers;
  previousBase?: ChecklistBase | null;
}

/**
 * Everything the app does to the model's JSON (exported so the accuracy harness can re-apply it to a captured answer):
 * consistent negotiation figures, the verdict (hammer vs hammer), calibrated confidence, text clean-up.
 */
export const postProcessAppraisal = (result: any, ctx: PostProcessContext) => {
  const { query, hasPhotos, askingPrice, isAuction, premiumPct, targetCurrency, currencySymbol, language, sellerType, lotUrl, lotFacts, fetchedEstimate, eurTo, category, comps, checkAnswers, previousBase, excludeComps } = ctx;
  
  // Scoring configuration for easy tuning
  // Verdict label comes from the price band (never from the model), so label, reason and score always agree
  const getBuyLabel = (basis: PriceBasis) => ({
    strong_buy: "Strong Buy",
    good_buy: "Good Buy",
    fair: "Fair Price",
    overpriced: "Overpriced",
    walk_away: "Walk Away",
    high_risk: "High Risk",
    no_price: "Needs a Price",
    need_evidence: "Need More Evidence",
  } as Record<PriceBasis, string>)[basis];

  // One source of truth for confidence: confidenceLabel() (appraisalMath.ts) from the calibrated score is used for
  // item_summary.confidence AND buy_decision.confidence, and the UI renders both through the same analysis.confidence_* labels.

  // Calculate Buy Score in code based on scoring_inputs
  const items = result.items.map((item: any) => {
    const s = item.scoring_inputs;
    const c = item.item_summary.confidence_breakdown;
    
    // Confidence (fix 6): the breakdown back on its fixed scales, then calibrated with what the app knows about the
    // evidence (real estimate read from the lot page, photos)
    const nb = normaliseConfidence(c);
    Object.assign(c, nb);
    const words = query.trim().split(/\s+/).length;

    // Maker: the buyer's words first, a stamp the model read in a photo next; the checklist answer on the stamp wins
    const titleText = `${item.item_summary.title || ''}`;
    const pieceText = `${query} ${titleText}`;
    const pieces = countPieces(query) > 1 ? countPieces(query) : countPieces(titleText);
    const pieceKind = pieceKindOf(category, `${titleText} ${query}`);
    const fx = checksEffect(checkAnswers);
    let maker = combineMakerStatus(detectMaker(query), item.item_summary.maker);
    // Checklist / chip claim status is captured before stamp-answer overrides so the stamp
    // check stays on the list after the buyer confirms or denies.
    const makerAsClaimed = maker;
    let stampAnswer: 'confirmed' | 'denied' | undefined = fx.stampOverride;
    if (maker && stampAnswer === 'confirmed' && maker.status !== 'doubtful_stamp') maker = { ...maker, status: 'stamped_confirmed' };
    if (maker && stampAnswer === 'denied') maker = { ...maker, status: 'mentioned' };
    // Doubtful: never show stamped comps as anchors (chip matches valuation status)
    const compsForStatus = (maker && maker.status === 'doubtful_stamp')
      ? { ok: true as const, comparables: [] as any[], unreachable: (comps as any)?.unreachable || [], searched: (comps as any)?.searched || [], stats: (comps as any)?.stats }
      : comps;
    const excl = excludeComps || (lotUrl ? { urls: [lotUrl] } : null);
    const filtered = filterContaminatingComps(compsForStatus?.comparables || [], excl);
    const compList = filtered.kept;
    const compsContamination = filtered.dropped;
    const toTarget = (eur: number) => convertApprox(eur, 'EUR', targetCurrency) ?? eur;
    const priorLow = Number(item.price_guidance?.estimated_market_range_low) || 0;
    const priorHigh = Number(item.price_guidance?.estimated_market_range_high) || 0;
    const anchor = anchorOnComparables(compList, {
      status: maker?.status || null, pieces, material: materialOf(pieceText), isAuction, eurTo: toTarget,
      pieceText, priorLow, priorHigh, textOnly: !hasPhotos,
      // Kind of piece from the buyer's words / category first (the model title can drift), then the title
      pieceKey: (pieceOf(query, category) || pieceOf(titleText, item.item_summary.category))?.key || null,
      generic: !maker && !!(compsForStatus as any)?.generic,
    });
    const perPiece = anchor.used.map(x => isAuction ? x.perPieceHammerEur : x.perPieceAllInEur);
    const spread = perPiece.length >= 2 ? Math.max(...perPiece) / Math.max(1, Math.min(...perPiece)) : undefined;

    let confScore = calibratedConfidence(nb, {
      hasPhotos, fetchedEstimate, closeComparables: anchor.applied ? anchor.used.length : 0, comparableSpread: spread,
      vague: words <= 3 && !hasPhotos && !lotFacts?.ok,
    });
    confScore += fx.confidenceDelta;
    if (maker && maker.status === 'stamped_confirmed' && !stampAnswer && anchor.applied) confScore += 3;
    
    // Strict Evidence Grounding:
    // If NO photos were provided, confidence can NEVER be high, and evidence quality must be capped.
    if (!hasPhotos) {
      c.evidence_quality = Math.min(c.evidence_quality || 12, 14);
      if (!item.item_summary.confidence_reason.includes('photographic') && !item.item_summary.confidence_reason.includes('photos')) {
        item.item_summary.confidence_reason = `Based on your description (no photos). Stamped marks, joinery, and authenticity cannot be confirmed without visual inspection. ${item.item_summary.confidence_reason}`;
      }
      if (!item.price_guidance.pricing_reasoning.includes('photos') && !item.price_guidance.pricing_reasoning.includes('photographs')) {
        item.price_guidance.pricing_reasoning = `Based on your description only. Photos of construction and condition would change this estimate. ${item.price_guidance.pricing_reasoning}`;
      }
    }

    // Vague queries (e.g. "old table", "chair") with no details
    if (words <= 3 && !hasPhotos && !lotFacts?.ok) {
      item.item_summary.confidence_reason = `Speculative estimate: Query '${query}' is too generic with no images or provenance. ${item.item_summary.confidence_reason}`;
      item.price_guidance.pricing_reasoning = `Speculative valuation: A generic '${query}' can range from a modern utility piece to fine period antique. Inspect construction before relying on numbers. ${item.price_guidance.pricing_reasoning}`;
    }

    // Photo judgement (period / confidence part): a stamp read from a photo or signs of later additions cannot by
    // themselves mean "confirmed period". The range part is applied after the base-band priors below.
    const originalPeriodCertainty = item.item_summary.period_certainty;
    const pjStyleEvidence = styleEvidenceOf({
      userOrCatalogueText: `${query || ''} ${lotFacts?.ok ? `${lotFacts.title || ''} ${(lotFacts as any).description || ''}` : ''}`,
      constructionEvidence: item.item_summary.construction_evidence,
    });
    const pjModelText = [item.item_summary.title, item.item_summary.snap_judgement, item.item_summary.condition_summary,
      item.item_summary.confidence_reason, item.price_guidance?.pricing_reasoning,
      JSON.stringify(item.evidence_ledger || {}), JSON.stringify(item.condition || '')].filter(Boolean).join(' ');
    const pjInput = {
      hasPhotos, userText: `${query || ''} ${lotFacts?.ok ? `${lotFacts.title || ''} ${(lotFacts as any).description || ''}` : ''}`,
      periodCertainty: originalPeriodCertainty, modelMakerStatus: item.item_summary?.maker?.status, makerStatus: maker?.status || null,
      constructionEvidence: item.item_summary.construction_evidence, modelText: pjModelText, styleEvidence: pjStyleEvidence,
    };
    const pjEarly = applyPhotoJudgement({ ...pjInput, low: Number(item.price_guidance?.estimated_market_range_low) || 0, high: Number(item.price_guidance?.estimated_market_range_high) || 0 });
    if (pjEarly.periodCertainty !== originalPeriodCertainty) item.item_summary.period_certainty = pjEarly.periodCertainty;
    confScore = Math.min(confScore, pjEarly.confidenceCap);

    const finalConfScore = Math.max(1, Math.min(100, Math.round(confScore)));
    const confLabel = confidenceLabel(finalConfScore);

    // "Need more evidence": period not established -> no firm buy verdict, provisional range, ask for evidence
    const evidence = evidenceCheck({
      periodCertainty: item.item_summary.period_certainty,
      reproductionRisk: item.item_summary.reproduction_risk,
      confidence: confLabel,
      typedText: query,
      lotPageRead: !!lotFacts?.ok,
      hasPhotos,
      category,
      title: `${item.item_summary.title || ''} ${query || ''}`,
      styleText: `${item.item_summary.likely_style || ''} ${item.item_summary.likely_period || ''}`,
      constructionEvidence: item.item_summary.construction_evidence,
    });

    if (fx.periodConfirmed && evidence.required) {
      const keep = evidence.reasons.filter(r => r === 'low_confidence_brief' && confLabel !== 'medium' && confLabel !== 'high');
      evidence.reasons = keep; evidence.required = keep.length > 0;
    }

    // Comparables anchor the MARKET range only — never invent dealer retail via ×1.3/×1.6.
    const pgA = item.price_guidance;
    if (anchor.applied) {
      pgA.estimated_market_range_low = anchor.low;
      pgA.estimated_market_range_high = anchor.high;
    }
    // A re-run with answers starts from the range the checklist was shown with, unless the stamp basis
    // changed or verified comparables now anchor it.
    const stampedNow = !!maker && ['stamped_confirmed', 'stamped_stated', 'stamp_in_photo'].includes(maker.status);
    const stampedBefore = ['stamped_confirmed', 'stamped_stated', 'stamp_in_photo'].includes(String(previousBase?.maker_status));
    let restoredFromChecklistBase = false;
    if (checkAnswers && previousBase && previousBase.low > 0 && previousBase.high >= previousBase.low && !anchor.applied && stampedNow === stampedBefore) {
      pgA.estimated_market_range_low = previousBase.low; pgA.estimated_market_range_high = previousBase.high;
      pgA.fair_price_low = previousBase.fair_low; pgA.fair_price_high = previousBase.fair_high;
      restoredFromChecklistBase = true;
    }
    // Checklist denials / confirmations adjust the market range before the valuation object is built.
    if (fx.rangeFactor !== 1 || fx.narrowLow > 0) {
      const lo = Number(pgA.estimated_market_range_low) || 0, hi = Number(pgA.estimated_market_range_high) || lo;
      const f = fx.rangeFactor;
      const r = (x: number) => x >= 1000 ? Math.round(x / 50) * 50 : Math.round(x / 10) * 10;
      pgA.estimated_market_range_low = r((lo + (hi - lo) * fx.narrowLow) * f);
      pgA.estimated_market_range_high = r(hi * f);
      if (Number(pgA.fair_price_low) > 0) pgA.fair_price_low = r(Number(pgA.fair_price_low) * f);
      if (Number(pgA.fair_price_high) > 0) pgA.fair_price_high = r(Number(pgA.fair_price_high) * f);
    }
    if (maker && (maker.status === 'stamped_confirmed' || maker.status === 'stamped_stated' || maker.status === 'stamp_in_photo'))
      item.item_summary.title = String(item.item_summary.title || '').replace(/,?\s*\(?\s*attributed\s+to\s+[^),]*\)?/i, ` (stamped ${maker.name})`).replace(/,?\s*\(?\s*attribu[ée]e?s?\s+[àa]\s+[^),]*\)?/i, ` (estampillé ${maker.name})`).replace(/\s{2,}/g, ' ').trim();

    const maxEstimate = Number(item.price_guidance.estimated_market_range_high) || 0;
    if (maxEstimate < 5000 && item.item_summary.value_tier === 'A') {
      item.item_summary.value_tier = maxEstimate >= 200 ? 'B' : maxEstimate >= 20 ? 'C' : 'D';
    }
    const cleanContradictions = (text: string) => {
      if (!text) return text;
      if (maxEstimate < 10000) {
        return text.replace(/five-figure\s*(investment|sum|value)?/gi, 'three-to-four-figure')
                   .replace(/5-figure\s*(investment|sum|value)?/gi, 'modest mid-tier')
                   .replace(/museum-grade/gi, 'collectible quality');
      }
      return text;
    };
    item.item_summary.snap_judgement = cleanContradictions(item.item_summary.snap_judgement);
    item.buy_decision.investment_insight = cleanContradictions(item.buy_decision.investment_insight);
    item.buy_decision.resale_insight = cleanContradictions(item.buy_decision.resale_insight);

    const pg = item.price_guidance;
    pg.estimated_market_range_low = Math.max(0, Number(pg.estimated_market_range_low) || 0);
    pg.estimated_market_range_high = Math.max(pg.estimated_market_range_low, Number(pg.estimated_market_range_high) || pg.estimated_market_range_low * 1.5);
    pg.currency = targetCurrency;

    // Base-band priors when comps did not anchor: style-vs-period, condition, lighting/category caps.
    const draftLedger = normaliseEvidenceLedger(item.evidence_ledger, {
      hasPhotos,
      styleText: `${item.item_summary.likely_style || ''} ${item.item_summary.likely_period || ''} ${query || ''}`,
    });
    const catForPrior = category && category !== 'unknown' ? category : (item.item_summary.category || '');
    // Checklist-base restore already carries the prior-adjusted band; do not re-apply (width
    // calibration would expand the locked high after confirmations raise the low).
    if (!restoredFromChecklistBase) {
      const prior = applyBaseBandPriors({
        marketLow: pg.estimated_market_range_low,
        marketHigh: pg.estimated_market_range_high,
        category: catForPrior,
        periodCertainty: item.item_summary.period_certainty,
        styleNote: draftLedger.style_note,
        title: item.item_summary.title,
        query,
        defects: draftLedger.defects,
        claims: draftLedger.claims,
        compsAnchored: !!anchor.applied,
        textOnly: !hasPhotos,
        styleEvidence: styleEvidenceOf({
          userOrCatalogueText: `${query || ''} ${lotFacts?.ok ? `${lotFacts.title || ''} ${(lotFacts as any).description || ''}` : ''}`,
          constructionEvidence: item.item_summary.construction_evidence,
        }),
      });
      if (prior.factors.includes('style_hypothesis_widened_down')) {
        (item.item_summary as any).period_hypothesis = 'later_style_or_revival';
        pg.pricing_reasoning = `${pg.pricing_reasoning || ''} Hypothesis: the "later style / revival" reading comes from the look of the piece only (no stamp, construction or catalogue evidence), so the range is widened downward rather than cut; a period piece could reach the upper figure.`.trim();
      }
      if (prior.factors.length) {
        pg.estimated_market_range_low = prior.low;
        pg.estimated_market_range_high = prior.high;
        (item as any)._band_priors = prior;
        const note = prior.factors.filter(f => !f.endsWith('_note')).join(', ');
        if (note) {
          pg.pricing_reasoning = `${pg.pricing_reasoning || ''} [Band prior: ${note}].`.trim();
        }
      }
    }
    if (!restoredFromChecklistBase && !anchor.applied) {
      const pj = applyPhotoJudgement({ ...pjInput, low: pg.estimated_market_range_low, high: pg.estimated_market_range_high });
      if (pj.factors.length) {
        pg.estimated_market_range_low = pj.low;
        pg.estimated_market_range_high = pj.high;
        (item as any)._photo_judgement = { factors: pj.factors, period_certainty_model: originalPeriodCertainty, period_certainty: item.item_summary.period_certainty };
        pg.pricing_reasoning = `${pg.pricing_reasoning || ''} ${pj.notes.join(' ')}`.trim();
      }
    }
    const rawMidEur = convertApprox((pg.estimated_market_range_low + pg.estimated_market_range_high) / 2, targetCurrency, 'EUR') ?? 0;

    // Dealer retail: only when the model stated a retail tier above the market — labelled assumption.
    // Never invent ×1.3/×1.6 from the auction/comps range.
    const modelFairLo = Number(pg.fair_price_low) || 0;
    const modelFairHi = Number(pg.fair_price_high) || 0;
    const hasDealerAssumption = !isAuction && modelFairHi > pg.estimated_market_range_high * 1.05 && modelFairHi > modelFairLo;

    const calculatedScore =
      (s.authenticity || 0) + (s.condition || 0) + (s.rarity_desirability || 0) +
      (s.market_demand || 0) + (s.price_vs_market || 0) + (s.liquidity || 0) + (s.risk_penalty || 0);

    const valuation: Valuation = buildValuation({
      currency: targetCurrency,
      isAuction,
      premiumPct,
      askingPrice: Number(askingPrice) > 0 ? Number(askingPrice) : null,
      hasPhotos,
      market: {
        low: pg.estimated_market_range_low,
        high: pg.estimated_market_range_high,
        currency: targetCurrency,
        basis: isAuction ? 'hammer' : 'all_in',
        provisional: !!evidence.required || !hasPhotos,
      },
      dealerRetail: hasDealerAssumption
        ? { low: modelFairLo, high: modelFairHi, currency: targetCurrency, basis: 'asking', provisional: true }
        : null,
      dealerEvidence: hasDealerAssumption ? 'assumption' : 'none',
      riskPenalty: Number(s.risk_penalty) || 0,
      itemScore: calculatedScore,
      valueTier: item.item_summary.value_tier,
      needsEvidence: evidence.required,
    });
    assertValuationAgreement(valuation);

    // Project the single valuation onto the legacy price_guidance / negotiation_strategy shapes
    // so every panel (and checklist re-run base) reads the same numbers.
    pg.estimated_market_range_low = valuation.expectedHammer.low;
    pg.estimated_market_range_high = valuation.expectedHammer.high;
    if (valuation.dealerRetail) {
      pg.fair_price_low = valuation.dealerRetail.low;
      pg.fair_price_high = valuation.dealerRetail.high;
    } else {
      // No dealer evidence: clear invented retail; UI shows market + "no dealer evidence"
      pg.fair_price_low = valuation.expectedHammer.low;
      pg.fair_price_high = valuation.expectedHammer.high;
    }
    pg.good_buy_below = valuation.suggestedAcquisition ?? valuation.expectedHammer.low;
    pg.overpaying_above = valuation.overpayingAbove;
    if (evidence.required || valuation.provisional) pg.provisional = true;

    const ns = item.negotiation_strategy || (item.negotiation_strategy = {});
    ns.opening_offer = valuation.openingOffer ?? 0;
    ns.target_price_low = valuation.suggestedAcquisition ?? 0;
    ns.target_price_high = valuation.targetHigh ?? valuation.walkAway;
    ns.walk_away_price = valuation.walkAway;

    const checklistBase: ChecklistBase = {
      low: valuation.expectedHammer.low, high: valuation.expectedHammer.high,
      fair_low: valuation.dealerRetail?.low ?? valuation.expectedHammer.low,
      fair_high: valuation.dealerRetail?.high ?? valuation.expectedHammer.high,
      maker_status: maker?.status || null,
    };

    const bands = valuation.bands || undefined;
    const nf = {
      good_buy_below: valuation.suggestedAcquisition ?? valuation.expectedHammer.low,
      opening_offer: valuation.openingOffer ?? 0,
      target_price_low: valuation.suggestedAcquisition ?? 0,
      target_price_high: valuation.targetHigh ?? valuation.walkAway,
      walk_away_price: valuation.walkAway,
    };

    // Teaser from the valuation object only
    const money = (n: number) => { try { return new Intl.NumberFormat(language || 'en', { style: 'currency', currency: targetCurrency, maximumFractionDigits: 0 }).format(Math.round(n)); } catch { return `${currencySymbol}${Math.round(n)}`; } };
    if (valuation.dealerEvidence === 'none' && !isAuction) {
      item.teaser_insight = `Auction/market range ${money(valuation.expectedHammer.low)}–${money(valuation.expectedHammer.high)}. No dealer-retail evidence — shop walk-away is the market high (${money(valuation.walkAway)}), not an invented margin.`;
    } else if (valuation.suggestedAcquisition != null) {
      item.teaser_insight = valuation.dealerRetail
        ? `A good shop price is below ${money(valuation.suggestedAcquisition)}. Above ${money(valuation.walkAway)} (dealer range top, labelled assumption), you are overpaying.`
        : `Dealers would typically buy below ${money(valuation.suggestedAcquisition)}${isAuction ? ' (hammer)' : ''}. Above ${money(valuation.walkAway)}, you are overpaying.`;
    }

    const decision = valuation.decision;
    const allIn = decision?.effectivePrice;
    const finalScore = decision?.score ?? 0;
    const scoreBand: ScoreBand = decision?.band ?? { min: 0, max: 14 };
    const basis: PriceBasis = decision?.basis ?? 'no_price';
    const cappedScore = Math.max(1, Math.min(100, Math.round(finalScore)));

    let proseRemoved = 0;
    if (bands && valuation.buyScoreAllowed && decision && ['strong_buy', 'good_buy', 'fair', 'overpriced', 'walk_away'].includes(basis)) {
      const fr = String(language || '').toLowerCase().startsWith('fr');
      const m = (n: number) => { try { return new Intl.NumberFormat(fr ? 'fr-FR' : (language || 'en'), { style: 'currency', currency: targetCurrency, maximumFractionDigits: 0 }).format(Math.round(n)); } catch { return `${currencySymbol}${Math.round(n)}`; } };
      const ask = m(Number(askingPrice)), dl = m(pg.fair_price_low), dh = m(pg.fair_price_high), al = m(pg.estimated_market_range_low), ah = m(pg.estimated_market_range_high);
      const band: Record<string, [string, string]> = {
        strong_buy: [`${ask} is at or below the middle of the auction range: a strong buy for a shop price.`, `${ask} est au niveau ou en dessous du milieu de la fourchette aux enchères : un excellent prix en boutique.`],
        good_buy: [`${ask} is below the dealer range (${dl}–${dh}): a good shop price.`, `${ask} est sous la fourchette marchand (${dl}–${dh}) : un bon prix en boutique.`],
        fair: [`${ask} is within the dealer range (${dl}–${dh}): a fair shop price.`, `${ask} est dans la fourchette marchand (${dl}–${dh}) : un prix correct en boutique.`],
        overpriced: [`${ask} is above the dealer range (${dl}–${dh}): overpriced, even for a shop.`, `${ask} dépasse la fourchette marchand (${dl}–${dh}) : trop cher, même en boutique.`],
        walk_away: [`${ask} is well above the dealer range (${dl}–${dh}): walk away.`, `${ask} est bien au-dessus de la fourchette marchand (${dl}–${dh}) : passez votre chemin.`],
      };
      const verdictLine = band[basis][fr ? 1 : 0];
      const auctionLine = fr ? `Aux enchères, la pièce ferait environ ${al}–${ah} (marteau).` : `At auction it would make about ${al}–${ah} (hammer).`;
      const fix = (t: any) => { if (typeof t !== 'string') return t; const r = dropContradictions(t, basis); proseRemoved += r.removed; return r.text || verdictLine; };
      const fixList = (a: any) => { if (!Array.isArray(a)) return a; const out = a.map((x: any) => { const r = dropContradictions(String(x || ''), basis); proseRemoved += r.removed; return r.text; }).filter((x: string) => x); return out.length ? out : [verdictLine]; };
      const is = item.item_summary || {}, bd = item.buy_decision || {}, dtk = item.dealer_take || {};
      is.snap_judgement = fix(is.snap_judgement);
      bd.decision_summary = fixList(bd.decision_summary);
      bd.investment_insight = fix(bd.investment_insight); bd.must_have_insight = fix(bd.must_have_insight); bd.resale_insight = fix(bd.resale_insight);
      dtk.dealer_view = fixList(dtk.dealer_view); dtk.resale_strategy = fix(dtk.resale_strategy);
      item.teaser_insight = fix(item.teaser_insight);
      const pr = dropContradictions(String(pg.pricing_reasoning || ''), basis); proseRemoved += pr.removed;
      pg.pricing_reasoning = `${verdictLine} ${auctionLine} ${pr.text}`.trim();
    }

    const fmtMoney = (n: number) => {
      try {
        return new Intl.NumberFormat(language || 'en', { style: 'currency', currency: targetCurrency, maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(Math.round(n));
      } catch {
        return `${currencySymbol}${Math.round(n).toLocaleString()}`;
      }
    };
    const ranges = {
      market: [pg.estimated_market_range_low, pg.estimated_market_range_high] as [number, number],
      retail: [pg.fair_price_low, pg.fair_price_high] as [number, number],
    };
    const align = (v: any): any => typeof v === 'string' ? alignProseRanges(v, ranges, fmtMoney)
      : Array.isArray(v) ? v.map(align)
      : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, align(x)]))
      : v;
    const cleaned: any = align(sanitizeDeep(item));
    // Narrative consistency: only valuation figures may appear as money in key prose.
    const narr = enforceNarrativeConsistency({
      pricing_reasoning: cleaned.price_guidance?.pricing_reasoning,
      snap_judgement: cleaned.item_summary?.snap_judgement,
      teaser_insight: cleaned.teaser_insight,
      resale_insight: cleaned.buy_decision?.resale_insight,
      decision_summary: cleaned.buy_decision?.decision_summary,
    }, {
      marketLow: valuation.expectedHammer.low,
      marketHigh: valuation.expectedHammer.high,
      retailLow: valuation.dealerRetail?.low ?? valuation.expectedHammer.low,
      retailHigh: valuation.dealerRetail?.high ?? valuation.expectedHammer.high,
      smartBuy: valuation.suggestedAcquisition ?? undefined,
      walkAway: valuation.walkAway,
      opening: valuation.openingOffer ?? undefined,
      asking: valuation.askingPrice,
      buyerCostLow: valuation.buyerCost.low,
      buyerCostHigh: valuation.buyerCost.high,
      maxBidHammer: valuation.maxBidHammer,
      maxBidAllIn: valuation.maxBidAllIn,
    }, fmtMoney);
    if (cleaned.price_guidance) cleaned.price_guidance.pricing_reasoning = narr.fields.pricing_reasoning;
    if (cleaned.item_summary) cleaned.item_summary.snap_judgement = narr.fields.snap_judgement;
    cleaned.teaser_insight = narr.fields.teaser_insight;
    if (cleaned.buy_decision) {
      cleaned.buy_decision.resale_insight = narr.fields.resale_insight;
      if (narr.fields.decision_summary) cleaned.buy_decision.decision_summary = narr.fields.decision_summary;
      cleaned.buy_decision.narrative_money_stripped = narr.stripped || undefined;
    }
    item = cleaned;
    // Final coherence: every displayed money figure is projected from the valuation object
    // (narrative/align must not leave a divergent teaser or guidance card).
    {
      const moneyF = (n: number) => { try { return new Intl.NumberFormat(language || 'en', { style: 'currency', currency: targetCurrency, maximumFractionDigits: 0 }).format(Math.round(n)); } catch { return `${currencySymbol}${Math.round(n)}`; } };
      item.price_guidance = {
        ...item.price_guidance,
        estimated_market_range_low: valuation.expectedHammer.low,
        estimated_market_range_high: valuation.expectedHammer.high,
        fair_price_low: valuation.dealerRetail?.low ?? valuation.expectedHammer.low,
        fair_price_high: valuation.dealerRetail?.high ?? valuation.expectedHammer.high,
        good_buy_below: valuation.suggestedAcquisition ?? valuation.expectedHammer.low,
        overpaying_above: valuation.overpayingAbove,
        currency: targetCurrency,
      };
      item.negotiation_strategy = {
        ...item.negotiation_strategy,
        opening_offer: valuation.openingOffer ?? 0,
        target_price_low: valuation.suggestedAcquisition ?? 0,
        target_price_high: valuation.targetHigh ?? valuation.walkAway,
        walk_away_price: valuation.walkAway,
      };
      if (valuation.dealerEvidence === 'none' && !isAuction) {
        item.teaser_insight = `Auction/market range ${moneyF(valuation.expectedHammer.low)}–${moneyF(valuation.expectedHammer.high)}. No dealer-retail evidence — shop walk-away is the market high (${moneyF(valuation.walkAway)}), not an invented margin.`;
      } else if (valuation.suggestedAcquisition != null) {
        item.teaser_insight = valuation.dealerRetail
          ? `A good shop price is below ${moneyF(valuation.suggestedAcquisition)}. Above ${moneyF(valuation.walkAway)} (dealer range top, labelled assumption), you are overpaying.`
          : `Dealers would typically buy below ${moneyF(valuation.suggestedAcquisition)}${isAuction ? ' (hammer)' : ''}. Above ${moneyF(valuation.walkAway)}, you are overpaying.`;
      }
    }
    if (evidence.required) item.price_guidance = { ...item.price_guidance, provisional: true };
    if (anchor.applied) {
      const money0 = (n: number) => { try { return new Intl.NumberFormat(language || 'en', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(n)); } catch { return `€${Math.round(n)}`; } };
      const how = anchor.blended ? 'Blended prior range with' : 'Anchored on';
      const capNote = anchor.capped ? ' Text-only lift capped against the prior range.' : '';
      item.price_guidance = { ...item.price_guidance, pricing_reasoning: `${how} ${anchor.used.length} matched verified auction results for ${anchor.group === 'generic' ? `comparable unsigned ${anchor.used.length > 1 ? 'pieces of the same type' : 'piece'} (no maker; weaker evidence, blended)` : `${anchor.group === 'stamped' ? 'stamped' : 'attributed'} ${maker?.name} pieces`} (median ${money0(anchor.perPieceMedianEur)} per piece ${isAuction ? 'hammer' : 'incl. fees'}, × ${anchor.pieces}).${capNote} ${item.price_guidance.pricing_reasoning || ''}`.trim() };
    }
    const checklistItems = buildChecklist({
      pieceKind, pieces, period: item.item_summary.likely_period, maker: makerAsClaimed ? { name: makerAsClaimed.name, status: makerAsClaimed.status } : null,
      basis, text: query, category,
    });


    const evidenceLedger: EvidenceLedger = normaliseEvidenceLedger(item.evidence_ledger, {
      hasPhotos,
      styleText: `${item.item_summary.likely_style || ''} ${item.item_summary.likely_period || ''} ${query || ''}`,
    });
    // Negotiate / bidding tips: only figures from the valuation object (no duplicate maths).
    const negotiationPlan = buildNegotiationPlan({
      sellerType, isAuction, askingPrice: valuation.askingPrice ?? undefined, currency: targetCurrency,
      walkAway: valuation.walkAway,
      openingOffer: valuation.openingOffer ?? undefined,
      targetHigh: valuation.targetHigh ?? undefined,
      premiumPct: valuation.premiumPct,
      dealerLow: valuation.dealerRetail?.low,
      maxBidHammer: valuation.maxBidHammer ?? undefined,
      maxBidAllIn: valuation.maxBidAllIn ?? undefined,
      checklist: checklistItems, answers: checkAnswers,
      maker: makerAsClaimed && !['mentioned', 'dealer_label', 'doubtful_stamp'].includes(makerAsClaimed.status) ? makerAsClaimed.name : null,
      period: item.item_summary.likely_period, text: `${query} ${titleText}`, pieces, pieceKind,
    });

    return {
      ...item,
      valuation,
      valuation_errors: validateValuation(valuation),
      evidence_ledger: evidenceLedger,
      band_priors: (item as any)._band_priors || null,
      photo_judgement: (item as any)._photo_judgement || null,
      negotiation_plan: negotiationPlan,
      evidence_check: evidence,
      maker_attribution: maker ? { name: maker.name, status: maker.status, source: maker.source, jme: !!maker.jme, stamp_answer: stampAnswer || null, model_evidence: item.item_summary?.maker?.evidence || null } : null,
      comparables: {
        status: compsForStatus === undefined ? (maker ? 'not_searched' : 'no_maker') : compsForStatus === null || compsForStatus.ok === false ? 'error' : maker?.status === 'doubtful_stamp' ? 'not_stamped' : compList.length === 0 ? 'none_verified' : anchor.relevant.length === 0 ? 'none_relevant' : anchor.applied ? (anchor.blended ? 'anchored' : 'anchored') : 'shown',
        generic: !maker && !!(compsForStatus as any)?.generic,
        reason: anchor.reason, group: anchor.group, pieces: anchor.pieces, per_piece_median_eur: anchor.perPieceMedianEur || null, basis: anchor.basis,
        blended: !!anchor.blended, capped: !!anchor.capped,
        // Only comps that pass the relevance gate (same kind of piece, not a ×5 outlier) are shown; none if none pass.
        list: anchor.relevant, used_urls: anchor.used.map(x => x.url), nearest: anchor.nearest || [], unreachable: compsForStatus?.unreachable || [],
        contamination: compsContamination,
      },
      checklist: { items: checklistItems, answers: checkAnswers || {}, base: checklistBase, effect: { confidence_delta: fx.confidenceDelta, range_factor: fx.rangeFactor, yes: fx.yes, no: fx.no } },
      appraisal_inputs: {
        lot_page_read: !!lotFacts?.ok, estimate_read: fetchedEstimate, band_factor: 1, raw_mid_eur: Math.round(rawMidEur),
      },
      seller_context: {
        sellerType: sellerType || 'Market/Fair',
        isAuction,
        lotUrl: lotUrl || null,
        buyerPremiumRate: premiumPct,
        allInPrice: allIn || null
      },
      item_summary: {
        ...item.item_summary,
        confidence: confLabel,
        confidence_score: finalConfScore
      },
      buy_decision: {
        ...item.buy_decision,
        score: cappedScore,
        score_band: scoreBand,
        price_basis: basis,
        price_cap: decision?.cap || null,
        smart_buy_all_in: decision?.smartBuyAllIn || null,
        walk_away_all_in: decision?.walkAwayAllIn || null,
        effective_price: allIn || null,
        compare_price: decision?.comparePrice || null,
        price_scale: bands ? 'dealer' : 'auction',
        dealer_evidence: valuation.dealerEvidence,
        prose_sentences_removed: bands ? proseRemoved : undefined,
        dealer_bands: bands ? { strong_buy_to: Math.round(bands.strongTop), good_buy_to: Math.round(bands.goodTop), fair_to: Math.round(bands.fairTop), overpriced_to: Math.round(bands.overTop) } : null,
        label: valuation.buyScoreAllowed ? getBuyLabel(basis) : getBuyLabel('no_price'),
        confidence: confLabel
      }
    };
  });

  return items;
};
