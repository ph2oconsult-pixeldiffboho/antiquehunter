# Appraisal engine rework — working log

**Branch:** `appraisal-engine-2026-10-11` (from `stamp-fixes-2026-10-10` @ 9484ea1)  
**Started:** 2026-10-10 ~23:44 PT (Europe/Paris)  
**Rules:** preview only; no merge; no push to main; no force-push; no purchases.

## Timeline

### 2026-10-10 23:44 PT — kickoff
- Created branch from 9484ea1.
- Phase A next: trace valuation path; reproduce 5 Giraudeau cases on abf833d + stamp branch; write ROOT_CAUSES.md.


### 2026-10-10 ~23:50–00:00 PT — Phase A + first engine commit
- Wrote ROOT_CAUSES.md (14 findings with file:line).
- Extracted Giraudeau lots 49/92/189/237/245 from PDF (realised for scoring only).
- Implemented comps quality matching (0f14ffe); 91 checks green; pushed; PR opened.
- Giraudeau Playwright runner had a CSS selector bug; fixed; re-running baselines next.

### Remaining
- Valuation object + calc module
- Facts/claims split in prompt
- Re-run Giraudeau on prod + stamp + this preview
- Benchmark corpus + sealed eval + PROPOSED_TARGETS
- Save-to-Log / hunt material labels
- Screenshots of Lot 245-like text-only report


### 2026-10-11 ~00:00 PT — push + baselines
- PR #18 opened; head `b373af2`; preview https://antiquehunter-git-appraisal-engine-6e564d-peter-hillis-projects.vercel.app
- 92 checks green.
- Giraudeau 5 on prod + stamp: see baseline/GIRAUDEAU_SUMMARY.md (g49 marble_check=false on this run; g245 correctly true; conf still “visible features” on old builds).
- Engine preview Giraudeau run started.


### 2026-10-11 ~00:05 PT — Giraudeau on engine preview
- Engine conf blurb fixed: “Based on your description only…”.
- Ranges unchanged vs prod (model-only; no comps for these lots): g245 still €300–900 vs €130 realised (over).
- PROPOSED_TARGETS.md drafted — **stop before sealed eval**.

## What’s left (priority)
1. Wire `valuation.ts` into `postProcessAppraisal` + AnalysisView / Negotiate (single object).
2. Prompt/schema: facts vs catalogue claims vs hypotheses vs unknowns.
3. Narrative consistency check (template numbers into prose).
4. Save-to-Log: reproduce empty-collection hang; harden recovery UX.
5. Hunt search: label period/material/budget mismatches.
6. Assemble ~60-lot benchmark; hash sealed eval; run **dev only**; agree targets with Peter.
7. Phone screenshots of wired Lot 245-like report (hammer / buyer cost / max bid / facts / comps).


### 2026-10-11 00:01 PT — Item 1 done (a0f31a9)
- Wired `buildValuation` into `postProcessAppraisal`; every panel projects from it.
- Deleted duplicate maths in gemini postProcess (old nf/dealerBands block) and negotiation fee recompute (uses maxBidHammer/maxBidAllIn).
- Removed fixed ×1.3/×1.6 dealer margins; dealerEvidence = none|assumption|comps.
- AnalysisView prefers valuation; shows "no dealer evidence" / labelled assumption.
- Agreement test: walk-away = overpaying; opening ≤ smart ≤ target ≤ walk; plan.walk_away matches.
- 93 checks green. Pushed a0f31a9.

## Remaining
2. Facts / claims / photo features / hypotheses / unknowns in prompt+schema+UI
3. Narrative consistency from valuation (strip mismatched euro figures)
4. Style-vs-period + condition + lighting priors (Giraudeau 189/245 general cause)
5. Save-to-Log empty-collection hang recovery
6. Hunt: enforce period/material/budget; label approximate alternatives
7. Benchmark ~60-lot corpus; hash sealed eval; run dev before/after; PROPOSED_TARGETS
8. Lot-245-style phone screenshots on preview

### 2026-10-11 00:02 PT — Item 2 done (9f68852)
- evidence_ledger in prompt+schema; normaliseEvidenceLedger; UI panel.
- Style note = design description; not-sure → unknowns; defects graded.
- 94 checks. Pushed 9f68852.

### 2026-10-11 00:04 PT — Item 3 done (14c2f17)
- enforceNarrativeConsistency wired in postProcess; mismatched euro figures stripped.
- 95 checks. Pushed 14c2f17.

### 2026-10-11 00:05 PT — Item 4 done (5cbbed8)
- Root cause: without comps, anchor/blend never ran → engine = prod ranges.
- applyBaseBandPriors: style-vs-period ×0.55, condition 0.85/0.65/0.45, lighting prior high €450.
- Confirmed/probable period skips style discount (no Empire-Style false positive).
- 96 checks. Pushed 5cbbed8.

### 2026-10-11 00:06 PT — Item 5 done (cbace49)
- Reproduce paths: new user / empty log / cancelled popup / offline → draft preserved.
- preserveAppraisalDraft before auth; Collection commitDraft + load ceiling; Save button 25s race.
- 97 checks. Pushed cbace49.

### 2026-10-11 00:09 PT — Item 6 done (86329b2)
- material_mismatch hard drop; material_unconfirmed + near_budget → approximate list + UI badge.
- 98 checks. Pushed 86329b2.

### 2026-10-11 00:10 PT — Item 7 done (corpus + hashed eval + dev before/after @ 86329b2)
- Dev corpus n=39 (34 calibration + 5 Giraudeau); eval n=34 sealed (sha256=89fb1b7e69da5489a253d5e91aab709262870708c72c207f647015b46e2c7f16).
- Dev BEFORE hit 44% / style-overval 25% → AFTER hit 31% / style-overval **6%**; repeatability pass; ask-sensitivity pass.
- PROPOSED_TARGETS.md updated with concrete numbers. **Sealed eval not run.**

### 2026-10-11 00:15 PT — Item 8 done (Lot-245 phone shots @ def2862)
- Preview phone (390×844) run of Giraudeau g245 text-only on appraisal-engine preview.
- Captured: `engine_rework/shots/g245_phone_full.png`, `g245_max_bid.png`, `g245_bidding_vp.png`, body extract.
- Visible: text-only confidence blurb, Charles X title, Before-you-buy checklist, Bidding tips (25% premium / max bid unlock), teaser “buy below €510 / above €900”.
- Free plan still paywalls Price Guidance / Evidence ledger / Comparables testids; demo Unlock opens pack picker (did not persist Pro in headless). Full wired panels need Pro session — code path covered by unit tests + AnalysisView wiring.
