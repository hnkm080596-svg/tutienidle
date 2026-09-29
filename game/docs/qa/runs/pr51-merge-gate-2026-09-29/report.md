# QA run pr51-merge-gate-2026-09-29

- phase: DECIDE
- outcome: QA_BLOCKED_SCOPE
- state: product=b1b1c5ff0d97 contract=cf9466eb0fb9 attack=750d1a53dd23 env=b11d13feb231
- base/head: f196b8d0 -> ef1f16f4

## Findings

- **F-MG-01** Low/REAL_DEFECT — CLOSED — P15 asciiComments ratchet violated by fix-commit comments (em dash/arrow/Vietnamese tokens)
- **F-MG-02** Low/TEST_DEFECT — CLOSED — PlayerStatAssembly.test pinned pre-CP-01 min (finalDamageReductionPercent -1 -> 0)
- **F-MG-03** Medium/REAL_DEFECT — REJECTED_WITH_PROOF — PRE-EXISTING on master: combatContract R14.4 searches parameterless onBattleStart()
- **F-MG-04** Medium/REAL_DEFECT — REJECTED_WITH_PROOF — PRE-EXISTING on master: src/dev/skill-vfx.ts constructs new Game() outside region host
- **F-MG-05** Medium/REAL_DEFECT — REJECTED_WITH_PROOF — PRE-EXISTING on master: PlayerPortrait.test mounts component without active Pinia
- **F-MG-06** Low/REAL_DEFECT — HUMAN_EXCEPTION — Documented deferred audit items (frontend Lows/Nits: quest reward disclosure, kicker contrast, stage-select hints, label overflow; backend Lows: CP-02, EM-03/04, INFRA-03..08) - human-accepted deferral
- **F-MG-07** Medium/COVERAGE_GAP — CLOSED — Coverage gap: no detector pinned the TalentBuffs-side flat channel (mutation SURVIVED first pass)
- **F-MG-08** Medium/COVERAGE_GAP — CLOSED — Coverage gap: claim-path accrual pin fed rate-carry + materialId unasserted (mutation SURVIVED first pass)
- **F-MG-09** High/REAL_DEFECT — CLOSED — CP01-CANTHAN-RAMP: per_second flatStat with no maxStacks ramps one stack per second unbounded
- **F-MG-10** Low/REAL_DEFECT — CLOSED — CLOUD-INSERT-UPSERT: first-push POST carried merge-duplicates preference
- **F-MG-11** Low/REAL_DEFECT — CLOSED — HAPLINH-DEAD-PERCENT: leechPercent percent modifier dead on zero base + unbounded per-second stack vs spec x2.5
- **F-MG-12** Nit/REAL_DEFECT — CLOSED — MOD-ID-COLLISION: identical generated modifier ids for same-stat same-cap modifiers
- **F-MG-13** Low/REAL_DEFECT — CLOSED — ACCRUAL-REALM-UNVALIDATED: accrualRealmId accepted unchecked at save shape + acceptance gates
- **F-MG-14** Medium/REAL_DEFECT — CLOSED — STARTER-ACCRUAL-PIN: starter gathering_outpost without accrualRealmId
- **F-MG-15** Low/REAL_DEFECT — CLOSED — collectBuilding pre-check uses current realm instead of pinned
- **F-MG-16** Low/NON_ACTIONABLE — CLOSED — kiem_vuc burst self-sustains after first trigger (crit feedback loop)
- **F-MG-17** Nit/REAL_DEFECT — CLOSED — bat_tu_the description crit-only vs any-lethal implementation
- **F-MG-18** High/REAL_DEFECT — PROVEN — Cloud reconcile ordering loses progress under device divergence (save_revision is a per-device write counter, not a shared sequence)
- **F-MG-19** Medium/REAL_DEFECT — PROVEN — PlayerPortrait bypasses CULTIVATE_TEXTURE_OVERRIDES - hidden_spell_pathway player sees phap_tu ngu-hanh cultivate art instead of van-dao on home figure + RealmPanel
- **F-MG-20** Medium/TEST_DEFECT — PROVEN — PlayerPortrait.test.ts mounts without Pinia - getActivePinia throws; suite fails 1 test (delta-caused by usePlayerStore() added in setup)
- **F-MG-21** Medium/REAL_DEFECT — PROVEN — Offline un-buff derivation divides saved cPS by percent at SAVE time while cPS was folded at LAST-TICK percent - buff flipping in the gap mis-folds the whole offline window
- **F-MG-22** Medium/REAL_DEFECT — PROVEN — saveShapeValidation does not check persistentTimedEffects.cultivationSpeedPercent/effectGroup - crafted save yields Infinity/NaN unbuffed rate -> NaN cultivation (permanent progression corruption)
- **F-MG-23** Low/REAL_DEFECT — PROVEN — Conditioned per_second passives fail open out of battle (hpReader undefined) - both complementary legs accumulate to cap; stat surfaces display combat band while idle
- **F-MG-24** Low/REAL_DEFECT — PROVEN — Pull writes revision key before save key - exception in the 2-setItem window leaves revision=N + stale payload; later push writes stale lineage at N+1 (pulled payload lost)
- **F-MG-25** Low/REAL_DEFECT — PROVEN — visualArmed returns false for every non-mortal profile - reports 'unarmed' for states never meant to carry the concept
- **F-MG-26** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — per_second accumulator banks full delta while condition fails and burst-applies on re-entry - latent ramp if a future conditioned passive is uncapped
- **F-MG-27** Nit/NON_ACTIONABLE — DUPLICATE_LINKED — remoteAhead uses most-saved-wins across diverged sessions (deterministic counter compare) - policy tradeoff folded into F-MG-18
- **F-MG-28** Nit/REAL_DEFECT — PROVEN — Dead code + unused field + committed dev artifacts: (cultivationPath==='mortal') dead check, CULTIVATE_TEXTURE_OVERRIDES.extent unread, verify-*.mjs+png committed at game root
- **F-MG-29** Nit/REAL_DEFECT — PROVEN — accrualRealmId is plain string instead of the realm-id brand - contract looseness only (runtime membership enforced by saveAcceptance)
- **F-MG-30** Nit/REAL_DEFECT — PROVEN — TuLinhTranBalance.ts ends without trailing newline
- **F-MG-31** Nit/DOCUMENTATION_DEFECT — PROVEN — ~72 dangling references to deleted art assets remain in asset READMEs/design docs (runtime clean - zero code refs verified)
- **F-MG-32** Nit/TEST_DEFECT — DUPLICATE_LINKED — 3 test failures observed by clean reviewers are the same adjudicated pre-existing/base-pin failures (combatContract onBattleStart pin, dynamicRegionHost, i18nKeyParity) - duplicate of F-MG-03/04/05

