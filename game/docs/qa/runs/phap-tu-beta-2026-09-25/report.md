# QA run phap-tu-beta-2026-09-25

- phase: DECIDE
- outcome: QA_UNVERIFIED
- state: product=d458c31d3444 contract=42e4f2876e38 attack=d33041f0d78d env=e3ca14a6b377
- base/head: be1bdf8d5f3f95f4950e42e4b51e0c56a2b8f7df -> 61a192e9e58c6811721538859ba975968b3f6705

## Findings

- **F-CA-01** High/REAL_DEFECT — CLOSED — stat() helper authored flat:0 + perLevelFlat -> level 1 was a dead purchase and the payout curve sat one level low
- **F-CA-02** High/REAL_DEFECT — CLOSED — respecNodeTree/previewNodeRespec revoked realm-reward (rewardOnly) grants, silently destroying Truc Co grant levels
- **F-CA-03** Medium/DOCUMENTATION_DEFECT — CLOSED — van_moc_lan_doc description claimed AoE poison spread the skill never implements (primary_target only)
- **F-CA-04** Low/REAL_DEFECT — CLOSED — element=null mastery leak: spell_pathway player at foundation (no committed element) aggregated all 5 elemental masteries
- **F-CA-05** Medium/REAL_DEFECT — CLOSED — vfxPresetId was dead plumbing: Skill.vfxPresetId authored but toTurnSkillDefinition never mapped it to TurnSkillDefinition.presetId -> all basics resolved default arcane_impact
- **F-CA-06** Medium/SPEC_DEFECT — CLOSED — file header claimed nodes power 'the BASIC skill only (skill-scoped)' but StatModifier has no skillId scope - stats are spell-domain global
- **F-CA-07** Medium/TEST_DEFECT — CLOSED — test pins weak/leaky: capstone mutex pin did not bind same-element pairing; outer-ring test derived membership from the logic it checked; ritual-flow test pinned the leaky contract
- **F-CA-08** Nit/DOCUMENTATION_DEFECT — CLOSED — dead imports: getNextLevelCost + ElementType in NodeInspector.vue, createBaseStats in respec test
- **F-CA-09** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — save leniency for non-core fields is pre-existing behavior the new grant path rides on
- **F-CB-A1** Low/REAL_DEFECT — CLOSED — resolveMaxThe used purchase-gate isNodeElementActive at an aggregation site (latent wrong-gate)
- **F-CB-A2** Low/REAL_DEFECT — CLOSED — cascadeRevokeOrphanedNodes lacked a rewardOnly exemption - grant survival depended on data discipline
- **F-CB-A3** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — grantedNodeLevels writes nodeLevels only - purchasedNodeIds mirror divergence (deliberate, pinned)
- **F-CB-A4** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — chooseCultivationPath never fires grantCultivationPathRealmReward - qi_refining-keyed grants would silently never apply
- **F-CB-A5** Nit/REAL_DEFECT — CLOSED — stale comments: non-existent aggregateNodeSkillModifiers name; hidden-way 'can never aggregate' now partially stale
- **F-CB-A6** Nit/REAL_DEFECT — CLOSED — reward-node ids duplicated as string literals between PhapTuPath grantedNodeLevels and PhapTuRealmRewardNodes constants
- **F-CB-C1** Medium/REAL_DEFECT — CLOSED — tho_cung_gioi dead purchase: ailmentPotencyPercent never applies to tran_an
- **F-CB-C2** Medium/REAL_DEFECT — CLOSED — Apply-chance nodes delivered ~2x less than documented (additive contract consumed multiplicatively)
- **F-CB-C3** Low/REAL_DEFECT — CLOSED — hoa_tan_diem spread spec paid no hit-power tax
- **F-CB-C4** Low/REAL_DEFECT — CLOSED — NodeInspector realm lock reason threw on unknown realmId
- **F-CB-C5** Nit/REAL_DEFECT — CLOSED — resolveMaxThe used isNodeElementActive and omitted nodePathApplies
- **F-CB-C6** Nit/REAL_DEFECT — CLOSED — cascadeRevokeOrphanedNodes lacked a rewardOnly exemption
- **F-CB-C7** Nit/REAL_DEFECT — CLOSED — Spec display name 'Bang Loan' vs node name 'Da Loan' (ice vs earth)
- **F-CB-C8** Nit/REAL_DEFECT — CLOSED — CombatAction.ts comment lost the '+-' glyph during ASCII normalization
- **F-CB-C9** Nit/REAL_DEFECT — CLOSED — skillIcon presentation pipeline had no test coverage
- **F-CB-I1** Medium/REAL_DEFECT — CLOSED — Specialization chips on SkillRoleStrip bypassed the capstone-node contract (free spec unlock, mutex + realm gate defeated)
- **F-CB-I2** Low/REAL_DEFECT — CLOSED — An-kit composite casts and queued repeat/multicast executions dropped the picked element's presetId
- **F-CB-I3** Nit/REAL_DEFECT — CLOSED — resolveMaxThe used purchase-gate isNodeElementActive instead of aggregation-gate isNodeElementEffective
- **F-CB-I4** Nit/REAL_DEFECT — CLOSED — rewardOnly maxLevel:2 upper level unreachable for spell_pathway (dead level range on the_thuc_tinh)
- **F-PT-D1** Medium/DOCUMENTATION_DEFECT — CLOSED — P15 violation: Vietnamese text + em dashes in .ts doc comments introduced by delta fixes
- **F-PT-D2** Low/NON_ACTIONABLE — REJECTED_WITH_PROOF — chain-skill variant specs would free-switch (unclaimed spec toggles unlocked)
- **F-PT-D3** Nit/COVERAGE_GAP — CLOSED — presetId emit lane lacked a pin (resolvedSkill-first fallback untested)
- **F-PT-M1** Medium/COVERAGE_GAP — CLOSED — mutation sweep: grant mirror-write mutant survived - missing detector on purchasedNodeIds
- **F-AUT-01** Medium/REAL_DEFECT — CLOSED — grantedNodeLevels unvalidated side-write: any record key wrote free gated power or corrupt save mirror
- **F-AUT-02** Medium/REAL_DEFECT — CLOSED — element->basic skill id truth declared three times: SPELL_KIT_IDS map + two literal re-declarations
- **F-AUT-03** Low/REAL_DEFECT — CLOSED — the_thuc_tinh aggregated by hidden way despite owning no The pool
- **F-AUT-04** Low/REAL_DEFECT — CLOSED — rewardOnly exemption lived in caller target sets, not the shared removal seam
- **F-AUT-05** Low/REAL_DEFECT — CLOSED — specializationClaimingNode first-match only; no uniqueness validator
- **F-AUT-06** Low/NON_ACTIONABLE — REJECTED_WITH_PROOF — no catch-up path for realm-reward grants missed by late way selection
- **F-AUT-07** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — skill-scope convention disclosure: turnSkillResourceModifiers lists each basic id rather than family wildcard
- **F-COR-A1** Low/REAL_DEFECT — CLOSED — grantedNodeLevels trust is data-only: no engine clamp on grant targets or level
- **F-COR-A2** Nit/REAL_DEFECT — CLOSED — specializationClaimingNode first-match + clawback spec leg lacks dual-source guard
- **F-COR-A3** Nit/REAL_DEFECT — CLOSED — the_thuc_tinh carries no requiredWay - hidden-way seal only in grant record
- **F-COR-A4** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — brief said ~10-11 nodes/element, shipped 5-7 basic-lane
- **F-INT-A1** Low/REAL_DEFECT — CLOSED — devResetBranch revoked rewardOnly grant nodes - exemption missing at the seam
- **F-INT-A2** Low/REAL_DEFECT — CLOSED — chooseCultivationPath bypassed grantCultivationPathRealmReward for qi_refining entry
- **F-INT-A3** Low/NON_ACTIONABLE — REJECTED_WITH_PROOF — no grant backfill/claim re-validation for pre-existing saves
- **F-INT-A4** Nit/REAL_DEFECT — CLOSED — locked spec-chip tooltip implies obtainable node even when mutex-excluded forever
- **F-B2-C1** Low/REAL_DEFECT — CLOSED — the_thuc_tinh description overclaims: The already charges +5/cast from Luyen Khi
- **F-B2-C2** Low/REAL_DEFECT — CLOSED — clawback dual-source guards read purchasedNodeIds mirror, not nodeLevels authority
- **F-B2-C3** Low/REAL_DEFECT — CLOSED — switchRoute routeTag cleanup bypasses the rewardOnly refusal seam
- **F-B2-C4** Low/REAL_DEFECT — CLOSED — tho_cung_gioi finalDamagePercent under-discloses scope
- **F-B2-C5** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — no catch-up grant for saves already at foundation_establishment
- **F-B2-C6** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — pre-existing: non-core nodeLevels entries not range-validated at load
- **F-B2-A1** Medium/REAL_DEFECT — CLOSED — registry<->catalog parity held by convention; dedupe stopped at the runtime seam
- **F-B2-A2** Low/NON_ACTIONABLE — REJECTED_WITH_PROOF — spec clawback dual-source guard reads purchasedNodeIds mirror
- **F-B2-A3** Low/REAL_DEFECT — CLOSED — realm-grant validator accepts any rewardOnly node incl. core_-prefixed / transactional hybrids
- **F-B2-A4** Low/REAL_DEFECT — CLOSED — specializationClaimingNode .find vs clawback .some asymmetry; uniqueness pin covered PHAP_TU_NODES only
- **F-B2-A5** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — saveShapeValidation retains redundant SKILL_CORE_BY_ID map + stray blank lines
- **F-B2-A6** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — new Vietnamese/non-ASCII comments vs P15 style
- **F-B2-I1** Low/REAL_DEFECT — CLOSED — devResetBranch lacks the out-of-combat gate its revocation siblings carry
- **F-B2-I2** Low/REAL_DEFECT — CLOSED — switchRoute revokes routeTag nodes inline, bypassing revokeNodeOwnership guard chain
- **F-B2-I3** Nit/REAL_DEFECT — CLOSED — spec-lock tooltip overclaims permanence while free respec re-opens the claim
- **F-B2-I4** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — clawback guards read mirror; realm grants never write it
- **F-B5-A1** Medium/REAL_DEFECT — CLOSED — hardcoded Vietnamese spec-tooltip strings bypass i18n
- **F-B5-A2** Low/REAL_DEFECT — CLOSED — grant validator skips only core_ ids - grantsSkillCoreIds passes silently and bricks next save load
- **F-B5-A3** Low/REAL_DEFECT — CLOSED — tho_cung_gioi finalDamagePercent exceeds declared four-key lane contract
- **F-B5-A4** Nit/REAL_DEFECT — CLOSED — stale docblock claims no requiredWay while awakeningNode sets spell_pathway
- **F-B5-A5** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — comments transliterated to ASCII-Vietnamese rather than English
- **F-B5-A6** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — pre-existing core/player data/ imports at merge-base
- **F-B5-C1** Medium/REAL_DEFECT — CLOSED — tinh_thong_thuy / tinh_thong_tho aggregate +12% at L2 exceeding the +10% per-node bound
- **F-B5-C2** Low/NON_ACTIONABLE — REJECTED_WITH_PROOF — same-direction stacking reaches +20-22% if +10%/direction is a per-direction-total cap (contract ambiguity)
- **F-B5-C3** Low/REAL_DEFECT — CLOSED — tho_cung_gioi uses finalDamagePercent - buffs every attack, not the skill (scope contract)
- **F-B5-C4** Low/NON_ACTIONABLE — REJECTED_WITH_PROOF — basic lane authors 5-7 nodes per element vs scope estimate '~10-11'
- **F-B5-C5** Low/REAL_DEFECT — CLOSED — precursors and direct An-kit casts resolve to generic arcane_impact preset
- **F-B5-C6** Nit/REAL_DEFECT — CLOSED — spec-lock tooltip strings hardcoded Vietnamese, bypassing i18n (DUPLICATE of F-B5-A1)
- **F-B5-C7** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — devResetBranch cannot target the Phap Tu lane (no branchTag)
- **F-B5-C8** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — owned maxLevel-1 nodes (10 capstones) render disabled upgrade button instead of maxed state
- **F-B5-C9** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — previewNodeRespec under-reports clawback; preserveIds lives at caller layer
- **F-COR6-1** Low/REAL_DEFECT — CLOSED — saveShapeValidation bounds-checks only core_ nodeLevels; registered non-core grant nodes accept arbitrary crafted levels
- **F-COR6-2** Nit/REAL_DEFECT — CLOSED — TurnSkillDisplayMeta fallback name for thuy_tien_thuat mismatches authored name ('Thủy Tiên' vs 'Thủy Tiễn')
- **F-COR6-3** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — crafted-save-only edge: selected spec chip can render selected-but-disabled
- **F-COR7-1** Medium/REAL_DEFECT — REJECTED_WITH_PROOF — Mid-save retroactive-grant gap - M5 unreachable for spell players already at Truc Co+
- **F-COR7-2** Low/REAL_DEFECT — CLOSED — Capstone spread-spec descriptions hide ailment-chance + damage downgrades (water/metal/wood)
- **F-COR7-3** Low/NON_ACTIONABLE — REJECTED_WITH_PROOF — Same-direction stat totals stack past +10% across sibling nodes
- **F-COR7-4** Low/SPEC_DEFECT — CLOSED — Basic-lane node count below the stated ~10-11 per element
- **F-COR7-5** Nit/DOCUMENTATION_DEFECT — CLOSED — Stale header comment - finalDamagePercent 'reserved for the earth capstone' unused
- **F-PT-A8-1** Low/DOCUMENTATION_DEFECT — CLOSED — Node descriptions name one skill/ailment but stat fields are global channels
- **F-PT-A8-2** Nit/DOCUMENTATION_DEFECT — CLOSED — Two Truc Co outer nodes missing '(tang Truc Co)' tier marker
- **F-PT-A8-3** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — Ownership predicate asymmetry: clawback uses ownedNodeIds union, spec-claim guards use getNodeLevel only
- **F-PT-A8-4** Low/DOCUMENTATION_DEFECT — CLOSED — StatLabels tooltip claims elementApplicationPercent is flat-add; engine multiplies
- **F-PT-A8-5** Low/REAL_DEFECT — CLOSED — No load-time backfill for realm-entry node grants on pre-diff v84 saves
- **F-PT-A8-6** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — Stale specialization selections pre-dating the claim gate persist across load

