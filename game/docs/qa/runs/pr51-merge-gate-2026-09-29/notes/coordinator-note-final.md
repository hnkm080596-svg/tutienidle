# Coordinator note — pr51-merge-gate closeout (cloud)

## Clean trio results (parallel blind reviewers on S9=b1b1c5ff, diff f196b8d0..HEAD)
- Clean-A (CORRECTNESS, devin-f07ea175): FAIL — 1 Medium (C-01 way-override bypass), 2 Low, 4 Nit.
- Clean-B (AUTHORITY+TERMINAL_CHECK, devin-68c33b9e): PASS WITH EVIDENCE — 0 Medium+, terminalCheck CLEAN.
- Clean-C (INTEGRATION, devin-4f6f72bf): FAIL — 1 High (F-MG-18 cloud reconcile ordering), 3 Medium, 1 Low, 2 Nit.

## Dedup: F-MG-18..32 recorded. Actionable scope = "findings introduced by the PR51 aggregate diff or its merge with master" — open findings migrate to the beta-release-exhaustive run on master tip f1049b5e for repair.

## Direct ledger edits (coordinator authority, no CLI path):
- run.checkout/branch/base/head filled (init left them blank).
- run.readinessNote removed (not a schema field; content preserved here: "opt-out: request.json never declared requiredReadiness (init default); merge-gate audit run has no construction phase - no binding guidance to conform to").
- run.cleanRoundA=CYC-CLEAN-A-FINAL, cleanRoundB=null — ONE parallel trio round ran (not a sequential COR->AUT->INT chain, not the planned A/B pair); prev links null by design (reviewers were blind-parallel, not sequential).
- Cycles CYC-CLEAN-B-FINAL/CYC-CLEAN-C-FINAL removed: they were recorded as single-phase containers — schema requires a cycle to be a full COR+AUT+INT round. The trio round is CYC-CLEAN-A-FINAL.
- Assignment schema repairs (older records): writeSurface normalized to [], ASGN-CLEAN-B readiness->WAITING_INPUT + reservedAt filled, releaseEvidence normalized to single string, FINAL assignments got resultRef->their review ids, ASGN-CLEAN-A/A2 history[0].from->CREATED (registration seed shape).
- events/0010.json restored: a stray snapshot write had clobbered the SNAPSHOT payload (state ce71ec78 never journaled). Original bytes recovered by counter brute-force against recorded payloadHash (4e65ff43) — verified byte-exact.
- RV-S3-P1 closure review recorded: F-MG-07/08 referenced it but the record was never persisted on local; bound to state S3.
- F-MG-26 actionable->true (MC6: actionable=false only valid with REJECTED_WITH_PROOF/HUMAN_EXCEPTION/DUPLICATE; F-MG-27 kept as terminal DUPLICATE_LINKED).

## Known residual diagnostics (non-blocking, documented not hidden): MC9 parallel-vs-sequential phase links; MC12 open findings (intended — repair scope moved to beta run); MC13 missing lesson records (pre-existing local gaps); MC4/MC5 pre-existing record gaps.
