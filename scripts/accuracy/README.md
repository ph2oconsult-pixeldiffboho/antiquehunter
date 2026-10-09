# Accuracy harness (fix 10)

Repeatable version of the 9 Oct 2026 road test. Everything runs against a deployed URL (production or a Vercel preview).

## Test set and split
`lots_split.json`: 33 sold lots (Drouot, Auctionet) with catalogue text, photos (`image_urls`), buyer's premium and the real hammer.
* `calibration` (17 lots): may be used for any fitting (price corrections, confidence thresholds).
* `holdout` (16 lots): never used for fitting. Always report it separately.

## Appraisals
```
pip install playwright && playwright install chromium        # once
python3 appraise_ui.py --base $URL --images ./images --out runs --tag photos            # 33 lots, photos + text, like a user
python3 appraise_ui.py --base $URL --out runs --tag text --mode text <ids>               # text only
python3 appraise_ui.py --base $URL --out runs --tag url  --mode url  <ids>               # lot link only (app reads the page)
python3 appraise_ui.py --base $URL --out runs --tag photorep <ids>                       # repeat = repeatability
npx tsx scripts/accuracy/postprocess.mts runs results.json    # re-applies postProcessAppraisal with the hammer as the price
python3 appraisal_metrics.py results.json photos               # all / calibration / holdout, bands, verdicts, confidence, variants
```
The hammer and the auctioneer's estimate are never typed into the app (url mode: the app reads the estimate from the lot page,
never the result).

## Searches
```
python3 hunt_run.py --base $URL --out hunt --tag run1 ; python3 hunt_run.py --base $URL --out hunt --tag run2
python3 hunt_check.py hunt                       # re-fetch every result link
python3 hunt_grade.py hunt --review              # list auto N/U on period/type to read; put judgements in hunt/manual_grades.json
python3 hunt_grade.py hunt                       # precision per search (strict and verifiable-only)
npx tsx scripts/accuracy/recall_pool.mts hunt ; python3 recall_filter.py hunt <UTC time of the runs> ; python3 recall.py hunt
```
`hunt/recall_exclusions.json` holds manual exclusions from the recall pool (e.g. "en partie d'époque").