## Coverage

- cells: 22 total; SATISFIED=22

## Chronology

- cycle CYC-P5-1: STALE; reviews RV-P1-CORRECTNESS,RV-P2-AUTHORITY,RV-P3-INTEGRATION
- cycle CYC-P5-2: STALE; reviews RV-S4-P1,RV-S4-P2,RV-S4-P3
- cycle CYC-P5-3: STALE; reviews RV-S7-P1,RV-S7-P2,RV-S7-P3
- cycle CYC-P5-4: CLEAN; reviews RV-S9-P1,RV-S9-P2,RV-S9-P3
- cycle CYC-CLEAN-B-ATTEMPT: INCOMPLETE; reviews RV-CLEAN-B1,RV-TERMINAL-B1
- cycle CYC-CLEAN-A-FINAL: FINDINGS; reviews RV-CLEAN-A-FINAL,RV-CLEAN-B-FINAL,RV-TERMINAL-B-FINAL,RV-CLEAN-C-FINAL

## Convergence

- OK C1-identity: all final evidence binds the declared state
- OK C2-census-coverage: census + coverage complete
- UNMET C3-no-open: open F-MG-18; open F-MG-19; open F-MG-20; open F-MG-21; open F-MG-22; open F-MG-23; open F-MG-24; open F-MG-25; open F-MG-28; open F-MG-29; open F-MG-30; open F-MG-31; exception F-MG-06
- OK C4-final-gates: final gates green
- OK C5-sequential: sequential phase reviews present
- UNMET C6-clean-pair: Clean A missing/not CLEAN; Clean B missing/not CLEAN
- OK C7-mutation-corpus: mutation + corpus satisfied
- OK C8-terminal-check: independent terminal verifier sealed
- OK C9-readiness: readiness not required for this run (v1 or opt-out)

## Validation failures

