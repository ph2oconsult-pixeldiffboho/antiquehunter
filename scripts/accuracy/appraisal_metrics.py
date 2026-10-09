# Accuracy harness, part E (fix 10): headline numbers for the appraisal test, overall and per split (calibration / holdout).
#   python3 appraisal_metrics.py appraisal_results.json [tag] > summary.txt   (writes <results>_summary.json and _per_lot.csv)
import json, statistics as st, math, csv, sys
from collections import Counter
R = json.load(open(sys.argv[1])); TAG = sys.argv[2] if len(sys.argv) > 2 else 'photos'
base = sys.argv[1].rsplit('.', 1)[0]
P = [r for r in R if r['tag'] == TAG and 'error' not in r]
BANDS = {'<=300': (0, 300), '300-1000': (300, 1000), '1000-3000': (1000, 3000), '>3000': (3000, 1e12)}
CONF = ['high', 'medium', 'low', 'very_low']
def row(r):
    h = r['hammer_eur']; lo, hi = r['app_low'], r['app_high']; mid = (lo + hi) / 2
    return {**{k: r.get(k) for k in ['lot_id', 'split', 'type', 'hammer_eur', 'est_low_eur', 'est_high_eur', 'premium_pct', 'app_low', 'app_high', 'smart_buy_hammer',
                                      'walk_away_hammer', 'verdict_at_hammer', 'score_at_hammer', 'model_confidence', 'app_confidence', 'app_confidence_score', 'likely_period', 'title', 'elapsed_s']},
            'app_mid': mid, 'in_range': lo <= h <= hi, 'err_pct': (mid - h) / h * 100, 'abs_err_pct': abs(mid - h) / h * 100, 'log2_ratio': math.log2(mid / h) if mid > 0 else -10,
            'auctioneer_hit': (r['est_low_eur'] or 0) <= h <= (r['est_high_eur'] or 0), 'auctioneer_mid_abs_err_pct': abs((r['est_low_eur'] + r['est_high_eur']) / 2 - h) / h * 100,
            'would_win_at_walkaway': (r.get('walk_away_hammer') or 0) >= h,
            'band_factor': (r.get('appraisal_inputs') or {}).get('band_factor'), 'raw_mid_eur': (r.get('appraisal_inputs') or {}).get('raw_mid_eur'),
            'close_comparables': (r.get('appraisal_inputs') or {}).get('close_comparables'), 'comps_median': (r.get('appraisal_inputs') or {}).get('comparables_median'),
            'comps_in_prompt': r.get('comps_in_prompt'), 'comps_leak': r.get('comps_leak')}
def summary(rows):
    n = len(rows); S = {'n': n}
    if not n: return S
    S['range_hit'] = sum(x['in_range'] for x in rows); S['range_hit_pct'] = round(100 * S['range_hit'] / n)
    S['auctioneer_estimate_hit'] = sum(x['auctioneer_hit'] for x in rows)
    S['median_abs_err_pct'] = round(st.median(x['abs_err_pct'] for x in rows), 1)
    S['auctioneer_median_abs_err_pct'] = round(st.median(x['auctioneer_mid_abs_err_pct'] for x in rows), 1)
    S['median_signed_err_pct'] = round(st.median(x['err_pct'] for x in rows), 1)
    S['geo_mean_ratio_mid_over_hammer'] = round(2 ** st.mean(x['log2_ratio'] for x in rows), 3)
    S['hammer_below_range'] = sum(x['hammer_eur'] < x['app_low'] for x in rows); S['hammer_above_range'] = sum(x['hammer_eur'] > x['app_high'] for x in rows)
    S['within_25pct'] = sum(x['abs_err_pct'] <= 25 for x in rows); S['within_50pct'] = sum(x['abs_err_pct'] <= 50 for x in rows)
    S['median_range_width_ratio'] = round(st.median(x['app_high'] / x['app_low'] for x in rows if x['app_low'] > 0), 2)
    S['verdict_at_hammer'] = dict(Counter(x['verdict_at_hammer'] for x in rows))
    S['walk_away_below_hammer'] = sum(not x['would_win_at_walkaway'] for x in rows)
    for name, (a, b) in BANDS.items():
        sub = [x for x in rows if a < x['hammer_eur'] <= b]
        if sub: S[f'band {name}'] = dict(n=len(sub), hit=sum(x['in_range'] for x in sub), med_abs=round(st.median(x['abs_err_pct'] for x in sub)), med_signed=round(st.median(x['err_pct'] for x in sub)))
    for c in CONF:
        sub = [x for x in rows if x['app_confidence'] == c]
        if sub: S[f'shown confidence {c}'] = dict(n=len(sub), hit=sum(x['in_range'] for x in sub), med_abs=round(st.median(x['abs_err_pct'] for x in sub)))
    S['shown_vs_model_confidence_mismatch'] = sum(x['app_confidence'] != x['model_confidence'] for x in rows)
    S['median_elapsed_s'] = st.median(x['elapsed_s'] or 0 for x in rows)
    S['comparables_leaks'] = sum(x['comps_leak'] or 0 for x in rows)
    return S
rows = [row(r) for r in P]
with open(base + '_per_lot.csv', 'w', newline='') as fh:
    w = csv.DictWriter(fh, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(sorted(rows, key=lambda x: (x['split'], x['hammer_eur'])))
S = {'all': summary(rows), 'calibration': summary([x for x in rows if x['split'] == 'calibration']), 'holdout': summary([x for x in rows if x['split'] == 'holdout'])}
# repeatability / variants: same lot, other tag
by = {(r['tag'], r['lot_id']): r for r in R if 'error' not in r}
var = []
for (tag, i), r in sorted(by.items()):
    if tag == TAG or (TAG, i) not in by: continue
    p = by[(TAG, i)]; pm = (p['app_low'] + p['app_high']) / 2; vm = (r['app_low'] + r['app_high']) / 2
    var.append({'variant': tag, 'lot_id': i, 'split': p['split'], 'hammer': r['hammer_eur'], 'base_range': f"{p['app_low']}-{p['app_high']}", 'variant_range': f"{r['app_low']}-{r['app_high']}",
                'mid_change_pct': round((vm / pm - 1) * 100) if pm else None, 'base_in_range': p['app_low'] <= p['hammer_eur'] <= p['app_high'],
                'variant_in_range': r['app_low'] <= r['hammer_eur'] <= r['app_high'], 'base_verdict': p['verdict_at_hammer'], 'variant_verdict': r['verdict_at_hammer'],
                'base_conf': p['app_confidence'], 'variant_conf': r['app_confidence'], 'variant_lot_page': r.get('lot_page'), 'estimate_claim': r.get('prompt_has_estimate_claim')})
json.dump({'summary': S, 'variants': var}, open(base + '_summary.json', 'w'), indent=1, default=str)
for k, v in S.items():
    print('==', k)
    for a, b in v.items(): print('  ', a, ':', b)
for v in var: print(v)
