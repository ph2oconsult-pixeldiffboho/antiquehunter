# Accuracy harness, part J (fix 4): fit the price-band correction on the CALIBRATION half only.
# Input: postprocess.mts output for runs made with identity factors (appraisal_inputs.raw_mid_eur = the model's own mid).
# Per band of the model's mid: factor = exp(shrink * median(log(hammer / model mid))), shrink = n / (n + 3) (few lots -> stay near 1),
# clamped to [0.5, 2]. Prints a BAND_CORRECTION table for src/services/appraisalMath.ts.
#   python3 fit_bands.py calib_results.json
import json, math, sys, statistics as st
R = [r for r in json.load(open(sys.argv[1])) if 'error' not in r and r['split'] == 'calibration']
assert R, 'no calibration runs'
BANDS = [300, 1000, float('inf')]
out = []
lo = 0
for up in BANDS:
    sub = [r for r in R if lo < (r['appraisal_inputs']['raw_mid_eur'] or 0) <= up]
    if sub:
        logs = [math.log(r['hammer_eur'] / r['appraisal_inputs']['raw_mid_eur']) for r in sub]
        m = st.median(logs); w = len(sub) / (len(sub) + 3)
        k = max(0.5, min(2.0, math.exp(w * m)))
    else: m, w, k = 0, 0, 1
    out.append({'upToEur': up, 'n': len(sub), 'median_ratio_hammer_over_mid': round(math.exp(m), 3), 'shrink': round(w, 2), 'factor': round(k, 2),
                'lots': [(r['lot_id'], r['hammer_eur'], r['appraisal_inputs']['raw_mid_eur']) for r in sub]})
    lo = up
for b in out: print(json.dumps(b))
print('BAND_CORRECTION = [' + ', '.join(f"{{ upToEur: {'Infinity' if b['upToEur'] == float('inf') else int(b['upToEur'])}, factor: {b['factor']} }}" for b in out) + ']')
