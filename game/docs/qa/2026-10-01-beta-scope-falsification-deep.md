# 2026-10-01 — Beta scope falsification sweep (deep, blind independent review)

Scope: terminal falsification sweep of the beta scope lock on
`.agent-worktrees/qa-fixpoint-master` @ 5431ae7e (`devin/qa-fixpoint`).
Mode: read-only review, no production edits; three scratch QA tests added
under the QA allowlist (`src/**/*.test.ts`), all deterministic, all
passing against current code.

Verdict: **FAIL WITH REASON — 3 confirmed findings (1 High, 2 Medium),
4 deferred Nits.**

A defect per the contract: dormancy leaking into visible play, visible
scope broken, or a carried/flagged save's dormant records having live
effect on beta play.

---

## Confirmed findings

### F-BS1 (High) — Persisted enhanced hidden-breakthrough realm passives emit on flagged saves

`grantRealmPassive` (`src/core/realm/RealmPassiveSystem.ts`) picks
`buildEnhancedModifiers` when `wasHiddenBreakthrough` — the beta lock
correctly gates that check at **write** time. But the grant is
write-once/persist-forever: the emitted `StatModifier[]` lands in
`player.modifiers`, is serialized into the save, and is re-read verbatim
by `resolvePlayerStatAssembly` (`src/core/player/Player.ts:520`,
`...player.modifiers`). No restore path re-derives realm-sourced
modifier entries — `syncRealmPassive` never runs on restore,
`applyAllBodyModifiers` only rebuilds body-prefixed slices, and the
marker↔payload validation only checks that a granted marker has *some*
live modifier, not that the modifier matches the non-enhanced
definition.

A real pre-beta save that committed a hidden breakthrough at
`foundation_establishment` therefore carries
`realm-passive:kien_co:<mainStat>` at +0.20 (the NON-CANONICAL
`KIEN_CO_ENHANCED_MAIN_STAT_PERCENT`) instead of the normal 0–0.20
tiered by `highestFoundationAchieved`; `nhap_dao` enhanced is +0.30
flat. On beta load the same save is flagged
`'hidden_progression_state'` by `unsupportedReleaseReason` — and still
plays with the hidden-content stat bonus live.

- Repro: `src/core/realm/enhancedPassivePersisted.qa.test.ts` — builds
  the acceptance-coherent record (`assertHiddenPerfectionIntegrity`
  passes), proves the flag fires, proves `wasHiddenBreakthrough` is
  gated false for new writes, and proves the persisted enhanced
  modifiers still emit in `resolvePlayerStatAssembly`. **Passes** (the
  leak exists).
- Expected: flagged save's dormant records have no live effect.
- Actual: hidden-breakthrough-derived stat bonuses emit on beta play.
- Root class: grant-time gate with no persisted-payload reconciliation;
  the gate protects future writes, not already-written records.

### F-BS2 (Medium) — `devResetBranch` refunds dormant-tree nodes into live `skillInsight`

`GameManagerProgressionOps.devResetBranch`
(`src/core/game/GameManagerProgressionOps.ts:700`) calls
`devResetBranchSystem` (`src/core/progression/NodeSystem.ts:595`), which
filters the registry by `branchTag` and refunds every owned node via
`computeNodeRefund` — **no `betaNodeWriteAdmitted` check and no
`holdsDormant` refusal**, unlike `respecNodeTree` and
`previewNodeRespec` (line 728), which explicitly refuse saves holding
dormant-tree records. On a flagged `way_out_of_scope` save whose
`nodeLevels` carry kiem_pho/the_tu/the_tu_an/ngo_kiem entries,
`devResetBranch('kiem_pho')` clears the dormant levels and mints live
`skillInsight` — spendable beta currency converted from dormant
records. Bundled into prod `useProgressionActions.ts:49` (no .vue
binding; dev-console reachable on live Pinia state).

- Repro: `src/core/progression/devResetBranch.admission.qa.test.ts` —
  locks ways+features, seeds a registered dormant `thich_can` node
  level + `purchasedNodeIds`, proves `betaNodeWriteAdmitted` is false
  for the node, then proves `devResetBranch('kiem_pho')` clears the
  level and pays `skillInsight > 0`. **Passes** (the seam exists).
