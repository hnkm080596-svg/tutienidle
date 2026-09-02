# QA Review: Full-Project Deep Audit (First Pass)

- Date: 2026-09-02
- Mode: deep
- Verdict: FAIL
- Task-owned paths: entire project (game/src/, game/tests/, game/docs/qa/)

## Scope and Risk Map

First deep adversarial QA pass across the entire TutienIdle project. Covers all 7 domain packs: save-and-cloud, time-and-offline, combat-and-tribulation, inventory-equipment, economy-and-progression, pinia-phaser-sync, ui-input-lifecycle. Focus on recent merges (item-grade rework P5-6, combat overlay repair, unified buff bar, terminology alignment) and all critical persistence/time boundaries.

Escalation: mandatory deep mode due to save-and-cloud + time-and-offline critical boundaries and full-project scope.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
|---|---|---|---|---|---|---|---|
| INV-001 | SaveSystem + LocalCloudSaveService | Two overlapping writes | Atomicity | Concurrency, interruption | Saved revision vs actual data | Integration | High |
| INV-002 | Player store restoreFromSave | Second call same save | Idempotency | Repeat | cultivation doubled | Unit | High |
| INV-003 | GameManager.chooseCultivationPath | mortal→qi_refining with equipped gear | Synchronization | Cross-system chain | Equipped items survive realm change | E2E | High |
| INV-004 | OverlayPanel modal | Open/close focus | Lifecycle | Keyboard, focus | Focus trapped, Escape closes, focus restored | Playwright | High |
| INV-005 | CombatScene PlayerHudLayer | updateKiem called with data | Synchronization | Stale state | Kiếm bar visible in combat | Vitest | High |
| INV-006 | MaterialBag.add overflow | Dissolve at cap | Conservation | Value boundary | Overflow returned, caller logs it | Unit | High |
| INV-007 | OfflineProgressSystem.calculateOfflineProgress | Non-finite cultivationPerSecond | Boundedness | Value mutation | NaN/Infinity cultivation | Unit | Medium |
| INV-008 | PhaserCanvas.vue setupGame | Async throw mid-init | Lifecycle | Interruption | Leaked EventBus handlers | Unit | Medium |
| INV-009 | CombatDefeatPanel | 10s auto-return | Behavior | Timing | No auto-return | Playwright | Medium |
| INV-010 | useAutoRetryCountdown | Double start() | Lifecycle | Repeat | Orphaned interval | Unit | Medium |
| INV-011 | Quest claim | Payment before claim marker | Atomicity | Interruption | Materials lost, quest unclaimed | Unit | Medium |
| INV-012 | EquipmentSlotManager.restore | Unknown slot string | Boundedness | Value mutation | Accepted wrong slot | Unit | Medium |
| INV-013 | stateVersion | Tick bump | Optimize | Repeat | Computed re-evaluation | — | Low |
| INV-014 | CloudSave local revision | Crash between keys | Atomicity | Interruption | Stale revision | Integration | Low |
| INV-015 | cascade in save shape | Optional fields | Coverage | — | — | — | Low |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
|---|---|---|
| `npm.cmd run test` (full suite) | 2079/2080 pass (1 intended fail = QA-2026-09-02-001 reproduction test) | 1 pre-existing flaky (dongFuBuildingAssets — timeout 5s under full load, passes standalone 1.67s) + 1 new QA regression test that intentionally fails until the production fix lands |
| `npm.cmd run type-check` | Pass | vue-tsc clean |
| `npm.cmd run build` | Pass | index 854KB + phaser chunk 1.38MB, chunk warning (non-blocking) |
| `npm.cmd run test:e2e` | 9/9 pass | boot-fresh, create-to-combat, save-reload, ink-wash-ui (3 viewports), combat-overlay-layout (3 viewports) — 1.2m |
| Learned-defect ledger | 19 entries | All from 2026-09-01 equipment/save deep audits |
| Domain agent exploration | 6 reports | Save/cloud, time/offline, combat/tribulation, inventory/equipment, economy/progression, UI/lifecycle |

## Findings

