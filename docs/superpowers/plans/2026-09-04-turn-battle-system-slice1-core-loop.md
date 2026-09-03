# TurnBattleSystem Slice 1 (Core Turn Loop) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new, fully independent, headless `TurnBattleSystem` class
that proves the ATB turn engine (built in a prior "Foundation" plan) can
actually resolve a fight — turn order, targeting, and real damage — end
to end, without touching any existing production file.

**Architecture:** One new file pair
(`game/src/core/battle/turn/TurnBattleSystem.ts` +
`TurnBattleSystem.test.ts`) that composes three already-existing pieces:
`TurnQueue.resolveNextTurn` (turn order), a new pure `selectTarget`
helper built on existing `BattleGrid.ts` grid math (targeting), and
`CombatSystem.resolveActionHit` (damage — reused completely unmodified).
Nothing else in the codebase is imported by, or imports, this new file —
it is not wired into `GameManager`, `BattleSystem.ts`, or any UI.

**Tech Stack:** TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-04-turn-battle-system-slice1-core-loop-design.md`

## Global Constraints

- This plan creates ONLY new files. It must not modify
  `BattleSystem.ts`, `CombatSystem.ts`, `Battle.ts`, or any other
  existing production file — the live real-time game must be completely
  unaffected (per spec §2/§3).
- No skill loadout, AOE shapes, buffs, Reaction Engine, hazard zones,
  Momentum/Break, boss mechanics, wave spawning, `GameManager`/UI wiring,
  or the Stat System `speed` conversion — all explicitly out of scope
  (spec §2). `speed` is a plain per-participant number, never read from
  `entity.stats`.
- No `any` unless truly unavoidable (project rule, `game/CLAUDE.md`). No
  new dependencies.
- Every new file lives under `game/src/core/battle/turn/`, alongside the
  existing Foundation primitives (`ActionGauge.ts`, `TurnQueue.ts`,
  `ChannelQueue.ts`, `AoeShape.ts`, `BounceChain.ts`, `TrueShot.ts`,
  `BossTurnTriggers.ts`, `MomentumBreak.ts`, `ResourceTurnHook.ts` —
  already merged to `master`, read-only for this plan).

---

## Task 1: `selectTarget` — pure targeting helper

**Files:**
- Create: `game/src/core/battle/turn/TurnBattleSystem.ts`
- Test: `game/src/core/battle/turn/TurnBattleSystem.test.ts`

**Interfaces:**
- Consumes: `entityGridPosition(entity: Pick<CombatEntity, 'x' | 'row'>): GridPosition` and `getChebyshevDistance(from: GridPosition, to: GridPosition): number` from `../BattleGrid` (existing file, unchanged). `CombatEntity` type from `../../combat/CombatEntity` (existing file, unchanged).
- Produces: `type TurnBattleState = 'fighting' | 'victory' | 'defeat'`, `interface TurnBattleParticipant { id: string; entity: CombatEntity; speed: number; priority: number; actionGauge: number; alive: boolean }`, `interface TurnBattle { player: TurnBattleParticipant; enemies: TurnBattleParticipant[]; state: TurnBattleState }`, `selectTarget(actor: TurnBattleParticipant, opposingSide: TurnBattleParticipant[]): TurnBattleParticipant | undefined`.

- [ ] **Step 1: Write the failing test**

```typescript
// game/src/core/battle/turn/TurnBattleSystem.test.ts
import { describe, expect, it } from 'vitest'
import { selectTarget, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'

// Fixture giống hệt quy ước đã dùng trong ActionTargetingSystem.test.ts —
// selectTarget chỉ đọc id/x/row/alive, không cần Stats đầy đủ.
function entity(id: string, column: number, row: number, alive = true): CombatEntity {
  return {
    id,
    x: column,
    row: row as never,
    alive,
  } as unknown as CombatEntity
}

function participant(
  id: string,
  combatEntity: CombatEntity,
  speed = 10,
  priority = 0,
): TurnBattleParticipant {
  return { id, entity: combatEntity, speed, priority, actionGauge: 0, alive: combatEntity.alive }
}

describe('selectTarget', () => {
  it('cùng hàng: chọn entity gần nhất theo cột', () => {
    const actor = participant('actor', entity('actor', 0, 4))
    const near = participant('near', entity('near', 2, 4))
    const far = participant('far', entity('far', 5, 4))

    expect(selectTarget(actor, [far, near])?.id).toBe('near')
  })

  it('không có ai cùng hàng: chọn gần nhất theo Chebyshev toàn bàn cờ', () => {
    const actor = participant('actor', entity('actor', 0, 4))
    const otherRowNear = participant('otherRowNear', entity('otherRowNear', 1, 5))
    const otherRowFar = participant('otherRowFar', entity('otherRowFar', 8, 8))

    expect(selectTarget(actor, [otherRowFar, otherRowNear])?.id).toBe('otherRowNear')
  })

  it('bỏ qua entity đã chết', () => {
    const actor = participant('actor', entity('actor', 0, 4))
    const dead = participant('dead', entity('dead', 1, 4, false))
    const alive = participant('alive', entity('alive', 3, 4))

    expect(selectTarget(actor, [dead, alive])?.id).toBe('alive')
  })

  it('toàn bộ phe đối diện đã chết: trả về undefined', () => {
    const actor = participant('actor', entity('actor', 0, 4))
    const dead = participant('dead', entity('dead', 1, 4, false))

    expect(selectTarget(actor, [dead])).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd game && npx vitest run src/core/battle/turn/TurnBattleSystem.test.ts`
Expected: FAIL — `./TurnBattleSystem` does not exist.

- [ ] **Step 3: Write minimal implementation**

```typescript
// game/src/core/battle/turn/TurnBattleSystem.ts
// TurnBattleSystem Slice 1 (spec 2026-09-04) — engine turn-based độc lập,
// headless, KHÔNG nối vào BattleSystem.ts/GameManager. Chứng minh ATB
// gauge (TurnQueue) + targeting + CombatSystem.resolveActionHit chạy
// đúng end-to-end trước khi lớp thêm skill/buff/reaction/hazard zone ở
// slice sau.
import type { CombatEntity } from '../../combat/CombatEntity'
import { entityGridPosition, getChebyshevDistance } from '../BattleGrid'

export type TurnBattleState = 'fighting' | 'victory' | 'defeat'

export interface TurnBattleParticipant {
  id: string
  entity: CombatEntity
  speed: number
  priority: number
  actionGauge: number
  alive: boolean
}

export interface TurnBattle {
  player: TurnBattleParticipant
  enemies: TurnBattleParticipant[]
  state: TurnBattleState
}

/**
 * Luật targeting §4: cùng hàng thì chọn gần nhất theo cột (không thể
 * nhắm xuyên qua entity đứng gần hơn cùng hàng); không có ai cùng hàng
 * thì chọn gần nhất toàn bàn cờ theo Chebyshev.
 */
export function selectTarget(
  actor: TurnBattleParticipant,
  opposingSide: TurnBattleParticipant[],
): TurnBattleParticipant | undefined {
  const living = opposingSide.filter((participant) => participant.entity.alive)

  if (living.length === 0) {
    return undefined
  }

  const actorPosition = entityGridPosition(actor.entity)

  const sameRow = living.filter(
    (participant) => entityGridPosition(participant.entity).row === actorPosition.row,
  )

  const pool = sameRow.length > 0 ? sameRow : living

  return pool.reduce((nearest, candidate) => {
    const nearestDistance = getChebyshevDistance(actorPosition, entityGridPosition(nearest.entity))
    const candidateDistance = getChebyshevDistance(actorPosition, entityGridPosition(candidate.entity))

    return candidateDistance < nearestDistance ? candidate : nearest
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd game && npx vitest run src/core/battle/turn/TurnBattleSystem.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add game/src/core/battle/turn/TurnBattleSystem.ts game/src/core/battle/turn/TurnBattleSystem.test.ts
git commit -m "feat(turn-combat): add selectTarget targeting helper for TurnBattleSystem Slice 1"
```

---

## Task 2: `TurnBattleSystem.runToCompletion` — the turn loop

**Files:**
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts` (append to the file created in Task 1)
- Modify: `game/src/core/battle/turn/TurnBattleSystem.test.ts` (append to the file created in Task 1)

**Interfaces:**
- Consumes: `TurnBattleParticipant`, `TurnBattle`, `TurnBattleState`, `selectTarget` (Task 1, same file). `resolveNextTurn<T extends TurnQueueActor>(actors: T[]): ResolvedTurn<T> | null` from `./TurnQueue` (existing Foundation file — `TurnBattleParticipant` already structurally satisfies `TurnQueueActor` via its `id`/`speed`/`actionGauge`/`alive`/`priority` fields). `consumeGaugeAfterAction(actor: GaugeActor, fractionConsumed?: number): void` from `./ActionGauge` (existing Foundation file). `CombatSystem` class + `resolveActionHit(source, target, damage, critical?): DamageResult` from `../../combat/CombatSystem` (existing file, `damage: ActionDamageInfo` from `../ActionImpactSystem`).
- Produces: `class TurnBattleSystem { constructor(combat: CombatSystem, maxTurns?: number); runToCompletion(battle: TurnBattle): TurnBattleState }`.

- [ ] **Step 1: Write the failing test**

Append to `game/src/core/battle/turn/TurnBattleSystem.test.ts` (add these imports to the top of the file, alongside the existing ones from Task 1, and add the new `describe` block at the end of the file):

```typescript
// Add to the top imports:
import { TurnBattleSystem, type TurnBattle } from './TurnBattleSystem'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'

// Fixture giống hệt quy ước CombatSystem.damageFloor.test.ts — cần Stats
// đầy đủ vì runToCompletion gọi thật CombatSystem.resolveActionHit().
function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0 }

  return {
    id: 'id',
    name: 'name',
    type: 'enemy',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentSwordIntent: 0,
    currentMomentum: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    timeSinceLastBleedProc: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  } as CombatEntity
}

function makeParticipant(
  id: string,
  combatEntity: CombatEntity,
  speed: number,
  priority: number,
): TurnBattleParticipant {
  return { id, entity: combatEntity, speed, priority, actionGauge: 0, alive: combatEntity.alive }
}

// Add this describe block at the end of the file:
describe('TurnBattleSystem.runToCompletion', () => {
  it('đòn trúng làm giảm HP, trận kết thúc đúng trạng thái khi enemy chết', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1,
      maxHp: 1,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const battle: TurnBattle = {
      player: makeParticipant('player', player, 10, 0),
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const result = system.runToCompletion(battle)

    expect(result).toBe('victory')
    expect(battle.state).toBe('victory')
  })

  it('player chết trước => defeat', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      currentHp: 1,
      maxHp: 1,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })

    const battle: TurnBattle = {
      player: makeParticipant('player', player, 10, 0),
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const result = system.runToCompletion(battle)

    expect(result).toBe('defeat')
  })

  it('nhiều enemy: target chuyển sang enemy gần kế tiếp sau khi enemy gần nhất chết', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      row: 4,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 50 },
    })
    const near = createCombatant({
      id: 'near',
      row: 4,
      x: 1,
      currentHp: 1,
      maxHp: 1,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })
    const far = createCombatant({
      id: 'far',
      row: 4,
      x: 5,
      currentHp: 10,
      maxHp: 10,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const battle: TurnBattle = {
      player: makeParticipant('player', player, 10, 0),
      enemies: [makeParticipant('near', near, 5, 1), makeParticipant('far', far, 5, 2)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const result = system.runToCompletion(battle)

    expect(result).toBe('victory')
    expect(near.alive).toBe(false)
    expect(far.alive).toBe(false)
    expect(far.currentHp).toBeLessThan(10)
  })

  it('vượt quá số lượt tối đa: dừng an toàn ở defeat, không treo', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 1 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 1 },
    })

    const battle: TurnBattle = {
      player: makeParticipant('player', player, 10, 0),
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 3)
    const result = system.runToCompletion(battle)

    expect(result).toBe('defeat')
    expect(player.alive).toBe(true)
    expect(enemyEntity.alive).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd game && npx vitest run src/core/battle/turn/TurnBattleSystem.test.ts`
Expected: FAIL — `TurnBattleSystem` is not exported from `./TurnBattleSystem`.

- [ ] **Step 3: Write minimal implementation**

Append to `game/src/core/battle/turn/TurnBattleSystem.ts` (add these imports to the top of the file, alongside the Task 1 imports, and add the class at the end of the file):

```typescript
// Add to the top imports:
import type { CombatSystem } from '../../combat/CombatSystem'
import { consumeGaugeAfterAction } from './ActionGauge'
import { resolveNextTurn } from './TurnQueue'

// Add at the end of the file:
const DEFAULT_MAX_TURNS = 10_000

export class TurnBattleSystem {
  constructor(
    private readonly combat: CombatSystem,
    private readonly maxTurns: number = DEFAULT_MAX_TURNS,
  ) {}

  runToCompletion(battle: TurnBattle): TurnBattleState {
    const allParticipants = [battle.player, ...battle.enemies]

    for (let turn = 0; turn < this.maxTurns; turn++) {
      for (const participant of allParticipants) {
        participant.alive = participant.entity.alive
      }

      const resolved = resolveNextTurn(allParticipants)

      if (!resolved) {
        battle.state = 'defeat'
        return battle.state
      }

      const actor = resolved.actor
      const opposingSide = actor === battle.player ? battle.enemies : [battle.player]
      const target = selectTarget(actor, opposingSide)

      if (target) {
        this.combat.resolveActionHit(actor.entity, target.entity, { kind: 'physical', multiplier: 1 })
      }

      consumeGaugeAfterAction(actor)

      if (!battle.player.entity.alive) {
        battle.state = 'defeat'
        return battle.state
      }

      if (battle.enemies.every((enemy) => !enemy.entity.alive)) {
        battle.state = 'victory'
        return battle.state
      }
    }

    battle.state = 'defeat'
    return battle.state
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd game && npx vitest run src/core/battle/turn/TurnBattleSystem.test.ts`
Expected: PASS (8 tests — 4 from Task 1 + 4 from this task)

- [ ] **Step 5: Commit**

```bash
git add game/src/core/battle/turn/TurnBattleSystem.ts game/src/core/battle/turn/TurnBattleSystem.test.ts
git commit -m "feat(turn-combat): add TurnBattleSystem.runToCompletion core turn loop"
```

---

## Task 3: Full-suite verification

- [ ] **Step 1: Run the new file's test suite alone**

Run: `cd game && npx vitest run src/core/battle/turn/TurnBattleSystem.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 2: Run the project's full existing test suite to confirm zero regressions**

Run: `cd game && npx vitest run`
Expected: PASS — identical pass count to before this plan (this plan only adds two new files under `game/src/core/battle/turn/`; nothing existing was modified, imported, or wired in).

- [ ] **Step 3: Run typecheck**

Run: `cd game && npx vue-tsc --noEmit` (or the project's existing typecheck script — check `game/package.json`'s `"scripts"` for the exact name)
Expected: PASS, no new errors.

- [ ] **Step 4: Commit if any fixups were needed**

```bash
git add -A
git commit -m "test(turn-combat): verify TurnBattleSystem Slice 1 + no regressions"
```

(Skip this commit if Steps 1-3 all passed with no changes needed.)

---

## Not Covered By This Plan

Per spec §2/§5, explicitly deferred to later slices, each with its own
future spec + plan:

- Skill loadout, AOE shapes, Bounce, TrueShot, cast/`chargeSteps` channeling.
- Buffs, Reaction Engine, Momentum/Break, boss Phase/Enrage/Summon.
- Hazard zones (Lava/Sword Zone).
- Wave spawning / `StageWaveSystem` conversion.
- The Stat System `speed` conversion (this slice never reads
  `entity.stats.speed` — speed stays a plain constructor argument).
- `GameManager`/UI wiring — `TurnBattleSystem` remains headless and
  unreferenced by any production code until a future cutover slice.
