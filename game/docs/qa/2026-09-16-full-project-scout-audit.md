# Full-Project Scout Audit — 2026-09-16

Repository: `hnkm080596-svg/tutienidle` · Root: `game/`
Audit mode: **read-only** — no source, test, or config files were modified.
Method: ~35 parallel read-only scout agents across `src/**`, `electron/**`, `supabase/**`, tests, and build config — every finding below was verified against real callers/data/tests before inclusion. A second independent agent ran a persistence/lifecycle-focused review on the same tree; its findings were re-verified by hand and merged here. Findings marked `(both)` were found independently by both audits.

## Executive summary

The codebase is in better shape than its size suggests: zero `any`/`@ts-*` in `src/core`, dense registry/invariant tests, live architecture guards, no TODO/console.log/debugger leftovers. The worst defects are not in individual domain algorithms — they cluster at three boundaries:

1. **Persistence boundary** — shallow save validation, fields dropped by the serializer, unguarded storage writes, changelog/schema/serializer drift.
2. **Lifecycle boundary** — battle reset paths, auto-repeat, quit-flush, scene re-attach, detached subscriptions.
3. **Authority boundary** — worker allocation split across UI/engine, fragmented RNG, cultivation-path branches accumulating in battle orchestration, UI reimplementing domain rules.

Verdict: **harden boundaries before expanding features.** No core rewrite needed.

## Severity key

- **T1** — data loss, economy corruption, session soft-lock
- **T2** — persistence-boundary structural debt
- **T3** — broken/incorrect gameplay
- **T4** — UI staleness/correctness
- **T5** — architecture/authority debt
- **T6** — lifecycle/presentation
- **T7** — test/tooling
- **T8** — dead code/cleanup

---

## T1 — Data loss / economy corruption / soft-locks

| # | Finding | Evidence |
|---|---------|----------|
| 1 | **`assignedWorkers` never serialized** — manual production worker allocation silently lost on save/reload. Changelog claims the field exists (three-way drift: changelog ≠ schema ≠ serializer). | `SaveSystem.ts:366-376` omits it; `saveTypes.ts:266-279` `ProductionSiteStateSave` lacks it; `saveVersion.ts:13` documents it |
| 2 | **Electron quit-save always reports success** — `player.save()` result never inspected; `notifyFlushComplete()` fires in `finally` on `status:'failed'` → app closes with unsaved progress. | `useElectronBridge.ts:71-79`, `electron/main.ts:130-157` |
| 3 | **Decompose `nextCycleAt` NaN → one cycle per game tick forever** — validator only checks `settings.workers`; `Math.max(0, Math.floor(source.nextCycleAt ?? 0))` propagates NaN from a crafted save (`"nextCycleAt":"bad"`); `nowMs < NaN` is false → `runOneCycle()` every tick. | `saveShapeValidation.ts:891-903`, `DecomposeSystem.ts:130,194` |
| 4 | **Defeat during auto-repeat leaks `StageManager.active`** — `stopRepeat()` skipped on defeat → every future `StageManager.start()` no-ops for the session; `abandonBattle` can't recover. | `GameManagerBattleRewardOps.ts:135-137` |
| 5 | **Victory/defeat refight soft-lock** — `startBattle()`/`refight()` return a Promise used as sync truthy → failed starts never roll back; defeat retry permanently disabled. | `CombatVictoryPanel.vue:93-111`, `CombatDefeatPanel.vue:85,98`, `useBattleActions.ts` |
| 6 | **Auto-farm can never be stopped** — `stopAutoFarm` has zero production callers; holds the single stage slot forever and keeps paying after reload. | `GameManagerAutoFarmOps.ts:134,159-168` |
| 7 | **`combatInputMode` not persisted** — `$subscribe` dirty-check compares only `battleRunMode` but persists both fields; a combatInputMode-only change is skipped. (both) | `App.vue:97-108` |
| 8 | **New character: runtime ticks before first durable save** — `bootGame(true)` starts the tick loop before `cloudSaveCoordinator.save`; on failure `bootFlow.fail()` shows error but nothing stops the running runtime. | `App.vue:647-675` |
| 9 | **Recovery storage ops unguarded** — `importSaveRaw` final writes, `backupCurrentSave`, `restoreBackup`, parts of `deleteSave` use raw `localStorage.setItem` outside the typed-result path → uncaught QuotaExceededError on the recovery screen itself. (both) | `SaveSystem.ts:632-634` |
| 10 | **Material-type pills silently destroyed** — `truc_co_dan` / breakthrough tokens route through the drink path, pass empty-effects validation, get consumed with no effect. | `PillBagSection.vue:302`, `GameManagerPillOps.ts:93-115`, `pills.ts:69-92` |
| 11 | **Quest item cost debited before reward grant** — failed reward delivery consumes materials, quest stays unclaimed → repeated charging. | `QuestSystem.ts:153-215`, `TuLinhTranBalance.ts` |
| 12 | **Auto-farm `lastCheckedMs` double-pay** — a small-positive corrupt timestamp survives offline settle then earns a second capped online window. | `GameManagerAutoFarmOps.ts:134,159-168` |

