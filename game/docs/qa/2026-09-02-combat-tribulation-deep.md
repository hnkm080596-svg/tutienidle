# QA Review: Combat & Tribulation Subsystem

- Date: 2026-09-02
- Mode: deep
- Verdict: PASS WITH GAPS
- Scope: `game/src/core/battle/`, `game/src/core/combat/`, `game/src/core/enemy/`, `game/src/core/buff/`, `game/src/core/tribulation/`, `game/src/core/skill/`, `game/src/game/scenes/CombatScene.ts`, `game/src/game/scenes/TribulationScene.ts`, `GameManager.ts` orchestration, `BattleLootSystem.ts`, `useTribulation.ts`

## Scope and Risk Map

All scope paths read at current HEAD (`c0ee860`). Risk map covers combat/tribulation lifecycle, exactly-once reward, boundedness, atomicity, synchronization, and cross-system handoffs. No unrelated dirty paths.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
|---|---|---|---|---|---|---|---|
| INV-01 | `BattleSystem` event listeners | Constructor registers `entity_vitals_changed`/`kill` on shared EventBus; never unregistered | Lifecycle | Repeat | Extra handler after `stop()` | Integration | Low |
| INV-02 | `BattleSystem.checkBattleEnd` | Sets `state='defeat'`, emits `battle_end` | Exactly-once | Repeat, Timing boundary | `battle_end` emitted once per death | Unit | High |
| INV-03 | `StageWaveSystem.update` victory | Sets `state='victory'`, emits `battle_end` | Exactly-once | Repeat | `battle_end` emitted once per victory | Unit | High |
| INV-04 | `BattleLootSystem.processDefeatedEnemies` | Per-enemy reward grant | Exactly-once, Conservation | Repeat | `rewardGranted` guard, summary counts | Unit | High |
| INV-05 | `CombatScene` event subscriptions | `subscribeCombatEvents`/`unsubscribeCombatEvents` in `create()`/`shutdownHandler` | Lifecycle | Repeat | Handler count stable after cycle | Integration | High |
| INV-06 | `TribulationScene` event subscriptions | `bus.on('tribulation_lightning'/'damage'/'entity_vitals_changed'/'tribulation_scene_exit')`, unsubscribed in `shutdownHandler` | Lifecycle | Repeat | No stale handler after shutdown | Integration | High |
| INV-07 | `TribulationDirector.tickTank` while loop | `strikeLightning` → `applyLightningDamage` → `state='defeat'` | Atomicity, Boundedness | Timing boundary | No strike after `snapshotHp <= 0` | Unit | Medium |
| INV-08 | `PlayerHudLayer.updateKiem` | Not called from `CombatScene` | Synchronization | Value mutation | Kiếm Ý/Thế bar never updates | Integration | Medium |
| INV-09 | `BattleSystem` constructor `eventBus.on('kill', lambda)` | Lambda capture, no stable ref for `off()` | Lifecycle | Repeat | Cannot unregister (singleton, acceptable) | Unit | Low |
| INV-10 | `CombatScene` `essence_stream_arrival` callback | Lives beyond `clearSceneState()` via closure over `eventBus` | Lifecycle | Interruption | Stale event after scene shutdown | Integration | Low |
| INV-11 | `EffectScope` category | `source`/`primary_target`/`affected_targets` via `scopeForEffect` | Determinism | Value mutation | Correct effect application per scope | Unit | Medium |
| INV-12 | `battle_end` event from `abandonBattle` | Sets `state='defeat'`, emits `battle_end`, clears `enemyManager` | Exactly-once, Conservation | Interruption | `enemyManager.clear()` skips reward for alive enemies (by design) | Integration | Medium |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
|---|---|---|
| Static source analysis of `BattleSystem.ts` | `checkBattleEnd` guarded by `battle.state !== 'fighting'` early return at line 846; only reachable in `fighting` state. `battle_end` emit at line 3282 runs once per death. | Source contract |
| Static source analysis of `StageWaveSystem.ts` | `battle_end` emission at line 141 guarded by `aliveCount === 0` and `stageManager.stop()`/`battle.state='victory'` prevents re-entry. | Source contract |
| Static source analysis of `BattleLootSystem.processDefeatedEnemies` | `rewardGranted` set at line 167 before reward processing; `battle.enemies` filtered to alive-only at line 315. | Source contract |
| Static source analysis of `CombatScene` event lifecycle | `subscribeCombatEvents` at line 1407, `unsubscribeCombatEvents` at line 1448, both access same `boundHandlers` array and individual named handlers. | Source contract, `CombatScene.lifecycle.test.ts` |
| Static source analysis of `TribulationScene` event lifecycle | `subscribe` at line 84-89, `unsubscribe` at line 118-123, named arrow handlers. | Source contract |
| `CombatScene.lifecycle.test.ts` | 10 create/shutdown cycles: 1 resize listener per cycle, 0 after shutdown. | Existing test |
| `BattleLootSystem.artifactDrop.test.ts` | Double-grant blocked by `rewardGranted`. | Existing test |

