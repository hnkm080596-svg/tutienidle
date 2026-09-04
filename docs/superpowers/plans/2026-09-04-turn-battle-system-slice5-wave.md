# Turn Battle System — Slice 5: Wave / Stage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `TurnBattleSystem` support multi-wave stages — spawning the next enemy the instant the arena empties, and only declaring victory once every wave enemy has both spawned and died — using the already-merged `WaveSpawnTrigger.ts` pure functions.

**Architecture:** `TurnBattle` gains an optional `wave` state; `TurnBattleSystem`'s constructor gains an optional `spawnEnemy` factory (test-supplied fixture, no real `Enemy`/`Stage` content). Both the spawn check and the win-condition change happen at the very end of `resolveNextStep()`, right before the existing win/defeat check — when `wave` is absent, behavior is byte-for-byte unchanged from Slices 1-4.

**Tech Stack:** TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-04-turn-battle-system-slice5-wave-design.md`

**Dependency:** This plan assumes Slice 2, Slice 3, and Slice 4's plans have all already been executed and merged — it modifies `resolveNextStep()` starting from the exact shape Slice 4's Task 3 left it in (reproduced in Task 2 below). If the real merged code differs, resolve the mismatch before starting Task 1.

## Global Constraints

- Do not modify `game/src/core/game/StageWaveSystem.ts`, `game/src/core/stage/StageManager.ts`, `game/src/core/stage/Stage.ts`, or `game/src/core/game/GameManager.ts`.
- No `any` types.
- No real content migration (`pickEnemyForSpawn()`'s enemy-pool/elite/hidden-beast/boss logic) — `spawnEnemy` in this plan's tests is a fixture closure only.

---

### Task 1: Add `wave` to `TurnBattle` + `spawnEnemy` constructor param

**Files:**
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts`

**Interfaces:**
- Produces: `TurnBattle.wave?: { totalEnemyCount: number; spawnedCount: number }`, `TurnBattleSystem` constructor's optional 4th param `spawnEnemy?: () => TurnBattleParticipant` — used by Task 2.

- [ ] **Step 1: Extend `TurnBattle`**

In `game/src/core/battle/turn/TurnBattleSystem.ts`, modify `TurnBattle`:

```typescript
export interface TurnBattle {
  player: TurnBattleParticipant
  enemies: TurnBattleParticipant[]
  state: TurnBattleState
  totalTurnsElapsed?: number
  wave?: {
    totalEnemyCount: number
    spawnedCount: number
  }
}
```

- [ ] **Step 2: Extend the `TurnBattleSystem` constructor**

Modify the constructor:

```typescript
export class TurnBattleSystem {
  constructor(
    private readonly combat: CombatSystem,
    private readonly maxTurns: number = DEFAULT_MAX_TURNS,
    private readonly registry?: TurnBuffRegistry,
    private readonly spawnEnemy?: () => TurnBattleParticipant,
  ) {}
```

- [ ] **Step 3: Run the full turn/ test suite to verify nothing broke**

Run: `npx vitest run game/src/core/battle/turn/`
Expected: PASS — both additions are optional/additive, no existing call site or test object literal needs updating.

- [ ] **Step 4: Typecheck**

Run: `npx vue-tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add game/src/core/battle/turn/TurnBattleSystem.ts
git commit -m "feat(turn-combat): add TurnBattle.wave + spawnEnemy constructor param (Slice 5 task 1)"
```

---

### Task 2: Wire wave spawning + `isStageComplete` win condition

