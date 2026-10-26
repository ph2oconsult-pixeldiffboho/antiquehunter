# Builds src/data/soldComps.json: real sold lots (Drouot results walked 2026-10, Auctionet ended+sold API) used as
# comparables for pieces without a verified maker anchor. Fees are stripped: Drouot "result" is fee-inclusive
# (hammer = result / (1 + fees%)), Auctionet's top bid is the hammer. Lots from the sealed eval set's sales are
# excluded entirely (comparables/exclude_test_lots.json); eval/corpus.json itself is never read.
import json, re, html, datetime, sys
B = '/workspace/antique-hunter-benchmark/comparables'
ex = json.load(open(f'{B}/exclude_test_lots.json'))
ex_ids = set(ex['ids']); ex_sales = {tuple(s) for s in ex['sales']}; ex_dsale = set(str(s) for s in ex['drouot_sale_ids'])
FURN = re.compile(r"commode|secr[ée]taire|armoire|buffet|vaisselier|miroir|trumeau|bonneti[èe]re|encoignure|chiffonn|semainier|bureau|console|scriban|biblioth[èe]que|vitrine|confiturier|enfilade|cabinet|coiffeuse|table|gu[ée]ridon|psych[ée]|glace|fauteuil|chaise|berg[èe]re|canap|byr[aå]|kommod|sk[aå]p|spegel|sekret[äa]r|sk[äa]nk|chest|mirror|wardrobe|cupboard|sideboard|dresser|bookcase|desk|tallboy|chiffonier|bord\b", re.I)
FX = {'EUR': 1, 'SEK': 0.087, 'DKK': 0.134, 'NOK': 0.085, 'GBP': 1.17, 'USD': 0.92, 'CHF': 1.06}
out = []; skipped = {'sealed': 0, 'not_furniture': 0, 'no_price': 0}
def clean(s): return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s or ''))).strip()
for r in json.load(open(f'{B}/drouot_walk_clean.json')).values():
    if f"drouot-{r['id']}" in ex_ids or str(int(r['saleId'] or 0)) in ex_dsale: skipped['sealed'] += 1; continue
    t = clean(r['description'])
    if not FURN.search(t[:120]): skipped['not_furniture'] += 1; continue
    if not (r.get('result') or 0) > 0 or r.get('currency') != 'EUR': skipped['no_price'] += 1; continue
    d = datetime.datetime.utcfromtimestamp(r['date']).strftime('%Y-%m-%d')
    if (r.get('house'), d) in ex_sales: skipped['sealed'] += 1; continue
    fees = r.get('fees') or r.get('saleFees') or 27
    out.append({'id': f"drouot-{r['id']}", 'u': r['url'], 't': t[:240], 'h': round(r['result'] / (1 + fees / 100)), 'f': fees,
                'd': d, 'src': 'Drouot', 'house': r.get('house') or '', 'city': r.get('city') or '', 'rg': 'FR'})
for r in json.load(open(f'{B}/auctionet_wide.json')).values():
    if f"auctionet-{r['id']}" in ex_ids: skipped['sealed'] += 1; continue
    t = clean(r['title'] + ' ' + (r.get('description') or ''))
    if not FURN.search(t[:120]): skipped['not_furniture'] += 1; continue
    bids = r.get('bids') or []; cur = r.get('currency')
    if not bids or cur not in FX: skipped['no_price'] += 1; continue
    d = datetime.datetime.utcfromtimestamp(r['ends_at']).strftime('%Y-%m-%d')
    if (r.get('house'), d) in ex_sales: skipped['sealed'] += 1; continue
    out.append({'id': f"auctionet-{r['id']}", 'u': r['url'], 't': t[:240], 'h': round(max(b['amount'] for b in bids) * FX[cur]), 'f': 25,
                'd': d, 'src': 'Auctionet', 'house': r.get('house') or '', 'city': '', 'rg': 'NORDIC'})
out.sort(key=lambda x: x['id'])
json.dump({'built': datetime.date.today().isoformat(), 'note': 'Real sold lots; h = hammer in EUR (fees stripped; non-EUR converted at approximate rates). Sealed-set sales excluded.', 'lots': out},
          open(sys.argv[1], 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(out), skipped)
