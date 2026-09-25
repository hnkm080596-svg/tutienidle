# QA run ngu-kiem-beta-2026-09-25

- phase: DECIDE
- outcome: QA_FIXED_POINT_REACHED
- state: product=54cb20fa0560 contract=f2105ee05f6e attack=e3ff786f0f1a env=e3ca14a6b377
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
- **F-NK-FA-1** High/REAL_DEFECT — CLOSED — P15 ascii-comments ratchet fails on NguKiemDaoProvider comment
- **F-NK-FA-2** Low/REAL_DEFECT — CLOSED — kiem_tu_ngu baseline snapshot is an unreachable-state build (missing core_ngu_kiem_thuat + purchasedNodeIds mirror)
- **F-NK-FA-3** Low/NON_ACTIONABLE — REJECTED_WITH_PROOF — devResetBranch('ngu_kiem') strip of granted khoi re-granted by reconcileWayGrants on next restore
- **F-NK-FA-4** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — kiem_tu_ngu/burst_pressure seeds 11 and 22 produce identical fingerprint '576e9420'
- **F-NK-FA-5** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — evolution-resolved name surfaces only on SkillPath entry; combat HUD/log show base 'Ngự Kiếm'
- **F-NK-FC-1** Low/REAL_DEFECT — CLOSED — TurnSkillDisplayMeta ngu_kiem_thuat description not rewritten per spec sec.65
- **F-NK-FC-2** Low/REAL_DEFECT — CLOSED — QuanKhiPanel spec card text not updated per spec sec.103
- **F-NK-FC-3** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — plan-lane momentum accumulator scopes per deal_damage op (latent)
- **F-NK-FC-4** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — provider does not gate on ngu_kiem_khoi ownership (latent)
- **F-NK-FA-11** Low/REAL_DEFECT — CLOSED — mangled comment separators in KiemTuNodes.ts (box chars -> '?' runs)
- **F-NK-FA-6** Nit/REAL_DEFECT — CLOSED — 'dONG BO' capitalization artifact from ASCII sweep
- **F-NK-FA-7** Low/NON_ACTIONABLE — REJECTED_WITH_PROOF — latent lane-scope asymmetry in momentum contract (dormant)
- **F-NK-FA-8** Low/REAL_DEFECT — CLOSED — devResetBranch wipe of ngu_kiem_khoi silently resurrected on restore
- **F-NK-FA-9** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — base-name literal 'Ngự Kiếm' authored in 3 surfaces
- **F-NK-FA-10** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — kiem_tu_ngu/burst_pressure seeds 11+22 share fingerprint
- **F-NK-FA-12** Low/REAL_DEFECT — CLOSED — Stale cascade-era flavor text on myriad_swords_art
- **F-NK-FA-13** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — Base-name literal 'Ngự Kiếm' duplicated across 3 static surfaces
- **F-NK-FA-14** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — Evolution spine tier order encoded twice
- **F-NK-FA-15** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — Contract member emblemSlots retained with zero producers
- **F-NK-COR-A3-1** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — locale files lost trailing EOF newline
- **F-NK-AUT-A3-1** Low/COVERAGE_GAP — CLOSED — way.grantedNodeIds has no contract coverage - nothing asserts members are grant-only, way-tagged, or respec-preserved
- **F-NK-AUT-A3-2** Nit/REAL_DEFECT — CLOSED — 'Ngự Kiếm' base-name literal triplicated across three display channels
- **F-NK-AUT-A3-3** Nit/DOCUMENTATION_DEFECT — CLOSED — stale KiemTuPath.ts header comment claims file imports only the sibling SwordPathState factory
- **F-NK-COR-A4-1** Low/TEST_DEFECT — CLOSED — hiddenNguFoundationBuild snapshot is not a reachable post-ritual state
- **F-NK-COR-A4-2** Nit/REAL_DEFECT — CLOSED — en.json + vi.json lost the file-ending newline
- **F-NK-AUT-A4-1** Low/REAL_DEFECT — CLOSED — runtime import cycle KiemTuPath <-> NguKiemDao inverts the leaf invariant
- **F-NK-AUT-A4-2** Low/TEST_DEFECT — CLOSED — hiddenNguFoundationBuild fixture violates the core_* mirror contract
- **F-NK-AUT-A4-3** Nit/REAL_DEFECT — CLOSED — ngu_kiem_phong_an carries unreachable insightCost: 3 on a grantedOnly node
- **F-NK-COR-A5-1** Low/REAL_DEFECT — CLOSED — onCastResolved ignores resolvedSkillId - +1 Kiem Y on any committed participant action
- **F-NK-COR-A5-2** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — sealed '???' node renders 'locked' with zero lock reasons at golden_core
- **F-NK-COR-A5-3** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — BalanceMatrix oracle cross-seed fingerprint collision
- **F-NK-COR-A6-1** Medium/REAL_DEFECT — CLOSED — P15 asciiComments gate red at pinned HEAD - unmasked em dashes in NguKiemDao doc blocks
- **F-NK-COR-A6-2** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — asciiComments scanTsChunk desyncs at ${ - stale baselines + latent masking (pre-existing)
- **F-NK-AUT-A6-1** Medium/REAL_DEFECT — DUPLICATE_LINKED — P15 asciiComments gate red at d6592689 - same em-dash docblocks as COR-A6-1
- **F-NK-AUT-A6-2** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — Zero-producer contract seams retained after legacy removal
- **F-NK-AUT-A6-3** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — Stale P15 baseline allowances for removed NguKiemDao // header lines
- **F-NK-TERMINAL-1** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — Evolved skill name resolves only in SkillPathPanel - combat HUD/loadout show 'Ngu Kiem' base name

## Coverage

- cells: 0 total; 

## Chronology

- cycle CYCLE-NK-A: STALE; reviews REV-NK-COR-A,REV-NK-AUT-A,REV-NK-INT-A
- cycle CYCLE-NK-B: STALE; reviews REV-NK-COR-B,REV-NK-AUT-B,REV-NK-INT-B
- cycle CYCLE-NK-CLEAN-A: CLEAN; reviews REV-NK-COR-A7,REV-NK-AUT-A7,REV-NK-INT-A7
- cycle CYCLE-NK-CLEAN-B: CLEAN; reviews REV-NK-COR-B,REV-NK-AUT-B,REV-NK-INT-B

## Convergence

- OK C1-identity: all final evidence binds the declared state
- OK C2-census-coverage: census + coverage complete
- OK C3-no-open: none open
- OK C4-final-gates: final gates green
- OK C5-sequential: sequential phase reviews present
- OK C6-clean-pair: Clean A/B complete and independent
- OK C7-mutation-corpus: mutation + corpus satisfied
- OK C8-terminal-check: independent terminal verifier sealed
- OK C9-readiness: brief(s) lack finalConformance evidence: 
