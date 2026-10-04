# Clean Round A — scope authority seam (blind adversarial review)

- Scope: `devin/qa-fixpoint` tip `5431ae7e`, reviewed verbatim. Tests/docs only — no production edits.
- Lens: authority-seam defects at the beta scope-lock boundary — carried saves holding dormant-scope records, or code paths reaching dormant systems, producing LIVE effects/writes in beta scope.
- Repro suite: `game/tests/architecture/betaScopeAuthoritySeam.qa.test.ts` (9 tests: 7 FAIL = confirmed defect, 2 control PASS).
- Prior coverage honored: `tests/architecture/betaDormantSaveLeak.qa.test.ts` already pins stat caps, realm passives, dormant pills/ways/trees, role verdicts, spec claims, respec/preview refusal, worker capacity, alchemy slot isolation, realm-reward/way-grant reconcile — not re-litigated here.

## Verdict: FINDINGS — 4 confirmed defect roots (7 failing tests)

### AS-1 `devResetBranch` refunds and revokes dormant-tree nodes (High)

- `GameManagerProgressionOps.devResetBranch` (`src/core/game/GameManagerProgressionOps.ts` ~line 700) checks only `isTurnBattleInProgress()` before calling `devResetBranchSystem` + `applyOneShotClawback`. No scope/dormancy admission — unlike its sibling `respecNodeTree`/`previewNodeRespec`, which refuse the whole op when any registered-dormant `nodeLevels` id exists ("the lock freezes them, never monetizes").
- `branchTag` exists ONLY on dormant-tree nodes (`kiem_pho`, `ngu_kiem`, `the_tu`, `the_tu_an`) — every reachable target of this op is a dormant record.
- Repro: sword save `nodeLevels {thich_can:2}` → `devResetBranch('kiem_pho')` returns `2` (refund+clawback), revokes the nodes and mints `skillInsight`. Body save `{cuong_chien:1}` → `devResetBranch('the_tu')` runs ungated (returns 0, records still processed).
- Root class: missing scope guard on a write seam parallel to the gated respec.

### AS-2 `BETA_TALENT_IDS` admits authored-dormant golden_core talents (High)

- `BETA_TALENT_IDS` seeds from `BETA_CREATION_TALENT_IDS` + ALL `BREAKTHROUGH_TALENT_POOLS` members — including the `golden_core` pool authored-dormant per its own comment ("Never re-enable by editing weights — the policy gate is the only switch"). Acquisition is correctly suppressed by `isBreakthroughAcquisitionEnabled('golden_core')`, so no beta save can legitimately own `kd_thanh_dan`/`kd_linh_dan` — yet `isBetaTalentId` admits them.
- `collectTalentEffects` is roster-gated, so a carried save's `selectedTalentIds: [kd_thanh_dan, kd_linh_dan]` emits LIVE `[{cultivation_speed +0.2}, {insight_gain +0.5}]` (×2 at level 2) — dormancy leaking into visible play. `unsupportedReleaseReason` has no talent check, so the hostile save also reads fully in-scope.
- Repro: `isBetaTalentId('kd_thanh_dan')` → `true`; `collectTalentEffects([kd_*])` → live effect list (fails both assertions).
- Root class: roster over-admission — the admission predicate admits ids whose only acquisition channel is suppressed.

### AS-3 `chi_hien_quan` build/upgrade writes bypass the scope lock (Medium)

- `GameManagerBuildingOps.canBuildBuilding`/`buildBuilding`/`upgradeBuilding` delegate to `BuildingSystem` (realm + materials + duplicate-station gates only). `BETA_BUILDING_FEATURES` maps `chi_hien_quan` → `manualWorkforce` (hidden) — but that mapping feeds the SURFACE read-model only; no consumer gates the write path. Every sibling domain seam (`equipmentWash`/`equipmentRefine` in `EquipmentSystem`, workforce in `getWorkerAssignments`/`assignWorkers`) returns `{ok:false, reason:'scope_hidden'}`.
- Repro: `canBuildBuilding('chi_hien_quan')` → `true`; `buildBuilding` mints a live instance (free tier-1 cost `[]`) and writes `player.autoWorkerCapacity = 3`. A carried L1 instance + funded `mortal_ore_decade` → `upgradeBuilding` → `true` (materials spent, level 2, capacity refreshed). Control `gathering_outpost` (identical free cost) builds — the only difference is the unmapped scope gate.
- Root class: surface-only gating; the domain write seam lacks the codebase's own `scope_hidden` refusal pattern.

### AS-4 `gainMastery` trains dormant-way techniques on carried saves (Medium)