### QA-2026-09-02-001: chooseCultivationPath bypasses breakthrough unequip
- Severity: High
- Status: Confirmed
- Invariant: Synchronization
- Preconditions: Player in mortal realm with equipped gear, then triggers chooseCultivationPath (Lễ Nhập Môn)
- Reproduction: `GameManager.ts:989-1086` — `chooseCultivationPath` changes `player.realmId` from `'mortal'` to `'qi_refining'` (line 1065) without calling `unequipAllEquipment()`. The tribulation breakthrough path (`useTribulation.ts:164`) correctly calls it, but the initial path selection does not. After realm change, equipped mortal items are still `equipped: true` (line 658 short-circuits), so they remain active. But if the player manually unequips them, the T16 grade gate (`canUseItemGrade` at line 662) rejects re-equip (grade mismatch). The `unequipAllEquipment` method exists at line 2170.
- Expected: All equipment should be unequipped before realm change, matching the tribulation breakthough contract (T17)
- Actual: chooseCultivationPath does not call unequipAllEquipment. Equipped items survive the realm change; if player manually unequips, they are locked out of re-equipping (grade_mismatch). Confirmed by reproduction test.
- Evidence: `GameManager.ts:989-1086` (no unequipAllEquipment call), line 1065 (realm change), line 2170 (method exists), `useTribulation.ts:164` (correct call site)
- Test file: `game/src/core/game/GameManager.realmAdvanceUnequip.test.ts` (fails: `expected true to be false` — weapon stays equipped after realm change)
- Owner subsystem: economy-and-progression, inventory-equipment
- Blast radius: Progression lock if player manually unequips after Lễ Nhập Môn; inconsistent with tribulation path

### QA-2026-09-02-002: restoreFromSave is not idempotent — offline cultivation double-applied on second call
- Severity: High
- Status: Coverage gap
- Invariant: Idempotency, Monotonicity
- Preconditions: restoreFromSave called twice with the same save payload
- Reproduction: `stores/player.ts:210-258` — `restoreFromSave` calls `Object.assign(this, save.player)` (line 219) then `this.cultivation += offline.cultivation` (line 243). No guard prevents re-entry. The single caller `loadGame` (line 205) invokes it once, so current code is safe. But no defensive `if (alreadyRestored)` guard exists.
- Expected: Second call should be a no-op or throw
- Actual: Second call re-applies offline cultivation, inflating player progression
- Evidence: `stores/player.ts:210-258` — no `isFinite` guard on `cultivationPerSecond`, no idempotency guard
- Test file: none
- Owner subsystem: time-and-offline, save-and-cloud
- Blast radius: Progression inflation if restoreFromSave is ever called twice

### QA-2026-09-02-003: OverlayPanel missing focus trap (H5)
- Severity: High
- Status: Confirmed
- Invariant: Lifecycle, Focus
- Preconditions: Any modal built on OverlayPanel (e.g. BreakthroughRequirementPanel, CombatResultModal, CombatExitConfirmModal, OfflineSummaryModal)
- Reproduction: `OverlayPanel.vue:20-38` — has `role="dialog" aria-modal="true"` but no `tabindex="-1"`, no focus-on-open, no Escape-to-close, no `previouslyFocused` restore on close
- Expected: Focus should be trapped inside modal, Escape should close, focus restored to trigger element
- Actual: Focus is not managed; keyboard users can tab behind the modal; no Escape handler
- Evidence: `game/src/components/common/OverlayPanel.vue:20-38` — structural markup without focus management
- Test file: none
- Owner subsystem: ui-input-lifecycle
- Blast radius: Accessibility barrier for keyboard users, H5 requirement in Giai đoạn 8 roadmap

### QA-2026-09-02-004: Kiếm Ý/Thế bar never invoked from production code
- Severity: Medium
- Status: Confirmed (known gap)
- Invariant: Synchronization
- Preconditions: Player in combat with Kiếm Tu path (has Kiếm Ý or Kiếm Thế resource)
- Reproduction: `CombatScene.ts` — `playerHud.updateHp` called at lines 1541 and 1731, `updateMp` at line 1734, but `updateKiem` is never called. `PlayerHudLayer.updateKiem()` exists at `PlayerHudLayer.ts:129` and is tested in `PlayerHudLayer.test.ts:170,178` but has zero production call sites.
- Expected: CombatScene should subscribe to resource-change events and call `updateKiem` with Kiếm resource data
- Actual: The Kiếm bar in the in-canvas HUD is always invisible (shown but never updated from 0/0)
- Evidence: `CombatScene.ts` — grep for `updateKiem` returns only test files; `PlayerHudLayer.ts:129` — method exists and is functional
- Test file: `PlayerHudLayer.test.ts` (covers the method, not the wiring)
- Owner subsystem: combat-and-tribulation, pinia-phaser-sync
- Blast radius: Kiếm Tu players see no Kiếm resource bar (cosmetic, noted as deferred in commit 71357a1)