**Files:**
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts`
- Test: `game/src/core/battle/turn/TurnBattleSystem.test.ts`

**Interfaces:**
- Consumes: `shouldSpawnNextEnemy`/`isStageComplete` (`game/src/core/battle/turn/WaveSpawnTrigger.ts`), `TurnBattle.wave`/`spawnEnemy` (Task 1).
- Produces: nothing new for later tasks — final integration point of this slice.

- [ ] **Step 1: Write the failing tests**

Append to `game/src/core/battle/turn/TurnBattleSystem.test.ts`:

```typescript
describe('TurnBattleSystem.resolveNextStep multi-wave spawning', () => {
  it('spawns the next wave enemy once the arena is empty, but does not win yet', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyA = createCombatant({
      id: 'enemyA',
      currentHp: 1,
      maxHp: 1,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const wave = { totalEnemyCount: 2, spawnedCount: 1 }
    const battle: TurnBattle = {
      player: makeParticipant('player', player, 10, 0),
      enemies: [makeParticipant('enemyA', enemyA, 10, 1)],
      state: 'fighting',
      wave,
    }

    const spawnEnemy = (): TurnBattleParticipant => {
      const enemyB = createCombatant({
        id: 'enemyB',
        currentHp: 1_000_000,
        maxHp: 1_000_000,
        stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
      })

      return makeParticipant('enemyB', enemyB, 10, 2)
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 20, undefined, spawnEnemy)
    system.resolveNextStep(battle)

    expect(battle.enemies).toHaveLength(2)
    expect(battle.enemies[1]!.id).toBe('enemyB')
    expect(wave.spawnedCount).toBe(2)
    expect(battle.state).toBe('fighting')
  })

  it('does not spawn while an enemy is still alive', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 1 },
    })
    const enemyA = createCombatant({
      id: 'enemyA',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const wave = { totalEnemyCount: 2, spawnedCount: 1 }
    const battle: TurnBattle = {
      player: makeParticipant('player', player, 10, 0),
      enemies: [makeParticipant('enemyA', enemyA, 10, 1)],
      state: 'fighting',
      wave,
    }

    let spawnCalls = 0
    const spawnEnemy = (): TurnBattleParticipant => {
      spawnCalls += 1

      const enemyB = createCombatant({
        id: 'enemyB',
        currentHp: 1,
        maxHp: 1,
        stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
      })

      return makeParticipant('enemyB', enemyB, 10, 2)
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 20, undefined, spawnEnemy)
    system.resolveNextStep(battle)

    expect(spawnCalls).toBe(0)
    expect(wave.spawnedCount).toBe(1)
    expect(battle.enemies).toHaveLength(1)
  })

  it('reaches victory via isStageComplete once every wave enemy has spawned and died', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyA = createCombatant({
      id: 'enemyA',
      currentHp: 1,
      maxHp: 1,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const wave = { totalEnemyCount: 1, spawnedCount: 1 }
    const battle: TurnBattle = {
      player: makeParticipant('player', player, 10, 0),
      enemies: [makeParticipant('enemyA', enemyA, 10, 1)],
      state: 'fighting',
      wave,
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 20)
    system.resolveNextStep(battle)

    expect(battle.state).toBe('victory')
    expect(battle.enemies).toHaveLength(1)
  })

  it('does not declare victory until every wave enemy has spawned and died (multi-step)', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyA = createCombatant({
      id: 'enemyA',
      currentHp: 1,
      maxHp: 1,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const wave = { totalEnemyCount: 2, spawnedCount: 1 }
    const battle: TurnBattle = {
      player: makeParticipant('player', player, 10, 0),
      enemies: [makeParticipant('enemyA', enemyA, 10, 1)],
      state: 'fighting',
      wave,
    }

    const spawnEnemy = (): TurnBattleParticipant => {
      const enemyB = createCombatant({
        id: 'enemyB',
        currentHp: 1,
        maxHp: 1,
        stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
      })

      return makeParticipant('enemyB', enemyB, 10, 2)
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 20, undefined, spawnEnemy)

    // Step 1: player kills enemyA. Arena empties -> enemyB spawns this same
    // step, but enemyB is alive so victory does not fire yet.
    system.resolveNextStep(battle)
    expect(battle.state).toBe('fighting')
    expect(battle.enemies).toHaveLength(2)

    // Step 2: player (same speed, lower priority, wins the tie) kills
    // enemyB. Arena empties, spawnedCount already equals totalEnemyCount ->
    // no further spawn, victory fires.
    system.resolveNextStep(battle)
    expect(battle.state).toBe('victory')
  })

  it('behaves exactly like Slices 1-4 when wave is not set (no regression)', () => {
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
    system.resolveNextStep(battle)

    expect(battle.state).toBe('victory')
    expect(battle.enemies).toHaveLength(1)
  })

  it('does not throw and does not spawn when wave is set but no spawnEnemy factory was provided', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyA = createCombatant({
      id: 'enemyA',
      currentHp: 1,
      maxHp: 1,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const wave = { totalEnemyCount: 2, spawnedCount: 1 }
    const battle: TurnBattle = {
      player: makeParticipant('player', player, 10, 0),
      enemies: [makeParticipant('enemyA', enemyA, 10, 1)],
      state: 'fighting',
      wave,
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 20)

    expect(() => system.resolveNextStep(battle)).not.toThrow()
    expect(battle.enemies).toHaveLength(1)
    expect(wave.spawnedCount).toBe(1)
    expect(battle.state).toBe('fighting')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run game/src/core/battle/turn/TurnBattleSystem.test.ts`
Expected: FAIL — `wave`/`spawnEnemy` are never read by `resolveNextStep()` yet, so no spawning happens and the win condition ignores `wave`.

- [ ] **Step 3: Wire wave spawning and the win-condition change**

In `game/src/core/battle/turn/TurnBattleSystem.ts`, add the import:

```typescript
import { shouldSpawnNextEnemy, isStageComplete } from './WaveSpawnTrigger'
```

Modify `resolveNextStep()` — replace the tail of the method (from `consumeGaugeAfterAction(actor)` through the final `return`) with:

```typescript
    consumeGaugeAfterAction(actor)

    if (battle.wave && this.spawnEnemy) {
      const aliveEnemyCount = battle.enemies.filter((enemy) => enemy.entity.alive).length

      if (shouldSpawnNextEnemy(battle.wave.spawnedCount, battle.wave.totalEnemyCount, aliveEnemyCount)) {
        battle.enemies.push(this.spawnEnemy())
        battle.wave.spawnedCount += 1
      }
    }

    const finalAliveEnemyCount = battle.enemies.filter((enemy) => enemy.entity.alive).length

    if (!battle.player.entity.alive) {
      battle.state = 'defeat'
    } else if (
      battle.wave
        ? isStageComplete(battle.wave.spawnedCount, battle.wave.totalEnemyCount, finalAliveEnemyCount)
        : battle.enemies.every((enemy) => !enemy.entity.alive)
    ) {
      battle.state = 'victory'
    }

    return { state: battle.state, actorId: actor.id, skillId, targetIds, ccBlocked }
  }
```

(Everything above `consumeGaugeAfterAction(actor)` in `resolveNextStep()` — the buff tick, resource tick, boss trigger check, CC check, and action resolution — stays exactly as Slice 3/4 left it, untouched.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run game/src/core/battle/turn/TurnBattleSystem.test.ts game/src/core/battle/turn/TurnBattleSystem.adversarial.test.ts game/src/core/battle/turn/TurnBattleSystem.qadebug.test.ts`
Expected: PASS — all pre-existing cases (none set `wave`, so they take the unchanged `battle.enemies.every(...)` branch) plus the 6 new cases.

- [ ] **Step 5: Typecheck**

Run: `npx vue-tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add game/src/core/battle/turn/TurnBattleSystem.ts game/src/core/battle/turn/TurnBattleSystem.test.ts
git commit -m "feat(turn-combat): wire multi-wave spawning + isStageComplete win condition (Slice 5 task 2)"
```

---

### Task 3: Full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS, zero regressions. Only `game/src/core/battle/turn/**` files were touched, none of which are imported by any live production file.

- [ ] **Step 2: Run typecheck**

Run: `npx vue-tsc --noEmit` (or the project's existing typecheck script — check `package.json`'s `scripts` for the exact command already used elsewhere in this repo before running).
Expected: PASS, zero errors.

- [ ] **Step 3: Commit any fixups**

If Step 1-2 required fixes beyond what Tasks 1-2 anticipated, stage exactly the changed files and commit:

```bash
git add -A
git commit -m "fix: address regressions found during Slice 5 full-suite verification"
```

If no fixes were needed, skip this step.

## Not Covered By This Plan

- Real content migration: `StageWaveSystem.pickEnemyForSpawn()`'s enemy-pool roll, elite chance, hidden-beast substitution, and boss-on-final-spawn override as the real `spawnEnemy` factory — separate future work for the real cutover (Slice 6), tracked in the roadmap.
- Boss-priority spawn ordering — already pure/time-agnostic in the live file, reusable as-is at real cutover time.
- Any change to `StageWaveSystem.ts`, `StageManager.ts`, `Stage.ts`, or `GameManager.ts`.
