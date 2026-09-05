# Turn Combat Action Playback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Damage applies at the moment its VFX visually lands (not when the action is decided), and the engine only advances to the next actor once that actor's full presentation sequence finishes — while every existing headless test keeps passing unchanged.

**Architecture:** `TurnBattleSystem.resolveActorTurn()` (already a thin `peekNextActor()`+resolve wrapper per Slice 7) splits FURTHER into 3 pure, synchronous, still-headless methods — `declareActorAction()` → `applyActionImpact()` → `completeAction()` — with `resolveActorTurn()` becoming a thin wrapper calling all three back-to-back (zero behavior change, matching the exact pattern Slice 7 already established for `peekNextActor`/`resolveActorTurn`). All new "waiting for Phaser" orchestration lives in `GameManager` (mirroring its existing `awaitedManualActor`/`submitTurnChoice` pattern from Slice 7), NOT inside `TurnBattleSystem` — the engine itself stays pure/headless/synchronous, exactly matching its own file-header design principle. A new `presentationActive` flag (set by `CombatScene` on mount/unmount) decides whether `GameManager` calls the 3 phases back-to-back instantly (current behavior, every test) or waits for 3 new acknowledgement methods Phaser calls back into.

**Tech Stack:** Vue 3 + TypeScript, Phaser 4, Vitest.

**Spec:** [2026-09-05-turn-combat-action-playback-design.md](../specs/2026-09-05-turn-combat-action-playback-design.md)

## Global Constraints

- Không dùng `any` nếu không cần thiết (`game/CLAUDE.md`).
- `TurnBattleSystem` giữ nguyên nguyên tắc headless/pure — không import Phaser, không biết gì về `presentationActive`. Mọi state "đang chờ" sống ở `GameManager`.
- KHÔNG sửa `ActionImpactSystem.ts` — file đó vẫn đang phục vụ các hệ sống khác (`ArtifactSystem.ts`, `EnemyAttackSystem.ts`, `SkillEffectResolver.ts`, `battle/legacy/BattleSystem.ts`) chưa retire. Turn-based combat tự emit các event `attack`/`action_impact` cùng shape payload, qua 1 file mới, không tái dùng `ActionImpactSystem`'s internal batch state machine (nó được thiết kế cho `Battle`/`ResolveOneHitFn` shape cũ, không khớp `TurnBattle`/`combat.resolveActionHit()`).
- Mọi test hiện có (`TurnBattleSystem.*.test.ts`, `GameManager.*.test.ts`) phải PASS không sửa gì — `presentationActive` mặc định `false`.
- Chạy `npx vue-tsc --noEmit` sau MỖI task.
- Nội dung `reactiveTrigger` (skill/enemy nào thật sự có punish-on-cast/counter) — ngoài phạm vi, chỉ xây cơ chế.

---

### Task 1: Survey — confirm exact current wiring before touching code

**Files:** read-only

- [ ] **Step 1: Confirm `CombatScene.ts`'s mount/unmount lifecycle methods**

Read `game/src/game/scenes/CombatScene.ts`'s `subscribeCombatEvents`/`unsubscribeCombatEvents` (seen earlier around `:1148-1166`, re-read fresh — file has real encoding artifacts in some tool outputs, read via the `Read` tool directly for accurate content) and whichever Phaser lifecycle method calls them (`create()`/`init()`/`shutdown()`) — this is where Task 7's `gameManager.setPresentationActive(true/false)` calls get added.

- [ ] **Step 2: Confirm `GameManager`'s exact current turn-based field names**

Read `game/src/core/game/GameManager.ts` around `awaitedManualActor`, `battleManualMode`, `submitTurnChoice` (confirmed this session at `:2530-2543`), and `updateBattleFixedStep` (confirmed at `:3317-3361`) fresh — re-verify line numbers haven't shifted since this plan was written (multiple features have merged into this file recently: Party, Future Systems, Slice 7 master plan).

- [ ] **Step 3: Confirm `ActionImpactEvent`'s exact payload type**

Read `game/src/core/battle/BattleEvents.ts` (or wherever `ActionImpactEvent`/`CombatScenePayload` types are declared — grep for `interface ActionImpactEvent`) for the exact field names Task 4's new emitter must produce (seen partially via `ActionImpactSystem.ts`'s `endSkillBatch()` at `:200-223`: `actionId`, `actionInstanceId`, `sourceId`, `primaryTargetId`, `anchorCell`, `affectedTargetIds`, `landedTargetIds`, `dodgedTargetIds`, `affectedArea`, `hitCount`, `presetId` — confirm this is the full/current shape, not a stale read).

No commit for this task — pure investigation feeding Tasks 4/6/7.

---

### Task 2: `presetId` field on `TurnSkillDefinition` + `TurnBattle.queuedFollowUpActorId`

**Files:**
- Modify: `game/src/core/battle/turn/TurnSkillAction.ts` (`TurnSkillDefinition`, `:22-32`)
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts` (`TurnBattle`, `:77-...`)

**Interfaces:**
- Produces: `TurnSkillDefinition.presetId?: CombatVfxPresetId` (import from `../CombatAction`), `TurnBattle.queuedFollowUpActorId?: string`.

- [ ] **Step 1: Add `presetId` to `TurnSkillDefinition`**

```ts
import type { CombatVfxPresetId } from '../CombatAction'