### QA-2026-09-02-005: PhaserCanvas bridge leaks EventBus handlers on failed setupGame
- Severity: Medium
- Status: Suspected
- Invariant: Lifecycle
- Preconditions: `PhaserCanvas.vue.setupGame()` called, EventBus.on handlers registered, but `new Phaser.Game()` throws (asset load failure)
- Reproduction: `PhaserCanvas.vue:120-136` — `eventBus.on('positions', ...)`, `eventBus.on('battle_end', ...)`, `eventBus.on('combat_scene_exit', ...)` are registered before the async `new Phaser.Game()` call. If the game constructor throws, `positionsCleanup` is never assigned but the EventBus handlers are already registered. On re-mount, duplicates accumulate.
- Expected: EventBus handlers should be registered AFTER game creation succeeds, or cleaned up on failure
- Actual: On setupGame failure, handlers leak on gameManager.eventBus across re-mount
- Evidence: `game/src/components/game/PhaserCanvas.vue:120-136`
- Test file: none
- Owner subsystem: pinia-phaser-sync
- Blast radius: Stale event handlers, duplicate delivery on re-mount

### QA-2026-09-02-006: CombatDefeatPanel 10s auto-return missing
- Severity: Medium
- Status: Suspected
- Invariant: Behavior
- Preconditions: Player defeated in combat, CombatDefeatPanel shown
- Reproduction: `CombatDefeatPanel.vue:25-27` — comment says "10 giây không bấm gì thì tự về Động Phủ" but code only wires `useAutoRetryCountdown(3s, refight)`. No 10s fallback to `returnHome()` is implemented.
- Expected: After 10s of inactivity, panel should auto-return to home
- Actual: No auto-return; player can leave the panel idle indefinitely
- Evidence: `game/src/components/game/combat/CombatDefeatPanel.vue:25-27` (comment) vs line 59 (only refight countdown)
- Test file: none
- Owner subsystem: ui-input-lifecycle
- Blast radius: Minor UX issue, spec drift

### QA-2026-09-02-007: OfflineProgressSystem no isFinite guard on cultivationPerSecond
- Severity: Medium
- Status: Coverage gap
- Invariant: Boundedness
- Preconditions: Corrupted save with non-finite cultivationPerSecond
- Reproduction: `OfflineProgressSystem.ts:15-28` — `calculateOfflineProgress` multiplies `cultivationPerSecond * elapsedSeconds` without checking `isFinite(cultivationPerSecond)`. If a corrupted save writes `Infinity` or `NaN` into `cultivationPerSecond`, the result propagates to `player.cultivation` at `stores/player.ts:243`. The `Math.min(cultivation, cultivationRequired)` at line 250 clamps `Infinity` to `cultivationRequired` (which is finite), so the damage is limited.
- Expected: `isFinite` guard on cultivationPerSecond before multiplication
- Actual: Non-finite input propagates to cultivation
- Evidence: `game/src/core/idle/OfflineProgressSystem.ts:24-26`
- Test file: none
- Owner subsystem: time-and-offline
- Blast radius: Corrupted save → instant breakthrough (mitigated by clamp at line 250)

### QA-2026-09-02-008: MaterialBag.add overflow ignored by dissolve callers
- Severity: Medium
- Status: Coverage gap
- Invariant: Conservation
- Preconditions: Dissolve reward fills a material stack to its limit
- Reproduction: `GameManager.ts:2088-2094` — `dissolveItems` calls `this.materialBag.add(...)` and ignores the returned `overflow` number. `MaterialBag.ts:35-42` returns the overflow intentionally so callers can warn. Currently: `gameManager.dissolveItems:2088-2094`, `grantAutoDissolveRewards:1843-1848`, and the restore path at `GameManager.ts:3140` all ignore overflow. **Mitigation**: the primary dissolve reward (Luyện Khí Tinh Hoa) has `stackLimit: Number.MAX_SAFE_INTEGER` so overflow is not reachable for it. But other materials with finite stack limits could silently lose overflow.
- Expected: Overflow should be surfaced to the UI (toast, or prevent dissolve)
- Actual: Overflow silently dropped for any material with finite stackLimit
- Evidence: `GameManager.ts:2088-2094` (ignored return), `MaterialBag.ts:35-42` (returns overflow), `materials.ts:36` (Luyện Khí Tinh Hoa stackLimit = MAX_SAFE_INTEGER)
- Test file: `GameManager.dissolveUnifiedEssence.test.ts` (exist but not covering this gap)
- Owner subsystem: inventory-equipment, economy-and-progression
- Blast radius: Silent material loss for non-essence materials

