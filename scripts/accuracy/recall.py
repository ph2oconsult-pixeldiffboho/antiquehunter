# Accuracy harness, part I (fix 10): pooled recall vs Drouot for s01 / s05 / s09. Relevant = rule candidates in France (country 75)
# minus manual exclusions (recall_exclusions.json {search: {lot id: reason}}), plus app results graded OK (pooled relevance).
#   python3 recall.py <dir>
import json, re, sys, csv, os
d = sys.argv[1]
c = json.load(open(f'{d}/recall_candidates.json'))
PERIOD = re.compile(r'epoque|époque|xviii|xix|louis|empire|restauration|philippe|napol|directoire|charles x', re.I)
EXCL = json.load(open(f'{d}/recall_exclusions.json')) if os.path.exists(f'{d}/recall_exclusions.json') else {}
rel = {k: {l['id']: l for l in ls if str(l.get('country_raw')) == '75' and l['id'] not in EXCL.get(k, {}) and (k != 's09_secretaire_abattant' or PERIOD.search(l.get('full_description') or ''))} for k, ls in c.items()}
graded = list(csv.DictReader(open(f'{d}/graded_results.csv')))
for g in graded:
    if g['search'] in rel and g['verdict'] == 'OK':
        m = re.search(r'drouot\.com/\w+/l/(\d+)', g['url'])
        if m: rel[g['search']].setdefault(m.group(1), {'id': m.group(1), 'added': 'app result graded OK'})
out = {}
for k in rel:
    for run in ('run1', 'run2'):
        f = f'{d}/{run}_{k}.json'
        if not os.path.exists(f): continue
        ms = ((json.load(open(f))['response'] or {}).get('results') or {}).get('matches', [])
        got = {m.group(1) for x in ms for m in [re.search(r'/l/(\d+)', x['url'])] if m}
        hit = sorted(got & set(rel[k])); miss = sorted(set(rel[k]) - got)
        out[f'{k}|{run}'] = {'relevant': len(rel[k]), 'found': len(hit), 'recall': round(len(hit) / len(rel[k]), 3) if rel[k] else None, 'hits': hit, 'missed': miss}
        print(k, run, 'relevant', len(rel[k]), 'found', len(hit), f"recall {len(hit) / len(rel[k]):.0%}" if rel[k] else '-', 'missed', miss)
json.dump({'per_run': out, 'relevant_sets': {k: sorted(v) for k, v in rel.items()}}, open(f'{d}/recall_summary.json', 'w'), indent=1)