## Findings

### CBT-01: BattleSystem constructor event listeners never unregistered
- Severity: Low
- Status: Suspected
- Invariant: Lifecycle
- Preconditions: `BattleSystem` is a singleton owned by `GameManager` for the app lifetime.
- Reproduction: N/A — singleton, no teardown path exists.
- Expected: If `BattleSystem` were ever recreated, old listeners would double-fire.
- Actual: Listeners at `BattleSystem.ts:334` and `341` are lambdas with no stable reference; `off()` is impossible.
- Evidence: `BattleSystem.ts:334-345` confirms `eventBus.on` with arrow functions, no `off()` call in the class.
- Owner subsystem: `core/battle/BattleSystem`
- Blast radius: N/A (singleton). Defensive: `onEntityVitalsChanged` guards `this.battle` at line 351.

### CBT-02: CombatScene `updateKiem` never called
- Severity: Medium
- Status: Coverage gap
- Invariant: Synchronization
- Preconditions: Player has Kiếm Ý/Thế (KiemTu route).
- Reproduction: Start a battle with KiemTu route; observe `PlayerHudLayer` Kiếm bar.
- Expected: Kiếm Ý/Thế bar updates as resource changes.
- Actual: `onVitalsChanged` (`CombatScene.ts:1722`) calls `updateHp`/`updateMp` but never `updateKiem`. No event carries Kiếm Ý/Thế data to the scene.
- Evidence: `CombatScene.ts:1722-1736` — only `updateHp` and `updateMp` calls. `positions` event (`BattlePositionsEvent`) does not include Kiếm resource fields.
- Owner subsystem: `game/scenes/CombatScene` + `BattleEvents.ts`
- Blast radius: Presentation only — Kiếm Ý/Thế bar is blank in-canvas HUD during combat.

### CBT-03: `essence_stream_arrival` callback survives scene cleanup
- Severity: Low
- Status: Suspected
- Invariant: Lifecycle
- Preconditions: Essence stream (Tinh Hoa Phàm Thể) starts just before scene shutdown.
- Reproduction: `clearSceneState()` destroys `_essenceStream` but the `arrival` callback (closure over `this.eventBus`) is not cleared.
- Expected: After scene shutdown, stale `essence_stream_arrival` should not emit.
- Actual: `CombatScene.ts:1508-1509` — `arrival` callback is `() => { this.eventBus?.emit<undefined>('essence_stream_arrival', undefined) }`. `clearSceneState()` at line 1307 sets `this._essenceStream = undefined` but does not reset the callback. If the tween/stream was mid-flight, it could fire after `clearSceneState()`.
- Evidence: `CombatScene.ts:1505-1513` (lazy getter, closure), `clearSceneState()` at line 1307.
- Owner subsystem: `game/scenes/CombatScene`
- Blast radius: One spurious `essence_stream_arrival` event reaching the Vue layer. No state corruption.

### CBT-04: `TribulationDirector` ghost entity `as CombatEntity` cast
- Severity: Low
- Status: Suspected
- Invariant: Recoverability
- Preconditions: Tribulation starts.
- Reproduction: `TribulationDirector.start()` at line 121 creates a `ghost` with `as CombatEntity` cast. Many optional fields (`currentKiemThe`, `currentThoThe`, `currentKimThe`, `currentHoaThe`, `currentSwordIntent`, `currentMomentum`, `currentThe`, etc.) are set to 0 or undefined.
- Expected: Future code that reads these fields from the ghost should not crash on undefined.
- Actual: The ghost is used only for `vitals.applyDamage`/`applyHealing`/`emitCurrent` which only access `currentHp`, `maxHp`, `currentWard`, `currentMp`, `stats`, `id`, `alive`. All of these are set. Defensive.
- Evidence: `TribulationDirector.ts:121-135`
- Owner subsystem: `core/tribulation/TribulationDirector`
- Blast radius: None currently; type-level risk if vitals system adds new field reads.