export interface TurnSkillDefinition {
  id: string
  cooldownTurns: number
  resourceType?: SkillResourceType
  resourceCost?: number
  damage: ActionDamageInfo
  targeting: ActionTargeting
  appliesBuff?: { definitionId: string; target: 'self' | 'target' }
  chargeTurns?: number
  /** Action Playback (2026-09-05) — VFX preset cho action_impact. undefined = fallback preset mặc định (Task 4). */
  presetId?: CombatVfxPresetId
}
```

- [ ] **Step 2: Add `queuedFollowUpActorId` to `TurnBattle`**

```ts
export interface TurnBattle {
  players: TurnBattleParticipant[]
  enemies: TurnBattleParticipant[]
  state: TurnBattleState
  totalTurnsElapsed?: number
  countdownTurnsRemaining?: number
  wave?: { totalEnemyCount: number; spawnedCount: number }
  log?: BattleLogEntry[]
  /** Action Playback (2026-09-05) — counter/follow-up (§6 spec): actor này nhảy thẳng vào 'ready' ngay sau standby, bỏ qua idle. */
  queuedFollowUpActorId?: string
}
```

- [ ] **Step 3: Run typecheck**

Run: `npx vue-tsc --noEmit`
Expected: no errors (both fields optional, no existing code breaks)

- [ ] **Step 4: Commit**

```bash
git add game/src/core/battle/turn/TurnSkillAction.ts game/src/core/battle/turn/TurnBattleSystem.ts
git commit -m "feat(turn-combat): add TurnSkillDefinition.presetId + TurnBattle.queuedFollowUpActorId"
```

---

### Task 3: Split `resolveActorTurn()` into `declareActorAction()` / `applyActionImpact()` / `completeAction()`

**Files:**
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts` (the whole `resolveActorTurn()` body, currently `:215-485`)
- Test: `game/src/core/battle/turn/TurnBattleSystem.actionPlayback.test.ts` (new)

**Interfaces:**
- Produces: `TurnBattleSystem.declareActorAction(battle, actor, forcedSkillSlot?): TurnDeclaredAction`, `TurnBattleSystem.applyActionImpact(battle, declared): { targetIds: string[] }`, `TurnBattleSystem.completeAction(battle, actor, declared, targetIds): TurnStepResult`. `resolveActorTurn()` becomes a thin wrapper (unchanged signature/behavior).

This is the highest-risk task — `resolveActorTurn()` has grown substantially since Slice 2 (charge mechanic, Reaction Path marker, gauge-delta deferral, party support, battle log) and this split must preserve ALL of it exactly. Read the CURRENT file fresh (`:215-485`) before starting — do not work from this plan's paraphrase alone, the exact body is long and easy to transcribe wrong.

- [ ] **Step 1: Write the failing regression-equivalence tests**

Create `game/src/core/battle/turn/TurnBattleSystem.actionPlayback.test.ts`. Read `game/src/core/battle/turn/TurnBattleSystem.test.ts` first for the exact fixture-building helpers used across this test suite (battle/participant builders, `CombatSystem` stub) — reuse them, don't invent new ones.