## T2 — Persistence boundary debt (systemic)

| # | Finding | Evidence |
|---|---------|----------|
| 13 | **Save validator is shallow for most aggregates** — `productionSites`, `alchemyJobs` only `optionalArray`; `buildings`, `quests`, `talismans`, `formations` only "is array/object". Element schemas unvalidated → malformed current-version saves pass the gate and crash/corrupt runtime. Concrete witnesses: quest `active:"x"` → `TypeError` at `QuestManager.ts:37`; building `level:"bad"` → NaN rates / `upgradeCost[level] ?? []` free upgrade at `BuildingSystem.ts:204,259`; decompose `nextCycleAt` (T1-3). | `saveShapeValidation.ts:874-903`, `QuestManager.ts:111-118`, `BuildingSystem.ts:192-259` |
| 14 | **Save changelog is documentation, not contract** — v55 comment claims `assignedWorkers` while schema/serializer lack it; no round-trip conformance test catches schema drift. | `saveVersion.ts:13` vs `saveTypes.ts:266` |
| 15 | **`restoreFromSave` leaks foreign/legacy keys** — spread restore copies `spiritStone`, `refinementPoints`, etc. onto `$state` and re-persists them forever. | `player.ts:355-395` |

## T3 — Broken gameplay

| # | Finding | Evidence |
|---|---------|----------|
| 16 | **Kill quests never complete** — spawned `enemy.id` is `template_uuid` instance id; quests and hidden-beast reset compare template ids (`wild_wolf`, `huyet_mong`). | `BattleLootSystem.ts:371,393`, `EnemySystem.ts:20`, `QuestSystem.ts:272`, `HiddenBeastSystem.ts:40` |
| 17 | **Production dies above Trúc Cơ** — `collectionRealmId` validated against a 3-realm territory; manual start, auto-restart, and offline settle reject at `golden_core+`; worker lanes keep running on `-1` tier-index fallback. | `ProductionSystem.ts:179`, `ProductionOffline.ts:106,121`, `ProductionCatalog.ts:23`, `GameManagerBuildingOps.ts:297` |
| 18 | **Worker lanes may overproduce** — docs say slot 1 = manual `activeCycle`, workers = slots 2+; online and offline pass **all** active slots to lane advancement → a 1-worker site may run 2 producers. Needs a contract decision. | `ProductionSystem.ts:392`, `ProductionOffline.ts:224`, `ProductionTypes.ts:80` |
| 19 | **Skill semantic inversions** — `thanh_luy` empowered ult buffs `target` (the enemy); `thach_hoa` on-hit proc attached to the debuffed enemy (enemy stuns the player); `elementApplicationPercent` authored through nodes but never applied in turn combat; `ailmentStackBonus` treats omitted stacks as 0 not 1. | `PhapTuEmpoweredUlts.ts`, `ThuanHeBuffs.ts`, `PhapTuRoutes.ts`, `SkillToTurnSkillConverter.ts` |
| 20 | **Artifact combat path fully dormant** — `artifactRuntime` never instantiated; players spend Đoán Bảo Thạch on a placebo while UI advertises 15 combat milestones that can't fire. | `ArtifactSystem.ts`, `ArtifactRuntime.ts`, `useArtifactCombatPresentation.ts`, `GameManagerTurnBattleOps.ts` |
| 21 | **Tribulation HP regen documented, never applied** — tick only mirrors snapshot HP + mind heal. | `TribulationDirector.ts:280-284` |
| 22 | **Manual mode discards queued reactive-turn choices; actor killed mid-impact keeps resolving the action.** | `TurnBattleSystem.ts` |
| 23 | **Tribulation overlay freezes at first render** — `getState()` returns a same-ref mutated object; computed chain never re-fires → HP bar/countdown/strike counter stuck. | `TribulationSceneOverlay.vue:11-23`, `TribulationDirector.ts:634-642` |
| 24 | **Supabase character creation 100% broken** — SQL `CHECK(cardinality=3)` vs client `CHARACTER_CREATION_TALENT_COUNT=1`. Auth is write-only (nothing reads `characters`/`character_saves`); refresh token stored but never used; fetches have no timeout. | `202608240001_online_auth_character.sql:54,150`, `CharacterCreationService.ts:8`, `SupabaseSession.ts`, `SupabaseHttp.ts` |
| 25 | **Dead-end content reachable by players** — `alchemy_thong_mach_dan` craftable (500 Linh Thạch + mats) but `MeridianSystem.investThongMachDan` is parked; `great_dao_seed` gated on `requiresModifier:'boss'` but `bandit` is never a bossEnemyId; `heaven`/`great_dao` breakthrough grades + `phap_tu` special/ultimate nodes gated on unreachable `golden_core`. | `alchemyRecipes.ts:39-50`, `MortalEnemies.ts:94`, `StageWaveSystem.ts:156-173`, `BreakthroughGrades.ts:42-44`, `PhapTuNodes.builders.ts:182-185`, `GameManagerRealmAdvanceOps.ts:429-434` |
| 26 | **Offline modal reports theoretical, not actual, cultivation** — restore returns pre-cap number; post-cap grant is smaller. | `player.ts:335,419-452`, `OfflineProgressSystem.ts` |
| 27 | **Special/ultimate skill conversion silently drops mechanics** — wood special loses poison-spread; `add_stack refresh:true` dropped; `scope`/`refresh` not even in the unsupported-field lists → unreportable. | `GameManager.ts:922`, `SkillToTurnSkillConverter.ts` |
| 28 | **Tu Linh Trần conversion formula collapses** — `100^(tier-4)` exponent contradicts the vendor tier-equivalence table; saturates at 1 high-tier stone. | `TuLinhTranBalance.ts:26-27` |