### CBT-05: `BattleSystem.updateEnemyAttacks` iterates `battle.enemies` while `processDefeatedEnemies` filters it
- Severity: Medium
- Status: Suspected
- Invariant: Atomicity
- Preconditions: Enemy dies during the same tick from DoT before `processDefeatedEnemies` runs.
- Reproduction: `updateEnemyAttacks` at line 3140 iterates `battle.enemies` and skips `!alive` enemies. `processDefeatedEnemies` at line 315 filters `battle.enemies` to alive-only. They run in the same tick order: `updateStatsFromModifiers` → `updateLavaZones` → `updateRegen` → `updateEnemyAttacks` → `actionImpact.tick` → `checkBattleEnd` → (GameManager) `grantBattleRewardIfNeeded`. The `actionImpact.tick` can kill enemies via DoT ticks. But `updateEnemyAttacks` runs BEFORE `actionImpact.tick`, so DoT kills happen after enemy attacks. But then `processDefeatedEnemies` (via `grantBattleRewardIfNeeded`) runs after `checkBattleEnd`, which is after `actionImpact.tick`. So the killed enemy is still in the array when `enemyAttacks` runs. The `!alive` check at line 3141 prevents the dead enemy from attacking. But the `enemyAttacks` iteration itself is safe (doesn't mutate the array). The `processDefeatedEnemies` filter at line 315 happens later. This is correct.
- Evidence: `BattleSystem.update()` ordering at lines 860-1001, `grantBattleRewardIfNeeded` at `GameManager.ts:3381-3387`.
- Owner subsystem: `core/battle/BattleSystem` + `core/game/GameManager`
- Blast radius: None — correct ordering.

## Optimization Opportunities

1. **`BuffSystem` per-entity allocation per tick**: `BattleSystem.updateStatsFromModifiers()` creates a new `BuffSystem` for each enemy every tick (line 1456). Could reuse with a pool pattern. Low impact for typical 5-10 enemy counts.

2. **`snapshotStatuses` double iteration**: Called once at line 872 (before) and once at line 1538 (after) every tick during `fighting` state. Produces a full `Map` of all visible buffs across all entities. Could be optimized to only compute diff when buff state actually changed, but the current approach is simple and correct.

3. **`Math.min(1, Math.max(0, ...))` repeated in `emitPositions`**: Lines 704-713 and 752-756 clamp progress values redundantly. Minor.

4. **`instanceCounter` global in `ActionImpactSystem`**: `let instanceCounter = 0` at module scope. Never resets. Could overflow after ~2^53 impacts. Academic; not a real concern.

## Verified Clean

| Area | Evidence | Status |
|---|---|---|
| `CombatScene` event lifecycle | `subscribeCombatEvents`/`unsubscribeCombatEvents` correctly pair all 20+ event bindings with named handlers. Lifecycle test confirms 10-cycle stability. | PASS WITH EVIDENCE |
| `TribulationScene` event lifecycle | Named handlers for all 4 event subscriptions, unsubscribed in `shutdownHandler`. | PASS WITH EVIDENCE |
| `BattleLootSystem.processDefeatedEnemies` exactly-once | `rewardGranted` flag set before processing; `enemySystem.despawn` called after; `battle.enemies` filtered to alive. Double-grant test exists. | PASS WITH EVIDENCE |
| `StageWaveSystem` victory exactly-once | `battle.state='victory'` + `stageManager.stop()` prevents re-entry; `battle_end` emitted once. | PASS WITH EVIDENCE |
| `BattleSystem.checkBattleEnd` defeat exactly-once | After `state='defeat'`, `update()` early-returns at line 846. | PASS WITH EVIDENCE |
| `TribulationDirector.tickTank` no-strike-after-death | While loop guarded by `this.snapshotHp > 0`; `update()` outer loop guarded by `active.state === 'ongoing'`. | PASS WITH EVIDENCE |
| `resolveSkillEffects` scope separation | `scopeForEffect` correctly separates `source`/`primary_target`/`affected_targets` effects. | PASS WITH EVIDENCE |
| `regenEntityVitals` event emission | Emits only when MP/Ward actually changed (`changed !== 0`). | PASS WITH EVIDENCE |
| `updateCasting` dead-cast guard | `cancelPlayerCast` called when `!player.alive`; fizzle refunds 50% cooldown. | PASS WITH EVIDENCE |
| `updateChanneling` amp snapshot | `tuLucDamageTakenPercent` snapshot/restore pattern prevents double-counting thorns feedback. | PASS WITH EVIDENCE |
| `ActionImpactSystem.tick` dead-source guard | `if (!source || !target || !source.alive || !target.alive) continue` at line 250. | PASS WITH EVIDENCE |
| `abandonBattle` enemyManager cleanup | `this.enemyManager.clear()` at line 3000 prevents orphan enemy references. | PASS WITH EVIDENCE |
| `BattleSystem` `stop()` | Clears `actionImpact` pending impacts and sets `battle = null`. | PASS WITH EVIDENCE |
| `CombatScene` `onBattleStart` cleanup | Clears `statuses`, `spawnVfxHandles`, `materializingIds`, `dyingIds`, `dotAccumulators`, `castBars`, old enemy sprites, `playerSpawnHandle`. | PASS WITH EVIDENCE |
| `CombatScene` `clearSceneState` cleanup | Destroys all graphics, clears all maps, sets `_playerHud = undefined`. | PASS WITH EVIDENCE |

## Gaps and Residual Risk

- **CBT-02** (Kiếm Ý/Thế bar not updating) is a known gap documented in the recent merge (`d0969eb`) — "Kiếm Ý/Thế bar chưa có data event". No production code fix should be attempted during QA.
- **CBT-01** (BattleSystem listener unregistration) is acceptable because BattleSystem is a singleton.
- **CBT-03** (essence_stream_arrival callback) is low-risk; the max damage is one spurious arrival event.
- **CBT-04** (ghost `as CombatEntity`) is type-level risk only; no runtime field reads from ghost beyond HP/MP/Ward.