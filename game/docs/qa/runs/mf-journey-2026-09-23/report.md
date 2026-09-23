# QA run mf-journey-2026-09-23

- phase: DECIDE
- outcome: QA_BLOCKED_SCOPE
- state: product=cba106e9f87b contract=10e600629d7c attack=f92c6956da6a env=e3ca14a6b377
- base/head: origin/p7/truc-co -> 873635bd502921a6164eff368cb470af8c735915

## Findings

- **F-C-1** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — "ZERO production edits" claim is imprecise
- **F-C-2** Low/NON_ACTIONABLE — REJECTED_WITH_PROOF — drain seam does not model settlementError branch
- **F-C-3** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — naming drift items are honest records, not defects
- **F-A-1** High/TEST_DEFECT — PROVEN — Leg J determinism assert flaky by construction — Math.random entitlement draw feeds compared snapshot fields
- **F-A-2** Medium/TEST_DEFECT — TRIAGED — Snapshot/checkpoint parity oracle blind spot — omits journey-mutated persisted fields incl. modifiers
- **F-A-3** Medium/COVERAGE_GAP — TRIAGED — Census oracle under-covers writer paths; Set collapses double-registered grants
- **F-A-4** Low/TEST_DEFECT — TRIAGED — runTribulation skips startTribulationPrepared pre-start unequip + modifier sync (equipped-through-tribulation is fixture-only state)
- **F-A-5** Low/TEST_DEFECT — TRIAGED — drainTribulationOutcome returns true on empty director — no settle-ordering guard; settle/drain nil asymmetry
- **F-A-6** Low/REAL_DEFECT — TRIAGED — hiddenChannelCycles persisted per site but undeclared on ProductionSiteStateSave (pre-existing)
- **F-A-7** Nit/TEST_DEFECT — TRIAGED — isWriterOwner probes 3 data fields, omits setEquipmentModifiers — mid-apply throw on misclassified owner
- **F-A-8** Nit/TEST_DEFECT — TRIAGED — vi.setSystemTime(Date.now()) no-op under fake timers at 3 sites
- **F-A-9** Low/TEST_DEFECT — TRIAGED — Per-tick auto-invest during tribulation couples leg-A essence surplus to leg-D exact-tier preconditions

## Coverage

- cells: 0 total; 

## Chronology

- cycle CYC-RA-1: FINDINGS; reviews REV-A-CORRECTNESS,REV-B-AUTHORITY,REV-C-INTEGRATION

## Convergence

- OK C1-identity: all final evidence binds the declared state
- UNMET C2-census-coverage: domain src/core/simulation/earlygame uncovered; domain docs/p7 uncovered; domain docs/qa uncovered
- UNMET C3-no-open: open F-A-1; open F-A-2; open F-A-3; open F-A-4; open F-A-5; open F-A-6; open F-A-7; open F-A-8; open F-A-9
- UNMET C4-final-gates: no final evidence recorded
- OK C5-sequential: sequential phase reviews present
- UNMET C6-clean-pair: Clean A missing/not CLEAN; Clean B missing/not CLEAN
- OK C7-mutation-corpus: mutation + corpus satisfied
- UNMET C8-terminal-check: no sealed independent TERMINAL_CHECK on the final state

## Validation failures

- MC12 F-A-1: actionable finding still PROVEN
- MC12 F-A-2: actionable finding still TRIAGED
- MC12 F-A-3: actionable finding still TRIAGED
- MC12 F-A-4: actionable finding still TRIAGED
- MC12 F-A-5: actionable finding still TRIAGED
- MC12 F-A-6: actionable finding still TRIAGED
- MC12 F-A-7: actionable finding still TRIAGED
- MC12 F-A-8: actionable finding still TRIAGED
- MC12 F-A-9: actionable finding still TRIAGED
