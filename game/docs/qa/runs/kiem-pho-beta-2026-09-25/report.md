# QA run kiem-pho-beta-2026-09-25

- phase: DECIDE
- outcome: QA_ACCEPTED_WITH_EXCEPTIONS
- state: product=d2aeb17cdf3d contract=68be2876e9df attack=f73add73bfbe env=7dbf357f7d8b
- base/head: master -> cc235a3715d6a17a13350c2fcb14a6ac67b4e7f8

## Findings

- **F-KP-CA-01** Low/REAL_DEFECT — CLOSED — Stale KiemTuNodes.test.ts header describes retired 5-orb tree
- **F-KP-CA-02** Nit/REAL_DEFECT — CLOSED — 'phase order' test asserted pre-sort append order, not sorted result
- **F-KP-CA-03** Nit/REAL_DEFECT — CLOSED — Spec DEC-5 listed combo extras as a fold emit point (vacuous)
- **F-KP-CA-04** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — Empty/invalid preset + purchased modifier node could TypeError on undefined def
- **F-KP-CA-05** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — thuong_tham x1.25 periodic damage pinned at op-payload level only
- **F-KP-CA-06** Low/NON_ACTIONABLE — REJECTED_WITH_PROOF — Orphaned orb_* nodeLevels in legacy saves inert, no Insight refund
- **F-KP-CA-07** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — Some new tests assert mechanism rather than observable behavior
- **F-KP-CA-08** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — Pre-existing eslint noise in CultivationPathRegistry.ts
- **F-KP-CB-C1** High/NON_ACTIONABLE — HUMAN_EXCEPTION — BalanceMatrix committed fingerprint oracle fails - kiem_tu_hien shift not re-baselined; strengths gate flipped (strictly dominates the_tu_hien everywhere)
- **F-KP-CB-C2** Medium/TEST_DEFECT — CLOSED — thich_can + tram_can techniqueRank levelGates outside M-QI-06 allowlist
- **F-KP-CB-C3** Low/DOCUMENTATION_DEFECT — CLOSED — P15 violation: em dashes in KiemTuNodes.test.ts comment header (introduced by adjudication commit)
- **F-KP-CB-C4** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — nextOrb on empty preset dereferences undefined (TypeError mid-battle)
- **F-KP-CB-I1** Low/NON_ACTIONABLE — REJECTED_WITH_PROOF — PRE-EXISTING: preset cursor advances on sealed/forbidden selections (cam_cong)
- **F-KP-CB-I2** Low/REAL_DEFECT — CLOSED — add_stacks lane missing gateOnApplyResult binding the other interaction kinds carry
- **F-KP-CB-I3** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — devResetBranch lacks the in-battle guard its sibling mutators have
- **F-KP-CB-A1** Low/COVERAGE_GAP — CLOSED — DEC-6 predicate requirement enforced only as silent non-match - no validator for swordPathComboModifier
- **F-KP-CB-A2** Nit/REAL_DEFECT — CLOSED — comboToExtraDef passes ailmentInteractions by shared reference
- **F-KP-CB-A3** Nit/REAL_DEFECT — CLOSED — collectKiemPho*Modifiers gate way-only vs 4-way sibling collector
- **F-KP-3A-1** Low/REAL_DEFECT — CLOSED — adapter emits dead gateOnApplyResult onto add_buff_stacks ops (undeclared flag masks missing lane)
- **F-KP-3A-2** Nit/DOCUMENTATION_DEFECT — CLOSED — dead scaffold comment 'Hidden-path root (Task 10 contract)' left after KiemTuNodes restructure
- **F-KP-3A-3** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — predicate-less swordPathComboModifier entries silently never match (no authored-data validation)
- **F-KP-C4-1** High/REAL_DEFECT — DUPLICATE_LINKED — Balance fingerprint + strengths gate red after kiem-pho beta (oracle re-baseline + the_tu_hien strength loss)
- **F-KP-C4-2** Low/REAL_DEFECT — CLOSED — reachableKiemPhoComboIds ignores realmComboMax — len-5 combos listed reachable where cap is 4
- **F-KP-C4-3** Low/NON_ACTIONABLE — REJECTED_WITH_PROOF — crafted save: kiemPhoPreset containing realm-locked orbs passes load validation
- **F-KP-C4-4** Nit/REAL_DEFECT — DUPLICATE_LINKED — gateOnApplyResult metadata dead on add_buff_stacks path
- **F-KP-C4-5** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — crafted empty preset -> nextOrb index crash
- **F-KP-6A-1** Low/REAL_DEFECT — CLOSED — Empty preset + owned skill-definition node: resolveBasic throws TypeError instead of degrading to static basic
- **F-KP-6A-2** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — add_stacks binds latest same-source instance after resisted apply (DEC-7, documented)
- **F-KP-7A-1** Low/TEST_DEFECT — CLOSED — skillDefinitionModifiers.skillId + ailmentInteractions.buffId lack authored-id resolution pin - typos silently dead-code
- **F-KP-7A-2** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — applyModifiers exported solely for test seam
- **F-KP-7A-3** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — isOrbId 'in'-check admits Object-prototype keys (pre-existing, guarded downstream)
- **F-KP-8A-1** Low/REAL_DEFECT — CLOSED — Crafted-save preset bypasses orb realm gates: auto path casts realm-locked orbs (and locked combos) - load-time validation is shape-only
- **F-KP-8A-2** Low/NON_ACTIONABLE — REJECTED_WITH_PROOF — Authored len-5 scaffold combo 'thich_tram_tram_phach_thich' [D,C,C,B,D] unreachable - pre-empted by interior tail match 'nhi_tram_nhat_phach' [C,C,B]
- **F-KP-8A-3** Nit/REAL_DEFECT — CLOSED — applySkillDefinitionModifiers armorPierceFraction clamps only the upper bound - spec comment promises [0,1]
- **F-KP-9-1** Medium/TEST_DEFECT — CLOSED — swordPathComboModifier authored ids lack the same resolution pin F-KP-7A-1 added
- **F-KP-10-1** Medium/TEST_DEFECT — CLOSED — KIEM_PHO_COMBOS authored buff ids lack the resolution pin F-KP-9-1 added to the node channel
- **F-KP-10-2** Nit/TEST_DEFECT — CLOSED — buff-id pins assert vs KIEM_PHO_BUFFS while runtime resolution space is BUFF_REGISTRY
- **F-KP-INTB-PRE** Low/NON_ACTIONABLE — REJECTED_WITH_PROOF — Pre-existing: crafted-save nodeLevels inflation feeds level-scaled effects (S6 tolerance class)

## Coverage

- cells: 0 total; 

## Chronology

- cycle CYCLE-KP-A: CLEAN; reviews REV-KP-COR-A,REV-KP-AUT-A,REV-KP-INT-A
- cycle CYCLE-KP-B: CLEAN; reviews REV-KP-COR-B,REV-KP-AUT-B,REV-KP-INT-B

## Convergence

- OK C1-identity: all final evidence binds the declared state
- OK C2-census-coverage: census + coverage complete
- UNMET C3-no-open: exception F-KP-CB-C1
- OK C4-final-gates: final gates green
- OK C5-sequential: sequential phase reviews present
- OK C6-clean-pair: Clean A/B complete and independent
- OK C7-mutation-corpus: mutation + corpus satisfied
- OK C8-terminal-check: independent terminal verifier sealed
- OK C9-readiness: readiness not required for this run (v1 or opt-out)
