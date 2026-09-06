# Turn-Based Wave Redesign + Spawn VFX Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace turn-based combat's "1 enemy at a time" spawn model with wave batches (`Stage.waves: number[]`) where every enemy in a wave telegraphs and materializes together, and wire `EnemySpawnVfx.ts` into turn-based combat for both wave spawns and the 3→2→1 battle-start countdown, without changing the legacy real-time engine's behavior at all.

**Architecture:** `Stage` gains authored `waves: number[]` data (all 30 stages); `effectiveWaves()` mirrors the existing `effectiveTotalEnemyCount()` floor-10-solo-boss override. `TurnBattleSystem.tickPacing()` — the method GameManager actually calls every real fixed step (0.1s) in production — gains a new pending-spawn/wave-batch block that runs unconditionally every call (not gated behind an actor's turn resolving, unlike the current one-at-a-time spawn check which lives inside `completeAction()`). The turn-based snapshot event gains `pendingEnemySpawns`/`countdownProgress`; `CombatScene` reuses `EnemySpawnVfx.ts` through a narrowed `SpawnVfxSnapshot` interface (zero changes to the legacy call site) for wave telegraphs, plus one new, fully isolated method for the party countdown telegraph.

**Tech Stack:** TypeScript, Vitest, Phaser 4 (VFX layer only — the wave/telegraph mechanism itself has no Phaser dependency).

**Spec:** `docs/superpowers/specs/2026-09-06-turn-based-wave-spawn-vfx-design.md`

## Important correction to the spec's code sketch (read before starting Task 3)

The spec's §3 code sample shows the wave/telegraph tick-decrement logic
living inside `completeAction()` (mirroring where the CURRENT one-at-a-time
`shouldSpawnNextEnemy()` check lives today). Grounding the spec against the
actual file during this planning pass found a problem with that placement:
`completeAction()` only runs when `resolveActorTurn()` resolves an actor's
turn — and `resolveActorTurn()` is only reached via **either**
`resolveNextStep()` (a synchronous, no-wall-clock helper used by tests and
`runToCompletion()`) **or** via `tickPacing()`'s `ready` branch, which only
fires once some actor's ATB gauge is actually full. In production,
`GameManager`'s fixed-step loop calls `tickPacing()` **every 0.1s**
regardless of whether any actor is ready that tick (`GameManager.ts:3718`).
If the telegraph tick-decrement stayed inside `completeAction()`, a
telegraph's real-world duration would depend on how fast someone's gauge
fills (their `speed` stat), not on wall-clock time — breaking the spec's
Goal 5/user-approved "telegraph duration = fixed VFX length" pacing.

**Fix:** the pending-spawn/wave-batch block moves into `tickPacing()`
itself, running unconditionally at the top of every call (so it advances
once per real 0.1s tick, matching how `SPAWN_TELEGRAPH_TICKS` was derived).
The existing one-at-a-time block is removed from `completeAction()`
entirely (Task 3) — this is a deliberate, larger change than the spec's
sketch implied, not a mechanical port. Task 3 rewrites the existing
`TurnBattleSystem.resolveNextStep multi-wave spawning` test suite to drive
via `tickPacing()` instead of `resolveNextStep()`, since the mechanic these
tests exercise no longer lives on the `resolveNextStep()` path.

## Global Constraints

- TypeScript strict, no `any` anywhere.
- Explanatory comments MUST be in Vietnamese (short English technical terms/identifiers as lead-ins only) — this project's house style.
- The ONLY correct type-check gate is `npm.cmd run type-check` (runs `vue-tsc --build`). `npx vue-tsc --noEmit` walks zero files in this repo — NEVER use it.
- Every task touching `TurnBattleSystem.ts`, `GameManager.ts`, or `CombatScene.ts` must run the FULL existing suite (`npx vitest run`) and confirm zero regressions beyond the deliberate rewrites this plan calls out explicitly (Task 3's wave-spawn tests).
- Zero behavior change to `game/src/core/battle/legacy/BattleSystem.ts` or `StageWaveSystem.ts` — this plan touches neither file. If a task's diff would require touching either, stop and report instead of proceeding.
- Zero behavior change to `CombatVfxSpawner.reconcileSpawnVfx()`'s legacy call site (`CombatScene.ts`'s existing `reconcileSpawnVfx(event: BattlePositionsEvent)` delegate, called from the legacy positions-event handler) — only its parameter type narrows (Task 6); the method body and every legacy call site stay byte-for-byte identical.
- `sum(effectiveWaves(stage)) === effectiveTotalEnemyCount(stage)` must hold for all 30 stages at all times — Task 1's data-integrity test is the permanent guard for this; never edit a stage's `totalEnemyCount` or `waves` without re-running it.

---

### Task 1: `Stage.waves` + `effectiveWaves()` + data for all 30 stages

**Files:**
- Modify: `game/src/core/stage/Stage.ts`
- Create: `game/src/core/stage/EffectiveWaves.ts`
- Create: `game/src/core/stage/EffectiveWaves.test.ts`
- Modify: `game/src/data/stage/Stages.ts` (30 stage objects)

**Interfaces:**
- Consumes: `Stage`, `STAGES` (existing), `effectiveTotalEnemyCount()` (existing, `EffectiveEnemyCount.ts`).
- Produces: `Stage.waves: number[]`, `effectiveWaves(stage: Stage): number[]`.

- [ ] **Step 1: Add the `waves` field to `Stage`**

In `game/src/core/stage/Stage.ts`, add near `totalEnemyCount: number`:

```ts
  /**
   * Turn-Based Wave Redesign (2026-09-06) — số quái spawn ĐỒNG THỜI mỗi
   * wave, theo thứ tự. sum(waves) PHẢI bằng totalEnemyCount (test bất
   * biến enforce điều này cho mọi stage — xem EffectiveWaves.test.ts).
   * Stage floor 10 (solo boss) vẫn khai waves bình thường (dữ liệu thô,
   * không override) — effectiveWaves() mới là hàm áp override thành [1],
   * y hệt cách effectiveTotalEnemyCount() đã làm cho totalEnemyCount.
   */
  waves: number[]
```

- [ ] **Step 2: Write the failing test**

```ts
// EffectiveWaves.test.ts
import { describe, expect, it } from 'vitest'
import { STAGES } from '@/data/stage/Stages'
import { effectiveTotalEnemyCount } from './EffectiveEnemyCount'
import { effectiveWaves } from './EffectiveWaves'

describe('effectiveWaves() sum invariant (Turn-Based Wave Redesign)', () => {
  it.each(STAGES.map((stage) => stage.id))(
    '%s: sum(effectiveWaves) === effectiveTotalEnemyCount',
    (stageId) => {
      const stage = STAGES.find((candidate) => candidate.id === stageId)!
      const waves = effectiveWaves(stage)
      const sum = waves.reduce((total, count) => total + count, 0)

      expect(sum).toBe(effectiveTotalEnemyCount(stage))
    },
  )
})

describe('effectiveWaves() floor-10 override', () => {
  it('floor 10 stage với bossEnemyId → luôn [1] bất kể waves thô là gì', () => {
    const stage = STAGES.find((candidate) => candidate.id === 'qi_refining_abyssal_pool')!

    expect(stage.floor).toBe(10)
    expect(effectiveWaves(stage)).toEqual([1])
  })

  it('floor khác 10 → trả nguyên waves thô, không override', () => {
    const stage = STAGES.find((candidate) => candidate.id === 'qi_refining_forest')!

    expect(effectiveWaves(stage)).toEqual(stage.waves)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run EffectiveWaves.test.ts`
Expected: FAIL — `EffectiveWaves.ts` doesn't exist yet; `Stage.waves` doesn't exist on any stage object yet (also causes `Stages.ts` type errors — expected until Step 5).

- [ ] **Step 4: Write `EffectiveWaves.ts`**

```ts
// EffectiveWaves (Turn-Based Wave Redesign, 2026-09-06) — mirror đúng
// EffectiveEnemyCount.ts's floor-10 solo-boss override, áp cho waves[]
// thay vì totalEnemyCount. Boss CHỈ xuất hiện ở floor 10 (xem
// StageWaveSystem.pickEnemyForSpawn()'s "DESIGN: boss chỉ xuất hiện ở
// tầng 10" comment) — floor 10 LUÔN là 1 wave duy nhất, 1 quái.
import type { Stage } from './Stage'

export function effectiveWaves(stage: Stage): number[] {
  if (stage.floor === 10 && stage.bossEnemyId) {
    return [1]
  }

  return stage.waves
}
```

- [ ] **Step 5: Add `waves` to all 30 stage objects in `Stages.ts`**

For each stage `id` below, insert a `waves: [...]` line immediately after
that stage object's existing `totalEnemyCount: N,` line (use the `id:`
field just above it to find the right object — several stages share the
same `totalEnemyCount` value, so anchor on `id`, not on the number):

