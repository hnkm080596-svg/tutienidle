# Mission G — Dead Code & Type Hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete confirmed dead code and legacy bridges (dev-stage rule: nothing to preserve), close the `as never`/`any` contract gaps, remove unreachable UI/state, and collapse the duplicated rules onto their single owners — without redesigning gameplay and without disturbing the parked artifact-combat runtime.

**Architecture:** The M13 dormant cluster is deleted in stages — `CombatSystem`'s trigger path first (it is the last production consumer), then the three legacy skill-execution modules, then the mixed battle modules are slimmed to their live contracts. Legacy save/stat bridges are deleted outright: restore and validation reject or drop legacy keys instead of remapping them. Cast sites get real types. Dedup collapses copies onto the authoritative owner.

**Tech Stack:** TypeScript, Vitest, Vue 3, Pinia, Phaser.

**Spec:** `docs/specs/2026-09-16-audit-remediation-spec.md` (Mission G section + locked product decisions). Audit evidence: `docs/qa/2026-09-16-full-project-scout-audit.md` T8-69..74 (T8-75 is owned by Mission E Task 16 — see Task 18), T3-20, T5-47/50, plus the type-audit findings.

## Global Constraints

- **Dev-stage rule:** no live players — delete old-save migrations, version-compat shims, and legacy↔new bridge code. Never write migrations; never preserve a rename/translate path. Restore/validation must *reject or drop* legacy keys, not translate them.
- **Parked exception:** artifact combat *runtime* files stay parked for the future reimagine — `src/core/artifact/ArtifactSystem.ts`, `ArtifactRuntime.ts` (incl. `createArtifactRuntime`), `src/core/battle/Battle.ts` (the `Battle`/`BattleEnemy` contract they consume), and the helpers parked code still calls (`selectRankedTarget`, `getArtifactCycleSeconds`, the `scheduleBasic` impact port). Only combat-effect *advertising* (HUD slot + milestone tooltips) is removed in this mission.
- **No gameplay redesign.** Deletions are limited to symbols proven unreachable by fresh grep at execution time. Live artifact *progression* (`ArtifactProgression.ts`, `ArtifactPanel.vue`, grade/path/EXP UI, `doan_bao_thach` drops via `StageDropTables`) stays untouched.
- **P8:** no `any`; replacing `as never`/`any` with real types is the point — do not introduce new casts to fix old ones. Narrow `unknown` with guards where needed.
- **P15:** comments in `.ts`/`.vue` files are English ASCII only (existing Vietnamese comments in files being edited may be left or minimally corrected — do not mass-translate).
- **P16:** any *new* user-facing string goes through `t()` i18n keys.
- **Fresh-grep rule:** the audit ran days ago and the tree has drifted (see Corrections below). Re-run every import/reference grep before each deletion; if a "dead" symbol turns out live, skip the deletion and record the finding instead of forcing it.

## Cross-mission drift surface (G runs LAST — these regions are reshaped by B–F first)

Every listed line ref was verified pre-mission; at execution time re-locate by symbol, not line. Same-function collisions:

| G task | Sister mission touching the same region |
|--------|------------------------------------------|
| Task 1 (`CombatSystem` ctor) | C8 may add `setRandomSource(rng)` or a ctor param — the "sole remaining constructor shape" claim must be re-verified post-C |
| Task 9 (`BASIC_ATTACKS_BY_BUILD` consumer) | C9 moves `GameManager` resolvers (`resolvePlayerBasicAttack`, `GameManager.ts:977`) into `CultivationPathRuntime` factories — re-locate the consumer |
| Tasks 8/22/34 (`player.ts` restore block) | E5 rewrites `player.ts:335,:438-479`; Task 34's offline loop at `:452-466` sits inside that region |
| Task 10 (`GameManagerPillOps.usePillDetailed`) | E2 rewrites `:33-116` — the retired check verified at `:49-53` is inside |
| Task 20 (`OverlayLayers`, `overlayLayers.test.ts`) | E8 modifies `OverlayLayers.ts:31-33` and the arch test — re-locate the `mainMenu` entries |
| Tasks 20/40 (`App.vue`) | E5 edits `onRestoreOk` (~:559), B2 edits `onCharacterCreated` (~:647), F8/F11 edit `onAuthenticated` :638 + lifecycle deps :346-405 |
| Task 36 (`GameManagerBuildingOps`) | D adds `getWorkforceView` + `decomposeSystem` dep to the same class |
| Task 8 | D edits `GameManagerSaveRestore.ts:417-421` |
| Task 13 | D edits `GameManagerTickOps.ts:150-168` |
| Task 32 | D adds `resolveTerritoryTier` to `ProductionCatalog.ts` |
| Tasks 6/23/29 | E1 edits `BattleLootSystem.ts:371,:393` |
| Task 32 (`AlchemyView.vue`) | E9 edits `:200-218,:302` |
| Tasks 24/37 (`useEquipmentTooltip.ts`) | E12 edits `:207` |
| Task 21 (`package.json`, `vite.config.ts`) | F6 pins Vue + adds `cross-env`; F4 rewrites the server block |
| Task 3 aftermath | `elementApplicationPercent` becomes fully consumer-less once `SkillEffectSystem`/`SkillActionRegistry` are deleted — its turn-engine replacement (`AilmentChance`/`resolveAilmentApplicationChance`) is Mission C Task 10's scope and may not exist yet. No regression vs. today (already unconsumed live); producers (`PhapTuNodes.builders.ts:258`, `StatTypes.ts`, `StatLabels.ts`) stay. Record so QA doesn't flag it as a new defect. |
- **Worktree:** this plan executes inside `.agent-worktrees/cleanup` on branch `chore/cleanup` (P2 multi-file rule).
- **Verification (P3):** `quick` = `npm run type-check` + `npx vitest run <task scope>` per task. Task 22 (vue-router removal) touches `package.json` + `main.ts` and therefore uses `full` = `npm run type-check` + `npm run build` + `npx vitest run`. Mission-level gates: adversarial-QA quick on the diff (P4), P5 three-lens review round before completion.

## Corrections from fresh verification (audit claims that are stale or wrong)

Re-verify at execution time, but these were confirmed against the current tree:

