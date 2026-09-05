# Turn-Based Combat — Defect Fix Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 8 confirmed/possible bugs found by a full review of the shipped turn-based combat system (engine core, Action Playback presentation layer, Slice 7 manual UI), plus remove a duplicate UI surface — without changing any external behavior that isn't broken.

**Architecture:** Each task is an isolated bugfix in the existing `game/src/core/battle/turn/` engine or `GameManager.ts` orchestration layer. No new subsystems. Two tasks touch Vue UI (dead-code removal only). Tasks are ordered core-engine-first (highest blast radius, most foundational) then orchestration, then UI, then polish — each is independently testable and revertible.

**Tech Stack:** Vue 3 + TypeScript, Vitest, Phaser (referenced but not driven by tests — Phaser-side fixes are verified by code inspection + existing GameManager-level tests).

**Spec:** No separate design spec — this plan documents its own findings inline per task (a defect-fix batch, not a new feature). Original design context: `docs/superpowers/specs/2026-09-05-turn-combat-action-playback-design.md` and `docs/superpowers/plans/2026-09-05-turn-combat-action-playback.md` (the shipped work being patched).

## Global Constraints

- TypeScript, no `any`.
- Do not change `resolveActorTurn(battle, actor, forcedSkillSlot?)`'s public signature — it is asserted "byte-identical" by an existing test (`TurnBattleSystem.actionPlayback.test.ts:111`) and consumed by callers outside this plan's scope.
- Do not touch `game/src/core/battle/legacy/**` (retired real-time engine, kept for reference only).
- Every task must leave `npx vitest run` and `npx vue-tsc --noEmit` clean before moving to the next task.
- Vietnamese comments/strings follow the codebase's existing convention (see any file in `game/src/core/battle/turn/`) — match it in new code.

---

## Task 1: Fix `queuedFollowUpActorId` — dead in production (counter/follow-up never fires in real gameplay)

**The bug:** `TurnBattleSystem.applyActionImpact()` sets `battle.queuedFollowUpActorId` when a `reactiveTrigger` counter buff fires (`TurnBattleSystem.ts:611`). That field is only ever read by `peekNextActor()` (`TurnBattleSystem.ts:296-316`). But the actual production game loop — `GameManager.updateBattleFixedStep()` — drives every turn through `tickPacing()` (`GameManager.ts:3499`), which **never calls `peekNextActor()` and never reads the field**. Result: the entire counter/follow-up mechanic (Action Playback Task 5) is dead code in the shipped game. It only "works" in `TurnBuffSystem.reactiveTrigger.test.ts` because that test calls `peekNextActor()` directly.

Two related defects in the same code path, fixed together since they touch the same lines:
- **AOE overwrite**: `battle.queuedFollowUpActorId = target.id` runs inside a `for (const target of declared.affected)` loop (`TurnBattleSystem.ts:589-615`) — if an AOE hit triggers counters on 2+ targets, only the last one survives (single string field, not a queue).
- **Gauge bypass not honored**: `completeAction()` unconditionally calls `consumeGaugeAfterAction(actor)` (`TurnBattleSystem.ts:663`), which resets `actionGauge` to 0 even for a follow-up/counter actor — contradicting the "bypass gauge" intent documented in `peekNextActor()`'s own comment (`TurnBattleSystem.ts:302-303`). A counter-attacker should not lose progress toward their own next real turn as a side effect of reacting.

This task also adds a **reciprocity depth guard**: without one, two entities both holding `onImpactLanded` counter buffs could in theory chain-bounce follow-ups indefinitely (A's follow-up hits B, B counters, hits A, A counters, forever), starving the rest of the turn order. Cap the chain and fall back to normal gauge order once the cap is hit.

**Files:**
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts`
- Modify: `game/src/core/battle/turn/TurnBuffSystem.reactiveTrigger.test.ts` (existing assertions reference the field being renamed to a queue)
- Test: `game/src/core/battle/turn/TurnBattleSystem.followUpQueue.test.ts` (new file)

**Interfaces:**
- Produces: `TurnBattle.queuedFollowUpActorIds?: string[]` (replaces `queuedFollowUpActorId?: string`), `TurnBattle.followUpChainDepth?: number`, `TurnDeclaredAction.isFollowUpBypass: boolean` (new field, read by `completeAction`).
- Consumes: `ActionGauge.consumeGaugeAfterAction(actor, fractionConsumed = 1)` — already accepts a `fractionConsumed` param (`game/src/core/battle/turn/ActionGauge.ts:28`), no change needed there.

- [ ] **Step 1: Write the failing test proving the production bug**

Create `game/src/core/battle/turn/TurnBattleSystem.followUpQueue.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { TurnBuffDefinition, TurnBuffRegistry } from './TurnBuffTypes'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import { TurnBuffPool } from './TurnBuffPool'
import { TurnBuffSystem } from './TurnBuffSystem'

const COUNTER_DEF: TurnBuffDefinition = {
  id: 'react_counter',
  name: 'Counter Stance',
  polarity: 'buff',
  duration: 2,
  stackMode: 'refresh',
  effects: [{ type: 'reactiveTrigger', trigger: 'onImpactLanded', chance: 1, queuesFollowUp: true }],
}

class Registry implements TurnBuffRegistry {
  private readonly defs = new Map<string, TurnBuffDefinition>()
  constructor(defs: TurnBuffDefinition[]) {
    for (const d of defs) this.defs.set(d.id, d)
  }
  get(id: string): TurnBuffDefinition {
    const d = this.defs.get(id)
    if (!d) throw new Error(`missing buff: ${id}`)
    return d
  }
}

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0 }
  return {
    id: 'id', name: 'name', type: 'enemy', baseStats: stats, stats,
    currentHp: stats.maxHp, maxHp: stats.maxHp, currentMp: stats.maxMp,
    currentSwordIntent: 0, currentMomentum: 0, currentHoaThe: 0, currentThoThe: 0, currentKimThe: 0,
    timeSinceLastBleedProc: 0, tuLucActive: false, tuLucElapsed: 0, tuLucDamageTakenPercent: 0,
    currentWard: 0, timeSinceLastHitTaken: Infinity, realmIndex: 0, x: 0, row: 2, alive: true,
    ...overrides,
  } as CombatEntity
}

function makeParticipant(id: string, entity: CombatEntity, speed: number, priority: number): TurnBattleParticipant {
  return {
    id, entity, speed, priority, actionGauge: 0, alive: entity.alive,
    buffs: new TurnBuffPool(), consecutiveHardCcTurns: 0,
    basic: { id: `${id}_basic`, cooldownTurns: 0, damage: { kind: 'physical', multiplier: 1 }, targeting: { shape: 'single' } },
  }
}

function fixture() {
  const player = createCombatant({
    id: 'player', type: 'player', row: 4,
    stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, speed: 100, attack: 100 },
  })
  const enemyEntity = createCombatant({
    id: 'enemy', currentHp: 1_000_000, maxHp: 1_000_000,
    stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, speed: 100, attack: 0 },
  })

  const playerParticipant = makeParticipant('player', player, 100, 0)
  const enemyParticipant = makeParticipant('enemy', enemyEntity, 100, 1)
  const registry = new Registry([COUNTER_DEF])
  const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, registry)

  new TurnBuffSystem(enemyParticipant.buffs).apply(COUNTER_DEF, player, enemyEntity, registry)

  const battle: TurnBattle = {
    players: [playerParticipant],
    enemies: [enemyParticipant],
    state: 'fighting',
  }

  return { battle, system, playerParticipant, enemyParticipant }
}