### QA-2026-09-02-009: useAutoRetryCountdown double-start leaves orphaned interval
- Severity: Medium
- Status: Suspected
- Invariant: Lifecycle
- Preconditions: `start()` called twice without `stop` in between
- Reproduction: `useAutoRetryCountdown.ts:50-56` — `start()` reassigns `handle = setInterval(tick, 1000)` without clearing a prior handle. The `completed` guard prevents double `onComplete()`, but the orphaned timer still fires `tick()`. Currently only called from `CombatVictoryPanel` and `CombatDefeatPanel` which mount once, so the double-start path is not reachable in production.
- Expected: `clearInterval(handle)` before reassigning
- Actual: Prior interval orphaned on double-start
- Evidence: `game/src/composables/useAutoRetryCountdown.ts:50-56`
- Test file: `useAutoRetryCountdown.test.ts` (exists but may not cover this)
- Owner subsystem: ui-input-lifecycle
- Blast radius: Resource waste, no gameplay impact

### QA-2026-09-02-010: EquipmentSlotManager.restore lacks slot-enum validation
- Severity: Medium
- Status: Suspected
- Invariant: Boundedness
- Preconditions: Save with unknown slot string in equipmentSlots
- Reproduction: `EquipmentSlotManager.ts:31-35` — `restore()` blindly overwrites slot state with whatever the save provides. No `EQUIPMENT_SLOTS.includes(entry.slot)` check. The save-level validator (`saveShapeValidation.ts`) is the only gate. Learned-defect 014 already covers the save-level gate, but the manager-level defense is missing.
- Expected: Manager-level slot-enum validation
- Actual: Unknown slot string accepted at manager level
- Evidence: `game/src/core/equipment/EquipmentSlotManager.ts:31-35`
- Test file: `saveShapeValidation.test.ts` (validates at save level, not manager level)
- Owner subsystem: inventory-equipment, save-and-cloud
- Blast radius: If save validator is bypassed, slot state corruption

### QA-2026-09-02-011: LocalCloudSaveService crash between key writes
- Severity: Low
- Status: Suspected
- Invariant: Atomicity
- Preconditions: Browser crash between `SAVE_KEY` and `SAVE_REVISION_KEY` writes
- Reproduction: `LocalCloudSaveService.ts:17-33` — two `setItem` calls without a transaction. Crash between them leaves stale revision. The coordinator resyncs on next conflict, so data is self-healing.
- Expected: Atomic write or recovery path
- Actual: Non-atomic dual-key write
- Evidence: `game/src/services/cloudSave/LocalCloudSaveService.ts:17-33`
- Test file: CloudSaveCoordinator.test.ts (covers resync path)
- Owner subsystem: save-and-cloud
- Blast radius: One extra conflict on next load (self-healing)

### QA-2026-09-02-012: stateVersion bumps every tick regardless of state change
- Severity: Low
- Status: Suspected (Optimization)
- Invariant: Optimize
- Preconditions: Game running, any tick
- Reproduction: `App.vue:360` — `tick()` always calls `bumpState()` at the bottom of every cycle. Components like `useStageActive` and `useCombatSceneActive` re-evaluate `stateVersion`-dependent computeds every tick even when no relevant state changed.
- Expected: stateVersion bumps only on actual state changes (bag/equipment/materials)
- Actual: stateVersion bumps every tick (~60/min)
- Evidence: `game/src/App.vue:360`, `useStageActive.ts:25-38`, `useCombatSceneActive.ts:21-33`
- Test file: none
- Owner subsystem: pinia-phaser-sync
- Blast radius: Redundant computed re-evaluation, minor CPU waste

## New or Changed QA Tests

| Path | Why it proves its target behavior |
|---|---|
| `game/src/core/game/GameManager.realmAdvanceUnequip.test.ts` | Confirms QA-2026-09-02-001: after `chooseCultivationPath('phap_tu')`, equipped mortal items stay equipped (intended failure: `expected true to be false`). Regression test for the T17 contract gap. Second case confirms the downstream lock: manual unequip + re-equip → `grade_mismatch`. |

## Gaps and Residual Risk