```ts
import { describe, expect, it } from 'vitest'
// import the same fixture builders TurnBattleSystem.test.ts uses

describe('TurnBattleSystem — declareActorAction/applyActionImpact/completeAction split', () => {
  it('declareActorAction resolves the action/targets but does NOT call combat.resolveActionHit (no damage applied yet)', () => {
    // Arrange a battle, actor ready to act with a basic attack.
    // Act: const declared = system.declareActorAction(battle, actor)
    // Assert: enemy target's currentHp UNCHANGED; declared.resolvedTargets
    // non-empty; declared.skillId matches the basic skill.
  })

  it('applyActionImpact applies exactly the declared action\'s damage', () => {
    // Act: declare then applyActionImpact(battle, declared).
    // Assert: target currentHp decreased by the expected amount;
    // returned targetIds matches.
  })

  it('completeAction runs gauge consumption, wave-spawn, win/loss check, and battle log append', () => {
    // Act: declare -> applyActionImpact -> completeAction.
    // Assert: actor.actionGauge reset; battle.log has a new entry matching
    // the existing BattleLogEntry shape; battle.state updated if the
    // action was lethal.
  })

  it('resolveActorTurn() (thin wrapper) produces byte-identical TurnStepResult to before this task, for a normal basic attack', () => {
    // Compare against the exact same assertion an existing Slice 2 test
    // already makes for resolveActorTurn's return shape.
  })

  it('charge-init turn (Bạt Kiếm Thuật Thế) still works through the split — no hit applied, chargingTurnsRemaining set', () => {
    // Reuse the fixture from an existing charge-mechanic test (grep for
    // "chargeTurns" or "chargingTurnsRemaining" across TurnBattleSystem
    // test files to find it) — drive through resolveActorTurn(), assert
    // identical outcome to before.
  })

  it('charge-resolve turn (Trảm firing) still applies its hit through applyActionImpact, not declareActorAction', () => {
    // Arrange actor.chargingTurnsRemaining = 1. Act: declareActorAction
    // (ticks to 0, but per this task's design the actual hit must move to
    // applyActionImpact — READ the current charge-resolve block (:242-284)
    // carefully: it currently calls combat.resolveActionHit() INLINE
    // during what becomes declareActorAction's territory. This task MUST
    // move that resolveActionHit call into applyActionImpact — capture
    // the resolved targets/damage in the TurnDeclaredAction return value
    // instead of applying immediately. Assert: after declareActorAction
    // alone, target HP unchanged; after applyActionImpact, HP drops.
  })

  it('Reaction Path double-cast (2 random elements) still applies both hits through applyActionImpact', () => {
    // Same pattern — the REACTION_PATH_SPECIAL_ID branch (:372-389) also
    // currently calls resolveActionHit inline during declare-territory;
    // must move to applyActionImpact.
  })

  it('gauge-delta appliesBuff still fires AFTER consumeGaugeAfterAction inside completeAction, unchanged ordering', () => {
    // Reuse an existing Future Systems Task 6 gauge-delta test's fixture.
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run game/src/core/battle/turn/TurnBattleSystem.actionPlayback.test.ts`
Expected: FAIL (new methods don't exist)

- [ ] **Step 3: Define `TurnDeclaredAction` and implement the split**

```ts
export interface TurnDeclaredAction {
  actorId: string
  ccBlocked: boolean
  isCharging: boolean
  chargeResolved: boolean
  isChargeInit: boolean
  chargedSkillId: string
  action: SelectedAction | null
  opposingSide: TurnBattleParticipant[]
  affected: TurnBattleParticipant[]
  scaledDamage: ActionDamageInfo | null
  isReactionPath: boolean
  reactionPathPicks: [TurnSkillDefinition, TurnSkillDefinition] | null
}
```

Move everything from the CURRENT `resolveActorTurn()` body up through action/target selection into `declareActorAction()` — **everything EXCEPT the actual `this.combat.resolveActionHit(...)` calls** (there are 3 call sites today: the charge-resolve block `:275`, the normal-action loop `:394`, and the Reaction Path loop `:383`) **and EXCEPT `commitAction`/`appliesBuff` application** (`:406-427`, which depends on whether hits landed). Everything else (totalTurnsElapsed increment, charge ticking, CC check, buff/resource/boss-trigger ticks, tickCooldowns, stats recompute, target resolution via `selectTarget`/`collectTurnTargets`, sudden-death damage scaling) moves into `declareActorAction()` unchanged, populating the `TurnDeclaredAction` fields the deferred impact application will read.

```ts
applyActionImpact(battle: TurnBattle, declared: TurnDeclaredAction): { targetIds: string[] } {
  const targetIds: string[] = []
  const actor = /* look up by declared.actorId — from battle.players/enemies */

  if (declared.isCharging && declared.chargeResolved) {
    // charge-resolve hits (moved from :272-277)
  } else if (declared.action && declared.affected.length > 0 && !declared.isChargeInit) {
    if (declared.isReactionPath && declared.reactionPathPicks) {
      // reaction path hits (moved from :375-386)
    } else {
      // normal hits + onHitProc (moved from :391-401)
    }
    // commitAction + appliesBuff (moved from :403-427)
  }

  return { targetIds }
}

completeAction(battle: TurnBattle, actor: TurnBattleParticipant, declared: TurnDeclaredAction, targetIds: string[]): TurnStepResult {
  // consumeGaugeAfterAction, gauge-delta push, wave spawn, win/loss check,
  // battle log entry (moved from :439-484), unchanged.
}

resolveActorTurn(battle: TurnBattle, actor: TurnBattleParticipant, forcedSkillSlot?: TurnSkillSlotRole): TurnStepResult {
  const declared = this.declareActorAction(battle, actor, forcedSkillSlot)
  const { targetIds } = this.applyActionImpact(battle, declared)
  return this.completeAction(battle, actor, declared, targetIds)
}
```

Note: this is a REAL refactor of a ~270-line method with several interacting special cases — do not guess the exact line-by-line move, work directly against the file you just read in Task 1/this task's opening instruction, moving code verbatim and only changing what MUST change (deferring the 3 `resolveActionHit` call sites + their immediate follow-up bookkeeping).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run game/src/core/battle/turn/TurnBattleSystem.actionPlayback.test.ts`
Expected: PASS

- [ ] **Step 5: Run the FULL `turn/` suite to confirm zero regression**

Run: `npx vitest run game/src/core/battle/turn`
Expected: PASS, identical pass count to before this task — this is the critical check, since this task touches the single most complex method in the whole turn-based engine (charge mechanic, Reaction Path, gauge-delta, party, all interacting).

- [ ] **Step 6: Run typecheck**

Run: `npx vue-tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add game/src/core/battle/turn/TurnBattleSystem.ts game/src/core/battle/turn/TurnBattleSystem.actionPlayback.test.ts
git commit -m "feat(turn-combat): split resolveActorTurn into declareActorAction/applyActionImpact/completeAction"
```

---

### Task 4: Turn-based presentation event emitter (`attack`/`action_impact`/`turn_ready`/`turn_standby_complete`)

**Files:**
- Create: `game/src/core/battle/turn/TurnActionPresentationEvents.ts`
- Test: `game/src/core/battle/turn/TurnActionPresentationEvents.test.ts` (new)

**Interfaces:**
- Consumes: `EventBus` (existing), `TurnDeclaredAction`/target resolution results (Task 3), `ActionImpactEvent`'s exact shape (Task 1 Step 3).
- Produces: `emitTurnReady(eventBus, actorId)`, `emitTurnCastStart(eventBus, actorId, skillId, targetIds)` (reuses the `attack` event name/shape per spec §4.2 — `CombatScenePayload`-compatible), `emitTurnActionImpact(eventBus, params)` (reuses `action_impact`/`ActionImpactEvent` shape), `emitTurnStandbyComplete(eventBus, actorId)`. Task 6 (`GameManager`) is the sole caller.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it, vi } from 'vitest'
import { EventBus } from '../../events/EventBus'
import { emitTurnReady, emitTurnCastStart, emitTurnActionImpact, emitTurnStandbyComplete } from './TurnActionPresentationEvents'