1. **`TurnBasicAttacks.ts` `the_tu` key is already gone.** `BASIC_ATTACKS_BY_BUILD` currently holds only `kiem_tu` and `pham_nhan`. `pham_nhan` *is* still dead — `CultivationPathId = 'kiem_tu' | 'phap_tu' | 'the_tu'` (`CultivationPathKit.ts:44`), so `BASIC_ATTACKS_BY_BUILD[player.cultivationPath]` (`GameManager.ts:977`) can never index `pham_nhan`; its value is `GENERIC_PHYSICAL_BASIC`, identical to the existing fallthrough. Deleting it is behavior-identical.
2. **Realm "legacy formula" claims were half-stale.** No realm in `src/data/realms/realm.ts` carries `baseRequiredCultivation`/`cultivationMultiplier` at all — mortal now uses `baseCultivationMinutes: 1`. Both legacy branches (`realmSystem.ts` ~48-57, ~77-83) are fully unreachable, and the comments claiming "Phàm Nhân keeps the old absorption formula" are stale. `getCultivationDurationSeconds` has *no production callers* (test-only export + internal use).
3. **`broken_foundation_scroll`/`old_jade_slip` are intentional lore items, not producer-less dead data.** `EnemyDropSinkInvariant.test.ts:19-20` allowlists them by design; `materials.ts:104,112` comments document the "no reward, no punishment" intent. Keep them; no deletion.
4. **`body_integration` missing from `REALM_TIERS` is intentional.** `RealmTierMap.ts` maps it to tier 8 (shares Mahayana's economic tier) by documented decision. Do not "fix".
5. **`ActionImpactSystem.ts` is mixed, not dead.** `ActionDamageInfo`, `scaleActionDamage`, `HitResolveOptions` are live in the turn engine (`TurnBattleSystem`, `TurnSkillAction`, `SkillToTurnSkillConverter`, `NguKiemDaoProvider`); the class + batch API is dormant.
6. **`ActionTargetingSystem.ts` is mixed, not dead.** `areaFor` is live in `TurnSkillAction.ts:629`; `selectRankedTarget` is consumed by parked `ArtifactSystem.ts:153`. Only `isHeroGate`, `collectAffected`, `findBattleEnemy` are fully dead.
7. **`Battle.ts` is still the parked artifact contract.** `ArtifactSystem.ts` reads `battle.artifactRuntime/.enemies/.player/.playerMaterialized/.state` and its test constructs full fixtures. Trim only fields with zero references; do not delete the file.
8. **`ArtifactDropBalance.ts` is genuinely dead** — `ARTIFACT_STONE_DROP_CHANCE`/`ARTIFACT_STONE_BOSS_QUANTITY_*` have zero production consumers (only `ArtifactDropBalance.test.ts`); live `doan_bao_thach` drops flow through `StageDropTables.ts:69`. Its header comment references a `grantArtifactStoneDrop()` that no longer exists.
9. **`combatOrigin` is live.** `ui.enterCombatScene` writes it (`useBattleActions.ts:87,137`); `CombatExitConfirmModal.vue:36` and `CombatResultModal.vue:20` read it. Do not delete.
10. **`SkillTriggerRunner` is dormant but not import-free** — `CombatSystem.ts:18,111` imports + instantiates it, and `fireKillTriggers` is wired into `killIfDead`. The chain is unreachable in production because `GameManager.ts:239` constructs `new CombatSystem(this.eventBus)` with no `skillManager`/`buffRegistry`, so the guard at `CombatSystem.ts:758` always early-returns. Remove the wiring first, then the modules.
11. **`hoi_xuan_dan` retirement is already rejection-only.** `usePillDetailed` rejects `retired` pills (`GameManagerPillOps.ts:52-53`); alchemy recipes carry `retired` (`alchemyRecipes.ts:30`) and `startAlchemyJob` rejects them (pinned by `GameManager.authoredParity.test.ts:248`). The herb chain (`hoi_xuan_thao_*` materials, `daily_collect_hoi_xuan_thao` quest) is intentionally live per `PillFamilies.ts:28-32`. No conversion shim remains — this task is verification + comment truth only.
12. **`player.load()` is dead** — zero callers anywhere; `useAppLifecycle` loads via `coordinator.load()` → `LocalCloudSaveService.load()` → `loadGame()`. Only stale comments reference it.
13. **`beginTribulation` is dead on both owners** — `BattleLootSystem.beginTribulation` and `SurviveLethalGuard.beginTribulation` have only test callers; tribulation now runs through `TribulationDirector.start()` + `TurnBattleOps` (`beginBattle`/`setSession`). Tribulation's no-survive rule is enforced by `setSurviveLethalSession(null)`, not the deleted method.
14. **`DropRoll.weightedRandom([])` is NOT yet fixed** (`DropRoll.ts:43` still indexes `[length-1]!`). Mission E (E10) owns it — do not touch it here; re-check at execution time and skip if already landed.
15. **Artifact advertising surface:** the milestone tooltip descriptions in `ArtifactPathCards.vue:44` and the whole `useArtifactCombatPresentation` → `ArtifactCombatPresentation` → `ArtifactCombatSlot` → `PhapTuCombatHud` → `CombatBuildHud` chain (which always renders `EMPTY_STATE` — `useArtifactCombatPresentation.ts:20` passes `null`). `getArtifactCycleSeconds` stays (used internally by parked `ArtifactSystem.ts:155`).
16. **`ESSENCE_REALM_ORDER` diverges from `getRealmTier` only above beta scope** (`body_integration` index 8 vs tier 8 → same; `tribulation` index 9 vs tier 9→index 8 → differs; `mahayana` order differs but same effective index). All essence materials carry no `profession.realmId`, so the reachable inputs agree; unification is safe with a pinned regression test.
17. **The `isCultivating` PlayerData field is write-only** (`App.vue:468` writes it; nothing reads it — `MainScene` consumes the `cultivation_changed` *event payload*, not the field). It is persisted + shape-validated, so removal touches `Player.ts`, `App.vue`, `saveShapeValidation.ts:237`, `saveTypes.ts:102` comment, and several test fixtures.
18. **`unlockedRealmEnhancements` + `markRealmEnhancementUnlocked` are write-only end-to-end** — the action exists (`player.ts:274`) but has zero callers and nothing reads the array.
19. **The Phù/Trận socket fields are write-only end-to-end** — `EquipmentSlotState.socketedTalisman`/`socketedFormation`/`bonusAffixSlots`/`appliedTalismanIds` have no production writers; `getSlotModifiers` (`GameManagerPersistentEffectOps.ts:397-417`) aggregates fields that are always empty. The bag slices were already declared dead (`SaveSystem.ts:358,360` serialize `[]`). `SocketedModifierItem`/`TwoModifiers` stay — `Talisman`/`Formation` template types still use them.
20. **The `5` in `CharacterCreationScreen.vue:37` already has an authoritative constant** — `CHARACTER_CREATION_ATTRIBUTE_POINTS` in `src/services/character/CharacterCreationService.ts:3`.
21. **`useTribulation.resolveNextBreakthroughRealm` is safely replaceable by `getNextRealm`** — `canTriggerBreakthrough` (`GameManagerRealmAdvanceOps.ts:404-409`) returns true only for `mortal`/`qi_refining`, so the differing `foundation_establishment → golden_core` arm is unreachable through this flow.

---

## Phase 1 — M13 dormant cluster (staged deletions)

### Task 1: Remove the `CombatSystem` legacy kill-trigger path

**Why first:** `CombatSystem` is the last production importer of `SkillTriggerRunner` and `SkillEffectContext`; deleting this path unlocks Tasks 2-4.

**Files:**
- Modify: `game/src/core/combat/CombatSystem.ts` — field `:111` (`skillTriggerRunner`), constructor params `:115-116` (`skillManager?`, `buffRegistry?` + stale comments `:104-110`), `killIfDead` signature `:599-602` (drop `skillContext` param), call `this.fireKillTriggers(entity, skillContext)` `:712`, method `fireKillTriggers` `:754-784` (incl. its long comment `:716-753`), imports `:17-22` MINUS `BuffSystem` — `SkillManager` :17, `SkillTriggerRunner` :18, `SkillEffectContext` :19, `BuffRegistry` :20, `BuffPool` :22 die with the path; **`BuffSystem` (:21) stays** — it types the live `SurviveEffectsPolicy.buffSystem` field (:52) used by the survive-lethal session path (:630-656).
- Delete: `game/src/core/combat/CombatSystem.triggers.test.ts` (whole file tests the deleted path).

**Interfaces:**
- `killIfDead(entity: CombatEntity, killerId: string)` — two-arg signature preserved; death marking, `death`/`kill` event emits, and the survive-lethal session path are untouched.
- `new CombatSystem(eventBus)` — sole remaining constructor shape TODAY (matches `GameManager.ts:239` and all tests). **Post-C drift:** Mission C Task 8 may add a 4th ctor param or a `setBattleRngFactory`-style setter — at execution time the target is "the post-C constructor minus the trigger-path params," not this literal signature.

- [ ] **Step 1: Grep-verify the path is unreachable.** `grep -rn "killIfDead(" src --include="*.ts"` — confirm every production caller passes ≤2 args (`TurnReactionManager.ts:162`, internal calls at `:134,:505,:513,:591`; `SkillActionRegistry.ts:199` and `SkillEffectSystem.ts:183` are themselves deleted in later tasks). `grep -rn "new CombatSystem(" src --include="*.ts" | grep -v test` — confirm production uses only `new CombatSystem(this.eventBus)` (`GameManager.ts:239`), i.e. `skillManager`/`buffRegistry` are never provided and `fireKillTriggers` can never pass its `:758` guard.
- [ ] **Step 2: Delete the code.** Remove `fireKillTriggers`, the `skillContext` param + call, the `skillTriggerRunner` field, the two optional ctor params, and now-unused imports. Fix the stale `GameManager.beginTribulation` reference in the `killIfDead` doc comment (`:610`) while here.
- [ ] **Step 3: Delete `CombatSystem.triggers.test.ts`** and run `npx vitest run src/core/combat` — `CombatSystem.surviveLethal.test.ts`, `hitOutcomes.test.ts`, `BlockCaps.test.ts` must stay green (they construct `new CombatSystem(eventBus)` already).
- [ ] **Step 4: `npm run type-check`.**
- [ ] **Step 5: Commit** `chore(combat): remove dormant onKill trigger path from CombatSystem`

### Task 2: Delete `SkillTriggerRunner.ts`

**Files:**
- Delete: `game/src/core/skill/SkillTriggerRunner.ts`, `game/src/core/skill/SkillTriggerRunner.test.ts`

- [ ] **Step 1: Grep-verify zero remaining importers** — `grep -rn "SkillTriggerRunner" src --include="*.ts"` should return only the two files being deleted plus stale comments (`GameManager.ts`, `Skill.ts`, `SkillEffectSystem.ts` — comments only; clean the ones in files you keep).
- [ ] **Step 2: Delete both files; run `npm run type-check` + `npx vitest run src/core/skill`.**
- [ ] **Step 3: Commit** `chore(skill): delete SkillTriggerRunner legacy dispatcher`

### Task 3: Delete `SkillEffectSystem.ts` + `SkillActionRegistry.ts` (runtime path)

**Files:**
- Delete: `game/src/core/skill/SkillEffectSystem.ts`, `game/src/core/skill/SkillEffectSystem.test.ts`, `game/src/core/skill/SkillEffectSystem.thuanHe.test.ts`, `game/src/core/skill/SkillEffectParity.test.ts`, `game/src/core/skill/SkillActionRegistry.ts`, `game/src/core/skill/SkillActionRegistry.test.ts`
- Modify: `game/tests/architecture/vitalsWriteAuthority.test.ts` — remove the two allowlist entries (`SkillActionRegistry.ts` ~line 64, `SkillEffectSystem.ts` ~line 69). The guard asserts every allowlisted file still writes vitals — stale entries fail the suite once the files are gone.

**Interfaces (RETAINED — do not delete):**
- `SkillAction.ts`: `SkillAction` union, `SkillActionType`, `ActionRuntimeContext`, `SkillResourcePoolKey`, `DealDamageAction` — consumed by `Skill.ts`, `SkillSystem.ts:8`, and `SkillToTurnSkillConverter.ts` (reads `binding.actions` at `:87,:241-249`).
- `SkillTrigger.ts`: `TriggerBinding`, `TriggerContextMap`, `TriggerType` — `Skill.triggers?: TriggerBinding[]` (`Skill.ts:197`) is live via the converter.
- `SkillEffect.ts`: `SkillEffect` — consumed by `SkillToTurnSkillConverter.ts:6`, `Skill.ts:7`, `EffectiveSkill` (`SkillSystem.ts:75-77`). Only its stale `SkillEffectSystem` comment references get cleaned.
- `SkillEffectContext` (declared in `SkillEffectSystem.ts:15`) has no live consumer after Tasks 1-2 — it dies with the file.

- [ ] **Step 1: Grep-verify** — `grep -rn "SkillEffectSystem\|SkillEffectContext\|SkillActionRegistry\|runSkillAction\|SKILL_ACTION_REGISTRY" src --include="*.ts" --include="*.vue"` → after Tasks 1-2 the only hits are the files being deleted, their tests, and comments.
- [ ] **Step 2: Delete the six files.** Clean stale `SkillEffectSystem`/`SkillActionRegistry` references in retained files — the enumeration below is NOT exhaustive; **the rule is "clean every remaining hit the Step-1 grep returns"** (verified sites: `SkillTrigger.ts:10` — `SkillActionRegistry.fireNested` inside the live `TriggerBinding` doc, `SkillEffect.ts` ~7 refs, `CombatSystem.ts:197,:289`, `DamageCalculator.ts:57,:75`, `PhapTuRoutes.ts:149`, `SkillAction.ts:30`, `StatTypes.ts:75,:84`, `buffs.ts:109`, `CoreSkills.ts:336`, `PhapTuChainSkills.ts:244`, `ZoneDotBuffs.ts:23`, `GameManager.ts` comments, `SkillSystem.huyKiem.test.ts:32`, `buffs.registryConsistency.test.ts:5`).
- [ ] **Step 3: Update `vitalsWriteAuthority.test.ts`** — remove both entries from the allowlist.
- [ ] **Step 4: `npm run type-check` + `npx vitest run src/core/skill src/core/battle tests/architecture`.**
- [ ] **Step 5: Commit** `chore(skill): delete dormant SkillEffectSystem/SkillActionRegistry runtime`

### Task 4: Slim `ActionImpactSystem.ts` to its live + parked contract

**Files:**
- Modify: `game/src/core/battle/ActionImpactSystem.ts` — keep only the contract block; delete `ActionImpactSystem` class (`:173` onward: `scheduleBasic`, `tick`, `fireSkillHit`, `beginSkillBatch`, `endSkillBatch`, `batch` field), `ResolveOneHitFn` (`:103-109`, only used by `tick`), `SkillBatchMeta`, `PendingImpact`, `OpenBatch`, `instanceCounter` (`:134-171` — all die with the class), the two `as never` emits (`:196,:207` die with the class), and the now-unused imports (`:16-21` — `getCellsInArea`, `worldToGridPosition`, `CellArea`, `GridPosition`, `ActionTargetingShape`, `Battle`). In short: delete `:134-348` except the retained contract types; prune imports. Update the file header comment.
- Modify: `game/src/core/artifact/ArtifactSystem.ts:12,24` — replace the `actionImpact: ActionImpactSystem` dep type with a narrow parked port: `actionImpact: { scheduleBasic(entry: ScheduledBasicImpact): void }` (the only member parked code calls — `:183,:199,:218`).
- Modify: `game/src/core/artifact/ArtifactSystem.test.ts:59` — the `{ scheduleBasic: vi.fn() } as unknown as ActionImpactSystem` mock becomes a plain object literal (no cast needed against the port type).
- Delete: `game/src/core/battle/ActionImpactSystem.test.ts` — both describes (`:35` basic pipeline, `:138` skill batch) cover only the deleted class; `scaleActionDamage` has no coverage there.

**Interfaces (RETAINED):** `ActionDamageInfo` (`:45`), `scaleActionDamage` (`:49`), `HitResolveOptions` (`:65`), `ScheduledBasicImpact` (`:111`, the parked port's param type). Live consumers: `TurnBattleSystem.ts:13,23`, `TurnSkillAction.ts`, `SkillToTurnSkillConverter.ts:4`, `ArtifactSystem.ts`, `NguKiemDaoProvider.ts`.

- [ ] **Step 1: Grep-verify class-member callers** — `grep -rn "scheduleBasic\|fireSkillHit\|beginSkillBatch\|endSkillBatch\|\.tick(" src --include="*.ts" | grep -v ActionImpactSystem` → only parked `ArtifactSystem` (`scheduleBasic`) and tests. `grep -rn "new ActionImpactSystem" src` → expect zero production constructions.
- [ ] **Step 2: Slim the file + retype the parked dep; update the parked test mock.** The `as never` emit inside the deleted `tick`/batch code disappears with it (resolves that audit item without a cast fix).
- [ ] **Step 3: Delete/trim `ActionImpactSystem.test.ts`; run `npm run type-check` + `npx vitest run src/core/battle src/core/artifact`.**
- [ ] **Step 4: Commit** `refactor(battle): slim ActionImpactSystem to damage contracts + parked artifact port`

### Task 5: Slim `ActionTargetingSystem.ts` to live + parked helpers

**Files:**
- Modify: `game/src/core/battle/ActionTargetingSystem.ts` — keep `areaFor` (`:86`, live in `TurnSkillAction.ts:629`) and `selectRankedTarget` (`:60`, parked `ArtifactSystem.ts:153`); delete `isHeroGate` (`:31`), `collectAffected` (`:123`), `findBattleEnemy` (`:173`). Update the header comment (`:3` lists the deleted names).
- Modify: `game/src/core/battle/ActionTargetingSystem.test.ts`, `ActionTargetingSystem.adversarial.test.ts` — delete the `collectAffected`/`isHeroGate`/`findBattleEnemy` describes; keep `areaFor`/`selectRankedTarget` coverage.

- [ ] **Step 1: Grep-verify** — `grep -rn "isHeroGate\|collectAffected\|findBattleEnemy" src tests` → the module, its two test files, `ActionTargetingSystem.ts:97-98` (`collectAffected()` referenced inside the retained `areaFor` — fix that call/reference, it is live code not just a comment), the `TurnSkillAction.ts:607-613` comment (fix — the cited function is a turn-side re-implementation), and `TurnSkillAction.adversarial.test.ts:103`. **Rule: clean every hit the grep returns.**
- [ ] **Step 2: Delete the three helpers; trim the tests.**
- [ ] **Step 3: `npm run type-check` + `npx vitest run src/core/battle`.**
- [ ] **Step 4: Commit** `chore(battle): drop dead targeting helpers, keep areaFor/selectRankedTarget`

### Task 6: Trim `Battle.ts` to the parked artifact contract

**Files:**
- Modify: `game/src/core/battle/Battle.ts` — including the `:4` header comment, which still references `ActionImpactSystem`/`ActionTargetingSystem`; refresh it to describe the parked artifact contract after Tasks 4-5 slim those modules.
- Modify fixtures: `game/src/core/artifact/ArtifactSystem.test.ts:70-87` (`createBattle` sets the deleted fields), `ActionTargetingSystem.test.ts:27-38` + `ActionTargetingSystem.adversarial.test.ts:23-29` `battleWith` helpers. Note: those helpers use `as unknown as Battle` casts so they compile regardless — drop the dead keys anyway for honesty.

**What parked code actually reads (keep):** `Battle.player`, `.enemies`, `.state`, `.playerMaterialized`, `.playerBuffs`, `.artifactRuntime`; `BattleEnemy.entity`, `.buffs`. (`ArtifactSystem.ts` reads `battle.artifactRuntime/.enemies/.player/.playerMaterialized/.state`.)

**Delete (zero production readers — several have only fixture writes):** `Battle.id` (:60 — only `ArtifactSystem.test.ts:39` writes it), `.elapsedSeconds` (:110 — fixture `:41` only), `.mode`, `.countdownSecondsRemaining` (note: `CombatCountdownOverlay.vue:33` + its test `:6` reference the name — receiver-scoped check required; if the overlay reads a *different* type's field, fix the stale reference, don't keep the field), `.playerTeleport` + `PlayerTeleportState`, `.pendingPlayerSpawn` + `PendingPlayerSpawn`, `.pendingSummons`, `.pendingEnemySpawns` + the `Battle.ts` `PendingEnemySpawn` interface (the live turn-side `PendingEnemySpawn` is declared separately in `TurnBattleSystem.ts:75` — untouched), `.nextSkillSlotIndexCursor`; `BattleEnemy.attackTimer` (:26 — fixture `:82` only), `.castTimer`, `.appliedTribulationPhaseCount`, `.enrageApplied`, `.specialAttackCounter` (the live `BattleLootSystem.ts:197,201` `rewardGranted` reads are on the separate `RewardPendingEnemy` interface `:69-72`, NOT `BattleEnemy` — so `BattleEnemy.rewardGranted` :33 is also deletable). Fix stale `pendingSummons`/`BattleSystem`/`specialAttackCounter` comments in `BattleLootSystem.ts:162`, `StageWaveSystem.ts:41`, `TribulationPhase.ts:35`, `CombatEntity.ts:63`, `TurnBattleSystem.ts:142` ("ported from `BattleEnemy.specialAttackCounter`").

- [ ] **Step 1: Per-field grep — receiver-scoped, not name-scoped.** `pendingEnemySpawns`/`specialAttackCounter`/`mode`/`state`/`elapsedSeconds` are shared names live in `TurnBattleSystem`/`BattleTypes`/`GameMode` — a bare `grep <field>` returns false positives and cannot prove deletability. For each candidate field, grep the *receiver* (`battle.<field>`, `enemy.<field>` inside `Artifact*` code) or narrow with `grep -rn "\.elapsedSeconds\b" src | grep -iv "turn\|tribulation"`. Only delete fields whose remaining hits are declaration + the parked test fixture.
- [ ] **Step 2: Delete fields + interfaces; update fixtures to drop the removed keys.**
- [ ] **Step 3: `npm run type-check` + `npx vitest run src/core/artifact src/core/battle`.**
- [ ] **Step 4: Commit** `chore(battle): trim Battle contract to parked artifact runtime surface`

### Task 7: Delete `ArtifactDropBalance.ts`

**Files:**
- Delete: `game/src/core/artifact/ArtifactDropBalance.ts`, `game/src/core/artifact/ArtifactDropBalance.test.ts`

- [ ] **Step 1: Grep-verify** — `grep -rn "ARTIFACT_STONE_DROP_CHANCE\|ARTIFACT_STONE_BOSS\|ArtifactDropBalance\|grantArtifactStoneDrop" src tests` → expect only the two files and stale comments. Confirm the live drop path is `StageDropTables.ts:69` (`doan_bao_thach` material entry) + `BattleLootSystem.artifactDrop.test.ts` (unaffected).
- [ ] **Step 2: Delete both files; `npm run type-check` + `npx vitest run src/core/artifact src/core/game`.**
- [ ] **Step 3: Commit** `chore(artifact): delete unreferenced ArtifactDropBalance constants`

---

## Phase 2 — Legacy bridges (delete, don't migrate)

### Task 8: Delete `statKeyMigration.ts` and make restore/validation reject legacy keys

**Files:**
- Delete: `game/src/core/stats/statKeyMigration.ts`, `game/src/core/stats/statKeyMigration.test.ts`
- Modify: `game/src/services/save/saveShapeValidation.ts` — drop the `migrateStatModifierStat`/`isRetiredStatKey` import (`:20-21`); delete the remap at `:1111-1113` (the `STAT_TYPES.has(entry.mainStat.stat)` check directly below `:1122-1124` then *rejects* legacy keys — the desired dev-stage behavior); delete `migrateSocketedModifierStatKeys` (`:1239-1267`) and its call at `:1223` — replace with validation that `socketed*` modifier `stat` values are `STAT_TYPES` members (push an issue otherwise; these fields are themselves removed in Task 24).
- Modify: `game/src/stores/player.ts` — drop the import (`:18-20`); in `restoreFromSave`, iterate `clonedPlayer.baseStats` directly into the existing `allowedStatKeys` whitelist (`:370-383`) — legacy keys like `attack` are not in `createBaseStats()` and drop naturally; replace the three `migrateStatModifiers` calls (`:405-413`) with a current-shape filter.
- Modify: `game/src/core/game/GameManagerSaveRestore.ts` — drop the import (`:25`); delete the `migrateLegacyTechniqueStatKeys`/`migrateLegacySkillStatKeys` helpers (`:476-498`, including the `attackFlat → mightFlat` record rewrite) and their call sites (`:200,:257`).
- Modify: `game/src/core/game/GameManagerSaveRestore.boundary.test.ts:611-719` — the entire "stat-key migration on techniques[]/skills[] restore" describe asserts the deleted behavior. Split it: **keep** the template re-derive cases (`:677-698` — registered entries re-derive `effects`/`tierEffects`/`passiveModifiers` from the catalog template; that is NOT migration and the assertions stand as-is); **rewrite** the legacy-remap cases (`:612-654` legacy `attackFlat`→`mightFlat`, `:656-675` legacy skill `stat:'attack'`→`'might'`, `:700-719` orphan remap) as **drop** assertions — a legacy-keyed effect field is ignored/dropped, not translated.
- **Orphan-entry contract (decided — pin in the rewritten tests):** a technique/skill save entry with no registered template is DROPPED, not kept with remapped legacy keys (dev-stage rule; the current `:700-719` "keep with remap" expectation is exactly the bridge being deleted).
- Modify: `game/src/stores/player.legacyGatedModifier.qa.test.ts` — rewrite: a legacy-keyed or domain-less gated modifier is now *dropped*, not backfilled.
- Modify: `game/src/services/save/saveShapeValidation.test.ts` — cases asserting remap (`attack` → `might`) become rejection assertions.
- Comment cleanups referencing the deleted symbols: `saveShapeValidation.ts:1010-1011` ("restoreFromSave runs migrateStatModifiers after the boundary") and `SaveSystem.ts:146` ("drop the key via migrateStatRecordKeys").

**Interfaces:**
- New restore filter (module-local in `player.ts`): `isCurrentStatModifier(m: unknown): m is StatModifier` — must check MORE than `STAT_TYPES.has(m.stat)`: `applyDomainGate` (`src/core/stats/StatDomain.ts:185-213`) **throws** in dev/test (`isDevOrTestEnv()` at `:161-163`) on a gated-stat modifier lacking `domain`, so "the production path drops it" is false — post-delete it would crash `calculateStats` on the next call, not drop. The restore filter must drop gated-stat modifiers lacking `domain` at the boundary:

```ts
function isCurrentStatModifier(m: unknown): m is StatModifier {
  if (!isObject(m) || typeof m.stat !== 'string' || !STAT_TYPES.has(m.stat)) return false
  // Gated stats REQUIRE a domain — a legacy domain-less entry is a bridge
  // artifact; drop it here, before applyDomainGate can throw on it.
  if (STAT_DOMAIN[m.stat] !== undefined && m.domain === undefined) return false
  return true
}
```

(Verify `STAT_DOMAIN`'s export shape at `StatDomain.ts` — keyed by stat; adjust the membership check to whatever the map exposes.) Apply to `modifiers`, `externalModifiers`, and each `persistentTimedEffects[].modifiers`. No backfill anywhere — that is the dev-stage contract.

- [ ] **Step 1: Failing tests first** — `saveShapeValidation.test.ts`: a save whose equipment `mainStat.stat === 'attack'` (legacy key) returns `ok:false`. `player` restore test: a `baseStats` record containing `attack: 5` and a modifier `{ stat: 'attackRange' }` → after restore, `baseStats` has no `might` inflation and the modifier is gone.
- [ ] **Step 2: Run — expect FAIL** (current code remaps/retains them).
- [ ] **Step 3: Implement** the deletions + filter described above.
- [ ] **Step 4: Run — PASS; `npm run type-check`; `npx vitest run src/services/save src/stores src/core/stats src/core/game`.**
- [ ] **Step 5: Commit** `chore(save): delete statKeyMigration; reject legacy stat keys`

### Task 9: Remove the dead `pham_nhan` basic-attack key

**Files:**
- Modify: `game/src/data/skill/TurnBasicAttacks.ts` — remove `pham_nhan` from `BASIC_ATTACKS_BY_BUILD` (`:53`) and `REQUIRED_BUILD_IDS` (`:77`).
- Modify: `game/src/data/skill/TurnBasicAttacks.test.ts:20` (asserts the entry exists → assert `BASIC_ATTACKS_BY_BUILD['pham_nhan']` is `undefined` or drop the assertion); `TheTuSkills.test.ts:100` already asserts `the_tu` absence — keep.

**Interface:** `GameManager.resolvePlayerBasicAttack` (`GameManager.ts:977-996`) — a mortal/`pham_nhan` player now falls through to `GENERIC_PHYSICAL_BASIC`, which is exactly what the deleted key mapped to. Behavior-identical — no failing test needed; the update is pure dead-key removal.

- [ ] **Step 1: Grep-verify** `pham_nhan` is never a `CultivationPathId` value (`CultivationPathKit.ts:44`) and `grep -rn "BASIC_ATTACKS_BY_BUILD" src` shows the map is only indexed by `player.cultivationPath` and tests. Also clean stale `pham_nhan` comments in `SaveSystem.ts:169` and `GameManager.ts:892,:1071` (rule: clean every remaining hit).
- [ ] **Step 2: Remove the key + required-id entry + test update.**
- [ ] **Step 3: `npm run type-check` + `npx vitest run src/data/skill`.**
- [ ] **Step 4: Commit** `chore(skill-data): drop unreachable pham_nhan basic-attack key`

### Task 10: `hoi_xuan_dan` — verify rejection is complete, pin it, clean comments

**Files:**
- Modify: `game/src/core/game/GameManagerPillOps.ts` — no code change expected; confirm the `retired` check (`:49-53`) runs before every other gate and is the only retired special-case.
- Modify: `game/src/core/game/GameManager.authoredParity.test.ts` / `src/core/pill/PillSystem.profession.test.ts` — add/adjust an explicit rejection pin only if coverage is missing (existing: `authoredParity.test.ts:248` asserts `startAlchemyJob` rejects retired recipes; `PillSystem.profession.test.ts:136-142` asserts `usePillDetailed` keeps the pill in bag).

- [ ] **Step 1: Grep-verify no residual conversion/compat exists** — `grep -rn "hoi_xuan_dan\|hoi_xuan_thao" src --include="*.ts" --include="*.vue" | grep -v test` → expected hits: `PillFamilies.ts:33` (retired family row), `alchemyRecipes.ts:30` (retired propagation), `quests.ts:28-31` (intentional live herb quest), `materials.ts` herb generation (intentional), comments. Any save-restore special-casing is a defect — remove it.
- [ ] **Step 2: Confirm/adjust the rejection tests; run `npx vitest run src/core/game/GameManager.authoredParity src/core/pill`.**
- [ ] **Step 3: Commit** `test(pill): pin retired-family rejection contract` (or no commit if nothing changed — record the verification in the worklog).

### Task 11: Delete the `Buff.ts` re-export shim

**Files:**
- Delete: `game/src/core/buff/Buff.ts` (`export type { Buff } from './BuffTypes'`)
- Modify: `game/src/core/buff/BuffPool.test.ts:3`, `game/src/core/buff/BuffSystem.test.ts:5` — repoint `import type { Buff }` to `'./BuffTypes'`.

- [ ] **Step 1: Grep-verify** — `grep -rn "from '.*\/Buff'" src tests | grep -v BuffTypes` → only the two test imports.
- [ ] **Step 2: Repoint imports, delete the file; `npm run type-check` + `npx vitest run src/core/buff`.**
- [ ] **Step 3: Commit** `chore(buff): delete Buff.ts re-export shim`

### Task 12: Remove dead realm-formula branches and stale comments

**Files:**
- Modify: `game/src/data/realms/realm.ts` — delete `baseRequiredCultivation?`/`cultivationMultiplier?` fields (`:15-16`) and their stale comment block (`:10-16`, which wrongly claims Phàm Nhân still uses the old formula); fix the mortal-entry comment ("GIỮ NGUYÊN công thức hấp thu cũ" — now false; mortal uses `baseCultivationMinutes: 1`).
- Modify: `game/src/core/realm/realmSystem.ts` — in `getRequiredCultivation`, delete the `realmDurationMultiplier === undefined` legacy branch (`~:77-83`); in `getCultivationDurationSeconds`, delete the `baseCultivationMinutes === undefined` legacy branch (`~:48-57`). `getCultivationDurationSeconds` has no production callers — delete the export and inline the minutes→seconds math inside `getRequiredCultivation`'s `baseCultivationMinutes` branch, or keep it only if a caller remains after re-grep. Update the stale "Phàm Nhân (tutorial) — công thức hấp thu cũ" comment.
- Modify: `game/src/core/cultivation/CultivationSystem.test.ts:7,24,35` — if `getCultivationDurationSeconds` is deleted, rewrite those assertions via `getRequiredCultivation` (`minutes * 60 * BASE_CULTIVATION_PER_SECOND`).

**Interface (result):**

```ts
export function getRequiredCultivation(realmId: string, realmLevel: number): number {
  const realm = getCurrentRealm(realmId)

  if (realm.baseCultivationMinutes !== undefined) {
    return Math.floor(
      (realm.baseCultivationMinutes + Math.max(1, realmLevel) - 1) * 60 * BASE_CULTIVATION_PER_SECOND,
    )
  }

  // duration-budget path (realmDurationMultiplier) — unchanged
  // guard: throw/warn if neither field is set (data contract violation)
}
```

- [ ] **Step 1: Grep-verify** — `grep -rn "baseRequiredCultivation\|cultivationMultiplier" src` → only `realm.ts` + `realmSystem.ts` today; `grep -rn "getCultivationDurationSeconds" src | grep -v test` → no production callers. Confirm every `REALMS` entry has `baseCultivationMinutes` XOR `realmDurationMultiplier` (data invariant to pin).
- [ ] **Step 2: Failing test** — in a realm/realmSystem test: `REALMS` invariant `expect(REALMS.every(r => (r.baseCultivationMinutes !== undefined) !== (r.realmDurationMultiplier !== undefined))).toBe(true)` plus `getRequiredCultivation('golden_core', 1)` still equals the budget-formula value and `getRequiredCultivation('mortal', 1) === 60 * BASE_CULTIVATION_PER_SECOND` (unchanged outputs).
- [ ] **Step 3: FAIL (invariant test may already pass — if so, it stands as the regression net; the changed assertions are the removal targets).**
- [ ] **Step 4: Implement** the deletions + inline.
- [ ] **Step 5: PASS; `npm run type-check`; `npx vitest run src/core/realm src/core/cultivation`.**
- [ ] **Step 6: Commit** `chore(realm): delete unreachable legacy cultivation formulas`

---

## Phase 3 — Type hygiene (`as never` / `any` / redundant casts)

### Task 13: Typed `Material` fallback in `GameManagerTickOps`

**Files:**
- Modify: `game/src/core/game/GameManagerTickOps.ts:271-287`

**Fix:** `materialRegistry.has() ? .get() : undefined` + `as never` fallback becomes a fully typed fallback — decompose output is produced by buildings, so:

```ts
const tinhHoa: Material =
  (this.deps.materialRegistry.has(entry.materialId)
    ? this.deps.materialRegistry.get(entry.materialId)
    : undefined) ??
  { id: entry.materialId, name: entry.materialId, category: 'other', sourceType: 'building' }

const overflow = this.deps.materialBag.add(tinhHoa, entry.amount)
// notification below uses tinhHoa.name directly — drop the `as { name?: string }` cast
```

- [ ] **Step 1: Failing/compile test** — a `deliverDecomposeOutput` entry whose `materialId` is absent from the registry still adds to the bag with the fallback name (extend the existing tick/decompose test file). Assert no `as never` remains via type-check.
- [ ] **Step 2: Implement; `npm run type-check` + `npx vitest run src/core/game`.**
- [ ] **Step 3: Commit** `fix(tick): typed Material fallback for decompose output`

### Task 14: `DecomposeTab.vue` select-value guards

**Files:**
- Modify: `game/src/components/panels/equipment-hall/DecomposeTab.vue:69-76`

**Fix:** `DecomposeSettings['gradeFilter']` is `ProfessionGrade | 'all'`; `ageFilter` is `HerbAge | 'all'` (`DecomposeSystem.ts:29-33`). Guard before assigning — no cast:

```ts
function onGradeChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (value === 'all' || isProfessionGrade(value)) applySetting({ gradeFilter: value })
}
function onAgeChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (value === 'all' || (HERB_AGES as readonly string[]).includes(value)) applySetting({ ageFilter: value })
}
```

(import `isProfessionGrade` from `core/profession/ProfessionGrade`, `HERB_AGES` from `core/production/ProductionTypes` — the same sources the validator uses.)

- [ ] **Step 1: Failing test** — a DecomposeTab component/store test: inject an out-of-union select value → `settings` unchanged (or assert via `applySetting` spy). If no component test seam exists, add the guard functions as a small exported helper and unit-test it.
- [ ] **Step 2: Implement; `npm run type-check` + relevant vitest.**
- [ ] **Step 3: Commit** `fix(decompose): validate DOM select values instead of as-never casts`

### Task 15: `CombatScene` handler tuples → `EventHandler<never>`; drop redundant `!`

**Files:**
- Modify: `game/src/game/scenes/CombatScene.ts` — `boundHandlers` (`:580`) and `getCombatEventBindings()` return type (`:587`): `Array<[string, (event: any) => void]>` → `Array<[string, EventHandler<never>]>` (`import type { EventHandler } from '@/core/events/EventBus'`). `EventHandler<never>` is exactly what `EventBus.on/off` stores internally — handlers keep their concrete payload types at the binding literals. Also drop the redundant non-null assertion `this.projection!.gridToScreen` at `:1042` (`this.projection.cellSizeAt` at `:1039` already proves non-null in that block).

- [ ] **Step 1: Grep-verify no other `(event: any)` remains in the file after the change — `grep -n "any" src/game/scenes/CombatScene.ts`.**
- [ ] **Step 2: Implement; `npm run type-check` + `npx vitest run src/game/scenes`.**
- [ ] **Step 3: Commit** `refactor(scene): type combat event handler tuples, drop redundant assertion`

### Task 16: `__tutienPhaserGame` global declaration

**Files:**
- Modify: `game/env.d.ts` (already included via `tsconfig.app.json:3`) — append:

```ts
// Exposed on window for e2e/visual gates only (see PhaserCanvas.vue) —
// no gameplay code reads it.
interface Window {
  __tutienPhaserGame?: import('phaser').Game
}
```

- Modify: `game/src/components/game/PhaserCanvas.vue:182,203` — `;(window as unknown as { __tutienPhaserGame?: Phaser.Game }).__tutienPhaserGame = ...` → `window.__tutienPhaserGame = ...`.

- [ ] **Step 1: Implement; `npm run type-check`; confirm `grep -n "as unknown" src/components/game/PhaserCanvas.vue` returns nothing for this site.**
- [ ] **Step 2: Commit** `refactor(host): declare __tutienPhaserGame globally in env.d.ts`

### Task 17: Drop remaining double casts (`combat-status-tooltip`, `useDynamicRegion`)

**Files:**
- Modify: `game/src/game/scenes/combat/combat-status-tooltip.ts` — `TooltipParts.container: { destroy(): void }` (`:27-29`) → `container: Phaser.GameObjects.Container`; delete the `as unknown as { destroy(): void }` cast at `:68` (the file already imports Phaser).
- Modify: `game/src/presentation/gate/PresentationGate.ts` + `game/src/presentation/host/useDynamicRegion.ts:228,232` — add a small adapter exported from the gate module (keeps Phaser out of the gate's type surface):

```ts
/** Phaser's DataManager satisfies GateRegistry structurally; adapt once. */
export function toGateRegistry(registry: { get(key: string): unknown; set(key: string, value: unknown): void }): GateRegistry {
  return { get: (key) => registry.get(key), set: (key, value) => registry.set(key, value) }
}
```

then `created.registry as unknown as GateRegistry` → `toGateRegistry(created.registry)` at both sites.

- [ ] **Step 1: Implement; `npm run type-check` + `npx vitest run src/presentation src/game/scenes`.**
- [ ] **Step 2: Commit** `refactor(types): remove double casts in tooltip + region gate`

### Task 18: `weightedRandom([])` + `NodeSystem` prereq realm — verify ownership, do not fix here

- [ ] **Step 1: Check whether Mission E Task 16 landed** — `grep -n "entries.length" src/core/reward/DropRoll.ts` (empty-input throw, audit T8-71) AND `grep -n "getRealmIndex\|required" src/core/progression/NodeSystem.ts` (unknown prereq realmId fails closed, audit T8-75 — spec-assigned to E10, not G). If a fix is already present, record it and move on; if absent, leave the code untouched (E16 owns both) and note it in the mission report.
- [ ] **Step 2: No commit** (documentation step only).

---

## Phase 4 — Dead UI / state / artifact advertising

### Task 19: Remove the artifact combat presentation chain + milestone effect tooltips

**Files:**
- Delete: `game/src/composables/useArtifactCombatPresentation.ts`, `game/src/core/artifact/ArtifactCombatPresentation.ts`, `game/src/components/game/combat/hud/ArtifactCombatSlot.vue`, `game/src/components/game/combat/hud/PhapTuCombatHud.vue`, `game/src/components/game/combat/hud/CombatBuildHud.vue`
- Modify: `game/src/components/game/combat/CombatSkillDockPanel.vue:24,57` — remove the `CombatBuildHud` import + `<CombatBuildHud />` mount (the `<aside>`/`rootRef`/`TurnCombatSkillBar` stay — width publishing is still needed).
- Modify: `game/src/components/panels/artifact/ArtifactPathCards.vue:44` — the milestone `v-tooltip` description advertises combat effects that don't exist → drop `description: milestone.description` (keep `title` = name + level). If the resulting tooltip is title-only noise, drop `v-tooltip` from the `<li>` entirely.

**Retained (do not touch):** `ArtifactSystem.ts` (incl. `getArtifactCycleSeconds` — used internally at `:155`), `ArtifactRuntime.ts`, `ArtifactProgression.ts`, `ArtifactPanel.vue` + `ArtifactOverview`/`ArtifactExperienceBar`/`ArtifactGradeSection`/`ArtifactPathCards` shells, `data/artifact/**` milestone data (parked design copy), `GameManager.setArtifactPath` + its test, `player.artifact` state.

- [ ] **Step 1: Grep-verify the chain** — `grep -rn "useArtifactCombatPresentation\|ArtifactCombatPresentation\|ArtifactCombatSlot\|PhapTuCombatHud\|CombatBuildHud" src tests` → only the files listed. Confirm no `.test.ts` file covers them (none found in verification).
- [ ] **Step 2: Delete files + unmount + strip the tooltip description.** Keep the milestone names/levels (progression display); the parked `NguHanhChau.ts` descriptions stay in data (not rendered) — add a one-line **English ASCII** comment there (P15 — do not copy the file's existing Vietnamese comment style) noting combat-effect copy is parked until the reimagine.
- [ ] **Step 3: `npm run type-check` + `npx vitest run src/components src/core/artifact`.**
- [ ] **Step 4: Commit** `chore(artifact): remove dormant combat HUD chain and milestone effect tooltips`

### Task 20: Remove the unreachable MainMenu overlay

**Files:**
- Delete: `game/src/components/menu/MainMenu.vue`
- Modify: `game/src/App.vue` — remove the `MainMenu` import (`:47`), `initialShowMainMenu: false` (`:180`), `showMainMenu` computed (`:209-213`), `handleMenuStart`/`handleMenuSettings` (`:215-222` — `ui.leftPanelMode = 'settings'` inside `handleMenuSettings` is dead with the menu), `showMainMenu.value = false` writes (`:216,:536`), the `<MainMenu>` template block (`:722-734`), and the `mainMenu` CSS comment (`:842`).
- Modify: `game/src/presentation/GamePresentationCoordinator.ts` — remove `showMainMenu` field (`:74`), `initialShowMainMenu` dep (`:61,:97`), snapshot field (`:110`), `setShowMainMenu` (`:129-133`).
- Modify: `game/src/presentation/VueRouteAdapter.ts` — remove `showMainMenu` (`:138,:162,:180,:217`).
- Modify: `game/src/presentation/PresentationContracts.ts:103` — remove `showMainMenu` from the snapshot interface.
- Modify: `game/src/core/presentation/OverlayLayers.ts:23` — remove the `mainMenu` layer entry.
- Modify: `game/tests/architecture/overlayLayers.test.ts:56` — remove the `MainMenu.vue` → `OVERLAY_LAYERS.mainMenu` entry.
- Modify: `game/src/presentation/GamePresentationCoordinator.test.ts:663-664` — remove the two `setShowMainMenu` lines (they live inside an unsubscribe test, not a standalone case — delete the lines, keep the test). Check `App.wiring.test.ts`/`App.routeMountWitness.test.ts` for `MainMenu`/`showMainMenu` references and update.
- Modify: `game/src/App.vue:533-535` — the `bootGame` header comment ("MainMenu là entry tạm thời — mọi đường vào game … đều phải tắt nó") describes the deleted mechanism; rewrite it in terms of the surviving entry flow.

- [ ] **Step 1: Grep-verify zero callers ever set the menu visible** — `grep -rn "setShowMainMenu\|showMainMenu\|MainMenu" src tests` → every production hit is a `false` write or the chain itself. Confirm nothing else uses `OVERLAY_LAYERS.mainMenu`.
- [ ] **Step 2: Delete + rewire all listed sites.**
- [ ] **Step 3: `npm run type-check` + `npx vitest run src tests/architecture`.**
- [ ] **Step 4: Commit** `chore(ui): remove unreachable MainMenu overlay chain`

### Task 21: Remove the inert `vue-router` dependency

**Files:**
- Delete: `game/src/router/index.ts` (then the empty `game/src/router/` dir)
- Modify: `game/src/main.ts` — remove `import router` (`:6`) + `app.use(router)` (`:19`)
- Modify: `game/package.json` — remove `"vue-router": "^5.2.0"` (`:34`); regenerate the lockfile (`npm install` or targeted lockfile update).
- Modify: `game/vite.config.ts` — remove `vue-router` from the `manualChunks` vendor regex (`:66`) and fix the "Vue/Pinia/router/i18n" comment (`:54`) — dead config after the dep is gone.

**Decision (locked by verification):** `routes: []` + zero `RouterView`/`useRouter`/`useRoute`/`createRouter` callers outside `router/index.ts` — the app's real navigation is the presentation coordinator (`VueRouteAdapter`, `RouteMount`), not vue-router. Remove it; restoring the dep later is a one-line package change if a future nav plan appears.

- [ ] **Step 1: Grep-verify** — `grep -rn "vue-router\|RouterView\|useRouter\|useRoute\b" src tests` → only `src/router/index.ts` + `main.ts`.
- [ ] **Step 2: Remove the file, the import/`use`, the dep; reinstall to update the lockfile.**
- [ ] **Step 3: FULL verification** (package.json/lockfile touched, P3): `npm run type-check` + `npm run build` + `npx vitest run`.
- [ ] **Step 4: Commit** `chore(deps): drop unused vue-router`

### Task 22: Dead store members — `player.load()`, `markRealmEnhancementUnlocked` + `unlockedRealmEnhancements`, `PlayerData.isCultivating`, `ui.pendingEquipTarget`

**Files:**
- Modify: `game/src/stores/player.ts` — delete the `load()` action (`:305-313`) and its `loadGame` import if now unused; delete `markRealmEnhancementUnlocked` (`:274-284`); clean stale comments referencing `load()` (`:160` "xem player.load()") and `useElectronBridge.ts:18` ("lần lúc player.load()").
- Modify: `game/src/core/player/Player.ts` — delete `unlockedRealmEnhancements` from `PlayerData` (`:61`) + default (`:350`); delete `isCultivating` (`:83`) + default (`:352`); clean the stale comments referencing them (`:72,:78,:258`).
- Modify: `game/src/App.vue:468` — remove `player.isCultivating = true` (the `cultivation_changed` event emit stays — it carries its own payload).
- Modify: `game/src/services/save/saveShapeValidation.ts` — remove `requireBoolean(player, 'isCultivating', ...)` (`:237`) and the `unlockedRealmEnhancements` block (`:230-233`).
- Modify: `game/src/services/save/saveTypes.ts` — drop the stale `isCultivating` (`:102`) and `unlockedRealmEnhancements` (`:57`) comments.
- Modify: `game/src/stores/ui.ts:158-159` — delete `pendingEquipTarget` + its legacy comment.
- Modify test fixtures that declare the removed fields: `player.aiStrategy.test.ts`, `player.artifact.test.ts`, `player.legacyGatedModifier.qa.test.ts`, `player.restoreFromSave.test.ts`, `player.talentM2.test.ts` (all carry `isCultivating: false` / `unlockedRealmEnhancements: []`), `saveShapeValidation.test.ts:1629,1730` (expected-key lists), `GameManagerSaveRestore.boundary.test.ts:128-129` — and check whether a shared `baseSave()` fixture helper exists (the boundary test imports one); if it does, fix the helper once rather than every consumer.

**Explicitly kept (audit correction #9):** `ui.combatOrigin` + `enterCombatScene` — live gate read by `CombatResultModal`/`CombatExitConfirmModal`, written by `useBattleActions.ts:87,137`.

- [ ] **Step 1: Grep-verify per member** — `player.load(`, `markRealmEnhancementUnlocked`, `unlockedRealmEnhancements` (non-fixture readers), `player.isCultivating` reads (vs `event.isCultivating` payload reads — do not confuse), `pendingEquipTarget`. Re-confirm `combatOrigin` stays.
- [ ] **Step 2: Delete fields + writers + validation + stale comments; update fixtures.**
- [ ] **Step 3: `npm run type-check` + `npx vitest run src/stores src/services/save src/App*`.**
- [ ] **Step 4: Commit** `chore(stores): remove write-only and caller-less state`

### Task 23: Delete the dead `beginTribulation` APIs

**Files:**
- Modify: `game/src/core/game/BattleLootSystem.ts` — delete `beginTribulation` (`:167-172`) + its doc block (`:154-166`); fix the stale comment at `:377` (and the `pendingSummons` reference at `:162` if not already cleaned in Task 6).
- Modify: `game/src/core/talent/SurviveLethalGuard.ts` — delete `beginTribulation()` (`:20-22`) + its doc line (`:7-8`); the tribulation exclusion contract is `setSurviveLethalSession(null)` — keep that documented.
- Delete: `game/src/core/game/BattleLootSystem.beginTribulation.test.ts` (whole file tests the deleted method).
- Modify: `game/src/core/talent/SurviveLethalGuard.test.ts:37-41` — delete the `beginTribulation` case.
- Modify: `game/src/core/combat/CombatSystem.surviveLethal.test.ts:123-140` — the "tribulation does not trigger survive" case needs MORE than dropping the call: `session.guard.beginTribulation()` at `:130` is the only thing zeroing the guard's `remainingUses`, and `:139` asserts `getRemainingUses() === 0`. Dropping the call alone leaves `expect(1).toBe(0)` — a red test. Rewrite the case: delete `beginTribulation()` AND the `:139` remainingUses assertion; the surviving contract is "session is null (`setSurviveLethalSession(null)`) → death stands" — the player death assertion at `:137-138` is the real check; the detached guard's counter is irrelevant.
- Modify: `game/src/core/combat/CombatSystem.ts:610` — fix the stale `GameManager.beginTribulation` comment if not done in Task 1.

- [ ] **Step 1: Grep-verify** — `grep -rn "beginTribulation" src tests` → only the two owners, the listed tests, comments.
- [ ] **Step 2: Delete + adjust tests; `npm run type-check` + `npx vitest run src/core/game src/core/talent src/core/combat`.**
- [ ] **Step 3: Commit** `chore(battle): remove dead beginTribulation APIs`

### Task 24: Remove the write-only Phù/Trận socket chain fields

**Files:**
- Modify: `game/src/core/equipment/EquipmentSlotState.ts` — delete `socketedTalisman`/`socketedFormation` (`:34,36`), `bonusAffixSlots` (`:40`), `appliedTalismanIds` (`:44`), their comments, the `SocketedModifierItem` import (`:2`), and the `createDefaultSlotState` entries (`:64-68`).
- Modify: `game/src/core/game/GameManagerPersistentEffectOps.ts` — `getSlotModifiers` (`:397-417`) loses its socket branches → the method becomes an empty aggregation; collapse `getActiveRuntimeModifiers` (`:276-278`) to return `getActiveTimedModifiers(...)` directly and delete `getSlotModifiers`, or keep a no-socket `getSlotModifiers` only if a fresh grep shows other callers (expected: none).
- Modify: `game/src/composables/useEquipmentTooltip.ts:158-159` — remove the `+ bonusAffixSlots` term from `affixCapacity` (field is always 0).
- Modify: `game/src/services/save/saveShapeValidation.ts` — **careful:** the `:1219-1233` range contains LIVE `enhanceFailStreak` validation/defaulting (`:1219-1229`, retained by this task — consumed by `EquipmentOperationSystem`). The only socket-related remnant is the `migrateSocketedModifierStatKeys` call at `:1223` and its helper `:1239-1267`, both already deleted by Task 8 — post-Task-8 nothing in this range is socket-related. This task's real validator surface: remove any `bonusAffixSlots`/`appliedTalismanIds`/`socketed*` *field* shape checks inside `validateEquipmentSlotsSave` (re-grep — there are no standalone "retired-socket defaults" in the file; the socket logic lived only inside the migrator helper).
- Modify: `game/src/services/save/saveTypes.ts`, `SaveSystem.ts:195-201` — drop stale legacy comments describing the migration.
- Modify tests: `saveShapeValidation.test.ts:869-885` (socketed cases → remove or convert to "legacy socket payload rejected/ignored"), `GameManagerSaveRestore.boundary.test.ts:128-129`, `SaveSystem.restoreIdentity.test.ts:104` fixtures.

**Retained:** `SocketedModifierItem.ts`/`TwoModifiers` (used by `Talisman`/`Formation` template types), `TalismanRegistry`/`FormationRegistry` + `data/talisman`/`data/formation` content (registered content — dead-end *usage* is E11/roadmap scope, not this task), `enhanceLevel`/`enhanceFailStreak` (live slot enhancement).

- [ ] **Step 1: Grep-verify no production writer exists** — `grep -rn "socketedTalisman\s*=\|socketedFormation\s*=\|appliedTalismanIds\.\|bonusAffixSlots =" src` → expect declarations/defaults only.
- [ ] **Step 2: Failing test** — extend `useEquipmentTooltip` coverage: `affixCapacity` equals `rarityAffixCap.prefix + suffix` (no slot bonus) — or a tooltip test asserting the socketed-item tooltip surface is unchanged for a real slot state.
- [ ] **Step 3: Implement; `npm run type-check` + `npx vitest run src/core/equipment src/core/game src/services/save src/composables`.**
- [ ] **Step 4: Commit** `chore(equipment): remove write-only Phu/Tran socket fields`

### Task 25: Delete `resolveSpriteBodyAnchor` (+ module + test)

**Files:**
- Delete: `game/src/game/support/SpriteBodyAnchor.ts`, `game/src/game/support/SpriteBodyAnchor.test.ts`

- [ ] **Step 1: Grep-verify** — `grep -rn "resolveSpriteBodyAnchor\|SpriteBodyAnchor" src tests` → only the two files.
- [ ] **Step 2: Delete; `npm run type-check` + `npx vitest run src/game`.**
- [ ] **Step 3: Commit** `chore(scene): delete unused SpriteBodyAnchor helper`

### Task 26: Delete `spiritStoneIdForRealm` + `filterNguHanhElements`

**Files:**
- Modify: `game/src/core/equipment/EquipmentSystem.ts:422` — delete `spiritStoneIdForRealm` (zero callers).
- Modify: `game/src/core/artifact/ArtifactSystem.ts:87` — delete `filterNguHanhElements` (zero callers; inside a parked file, but the export is dead even to parked code — parked means "not deleted wholesale", not "dead code kept").

- [ ] **Step 1: Grep-verify** — `grep -rn "spiritStoneIdForRealm\|filterNguHanhElements" src tests` → declarations only.
- [ ] **Step 2: Delete; `npm run type-check` + `npx vitest run src/core/equipment src/core/artifact`.**
- [ ] **Step 3: Commit** `chore(core): delete uncalled realm/element helpers`

---

## Phase 5 — Dead data + roadmap truth

### Task 27: Floor-8 ferocious beetle fix (real content bug)

**Files:**
- Modify: `game/src/data/stage/Stages.ts:145` — `{ common: 'foundation_metal_beetle_swarm', elite: 'foundation_ferocious_blade_hawk_king' }` → `common: 'foundation_ferocious_metal_beetle_swarm'` (the ferocious variant exists at `FoundationEnemies.ts:314`; every other odd floor pair uses the ferocious form, and floor 7's elite already proves the non-ferocious swarm is the floor-7 mob).
- Modify: `game/src/data/stage/Stages.test.ts` — add the pinning case.

- [ ] **Step 1: Failing test** — in `Stages.test.ts`: assert the chapter-3 floor-8 stage's common enemy is `foundation_ferocious_metal_beetle_swarm` (or assert the chapter-wide convention: every even floor's `common`/`elite` use the `ferocious` variant of the preceding odd floor — pick the narrower assertion matching existing test style).
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Fix the data row.**
- [ ] **Step 4: Run — PASS; `npx vitest run src/data`.**
- [ ] **Step 5: Commit** `fix(stage): floor-8 common enemy is the ferocious beetle swarm`

### Task 28: Data/comment truth pass (verified-intentional items)

**Files:**
- Modify: `game/src/data/enemy/EnemyDropSinkInvariant.test.ts:19-20` — keep `broken_foundation_scroll`/`old_jade_slip` allowlisted; if the allowlist comment doesn't already say so, add one line: intentional lore drops, no functional sink by design (English ASCII per P15 for new comments).
- Modify: `game/src/data/materials/materials.ts:104,112` — comments already document intent; no code change.
- Modify: `game/src/core/realm/RealmTierMap.ts` — `body_integration` tier-8 special case is intentional; no change (record in worklog).

- [ ] **Step 1: Grep-confirm** both materials still appear in a live drop table (`StageDropTables.ts` comment `:20`) and the invariant test passes as-is.
- [ ] **Step 2: Apply only the comment addition if missing; run `npx vitest run src/data/enemy`.**
- [ ] **Step 3: Commit** `docs(data): note intentional sinkless lore drops` (or fold into the nearest commit — record the verification).

---

## Phase 6 — Dedup batch (one owner per rule)

### Task 29: Single rank→particle-color table in `BattleLootSystem`

**Files:**
- Modify: `game/src/core/game/BattleLootSystem.ts:699-721` — `getGradeParticleColor` (`Record<ItemGrade, number>`) and `getQualityParticleColor` (`Record<ItemQuality, number>`) are byte-identical tables (`ItemGrade` and `ItemQuality` are the same 5-member union). Replace both with one module constant `RANK_PARTICLE_COLORS: Record<ItemGrade, number>` and have both methods return `RANK_PARTICLE_COLORS[key]`.
- Modify: the existing loot/particle test file covering these methods — add a case asserting grade and quality lookups return identical values for all five ranks.

- [ ] **Step 1: Failing/passing parity test** — for each of `['hoang','huyen','dia','thien','tien']`, grade-color === quality-color (write it before collapsing; it may pass immediately — it exists to pin the single-table contract).
- [ ] **Step 2: Collapse to one table; `npm run type-check` + `npx vitest run src/core/game`.**
- [ ] **Step 3: Commit** `refactor(loot): single rank particle color table`

### Task 30: Route node max-level reads through `getNodeMaxLevel`

**Files:**
- Modify: `game/src/components/panels/loadout-sections/NodeTreePanel.vue:224` — `Math.max(1, node.maxLevel ?? 1)` → `getNodeMaxLevel(node)`.
- Modify: `game/src/components/panels/skill-path/NodeInspector.vue:63` — same replacement (import from `core/progression/NodeSystem`).

- [ ] **Step 1: Test** — extend a node-panel/component or `NodeSystem` test asserting `getNodeMaxLevel` semantics (`undefined`/`0`/positive `maxLevel` → 1/1/N) and that both UI consumers use it (a small unit assertion is enough — the panels already exercise max-level display in their tests).
- [ ] **Step 2: Implement; `npm run type-check` + `npx vitest run src/components src/core/progression`.**
- [ ] **Step 3: Commit** `refactor(nodes): route max-level normalization through getNodeMaxLevel`

### Task 31: `ESSENCE_REALM_ORDER` → `getRealmTier`

**Files:**
- Modify: `game/src/core/economy/VendorBalance.ts:61-72,127-133` — delete `ESSENCE_REALM_ORDER`; the essence branch becomes `const tierIndex = Math.max(0, getRealmTier(meta?.realmId ?? realmId) - 1)` then `VENDOR_ESSENCE_PRICE_BASE * Math.pow(VENDOR_REALM_GROWTH, tierIndex)` (same formula family as `realmGrowthFactor`, one realm-order authority: `RealmTierMap`).
- Modify: the vendor balance/pricing test — pin essence price per reachable realm (`mortal`→base·1, `qi_refining`→base·3, `foundation_establishment`→base·9).

**Behavior note (documented, not a bug):** the swap computes `getRealmTier(...) - 1`, so `tribulation` moves 9→8 and `body_integration` — tier 8 via the deliberate mahayana-share (`RealmTierMap.ts:18`) — moves 8→**7**, folding onto mahayana's price (arguably the *correct* alignment with the shared-tier decision, not a regression). No essence material carries `profession.realmId` and `SUPPORTED_PROFESSION_REALMS` caps at `foundation_establishment` (`ProfessionMaterial.ts:30-34`), so all reachable prices are unchanged; the divergence lives only in unreachable post-beta realms. Record it in the test comment.

- [ ] **Step 1: Failing/pinning test** — essence unit price for `mortal`/`qi_refining`/`foundation_establishment` context realms equals the current values (locks reachable behavior before the swap).
- [ ] **Step 2: Run — confirm reachable prices unchanged; implement the swap.**
- [ ] **Step 3: `npm run type-check` + `npx vitest run src/core/economy`.**
- [ ] **Step 4: Commit** `refactor(vendor): derive essence realm index from RealmTierMap`

### Task 32: Shared profession material-id constructor

**Files:**
- Modify: `game/src/core/profession/ProfessionMaterial.ts` — add the authoritative constructor (the file already documents the `<realm>_wood_<age>` / `<realm>_ore_<age>` convention at `:8-10`):

```ts
export function buildProfessionMaterialId(
  resourceKind: 'wood' | 'ore',
  realmId: string,
  age: HerbAge,
): string {
  return `${realmId}_${resourceKind}_${age}`
}
```

- Route every inline construction through it (verified sites — re-grep at execution time, the audit said ~6 and the current tree shows more):
  - `game/src/data/materials/materials.ts` — the generator's `id: ${realmId}_wood_${age}` / `${realmId}_ore_${age}` (`~:185,:204`).
  - `game/src/core/production/ProductionCatalog.ts:54,111,124` — wood/ore id strings.
  - `game/src/core/alchemy/AlchemySystem.ts:176` — `${realmId}_wood_${requiredAge}`.
  - `game/src/components/panels/AlchemyView.vue:154` — `${recipe.fuelWoodRealmId}_wood_${variant.age}` (cross-layer construction — the audit's point).
  - `game/src/core/equipment/EquipmentOperationCostCatalog.ts:70` — `${realmId}_ore_decade`.
  - `game/src/data/building/buildings.ts:27-28` (and literal rows `:105-106,:132` — leave literal data literals alone; only replace *constructed* ids where a realm/age variable is composed).
- Optionally co-locate `herbBaseId(herbId, realmId)` + `herbMaterialId(herbBaseId, age)` — the herb grammar differs (`${herbId}_${realmId}_${age}`); do NOT force it through the wood/ore helper. Only add if the same triple is re-implemented in ≥2 places (`materials.ts:230,245`, `ProductionCatalog.ts:154,156`, `alchemyRecipes.ts:19-22`).
- Leave `DecomposeSystem.ts:352`'s `ORE_ID_PATTERN` parser alone (inverse direction) but have it reference the shared pattern/comment so the convention has one documentation owner.

- [ ] **Step 1: Grep-enumerate the real sites** — `grep -rn '_wood_\|_ore_' src --include="*.ts" --include="*.vue" | grep -v test` and list the constructed-id sites (variable interpolation, not literals).
- [ ] **Step 2: Test** — `buildProfessionMaterialId('wood','qi_refining','decade') === 'qi_refining_wood_decade'`; `'ore'` variant; assert existing producer outputs are unchanged (materials list snapshot or id-membership test).
- [ ] **Step 3: Implement + migrate call sites; `npm run type-check` + `npx vitest run src/core src/data src/components`.**
- [ ] **Step 4: Commit** `refactor(profession): single material-id constructor`

### Task 33: `MaterialBag`/`PillBag` readonly stack snapshots

**Files:**
- Modify: `game/src/core/material/MaterialBag.ts` — `get()` returns `Readonly<MaterialStack> | undefined`; `getAll()` returns `Readonly<MaterialStack>[]` built as `{ ...stack }` copies (shallow is enough — `amount` is a number, `material` is shared-by-design template data).
- Modify: `game/src/core/pill/PillBag.ts` — same for `PillStack`.
- Modify: `MaterialBag.test.ts`/`PillBagSection.test.ts` (or a new colocated test) — caller mutation isolation.

**Verification already done (re-check at execution):** the only `materialBag.get(` production caller reads `.material` (`GameManagerCompanionOps.ts:89`); `getAll()` consumers only read (`MaterialBagSection.vue:211`, `PillBagSection.vue:257`, `BagGrid.vue`, `CompanionPanel.vue:227`, `LoreCodex.vue:24`). No caller assigns `stack.amount` — confirmed by `grep "\.amount =" src` (only `CombatSystem.ts:404` externalWard, unrelated).

- [ ] **Step 1: Failing tests** — `const s = bag.get(id)!; (s as { amount: number }).amount = 0;` then `bag.getAmount(id)` is unchanged; same for `getAll()` result mutation.
- [ ] **Step 2: Run — FAIL (live references today).**
- [ ] **Step 3: Implement** the readonly return types + copies; fix any caller type friction (none expected — all reads).
- [ ] **Step 4: PASS; `npm run type-check` + `npx vitest run src/core src/components`.**
- [ ] **Step 5: Commit** `fix(inventory): return readonly snapshots from bag stack accessors`

### Task 34: Shared cultivation-insight accrual

**Files:**
- Modify: `game/src/stores/player.ts` — the two identical threshold loops: online in `cultivate()` (`~:199-213`) and offline in `restoreFromSave` (`~:452-466`).
- Modify: create the shared helper next to the talent rule it belongs to — `getInsightPerCultivation` lives in the talent module (find it via `grep -rn "getInsightPerCultivation" src/core/talent`); add `accrueCultivationInsight(player: PlayerData, gained: number): void` beside it or in a small `core/cultivation` helper, preserving exact semantics:

```ts
export function accrueCultivationInsight(player: PlayerData, gained: number): void {
  const threshold = getInsightPerCultivation(player.selectedTalentIds)
  if (threshold === undefined || threshold <= 0 || gained <= 0) return
  player.cultivationInsightAccumulator += gained
  while (player.cultivationInsightAccumulator >= threshold) {
    player.cultivationInsightAccumulator -= threshold
    player.skillInsight += 1
    player.totalSkillInsightGained += 1
  }
}
```

- [ ] **Step 1: Failing/passing parity tests** — below-threshold (no insight, accumulator keeps remainder), exact-threshold, multi-threshold (2.5× threshold → +2 insight, remainder kept), threshold 0/undefined no-ops, and an online+offline parity case (same gained through both paths → identical `skillInsight`/`accumulator`).
- [ ] **Step 2: Implement the helper; both call sites delegate.**
- [ ] **Step 3: `npm run type-check` + `npx vitest run src/stores src/core/talent src/core/cultivation`.**
- [ ] **Step 4: Commit** `refactor(insight): single cultivation-insight accrual helper`

### Task 35: `useTribulation` → `getNextRealm`

**Files:**
- Modify: `game/src/composables/useTribulation.ts:24-28,53` — replace `resolveNextBreakthroughRealm` with `getNextRealm(player.realmId)?.id ?? null` (`core/realm/realmSystem.ts:13`); delete the local function.
- Modify: `useTribulation.artifact.test.ts` or a small new test for the mapping.

**Safety (verified):** `canTriggerBreakthrough` (`GameManagerRealmAdvanceOps.ts:404-409`) returns true only for `mortal`/`qi_refining`, so the previously-differing `foundation_establishment → golden_core` arm is unreachable through this flow — the swap is behavior-identical at every reachable input.

- [ ] **Step 1: Test the mapping** — `triggerBreakthroughAction` target resolution: mortal→`qi_refining`, qi_refining→`foundation_establishment` (mock `canTriggerBreakthrough` true for those realms per the real gate), foundation_establishment→`null`/rejected by `canTriggerBreakthrough` false.
- [ ] **Step 2: Implement; `npm run type-check` + `npx vitest run src/composables`.**
- [ ] **Step 3: Commit** `refactor(tribulation): use getNextRealm for breakthrough target`

### Task 36: `useBuildingHeaderState` consumes a `buildingOps` upgrade quote

**Files:**
- Modify: `game/src/core/game/GameManagerBuildingOps.ts` — add `quoteBuildingUpgrade(instanceId: string)` mirroring `quoteProductionUpgrade` (`:314`), delegating to the same rules `BuildingSystem.upgrade` enforces (`BuildingSystem.ts:190-217`): returns `{ template, instance, hasNextLevel, meetsRealmRequirement, requiredRealmId, nextUpgradeCost, canAfford } | null`. Compute inside ops/system — one owner for `upgradeCost[level] ?? []`, `level < maxLevel`, `getRealmTier(realmId) >= level + 1`, and materialBag affordability.
- Modify: `game/src/composables/useBuildingHeaderState.ts:37-62` — `nextUpgradeCost`/`canAffordUpgrade`/`hasNextLevel`/`meetsRealmRequirement`/`requiredRealmName` all derive from the quote; the composable keeps label formatting only. `upgrade()` (`:76-84`) still calls `buildingOps.upgradeBuilding` (authoritative re-check — UI quote is display-only).

- [ ] **Step 1: Test** — `quoteBuildingUpgrade` unit test: capped level → `hasNextLevel:false`; realm-gated next level → `meetsRealmRequirement:false`; insufficient materials → `canAfford:false`; happy path returns the exact `template.upgradeCost[level]` entry. Plus a composable-level assertion that header state mirrors the quote (no independent formula).
- [ ] **Step 2: Implement; `npm run type-check` + `npx vitest run src/core/game src/composables src/components`.**
- [ ] **Step 3: Commit** `refactor(building): header state consumes buildingOps upgrade quote`

### Task 37: `useEquipmentTooltip` — require the quote, delete the fallback formula

**Files:**
- Modify: `game/src/composables/useEquipmentTooltip.ts:99-111` — `mainStatRangeQuote` param becomes required (`mainStatRangeQuote: { min: number; max: number }`); delete the `?? (() => {...})()` fallback that re-implements `EquipmentSystem.quoteMainStatRange` (and the now-unused `getGlobalCultivationLevel`/`realmFromGrade`/`MAIN_STAT_REALM_SCALE`/`ITEM_QUALITY_IMPLICIT_MULTIPLIER` imports). Also make `EquipmentCompareContext.mainStatRangeQuote` (`:76`) required — `:273` passes `compare.mainStatRangeQuote` into the now-required param and type-check will force this anyway; state it so it isn't missed.
- Modify: `game/src/composables/useEquipmentTooltip.test.ts` — pass an explicit quote where the test relied on the fallback.

**Verified:** all four production callers already pass `quoteMainStatRange(...)` — `EquipmentBagSection.vue:154`, `DissolveTab.vue:154`, `useEquippedRows.ts:107`, `EquipmentPaperdoll.vue:138`. If a caller appears that lacks the quote, that call site must obtain it from `equipmentSystem.quoteMainStatRange` — never re-derive.

- [ ] **Step 1: Grep-verify all callers pass the param** — `grep -rn "buildEquipmentTooltip(" src | grep -v test` → four sites, all with the quote arg.
- [ ] **Step 2: Make the param required + delete the fallback; `npm run type-check` + `npx vitest run src/composables`.**
- [ ] **Step 3: Commit** `refactor(tooltip): require equipment main-stat quote, drop fallback formula`

### Task 38: `CharacterCreationScreen` budget constant

**Files:**
- Modify: `game/src/components/onboarding/CharacterCreationScreen.vue:37` — `5 - pointsSpent.value` → `CHARACTER_CREATION_ATTRIBUTE_POINTS - pointsSpent.value` (import from `src/services/character/CharacterCreationService.ts:3` — the same constant the creation service validates against at `:53`).
- Modify: the character-creation test — assert remaining points derive from the shared constant (e.g. spend 1 → `CHARACTER_CREATION_ATTRIBUTE_POINTS - 1` left; the `pointsLeft !== 0` finish gate at `:126` then tracks the constant automatically).

- [ ] **Step 1: Test adjustment; implement; `npm run type-check` + `npx vitest run src/components src/services/character`.**
- [ ] **Step 2: Commit** `refactor(onboarding): use CHARACTER_CREATION_ATTRIBUTE_POINTS for budget`

### Task 39: `tu_linh_tran` domain getter

**Files:**
- Modify: `game/src/core/economy/TuLinhTranBalance.ts` — add the authoritative read:

```ts
export function getActiveCultivationSpeedPercent(
  effects: readonly PersistentTimedEffect[],
  nowMs: number,
): number {
  return effects
    .filter((e) => e.effectGroup === TU_LINH_TRAN_EFFECT_GROUP && e.expiresAtMs > nowMs)
    .reduce((sum, e) => sum + (e.cultivationSpeedPercent ?? 0), 0)
}
```

- Modify: `game/src/stores/player.ts:174-183` — replace the inline filter/sum with `getActiveCultivationSpeedPercent(this.persistentTimedEffects, Date.now())`.

**Semantics note:** the old code summed `cultivationSpeedPercent` across *all* active effects without a group check; only `tu_linh_tran` writes that field (`GameManagerPersistentEffectOps.ts:385`), so the group-filtered getter is equivalent today and is the stronger invariant (matches `activateTuLinhTran`'s group-stack accounting at `:360-362`).

- [ ] **Step 1: Test** — `getActiveCultivationSpeedPercent`: expired effect excluded; effect in another group carrying a stray `cultivationSpeedPercent` excluded; two stacked group effects sum. Plus the existing `player.cultivationSpeed.test.ts` must stay green (pin the percent applied to `cultivationPerSecond`).
- [ ] **Step 2: Implement; `npm run type-check` + `npx vitest run src/stores src/core/economy src/core/game`.**
- [ ] **Step 3: Commit** `refactor(tu-linh-tran): domain-owned active cultivation-speed getter`

### Task 40: Remove the `huy_quyen` double backfill in `App.vue`

**Files:**
- Modify: `game/src/App.vue:552-563` — the loop over `['linh_bao', 'huy_quyen']` (`:552-556`) already grants `huy_quyen`; the block at `:558-563` grants it a second time (no-op via `has()` guard, but duplicated intent). Delete the second block + its comment.

- [ ] **Step 1: Test** — restore-path idempotency: run `onRestoreOk` twice against a save missing starter skills → `huy_quyen` learned exactly once, `learnSkill` not re-invoked for it (spy or `skillManager.has` + call-count assertion in the existing App boot/restore test file).
- [ ] **Step 2: Delete the duplicate block; `npm run type-check` + `npx vitest run src/App* src/composables`.**
- [ ] **Step 3: Commit** `chore(boot): remove duplicated huy_quyen starter backfill`

---

## Mission G done-criteria

- **Dormant M13 cluster removed in stages:** `SkillTriggerRunner`, `SkillEffectSystem`, `SkillActionRegistry` runtime, the `ActionImpactSystem` class + batch API, dead `ActionTargetingSystem` helpers, unused `Battle`/`BattleEnemy` fields, `ArtifactDropBalance`, `CombatSystem.fireKillTriggers`/`killIfDead` 3rd arg/optional ctor deps — all gone with their tests adjusted to surviving contracts. Retained and verified live: `SkillAction`/`TriggerBinding`/`SkillEffect` types, `ActionDamageInfo`/`scaleActionDamage`/`HitResolveOptions`/`ScheduledBasicImpact`, `areaFor`, `selectRankedTarget`, `Battle` (parked), `ArtifactSystem`/`ArtifactRuntime` (parked), `getArtifactCycleSeconds`.
- **Legacy bridges deleted, not migrated:** `statKeyMigration` gone; validation/restore reject or drop legacy stat keys; `pham_nhan` key removed; `Buff.ts` shim gone; unreachable realm-formula branches + dead `RealmData` fields removed; `hoi_xuan_dan` verified rejection-only.
- **No unreachable UI/state ships:** MainMenu overlay chain, `vue-router`, `player.load()`, `markRealmEnhancementUnlocked`/`unlockedRealmEnhancements`, `isCultivating`, `pendingEquipTarget`, `beginTribulation`, `resolveSpriteBodyAnchor`, `spiritStoneIdForRealm`, `filterNguHanhElements`, Phù/Trận socket fields — all removed or (for `combatOrigin`) verified live and kept.
- **Artifact combat advertising removed** while parked runtime stays: HUD slot chain deleted; milestone tooltips no longer advertise combat effects; artifact progression UI untouched.
- **Type surface clean:** no production `any` or unjustified `as never`/double-cast at the listed sites; `__tutienPhaserGame` declared globally.
- **Duplicated rules have single owners:** rank colors, node max level, realm order, profession material ids, bag snapshot access, insight accrual, breakthrough target, building quote, tooltip quote, creation budget, `tu_linh_tran` read, `huy_quyen` backfill.
- **Floor-8 beetle fixed;** verified-intentional data (lore materials, `body_integration` tier) documented.
- **Verification:** `npm run type-check` + `npx vitest run` green (full verification incl. `npm run build` after Task 21's dep change); P4 adversarial-QA quick on the aggregate diff; P5 three-lens review round before completion.

## Known risks / watch-items for the reviewer

- `Battle.ts` trimming touches parked test fixtures — if the artifact reimagine wants those fields back they are trivially restorable from git history; the trim is still the honest current contract.
- Removing `migrateStatModifiers` also removes the `domain` backfill (QA-2026-09-14-001). Legacy saves carrying domain-less gated modifiers will have them dropped by `applyDomainGate` (production path) rather than backfilled — intended under the dev-stage rule; the rewritten qa test pins the drop.
- `ESSENCE_REALM_ORDER` unification changes essence pricing only for realms above beta scope; pinned by test.
- `getCultivationDurationSeconds` deletion assumes the fresh grep still shows no production callers — re-check before removing.

## Deferred / out of scope (recorded, not lost)

- **Test-support files under `src/`** (`battleLootTestSetup.ts`, `EquipmentInstance.fixture.ts`, `combatTestHarness.ts` — audit T7-67 second half): the spec suggests moving them under `tests/` or guarding them with an arch rule. **Deferred** — moving them forces import-path churn across ~dozen test files for no behavioral gain; the honest fix is an architecture guard ("no `*.fixture.ts`/`testSetup` production imports"), which belongs in Mission F's tsconfig/guard scope. Recorded here so it is not lost; if the reviewer wants it in G, add a task creating the guard rather than moving the files.
