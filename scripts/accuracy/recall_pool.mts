// Accuracy harness, part G (fix 10): ground-truth pool for recall. Several Drouot keyword searches per test search (pages 1-3),
// parsed with the app's own parser. Run it on the same day as the hunt runs.
//   npx tsx scripts/accuracy/recall_pool.mts <out dir>   -> <out dir>/drouot_recall_pool.json
import { parseDrouotSearch } from '../../src/services/sources/drouot.ts';
import { writeFileSync } from 'fs';
const outDir = process.argv[2] || '.';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const Q: Record<string, string[]> = {
  s01_commode_louis_xv: ['commode louis xv', 'commode epoque louis xv', 'commode xviiie', 'commode tombeau', 'commode arbalete', 'commode sauteuse', 'commode galbee'],
  s05_napoleon_iii_mirror: ['miroir napoleon iii', 'miroir epoque napoleon iii', 'glace napoleon iii', 'miroir stuc dore', 'trumeau napoleon iii', 'miroir bois dore xixe'],
  s09_secretaire_abattant: ['secretaire a abattant', 'secretaire abattant', 'secretaire droit', 'secretaire louis xvi', 'secretaire empire', 'secretaire en armoire'],
};
const out: any = {};
for (const [k, qs] of Object.entries(Q)) {
  const seen: Record<string, any> = {};
  for (const q of qs) for (const page of [1, 2, 3]) {
    const url = `https://drouot.com/fr/s?query=${encodeURIComponent(q)}${page > 1 ? '&page=' + page : ''}`;
    const html = await (await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'fr-FR' } })).text();
    const r: any = parseDrouotSearch(html);
    let n = 0; for (const l of r.lots) { if (!seen[l.id]) { seen[l.id] = { ...l, q }; n++; } }
    console.log(k, q, page, r.lots.length, 'new', n);
    if (r.lots.length < 10) break;
    await new Promise(res => setTimeout(res, 400));
  }
  out[k] = Object.values(seen);
}
writeFileSync(`${outDir}/drouot_recall_pool.json`, JSON.stringify(out, null, 1));
