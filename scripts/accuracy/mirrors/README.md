# Mirror test set (size-aware mirror calibration, Oct 2026)

- `lots_mirrors.json`: 62 sold antique wall mirrors / trumeaux (59 Drouot results read from the public lot pages, 3 French mirrors sold in London on Auctionet) + Peter's Louis-Philippe mirror (dealer price EUR 800, dealer mode). Split: 30 calibration / 32 held-out (31 auction + Peter's). Lots that are also in the 33/66-lot test set keep their split there. `reference_only`: Peter's Provençal mirror, asked EUR 3,000, not sold, not scored.
- `lots_mirrors_auction.json`: the same without Peter's dealer lot (input for appraise_ui.py, auction mode).
- `reference_mirrors.json`: 45 real sold mirrors used to fit the size reference (15 newly harvested Drouot results + the calibration split). Nothing from the sale of any held-out lot.
- `feats.py` / `fit2.py`: parsing and the leave-one-out fit on the calibration split.

Run: `python3 scripts/accuracy/appraise_ui.py --base <url> --lots scripts/accuracy/mirrors/lots_mirrors_auction.json --images <dir> --out runs --tag main --split holdout`,
then `npx tsx scripts/accuracy/postprocess.mts runs out.json --lots scripts/accuracy/mirrors/lots_mirrors_auction.json` and `python3 scripts/accuracy/appraisal_metrics.py out.json main`.
