// Accuracy harness, part B (fix 10): re-apply the app's own post-processing (postProcessAppraisal in src/services/gemini.ts)
// to each raw model answer captured by appraise_ui.py, with the actual hammer typed as the price, so the verdict the app
// WOULD show at the hammer can be scored.
//   npx tsx scripts/accuracy/postprocess.mts <runs dir> <out.json>
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { postProcessAppraisal } from '../../src/services/gemini.ts';

const here = dirname(fileURLToPath(import.meta.url));
const runsDir = process.argv[2] || 'runs';
const outFile = process.argv[3] || 'appraisal_results.json';
const li = process.argv.indexOf('--lots');
const lots: any[] = JSON.parse(readFileSync(li > 0 ? process.argv[li + 1] : join(here, 'lots_split.json'), 'utf8')).lots;
const byId = Object.fromEntries(lots.map(l => [l.lot_id, l]));
const testIds = new Set(lots.map(l => l.lot_id));

const out: any[] = [];
for (const f of readdirSync(runsDir).filter(f => f.endsWith('.json')).sort()) {
  const r = JSON.parse(readFileSync(join(runsDir, f), 'utf8'));
  const lot = byId[r.lot_id];
  if (!lot) continue;
  if (!r.raw?.body?.candidates) { out.push({ file: f, lot_id: r.lot_id, tag: r.tag, split: lot.split, error: r.error || JSON.stringify(r.raw || {}).slice(0, 300) }); continue; }
  const prompt = JSON.stringify(r.raw.request || {});
  const result = JSON.parse(r.raw.body.candidates[0].content.parts[0].text);
  const modelConf = result.items?.[0]?.item_summary?.confidence;
  // the ORIGINAL confidence rule (main before fix 6): raw sum of the breakdown, capped at 50 without photos, 35 when vague
  const rb = { ...(result.items?.[0]?.item_summary?.confidence_breakdown || {}) };
  let oldConf = (Number(rb.evidence_quality) || 0) + (Number(rb.identification_certainty) || 0) + (Number(rb.risk_factors) || 0);
  const lf = r.raw.lot && r.raw.lot.ok ? r.raw.lot : null;
  const mode = r.mode || 'photos';
  const query = r.query !== undefined ? r.query : mode === 'url' ? (lf ? [lf.title, lf.description].filter(Boolean).join('\n') : `Auction lot: ${lot.url}`) : lot.text;
  const compText = [query, lf ? `${lf.title || ''}\n${lf.description || ''}` : ''].filter(Boolean).join('\n');
  const location = mode === 'url' ? (lf?.city || undefined) : lot.location;
  const premiumPct = mode === 'url' ? (lf?.premiumPct || 25) : Number(lot.premium_pct);
  const hasPhotos = r.images > 0 || (mode === 'url' && /inlineData/.test(prompt));
  if (!hasPhotos) oldConf = Math.min(oldConf, 50);
  const oldConfScore = Math.max(1, Math.min(100, Math.round(oldConf)));
  const oldConfLabel = oldConfScore >= 80 ? 'high' : oldConfScore >= 60 ? 'medium' : oldConfScore >= 40 ? 'low' : 'very_low';
  const fetchedEstimate = !!(lf && (lf.estimateLow || lf.estimateHigh));
  const pp = postProcessAppraisal(result, {
    query, hasPhotos, askingPrice: r.hammer ?? lot.hammer_eur, isAuction: r.dealer ? false : true, premiumPct: r.dealer ? 0 : premiumPct, targetCurrency: 'EUR', currencySymbol: '€',
    language: 'en', sellerType: r.dealer ? 'Antique Shop' : 'Auction',
    // maker comparables captured from /api/comps by appraise_ui.py (undefined when the app did not search)
    comps: r.comps !== undefined ? r.comps : r.raw.comps, checkAnswers: r.checkAnswers, lotUrl: mode === 'url' ? lot.url : undefined, lotFacts: lf,
    fetchedEstimate, eurTo: (e: number) => e, category: r.category !== undefined ? r.category : lot.category,
  });
  const item: any = pp[0], pg = item.price_guidance, ns = item.negotiation_strategy, bd = item.buy_decision;
  out.push({
    file: f, lot_id: r.lot_id, tag: r.tag, mode, split: lot.split, images: r.images, elapsed_s: r.elapsed_s, type: lot.type, url: lot.url,
    est_low_eur: lot.est_low_eur, est_high_eur: lot.est_high_eur, hammer_eur: lot.hammer_eur, premium_pct: premiumPct,
    app_low: pg.estimated_market_range_low, app_high: pg.estimated_market_range_high, retail_low: pg.fair_price_low, retail_high: pg.fair_price_high,
    smart_buy_hammer: pg.good_buy_below, walk_away_hammer: ns?.walk_away_price, verdict_at_hammer: bd.label, score_at_hammer: bd.score,
    compare_price: bd.compare_price, all_in_at_hammer: Math.round(lot.hammer_eur * (1 + premiumPct / 100)),
    title: item.item_summary.title, likely_period: item.item_summary.likely_period, likely_style: item.item_summary.likely_style,
    model_conf_breakdown: item.item_summary.confidence_breakdown, app_confidence_score: item.item_summary.confidence_score, model_confidence: modelConf, old_rule_confidence: oldConfLabel, old_rule_confidence_score: oldConfScore, raw_breakdown: rb,
    app_confidence: item.item_summary.confidence, appraisal_inputs: item.appraisal_inputs,
    prompt_has_estimate_claim: /anchor(ed)? to the (catalogue )?estimate/i.test(JSON.stringify(result)),
    lot_page: lf ? { ok: lf.ok, estimateLow: lf.estimateLow, estimateHigh: lf.estimateHigh, premiumPct: lf.premiumPct, currency: lf.currency } : null,
    reasoning: pg.pricing_reasoning,
    likely_style_raw: item.item_summary.likely_style, period_certainty: item.item_summary.period_certainty ?? null, reproduction_risk: item.item_summary.reproduction_risk ?? null,
    construction_evidence: item.item_summary.construction_evidence ?? null,
    evidence_required: !!item.evidence_check?.required, evidence_reasons: item.evidence_check?.reasons || [], evidence_asks: item.evidence_check?.asks || [],
    price_basis: bd.price_basis, provisional: !!pg.provisional,
    maker_attribution: item.maker_attribution ?? null,
    comps_status: item.comparables?.status ?? null, comps_reason: item.comparables?.reason ?? null, comps_n: item.comparables?.list?.length ?? 0, comps_used: item.comparables?.used_urls?.length ?? 0,
    comps_stats: r.raw.comps?.stats ?? null, checklist_ids: (item.checklist?.items || []).map((c: any) => c.id), checklist_effect: item.checklist?.effect ?? null,
  });
}
writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log(out.length, 'runs processed;', out.filter(o => o.error).length, 'errors');