describe('TurnActionPresentationEvents', () => {
  it('emitTurnReady emits turn_ready with actorId', () => {
    const bus = new EventBus()
    const handler = vi.fn()
    bus.on('turn_ready', handler)
    emitTurnReady(bus, 'player-1')
    expect(handler).toHaveBeenCalledWith({ actorId: 'player-1' })
  })

  it('emitTurnCastStart emits attack with matching CombatScenePayload shape', () => {
    const bus = new EventBus()
    const handler = vi.fn()
    bus.on('attack', handler)
    emitTurnCastStart(bus, 'player-1', 'basic_attack', ['enemy-1'])
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ sourceId: 'player-1', skillId: 'basic_attack' }))
  })

  it('emitTurnActionImpact emits action_impact with the exact ActionImpactEvent field set', () => {
    // Assert every field Task 1 Step 3 confirmed is present (actionId,
    // sourceId, primaryTargetId, anchorCell, affectedTargetIds,
    // landedTargetIds, dodgedTargetIds, affectedArea, hitCount, presetId).
  })

  it('emitTurnActionImpact falls back to a default presetId when the skill has none', () => {
    // Confirms Task 2's optional presetId field degrades safely.
  })

  it('emitTurnStandbyComplete emits turn_standby_complete with actorId', () => {})
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run game/src/core/battle/turn/TurnActionPresentationEvents.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

```ts
import type { EventBus } from '../../events/EventBus'
import type { GridPosition, CellArea } from '../BattleGrid'
import type { CombatVfxPresetId, ActionTargetingShape } from '../CombatAction'

const DEFAULT_PRESET_ID: CombatVfxPresetId = /* pick the codebase's existing generic/fallback preset id — check COMBAT_VFX_PRESETS in CombatVfxPresets.ts for a suitable default (Task 1's survey didn't confirm this — read that file before hardcoding a value) */

export function emitTurnReady(eventBus: EventBus, actorId: string): void {
  eventBus.emit('turn_ready', { actorId })
}

export function emitTurnCastStart(eventBus: EventBus, sourceId: string, skillId: string, targetIds: string[]): void {
  const targetId = targetIds[0]
  eventBus.emit('attack', { type: 'attack', sourceId, targetId, skillId } as never)
}

export interface TurnActionImpactParams {
  actionId: string
  sourceId: string
  primaryTargetId: string
  anchorCell: GridPosition
  affectedArea: CellArea & { shape: ActionTargetingShape }
  affectedTargetIds: string[]
  landedTargetIds: string[]
  dodgedTargetIds: string[]
  hitCount: number
  presetId?: CombatVfxPresetId
}

export function emitTurnActionImpact(eventBus: EventBus, params: TurnActionImpactParams): void {
  eventBus.emit('action_impact', {
    type: 'action_impact',
    actionId: params.actionId,
    actionInstanceId: `turn-act-${params.actionId}`,
    sourceId: params.sourceId,
    primaryTargetId: params.primaryTargetId,
    anchorCell: params.anchorCell,
    affectedTargetIds: params.affectedTargetIds,
    landedTargetIds: params.landedTargetIds,
    dodgedTargetIds: params.dodgedTargetIds,
    affectedArea: params.affectedArea,
    hitCount: params.hitCount,
    presetId: params.presetId ?? DEFAULT_PRESET_ID,
  } as never)
}

export function emitTurnStandbyComplete(eventBus: EventBus, actorId: string): void {
  eventBus.emit('turn_standby_complete', { actorId })
}
```

Adjust field names exactly to whatever Task 1 Step 3 confirmed for `ActionImpactEvent` — the shape above is this plan's best-known approximation from `ActionImpactSystem.ts:209-222`, not a guaranteed-current read.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run game/src/core/battle/turn/TurnActionPresentationEvents.test.ts`
Expected: PASS

- [ ] **Step 5: Run typecheck**