- Expected: refund paths refuse or skip dormant records (the project's
  own respec surfaces do).
- Actual: dev seam pays refund from dormant records; inconsistent with
  the sibling gate.
- Reachability note: console/devtools only today — that is why this is
  Medium, not High. It is a prod-bundled write path callable on live
  state, not a test-only export.

### F-BS3 (Medium) — Forged `player.modifiers` entries validate and mint stats

`validateStatModifierEntries` is shape-only, and the
`grantedRealmPassiveIds` coherence check
(`src/services/save/saveShapeValidation.ts:498-529`) is one-directional:
marker → live payload exists. The reverse is unchecked — a
`player.modifiers` entry of `sourceType:'realm'` needs no marker, no
catalog match, and no percent bound. A hostile save carrying
`{sourceId:'nhap_dao', stat:'strength', percent:9}` passes
`validateGameSaveShape` and emits +900% strength through the verbatim
`resolvePlayerStatAssembly` read. This is the same channel as F-BS1:
every sibling slice (nodeLevels, talentLevels, hiddenPerfection,
granted markers) got strict catalog/ownership validation;
`player.modifiers` stayed shape-only.

- Repro: `src/services/save/forgedModifierMints.qa.test.ts` — forged
  realm modifier with no marker validates ok and emits. **Passes** (the
  gap exists).
- Expected: the acceptance layer fails loud on ungranted passive
  payload, matching its own orphan-marker and unowned-talent policy.
- Actual: silent mint. Tamper-class (requires crafted save bytes), but
  hostile save shapes are an in-scope attack class and the repo's own
  doctrine is "latent corruption fails loud."

---

## Deferred Nits (deterministic, defensible or inert)

1. `TribulationOutcomeService` deletes `talentLevels['pham_cot']` on
   victory — a dormant record mutated on a live path. Inert: pham_cot
   is excluded from `BETA_TALENT_ROSTER`; arguably intended cleanup.
2. `selectSpecialization` free-switch can write spec claims on a
   carried learned dormant skill — inert: the skill's combat surfaces
   are gated, claims never emit.
3. `buildBuilding`/`upgradeBuilding` are ungated for scope-hidden
   chi_hien_quan via console — dead sink: worker capacity is masked to
   the flat beta pool while `manualWorkforce` is hidden.
4. `save.formations` slice is persisted but never read on restore —
   dead slice, no effect.

---

## Coverage — dead ends verified clean (high-value)

- **Admission funnels**: `purchaseNode`/`upgradeNode`/`canUpgrade`/
  `learnSkill`/`levelUpSkill` gate on `betaNodeWriteAdmitted`/
  `betaSkillAdmitted`; `respecNodeTree` + `previewNodeRespec` refuse
  dormant-holding saves; `admittedNodeModifiers` is the sole
  `aggregateNodeStatModifiers` caller and filters registry-admitted
  nodes only; `reconcileWayGrants` + realm-reward passive replay +
  element rewards all `isBetaWay`-gated; `grantSkillCoreBySkillId`
  callers sit inside `isBetaWay` blocks; technique facets via
  `betaTechniqueAdmitted`; talent effects funnel through
  `isBetaTalentId` (creation roster + all breakthrough pools; pool-only
  upgradeables).
- **Way cross-application**: phap_tu nodes are `requiredWay:
  'spell_pathway'`-stamped — a carried hidden_spell save's phap_tu
  nodeLevels cannot emit (`nodeWayApplies` fails).
- **Combat build**: companion/formation/reaction_aura legs gated by
  `isScopeHidden`/`wayAdmitted`; artifact XP+grant legs realm-gated;
  sword-dynamic-basic via `isBetaFeature('swordPath')`.
- **Spawn/autoFarm**: `pickEnemyForSpawn` draws only the stage pool;
  hidden-beast substitution requires a stage-declared spawnable id
  (beta stages declare none); 30-stage roster + 12-enemy roster pinned
  by `BetaStageRoster.test`; autoFarm resolve needs perfect-clear +
  valid cycle + registered template.
