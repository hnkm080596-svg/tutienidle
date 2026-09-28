# QA run beta-creation-impl-2026-09-23

- phase: DECIDE
- outcome: QA_FINDINGS_OPEN
- state: product=d3b0cb32aeea contract=d7e0a86484d9 attack=ceaf20da9f77 env=0c6c1b0a38ab
- base/head: origin/beta/rc -> 2d5349a674de39738b7e23a6dcdd5c343ef7dc68

## Findings

- **F-IMPL-1** Low/REAL_DEFECT — CLOSED — pendingCreationPick never cleared after consume (module-scoped stale window)
- **F-IMPL-2** Low/COVERAGE_GAP — CLOSED — restoreGameSession handled-result layer lacked a missing-pick case (manager-level pin already existed)
- **F-RB-C1** Medium/REAL_DEFECT — CLOSED — P15 ASCII-comments gate fails: non-ASCII tokens in new contract test
- **F-RB-C2** Medium/REAL_DEFECT — CLOSED — In-place migration edit left already-migrated DBs without a forward path
- **F-RB-C3** Low/DOCUMENTATION_DEFECT — CLOSED — online-login-cloud-save-plan.md still documents removed 5-point allocation
- **F-RB-C4** Nit/TEST_DEFECT — CLOSED — Duplicated adjacent expect() in boundary test ~:1151
- **F-RB-C5** Nit/TEST_DEFECT — CLOSED — asciiComments.json baseline lists deleted .pointsLeft comment entry
- **F-RB-C6** Low/REAL_DEFECT — CLOSED — bootstrapEarlyGamePlayer discards learnSkill returns - silent missing precursor loses hidden-way gate
- **F-RB-C7** Low/REAL_DEFECT — CLOSED — Preflight mortal predicate keyed on cultivationPath===undefined not realmId - crafted non-mortal+no-path save passes both layers
- **F-RB-C8** Nit/TEST_DEFECT — CLOSED — CharacterCreationScreen.finish creating latch would stick true if createCharacter threw (dead path)
- **F-IMPL-PRE-1** Low/NON_ACTIONABLE — REJECTED_WITH_PROOF — Pre-existing test failures on base: SettingsPanel autosave-delete + dongFu asset pipelines (3 tests)
- **F-IMPL-PRE-2** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — Pre-existing remote seam: invalid/consumed rollId soft-locks to generic error; p_roll_id read races mid-flight reroll -> fail-closed rejection
- **F-A-CORRECTNESS-1** Low/REAL_DEFECT — PROVEN — CharacterCreationScreen.finish(): stale error.value releases the creating-latch and stays rendered through a successful completion
- **F-A-AUTHORITY-1** Low/DOCUMENTATION_DEFECT — PROVEN — Spec-mandated documentation updates missed - 4 doc surfaces still describe the removed 3-step wizard / 5-point allocation
- **F-A-AUTHORITY-2** Low/DOCUMENTATION_DEFECT — PROVEN — D8 defensive-fallback comment updates and spec-mandated test retitle not applied - stale wording misattributes runtime default as creation grant
- **F-A-AUTHORITY-3** Nit/SPEC_DEFECT — PROVEN — Spec D5 footer 'inline summary + finish' - footer renders finish only
- **F-A-INTEGRATION-1** Medium/REAL_DEFECT — PROVEN — v82 restore-preflight rejections dead-end on a no-recovery boot screen (crafted/imported saves wedge the account)
- **F-A-INTEGRATION-2** Low/SPEC_DEFECT — PROVEN — SQL migrations hardcode the precursor id list, duplicating the TS authority
- **F-A-INTEGRATION-3** Low/REAL_DEFECT — PROVEN — Back button stays live during `creating`; abort intent is ignored once the RPC is in flight

## Coverage

- cells: 23 total; SATISFIED=23

## Chronology

- cycle CYC-RA-1: FINDINGS; reviews REV-A-CORRECTNESS,REV-A-AUTHORITY,REV-A-INTEGRATION

## Convergence

- OK C1-identity: all final evidence binds the declared state
- OK C2-census-coverage: census + coverage complete
- UNMET C3-no-open: open F-A-CORRECTNESS-1; open F-A-AUTHORITY-1; open F-A-AUTHORITY-2; open F-A-AUTHORITY-3; open F-A-INTEGRATION-1; open F-A-INTEGRATION-2; open F-A-INTEGRATION-3
- OK C4-final-gates: final gates green
- OK C5-sequential: sequential phase reviews present
- UNMET C6-clean-pair: Clean A missing/not CLEAN; Clean B missing/not CLEAN
- OK C7-mutation-corpus: mutation + corpus satisfied
- UNMET C8-terminal-check: no sealed independent TERMINAL_CHECK on the final state

## Validation failures

- MC12 F-A-CORRECTNESS-1: actionable finding still PROVEN
- MC12 F-A-AUTHORITY-1: actionable finding still PROVEN
- MC12 F-A-AUTHORITY-2: actionable finding still PROVEN
- MC12 F-A-AUTHORITY-3: actionable finding still PROVEN
- MC12 F-A-INTEGRATION-1: actionable finding still PROVEN
- MC12 F-A-INTEGRATION-2: actionable finding still PROVEN
- MC12 F-A-INTEGRATION-3: actionable finding still PROVEN