Run: `npx vue-tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add game/src/core/battle/turn/TurnActionPresentationEvents.ts game/src/core/battle/turn/TurnActionPresentationEvents.test.ts
git commit -m "feat(turn-combat): standalone presentation event emitter for turn_ready/attack/action_impact/turn_standby_complete"
```

---

### Task 5: `reactiveTrigger` buff effect kind

**Files:**
- Modify: `game/src/core/battle/turn/TurnBuffTypes.ts` (effect union — read current union fresh, last known: `dot`/`cc`/`statModifier`/`onHitProc`/`gaugeDelta`, confirm before editing since Future Systems Task 6 already added `gaugeDelta`)
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts` (`declareActorAction`'s CC-check section, `applyActionImpact`'s hit-resolution section — both from Task 3)
- Test: `game/src/core/battle/turn/TurnBuffSystem.reactiveTrigger.test.ts` (new)

**Interfaces:**
- Consumes: `TurnBuffPool`/`TurnBuffSystem` (existing), `TurnDeclaredAction`/`declareActorAction`/`applyActionImpact` (Task 3), `TurnBattle.queuedFollowUpActorId` (Task 2).
- Produces: `TurnReactiveTriggerEffect` type, `TurnBuffSystem.rollReactiveTrigger(entity, trigger: 'onCastBegin' | 'onImpactLanded', registry): void` (or similar — mirror the exact method-naming convention `rollOnHitEffects` already uses).

- [ ] **Step 1: Read `TurnBuffTypes.ts`'s current effect union fully**

- [ ] **Step 2: Write the failing tests**

```ts
describe('TurnBuffSystem — reactiveTrigger effect', () => {
  it('onCastBegin: rolls chance, applies appliesDefinitionId buff to the actor when it fires', () => {
    // Arrange actor with a reactiveTrigger(onCastBegin, chance=1, appliesDefinitionId='stun_def').
    // Act: declareActorAction(battle, actor) (Task 3).
    // Assert: actor.buffs now carries the stun buff.
  })

  it('onCastBegin punish that applies a hard-CC buff cancels the in-progress cast (existing CC-check runs AFTER the trigger)', () => {
    // Assert: declared.ccBlocked === true, and applyActionImpact produces
    // no hits for this actor's declared action.
  })

  it('onImpactLanded: rolls chance on the target hit, sets battle.queuedFollowUpActorId when queuesFollowUp is true', () => {
    // Arrange target with reactiveTrigger(onImpactLanded, chance=1, queuesFollowUp=true).
    // Act: declareActorAction then applyActionImpact against that target.
    // Assert: battle.queuedFollowUpActorId === target.id.
  })

  it('chance=0 never fires', () => {})
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run game/src/core/battle/turn/TurnBuffSystem.reactiveTrigger.test.ts`

- [ ] **Step 4: Implement**

Add to the effect union:

```ts
export interface TurnReactiveTriggerEffect {
  type: 'reactiveTrigger'
  trigger: 'onCastBegin' | 'onImpactLanded'
  chance: number
  appliesDefinitionId?: string
  queuesFollowUp?: boolean
}
```

Add a query method on `TurnBuffSystem` (mirror `rollOnHitEffects`'s existing style — read it first for exact conventions: random roll source, how it iterates active buffs/effects):

```ts
rollReactiveTrigger(
  entity: CombatEntity,
  trigger: 'onCastBegin' | 'onImpactLanded',
  registry: TurnBuffRegistry,
): { firedFollowUp: boolean } {
  // iterate this.pool's active buffs' effects, filter type==='reactiveTrigger' && effect.trigger===trigger,
  // roll effect.chance, on success: if appliesDefinitionId, apply that buff to entity via registry;
  // if queuesFollowUp, return firedFollowUp: true.
}
```

Wire into `TurnBattleSystem.ts`:
- In `declareActorAction()`, immediately BEFORE the existing CC-check (`hardCcActive = ...`), call `actorBuffSystem.rollReactiveTrigger(actor.entity, 'onCastBegin', this.registry)` (guarded by `this.registry` existing, matching every other registry-gated call in this file) — the CC-check that follows already reads current buff state, so no other change needed there (per spec §4.2's ordering).
- In `applyActionImpact()`, right after each landed hit's existing `rollOnHitEffects` call, also call `new TurnBuffSystem(target.buffs).rollReactiveTrigger(target.entity, 'onImpactLanded', this.registry)` — if it returns `firedFollowUp: true`, set `battle.queuedFollowUpActorId = target.id`.

- [ ] **Step 5: Wire `queuedFollowUpActorId` into `peekNextActor()`/the turn-cycle transition**

In `TurnBattleSystem.peekNextActor()`, if `battle.queuedFollowUpActorId` is set, clear it and return that participant directly (bypassing the normal gauge-based `resolveNextTurn()` call) — this is the `standby → ready` chain from spec §4.5. Add a test confirming a queued follow-up actor is returned by the NEXT `peekNextActor()` call regardless of gauge state.

- [ ] **Step 6: Run tests to verify they pass, then full `turn/` suite**

Run: `npx vitest run game/src/core/battle/turn/TurnBuffSystem.reactiveTrigger.test.ts`
Run: `npx vitest run game/src/core/battle/turn`
Expected: PASS both, no regression

- [ ] **Step 7: Run typecheck**

- [ ] **Step 8: Commit**

```bash
git add game/src/core/battle/turn/TurnBuffTypes.ts game/src/core/battle/turn/TurnBattleSystem.ts game/src/core/battle/turn/TurnBuffSystem.reactiveTrigger.test.ts
git commit -m "feat(turn-combat): reactiveTrigger buff effect (onCastBegin punish, onImpactLanded counter/follow-up)"
```

---

### Task 6: `GameManager` presentation orchestration

**Files:**
- Modify: `game/src/core/game/GameManager.ts` (`updateBattleFixedStep`, `submitTurnChoice`, and surrounding fields — read Task 1 Step 2's fresh line numbers before editing)
- Test: `game/src/core/game/GameManager.actionPlayback.test.ts` (new)

**Interfaces:**
- Consumes: `TurnBattleSystem.declareActorAction`/`applyActionImpact`/`completeAction` (Task 3), `emitTurnReady`/`emitTurnCastStart`/`emitTurnActionImpact`/`emitTurnStandbyComplete` (Task 4).
- Produces: `GameManager.setPresentationActive(active: boolean): void`, `GameManager.acknowledgeTurnReady(): void`, `GameManager.acknowledgeActionImpact(): void`, `GameManager.acknowledgeActionComplete(): void`.

- [ ] **Step 1: Write the failing tests**

Read `game/src/core/game/GameManager.zone.test.ts` (or whichever sibling test already exercises `submitTurnChoice`/`awaitedManualActor` — likely a Slice 7 test file, e.g. `GameManager.manualCombat.test.ts` if that name matches what actually landed) for the exact harness pattern.

```ts
describe('GameManager — presentation orchestration (presentationActive=true)', () => {
  it('when presentationActive is false (default), a fixed-step tick resolves the actor turn instantly as before (zero behavior change)', () => {
    // This is the critical non-regression assertion — every existing
    // auto-mode/repeat/progress/manual test must keep passing with
    // presentationActive left at its default false.
  })

  it('when presentationActive is true, peekNextActor finding an actor emits turn_ready and PAUSES (no declare/impact/complete yet)', () => {
    // Arrange presentationActive = true via setPresentationActive(true).
    // Act: tick(). Assert: eventBus 'turn_ready' fired once with the
    // expected actorId; target HP unchanged; battle.state still 'fighting'.
  })

  it('acknowledgeTurnReady (non-manual actor) declares the action and emits attack/cast_start, still no damage applied', () => {
    // Act: tick() then acknowledgeTurnReady(). Assert: 'attack' event
    // fired; target HP still unchanged (declare only).
  })

  it('acknowledgeTurnReady (manual player actor, battleManualMode on) falls through to the EXISTING awaitedManualActor wait, unchanged from Slice 7', () => {
    // Confirms this task doesn't disturb Slice 7's manual-choice flow —
    // it only adds a 'ready' wait BEFORE it, not instead of it.
  })

  it('acknowledgeActionImpact applies the declared action\'s damage and emits action_impact', () => {})

  it('acknowledgeActionComplete runs turn cleanup and emits turn_standby_complete, then the NEXT tick can peek a new actor', () => {})

  it('submitTurnChoice, when presentationActive is true, declares the chosen action instead of resolving it immediately, entering the same impact-wait state', () => {
    // This is the integration point with Slice 7's existing manual flow —
    // submitTurnChoice's current body calls resolveActorTurn() directly
    // (GameManager.ts:2538 per this session's survey); when
    // presentationActive, it must instead call declareActorAction and
    // enter the pendingDeclaredAction wait, matching the auto-turn path.
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run game/src/core/game/GameManager.actionPlayback.test.ts`

- [ ] **Step 3: Implement the orchestration fields/methods**

```ts
private presentationActive = false
private pendingReadyActor: TurnBattleParticipant | null = null
private pendingDeclaredAction: { actor: TurnBattleParticipant; declared: TurnDeclaredAction } | null = null
private pendingImpact: { actor: TurnBattleParticipant; declared: TurnDeclaredAction; targetIds: string[] } | null = null

setPresentationActive(active: boolean): void {
  this.presentationActive = active
}

acknowledgeTurnReady(): void {
  if (!this.pendingReadyActor || !this.turnBattle) return

  const actor = this.pendingReadyActor
  this.pendingReadyActor = null

  if (this.battleManualMode && this.turnBattle.players.includes(actor)) {
    this.awaitedManualActor = actor // existing Slice 7 wait, unchanged
    return
  }

  const declared = this.turnBattleSystem.declareActorAction(this.turnBattle, actor)
  this.pendingDeclaredAction = { actor, declared }

  emitTurnCastStart(this.eventBus, actor.id, declared.action?.skillId ?? '', [])
}

acknowledgeActionImpact(): void {
  if (!this.pendingDeclaredAction || !this.turnBattle) return

  const { actor, declared } = this.pendingDeclaredAction
  this.pendingDeclaredAction = null

  const { targetIds } = this.turnBattleSystem.applyActionImpact(this.turnBattle, declared)
  this.pendingImpact = { actor, declared, targetIds }

  // emitTurnActionImpact(...) — params sourced from declared/targetIds;
  // exact anchorCell/affectedArea computation needs the same grid helpers
  // TurnBattleSystem already uses (entityGridPosition/collectTurnTargets) —
  // read how Task 4's params are actually shaped before wiring this call,
  // this plan does not re-derive that grid math here.
}

acknowledgeActionComplete(): void {
  if (!this.pendingImpact || !this.turnBattle) return

  const { actor, declared, targetIds } = this.pendingImpact
  this.pendingImpact = null

  this.turnBattleSystem.completeAction(this.turnBattle, actor, declared, targetIds)
  emitTurnStandbyComplete(this.eventBus, actor.id)

  this.syncLegacyBattleState()
}
```

- [ ] **Step 4: Rewire `updateBattleFixedStep`'s manual-mode branch**

Read the CURRENT branch (`GameManager.ts:3328-3350` per this session's survey — re-verify) and change the `else if (this.turnBattle.state === 'fighting')` block to:

```ts
        } else if (this.turnBattle.state === 'fighting') {
          if (this.awaitedManualActor) {
            // still paused for player choice — unchanged
          } else if (this.pendingReadyActor || this.pendingDeclaredAction || this.pendingImpact) {
            // waiting for a Phaser acknowledgement — do nothing this tick
          } else if (this.presentationActive) {
            const actor = this.turnBattleSystem.peekNextActor(this.turnBattle)

            if (actor !== null) {
              this.pendingReadyActor = actor
              emitTurnReady(this.eventBus, actor.id)
            }
          } else if (this.battleManualMode) {
            // existing Slice 7 logic, UNCHANGED
            const actor = this.turnBattleSystem.peekNextActor(this.turnBattle)

            if (actor !== null && this.turnBattle.players.includes(actor)) {
              this.awaitedManualActor = actor
            } else if (actor !== null) {
              this.turnBattleSystem.resolveActorTurn(this.turnBattle, actor)
            }
          } else {
            this.turnBattleSystem.resolveNextStep(this.turnBattle)
          }
        }
```

- [ ] **Step 5: Update `submitTurnChoice` for the `presentationActive` case**

```ts
  submitTurnChoice(role: TurnSkillSlotRole): boolean {
    if (!this.awaitedManualActor || !this.turnBattle) {
      return false
    }

    const actor = this.awaitedManualActor
    this.awaitedManualActor = null

    if (this.presentationActive) {
      const declared = this.turnBattleSystem.declareActorAction(this.turnBattle, actor, role)
      this.pendingDeclaredAction = { actor, declared }
      emitTurnCastStart(this.eventBus, actor.id, declared.action?.skillId ?? '', [])
    } else {
      this.turnBattleSystem.resolveActorTurn(this.turnBattle, actor, role)
    }

    this.syncLegacyBattleState()

    return true
  }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run game/src/core/game/GameManager.actionPlayback.test.ts`

- [ ] **Step 7: Run the FULL `battle/`+`game/` suites to confirm zero regression at `presentationActive=false`**

Run: `npx vitest run game/src/core/battle game/src/core/game`
Expected: PASS, identical to before this task

- [ ] **Step 8: Run typecheck**

- [ ] **Step 9: Commit**

```bash
git add game/src/core/game/GameManager.ts game/src/core/game/GameManager.actionPlayback.test.ts
git commit -m "feat(turn-combat): GameManager presentation orchestration (presentationActive flag + 3 acknowledge methods)"
```

---

### Task 7: `CombatScene.ts` wiring

**Files:**
- Modify: `game/src/game/scenes/CombatScene.ts` (mount/unmount lifecycle per Task 1 Step 1; add 3 new event handlers to `getCombatEventBindings()`)

**Interfaces:**
- Consumes: `GameManager.setPresentationActive`/`acknowledgeTurnReady`/`acknowledgeActionImpact`/`acknowledgeActionComplete` (Task 6).

- [ ] **Step 1: Call `setPresentationActive` on mount/unmount**

In whichever method Task 1 Step 1 confirmed calls `subscribeCombatEvents()`, add `this.gameManagerRef.setPresentationActive(true)` (match however this scene currently accesses `GameManager` — likely `this.registry.get('gameManager')`, same pattern as `subscribeCombatEvents`'s `this.registry.get('eventBus')`); call `setPresentationActive(false)` in the unmount/shutdown counterpart.

- [ ] **Step 2: Add `turn_ready` handler**

Add to `getCombatEventBindings()`: `['turn_ready', (event: { actorId: string }) => this.onTurnReady(event)]`. Implement `onTurnReady`: play a short "ready" transition on the actor's sprite (reuse `CombatVfxSpawner.playMaterializeFadeIn`-style tween pattern already in the codebase, or a simpler flash/pulse — exact visual not designed by this plan's spec, minimal placeholder is fine for this task), then call `this.gameManagerRef.acknowledgeTurnReady()` in the tween's `onComplete`.

- [ ] **Step 3: Add `turn_standby_complete` handler**

`['turn_standby_complete', (event: { actorId: string }) => this.onTurnStandbyComplete(event)]` — this fires once the engine has already run `completeAction()` server-side (§4.5's cleanup already happened by the time this event arrives), so this handler is presentation-only bookkeeping (e.g., clearing any "acting" visual state) — does NOT call any acknowledge method itself (nothing left to acknowledge, this is the tail event, not a wait-gate).

- [ ] **Step 4: Wire the impact acknowledgement into the EXISTING `attack`/`onAttack` handling**

The existing `onAttack` handler (`CombatScene.ts:1385-1394` per an earlier survey this session, plays `playHorizontalImpulse`) already plays the lunge tween on the `attack` event Task 6 now also emits for turn-based casts. Add an `onComplete` (or a `delayedCall` at the tween's midpoint, matching this file's existing impact-frame conventions if any exist — check for a precedent before inventing timing) that calls `this.gameManagerRef.acknowledgeActionImpact()`. This is the literal "impact frame" moment from spec §4.2/4.3.

- [ ] **Step 5: Wire the complete acknowledgement into the EXISTING `action_impact`/`onActionImpact` handling**

`onActionImpact` (`CombatScene.ts:1722-1724`) delegates to `this.vfxSpawner.onActionImpact(event)`, which spawns the VFX preset's tween (`ActionImpactVfx.ts`'s `spawnActionImpactVfx`, `duration: preset.durationMs * pulseCount`). Add an `onComplete` callback (the tween already has one at `ActionImpactVfx.ts:118-122` destroying the graphics objects) that ALSO calls `this.gameManagerRef.acknowledgeActionComplete()` — this is the "VFX fully finished" moment from spec §4.4.

- [ ] **Step 6: Manual smoke test**

Run the dev server, start any stage battle (manual or auto mode), confirm: combat visibly paces out (ready flourish → attack lunge → impact VFX → next actor), no dangling waits (battle doesn't freeze), auto-farm/other headless paths unaffected (spot-check by running an auto-farm cycle and confirming no crash — it never touches `TurnBattleSystem` at all per this session's earlier confirmation, so this should be a no-op check).

- [ ] **Step 7: Run typecheck**

Run: `npx vue-tsc --noEmit`

- [ ] **Step 8: Commit**

```bash
git add game/src/game/scenes/CombatScene.ts
git commit -m "feat(turn-combat): wire CombatScene to Action Playback's 3-signal handshake (ready/impact/complete)"
```

---

### Task 8: Full-suite verification + roadmap update

**Files:** verification, then `game/docs/turn-based-combat-roadmap.md`

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS, no regressions anywhere — `presentationActive` defaults `false` everywhere except the live `CombatScene`, so this must be a clean, unchanged pass count outside the new test files this plan added.

- [ ] **Step 2: Run full typecheck**

Run: `npx vue-tsc --noEmit`

- [ ] **Step 3: Update `game/docs/turn-based-combat-roadmap.md`**

Add a new entry (this feature wasn't tracked in the roadmap before this session — it was discovered live) documenting: what shipped (5-phase Action Playback state machine, `reactiveTrigger` effect kind, `presentationActive` flag), and explicitly note `reactiveTrigger` content (which skills/enemies use punish-on-cast or counter) remains unassigned/future work.

- [ ] **Step 4: Commit**

```bash
git add game/docs/turn-based-combat-roadmap.md
git commit -m "docs: roadmap - Turn Combat Action Playback implemented + merged"
```

## Self-Review Notes (for the plan writer, kept for traceability)

- **Spec coverage**: §4.1-4.5 (state machine) → Tasks 3/6/7. §5 (multi-target single-cycle) → preserved automatically since Task 3's split keeps the existing per-skill hit loop intact inside one `applyActionImpact()` call, not per-target. §6 (`reactiveTrigger`) → Task 5. §7 (headless compatibility via `presentationActive` default false) → verified explicitly in Task 6 Step 7 and Task 8 Step 1.
- **Real complexity found beyond the spec's assumption**: the spec was written against an earlier, simpler mental model of `resolveActorTurn()`; the actual current method (confirmed by survey while writing this plan) has grown to include the charge mechanic (Bạt Kiếm Thuật), Reaction Path double-cast, and gauge-delta deferral — all of which have their OWN `combat.resolveActionHit()` call sites that must move into `applyActionImpact()`. Task 3 calls this out explicitly rather than presenting a falsely-simple split.
- **Type consistency**: `TurnDeclaredAction` (Task 3) is threaded identically through Task 5 (reactive triggers read/mutate it) and Task 6 (`GameManager`'s `pendingDeclaredAction`/`pendingImpact` fields store it) — no renamed fields between tasks.
- **Known follow-up not covered**: exact `anchorCell`/`affectedArea` grid computation for `emitTurnActionImpact`'s call site in Task 6 Step 3 is flagged as needing a fresh read rather than guessed — turn-based targeting's existing grid helpers (`entityGridPosition`, `collectTurnTargets`) compute enough of this already, but this plan doesn't re-derive the exact call, matching this session's established convention of not fabricating precise values in already-uncertain integration glue.