- **Economy**: `tests/architecture` suite green (67 files / 405 tests)
  including `betaEconomyCensus`, `EnemyDropSinkInvariant`,
  `HiddenMaterialChannels`; exemption table reviewed (lore /
  store_of_value / base_currency — defensible). Decompose ops +
  offline settle `isScopeHidden('equipmentOreDecompose')`-gated;
  `pendingOutput` not persisted. Alchemy `startJob` rejects
  null-family recipes; slot budget counts beta-family jobs only. Pill
  consume rejects `scopeHiddenPillFamilyOfId` → `'scope_hidden'` (i18n
  parity en+vi).
- **Quests**: `getActiveQuests`/`resolveClaimable` filter
  `isBetaQuestEnabled`; reconcile drops stale by `isUnlocked` — dormant
  progress uncollectible.
- **Save acceptance**: unknown equipment/affix/material/pill/building/
  site refs hard-fail; technique holder contract (exactly one =
  `activeWay.techniqueId`); grade/rank/mastery/quality canonicality;
  element-kit + hidden-kit coherence; mortal-boundary contract;
  `assertHiddenPerfectionIntegrity` enforces strict-prefix completed
  lists, two-view bodyCompleted coherence, and departing-body
  requirements for `hiddenBreakthroughRealmIds`.
- **Throwing registries**: `NodeRegistry.get` throws; every prod call
  site is `has()`-guarded (ProgressionOps lines 225/239/333/352/385/
  451/472/479/564/568/608/628/632/654/658/670/674/688 + respec preview
  comment documents the policy).
- **Lock state**: `BETA_PLAYABLE_WAYS`/`BETA_FEATURES`/
  `BETA_TALENT_ROSTER`/`BETA_ECONOMY_EXEMPTIONS` deliberately mutable
  for test fixtures; no prod mutation call sites — console mutability
  is accepted design risk. `__fixtures__` imported only by tests +
  `tests/lab/harness.ts`; global setup unlocks, lock suites re-pin.
- **Sequential consistency**: restore order is deterministic
  (realm rewards → spec claims → way grants → quest lifecycle);
  replay is grant-only/`Math.max`-idempotent; `lastAppliedPayloadHash`
  commits only after all slices; decompose capacity re-supplied
  pre-restore; `tribulationDirector.restoreRuntime` is
  clear-then-load replacement; committed outcomes settle within the
  flagged save's own progression.
- **Hidden domain**: `canProgressHiddenBody`/
  `isHiddenBreakthroughEligible`/`wasHiddenBreakthrough` fail-closed on
  `isBetaFeature('hiddenContent')`; `NghichChuTian` eligibility/reveal/
  attempt route through the same gates; `closeHiddenLineage`/
  `recordHiddenBreakthrough` write on normal breakthroughs
  (deliberate record semantics).
- **i18n**: `pills.reason.scope_hidden`,
  `save.betaUnsupported.{6 keys}`, `betaComplete.{title,body,continue}`
  present in both en.json and vi.json.
- **UI seams**: command wheel / building icons / standalone panels /
  left panel / worker-lodge tabs / skill-role strip / talent modal all
  resolve through `featureAdmits`-style fail-closed verdicts.
- **Tribulation talent modifiers**: `applyLoiKiepVictoryBonus` pushes
  `sourceType:'talent'` modifiers — loi_kiep is a beta talent;
  non-beta talents never reach the funnel.

## Access limitations

- The prompt stated the review worktree existed; it did not — created
  `.agent-worktrees/qa-fixpoint-master` @ 5431ae7e + symlinked
  `game/node_modules` from the main checkout.
- No live pre-beta save files were available: carried-save classes are
  proven by constructing the acceptance-coherent player record and
  running the real stat/flag/acceptance functions on it (unit-level
  pipeline), not by an end-to-end `GameManager.restore()` on a saved
  blob. F-BS1's hidden record was verified against
  `assertHiddenPerfectionIntegrity` itself.

## Repro assets (QA allowlist writes, passing)

- `src/core/realm/enhancedPassivePersisted.qa.test.ts` — F-BS1.
- `src/core/progression/devResetBranch.admission.qa.test.ts` — F-BS2.
- `src/services/save/forgedModifierMints.qa.test.ts` — F-BS3.