## T4 — UI staleness / correctness

| # | Finding | Evidence |
|---|---------|----------|
| 29 | **`workerMode` local ref contradicts persisted manual assignments** — resets to 'auto' on mount while `assignedWorkers` still governs. (both) | `ProductionPanel.vue:216` |
| 30 | **Worker capacity UI ≠ engine capacity** — panel shows `autoWorkerCapacity`; engine subtracts decompose workers; sliders can request full pool, allocator silently truncates. | `ProductionPanel.vue`, `GameManagerTickOps.ts:154-159` |
| 31 | **`BuildingConstructionGate.canBuild` permanently stale** — no `stateVersion` read on non-reactive state. | `BuildingConstructionGate.vue:55-63` |
| 32 | **Alchemy craft failures silent; button never disabled** — `alchemy.reason.*` keys exist, never shown. | `AlchemyView.vue:302` |
| 33 | **Wash preview hides rolled lines; can roll 0 affixes ignoring min range; ticket lifecycle asymmetric with refine (clears on success vs any failure); dead "Giữ" button; ticket not cleared on unmount.** | `WashTab.vue:188-202,240`, `EquipmentWash.ts:110-114,359`, `EquipmentRefine.ts:258` |
| 34 | **Tooltip enhance cap "+45/10"** — renders stale `template.maxEnhanceLevel`; real cap `MAX_SLOT_ENHANCE_LEVEL=100`. | `useEquipmentTooltip.ts:207` |
| 35 | **`WorldAnnouncementOverlay` above modal layer** — swallows dialog clicks for 5s; no focus/Escape/a11y semantics; timer not cleaned on unmount. | `WorldAnnouncementOverlay.vue:58`, `OverlayLayers.ts:33` |
| 36 | **Raw internal IDs shown to players** — `ho_ly_tinh_basic`, `hoa_cau_thuat` in companion skills and battle log. | `CompanionPanel.vue:422`, `BattleLogPanel.vue:40-54` |
| 37 | **Mojibake in skill-level notifications** — literal `d?t c?p` strings. | `GameManager.ts:260-261` |
| 38 | **Stage perfect-farm failure closes panel unconditionally; mode stays armed on stage change.** | `StageSelectPanel.vue:197-201` |
| 39 | **`phap_tu_an` falls through to mortal combat art** — only `phap_tu`/`kiem_tu` handled. | `PlayerVisualForm.ts:22-31` |
| 40 | **Broad i18n violations** — hardcoded Vietnamese in `AlchemyView` (~11), `PillBagSection` (~15), `BuildingConstructionGate` (no `useI18n` at all), `SaveIncompatibleScreen`, `ErrorScreen`, `TutorialOverlay`, `ConfirmModal`, `ActionFeedbackLog`, artifact/scripture/skill-loadout dirs, several services returning display strings. | various |

