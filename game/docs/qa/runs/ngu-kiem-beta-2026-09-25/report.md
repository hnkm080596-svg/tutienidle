# QA run ngu-kiem-beta-2026-09-25

- phase: DECIDE
- outcome: QA_UNVERIFIED
- state: product=7a934c47fb1d contract=f2105ee05f6e attack=e3ff786f0f1a env=e3ca14a6b377
- base/head: be1bdf8d5f3f95f4950e42e4b51e0c56a2b8f7df -> d8321ba8

## Findings

- **F-NK-QA-1** Low/TEST_DEFECT — CLOSED — Engine-lane Kiem The momentum pin flaky under unseeded rng (attacker critRate not zeroed)
- **F-NK-AUT-1** Medium/REAL_DEFECT — CLOSED — Momentum ops_result_sum reads aliased the live prior-opId accumulator
- **F-NK-AUT-2** Low/TEST_DEFECT — CLOSED — instances.each.momentumPerLandedInstance unvalidated in registry
- **F-NK-AUT-3** Low/TEST_DEFECT — CLOSED — fixture/evolution ids inconsistent with authored spine
- **F-NK-AUT-4** Nit/TEST_DEFECT — CLOSED — stale cascade-era comments in runtime files
- **F-NK-AUT-5** Medium/REAL_DEFECT — CLOSED — ngu_kiem_phong shipped at v84 - reuse would rebind owned save levels
- **F-NK-AUT-6** Low/REAL_DEFECT — CLOSED — evolution display name hardcoded '-' split; no resolver API
- **F-NK-AUT-7** Medium/REAL_DEFECT — CLOSED — pre-beta hidden-way saves can never obtain ngu_kiem_khoi (grantedOnly, no retro-grant)
- **F-NK-INT-2** Low/TEST_DEFECT — DUPLICATE_LINKED — SkillDefinitionRegistry does not validate instances.each.momentumPerLandedInstance (INTEGRATION duplicate of F-NK-AUT-2)
- **F-NK-INT-3** Low/REAL_DEFECT — CLOSED — fractional kiemDaoCount/kiemDaoBase accepted; plan lane floors vs engine lane iterates raw
- **F-NK-INT-4** Nit/TEST_DEFECT — DUPLICATE_LINKED — ngu_kiem_phong stale in TECHNIQUE_CAP_ALLOWLIST (INTEGRATION duplicate of F-NK-AUT-5)
- **F-NK-INT-5** Nit/TEST_DEFECT — CLOSED — kiem_tu_ngu benchmark recipe owns khoi only - momentum lane unexercised
- **F-NK-INT-7** Nit/TEST_DEFECT — CLOSED — filler assertion in cross-target momentum test
- **F-NK-INT-6** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — purchaseNode lacks the in-battle guard respecNodeTree/switchRoute carry
- **F-NK-INT-1** Medium/REAL_DEFECT — DUPLICATE_LINKED — Pre-beta hidden_sword_pathway saves can never obtain ngu_kiem_khoi - evolution spine locked (INTEGRATION duplicate of F-NK-AUT-7)
- **F-NK-COR-1** Medium/REAL_DEFECT — DUPLICATE_LINKED — pre-existing hidden_sword_pathway saves can never obtain ngu_kiem_khoi - Lien permanently gated
- **F-NK-COR-2** Nit/DOCUMENTATION_DEFECT — CLOSED — stale comments referencing removed ngu mechanics mislead authors
- **F-NK-COR-3** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — dead plumbing after removal: unused rng param + zero-implementer emblemSlots + technique description retains old way name
- **F-NK-INT-8** Medium/REAL_DEFECT — CLOSED — pre-beta hidden_sword_pathway saves can never obtain ngu_kiem_khoi
- **F-NK-INT-9** Low/REAL_DEFECT — CLOSED — SkillDefinitionRegistry does not validate instances.each.momentumPerLandedInstance
- **F-NK-INT-10** Low/REAL_DEFECT — CLOSED — fractional kiemDaoCount/kiemDaoBase accepted by save validation
- **F-NK-INT-11** Nit/TEST_DEFECT — CLOSED — ngu_kiem_phong left in TECHNIQUE_CAP_ALLOWLIST
- **F-NK-INT-12** Nit/TEST_DEFECT — CLOSED — kiem_tu_ngu benchmark recipe never exercises momentum
- **F-NK-INT-13** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — purchaseNode lacks the in-battle guard respec/switchRoute carry
- **F-NK-INT-14** Nit/TEST_DEFECT — CLOSED — filler assertion in cross-target momentum test
- **F-NK-CLO-1** High/REAL_DEFECT — CLOSED — save-shape validator rejects legitimate post-breakthrough hidden-way saves
- **F-NK-CLO-2** Medium/REAL_DEFECT — CLOSED — cap lane throws RangeError on mortal-realm saves
- **F-NK-CLO-3** Nit/REAL_DEFECT — CLOSED — target_hit_landed read aliases live hitOpIdsByTarget array
- **F-NK-CLO-4** Nit/REAL_DEFECT — CLOSED — gate.hitOperationIds still aliases live hitOpIdsByTarget array
- **F-NK-CLO-5** Nit/REAL_DEFECT — CLOSED — 'Two producers' header contradicts 'no current producer' bullet
- **F-NK-AUT-8** Medium/REAL_DEFECT — CLOSED — save validator bounds kiemDaoBase by queue cap - merge product legitimately exceeds it
- **F-NK-AUT-9** Low/REAL_DEFECT — CLOSED — duplicated naming authority: suffix map vs node.name
- **F-NK-AUT-10** Low/REAL_DEFECT — CLOSED — owned-evolution predicate duplicated in one file
- **F-NK-AUT-11** Low/NON_ACTIONABLE — REJECTED_WITH_PROOF — devResetBranch wipe of granted node non-durable - reconcileWayGrants re-grants on restore
- **F-NK-AUT-12** Nit/REAL_DEFECT — CLOSED — newest-layer resolution relies on registry iteration order
- **F-NK-AUT-13** Nit/REAL_DEFECT — CLOSED — comment mojibake (? fragments) + dead rng contract member
- **F-NK-COR-4** Medium/REAL_DEFECT — DUPLICATE_LINKED — save cap validator bounds multiplicative kiemDaoBase by linear count cap
- **F-NK-COR-5** Low/REAL_DEFECT — CLOSED — kiem_tu_ngu benchmark recipe never exercises momentum multiplier
- **F-NK-COR-6** Nit/REAL_DEFECT — DUPLICATE_LINKED — Vietnamese comments flattened to ? fragments
- **F-NK-INT-15** Critical/REAL_DEFECT — DUPLICATE_LINKED — kiemDaoBase bounded by count cap - legitimate post-merge saves classified corrupted (3rd independent discovery, proven chain to save-refusal)
- **F-NK-INT-16** Low/REAL_DEFECT — CLOSED — sealed ngu_kiem_phong_an purchasable at golden_core for 3 Insight delivering nothing
- **F-NK-AUTB-1** High/REAL_DEFECT — CLOSED — fa45c1eb swept đ→d inside user-facing description literals (26-33 strings), beyond comment-mojibake scope
- **F-NK-CORB-1** Medium/REAL_DEFECT — CLOSED — TurnSkillDisplayMeta.ts: 33 user-facing description strings corrupted by đ→d sweep
- **F-NK-AUTB-2** Low/REAL_DEFECT — CLOSED — INV-12 absent-pin list lost retired ids ngu_kiem_sac/phong/sat
- **F-NK-CLO4-1** Low/REAL_DEFECT — CLOSED — fa45c1eb regressed 33 user-facing description strings (đ→d beyond mojibake scope)
- **F-NK-CLO4-2** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — pre-existing comment mojibake outside swept roots (useTribulation.ts, GameManager.phapTuChain/bossSummon.test.ts)
- **F-NK-INTB-1** Low/REAL_DEFECT — CLOSED — INV-12 deadIds pin covers only 3 of 15 retired ngu-kiem ids
- **F-NK-INTB-2** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — Evolution ownership battle-build-scoped while counters live-read per cast
- **F-NK-INTB-3** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — devResetBranch strips granted Khoi; reconcileWayGrants re-grants only at next restore
- **F-NK-INTB-4** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — QuanKhi spec card still reads 'Ngu Kiem Dao' - spec beta rewording not applied
- **F-NK-INTB-5** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — kiem_tu_ngu/burst_pressure baseline shares one fingerprint for seeds 11 and 22

## Coverage

- cells: 0 total; 

## Chronology

- cycle CYCLE-NK-A: STALE; reviews REV-NK-COR-A,REV-NK-AUT-A,REV-NK-INT-A
- cycle CYCLE-NK-B: STALE; reviews REV-NK-COR-B,REV-NK-AUT-B,REV-NK-INT-B,REV-NK-CLO-6

## Convergence

- OK C1-identity: all final evidence binds the declared state
- OK C2-census-coverage: census + coverage complete
- OK C3-no-open: none open
- UNMET C4-final-gates: EV-NK-FIX-4 status=STALE result=PASS
- OK C5-sequential: sequential phase reviews present
- UNMET C6-clean-pair: Clean A missing/not CLEAN; Clean B missing/not CLEAN
- OK C7-mutation-corpus: mutation + corpus satisfied
- UNMET C8-terminal-check: no sealed independent TERMINAL_CHECK on the final state
- UNMET C9-readiness: brief(s) lack finalConformance evidence: BRF-NK-01

## Validation failures

- MC12 EV-NK-FIX-4: final gate evidence is not CURRENT
