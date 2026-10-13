# Proposed targets for the sealed eval (DRAFT — needs Peter's agreement; sealed eval NOT run)
Basis: phase-3 real-pipeline dev benchmark, 2026-10-13 (live UI, prod 99d853e vs preview a982020/54a0701), text-only inputs,
no estimate/ask/URL in prompt. n=60 clean dev lots (70 minus 1 prompt-leak g49 minus 9 Giraudeau diagnostic lots).
Dev lots were seen during earlier tuning, so dev numbers are optimistic.

| Metric (text-only, hammer basis) | Dev now (after) | Proposed sealed-eval target |
|---|---|---|
| Coverage (hammer inside range) | 38% | >= 50% |
| Median range width (high/low) | 3.1x | <= 3.5x (coverage must not be bought with width) |
| Median central error, abs log(hammer/mid) | 0.85 (x2.3) | <= 0.70 (x2.0) |
| Undervaluation rate (hammer > high) | 42% | <= 30% |
| Overvaluation rate (hammer < low) | 20% | <= 25% |
| 1k-5k band coverage | 22% (n=23) | >= 40% |
| Repeatability (identical range on 3 runs) | 100% (n=60, seed+temp 0) | >= 95% |
| Asking-price sensitivity | range unaffected by ask; no buy score without ask (unit tests) | same, plus live check on 10 lots |
| Comp citation accuracy | not measured (no comps fired in text-only runs) | 100% of shown comps have URL, date, price basis; need comps-on subset |
| Contamination (subject lot/sale in comps) | 0 | 0 |

Why these are realistic, not aspirational: the residual-sized 80% band from leave-one-out calibration would need ~x15 width
(useless), and 50% needs ~x5.5. Text-only appraisal cannot hit tight + well-covered ranges; photo/comps evidence is required for that.
Purchase guidance should only be considered "ready" for lots with verified comps or photos; text-only output stays provisional.
