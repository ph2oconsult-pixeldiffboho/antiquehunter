# Proposed evaluation targets (informed by dev before/after — agree with Peter before sealed eval)

**Status:** Draft with **concrete dev numbers**. Sealed eval hashed, **not run**.  
**Branch:** `appraisal-engine-2026-10-11` @ see LOG.md  
**Method:** Synthetic model ranges (catalogue estimate × stretch, or category folklore) → `postProcessAppraisal`. BEFORE = untouched model band (abf833d-like). AFTER = current engine (base-band priors + valuation object). Realised hammer for scoring only.

## Sample sizes

| Set | n | Notes |
|---|---|---|
| **Dev** | **39** | 34 calibration from testset60 + 5 Giraudeau Tours lots |
| **Sealed eval** | **34** | holdout from testset60; `eval/SEALED_HASH.txt` |
| Houses (dev) | 24 | FR/UK/SE + Giraudeau |
| Bands (dev) | &lt;300:17 · 300–1k:11 · 1–5k:10 · &gt;5k:1 | |

Eval sha256: see `eval/SEALED_HASH.txt`. **Do not run eval until Peter signs off.**

## Dev before vs after (this run)

| Metric | BEFORE (abf833d-like) | AFTER (this branch) | Proposed target (eval) |
|---|---|---|---|
| Range coverage (hammer in band) | 44% (17/39) | 31% (12/39)* | ≥ 55% overall; ≥ 45% on style/damaged |
| Median \|mid − hammer\| / hammer | 33.3% | 36.8% | ≤ 40% |
| Median range width (high/low) | 1.7× | 1.7× | ≤ 3× (&lt;€1k); ≤ 2.5× (€1–5k) |
| Overvaluation on style/damaged (mid &gt; 1.5× hammer) | **25%** (4/16) | **6%** (1/16) | ≤ 15% |
| Undervaluation (mid &lt; hammer/1.5) | 28% | 38%* | ≤ 30% (trade-off vs overval) |
| Repeatability (3× identical) | — | **pass** (mid identical) | Same verdict band; mid ±15% |
| Asking-price sensitivity | — | **pass** (market range stable) | Market range unchanged with ask |
| Unsupported assertions | — | unit-tested ledger | **0** |
| Comp citation accuracy | — | verifyComparable | 100% of shown comps |

\*Coverage fell as priors pull style/lighting/damage highs down (g245 now hits; g189 still under). Next tuning should **raise lighting floors slightly** and avoid over-discounting sound period pieces — without lot-specific hacks.

### Giraudeau spot-check (dev)

| Lot | Hammer | BEFORE | AFTER | Note |
|---|---|---|---|---|
| g189 lustre | €140 | €180–1035 miss | €180–520 miss | lighting cap applied; still high |
| g245 style + damage | €130 | €180–920 miss | **€70–230 hit** | style×condition priors |
| g49 | €500 | hit | hit | |
| g92 | €250 | hit | hit | |
| g237 | €80 | miss | miss | |

## Proposed targets for sealed eval (for Peter to agree)

1. Range coverage ≥ **55%** overall; style/damaged ≥ **45%**; report median width alongside — never “accuracy %” alone.  
2. Median abs % error of mid vs hammer ≤ **40%**.  
3. Overvaluation rate on style/damaged ≤ **15%**.  
4. Undervaluation ≤ **30%**.  
5. Repeatability + ask-sensitivity as above.  
6. Zero unsupported marble/stamp/wood claims not in input.

## Blockers before eval

- [x] Wire `buildValuation` into panels  
- [x] Facts/claims ledger  
- [x] Narrative consistency  
- [x] Base-band priors (style/condition/lighting)  
- [x] Assemble corpus + hash sealed eval  
- [ ] Peter sign-off on this table  
- [ ] Optional: live Gemini pass on dev (photos off) to replace synthetic model ranges  

**STOP — do not run sealed eval.**
