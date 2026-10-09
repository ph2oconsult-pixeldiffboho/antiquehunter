// Step 2: choose the comparables blend parameters on the CALIBRATION lots only, from captured runs of the original
// valuation (the model's own range). Prints calibration metrics for a small grid; the holdout lots are never read here.
//   npx tsx scripts/accuracy/fit_blend.mts <runs dir> [--show-holdout-count]
import { readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { comparableStats, findComparables, type SoldComparable, type ComparableStats } from '../../src/services/comparables.ts';

const here = dirname(fileURLToPath(import.meta.url));
const runsDir = process.argv[2];
const lots: any[] = JSON.parse(readFileSync(join(here, 'lots_split.json'), 'utf8')).lots.filter((l: any) => l.split === 'calibration');
const data: SoldComparable[] = JSON.parse(readFileSync(join(here, '../../src/data/soldComparables.json'), 'utf8'));
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export const pieceText = (query: string, it: any) =>
  [query, it?.item_summary?.title, it?.item_summary?.likely_style, it?.item_summary?.likely_period, it?.item_summary?.likely_origin].filter(Boolean).join('\n');

const rows: { id: string; hammer: number; low: number; high: number; matches: ReturnType<typeof findComparables> }[] = [];
for (const l of lots) {
  const f = join(runsDir, `photos_${l.lot_id}.json`);
  let r: any; try { r = JSON.parse(readFileSync(f, 'utf8')); } catch { continue; }
  if (!r.raw?.body?.candidates) continue;
  const it = JSON.parse(r.raw.body.candidates[0].content.parts[0].text).items[0];
  const low = Number(it.price_guidance.estimated_market_range_low), high = Number(it.price_guidance.estimated_market_range_high);
  rows.push({ id: l.lot_id, hammer: l.hammer_eur, low, high, matches: findComparables(data, pieceText(l.text, it), l.location, 12) });
}
const evalSet = (k: number, minScore: number, w: number, minN: number, agreeCut: number) => {
  let hit = 0; const err: number[] = [];
  for (const r of rows) {
    const st: ComparableStats = comparableStats(r.matches.slice(0, k), minScore);
    let f = 1;
    if (st.n >= minN && st.median > 0) {
      const weight = w * Math.min(1, st.n / 4) * (st.spread <= agreeCut ? 1 : 0.4);
      f = Math.min(2.5, Math.max(1 / 2.5, Math.exp(weight * Math.log(st.median / Math.sqrt(r.low * r.high)))));
    }
    const lo = r.low * f, hi = r.high * f;
    if (r.hammer >= lo && r.hammer <= hi) hit++;
    err.push(Math.abs((lo + hi) / 2 - r.hammer) / r.hammer * 100);
  }
  return { hit, n: rows.length, medErr: Math.round(med(err)) };
};
console.log('calibration lots with a run:', rows.length);
console.log('baseline (model range only):', evalSet(8, 99, 0, 99, 2.5));
for (const k of [5, 8]) for (const minScore of [10, 12, 14]) for (const w of [0.25, 0.5, 0.75]) for (const agree of [2.5, 4])
  console.log(JSON.stringify({ k, minScore, w, agree }), evalSet(k, minScore, w, 2, agree));
// how many close comparables per lot at the chosen settings
console.log(rows.map(r => `${r.id}:${comparableStats(r.matches.slice(0, 8), 12).n}`).join(' '));
// diagnostics: the comparables' median alone vs the model's midpoint, lots with >= 3 close comparables
{
  const e1: number[] = [], e2: number[] = [];
  for (const r of rows) {
    const st = comparableStats(r.matches.slice(0, 8), 12);
    if (st.n < 3) continue;
    e1.push(Math.abs(st.median - r.hammer) / r.hammer * 100); e2.push(Math.abs(Math.sqrt(r.low * r.high) - r.hammer) / r.hammer * 100);
    console.log(r.id, 'hammer', r.hammer, 'model', r.low, r.high, 'comps n', st.n, 'med', Math.round(st.median), 'p25-p75', Math.round(st.p25), Math.round(st.p75), r.matches.slice(0, 3).map(m => `${Math.round(m.score)}:${m.comp.hammer}:${m.comp.title.slice(0, 40)}`).join(' | '));
  }
  console.log('n', e1.length, 'median err comps', Math.round(med(e1)), 'model geo-mid', Math.round(med(e2)));
}