## T5 — Architecture / authority debt

| # | Finding | Evidence |
|---|---------|----------|
| 41 | **Battle lifecycle has no single owner** — `startBattle`/`startBattleWithPlayer`/`startStage`/`restartTurnBattleCycle` each reset different subsets (loot, stacks, survive, rewards, path resources, presentation, boundary queue). Adding a feature means remembering every entrance path. Needs `beginBattleCycle(policy)` authority. | `GameManagerTurnBattleOps.ts`, `GameManagerBattleRewardOps.ts` |
| 42 | **Auto-repeat carry/reset contract undefined** — tests call it "same battle", code builds a "fresh TurnBattle"; no policy for HP/MP/Ward/buffs/cooldowns/gauge/survive/path-runtime/proc counters. Must be decided before fixing T1-4 correctly. | repeat path in `GameManagerBattleRewardOps` |
| 43 | **Combat RNG fragmented** — `TurnBattleSystem` takes injectable RNG but hit/block/crit/ignore-resist/enemy-placement still use global `Math.random()` → no deterministic replay. | turn battle + orchestration files |
| 44 | **Battle orchestration accumulates path branches** — `GameManagerTurnBattleOps` knows kiem_tu route providers, phap_tu kit markers, the_tu survive sources. Needs a `CultivationPathRuntime` interface. | `GameManagerTurnBattleOps.ts` |
| 45 | **Damage-scaling formula forked and already diverged** — `SkillActionRegistry.ts:43-58` vs `SkillEffectSystem.ts:112-130` (`hitCount` branch only on legacy side). | both files |
| 46 | **Tick cadence drift** — canonical `TICK_INTERVAL_MS=100` (`SpeedSettings.ts:14`, zero importers) vs live local `1000` (`useAppLifecycle.ts:120,172`). | both files |
| 47 | **Domain rules reimplemented in UI/store** — decompose estimate (hardcoded base 1.0, ignores grade/consumption), insight settle loop ×2 (online+offline), worker-capacity split ×2 (tick+restore), tu_linh_tran expiry/sum in store, `useTribulation` hand-coded realm map, `App.vue` writes `player.baseStats` at creation, `useBuildingHeaderState` upgrade eligibility, equipment tooltip fallback formula. | `DecomposeTab.vue:56-67`, `player.ts:199-213,425-439`, `GameManagerTickOps.ts:154-159` + `GameManagerSaveRestore.ts:388`, `player.ts:177-183`, `useTribulation.ts:24-28`, `App.vue:648-655`, `useBuildingHeaderState.ts:42-57`, `useEquipmentTooltip.ts:104-111` |
| 48 | **Offline summary has two owners** — `bootGame` shows it and App's restore callback can show it again. | `useAppLifecycle.ts`, `App.vue` |
| 49 | **EventBus fragility** — one throwing listener aborts the chain and propagates through core tick emitters; live-Set iteration invokes handlers added mid-dispatch. | `EventBus.ts:44-49` |
| 50 | **`<realm>_<wood|ore>_<age>` material-id convention reimplemented ~6 sites** including cross-layer in `AlchemyView.vue:154`; no shared constructor. | `ProductionCatalog.ts`, `AlchemySystem.ts:176`, `EquipmentOperationCostCatalog.ts:70`, `buildings.ts`, `DecomposeSystem.ts:329` |