| Gap | Why it matters | Current mitigations |
|---|---|---|
| No integration test for two concurrent autosaves at App.vue boundary | Save clash on pagehide + interval | `saveInFlight` boolean prevents re-entry (App.vue:196) |
| No idempotency guard on restoreFromSave | Future re-entry would inflate progression | Single caller in current codebase (loadGame) |
| No focus-trap implementation in OverlayPanel | Keyboard accessibility gap | Modal has correct aria markup (role, aria-modal, aria-label) |
| No reproduction test for chooseCultivationPath unequip skip | Progression lock gap | **Resolved** — reproduction test added at `game/src/core/game/GameManager.realmAdvanceUnequip.test.ts`. Test fails for the intended reason. Production fix not authored (out of QA scope). |
| No management of dissolve overflow for non-essence materials | Silent material loss | Luyện Khí Tinh Hoa uses MAX_SAFE_INTEGER stack; other materials may overflow |
| OfflineProgressSystem no isFinite guard on cultivationPerSecond | Corrupted save → instant breakthrough | Clamp at player.ts:250 limits to cultivationRequired |
| Kiếm Ý/Thế bar not wired | Incomplete feature | Known as deferred in commit 71357a1 |
| 10e2e test for combat-overlay overlap on min(420px, 100vh) viewports | Untested edge case | Existing e2e covers 3 viewports for HUD/AI panel overlap |

## Pre-existing Failures

- `dongFuBuildingAssets.test.ts`: flaky timeout (5s) under full-suite load, passes standalone (1.67s). Known in roadmap mục 7.
- `Playtest.continuousCombat`: known flaky from roadmap (timeout 5s, not run in standard suite).

## Optimization Opportunities

| ID | File:line | Issue | Suggestion |
|---|---|---|---|
| OPT-01 | `App.vue:360` | `bumpState()` on every tick | Split stateVersion into "bag/equipment" (manual) and "battle/world" (auto-bumped) |
| OPT-02 | `SaveSystem.ts:575,583` | `structuredClone` + `JSON.stringify` = double serialization per autosave | Serialize once |
| OPT-03 | `useCadenceSmoothing.ts:56-68` | rAF loop runs forever even with no cadence | Self-terminate when `displayed <= 0 && total <= 0` |
| OPT-04 | `EquipmentBag.ts:129-135` | O(N) linear scan per getEquipped/getEquippedInSlot | Add secondary Map<EquipmentSlot, EquipmentInstance> index |
| OPT-05 | `EnhanceTab.vue:63-111` | `enhanceRows` computed calls O(slots × 5) per stateVersion bump | Memoize keyed by stateVersion + selected slot |
| OPT-06 | `SaveSystem.ts:661-668` | `loadGame` reads+removes IMPORT_HANDOFF_KEY on every boot even when no import | Lazy read |
| OPT-07 | `App.vue:285-287` | `drainNotifications()` runs every tick unconditionally | Early-return if notifications.length === 0 |
| OPT-08 | `PhaserCanvas.vue:120-136` | EventBus handlers registered before async game creation | Wrap in try/catch + cleanup on failure |
| OPT-09 | `CombatScene.ts:1407-1446` | 11-entry boundHandlers array + 14 explicit on() calls | Single Map<string, Function> for symmetric register/unregister |

## Learned-Defect Recommendations

| ID | Component | Trigger pattern | Missed invariant | Why prior QA missed it | Regression test | Weighting recommendation |
|---|---|---|---|---|---|---|
| QA-2026-09-02-001 | GameManager.chooseCultivationPath | Realm change without unequipAllEquipment | Synchronization: realm boundary must clear equipment state | Prior T17 tests only covered tribulation breakthrough path, not Lễ Nhập Môn | None | Weight every realm-change path, not just the primary breakthrough path |
| QA-2026-09-02-002 | Player store restoreFromSave | Second call with same save | Idempotency: offline calculation must be one-shot | Single caller makes it unreachable today | None | Weight defensive idempotency guards even when the current call graph is a singleton |
| QA-2026-09-02-003 | OverlayPanel | Open modal | Focus management: every modal must trap focus and handle Escape | Testing focused on Pinia/store behavior, not DOM focus | None | Weight focus management as a mandatory invariant for every modal primitive |
| QA-2026-09-02-005 | PhaserCanvas.vue setupGame | Async throw mid-init | Lifecycle: EventBus handlers must be paired with their creation scope | Synthetic lifecycle tests (CombatScene.lifecycle.test.ts) don't cover the PhaserCanvas bridge | None | Weight async creation failure as a lifecycle leak scenario |
| QA-2026-09-02-008 | GameManager.dissolveItems | MaterialBag.add overflow ignored | Conservation: return value of destructive operations must be checked | Tests covered the add-to-limit boundary but not the caller's overflow handling | None | Weight every caller's ignored return value from a resource-constrained mutation |