- `TechniqueSystem.gainMastery` (`src/core/technique/TechniqueSystem.ts` line 90) has no scope check — it mutates whatever `techniqueManager.getActive()` returns. `BattleLootSystem.settleTechniqueMastery` reaches it from every kill settle (victory + autofarm channels) with only a realm-context arg.
- Repro: carried sword save at `qi_refining` L12 with `sword_control_art` (grade 1, in-band) → `gainMastery(10_000, ...)` → `{gained:2400, rankUps:8}` — dormant record ranks 4→12 LIVE, and `publishProgress` mirrors `player.techniqueProgress`, which feeds `techniqueRank` prerequisites on beta unlock nodes (authored invariant: "every unlock node carries techniqueRank 5"). Control `five_elements_art` on a beta save trains normally.
- Root class: the technique progression write channel never learned the scope lock — the gated siblings are emitters (`getTechniqueTierModifiers`/`getTechniqueCombatModifiers` via `betaTechniqueAdmitted`) and `tryAdvanceTechniqueGrade`; the accrual path was missed.

## Novel attacks tried — came back CLEAN

- Hidden beast trial eligibility: `isAncientBeastTrialEligible` → `canProgressHiddenBody` → `isBetaFeature('hiddenContent')` root gate (HiddenLineage.ts:136) — closed.
- Hidden spawn substitution: `HiddenBeastSystem.maybeReplaceSpawn` gated `isBetaFeature('hiddenContent')`; `onEnemyDefeated` gated `isScopeHidden`; `stageSpawnableEnemyIds` funnel intact; no post-ceiling stage content exists.
- Talent entitlement lifecycle: `drawBreakthroughTalentOffers`/`createTalentEntitlement`/`isTalentEntitlementActionable`/`resolveTalentEntitlement` NEW all gate `isBreakthroughAcquisitionEnabled`; stale entitlements reconcile clear (never hold the modal).
- Realm-entry/way-grant replay seams: `applySwordPathRealmTransition` (isScopeHidden swordPath), `reconcileCultivationPathRealmRewards` (isBetaWay), `reconcileWayGrants` (way-gated) — inert on dormant saves.
- Stat/effect channels: `admittedNodeModifiers` (`betaNodeWriteAdmitted`), technique tier/combat emitters (`betaTechniqueAdmitted`), `SkillSystem.getScaledPassiveModifiers` (`betaSkillAdmitted`), way facet emitters (active-way admission) — all gated. Persisted `player.modifiers` emit unconditionally — consistent with the documented single-check invariant (owned records preserved, never re-stripped); not counted a defect.
- Spec claims: `selectSkillSpecialization` refuses when every claimant is dormant; `reconcileSpecClaims` only preserves owned claims — no dormant-tree claimant of a beta skill exists in data.
- Worker capacity: `betaEffectiveWorkerCapacity` clamps to `BETA_BASELINE_WORKER_CAPACITY=3` while hidden; assignments/view APIs all `isScopeHidden('manualWorkforce')`-gated.
- Alchemy: dormant-family job slots isolated (`betaRecipeFamilyOfId`), consumption gated `scope_hidden` at `usePillDetailed`; pill catalog is fully family-grammar (`${family.id}_${realmId}` + 2 material-type specials) so no dormant pill escapes the family parse.
- Artifact/companion battle channels: `feedArtifactExp` gated `isArtifactDomainUnlocked` (→ `isBetaFeature('artifact')`); companion EXP gated `isScopeHidden('companion')` (BattleLootSystem.ts:382,724).
- `setKiemPhoPreset` gated `isScopeHidden('swordPath')`; `grantSkillCoreBySkillId` callers preflight inside beta commit blocks; `chooseCultivationPath` fails closed pre-preflight.
- `saveAcceptance.assertSaveAcceptable` validates registry-reference integrity, not scope — by design ("deserialize safely, flag explicitly"); `unsupportedReleaseReason` never throws on hostile shapes (but see AS-2 gap).
- `player_bag` persisted modifiers / `skillCastCounts` mirror / ghost `nodeLevels` respec — covered or inert per pinned contracts.

## Access/tooling limitations

- `npm run type-check` has a PRE-EXISTING failure at tip: `electron/main.ts` imports `electron-updater`, which is not a declared dependency — unrelated to this review; the QA file itself adds zero type errors.
- No runtime/browser verification performed (headless scope-authority review only; vitest evidence is deterministic).
- `devResetBranch` is currently dev-console-only per its own comment — AS-1 severity reflects reachable-code risk, not a live UI path today.