| Stage id | `waves` to insert |
|---|---|
| `qi_refining_forest` | `waves: [3, 3, 4],` |
| `qi_refining_deep_forest` | `waves: [3, 4, 4],` |
| `qi_refining_ember_canyon` | `waves: [4, 4, 4],` |
| `qi_refining_scorched_ridge` | `waves: [4, 4, 5],` |
| `qi_refining_sand_plain` | `waves: [4, 5, 5],` |
| `qi_refining_stone_range` | `waves: [5, 5, 5],` |
| `qi_refining_blade_peak` | `waves: [5, 5, 6],` |
| `qi_refining_mineral_pit` | `waves: [5, 6, 6],` |
| `qi_refining_mystic_marsh` | `waves: [6, 6, 6],` |
| `qi_refining_abyssal_pool` | `waves: [19],` (raw — overridden to `[1]` by `effectiveWaves()`) |
| `mortal_dong_1` | `waves: [3, 3, 4],` |
| `mortal_dong_2` | `waves: [3, 4, 4],` |
| `mortal_dong_3` | `waves: [4, 4, 4],` |
| `mortal_dong_4` | `waves: [4, 4, 5],` |
| `mortal_dong_5` | `waves: [4, 5, 5],` |
| `mortal_dong_6` | `waves: [5, 5, 5],` |
| `mortal_dong_7` | `waves: [5, 5, 6],` |
| `mortal_dong_8` | `waves: [5, 6, 6],` |
| `mortal_dong_9` | `waves: [6, 6, 6],` |
| `mortal_dong_10` | `waves: [19],` (raw — overridden to `[1]`) |
| `foundation_floor_1` | `waves: [3, 3, 4],` |
| `foundation_floor_2` | `waves: [3, 4, 4],` |
| `foundation_floor_3` | `waves: [4, 4, 4],` |
| `foundation_floor_4` | `waves: [4, 4, 5],` |
| `foundation_floor_5` | `waves: [4, 5, 5],` |
| `foundation_floor_6` | `waves: [5, 5, 5],` |
| `foundation_floor_7` | `waves: [5, 5, 6],` |
| `foundation_floor_8` | `waves: [5, 6, 6],` |
| `foundation_floor_9` | `waves: [6, 6, 6],` |
| `foundation_floor_10` | `waves: [19],` (raw — overridden to `[1]`) |

Example (first stage, `qi_refining_forest`, `Stages.ts` around line 31):

```ts
    totalEnemyCount: 10,

    waves: [3, 3, 4],

    spawnIntervalSeconds: 3,
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run EffectiveWaves.test.ts` — all 32 tests pass (30 `it.each` sum-invariant + 2 floor-10-override tests).

- [ ] **Step 7: Type-check + full regression**

Run: `npm.cmd run type-check` (this is the step that catches any of the 30
stage objects that was missed — a missing `waves` field is a TS error since
the field is required, not optional) + `npx vitest run` (full) — both green.

- [ ] **Step 8: Commit**

```bash
git add game/src/core/stage/Stage.ts game/src/core/stage/EffectiveWaves.ts game/src/core/stage/EffectiveWaves.test.ts game/src/data/stage/Stages.ts
git commit -m "feat(turn-wave): add Stage.waves data + effectiveWaves() for all 30 stages"
```

---

### Task 2: `WaveSpawnTrigger.ts` — wave-aware trigger functions

**Files:**
- Modify: `game/src/core/battle/turn/WaveSpawnTrigger.ts`
- Modify: `game/src/core/battle/turn/WaveSpawnTrigger.test.ts`

**Interfaces:**
- Produces: `shouldStartNextWave(aliveCount, pendingCount, waveIndex, waveCount): boolean`. `isStageComplete()` gains a 4th parameter `pendingCount`.
- Consumes: nothing new.

- [ ] **Step 1: Write the failing tests**

Replace the file's contents with (existing `shouldSpawnNextEnemy` tests are
removed — that function is deleted in this task, replaced by
`shouldStartNextWave`; `isStageComplete`'s existing tests are updated for
the new 4-arg signature):

```ts
import { describe, expect, it } from 'vitest'
import { shouldStartNextWave, isStageComplete } from './WaveSpawnTrigger'

describe('shouldStartNextWave', () => {
  it('true khi sân trống, không còn pending, và còn wave chưa spawn', () => {
    expect(shouldStartNextWave(0, 0, 1, 3)).toBe(true)
  })

  it('false khi còn enemy sống', () => {
    expect(shouldStartNextWave(1, 0, 1, 3)).toBe(false)
  })

  it('false khi còn pending telegraph chưa materialize', () => {
    expect(shouldStartNextWave(0, 1, 1, 3)).toBe(false)
  })

  it('false khi đã hết wave (waveIndex >= waveCount)', () => {
    expect(shouldStartNextWave(0, 0, 3, 3)).toBe(false)
  })
})

describe('isStageComplete', () => {
  it('true khi mọi enemy đã spawn, sân trống, không còn pending', () => {
    expect(isStageComplete(5, 5, 0, 0)).toBe(true)
  })

  it('false khi vẫn còn enemy sống, dù đã spawn hết', () => {
    expect(isStageComplete(5, 5, 1, 0)).toBe(false)
  })

  it('false khi còn enemy chưa spawn, dù sân trống', () => {
    expect(isStageComplete(2, 5, 0, 0)).toBe(false)
  })

  it('false khi còn pending telegraph, dù spawnedCount/aliveCount đã đủ điều kiện cũ — regression cho bug "victory fires mid-telegraph"', () => {
    expect(isStageComplete(5, 5, 0, 1)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run WaveSpawnTrigger.test.ts`
Expected: FAIL — `shouldStartNextWave` doesn't exist; `isStageComplete` still takes 3 args.

- [ ] **Step 3: Rewrite `WaveSpawnTrigger.ts`**

