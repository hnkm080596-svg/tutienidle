# BETA SCOPE LOCK v2 Phase-6 — navigation/global-surface prune — audit + plan

Branch `devin/beta-scope-v2-navigation` off `origin/devin/beta-scope-v2` (tip `73853e36` — betaScope.ts + creation contract + skill read-models + stage roster merged). Worktree `.agent-worktrees/beta-scope-v2-navigation`. Read-model/domain work — UI touched only to consume canonical APIs. Draft PR into `devin/beta-scope-v2`.

## TASK CARD (G0)

- **Task / user request**: every domain registry feeding navigation, HUD, notifications, deep-links, and remaining realm-progression seams must fail closed on scope-hidden features (contracts A–E of the phase brief). `hidden_window_opened` (flagged by Phase-4) must stop firing.
- **Assigned worktree / branch**: `/home/ubuntu/repos/tutienidle/.agent-worktrees/beta-scope-v2-navigation`, `devin/beta-scope-v2-navigation`.
- **Requested observable behavior**: wheel ring-2/3 entries for artifact/formation/companion/worker-lodge never render; building hotspots for `chi_hien_quan` never render; deep-link opens of hidden panels/buildings no-op; CurrencyHud companion chips suppressed; RealmPanel ladder stops at Trúc Cơ with no Kim Đan button/teaser; hidden rows (Phạm Cốt, Quán Thể, Nghịch Chu Thiên) never render; daily-reset toast silent; hidden-beast channel + `hidden_window_opened` dead; `betaCompletionFor`/`betaSupportedFor`/`unsupportedReleaseReason` exported for the frontend.
- **Single responsibility / invariant**: "is this surface inside beta scope" is decided ONCE by `betaScope.ts` + `betaScopeSurface.ts` read-models; UI consumes, never rederives.
- **Current owner (path + symbol)**: scattered — `COMMAND_WHEEL_SLOTS.available()` (always-true for shipped slots), `DongFuCommandWheel.renderedSlots`, `HomeBuildingIcons.sceneBuildings`, `openBuilding`, `openStandalonePanel`/`openLeftPanel`, `CurrencyHud.companionChips`, `RealmPanel.realmNodes`/`nextRealmBeyondCeiling`, per-section raw `hiddenPerfection` reads, `HiddenBeastSystem`, `issueCompanionGifts`, daily-reset toast in `GameManagerTickOps`.
- **Target owner**: `game/src/core/betaScopeSurface.ts` (new) — composes `betaScope.ts` verdicts + domain predicates; plus narrow fail-closed early-outs inside hidden-progression chokepoints.
- **Existing primitive/mechanism to reuse**: `isBetaFeature`/`betaSurfaceVisible` (`core/betaScope.ts`), `isRealmAvailable`/`isBeyondReleaseCeiling`/`progressionCeilingRealmId` (`core/realm/ReleasePolicy.ts`), `isRealmTransitionEnabled` (already enforced in `BreakthroughGate`), `canProgressHiddenBody`/`getRealmHiddenState`/`isHiddenBreakthroughEligible` (`core/realm/hidden/HiddenLineage.ts`), `isNghichChuTianRevealed`/`isNghichChuTianEligible` (`core/realm/hidden/NghichChuTian.ts`), `COMMAND_WHEEL_SLOTS` (`data/ui/commandWheelCatalog.ts`), `REALM_PASSIVE_NODES` (`data/realm/RealmPassiveNodes.ts`), `STAGES` (`data/stage/Stages.ts`), `BETA_ENEMY_ROSTER`/`isBetaEquipmentTab` (`core/betaScope.ts`), `getActiveWay` (`core/player/CultivationPathSystem.ts`), `completedStageIds`/`hiddenBeastKills`/`hiddenPerfection`/`companions`/`artifact`/`formationLoadout` (`PlayerData`).
- **Missing capability**: none — every gate exists as a pure predicate or can be expressed as one.
- **Production chain**: `betaScopeSurface.ts` read-models → consumed by stores/composables/components; domain early-outs in hidden chokepoints; `progressionOps` pass-throughs for the player-facing read-models (Phase-3 seam pattern).
- **State**: read-models are pure queries; gates are early-returns on persisted-state writers/readers — no new persisted fields (Q9).
- **Expected files**:
  - NEW `game/src/core/betaScopeSurface.ts` — canonical surface authority.
  - NEW `game/tests/architecture/betaScopeSurface.test.ts` — contract spec test.
  - `core/realm/hidden/HiddenLineage.ts`, `core/realm/hidden/NghichChuTian.ts` — `hiddenContent` early-outs.
  - `core/game/HiddenBeastSystem.ts` — `onEnemyDefeated`→`[]`, `maybeReplaceSpawn`→`undefined` under beta.
  - `core/production/ProductionSystem.ts` — grotto hidden-channel roll early-out (registry empty today; future channels can't leak).
  - `core/companion/CompanionGifts.ts` — `issueCompanionGifts` early-out on `companion`.
  - `core/game/GameManagerTickOps.ts` — daily reset + toast gated on `dailyQuest`.
  - `stores/ui.ts`, `composables/useBuildingNavigation.ts`, `components/layout/GameRoot.vue`, `components/game/DongFuCommandWheel.vue`, `components/game/HomeBuildingIcons.vue`, `components/game/CurrencyHud.vue`, `components/panels/EquipmentHallPanel.vue`, `components/panels/RealmPanel.vue`, `components/panels/realm/BodyRefinementSection.vue`, `components/panels/realm/MeridianSection.vue` — consume canonical APIs only.
  - `core/game/GameManagerProgressionOps.ts` — bind `betaCompletionFor`/`betaSupportedFor`/`unsupportedReleaseReason`/`betaNextRealmSurfaceFor` (Phase-3 facade pattern).
  - NEW `core/game/__fixtures__/betaFeaturesUnlock.ts` + `tests/setup.betaScope.ts` — the BETA_FEATURES counterpart to phase-2's betaWaysUnlock: the global setup starts every suite fully unlocked (pre-beta behavior preserved); lock-asserting suites call `lockBetaFeaturesForTests()`.
  - `tests/architecture/betaScopeLockV2.test.ts`, `tests/architecture/betaScopeSkillDomain.test.ts` — re-pin both allow-lists (skill suite also gains the way-lock it was missing).
  - `components/panels/RealmPanel.test.ts` — the Truc Co 'Kim Dan' CTA expectation becomes the new contract: no button at all.
  - this doc + the P4 quick QA report under `game/docs/qa/`.
- **Explicit non-goals**: no quest-set/content edits (Phase-5 owns `isBetaQuestEnabled` consumers, quest defs, drop tables); no companion/formation/artifact logic changes beyond the fail-closed gates listed; no visual design; no save migration; no deletion of dormant systems; no new Vue components.
- **Roadmap phase**: BETA SCOPE LOCK v2 phase-6 (navigation/global-surface).
- **Tests/gates**: P3 quick, P18 OCR delegate, P4 `tutienidle-adversarial-qa` quick, ≥3 sequential P5 passes.
- **Stop condition**: contracts A–E green through P3→P5; draft PR up.
- **Unresolved assumptions**: none blocking.

## Audit

**A. Realm/body progression seams (contract A).** Playable window authority = `ReleasePolicy.ts` (`progressionCeilingRealmId = 'foundation_establishment'`; `isRealmTransitionEnabled` already enforced by `BreakthroughGate.canTriggerBreakthrough` — the post-ceiling tribulation is already dead). What still leaks:

- `HiddenLineage.canProgressHiddenBody` — strict-prefix gate with NO beta check; a beta mortal can still be discovered into `pham_cot`, divert meridian gains into Quán Thể, open Nghịch, and ride the ancient-beast trial. Add `hiddenContent` early-out → covers QuanTheDiversion (`isQuanTheActionable`), AncientBeastTrial (`isAncientBeastTrialEligible`), `discoverHiddenRealm`, `completeHiddenBody`, `isNghichChuTianEligible`, `maybeDiscoverNghichChuTian`.
- `HiddenLineage.isHiddenBreakthroughEligible`/`resolveBreakthroughType` — lineage-only check NOT routed through `canProgressHiddenBody`; gates hidden (Dai Dao) breakthroughs in `GameManagerRealmAdvanceOps.commitBreakthrough` + `TribulationDirector`. Add `hiddenContent` early-out.
- `NghichChuTian.isNghichChuTianRevealed` — legacy discovered record bypasses eligibility (`record?.discovered && !frozen`); a legacy save still reveals under beta. Add `hiddenContent` early-out. `ZhouTianSection` then needs no edit — its Nghịch block dies with the reveal gate.
- `HiddenBeastSystem` — `onEnemyDefeated` writes `hiddenBeastKills` counters and returns opened channels → `BattleLootSystem` emits `hidden_window_opened` (the Phase-4-flagged audio cue, `progress.hidden_open`); `maybeReplaceSpawn` substitutes `huyet_mong` into qi_refining stages at 1000 kills/5%. Gate both methods → counters dormant, no emit, no substitution.
- `ProductionSystem.rollHiddenChannelRewards` — grotto channel emission; registry is empty today but the seam is authored — early-out for fail-closed completeness.
- RealmPanel — `realmNodes` = mortal rung + ALL `REALM_PASSIVE_NODES` including `comingSoon` Kim Đan→Độ Kiếp nodes (post-ceiling teasers); `majorBreakthroughLabel` renders "Kim Đan" at Trúc Cơ on a disabled button + `ceilingNote` names Kim Đan. Contract A requires post-Trúc-Cơ progression absent from beta read-models → canonical `betaRealmLadderNodes()` (mortal rung + in-window passives only) and `betaNextRealmSurfaceFor(player)` (null at/above ceiling → no CTA, no note).
- Hidden rows in RealmPanel sections read `player.hiddenPerfection?.realms[realmId]` DIRECTLY (`BodyRefinementSection.hiddenMortalRow`, `MeridianSection.hiddenQuanThe`) — route through `betaHiddenRealmRecordFor(player, realmId)`.
- `getRealmHiddenState`/`getEffectiveMainStatCap` raw reads stay ungated — record reads preserve legacy-save identity (no corruption); the unsupported flag marks them.

**B. Navigation/wheel/hotspots (contract B).** `COMMAND_WHEEL_SLOTS` is the nav registry (14 slots): hide `phap_bao` (artifact), `formation_slot` (formation), `companion_roster` (companion), `chi_hien_quan` (manualWorkforce). `talisman_slot` already `NEVER_AVAILABLE`. `quest` slot stays — quest panel is Phase-5's content gate. `DongFuCommandWheel.renderedSlots` → `betaWheelSlots().filter(s => s.available())`.

- `RING_3_BUILDING_IDS` is shared with the hotspot layer; `HomeBuildingIcons.sceneBuildings` renders every `DONG_FU_BUILDING_ART` × definition — filter by `isBetaBuildingSurface` (allow-list: teleport_array, pill_room, gathering_outpost, equipment_hall, vendor; `chi_hien_quan` excluded → no hotspot, no popover).
- `openBuilding(buildingId)` (`useBuildingNavigation`) is THE deep-link funnel (hotspots, wheel ring-3, popover "open" button all route here) — early-return on non-beta surface = fail closed for every caller at once.
- `vendor` (Ký Bảo Các) is hotspot-only (not in ring 3) — beta-visible (sell sink for gather outputs).

**C. HUD/currencies/notifications (contract C).**

- `CurrencyHud.companionChips` gated only by `isCompanionDomainUnlocked(realmId)` — add `isBetaFeature('companion')` → chips gone at any realm. `duyenPhan` counter inside chips dies with them.
- `EquipmentHallPanel` renders all 5 TABS hardcoded — filter via `isBetaEquipmentTab` → enhance/dissolve only (wash/refine/decompose hidden; ops unreachable).
- `hidden_window_opened` emit — dead via HiddenBeastSystem gate (above).
- `GameManagerTickOps` daily reset — `checkAndResetDaily` runs every tick and pushes "Nhiệm vụ hằng ngày đã làm mới" toast + rebuilds daily board — gate the whole block on `isBetaFeature('dailyQuest')` (cadence dormant; note for Phase-5: board CONTENT filtering stays theirs).
- `issueCompanionGifts` fires on `realm_entered` (foundation → than_nong) and `stage_completed` (floor_10 → khai_minh) writing `companionGifts` records + toasts — early-out on `companion` covers both call sites.
- Other toast emitters (loot, settle, overflow, equipment ops, companion ops) emit only from beta-live flows — companion/tran_phap/artifact ops are already unreachable once panels can't open.

**D. Panels/deep-links.** `StandalonePanel` union: skill|realm|quan_khi|quest|artifact|tran_phap|companion → allow-list `{skill, realm, quan_khi, quest}` (`quan_khi` is the spell-path ritual — beta live). Gate `ui.openStandalonePanel` + `toggleStandalonePanel` AND the `GameRoot` `mountedStandalone` watcher (covers `useTribulation.ts`'s direct `ui.standalonePanel = ...` assignment bypass). `LeftPanelMode` allow-list drops `worker_lodge` only — gate in `ui.openLeftPanel` (covers wheel, popover, `FunctionOverlayPanel`).

**E. Beta Complete + save safety (contracts D, E).**

- `betaCompletionFor(player)` → `{act3FinalBossDefeated, betaComplete}`: true when `completedStageIds` contains the stage whose `bossEnemyId === BETA_FINAL_BOSS_ENEMY_ID` (`foundation_ferocious_flood_dragon_whelp`, roster act-3 boss — test pins the roster link).
- `betaSupportedFor(player)`/`unsupportedReleaseReason(player)` → first reason or null: `realm_beyond_release` (`!isRealmAvailable(player.realmId)`) → `way_out_of_scope` (`getActiveWay` resolves non-beta) → `hidden_progression_state` (any `hiddenPerfection.realms` key / completed list / hidden breakthroughs / `hiddenBeastKills`) → `companion_owned` (`companions.length > 0`) → `artifact_owned` (`artifact !== undefined`) → `formation_loadout` (`formationLoadout !== null`). Pure read — no auto-conversion, no mutation; save-shape validation already accepts all fields (structural safety confirmed: every checked field is a pre-existing persisted field).

## Design decisions (contract)

1. **Module `core/betaScopeSurface.ts`** owns surface admission — the same composition law as `betaScopeSkillDomain.ts`: it COMPOSES `betaScope.ts` verdicts with domain predicates; `betaScope.ts` stays the policy authority (imported, never duplicated).
2. **Allow-lists bound to features** (`BETA_WHEEL_SLOT_FEATURES`, `BETA_BUILDING_FEATURES`, `BETA_STANDALONE_PANEL_FEATURES`, `BETA_LEFT_PANEL_FEATURES`, `BETA_EQUIPMENT_TAB_FEATURES`): every id a surface can name is mapped to its owner feature (null = ships in beta); an id absent from the map fails closed — a slot/panel/building/tab added later without a scope decision never leaks into beta. Binding (not a static set) keeps `BETA_FEATURES` the single authority and lets the test seam restore pre-beta surfaces for dormant-machinery suites.
3. **Domain gates are early-returns inside chokepoints** (canProgressHiddenBody, isHiddenBreakthroughEligible, isNghichChuTianRevealed, HiddenBeastSystem, rollHiddenChannelRewards, issueCompanionGifts, daily-reset block): every consumer above them inherits the verdict — no per-callsite whack-a-mole.
4. **Legacy state is dormant, never rewritten**: hidden records keep loading (shape validators unchanged), reads for UI route through `betaHiddenRealmRecordFor` so rows can't render; `betaSupportedFor` flags the save instead of repairing it.
5. **RealmPanel consumes `betaRealmLadderNodes()` + `betaNextRealmSurfaceFor()`**: at Trúc Cơ the ladder ends at the Trúc Cơ node, no comingSoon tail, no Kim Đan button, no ceiling note (the "Beta Complete" visual beat is a later UI phase consuming `betaCompletionFor` — this phase ships the flag only, per "no visual design").
6. **Mortal rung is part of the read-model**: `betaRealmLadderNodes()` emits the mortal rung itself (RealmPanel currently prepends it inline — the read-model returns the full render list so no caller re-derives).
7. **Test seam = phase-2 pattern extended**: `betaFeaturesUnlock.ts` mirrors `betaWaysUnlock.ts` — global setup unlocks all features so the ~15 pre-existing dormant-domain suites (hidden lineage, beasts, companion gifts, tribulation hidden types, daily reset, the UI surface suites) keep exercising machinery as it will behave post-beta; suites asserting the lock re-pin via `lockBetaFeaturesForTests()` (and `lockBetaWaysForTests()` where ways matter). `BETA_EQUIPMENT_TAB_FEATURES` turns `isBetaEquipmentTab` feature-aware so the 5-tab shell suite keeps its coverage under the unlock.
8. **betaScopeSkillDomain.test.ts gains `lockBetaWaysForTests()`**: it was authored before the global setup existed and never re-pinned ways — 3 'non-beta way' assertions were silently asserting nothing (pre-existing suite gap on tip; fixed here because the new feature-unlock would have widened it).

## Q1–Q12 (G1)

- **Q1**: beta mortal player → wheel = catalog minus the 4 gated slots; `isBetaBuildingSurface('chi_hien_quan')` false; `betaSupportedFor` true on a fresh boot; legacy hidden-record save → `hidden_progression_state`; golden-core save → `realm_beyond_release`; `foundation_floor_10` cleared → `betaComplete: true`. As-built evidence: spec suite 31/31 green + full suite 7769/7769 (851 files) with type-check clean.
- **Q2**: `betaScopeSurface.ts` owns the verdict chain; UI never re-derives.
- **Q3**: no state — pure queries + early-outs.
- **Q4**: stores/composables/components + `progressionOps` facade bindings are the caller seams; spec test drives the pure functions.
- **Q5**: reuses `isBetaFeature`, `isRealmAvailable`, `isBeyondReleaseCeiling`, `getRealmHiddenState`, `isBetaEquipmentTab`, `getActiveWay`, `STAGES`, `COMMAND_WHEEL_SLOTS`, `REALM_PASSIVE_NODES` — no new primitive.
- **Q6**: imports point inward — core → core/data only (params typed `string`, not panelIds, keeps presentation out of the module signature); GameManagerProgressionOps → domain ✓; components → core read-model ✓.
- **Q7**: no timing/gameplay coupling — all gates are admission checks at surface/chokepoint level.
- **Q8**: spec test pins slot/building/panel sets, hidden-state gating, completion flag, unsupported reasons on crafted `createDefaultPlayer` states.
- **Q9**: observational only — except domain early-outs which SKIP writes (gifts, kill counters, channel counters, daily reset) rather than writing tombstones.
- **Q10**: corrupt input fails closed — unknown ids hidden, null player sub-objects yield no reasons (a missing field is not non-beta state); duplicate calls idempotent.
- **Q11**: A2/A6/A13 — betaScope.ts imported never duplicated; hidden-record reads via `getRealmHiddenState`; release-window reads via ReleasePolicy — no literal realm/feature checks outside the authority.
- **Q12**: `tests/architecture/betaScopeSurface.test.ts` mirrors phase conventions — PLANNED.