- MC4 EV-ADVERSARIAL: SOURCE_PROOF without source artifact paths
- MC4 EV-ADVERSARIAL-S4: SOURCE_PROOF without source artifact paths
- MC5 F-MG-01: closure reviewer coordinator is the discovering fixer context
- MC5 F-MG-02: closure reviewer coordinator is the discovering fixer context
- MC5 F-MG-09: CLOSED without sibling-search evidence
- MC5 F-MG-10: CLOSED without sibling-search evidence
- MC5 F-MG-11: CLOSED without sibling-search evidence
- MC5 F-MG-12: CLOSED without sibling-search evidence
- MC5 F-MG-13: CLOSED without sibling-search evidence
- MC5 F-MG-14: CLOSED without sibling-search evidence
- MC5 F-MG-15: CLOSED without sibling-search evidence
- MC5 F-MG-16: CLOSED without sibling-search evidence
- MC5 F-MG-16: CLOSED without regression pin or explicit alternative rationale
- MC5 F-MG-16: CLOSED without current affected verification
- MC5 F-MG-16: CLOSED without closure review
- MC5 F-MG-17: CLOSED without sibling-search evidence
- MC5 F-MG-17: CLOSED without regression pin or explicit alternative rationale
- MC6 F-MG-16: actionable=false requires REJECTED_WITH_PROOF (or human exception), status=CLOSED
- MC6 F-MG-27: actionable=false requires REJECTED_WITH_PROOF (or human exception), status=DUPLICATE_LINKED
- MC9 RV-CLEAN-A-FINAL: clean-round review has priorFindingsVisible=false or access limits — contaminated, cannot count as independent
- MC9 RV-CLEAN-B-FINAL: clean-round review has priorFindingsVisible=false or access limits — contaminated, cannot count as independent
- MC9 RV-CLEAN-C-FINAL: clean-round review has priorFindingsVisible=false or access limits — contaminated, cannot count as independent
- MC9 CYC-CLEAN-B-ATTEMPT: cycle missing sequential phase AUTHORITY
- MC9 CYC-CLEAN-B-ATTEMPT: cycle missing sequential phase INTEGRATION
- MC9 CYC-CLEAN-A-FINAL: AUTHORITY phase does not reference CORRECTNESS review as predecessor
- MC9 CYC-CLEAN-A-FINAL: INTEGRATION phase does not reference AUTHORITY review as predecessor
- MC10 CYC-CLEAN-A-FINAL: CleanA recorded findings — not clean
- MC12 F-MG-18: actionable finding still PROVEN
- MC12 F-MG-19: actionable finding still PROVEN
- MC12 F-MG-20: actionable finding still PROVEN
- MC12 F-MG-21: actionable finding still PROVEN
- MC12 F-MG-22: actionable finding still PROVEN
- MC12 F-MG-23: actionable finding still PROVEN
- MC12 F-MG-24: actionable finding still PROVEN
- MC12 F-MG-25: actionable finding still PROVEN
- MC12 F-MG-28: actionable finding still PROVEN
- MC12 F-MG-29: actionable finding still PROVEN
- MC12 F-MG-30: actionable finding still PROVEN
- MC12 F-MG-31: actionable finding still PROVEN
- MC13 F-MG-01: terminal finding has no linked lesson record (meaningful incidents must enter learning history)
- MC13 F-MG-02: terminal finding has no linked lesson record (meaningful incidents must enter learning history)
- MC13 F-MG-03: terminal finding has no linked lesson record (meaningful incidents must enter learning history)
- MC13 F-MG-04: terminal finding has no linked lesson record (meaningful incidents must enter learning history)
- MC13 F-MG-05: terminal finding has no linked lesson record (meaningful incidents must enter learning history)
- MC13 F-MG-06: terminal finding has no linked lesson record (meaningful incidents must enter learning history)
- MC13 F-MG-07: terminal finding has no linked lesson record (meaningful incidents must enter learning history)
- MC13 F-MG-08: terminal finding has no linked lesson record (meaningful incidents must enter learning history)
- MC13 F-MG-09: terminal finding has no linked lesson record (meaningful incidents must enter learning history)
- MC13 F-MG-10: terminal finding has no linked lesson record (meaningful incidents must enter learning history)
- MC13 F-MG-11: terminal finding has no linked lesson record (meaningful incidents must enter learning history)
- MC13 F-MG-12: terminal finding has no linked lesson record (meaningful incidents must enter learning history)
- MC13 F-MG-13: terminal finding has no linked lesson record (meaningful incidents must enter learning history)
- MC13 F-MG-14: terminal finding has no linked lesson record (meaningful incidents must enter learning history)
- MC13 F-MG-15: terminal finding has no linked lesson record (meaningful incidents must enter learning history)
- MC13 F-MG-16: terminal finding has no linked lesson record (meaningful incidents must enter learning history)
- MC13 F-MG-17: terminal finding has no linked lesson record (meaningful incidents must enter learning history)
- MC13 F-MG-26: terminal finding has no linked lesson record (meaningful incidents must enter learning history)
- MC13 F-MG-27: terminal finding has no linked lesson record (meaningful incidents must enter learning history)
- MC13 F-MG-32: terminal finding has no linked lesson record (meaningful incidents must enter learning history)