describe('TurnBattleSystem — queuedFollowUpActorIds honored by the PRODUCTION loop (tickPacing)', () => {
  it('tickPacing() grants the queued follow-up actor a bypass turn on the NEXT call, not just peekNextActor()', () => {
    const { battle, system, enemyParticipant } = fixture()

    // Player's gauge-ready turn resolves via tickPacing (the real game-loop
    // entry point) — hits enemy, enemy's counter buff fires, queues itself.
    const firstActor = system.tickPacing(battle)
    expect(firstActor?.id).toBe('player')
    expect(battle.queuedFollowUpActorIds).toEqual(['enemy'])

    // Enemy's own gauge is nowhere near ready yet (fresh actionGauge=0,
    // needs many ticks) — the ONLY way it can act next is the bypass queue.
    expect(enemyParticipant.actionGauge).toBeLessThan(1)

    const secondActor = system.tickPacing(battle)

    expect(secondActor?.id).toBe('enemy')
    expect(battle.queuedFollowUpActorIds).toBeUndefined()
  })

  it('bypass turn does NOT consume the follow-up actor\'s own gauge progress', () => {
    const { battle, system, enemyParticipant } = fixture()

    system.tickPacing(battle) // player turn, queues enemy follow-up
    enemyParticipant.actionGauge = 500 // simulate enemy had already built up progress

    system.tickPacing(battle) // enemy's bypass turn

    expect(enemyParticipant.actionGauge).toBe(500)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run TurnBattleSystem.followUpQueue.test.ts`
Expected: FAIL on the first test — `secondActor?.id` is `undefined`, not `'enemy'` (because `tickPacing` ignores the queue and the enemy's real gauge isn't ready).

- [ ] **Step 3: Rename the field to a queue and add the reciprocity depth guard**

In `game/src/core/battle/turn/TurnBattleSystem.ts`, replace the `TurnBattle` interface field (currently `queuedFollowUpActorId?: string` at line 107):

```ts
  /** Action Playback (2026-09-05) — counter/follow-up (§6 spec): actors queued
   * here jump straight to 'ready' after the current turn's standby, bypassing
   * gauge. FIFO queue (not a single id) so an AOE hit that triggers multiple
   * counters doesn't drop all but the last one. */
  queuedFollowUpActorIds?: string[]
  /** Reciprocity guard: counts consecutive bypass turns granted via the queue
   * above, without an intervening normal gauge-ready turn. Reset to 0 the
   * moment a normal turn resolves; capped in dequeueFollowUpActor() so two
   * counter-buffed entities can't bounce follow-ups on each other forever. */
  followUpChainDepth?: number
```

Add a constant near the top of the file (after existing top-level constants, e.g. near `DEFAULT_MAX_TURNS`):

```ts
const MAX_FOLLOW_UP_CHAIN_DEPTH = 4
```

Add `isFollowUpBypass: boolean` to the `TurnDeclaredAction` interface (after `reactionPathPicks`):

```ts
  /** True if this turn was granted via the follow-up/counter bypass queue
   * rather than normal gauge readiness — completeAction() skips gauge
   * consumption for these (bypass shouldn't cost the reactor their own
   * next-turn progress). */
  isFollowUpBypass: boolean
```

Add a private field and a shared dequeue helper to the `TurnBattleSystem` class (near `pendingGaugeDeltaTargets`):

```ts
  /** Set by dequeueFollowUpActor() right before returning a bypass actor;
   * read once by declareActorAction() to populate TurnDeclaredAction.isFollowUpBypass,
   * then cleared. Bridges tickPacing/peekNextActor's return value to the
   * later declareActorAction() call (same pattern as pendingGaugeDeltaTargets). */
  private pendingFollowUpBypassActorId: string | null = null

  /**
   * Shared by tickPacing() and peekNextActor() — dequeues the next queued
   * follow-up actor (if any, and alive, and under the reciprocity cap).
   * Skips dead actors' ids without consuming the chain-depth budget for them.
   */
  private dequeueFollowUpActor(battle: TurnBattle): TurnBattleParticipant | null {
    const queue = battle.queuedFollowUpActorIds

    if (!queue || queue.length === 0) {
      return null
    }

    if ((battle.followUpChainDepth ?? 0) >= MAX_FOLLOW_UP_CHAIN_DEPTH) {
      // Reciprocity guard tripped — drop the rest of the queue, fall back
      // to normal gauge order instead of bouncing forever.
      battle.queuedFollowUpActorIds = undefined
      battle.followUpChainDepth = 0
      return null
    }

    const queuedId = queue.shift()

    if (queue.length === 0) {
      battle.queuedFollowUpActorIds = undefined
    }

    const queued =
      battle.players.find((member) => member.id === queuedId) ??
      battle.enemies.find((enemy) => enemy.id === queuedId)

    if (!queued || !queued.alive) {
      return this.dequeueFollowUpActor(battle)
    }

    battle.followUpChainDepth = (battle.followUpChainDepth ?? 0) + 1
    this.pendingFollowUpBypassActorId = queued.id

    return queued
  }
```

Replace `tickPacing()`'s body (lines 244-286) to check the queue first:

```ts
  tickPacing(battle: TurnBattle, resolve = true): TurnBattleParticipant | null {
    if (battle.state !== 'fighting') {
      return null
    }

    const followUpActor = this.dequeueFollowUpActor(battle)

    if (followUpActor) {
      if (!resolve) {
        return followUpActor
      }

      this.resolveActorTurn(battle, followUpActor)

      return followUpActor
    }

    const allParticipants = [...battle.players, ...battle.enemies]

    for (const participant of allParticipants) {
      participant.alive = participant.entity.alive
    }

    const living = allParticipants.filter((actor) => actor.alive)

    if (living.length === 0) {
      return null
    }

    for (const actor of living) {
      advanceGauge(actor, 1)
    }

    const ready = living.filter(isGaugeReady).sort((a, b) => {
      if (a.speed !== b.speed) {
        return b.speed - a.speed
      }
      return a.priority - b.priority
    })

    const actor = ready[0]

    if (!actor) {
      return null
    }

    battle.followUpChainDepth = 0

    if (!resolve) {
      return actor
    }

    this.resolveActorTurn(battle, actor)

    return actor
  }
```

Replace `peekNextActor()`'s queue-handling block (lines 296-316) to use the same helper — the method keeps its own signature/doc, only the body's queue section changes:

```ts
  peekNextActor(battle: TurnBattle): TurnBattleParticipant | null {
    if (battle.state !== 'fighting') {
      return null
    }

    const followUpActor = this.dequeueFollowUpActor(battle)

    if (followUpActor) {
      return followUpActor
    }

    const allParticipants = [...battle.players, ...battle.enemies]
    // ... (rest of the existing method body from here on is UNCHANGED —
    // gauge advance + ready-sort + return. Add `battle.followUpChainDepth = 0`
    // immediately before its own final `return actor` line, mirroring tickPacing.)
```

In `applyActionImpact()`, replace the single-target overwrite (line 611):

```ts
            if (firedFollowUp) {
              battle.queuedFollowUpActorIds = battle.queuedFollowUpActorIds ?? []
              battle.queuedFollowUpActorIds.push(target.id)
            }
```

In `declareActorAction()`, populate `isFollowUpBypass` — add right before the `return { ... }` statement:

```ts
    const isFollowUpBypass = this.pendingFollowUpBypassActorId === actor.id

    if (isFollowUpBypass) {
      this.pendingFollowUpBypassActorId = null
    }
```

...and add `isFollowUpBypass,` to the returned object.

In `completeAction()`, replace the gauge-consume line (line 663):

```ts
    consumeGaugeAfterAction(actor, declared.isFollowUpBypass ? 0 : 1)
```

- [ ] **Step 4: Update the existing reactiveTrigger test file for the renamed field**

In `game/src/core/battle/turn/TurnBuffSystem.reactiveTrigger.test.ts`:
- Line 151: `expect(battle.queuedFollowUpActorId).toBe('enemy')` → `expect(battle.queuedFollowUpActorIds).toEqual(['enemy'])`
- Line 170: `expect(battle.queuedFollowUpActorId).toBeUndefined()` → `expect(battle.queuedFollowUpActorIds).toBeUndefined()`
- Line 181: `expect(battle.queuedFollowUpActorId).toBe('enemy')` → `expect(battle.queuedFollowUpActorIds).toEqual(['enemy'])`
- Line 186: `expect(battle.queuedFollowUpActorId).toBeUndefined()` → `expect(battle.queuedFollowUpActorIds).toBeUndefined()`

- [ ] **Step 5: Add the reciprocity depth guard test**

Append to `TurnBattleSystem.followUpQueue.test.ts`:

```ts
describe('TurnBattleSystem — follow-up reciprocity guard', () => {
  it('caps consecutive bypass turns and falls back to normal gauge order', () => {
    const { battle, system } = fixture()

    // Manually simulate a long chain having already happened (rather than
    // building a full ping-pong buff setup) — verify the guard itself.
    battle.queuedFollowUpActorIds = ['enemy']
    battle.followUpChainDepth = MAX_FOLLOW_UP_CHAIN_DEPTH_FOR_TEST

    const result = system.tickPacing(battle, false)

    // Guard tripped: queue dropped, falls through to normal (gauge not
    // ready yet for either side at actionGauge=0) → no actor this tick.
    expect(battle.queuedFollowUpActorIds).toBeUndefined()
    expect(battle.followUpChainDepth).toBe(0)
    expect(result).toBeNull()
  })
})

const MAX_FOLLOW_UP_CHAIN_DEPTH_FOR_TEST = 4
```

- [ ] **Step 6: Run all 3 test files to verify they pass**

Run: `npx vitest run TurnBattleSystem.followUpQueue.test.ts TurnBuffSystem.reactiveTrigger.test.ts TurnBattleSystem.actionPlayback.test.ts`
Expected: PASS — all assertions green, including the pre-existing "byte-identical" `resolveActorTurn` test (untouched signature).

- [ ] **Step 7: Full-suite regression check**

Run: `npx vitest run`
Expected: PASS (no other file references the old `queuedFollowUpActorId` singular field — confirm with a repo-wide search before running: `grep -rn "queuedFollowUpActorId\b" game/src` should return zero matches outside this task's own edits).

- [ ] **Step 8: Commit**

```bash
git add game/src/core/battle/turn/TurnBattleSystem.ts game/src/core/battle/turn/TurnBattleSystem.followUpQueue.test.ts game/src/core/battle/turn/TurnBuffSystem.reactiveTrigger.test.ts
git commit -m "fix(turn-combat): honor queuedFollowUpActorIds in tickPacing (was dead in production)"
```

---

## Task 2: Fix CC-counter incrementing during a charging turn (self-contradictory battle log + premature Bá Thể clear)

**The bug:** `declareActorAction()`'s own comment (`TurnBattleSystem.ts:344-348`) states charging takes precedence and "KHÔNG đụng CC counter Bá Thể" (must not touch the CC counter) — but the CC-check block right below it (lines 409-424) runs unconditionally, with no `isCharging` guard. Consequence: a charging actor who is also hard-CC'd (stunned/frozen) has `consecutiveHardCcTurns` climb every turn even though the charge still ticks/resolves normally (the actual gating check at line 462 is `!ccBlocked && !isCharging`, so `isCharging` alone already bypasses being blocked — the CC counter increment is pure side-effect noise). On the 4th such turn, the Bá Thể fairness clear (`actor.buffs.clearCcEffects()`) fires and strips CC buffs that were never actually blocking anything. It also makes `declared.ccBlocked` (persisted into `battle.log`, line 703) self-contradictory: `ccBlocked: true` alongside a turn that still recorded a `skillId`/landed damage from the charge resolving.

**Files:**
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts:409-424`
- Test: `game/src/core/battle/turn/TurnBattleSystem.chargeCcInteraction.test.ts` (new file)

**Interfaces:**
- Consumes: `actor.chargingTurnsRemaining` (existing field), `actorBuffSystem.isStunned()`/`isFrozen()` (existing `TurnBuffSystem` methods).
- No new public interface — internal-only behavior fix.

- [ ] **Step 1: Write the failing test**

Create `game/src/core/battle/turn/TurnBattleSystem.chargeCcInteraction.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { TurnBuffDefinition, TurnBuffRegistry } from './TurnBuffTypes'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import { TurnBuffPool } from './TurnBuffPool'
import { TurnBuffSystem } from './TurnBuffSystem'

const STUN_DEF: TurnBuffDefinition = {
  id: 'stun', name: 'Stun', polarity: 'debuff', duration: 10, stackMode: 'refresh',
  effects: [{ type: 'cc', ccEffect: 'stun' }],
}

class Registry implements TurnBuffRegistry {
  private readonly defs = new Map<string, TurnBuffDefinition>()
  constructor(defs: TurnBuffDefinition[]) { for (const d of defs) this.defs.set(d.id, d) }
  get(id: string): TurnBuffDefinition {
    const d = this.defs.get(id)
    if (!d) throw new Error(`missing buff: ${id}`)
    return d
  }
}

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0 }
  return {
    id: 'id', name: 'name', type: 'enemy', baseStats: stats, stats,
    currentHp: stats.maxHp, maxHp: stats.maxHp, currentMp: stats.maxMp,
    currentSwordIntent: 0, currentMomentum: 0, currentHoaThe: 0, currentThoThe: 0, currentKimThe: 0,
    timeSinceLastBleedProc: 0, tuLucActive: false, tuLucElapsed: 0, tuLucDamageTakenPercent: 0,
    currentWard: 0, timeSinceLastHitTaken: Infinity, realmIndex: 0, x: 0, row: 2, alive: true,
    ...overrides,
  } as CombatEntity
}

describe('TurnBattleSystem — charging actor is immune to the CC counter side-effect', () => {
  it('consecutiveHardCcTurns stays 0 across 3 charging+stunned turns (no premature Bá Thể clear)', () => {
    const player = createCombatant({
      id: 'player', type: 'player', row: 4,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, speed: 100, attack: 100 },
    })
    const enemyEntity = createCombatant({ id: 'enemy', currentHp: 1_000_000, maxHp: 1_000_000 })

    const registry = new Registry([STUN_DEF])
    const buffs = new TurnBuffPool()
    new TurnBuffSystem(buffs).apply(STUN_DEF, player, player, registry)

    const playerParticipant: TurnBattleParticipant = {
      id: 'player', entity: player, speed: 100, priority: 0, actionGauge: 0, alive: true,
      buffs, consecutiveHardCcTurns: 0,
      chargingTurnsRemaining: 3,
      pendingChargedSkillId: 'player_special',
      special: { skill: { id: 'player_special', cooldownTurns: 0, chargeTurns: 3, damage: { kind: 'physical', multiplier: 5 }, targeting: { shape: 'single' } }, cooldownRemaining: 0 },
      basic: { id: 'player_basic', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 1 }, targeting: { shape: 'single' } },
    }
    const enemyParticipant: TurnBattleParticipant = {
      id: 'enemy', entity: enemyEntity, speed: 100, priority: 1, actionGauge: 0, alive: true,
      buffs: new TurnBuffPool(), consecutiveHardCcTurns: 0,
      basic: { id: 'enemy_basic', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 1 }, targeting: { shape: 'single' } },
    }

    const battle: TurnBattle = { players: [playerParticipant], enemies: [enemyParticipant], state: 'fighting' }
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, registry)

    for (let turn = 0; turn < 2; turn += 1) {
      const declared = system.declareActorAction(battle, playerParticipant)

      expect(declared.ccBlocked).toBe(false)
      expect(declared.isCharging).toBe(true)
      expect(playerParticipant.consecutiveHardCcTurns).toBe(0)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run TurnBattleSystem.chargeCcInteraction.test.ts`
Expected: FAIL — `consecutiveHardCcTurns` is `1` then `2`, and `declared.ccBlocked` is `true` (the stun buff makes `hardCcActive` true, and the unguarded block increments the counter and sets `ccBlocked: true` even though `isCharging` is also true).

- [ ] **Step 3: Guard the CC-check block with `!isCharging`**

In `game/src/core/battle/turn/TurnBattleSystem.ts`, replace lines 409-424:

```ts
    // CC check TRƯỚC tick: buff stun/freeze duration=N phải block đúng N
    // lượt của holder (áp ở lượt N-1, block lượt N..N+1, hết sau khi block
    // lượt cuối). Tick trước sẽ làm duration-1 expire trước khi kịp block.
    // Bá Thể: bị hard-CC liên tục >= 3 lượt thì lượt thứ 4 tự gỡ CC và
    // hành động (fairness guard — không ai bị khóa vĩnh viễn).
    //
    // isCharging skip hoàn toàn khối này (fix 2026-09-05): charging đã có
    // hành động thay thế riêng (charge tick/resolve, xem khối phía trên) —
    // actor không hề bị "chặn" bởi CC trong lượt này, nên không được tính
    // vào consecutiveHardCcTurns (tránh Bá Thể clear sớm sai) và ccBlocked
    // phải là false (tránh log mâu thuẫn: ccBlocked=true kèm skillId/damage
    // thật của charge resolve).
    let ccBlocked: boolean

    if (isCharging) {
      ccBlocked = false
    } else {
      const hardCcActive = actorBuffSystem.isStunned() || actorBuffSystem.isFrozen()

      if (hardCcActive && actor.consecutiveHardCcTurns >= 3) {
        actor.buffs.clearCcEffects()
        actor.consecutiveHardCcTurns = 0
        actor.baTheTriggeredAtTurn = battle.totalTurnsElapsed
        ccBlocked = false
      } else if (hardCcActive) {
        actor.consecutiveHardCcTurns += 1
        ccBlocked = true
      } else {
        actor.consecutiveHardCcTurns = 0
        ccBlocked = false
      }
    }
```

(This removes the standalone `const hardCcActive = ...` line since it's now scoped inside the `else` branch — verify no other code in `declareActorAction()` reads a `hardCcActive` variable outside this block before making the edit.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run TurnBattleSystem.chargeCcInteraction.test.ts`
Expected: PASS.

- [ ] **Step 5: Regression check on existing charge + CC tests**

Run: `npx vitest run TurnBattleSystem`
Expected: PASS — search the test output for any existing test that asserted the OLD (buggy) behavior of `consecutiveHardCcTurns` incrementing during a charge; if one exists, it was pinning the bug and should be corrected to match the fixed behavior (not reverted).

- [ ] **Step 6: Commit**

```bash
git add game/src/core/battle/turn/TurnBattleSystem.ts game/src/core/battle/turn/TurnBattleSystem.chargeCcInteraction.test.ts
git commit -m "fix(turn-combat): charging actors no longer accumulate the CC counter side-effect"
```

---

## Task 3: `PresentationGate` — fix the first-battle boot race (headless-resolve before Phaser mounts)

**The bug:** `GameManager.presentationActive` defaults to `false`. Real gameplay ticks `updateBattleFixedStep()` (which starts a countdown then fighting the instant `startStage()` runs) on every frame from app boot onward — but `PhaserCanvas.vue` boots Phaser + `CombatScene` asynchronously (`Promise.all(import(...))`, `game/src/components/game/PhaserCanvas.vue:48-66`) and only calls `gameManager.setPresentationActive(true)` once `CombatScene.create()` runs (`game/src/game/scenes/CombatScene.ts:1179`). `PhaserCanvas` mounts exactly once per app session (unconditional `<PhaserCanvas />` in `MainScene.vue:20`, no `v-if`), so this race is only live for the very first battle after the app loads. If the async import is slow (cold cache, first-ever session), the ENTIRE first battle — countdown + every fighting turn — resolves headless (no VFX, no pacing) before Phaser ever gets a chance to set `presentationActive = true`, matching the exact symptom reported ("vừa vào game, trận biến mất ngay, không animation gì").

A previous proposal (gate on `presentationActive` OR a 5s wall-clock timeout) was rejected during design review: it breaks headless tests in the opposite direction from what was assumed — tests run synchronously in well under 5 real seconds and never call `setPresentationActive`, so a wall-clock-based gate would leave them stuck waiting at the very first countdown tick, since the test finishes before the timeout ever elapses.

**The fix:** an explicit-intent gate, not a timing heuristic. The real app (and ONLY the real app — every one of the 75+ test files constructs its own separate `GameManager` instance and never touches this) declares "a presentation layer will attach" once at boot. Until that layer actually attaches for the first time, combat ticking pauses (same style as the existing `awaitedManualActor` pause branch) — no timing guesswork, and headless tests are structurally unaffected because they never call the new "expect" method.

**Files:**
- Create: `game/src/core/battle/turn/PresentationGate.ts`
- Test: `game/src/core/battle/turn/PresentationGate.test.ts`
- Modify: `game/src/core/game/GameManager.ts` (add gate field/wiring, `expectPresentationLayer()`, `isAwaitingPresentationLayer()`, gate check in `updateBattleFixedStep()`)
- Modify: `game/src/App.vue` (call `expectPresentationLayer()` once after constructing the real `GameManager`)

**Interfaces:**
- Produces: `class PresentationGate` with `expect(): void`, `markReady(): void`, `isBlocking(nowMs?: number, timeoutMs?: number): boolean`.
- Produces: `GameManager.expectPresentationLayer(): void`, `GameManager.isAwaitingPresentationLayer(): boolean`.
- Consumes (by `GameManager.setPresentationActive`): calls `this.presentationGate.markReady()` when `active === true`.

- [ ] **Step 1: Write the failing test for `PresentationGate`**

Create `game/src/core/battle/turn/PresentationGate.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { PresentationGate } from './PresentationGate'

describe('PresentationGate', () => {
  it('never blocks if expect() was never called (headless/test default)', () => {
    const gate = new PresentationGate()

    expect(gate.isBlocking()).toBe(false)
  })

  it('blocks after expect(), until markReady() is called', () => {
    const gate = new PresentationGate()

    gate.expect()
    expect(gate.isBlocking(1_000, 15_000)).toBe(true)

    gate.markReady()
    expect(gate.isBlocking(1_000, 15_000)).toBe(false)
  })

  it('stays ready forever once markReady() fires, even if expect() is called again later', () => {
    const gate = new PresentationGate()

    gate.expect()
    gate.markReady()
    gate.expect()

    expect(gate.isBlocking(999_999, 15_000)).toBe(false)
  })

  it('safety-net: stops blocking once timeoutMs has elapsed without markReady() (Phaser boot failure fallback)', () => {
    const gate = new PresentationGate()

    gate.expect()
    expect(gate.isBlocking(0, 15_000)).toBe(true)
    expect(gate.isBlocking(20_000, 15_000)).toBe(false)

    // Once the safety-net trips, the gate is permanently open (matches
    // markReady() semantics) — a later call with an "early" nowMs must
    // still report not-blocking.
    expect(gate.isBlocking(20_001, 15_000)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run PresentationGate.test.ts`
Expected: FAIL with "Cannot find module './PresentationGate'".

- [ ] **Step 3: Implement `PresentationGate`**

Create `game/src/core/battle/turn/PresentationGate.ts`:

```ts
/**
 * Boot-race fix (2026-09-05) — gates GameManager's fixed-step battle ticking
 * until a real Phaser presentation layer has attached, WITHOUT relying on
 * wall-clock timing as the primary mechanism (a wall-clock-only gate breaks
 * fast synchronous tests: they finish well under any reasonable timeout and
 * never call markReady(), so they'd stay blocked forever from their own
 * point of view). Instead this is an explicit-intent gate:
 *
 * - Headless/test GameManager instances never call expect() → isBlocking()
 *   is always false → zero behavior change for the 75+ existing tests.
 * - The real app calls expect() once at boot (App.vue). Until CombatScene
 *   mounts for the first time and calls markReady() (via
 *   GameManager.setPresentationActive(true)), combat ticking pauses.
 * - markReady() is sticky forever — leaving/re-entering CombatScene later
 *   (setPresentationActive(false) then true again) does NOT re-block,
 *   because PhaserCanvas only ever boots once per app session.
 * - A wall-clock timeout is kept ONLY as a defensive fallback for a genuine
 *   Phaser bootstrap failure (see PhaserCanvas.vue's bootError handling) —
 *   not as the mechanism relied on in the normal case.
 */
export class PresentationGate {
  private status: 'not-expected' | 'awaiting' | 'ready' = 'not-expected'
  private awaitingSinceMs: number | null = null

  /** Call once, only from real-app bootstrap — never from a test fixture. */
  expect(): void {
    if (this.status === 'ready') {
      return
    }

    this.status = 'awaiting'
    this.awaitingSinceMs = Date.now()
  }

  /** Call when a real presentation layer attaches for the first time. Sticky. */
  markReady(): void {
    this.status = 'ready'
    this.awaitingSinceMs = null
  }

  isBlocking(nowMs: number = Date.now(), timeoutMs = 15_000): boolean {
    if (this.status !== 'awaiting') {
      return false
    }

    if (this.awaitingSinceMs !== null && nowMs - this.awaitingSinceMs > timeoutMs) {
      this.status = 'ready'
      this.awaitingSinceMs = null

      return false
    }

    return true
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run PresentationGate.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire into `GameManager`**

In `game/src/core/game/GameManager.ts`, add near the existing `presentationActive` field declaration (around line 2536):

```ts
  private readonly presentationGate = new PresentationGate()

  /** Called once at real-app boot ONLY (App.vue) — never from test fixtures. */
  expectPresentationLayer(): void {
    this.presentationGate.expect()
  }

  /** True while the very first Phaser boot hasn't finished mounting CombatScene yet. */
  isAwaitingPresentationLayer(): boolean {
    return this.presentationGate.isBlocking()
  }
```

Add the import at the top of the file alongside the other `turn/` imports:

```ts
import { PresentationGate } from '../battle/turn/PresentationGate'
```

In `setPresentationActive()`, add `markReady()` inside the `active` branch (the method currently only has an `if (!active)` branch — add the counterpart):

```ts
  setPresentationActive(active: boolean): void {
    this.presentationActive = active

    if (active) {
      this.presentationGate.markReady()
    } else {
      // ... existing drain logic unchanged (see Task 4 for its own fix)
    }
  }
```

In `updateBattleFixedStep()`, add the gate check as the FIRST condition inside the `if (this.turnBattle)` block (around line 3481), before the existing `state === 'countdown'` check:

```ts
      if (this.turnBattle) {
        if (this.presentationGate.isBlocking()) {
          // Chờ Phaser mount lần đầu (PresentationGate) — không tick
          // countdown/fighting cho tới khi presentation layer sẵn sàng
          // hoặc safety-net timeout trôi qua.
        } else if (this.turnBattle.state === 'countdown') {
          this.turnBattleSystem.tickCountdown(this.turnBattle)
        } else if (this.turnBattle.state === 'fighting') {
          // ... existing fighting branch unchanged
        }
      }
```

- [ ] **Step 6: Wire `expectPresentationLayer()` into the real app boot**

In `game/src/App.vue`, immediately after `const gameManager = new GameManager()` (line 116):

```ts
const gameManager = new GameManager()
gameManager.expectPresentationLayer()
```

- [ ] **Step 7: Write a `GameManager`-level regression test**

Create `game/src/core/game/GameManager.presentationGate.test.ts` (find an existing `GameManager.*.test.ts` file for the exact constructor call pattern this codebase uses, e.g. `GameManager.actionPlayback.test.ts`, and mirror its setup):

```ts
import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'

describe('GameManager — PresentationGate (boot-race fix)', () => {
  it('does NOT gate combat ticking by default (headless/test instances never call expectPresentationLayer)', () => {
    const gameManager = new GameManager()

    expect(gameManager.isAwaitingPresentationLayer()).toBe(false)
  })

  it('gates after expectPresentationLayer(), releases after setPresentationActive(true)', () => {
    const gameManager = new GameManager()

    gameManager.expectPresentationLayer()
    expect(gameManager.isAwaitingPresentationLayer()).toBe(true)

    gameManager.setPresentationActive(true)
    expect(gameManager.isAwaitingPresentationLayer()).toBe(false)
  })
})
```

Adjust the `new GameManager()` call if the real constructor requires arguments — check `game/src/core/game/GameManager.actionPlayback.test.ts`'s own setup for the exact signature used elsewhere in this test suite and match it exactly.

- [ ] **Step 8: Run the new tests and the full suite**

Run: `npx vitest run PresentationGate.test.ts GameManager.presentationGate.test.ts`
Expected: PASS.

Run: `npx vitest run`
Expected: PASS (no test calls `expectPresentationLayer()`, so no existing test's battle ever gets gated).

- [ ] **Step 9: Typecheck**

Run: `npx vue-tsc --noEmit`
Expected: no new errors.

- [ ] **Step 10: Commit**

```bash
git add game/src/core/battle/turn/PresentationGate.ts game/src/core/battle/turn/PresentationGate.test.ts game/src/core/game/GameManager.ts game/src/core/game/GameManager.presentationGate.test.ts game/src/App.vue
git commit -m "fix(turn-combat): PresentationGate — stop first battle from resolving headless before Phaser mounts"
```

---

## Task 4: Fix `setPresentationActive(false)` drain overriding manual player choice

**The bug:** `acknowledgeTurnReady()` correctly checks manual mode before declaring an action (`GameManager.ts:2588-2592`: if `battleManualMode` and the ready actor is a player, it routes into `awaitedManualActor` and returns — waits for `submitTurnChoice()`). But `setPresentationActive(false)`'s drain logic (`GameManager.ts:2553-2559`, fires when `CombatScene` unmounts mid-turn) does **not** replicate this check — it unconditionally calls `declareActorAction()` (which falls back to AI-priority selection when there's no `forcedSkillSlot`) for whatever actor is sitting in `pendingReadyActor`. If that actor is a manually-controlled player mid-choice, leaving the combat scene silently overrides their pending decision with an auto-picked skill.

**Files:**
- Modify: `game/src/core/game/GameManager.ts:2547-2572`
- Test: `game/src/core/game/GameManager.presentationGate.test.ts` (same file created in Task 3 — add a test here)

**Interfaces:**
- Consumes: existing `battleManualMode: boolean`, `turnBattle.players: TurnBattleParticipant[]`, `awaitedManualActor: TurnBattleParticipant | null` fields — no new fields.

- [ ] **Step 1: Write the failing test**

Copy the `ENEMY_STATS`/`createPlayer`/`createBasicSkill`/`createDummy`/`battleReady` helpers verbatim from `game/src/core/game/GameManager.actionPlayback.test.ts` (lines 1-69) into the TOP of `game/src/core/game/GameManager.presentationGate.test.ts` created in Task 3 (both files need the same fixture — do not import across test files; duplicate the helpers, matching this codebase's existing convention of per-test-file fixture helpers). Then append:

```ts
describe('GameManager — setPresentationActive(false) respects manual mode', () => {
  it('does not silently auto-resolve a manual player\'s pending ready-phase turn on scene teardown', () => {
    const gameManager = battleReady()

    gameManager.setPresentationActive(true)
    gameManager.setBattleManualMode(true)

    for (let i = 0; i < 50; i++) {
      gameManager.update(0.1)
    }

    // Player actor is now sitting in pendingReadyActor — turn_ready fired,
    // but Phaser hasn't acked it yet (mirrors GameManager.actionPlayback.test.ts's
    // own 'submitTurnChoice khi presentationActive' test, which confirms this
    // exact setup reaches a player-controlled ready phase under manual mode).
    expect(gameManager.isActionPlaybackWaiting()).toBe(true)

    // Scene unmounts (e.g. player navigates away) BEFORE Phaser ever acks
    // the ready phase.
    gameManager.setPresentationActive(false)

    // Fixed behavior: routed into awaitedManualActor, NOT auto-resolved via
    // AI-priority selectAction(). Before the fix, this turn would have been
    // silently completed (totalTurnsElapsed would be 1, not 0).
    expect(gameManager.isAwaitingManualTurnChoice()).toBe(true)
    expect(gameManager.getTurnBattle()?.totalTurnsElapsed ?? 0).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run GameManager.presentationGate.test.ts`
Expected: FAIL — after `setPresentationActive(false)`, the actor's turn was already auto-resolved (battle log has a new entry, `isAwaitingManualTurnChoice()` is `false`).

- [ ] **Step 3: Fix the drain logic**

In `game/src/core/game/GameManager.ts`, replace the `pendingReadyActor` branch inside `setPresentationActive(false)` (lines 2553-2559):

```ts
      if (this.pendingReadyActor && this.turnBattle) {
        const actor = this.pendingReadyActor
        this.pendingReadyActor = null

        const isManualActor = this.battleManualMode && this.turnBattle.players.includes(actor)

        if (isManualActor) {
          // Cùng nhánh với acknowledgeTurnReady() (GameManager.ts:2588-2592) —
          // rời scene giữa chừng KHÔNG được thay player quyết định bằng AI.
          this.awaitedManualActor = actor
        } else {
          const declared = this.turnBattleSystem.declareActorAction(this.turnBattle, actor)
          const { targetIds } = this.turnBattleSystem.applyActionImpact(this.turnBattle, declared)
          this.turnBattleSystem.completeAction(this.turnBattle, actor, declared, targetIds)
        }
      } else if (this.pendingDeclaredAction && this.turnBattle) {
```

(The `pendingDeclaredAction`/`pendingImpact` branches stay unchanged — by the time an actor reaches those phases, `declareActorAction()` already ran with whatever `forcedSkillSlot` manual mode supplied at declare time, so flushing them through to completion is correct and doesn't override any choice.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run GameManager.presentationGate.test.ts`
Expected: PASS.

- [ ] **Step 5: Regression check**

Run: `npx vitest run GameManager`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add game/src/core/game/GameManager.ts game/src/core/game/GameManager.presentationGate.test.ts
git commit -m "fix(turn-combat): setPresentationActive(false) no longer overrides a pending manual choice"
```

---

## Task 5: Fix `CombatScene.onAttack()` missing-sprite stall

**The bug:** `onTurnReady()` has an explicit fallback for a missing sprite lookup (`CombatScene.ts:1787-1791`: if `spriteFor(actorId)` returns nothing, it immediately calls `acknowledgeTurnReady()` so the engine doesn't hang). `onAttack()` (`CombatScene.ts:1409-1424`) does the same kind of sprite lookup (`this.spriteFor(event.sourceId)`) but only schedules `acknowledgeActionImpact()` inside `if (attacker) { ... }` — there is no `else` branch. If the attacker's sprite lookup ever misses (mid spawn-telegraph, a cleanup race, or any future sprite-lifecycle change), the 5-phase state machine stalls in the `pendingDeclaredAction` phase permanently, until something else (e.g. leaving the scene) force-flushes it via `setPresentationActive(false)`.

**Files:**
- Modify: `game/src/game/scenes/CombatScene.ts:1409-1424`

**Interfaces:**
- Consumes: existing `this.gameManagerRef?.acknowledgeActionImpact()`, `this.isActionPlaybackActive()`, `this.spriteFor(id)` — no new interfaces.

- [ ] **Step 1: Read the current method in full for exact context**

Read `game/src/game/scenes/CombatScene.ts:1409-1430` to confirm the exact current body before editing (Phaser scene code is not covered by the Vitest suite the way `GameManager`/`TurnBattleSystem` are — this fix is verified by code inspection + the existing `GameManager.actionPlayback.test.ts` suite continuing to pass, since the ack call itself is what matters, not the tween).

- [ ] **Step 2: Add the missing-sprite fallback**

Replace the method body:

```ts
  onAttack(event: CombatScenePayload) {
    const attacker = this.spriteFor(event.sourceId)

    if (attacker) {
      const isPlayer = event.sourceId === PLAYER_ID
      const dx = isPlayer ? ATTACK_LUNGE_PX : -ATTACK_LUNGE_PX

      this.playHorizontalImpulse(attacker, dx, ATTACK_LUNGE_DURATION_MS)

      // Action Playback Task 7 (2026-09-05) — impact frame tại midpoint
      // lunge: damage áp đúng lúc đòn "trúng" trên màn hình (spec §4.3).
      if (this.gameManagerRef && this.isActionPlaybackActive()) {
        this.time.delayedCall(ATTACK_LUNGE_DURATION_MS / 2, () => {
          this.gameManagerRef?.acknowledgeActionImpact()
        })
      }
    } else if (this.gameManagerRef && this.isActionPlaybackActive()) {
      // Không có sprite (late-join miss/cleanup race) — ack ngay để engine
      // không treo vĩnh viễn ở pendingDeclaredAction (cùng fallback pattern
      // với onTurnReady(), CombatScene.ts:1787-1791).
      this.gameManagerRef.acknowledgeActionImpact()
    }
```

- [ ] **Step 3: Verify the rest of the method (below the code shown above) is untouched**

Read the full method again after editing to confirm nothing past line 1424 (any code that was originally outside the `if (attacker)` block, if present) was accidentally pulled into either branch.

- [ ] **Step 4: Typecheck**

Run: `npx vue-tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Regression check on Action Playback tests**

Run: `npx vitest run GameManager.actionPlayback.test.ts`
Expected: PASS (this file drives `acknowledgeActionImpact()` directly, not through `CombatScene`, so it won't catch this specific fix — its purpose here is just to confirm the ack method's own contract wasn't disturbed).

- [ ] **Step 6: Commit**

```bash
git add game/src/game/scenes/CombatScene.ts
git commit -m "fix(turn-combat): onAttack() falls back to ack-immediately on a missing sprite (matches onTurnReady)"
```

---

## Task 6: Reset stale Action Playback pending-phase fields on stage restart

**The bug:** Both `restartTurnBattleCycle()` (`GameManager.ts:2446-2457`) and `startStage()` (`GameManager.ts:3087-3096`) reset `awaitedManualActor = null` when starting a fresh battle, but neither resets `pendingReadyActor`/`pendingDeclaredAction`/`pendingImpact`. Those three fields are only null-checked for truthiness (not actor/battle identity) everywhere they're read (`acknowledgeTurnReady()`, `acknowledgeActionImpact()`, `acknowledgeActionComplete()`, `isActionPlaybackWaiting()`). If a presentation phase was mid-flight (e.g. `pendingImpact` set) when a stage restarts or a fresh stage starts, the stale reference can leak into the new battle — a delayed Phaser ack arriving after the restart would call `completeAction()` with an actor/declared-action object belonging to the OLD `TurnBattle`, not `this.turnBattle`.

**Files:**
- Modify: `game/src/core/game/GameManager.ts:2446-2457` (`restartTurnBattleCycle`)
- Modify: `game/src/core/game/GameManager.ts:3087-3096` (`startStage`)
- Test: `game/src/core/game/GameManager.presentationGate.test.ts` (same file, add a test here)

**Interfaces:**
- No new interfaces — internal field-reset fix only.

- [ ] **Step 1: Write the failing test**

This test needs a real `startStage()` call (not `battleReady()`'s `startBattle()`, which doesn't exercise `startStage`'s reset code at all). Copy the `Stage` fixture pattern from `game/src/core/game/GameManager.repeatStage.test.ts:1-59` (imports: `createDefaultPlayer` from `../player/Player`, `calculateStats` from `../stats/StatCalculator`, `defineEnemy` from `../enemy/Enemy`, `type Stage` from `../stage/Stage`). Append to `game/src/core/game/GameManager.presentationGate.test.ts`:

```ts
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import { defineEnemy } from '../enemy/Enemy'
import type { Stage } from '../stage/Stage'

function stageFixture(id: string): Stage {
  return {
    id, name: id, description: '', floor: 1,
    enemyPool: [{ enemyId: `${id}_enemy`, weight: 1 }],
    totalEnemyCount: 1,
    spawnIntervalSeconds: 0,
  }
}

describe('GameManager — stage restart clears stale Action Playback pending state', () => {
  it('startStage() resets pendingReadyActor/pendingDeclaredAction/pendingImpact', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    const stats = calculateStats({ ...player.baseStats, attack: 100, speed: 100 }, [])

    const enemyA = defineEnemy({
      id: 'restart_dummy_a', name: 'Dummy A', level: 1, realmId: 'mortal', lane: 'ground',
      statsInput: { maxHp: 1_000_000, attack: 0, attackSpeed: 1, attackRangeRanks: 9, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
      rewards: { techniqueInsight: 0, spiritStone: 0 },
    })
    const enemyB = defineEnemy({
      id: 'restart_dummy_b', name: 'Dummy B', level: 1, realmId: 'mortal', lane: 'ground',
      statsInput: { maxHp: 1_000_000, attack: 0, attackSpeed: 1, attackRangeRanks: 9, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
      rewards: { techniqueInsight: 0, spiritStone: 0 },
    })

    gameManager.registerEnemyTemplates([enemyA, enemyB])
    const stageA = stageFixture('restart_stage_a')
    const stageB = stageFixture('restart_stage_b')
    gameManager.registerStages([stageA, stageB])
    gameManager.setActivePlayer(player)

    expect(gameManager.startStage(player, stats, stageA, false)).toBe(true)

    gameManager.setPresentationActive(true)

    for (let i = 0; i < 30; i++) {
      gameManager.update(0.1) // countdown
    }

    for (let i = 0; i < 20; i++) {
      gameManager.update(0.1) // reach a gauge-ready actor under presentationActive
    }

    // Ready phase reached, NOT acknowledged — pending state is "stuck".
    expect(gameManager.isActionPlaybackWaiting()).toBe(true)

    // A fresh stage starts (e.g. player exits and re-enters, or auto-repeat
    // rolls a new stage) before the stuck phase was ever flushed.
    expect(gameManager.startStage(player, stats, stageB, false)).toBe(true)

    expect(gameManager.isActionPlaybackWaiting()).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run GameManager.presentationGate.test.ts`
Expected: FAIL — `isActionPlaybackWaiting()` still returns `true` after the second `startStage()` call.

- [ ] **Step 3: Add the resets**

In `game/src/core/game/GameManager.ts`, in `restartTurnBattleCycle()`, right after the existing `this.awaitedManualActor = null` (line 2457):

```ts
    this.awaitedManualActor = null
    this.pendingReadyActor = null
    this.pendingDeclaredAction = null
    this.pendingImpact = null
```

In `startStage()`, right after the existing `this.awaitedManualActor = null` (line 3095):

```ts
      this.awaitedManualActor = null
      this.pendingReadyActor = null
      this.pendingDeclaredAction = null
      this.pendingImpact = null
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run GameManager.presentationGate.test.ts`
Expected: PASS.

- [ ] **Step 5: Full regression**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add game/src/core/game/GameManager.ts game/src/core/game/GameManager.presentationGate.test.ts
git commit -m "fix(turn-combat): reset Action Playback pending-phase fields on stage restart"
```

---

## Task 7: Remove the duplicate manual-cast skill bar (`CombatBuildHud`'s Kiếm/Pháp/Mortal skill slots vs. `TurnCombatSkillBar`)

**The bug (UI drift):** `CombatSceneOverlay.vue` mounts both `CombatBuildHud` (→ renders `KiemTuCombatHud.vue`/`PhapTuCombatHud.vue`/`MortalCombatHud.vue` depending on `player.cultivationPath`) and `TurnCombatSkillBar.vue` simultaneously (`CombatSceneOverlay.vue:100-105`). Both render 3 clickable basic/special/ultimate buttons wired to `GameManager.submitTurnChoice()` for the exact same paused turn — via two separate, near-identical composables (`useCombatSkillPresentation.ts` and `useTurnCombatManual.ts`). Only `TurnCombatSkillBar` (via `useTurnCombatManual`) exposes the manual/auto mode toggle and the "Đến lượt bạn" awaiting-choice label; the `CombatBuildHud` family is a leftover from an earlier point in Slice 7 before `TurnCombatSkillBar` became the complete surface. `PhapTuCombatHud.vue` additionally renders `<ArtifactCombatSlot>`, which is NOT duplicated anywhere else and must be preserved.

**Files:**
- Modify: `game/src/components/game/combat/hud/MortalCombatHud.vue` (remove entirely — becomes an empty shell)
- Modify: `game/src/components/game/combat/hud/KiemTuCombatHud.vue` (remove entirely — becomes an empty shell)
- Modify: `game/src/components/game/combat/hud/PhapTuCombatHud.vue` (keep only `<ArtifactCombatSlot>`)
- Modify: `game/src/components/game/combat/hud/CombatBuildHud.vue` (only render something for `phap_tu`; render nothing for `kiem_tu`/`mortal`)
- Delete: `game/src/composables/useCombatSkillPresentation.ts` (becomes fully unused)
- Test: `game/src/components/panels/StageSelectPanel.test.ts` or a new `CombatSceneOverlay.test.ts` if one doesn't already assert on this — check first with Glob for an existing test covering `CombatBuildHud`/`MortalCombatHud`/`KiemTuCombatHud` before deciding whether to add or update a test.

**Interfaces:**
- Consumes: `useTurnCombatManual()` (already exists, unchanged) — this task does not add new interfaces, only removes a duplicate one.

- [ ] **Step 1: Confirm nothing else imports the composable being deleted**

Run: `grep -rn "useCombatSkillPresentation" game/src` (excluding `.agent-worktrees/`)

Expected: matches only in `KiemTuCombatHud.vue`, `PhapTuCombatHud.vue`, `MortalCombatHud.vue`, and the composable's own file — all three call sites are being edited in this task, so after the edits below the grep should return zero matches outside the deleted file itself.

- [ ] **Step 2: Simplify `PhapTuCombatHud.vue` to keep only the artifact slot**

Replace `game/src/components/game/combat/hud/PhapTuCombatHud.vue`:

```vue
<script setup lang="ts">
// Slice 7 HUD dedup fix (2026-09-05) — the 3 basic/special/ultimate skill
// slots this file used to render (via useCombatSkillPresentation) were a
// duplicate of TurnCombatSkillBar.vue, which CombatSceneOverlay.vue mounts
// side-by-side with CombatBuildHud. TurnCombatSkillBar is the complete,
// correct surface (manual/auto toggle, awaiting-choice label, disabled-state
// gating) — this file now only keeps ArtifactCombatSlot, which is unique to
// the Pháp Tu path and not duplicated anywhere else.
import ArtifactCombatSlot from './ArtifactCombatSlot.vue'
import { useArtifactCombatPresentation } from '@/composables/useArtifactCombatPresentation'

const { presentation: artifactPresentation } = useArtifactCombatPresentation()
</script>

<template>
  <div class="phap-tu-combat-hud">
    <ArtifactCombatSlot :state="artifactPresentation" />
  </div>
</template>

<style scoped>
.phap-tu-combat-hud {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: var(--space-2);
}
</style>
```

- [ ] **Step 3: Delete the skill-slot content from `KiemTuCombatHud.vue` and `MortalCombatHud.vue`, and stop rendering them**

Since both files would become empty (`KiemTuCombatHud.vue` had ONLY the 3 duplicate slots, `MortalCombatHud.vue` had ONLY the 3 duplicate slots — confirmed by reading both files during this plan's review), delete both files:

```bash
git rm game/src/components/game/combat/hud/KiemTuCombatHud.vue
git rm game/src/components/game/combat/hud/MortalCombatHud.vue
```

- [ ] **Step 4: Update `CombatBuildHud.vue` to stop referencing the deleted components**

Replace `game/src/components/game/combat/hud/CombatBuildHud.vue`:

```vue
<script setup lang="ts">
// Slice 7 HUD dedup fix (2026-09-05) — KiemTuCombatHud/MortalCombatHud
// deleted (were pure duplicates of TurnCombatSkillBar.vue's skill slots,
// see CombatSceneOverlay.vue). PhapTuCombatHud kept (has ArtifactCombatSlot,
// unique to that path). kiem_tu/mortal now render nothing here — their
// skill input lives solely in TurnCombatSkillBar.
import { computed } from 'vue'
import PhapTuCombatHud from './PhapTuCombatHud.vue'
import { usePlayerStore } from '@/stores/player'
import { useStateVersion } from '@/composables/useGameState'

const player = usePlayerStore()
const { stateVersion } = useStateVersion()

const showPhapTuHud = computed(() => {
  stateVersion.value

  return player.cultivationPath === 'phap_tu'
})
</script>

<template>
  <div class="combat-build-hud">
    <PhapTuCombatHud v-if="showPhapTuHud" />
  </div>
</template>

<style scoped>
.combat-build-hud {
  pointer-events: auto;
}
</style>
```

- [ ] **Step 5: Delete the now-fully-unused composable**

```bash
git rm game/src/composables/useCombatSkillPresentation.ts
```

If a test file exists for it (check with Glob: `game/src/composables/useCombatSkillPresentation.test.ts`), delete it too in the same commit.

- [ ] **Step 6: Search for any other reference to the deleted files before proceeding**

Run: `grep -rln "KiemTuCombatHud\|MortalCombatHud\|useCombatSkillPresentation" game/src` (excluding `.agent-worktrees/`)

Expected: zero matches. If any test file references these, update or remove the specific assertions referencing the deleted components (not the whole test file, unless it exclusively tested the deleted component).

- [ ] **Step 7: Typecheck**

Run: `npx vue-tsc --noEmit`
Expected: no errors (confirms no dangling import of the deleted files anywhere).

- [ ] **Step 8: Manual verification in the running app**

Start the dev server, enter a battle on each of the 3 cultivation paths (mortal, phap_tu, kiem_tu — switch save/player state as needed, or use whatever existing dev shortcut this project has for switching path), and confirm:
- Exactly ONE set of basic/special/ultimate buttons is visible (from `TurnCombatSkillBar`), not two.
- Pháp Tu still shows the artifact slot alongside it.
- Clicking a skill button still submits the turn choice correctly (existing `TurnCombatSkillBar` behavior, unchanged).

- [ ] **Step 9: Run full test suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "fix(turn-combat): remove duplicate skill-slot HUD (CombatBuildHud) — TurnCombatSkillBar is the sole input surface"
```

---

## Task 8: Polish — dead code and documentation gaps found during review

**Findings (all improvement-opportunity severity, bundled into one task since each is a small, independent, low-risk change):**

1. `TurnBattleSystem.ts:381-383` — `chargedDamage` is computed inside `declareActorAction()`'s charge-resolve branch but never read (the value used for the actual hit is recomputed identically in `applyActionImpact()`, lines 563-565, which reads from `declared.chargedSkill` + `battle.totalTurnsElapsed` independently). Dead computation.
2. `TurnBuffSystem.ts` (around line 205, `convert()`) — hardcodes converted dot damage to `0` with no comment explaining why, unlike the original `BuffSystem.ts` which has one. A future dot-based `convertsToId` chain would silently stop dealing damage with no clue why.
3. `TurnBuffSystem.ts` (around line 219) — `duration`/`remainingTurns` are stored as floats (scaled by resist/duration-bonus percentages) rather than integer turn counts, so a fractional duration effectively rounds up and ticks one extra turn before expiring. This is a behavior note, not necessarily a bug — documenting it prevents a future balance-pass from being confused by turn counts that don't match the nominal duration exactly.
4. `TurnOrderPreview.ts` (around line 63) — cloned preview participants still share the live `CombatEntity` reference rather than a deep copy. Currently harmless (preview is read-only), but fragile if a future change to `TurnQueue`/preview logic ever mutates the clone expecting isolation.

**Files:**
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts:378-390` (remove dead `chargedDamage` computation)
- Modify: `game/src/core/battle/turn/TurnBuffSystem.ts` (add explanatory comments only — no behavior change)
- Modify: `game/src/core/battle/turn/TurnOrderPreview.ts` (add explanatory comment only — no behavior change)

**Interfaces:** none changed — this task is comment/dead-code-only, no test changes required for items 2-4. Item 1 needs a regression run since it removes code (even though unused).

- [ ] **Step 1: Remove the dead `chargedDamage` computation**

In `game/src/core/battle/turn/TurnBattleSystem.ts`, inside `declareActorAction()`'s charge-resolve branch (around lines 377-389), remove the unused local:

```ts
          if (primaryTarget) {
            const affected = collectTurnTargets(primaryTarget, opposingSide, chargedSkill.targeting)

            // Damage tính lại ở applyActionImpact() (đọc declared.chargedSkill +
            // totalTurnsElapsed độc lập) — không cần tính trùng ở đây.
            chargeTargetIds = affected.filter((target) => target.entity.alive).map((target) => target.id)
            chargedSkillCaptured = chargedSkill
          }
```

(This removes the `const suddenDeathMultiplier = ...` and `const chargedDamage = ...` lines that were only feeding an unused variable — confirm by re-reading the full charge-resolve branch first that `chargedDamage`/its `suddenDeathMultiplier` local aren't referenced anywhere else in the branch before deleting; if `suddenDeathMultiplier` IS used elsewhere in that branch, keep it and remove only the truly-unused `chargedDamage` line.)

- [ ] **Step 2: Run the charge-related tests to confirm no behavior change**

Run: `npx vitest run TurnBattleSystem`
Expected: PASS — this was genuinely dead code (verified during this plan's review that the value is recomputed independently in `applyActionImpact()`), so no test should reference it.

- [ ] **Step 3: Document `TurnBuffSystem.convert()`'s hardcoded 0 dot damage**

In `game/src/core/battle/turn/TurnBuffSystem.ts`, find the `convert()` method (around line 205) and add a comment above the line that sets dot damage to 0:

```ts
      // Convert-to-id chains hiện KHÔNG mang theo dot damage của buff gốc
      // (hardcode 0) — nếu tương lai cần 1 chain convert dựa trên dot (vd.
      // Độc → Cháy giữ % sát thương gốc), phải sửa Ở ĐÂY, không phải giả
      // định giá trị tự động carry qua.
```

- [ ] **Step 4: Document the float-duration rounding behavior**

In `game/src/core/battle/turn/TurnBuffSystem.ts`, near where `duration`/`remainingTurns` scaling happens (around line 219), add:

```ts
      // duration/remainingTurns có thể là số thập phân (resist%/duration-bonus%
      // scale) — hệ tick nguyên lượt nên 1 buff duration=2.3 thực tế tồn tại
      // hết lượt thứ 3 (làm tròn lên), KHÔNG hết đúng giữa lượt 2 và 3. Đây là
      // hành vi đã biết (không phải bug) — balance pass cần tính theo số lượt
      // NGUYÊN thực tế, không phải giá trị duration thô.
```

- [ ] **Step 5: Document the shared `CombatEntity` reference in `TurnOrderPreview`**

In `game/src/core/battle/turn/TurnOrderPreview.ts`, near the clone logic (around line 63), add:

```ts
    // Clone participant cho preview vẫn TRỎ CHUNG entity sống (không deep-copy
    // CombatEntity) — an toàn vì preview chỉ đọc, không mutate. Nếu sau này
    // preview logic cần mô phỏng trạng thái giả định (vd. "nếu X chết thì thứ
    // tự đổi thế nào"), phải deep-copy entity ở đây trước, không sửa trực tiếp.
```

- [ ] **Step 6: Full regression + typecheck**

Run: `npx vitest run`
Run: `npx vue-tsc --noEmit`
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add game/src/core/battle/turn/TurnBattleSystem.ts game/src/core/battle/turn/TurnBuffSystem.ts game/src/core/battle/turn/TurnOrderPreview.ts
git commit -m "docs(turn-combat): document convert()/duration-rounding/preview-clone invariants, remove dead charge damage calc"
```

---

## Final Verification (after all 8 tasks)

- [ ] Run `npx vitest run` — full suite green.
- [ ] Run `npx vue-tsc --noEmit` — zero errors.
- [ ] Run `grep -rn "queuedFollowUpActorId\b" game/src` (word-boundary, singular) — zero matches (confirms the Task 1 rename is complete everywhere).
- [ ] Run `grep -rln "useCombatSkillPresentation\|KiemTuCombatHud\|MortalCombatHud" game/src` — zero matches (confirms Task 7's removal is complete).
- [ ] Manually play through 1 full battle in the browser on each of the 3 cultivation paths, confirming: VFX/pacing visible (Task 3), only one skill bar visible (Task 7), and a counter/follow-up-equipped enemy (if any exists in current content — if not, this specific check is deferred to whenever `reactiveTrigger` gets real content per the original Action Playback spec's stated out-of-scope) actually gets its bonus turn (Task 1).
- [ ] Update `game/docs/turn-based-combat-roadmap.md` with a short section noting this defect-fix batch, linking this plan file, once all tasks are merged.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-05-turn-combat-defect-fixes.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.