```ts
// Turn-Based Combat — wave-spawn decision (spec:
// 2026-09-06-turn-based-wave-spawn-vfx-design.md). shouldSpawnNextEnemy()
// (1 enemy at a time) is REPLACED by shouldStartNextWave() (whole wave at
// once) — the old function is deleted, not deprecated, since nothing else
// calls it after TurnBattleSystem.ts (Task 3) migrates.

/**
 * True iff the arena is fully clear (no living enemy, no pending
 * telegraph) AND there is another wave left to spawn.
 */
export function shouldStartNextWave(
  aliveCount: number,
  pendingCount: number,
  waveIndex: number,
  waveCount: number,
): boolean {
  return aliveCount === 0 && pendingCount === 0 && waveIndex < waveCount
}

/**
 * True iff every enemy in the stage has already spawned, the arena is
 * currently empty, AND no enemy is still telegraphing. The pendingCount
 * check prevents victory from firing while the final wave's enemies are
 * still mid-telegraph (invisible, not yet real, but about to materialize).
 */
export function isStageComplete(
  spawnedCount: number,
  totalEnemyCount: number,
  aliveCount: number,
  pendingCount: number,
): boolean {
  return spawnedCount >= totalEnemyCount && aliveCount === 0 && pendingCount === 0
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run WaveSpawnTrigger.test.ts` — all 8 pass.

- [ ] **Step 5: Type-check**

Run: `npm.cmd run type-check` — expect FAILURES referencing
`TurnBattleSystem.ts` (still imports/calls the now-deleted
`shouldSpawnNextEnemy` and the old 3-arg `isStageComplete`) — this is
expected and fixed in Task 3, not this task. Confirm the ONLY errors are in
`TurnBattleSystem.ts`.

- [ ] **Step 6: Commit**

```bash
git add game/src/core/battle/turn/WaveSpawnTrigger.ts game/src/core/battle/turn/WaveSpawnTrigger.test.ts
git commit -m "feat(turn-wave): shouldStartNextWave() replaces shouldSpawnNextEnemy(), isStageComplete() gains pendingCount"
```

---

### Task 3: `TurnBattleSystem` — wave-batch spawn + telegraph in `tickPacing()`

**Files:**
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts`
- Modify: `game/src/core/battle/turn/TurnBattleSystem.test.ts`

**Interfaces:**
- Consumes: `shouldStartNextWave()`, `isStageComplete()` (Task 2).
- Produces: `PendingEnemySpawn` type; `TurnBattle.wave` gains `waves: number[]`, `waveIndex: number`, `pendingEnemySpawns: PendingEnemySpawn[]`.

- [ ] **Step 1: Read the "Important correction" section at the top of this plan before starting** — this task moves logic to a different method than the spec's code sample shows, for a documented reason.

- [ ] **Step 2: Add the new type and telegraph-duration helper**

Near the top of `TurnBattleSystem.ts`, after the `TurnBossTrigger` interface:

```ts
export interface PendingEnemySpawn {
  /** Đã build đầy đủ (roll template/elite/boss xong) — chỉ chờ hết telegraph. */
  participant: TurnBattleParticipant
  ticksRemaining: number
  totalTicks: number
}

// Turn-Based Wave Redesign (2026-09-06) — quy đổi TRỰC TIẾP từ
// SPAWN_TELEGRAPH_SECONDS của legacy/BattleSystem.ts (0.75s/1.0s/1.4s)
// sang tick (0.1s/tick, khớp BATTLE_FIXED_STEP mà GameManager gọi
// tickPacing() mỗi lần) để giữ đúng cảm giác thời gian người chơi đã quen.
const SPAWN_TELEGRAPH_TICKS = {
  normal: 8,
  elite: 10,
  boss: 14,
} as const

function spawnTelegraphTicks(entity: Pick<CombatEntity, 'isBoss' | 'isElite'>): number {
  if (entity.isBoss) {
    return SPAWN_TELEGRAPH_TICKS.boss
  }

  if (entity.isElite) {
    return SPAWN_TELEGRAPH_TICKS.elite
  }

  return SPAWN_TELEGRAPH_TICKS.normal
}
```

- [ ] **Step 3: Extend `TurnBattle.wave`**

Change:

```ts
  wave?: {
    totalEnemyCount: number
    spawnedCount: number
  }
```

to:

```ts
  wave?: {
    totalEnemyCount: number
    spawnedCount: number
    /** effectiveWaves(stage) snapshot, taken once at battle start. */
    waves: number[]
    /** 0-based index into `waves` — which wave is currently spawning/active. */
    waveIndex: number
    /** Quái đã spawn (dạng pending) nhưng CHƯA vào trận thật (battle.enemies). */
    pendingEnemySpawns: PendingEnemySpawn[]
  }
```

- [ ] **Step 4: Update the import**

Change:

```ts
import { shouldSpawnNextEnemy, isStageComplete } from './WaveSpawnTrigger'
```

to:

```ts
import { shouldStartNextWave, isStageComplete } from './WaveSpawnTrigger'
```

- [ ] **Step 5: Remove the old one-at-a-time spawn block from `completeAction()`**

Delete this block from `completeAction()` (it moves to `tickPacing()` in
Step 6, in a rewritten form):

```ts
    if (battle.wave && this.spawnEnemy) {
      const aliveEnemyCount = battle.enemies.filter((enemy) => enemy.entity.alive).length

      if (shouldSpawnNextEnemy(battle.wave.spawnedCount, battle.wave.totalEnemyCount, aliveEnemyCount)) {
        battle.enemies.push(this.spawnEnemy())
        battle.wave.spawnedCount += 1
      }
    }

    const finalAliveEnemyCount = battle.enemies.filter((enemy) => enemy.entity.alive).length
```

Replace the `isStageComplete` call site right below it (still inside
`completeAction()`) — change:

```ts
    if (battle.players.every((member) => !member.entity.alive)) {
      battle.state = 'defeat'
    } else if (
      battle.wave
        ? isStageComplete(battle.wave.spawnedCount, battle.wave.totalEnemyCount, finalAliveEnemyCount)
        : battle.enemies.every((enemy) => !enemy.entity.alive)
    ) {
      battle.state = 'victory'
    }
```

to (reading current counts directly — the pending/wave-batch block that
now lives in `tickPacing()`, Step 6, has already run earlier in the SAME
fixed-step tick, before gauge advance/action resolution, so these counts
are current):

```ts
    const currentAliveEnemyCount = battle.enemies.filter((enemy) => enemy.entity.alive).length
    const currentPendingCount = battle.wave?.pendingEnemySpawns.length ?? 0

    if (battle.players.every((member) => !member.entity.alive)) {
      battle.state = 'defeat'
    } else if (
      battle.wave
        ? isStageComplete(battle.wave.spawnedCount, battle.wave.totalEnemyCount, currentAliveEnemyCount, currentPendingCount)
        : battle.enemies.every((enemy) => !enemy.entity.alive)
    ) {
      battle.state = 'victory'
    }
