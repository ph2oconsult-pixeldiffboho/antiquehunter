// Accuracy harness, part B (fix 10): re-apply the app's own post-processing (postProcessAppraisal in src/services/gemini.ts)
// to each raw model answer captured by appraise_ui.py, with the actual hammer typed as the price, so the verdict the app
// WOULD show at the hammer can be scored. Comparables are recomputed with the same dataset and checked against the
// comparables that were really in the captured prompt.
//   npx tsx scripts/accuracy/postprocess.mts <runs dir> <out.json>
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { postProcessAppraisal } from '../../src/services/gemini.ts';
import { findComparables, type SoldComparable } from '../../src/services/comparables.ts';

const here = dirname(fileURLToPath(import.meta.url));
const runsDir = process.argv[2] || 'runs';
const outFile = process.argv[3] || 'appraisal_results.json';
const lots: any[] = JSON.parse(readFileSync(join(here, 'lots_split.json'), 'utf8')).lots;
const byId = Object.fromEntries(lots.map(l => [l.lot_id, l]));
const data: SoldComparable[] = JSON.parse(readFileSync(join(here, '../../src/data/soldComparables.json'), 'utf8'));
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
  const lf = r.raw.lot && r.raw.lot.ok ? r.raw.lot : null;
  const mode = r.mode || 'photos';
  const query = mode === 'url' ? (lf ? [lf.title, lf.description].filter(Boolean).join('\n') : `Auction lot: ${lot.url}`) : lot.text;
  const compText = [query, lf ? `${lf.title || ''}\n${lf.description || ''}` : ''].filter(Boolean).join('\n');
  const location = mode === 'url' ? (lf?.city || undefined) : lot.location;
  const comps = findComparables(data, compText, location, 5);
  const compsInPrompt = comps.filter(m => prompt.includes(JSON.stringify(m.comp.title).slice(1, -1).slice(0, 60))).length;
  const premiumPct = mode === 'url' ? (lf?.premiumPct || 25) : Number(lot.premium_pct);
  const hasPhotos = r.images > 0 || (mode === 'url' && /inlineData/.test(prompt));
  const fetchedEstimate = !!(lf && (lf.estimateLow || lf.estimateHigh));
  const pp = postProcessAppraisal(result, {
    query, hasPhotos, askingPrice: lot.hammer_eur, isAuction: true, premiumPct, targetCurrency: 'EUR', currencySymbol: '€',
    language: 'en', sellerType: 'Auction', lotUrl: mode === 'url' ? lot.url : undefined, comparables: comps, lotFacts: lf,
    fetchedEstimate, eurTo: (e: number) => e,
  });
  const item: any = pp[0], pg = item.price_guidance, ns = item.negotiation_strategy, bd = item.buy_decision;
  out.push({
    file: f, lot_id: r.lot_id, tag: r.tag, mode, split: lot.split, images: r.images, elapsed_s: r.elapsed_s, type: lot.type, url: lot.url,
    est_low_eur: lot.est_low_eur, est_high_eur: lot.est_high_eur, hammer_eur: lot.hammer_eur, premium_pct: premiumPct,
    app_low: pg.estimated_market_range_low, app_high: pg.estimated_market_range_high, retail_low: pg.fair_price_low, retail_high: pg.fair_price_high,
    smart_buy_hammer: pg.good_buy_below, walk_away_hammer: ns?.walk_away_price, verdict_at_hammer: bd.label, score_at_hammer: bd.score,
    compare_price: bd.compare_price, all_in_at_hammer: Math.round(lot.hammer_eur * (1 + premiumPct / 100)),
    title: item.item_summary.title, likely_period: item.item_summary.likely_period, likely_style: item.item_summary.likely_style,
    model_conf_breakdown: item.item_summary.confidence_breakdown, app_confidence_score: item.item_summary.confidence_score, model_confidence: modelConf,
    app_confidence: item.item_summary.confidence, appraisal_inputs: item.appraisal_inputs,
    comparables: comps.map(m => ({ id: m.comp.id, title: m.comp.title.slice(0, 80), hammer: m.comp.hammer, score: m.score, region: m.comp.region })),
    comps_in_prompt: compsInPrompt, comps_leak: comps.filter(m => testIds.has(m.comp.id)).length,
    prompt_has_estimate_claim: /anchor(ed)? to the (catalogue )?estimate/i.test(JSON.stringify(result)),
    lot_page: lf ? { ok: lf.ok, estimateLow: lf.estimateLow, estimateHigh: lf.estimateHigh, premiumPct: lf.premiumPct, currency: lf.currency } : null,
    reasoning: pg.pricing_reasoning,
  });
}
writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log(out.length, 'runs processed;', out.filter(o => o.error).length, 'errors');