## Coverage

- cells: 10 total; STALE=10

## Chronology


## Convergence

- OK C1-identity: all final evidence binds the declared state
- UNMET C2-census-coverage: coverage COV-I-PT-REWARD-SEAL-STATIC_SEMANTIC=STALE; coverage COV-I-PT-REWARD-SEAL-INDEPENDENT_REVIEW=STALE; coverage COV-I-PT-GRANT-MAXWRITE-STATIC_SEMANTIC=STALE; coverage COV-I-PT-GRANT-MAXWRITE-INDEPENDENT_REVIEW=STALE; coverage COV-I-PT-SKILL-SCOPE-STATIC_SEMANTIC=STALE; coverage COV-I-PT-SKILL-SCOPE-INDEPENDENT_REVIEW=STALE; coverage COV-I-PT-REALM-GATE-STATIC_SEMANTIC=STALE; coverage COV-I-PT-REALM-GATE-INDEPENDENT_REVIEW=STALE; coverage COV-I-PT-PRESENT-TRUTH-STATIC_SEMANTIC=STALE; coverage COV-I-PT-PRESENT-TRUTH-INDEPENDENT_REVIEW=STALE
- OK C3-no-open: none open
- UNMET C4-final-gates: no final evidence recorded
- UNMET C5-sequential: sequential CORRECTNESS→AUTHORITY→INTEGRATION reviews missing
- UNMET C6-clean-pair: Clean A missing/not CLEAN; Clean B missing/not CLEAN
- OK C7-mutation-corpus: mutation + corpus satisfied
- OK C8-terminal-check: independent terminal verifier sealed
- OK C9-readiness: brief(s) lack finalConformance evidence: 