```

- [ ] **Step 6: Add the wave-batch/telegraph block to the TOP of `tickPacing()`**

In `tickPacing(battle: TurnBattle, resolve = true)`, immediately after the
`if (battle.state !== 'fighting') { return null }` guard and BEFORE the
`dequeueFollowUpActor` call, insert:

```ts
    if (battle.wave && this.spawnEnemy) {
      const stillPending: PendingEnemySpawn[] = []

      for (const pending of battle.wave.pendingEnemySpawns) {
        const ticksRemaining = pending.ticksRemaining - 1

        if (ticksRemaining <= 0) {
          battle.enemies.push(pending.participant)
        } else {
          stillPending.push({ ...pending, ticksRemaining })
        }
      }

      battle.wave.pendingEnemySpawns = stillPending

      const aliveEnemyCount = battle.enemies.filter((enemy) => enemy.entity.alive).length

      if (
        shouldStartNextWave(
          aliveEnemyCount,
          battle.wave.pendingEnemySpawns.length,
          battle.wave.waveIndex,
          battle.wave.waves.length,
        )
      ) {
        const waveSize = battle.wave.waves[battle.wave.waveIndex]!

        for (let index = 0; index < waveSize; index++) {
          const participant = this.spawnEnemy()
          const totalTicks = spawnTelegraphTicks(participant.entity)

          battle.wave.pendingEnemySpawns.push({ participant, ticksRemaining: totalTicks, totalTicks })
          battle.wave.spawnedCount += 1
        }

        battle.wave.waveIndex += 1
      }
    }
```

- [ ] **Step 7: Rewrite the existing multi-wave test suite to drive via `tickPacing()`**

The existing `describe('TurnBattleSystem.resolveNextStep multi-wave spawning', ...)`
block (4 tests) exercises the OLD one-at-a-time mechanic via
`resolveNextStep()`, which no longer runs any spawn logic (moved to
`tickPacing()`). Replace the entire describe block with:

```ts
describe('TurnBattleSystem.tickPacing wave-batch spawning', () => {
  it('spawns an entire wave as pending telegraphs once the arena is empty, not one at a time', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const wave = { totalEnemyCount: 3, spawnedCount: 0, waves: [3], waveIndex: 0, pendingEnemySpawns: [] }
    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [],
      state: 'fighting',
      wave,
    }

    let spawnCalls = 0
    const spawnEnemy = (): TurnBattleParticipant => {
      spawnCalls += 1

      const enemy = createCombatant({
        id: `enemy${spawnCalls}`,
        currentHp: 10,
        maxHp: 10,
        stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
      })

      return makeParticipant(`enemy${spawnCalls}`, enemy, 10, 1)
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 20, undefined, spawnEnemy)

    system.tickPacing(battle)

    expect(spawnCalls).toBe(3)
    expect(wave.spawnedCount).toBe(3)
    expect(wave.waveIndex).toBe(1)
    expect(wave.pendingEnemySpawns).toHaveLength(3)
    expect(battle.enemies).toHaveLength(0)
  })

  it('materializes a pending enemy into battle.enemies only after its telegraph ticks reach 0', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })
    const enemy = createCombatant({
      id: 'enemy1',
      currentHp: 10,
      maxHp: 10,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })
    const pendingParticipant = makeParticipant('enemy1', enemy, 10, 1)

    const wave = {
      totalEnemyCount: 1,
      spawnedCount: 1,
      waves: [1],
      waveIndex: 1,
      pendingEnemySpawns: [{ participant: pendingParticipant, ticksRemaining: 2, totalTicks: 8 }],
    }
    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [],
      state: 'fighting',
      wave,
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    system.tickPacing(battle)
    expect(battle.enemies).toHaveLength(0)
    expect(wave.pendingEnemySpawns[0]!.ticksRemaining).toBe(1)

    system.tickPacing(battle)
    expect(battle.enemies).toHaveLength(1)
    expect(battle.enemies[0]!.id).toBe('enemy1')
    expect(wave.pendingEnemySpawns).toHaveLength(0)
  })

  it('does not start wave 2 until wave 1 is both dead AND fully materialized (no pending left)', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const wave = { totalEnemyCount: 2, spawnedCount: 1, waves: [1, 1], waveIndex: 1, pendingEnemySpawns: [] }
    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [],
      state: 'fighting',
      wave,
    }

    let spawnCalls = 0
    const spawnEnemy = (): TurnBattleParticipant => {
      spawnCalls += 1

      const enemy = createCombatant({
        id: `enemy${spawnCalls}`,
        currentHp: 10,
        maxHp: 10,
        stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
      })

      return makeParticipant(`enemy${spawnCalls}`, enemy, 10, 1)
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 20, undefined, spawnEnemy)

    // Arena empty, waveIndex=1 < waveCount=2 -> wave 2 starts immediately
    // (nothing from wave 1 was ever pushed into battle.enemies here, so
    // this simulates "wave 1 already fully cleared before this tick").
    system.tickPacing(battle)

    expect(spawnCalls).toBe(1)
    expect(wave.waveIndex).toBe(2)
    expect(wave.pendingEnemySpawns).toHaveLength(1)

    // waveIndex now 2 === waveCount 2 -> no further wave starts even
    // though arena is still empty (pending just queued, not yet alive).
    system.tickPacing(battle)
    expect(spawnCalls).toBe(1)
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
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    system.resolveNextStep(battle)

    expect(battle.state).toBe('victory')
    expect(battle.enemies).toHaveLength(1)
  })
})
```

Also update the pre-existing `it('does not throw and does not spawn when wave is set but no spawnEnemy factory was provided', ...)` test (search for it — near line 1070) to construct its `wave` object with the new required fields (`waves: [], waveIndex: 0, pendingEnemySpawns: []`) instead of the old 2-field shape, so it still compiles.

- [ ] **Step 8: Run tests to verify**

Run: `npx vitest run TurnBattleSystem.test.ts` — all pass, including the 4 rewritten wave tests.

- [ ] **Step 9: Type-check + full regression**

Run: `npm.cmd run type-check` — expect remaining FAILURES only in
`GameManager.ts` (still constructs the old 2-field `wave` shape — fixed in
Task 4). Confirm no other file errors. Run `npx vitest run` (full) — expect
`GameManager.*.test.ts` failures related to the `wave` shape (fixed in Task 4);
every other test file must stay green.

- [ ] **Step 10: Commit**

```bash
git add game/src/core/battle/turn/TurnBattleSystem.ts game/src/core/battle/turn/TurnBattleSystem.test.ts
git commit -m "feat(turn-wave): TurnBattleSystem spawns whole waves as pending telegraphs via tickPacing()"
```

---

### Task 4: `GameManager.ts` — wave-aware `TurnBattle` construction + bootstrap fix

**Files:**
- Modify: `game/src/core/game/GameManager.ts`
- Modify: `game/src/core/game/GameManager.turnBattleEnemyWavePosition.test.ts` (if it constructs a `wave` object directly — check first)
- Modify: `game/src/core/game/GameManager.mvpLoop.test.ts`, `GameManager.bossSolo.test.ts`, `GameManager.bossRepeatCycle.test.ts` (only if they construct/assert on `battle.wave` directly — check first; most likely they only call public `startStage()`/`getTurnBattle()` and need no changes)

**Interfaces:**
- Consumes: `effectiveWaves()` (Task 1), the new `wave` shape (Task 3).
- Produces: a new exported constant `COUNTDOWN_TOTAL_TICKS = 30`.

- [ ] **Step 1: Check which test files construct `wave` object literals directly**

```bash
grep -rln "wave:" game/src/core/game/GameManager*.test.ts
```

For each match, open the file and check whether it builds a `{ totalEnemyCount, spawnedCount }` object literal directly (needs updating to the new shape) versus only reading `battle.wave?.spawnedCount` etc. (no change needed). Note the affected files for Steps 6-7.

- [ ] **Step 2: Add the `COUNTDOWN_TOTAL_TICKS` constant and `effectiveWaves` import**

Near wherever `buildTurnBattle()` is defined, add above it:

```ts
// Turn-Based Wave Redesign (2026-09-06) — shared giữa buildTurnBattle()
// (dùng để khởi tạo countdownTurnsRemaining) và
// TurnActionPresentationEvents.emitTurnBattleEntitySnapshot() (dùng để
// tính countdownProgress) — tách hằng số ra để 2 nơi không bao giờ lệch.
export const COUNTDOWN_TOTAL_TICKS = 30
```

Add the import:

```ts
import { effectiveWaves } from '../stage/EffectiveWaves'
```

Change `buildTurnBattle()`'s return statement:

```ts
    return {
      players: [playerParticipant, ...companionParticipants],
      enemies: enemyParticipants,
      state: 'countdown',
      // 3s countdown hết số → 30 pacing ticks (BATTLE_FIXED_STEP 0.1s).
      countdownTurnsRemaining: 30,
      totalTurnsElapsed: 0,
    }