## T6 — Lifecycle / presentation

| # | Finding | Evidence |
|---|---------|----------|
| 51 | **Detached `$subscribe` disposer dropped** — HMR stacks persistence subscribers. | `App.vue:97-108` (disposer not captured; `onUnmounted` never unsubscribes) |
| 52 | **Electron quit-flush re-entrant** — second `close` during the 2s window double-fires renderer save and another close (in-flight vs completed not distinguished). | `electron/main.ts:110,128-157` |
| 53 | **MainScene cultivation pose lost on re-attach** — edge-triggered event missed while scene dormant → player stands all session. | `MainScene.ts:178` |
| 54 | **Tribulation damage numbers never show** — listens for `'damage'` but tribulation emits `entity_vitals_changed`. | `TribulationScene.ts:98,129` |
| 55 | **Preview shadows render above sprites** — preview scene never calls the depth updater. | `TranPhapCombatPreviewScene.ts:251`, `combat-grid-view.ts:484` |
| 56 | **AssetLoader pending Promise can never settle on shutdown** — permanently stalls later batches. | `AssetLoaderScene.ts:55-70` |
| 57 | **`isSameRequest` drops colliding in-flight transitions** — ignores `behindCurtain`, silently drops domain work. | `GamePresentationCoordinator.ts:583` |
| 58 | **VueRouteAdapter phantom mounted routes** — deferred `markRouteMounted` vs sync unmount. | `VueRouteAdapter.ts:193-201` |
| 59 | **Global Tab key hijack outside combat** in combat HUD composable. | combat HUD composables |

## T7 — Test / tooling

| # | Finding | Evidence |
|---|---------|----------|
| 60 | **`tests/lab` + `tests/architecture` belong to no tsconfig** — the guard suite is never type-checked. | `tsconfig.app.json:3`, `tsconfig.node.json:4-12` |
| 61 | **Lab sweeps + gitignored `tests/lab/local/` scratch run inside `npm test`** — assertion-less experiments in the gate. | `vite.config.ts:86`, `.gitignore:42` |
| 62 | **Playwright fixed port + `strictPort:false` + `reuseExistingServer:true`** — can silently test a stale/foreign server. (both) | `playwright.config.ts:57`, `vite.config.ts:23` |
| 63 | **`VITE_PRESENTATION_DEADLINE_SCALE=3` in all e2e** — masks production pacing failures. (both) | `playwright.config.ts:64`, `App.vue:175-179` |
| 64 | **No canonical `verify`/`ci` command** — agents report different evidence sets. | `package.json` |
| 65 | **Vue pinned to `rc` dist-tag + 14 `@vue/*` overrides** — reproducibility rests on lockfile only. | `package.json:32,63-77` |
| 66 | **`.env` not gitignored; `build/icon.ico` missing; `index.html` still `lang=""`/`<title>Vite App</title>`; `set ELECTRON=1` cmd-only syntax; no `supabase/config.toml`; `check-bundle-split` usage-doc bug; orphan `patch-t14.cjs`.** | `.gitignore`, `electron-builder.yml:28`, `index.html:2,7`, `package.json:24-25`, `scripts/` |
| 67 | **Architecture `GATE_KEYS` drifted** (missing `theBarReader`); test fixtures live under `src/` (`battleLootTestSetup.ts`, `EquipmentInstance.fixture.ts`, `combatTestHarness.ts`). | `tests/architecture`, `src/` |
| 68 | **Coverage gaps** — Supabase HTTP/auth/character services, `GameClock`, `GameManagerPersistentEffectOps`, several Phaser combat helpers, Electron failure paths. | various |

## T8 — Dead code / cleanup