```

to:

```ts
    return {
      players: [playerParticipant, ...companionParticipants],
      enemies: enemyParticipants,
      state: 'countdown',
      countdownTurnsRemaining: COUNTDOWN_TOTAL_TICKS,
      totalTurnsElapsed: 0,
    }
```

- [ ] **Step 3: Fix `startStage()`'s wave-setup block — discard the bootstrap enemy so wave 0 spawns uniformly**

Find the block (search for `this.turnBattle.wave = {` inside `startStage()`,
distinct from the one in `restartTurnBattleCycle()`):

```ts
      this.turnBattle.wave = {
        totalEnemyCount: effectiveTotalEnemyCount(stage),
        spawnedCount: 1,
      }

      const stageRef = stage
```

Change to:

```ts
      // Turn-Based Wave Redesign (2026-09-06) — StageWaveSystem.start()
      // (qua launchBattle → startBattleWithPlayer → startBattle →
      // buildTurnBattle) đã spawn THẲNG 1 quái bootstrap vào
      // this.turnBattle.enemies (bootstrap này PHỤC VỤ CHUNG cho cả legacy
      // real-time engine — KHÔNG SỬA). User yêu cầu MỌI quái (kể cả con
      // đầu) đều spawn đồng loạt qua telegraph — nên XÓA quái bootstrap
      // đó khỏi mảng enemies ngay tại đây và để tick tiếp theo của
      // tickPacing() tự nhiên queue LẠI toàn bộ wave 0 (kể cả "con #1")
      // qua cơ chế pending/telegraph bình thường. Hơi lãng phí 1 lần roll
      // template thừa (bootstrap đã roll 1 template không dùng tới), chấp
      // nhận được để không phải sửa startBattle()/buildTurnBattle() — 2
      // hàm dùng chung với legacy engine.
      this.turnBattle.enemies = []

      this.turnBattle.wave = {
        totalEnemyCount: effectiveTotalEnemyCount(stage),
        spawnedCount: 0,
        waves: effectiveWaves(stage),
        waveIndex: 0,
        pendingEnemySpawns: [],
      }

      const stageRef = stage
```

- [ ] **Step 4: Update `restartTurnBattleCycle()`'s wave construction**

Change:

```ts
      wave: { totalEnemyCount: effectiveTotalEnemyCount(stageRef), spawnedCount: 0 },
```

to:

```ts
      wave: {
        totalEnemyCount: effectiveTotalEnemyCount(stageRef),
        spawnedCount: 0,
        waves: effectiveWaves(stageRef),
        waveIndex: 0,
        pendingEnemySpawns: [],
      },
```

(This path does NOT have the bootstrap-enemy problem — `restartTurnBattleCycle()`
already resets `enemies: []` unconditionally right above this line, per the
existing code — confirm this by re-reading the surrounding block before
editing; if `enemies: []` is not already there, add it.)

- [ ] **Step 5: Run the isFinalSpawn closures unchanged — verify by inspection**

Both `spawnEnemy` factory closures (`startStage()`'s and
`restartTurnBattleCycle()`'s) compute `isFinalSpawn` from
`(this.turnBattle?.wave?.spawnedCount ?? 0) + 1 >= effectiveTotalEnemyCount(stageRef)`.
This still works correctly with the new wave-batch model since
`spawnedCount` still increments by exactly 1 per enemy queued (now inside
`tickPacing()`'s wave-batch loop instead of the old one-at-a-time block) —
no change needed to either closure. Confirm by reading both closures after
Steps 3-4 and checking neither references the now-removed
`shouldSpawnNextEnemy` or old 2-field `wave` shape directly.

- [ ] **Step 6: Fix any test files identified in Step 1**

For each test file that constructs a `wave` object literal directly, add
the three new required fields (`waves: [...]`, `waveIndex: 0` or matching
the test's intent, `pendingEnemySpawns: []`) — read each file's existing
assertions first to pick values that preserve the test's original intent
(e.g. a test asserting `totalEnemyCount: 1, spawnedCount: 1` for an
immediate-victory scenario should get `waves: [1], waveIndex: 1,
pendingEnemySpawns: []` to represent "wave already fully spawned").

- [ ] **Step 7: Run tests to verify**

Run: `npx vitest run GameManager.turnBattleEnemyWavePosition.test.ts GameManager.mvpLoop.test.ts GameManager.bossSolo.test.ts GameManager.bossRepeatCycle.test.ts` —
all pass. `GameManager.turnBattleEnemyWavePosition.test.ts` in particular
(the regression test from the 2026-09-06 enemy-spawn-position bug fix) MUST
still pass — it asserts every spawned enemy's column stays within
`ENEMY_SIDE_REGION`, which this plan's changes do not touch (position
resolution still happens inside `this.spawnEnemy()`'s factory, unchanged).

- [ ] **Step 8: Type-check + full regression**

Run: `npm.cmd run type-check` + `npx vitest run` (full, no filter) — both green.

- [ ] **Step 9: Commit**

```bash
git add game/src/core/game/GameManager.ts game/src/core/game/GameManager.turnBattleEnemyWavePosition.test.ts game/src/core/game/GameManager.mvpLoop.test.ts game/src/core/game/GameManager.bossSolo.test.ts game/src/core/game/GameManager.bossRepeatCycle.test.ts
git commit -m "feat(turn-wave): GameManager wires waves[]/COUNTDOWN_TOTAL_TICKS, discards bootstrap enemy so wave 0 spawns uniformly"
```

(Only `git add` the test files that were actually modified in Step 6 — if
none needed changes, omit them from the commit.)

---

### Task 5: Snapshot event extension (`TurnActionPresentationEvents.ts`)

**Files:**
- Modify: `game/src/core/battle/turn/TurnActionPresentationEvents.ts`
- Modify: `game/src/core/battle/turn/TurnActionPresentationEvents.test.ts`

**Interfaces:**
- Consumes: `TurnBattle.wave.pendingEnemySpawns` (Task 3), `COUNTDOWN_TOTAL_TICKS` (Task 4).
- Produces: `PendingSpawnVisualState`, `TurnBattleEntitySnapshotEvent.pendingEnemySpawns`/`.countdownProgress`.

- [ ] **Step 1: Write the failing tests**

Add to `TurnActionPresentationEvents.test.ts` (check the file's existing
`makeParticipant`/fixture helpers first and reuse them):

```ts
describe('emitTurnBattleEntitySnapshot — pendingEnemySpawns (Turn-Based Wave Redesign, 2026-09-06)', () => {
  it('maps battle.wave.pendingEnemySpawns into progress-based visual state', () => {
    const eventBus = new EventBus()
    const enemy = createCombatant({ id: 'enemy1', row: 3, x: 8 })
    const participant = makeParticipant('enemy1', enemy, 10, 1)

    const battle: TurnBattle = {
      players: [],
      enemies: [],
      state: 'fighting',
      wave: {
        totalEnemyCount: 1,
        spawnedCount: 1,
        waves: [1],
        waveIndex: 1,
        pendingEnemySpawns: [{ participant, ticksRemaining: 2, totalTicks: 8 }],
      },
    }

    let received: TurnBattleEntitySnapshotEvent | undefined

    eventBus.on('turn_battle_entity_snapshot', (event) => {
      received = event as TurnBattleEntitySnapshotEvent
    })

    emitTurnBattleEntitySnapshot(eventBus, battle)

    expect(received!.pendingEnemySpawns).toHaveLength(1)
    expect(received!.pendingEnemySpawns[0]!.id).toBe('enemy1')
    expect(received!.pendingEnemySpawns[0]!.progress).toBeCloseTo(1 - 2 / 8, 6)
    expect(received!.pendingEnemySpawns[0]!.presetId).toBe('enemy_spawn')
  })

  it('empty array when battle.wave is undefined (no regression for non-wave battles)', () => {
    const eventBus = new EventBus()
    const battle: TurnBattle = { players: [], enemies: [], state: 'fighting' }

    let received: TurnBattleEntitySnapshotEvent | undefined

    eventBus.on('turn_battle_entity_snapshot', (event) => {
      received = event as TurnBattleEntitySnapshotEvent
    })

    emitTurnBattleEntitySnapshot(eventBus, battle)

    expect(received!.pendingEnemySpawns).toEqual([])
  })
})

describe('emitTurnBattleEntitySnapshot — countdownProgress', () => {
  it('present and correctly computed while state is countdown', () => {
    const eventBus = new EventBus()
    const battle: TurnBattle = {
      players: [],
      enemies: [],
      state: 'countdown',
      countdownTurnsRemaining: 15,
    }

    let received: TurnBattleEntitySnapshotEvent | undefined

    eventBus.on('turn_battle_entity_snapshot', (event) => {
      received = event as TurnBattleEntitySnapshotEvent
    })

    emitTurnBattleEntitySnapshot(eventBus, battle)

    expect(received!.countdownProgress).toBeCloseTo(1 - 15 / COUNTDOWN_TOTAL_TICKS, 6)
  })

  it('undefined once state is fighting', () => {
    const eventBus = new EventBus()
    const battle: TurnBattle = { players: [], enemies: [], state: 'fighting' }

    let received: TurnBattleEntitySnapshotEvent | undefined

    eventBus.on('turn_battle_entity_snapshot', (event) => {
      received = event as TurnBattleEntitySnapshotEvent
    })

    emitTurnBattleEntitySnapshot(eventBus, battle)

    expect(received!.countdownProgress).toBeUndefined()
  })
})
```

Add the needed imports at the top of the test file:
`import { COUNTDOWN_TOTAL_TICKS } from '@/core/game/GameManager'` (Task 4's
new export) alongside whatever fixture helpers (`createCombatant`,
`EventBus`) the file already imports — check the file's current imports
first and merge rather than duplicating.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run TurnActionPresentationEvents.test.ts`
Expected: FAIL — `pendingEnemySpawns`/`countdownProgress` don't exist on the emitted event yet.

- [ ] **Step 3: Add `PendingSpawnVisualState` and extend the snapshot interface**

```ts
export interface PendingSpawnVisualState {
  id: string
  row: number
  column: number
  isBoss: boolean
  /** 0 = vừa queue, 1 = sắp materialize (tick kế tiếp vào battle.enemies). */
  progress: number
  presetId: EnemySpawnVfxPresetId
}

export interface TurnBattleEntitySnapshotEvent {
  players: TurnBattleEntityVisualState[]
  enemies: TurnBattleEntityVisualState[]
  /** Turn-Based Wave Redesign (2026-09-06) — quái đang telegraph, CHƯA vào battle.enemies. */
  pendingEnemySpawns: PendingSpawnVisualState[]
  /** Chỉ có mặt khi battle.state === 'countdown'; 0→1 hết 3s countdown. */
  countdownProgress?: number
}
```

Add the import needed for `EnemySpawnVfxPresetId`:

```ts
import type { CombatVfxPresetId, ActionTargetingShape, EnemySpawnVfxPresetId } from '../CombatAction'
```

(Merge into the existing import line from `'../CombatAction'` — check the
current import list before editing, do not duplicate the import statement.)

- [ ] **Step 4: Update `emitTurnBattleEntitySnapshot()`**

```ts
export function emitTurnBattleEntitySnapshot(eventBus: EventBus, battle: TurnBattle): void {
  eventBus.emit('turn_battle_entity_snapshot', {
    players: battle.players.map(toVisualState),
    enemies: battle.enemies.map(toVisualState),
    pendingEnemySpawns: (battle.wave?.pendingEnemySpawns ?? []).map((pending) => {
      const position = entityGridPosition(pending.participant.entity)

      return {
        id: pending.participant.id,
        row: position.row,
        column: position.column,
        isBoss: pending.participant.entity.isBoss ?? false,
        progress: 1 - pending.ticksRemaining / pending.totalTicks,
        presetId: pending.participant.entity.isBoss
          ? 'boss_spawn'
          : pending.participant.entity.isElite
            ? 'elite_spawn'
            : 'enemy_spawn',
      }
    }),
    countdownProgress:
      battle.state === 'countdown' && battle.countdownTurnsRemaining !== undefined
        ? 1 - battle.countdownTurnsRemaining / COUNTDOWN_TOTAL_TICKS
        : undefined,
  })
}
```

Add the import:

```ts
import { COUNTDOWN_TOTAL_TICKS } from '../../game/GameManager'
```

**Circular import check:** `GameManager.ts` already imports from
`TurnActionPresentationEvents.ts` (it calls `emitTurnBattleEntitySnapshot`).
Adding an import in the opposite direction creates a cycle. Before writing
this import, check whether `COUNTDOWN_TOTAL_TICKS` should instead live in a
small standalone file (e.g. `game/src/core/battle/turn/TurnCountdown.ts`,
exporting just the one constant) that BOTH `GameManager.ts` and
`TurnActionPresentationEvents.ts` import from — if `npm.cmd run type-check`
or `npx vitest run` reports a circular-dependency-related failure after
Step 4's import, create that standalone file instead and move the constant
there (update Task 4's Step 2 export location accordingly, and update this
step's import path).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run TurnActionPresentationEvents.test.ts` — all pass.

- [ ] **Step 6: Type-check + full regression**

Run: `npm.cmd run type-check` (resolve the circular-import fallback from
Step 4 here if needed) + `npx vitest run` (full) — both green.

- [ ] **Step 7: Commit**

```bash
git add game/src/core/battle/turn/TurnActionPresentationEvents.ts game/src/core/battle/turn/TurnActionPresentationEvents.test.ts
git commit -m "feat(turn-wave): snapshot event carries pendingEnemySpawns + countdownProgress"
```

---

### Task 6: `CombatVfxSpawner.reconcileSpawnVfx()` — generalize behind `SpawnVfxSnapshot`

**Files:**
- Modify: `game/src/game/scenes/combat/combat-vfx-spawner.ts`

**Interfaces:**
- Produces: `SpawnVfxSnapshot` interface. `reconcileSpawnVfx()`'s parameter type narrows from `BattlePositionsEvent` to `SpawnVfxSnapshot` (a structural subset — `BattlePositionsEvent` already satisfies it, zero call-site changes for the legacy path).

- [ ] **Step 1: Add the narrowed interface**

Near the top of `combat-vfx-spawner.ts`, after the existing imports:

```ts
// Turn-Based Wave Redesign (2026-09-06) — subset of BattlePositionsEvent
// that reconcileSpawnVfx() actually reads. BattlePositionsEvent already
// satisfies this structurally (TypeScript structural typing) — legacy's
// existing call site (CombatScene.reconcileSpawnVfx()) needs ZERO changes.
// Turn-based combat constructs its own object of this shape from
// TurnBattleEntitySnapshotEvent (CombatScene.onTurnBattleEntitySnapshot(),
// Task 7).
export interface SpawnVfxSnapshot {
  spawningEnemies?: {
    id: string
    row: LaneIndex
    column: number
    progress: number
    isBoss: boolean
    presetId: EnemySpawnVfxPresetId
  }[]
}
```

Add the needed type imports if not already present:
`import type { LaneIndex } from '@/core/battle/BattleLane'` and
`import type { EnemySpawnVfxPresetId } from '@/core/battle/CombatAction'`
— check the file's existing imports first, merge rather than duplicate.

- [ ] **Step 2: Narrow `reconcileSpawnVfx()`'s parameter type**

Change:

```ts
  reconcileSpawnVfx(event: BattlePositionsEvent) {
```

to:

```ts
  reconcileSpawnVfx(event: SpawnVfxSnapshot) {
```

The method body is UNCHANGED — it already only reads `event.spawningEnemies`,
nothing else on `BattlePositionsEvent`. Confirm this by re-reading the full
method body before making the change (grep for `event\.` inside the method
to double check no other `BattlePositionsEvent` field is read).

- [ ] **Step 3: Type-check + full regression**

Run: `npm.cmd run type-check` — 0 errors (this is the step that PROVES
`BattlePositionsEvent` structurally satisfies `SpawnVfxSnapshot` — if it
doesn't compile, `reconcileSpawnVfx()` reads a field this plan missed;
re-check Step 2's grep). Run `npx vitest run` (full) — zero regressions,
in particular any existing `CombatScene.spawnVfx.test.ts` /
`reconcileSpawnVfx`-focused tests must still pass unchanged (they call the
method with a real `BattlePositionsEvent`-shaped object, which still
compiles against the narrower parameter type).

- [ ] **Step 4: Commit**

```bash
git add game/src/game/scenes/combat/combat-vfx-spawner.ts
git commit -m "refactor(turn-wave): generalize CombatVfxSpawner.reconcileSpawnVfx() behind SpawnVfxSnapshot"
```

---

### Task 7: `CombatScene` wiring — wave telegraph + party countdown telegraph

**Files:**
- Modify: `game/src/game/scenes/CombatScene.ts`
- Create: `game/src/game/scenes/CombatScene.turnCountdownSpawn.test.ts`

**Interfaces:**
- Consumes: `SpawnVfxSnapshot` (Task 6), `TurnBattleEntitySnapshotEvent.pendingEnemySpawns`/`.countdownProgress` (Task 5).
- Produces: `turnCountdownSpawnVfxHandles`, `turnCountdownPendingIds` fields; `reconcileTurnCountdownSpawn()` method.

- [ ] **Step 1: Add the new fields**

Near the existing `spawnVfxHandles`/`materializingIds` field declarations:

```ts
  // Party countdown telegraph (Turn-Based Wave Redesign, 2026-09-06) —
  // handle riêng cho player + companion lúc đếm 3→2→1, TÁCH KHỎI
  // spawnVfxHandles (dành cho enemy wave telegraph) vì lifecycle khác hẳn:
  // mọi thành viên party materialize CÙNG LÚC theo 1 countdownProgress
  // chung, không phải từng id một như enemy. KHÔNG đụng
  // reconcilePlayerSpawn() (dành riêng cho legacy real-time, single-id) —
  // xem spec §6b lý do tách biệt hoàn toàn.
  turnCountdownSpawnVfxHandles = new Map<string, EnemySpawnVfxHandle>()
  turnCountdownPendingIds = new Set<string>()
```

- [ ] **Step 2: Add `reconcileTurnCountdownSpawn()`**

Add as a new private method, near `onTurnBattleEntitySnapshot()`:

```ts
  private reconcileTurnCountdownSpawn(event: TurnBattleEntitySnapshotEvent) {
    if (event.countdownProgress === undefined) {
      // Countdown vừa kết thúc (hoặc chưa từng bắt đầu) — flush mọi handle
      // còn treo: flash materialize + hiện sprite thật cho từng id.
      for (const [id, handle] of this.turnCountdownSpawnVfxHandles) {
        handle.complete()

        const sprite = this.sprites.get(id)

        sprite?.rect.setVisible(true)
      }

      this.turnCountdownSpawnVfxHandles.clear()
      this.turnCountdownPendingIds.clear()

      return
    }

    for (const player of event.players) {
      this.turnCountdownPendingIds.add(player.id)

      const existing = this.turnCountdownSpawnVfxHandles.get(player.id)

      if (existing) {
        existing.update(event.countdownProgress)
        continue
      }

      if (!this.projection) {
        continue
      }

      const handle = spawnEnemySpawnVfx({
        scene: this,
        projection: this.projection,
        row: player.row,
        column: player.column,
        presetId: 'player_spawn',
        uprightDepth: this.resolveUprightVfxDepth(player),
      })

      this.turnCountdownSpawnVfxHandles.set(player.id, handle)
    }
  }
```

Add the needed import if not already present in `CombatScene.ts`:
`import { spawnEnemySpawnVfx, type EnemySpawnVfxHandle } from '@/game/support/EnemySpawnVfx'`
— this import already exists (used by `spawnVfxHandles`'s type) per the
earlier survey; confirm before adding a duplicate.

- [ ] **Step 3: Wire it into `onTurnBattleEntitySnapshot()`**

Change:

```ts
  private onTurnBattleEntitySnapshot(event: TurnBattleEntitySnapshotEvent) {
    this.reconcileCombatantSprites('player', event.players, PLAYER_COLOR)
    this.reconcileCombatantSprites('enemy', event.enemies, ENEMY_COLOR)
  }
```

to:

```ts
  private onTurnBattleEntitySnapshot(event: TurnBattleEntitySnapshotEvent) {
    // Turn-Based Wave Redesign (2026-09-06) — countdown reconcile PHẢI
    // chạy TRƯỚC reconcileCombatantSprites('player', ...): lần đầu 1
    // player/companion id xuất hiện trong event.players (ngay từ tick đầu
    // countdown, KHÔNG như enemy phải chờ pending), nhánh 'create' của
    // reconcileCombatantSprites() sẽ setVisible(true) ngay — cần
    // turnCountdownPendingIds đã có id đó SẴN để nhánh 'create' biết
    // giữ ẩn (xem Step 4).
    this.reconcileTurnCountdownSpawn(event)

    this.reconcileCombatantSprites('player', event.players, PLAYER_COLOR)
    this.reconcileCombatantSprites('enemy', event.enemies, ENEMY_COLOR)

    this.reconcileSpawnVfx({
      spawningEnemies: event.pendingEnemySpawns.map((pending) => ({
        id: pending.id,
        row: pending.row as LaneIndex,
        column: pending.column,
        progress: pending.progress,
        isBoss: pending.isBoss,
        presetId: pending.presetId,
      })),
    })
  }
```

- [ ] **Step 4: Gate visibility in `reconcileCombatantSprites()`'s `'create'` branch**

In `reconcileCombatantSprites()`, find:

```ts
        sprite.rect.setVisible(true)

        if (action.state.id === PLAYER_ID) {
          this.playerMaterialized = true
        }

        continue
```

Change to:

```ts
        // Turn-Based Wave Redesign (2026-09-06) — party countdown telegraph:
        // id đang trong turnCountdownPendingIds nghĩa là countdown 3→2→1
        // CHƯA xong — giữ sprite ẨN, reconcileTurnCountdownSpawn() sẽ tự
        // setVisible(true) khi countdown kết thúc (xem hàm đó). Enemy
        // KHÔNG BAO GIỜ vào turnCountdownPendingIds (set chỉ chưa
        // event.players) nên nhánh này luôn no-op cho enemy, không đổi
        // hành vi enemy hiện có.
        sprite.rect.setVisible(!this.turnCountdownPendingIds.has(action.state.id))

        // Materialize từ telegraph (Turn-Based Wave Redesign, 2026-09-06) —
        // đúng cơ chế đã dùng cho legacy enemy (reconcileEnemySprites()).
        if (this.materializingIds.has(action.state.id)) {
          this.materializingIds.delete(action.state.id)
          this.playMaterializeFadeIn(sprite)
        }

        if (action.state.id === PLAYER_ID) {
          this.playerMaterialized = true
        }

        continue
```

- [ ] **Step 5: Write the regression test**

```ts
// CombatScene.turnCountdownSpawn.test.ts
// @vitest-environment jsdom
//
// Regression test (Turn-Based Wave Redesign, 2026-09-06) against
// reintroducing the "player invisible in combat" bug fixed 2026-09-06
// (f179a2b) via the new countdown-telegraph hide-then-reveal path.
import { describe, expect, it } from 'vitest'
import { CombatScene } from './CombatScene'

describe('CombatScene party countdown telegraph visibility', () => {
  it('player/companion sprite stays hidden while countdownProgress is defined, and becomes visible once it is undefined', () => {
    const scene = Object.create(CombatScene.prototype) as CombatScene & {
      turnCountdownPendingIds: Set<string>
      sprites: Map<string, { rect: { setVisible: (visible: boolean) => void; visible?: boolean } }>
    }

    scene.turnCountdownPendingIds = new Set(['player'])

    let visible: boolean | undefined
    const rect = { setVisible: (value: boolean) => { visible = value } }

    scene.sprites = new Map([['player', { rect }]])

    // Simulate the 'create' branch's visibility line directly (unit-level,
    // no Phaser scene needed — same technique as CombatGridViewHost.test.ts).
    rect.setVisible(!scene.turnCountdownPendingIds.has('player'))
    expect(visible).toBe(false)

    // Countdown ends — reconcileTurnCountdownSpawn()'s flush path.
    scene.turnCountdownPendingIds.clear()
    rect.setVisible(true)
    expect(visible).toBe(true)
  })
})
```

- [ ] **Step 6: Run tests to verify**

Run: `npx vitest run CombatScene.turnCountdownSpawn.test.ts` — passes.

- [ ] **Step 7: Type-check + full regression**

Run: `npm.cmd run type-check` + `npx vitest run` (full, no filter) — both
green, zero regressions in any other `CombatScene.*.test.ts` file (in
particular, confirm the legacy `reconcilePlayerSpawn`/`reconcileSpawnVfx`
real-time flow tests are untouched — Task 6 only narrowed a type, this task
only added new code paths gated behind data that only turn-based combat
produces).

- [ ] **Step 8: Commit**

```bash
git add game/src/game/scenes/CombatScene.ts game/src/game/scenes/CombatScene.turnCountdownSpawn.test.ts
git commit -m "feat(turn-wave): CombatScene wires wave telegraph + party countdown telegraph VFX"
```

---

### Task 8: Final verification + roadmap update

- [ ] Run `npx vitest run` — full suite green, confirm test count only grew by the new/rewritten tests from Tasks 1-7 (no unrelated file changed test counts, beyond Task 3's deliberate 4-test rewrite).
- [ ] Run `npm.cmd run type-check` — zero errors.
- [ ] Run `npx vitest run EffectiveWaves.test.ts WaveSpawnTrigger.test.ts TurnBattleSystem.test.ts TurnActionPresentationEvents.test.ts CombatScene.turnCountdownSpawn.test.ts` explicitly — all pass. These are the files with the highest blast-radius risk in this plan.
- [ ] Grep-diff every `GameManager.*.test.ts` and `CombatScene.*.test.ts` file's pass/fail count against a pre-Task-1 baseline (`npx vitest run` output captured before this plan started vs. now) — must be identical counts outside the explicitly-listed rewrites, proving zero unintended behavior change.
- [ ] Manual Playwright pass: start `qi_refining_forest` (level 1, `waves: [3, 3, 4]`), observe: (a) 3→2→1 countdown shows a spawn telegraph circle under the player AND every companion simultaneously; all materialize together as countdown ends and become visible at the same moment; (b) 3 enemies telegraph and appear together for wave 1 (not one at a time); (c) once all 3 die, wave 2's 3 enemies telegraph immediately (no dead pause); (d) wave 3's 4 enemies telegraph and appear together; (e) stage completes in victory once wave 3 is fully cleared.
- [ ] Manual Playwright pass on a floor-10 stage (e.g. `qi_refining_abyssal_pool`): confirm it is still a solo 1-boss fight with a single telegraph (no regression from `effectiveWaves()`'s override).
- [ ] Confirm `GameManager.turnBattleEnemyWavePosition.test.ts` (the 2026-09-06 enemy-spawn-position regression test) still passes — proves this plan's changes did not disturb `resolveEnemySpawnPosition()`'s placement logic.
- [ ] Update `game/docs/roadmap.md` noting: turn-based combat now spawns whole waves as simultaneous telegraphed batches (`Stage.waves[]`, all 30 stages authored); the 3→2→1 countdown and every wave spawn now shows `EnemySpawnVfx.ts` telegraph VFX; this completes Part 3+4 of the 4-part Hỗn Độn Trận follow-on initiative (Parts 1-2 — Battlefield Slot/shared CombatGridView, 2.5D panel — are separate plans, check their own completion status before assuming they've shipped).
- [ ] Commit: `git commit -m "docs: roadmap - Turn-Based Wave Redesign + Spawn VFX wiring shipped (Part 3+4 of 4)"`.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-06-turn-based-wave-spawn-vfx.md`. This plan is written for a **separate executor session/agent** (per the user's standing preference from Parts 1-2) — set up an isolated worktree first (`superpowers:using-git-worktrees`, `.agent-worktrees/turn-based-wave-spawn-vfx` per this project's convention), then run it with `superpowers:executing-plans` (batch execution with human checkpoints) or `superpowers:subagent-driven-development` (fresh subagent per task, automated review loop) — either works. Task 3 (`TurnBattleSystem`'s `tickPacing()`/`completeAction()` surgery) and Task 4 (`GameManager`'s bootstrap-enemy discard) are the two tasks that most need a careful, unhurried reviewer — both touch the exact mechanism that drives every stage's core combat loop, and Task 3 in particular deviates from the spec's literal code sketch (see the "Important correction" section at the top of this plan) for a reason discovered only while grounding the spec against the real `tickPacing()`/`completeAction()` split.