| # | Finding | Evidence |
|---|---------|----------|
| 69 | **M13 dormant cluster** (self-tagged, tests-only, kept for contracts): `SkillTriggerRunner`, `SkillEffectSystem`, `SkillActionRegistry` runtime path, `ActionImpactSystem`, `ActionTargetingSystem` helpers, `Battle.ts` types, `createArtifactRuntime`, `ArtifactDropBalance`, `CombatSystem.fireKillTriggers`/`killIfDead` 3rd arg, Phù/Trận socket chain (write-only end-to-end). | `core/skill`, `core/battle`, `core/artifact` |
| 70 | **`as never` contract gaps** — fake `Material` into `MaterialBag.add` (`GameManagerTickOps.ts:276`); unvalidated DOM select → typed union (`DecomposeTab.vue:70,74`); erased emit payload (`ActionImpactSystem.ts:196,207`). Plus only production `any`: `CombatScene.ts:580,587` handler tuples (→ `EventHandler<never>`). | listed files |
| 71 | **`weightedRandom([])` crashes with TypeError** instead of clean failure. | `DropRoll.ts:43` |
| 72 | **Dead UI/state** — inert artifact combat presentation chain, unreachable MainMenu (`setShowMainMenu(true)` zero callers), router installed with `routes:[]` (vue-router = no-op dep), `player.load()`, `markRealmEnhancementUnlocked`, write-only `isCultivating`, `pendingEquipTarget`, `combatOrigin`, `beginTribulation`, `resolveSpriteBodyAnchor` (+test), `spiritStoneIdForRealm`, `filterNguHanhElements`, `Buff.ts` shim. | various |
| 73 | **Dead data** — `foundation_ferocious_metal_beetle_swarm` never spawned (floor-8 `speciesByFloor` likely a typo, `Stages.ts:145`); `broken_foundation_scroll`/`old_jade_slip` have no producer; dead `the_tu`/`pham_nhan` keys in `BASIC_ATTACKS_BY_BUILD`; unreachable legacy realm-formula branches; `body_integration` absent from `REALM_TIERS` while content is authored for it. | `Stages.ts:145`, `materials.ts:104,112`, `TurnBasicAttacks.ts:51-55,74-78`, `realmSystem.ts:51-58,77-83`, `RealmTierMap.ts` |
| 74 | **Duplication** — identical Phaser-hex color tables ×2 in `BattleLootSystem.ts:699-721`; node max-level normalization ×2 vs `getNodeMaxLevel`; `ESSENCE_REALM_ORDER` diverges 3× from `RealmTierMap` on last two realms; starter-skill `huy_quyen` backfill duplicated in restore; character-creation budget `5` duplicated in screen; mutable stack objects exposed by `MaterialBag`/`PillBag`. | listed files |
| 75 | **`NodeSystem` realm prereq silent-pass hazard** — unknown prereq realmId → `getRealmIndex` −1 → gate always passes. | `NodeSystem.ts:49` |

## Verified clean (checked both sides, no defect)

- Zero `any`/`@ts-*` in `src/core`; all 30 `@ts-expect-error` are deliberate test usage.
- Layer guards live: no core→Vue/Pinia/Phaser imports, no `src/game`→Vue imports; `Math.random` confined to `src/game` visual jitter.
- Every data-registry id (skills, buffs, quests, stages, talents, formations, materials, companions, orbs) resolves; no prerequisite cycles; mutex roots and atomic commit paths consistent.
- EquipmentBag auto-dissolve rewards are consumed by all real callers; quest reward/claim has no partial-transaction evidence; CombatScene teardown is symmetric.
- All npm scripts resolve; no unused deps except inert `vue-router`; Phaser chunk split holds via dynamic imports.
- Asset loading verifies failed keys + texture cache; combat clock has stall threshold + re-anchor; alchemy online/offline share domain math.

## Scout coverage notes

~35 of 41 planned scopes completed; the rest were rate-limited and re-scoped into later waves — all major systems were covered at least once. Several parallel waves hit the free-model rate cap and were re-dispatched; reports above are the union of all completed scouts plus the second agent's persistence/lifecycle review (N-01..N-05, F-01..F-10 verified by hand during merge).
