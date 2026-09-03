# WaveSpawnTrigger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two tiny pure functions, `shouldSpawnNextEnemy` and `isStageComplete`, that port `StageWaveSystem.ts`'s spawn/victory decision logic to turn-based combat, with the real-seconds throttle (`spawnCountdown`/`spawnIntervalSeconds`) dropped entirely per the approved design.

**Architecture:** One new file, `game/src/core/battle/turn/WaveSpawnTrigger.ts`, matching the existing `BossTurnTriggers.ts` Foundation-primitive pattern (a pure decision function, no class, no state). `StageWaveSystem.ts` itself is not touched — it still drives live real-time combat.

**Tech Stack:** TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-04-wave-spawn-trigger-design.md`

## Global Constraints

- Do not modify `game/src/core/game/StageWaveSystem.ts` or `game/src/core/game/GameManager.ts` — they drive live real-time combat and must be untouched.
- No `spawnCountdown`/`spawnIntervalSeconds`-equivalent throttle field or parameter — the turn-based rule is unconditional: spawn the moment the arena is empty.
- No `any` types.

---

### Task 1: `WaveSpawnTrigger.ts`

**Files:**
- Create: `game/src/core/battle/turn/WaveSpawnTrigger.ts`
- Test: `game/src/core/battle/turn/WaveSpawnTrigger.test.ts`

**Interfaces:**
- Consumes: nothing (pure functions over primitive numbers only).
- Produces: `shouldSpawnNextEnemy(spawnedCount: number, totalEnemyCount: number, aliveCount: number): boolean`, `isStageComplete(spawnedCount: number, totalEnemyCount: number, aliveCount: number): boolean`.

- [ ] **Step 1: Write the failing tests**

Create `game/src/core/battle/turn/WaveSpawnTrigger.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { shouldSpawnNextEnemy, isStageComplete } from './WaveSpawnTrigger'

describe('shouldSpawnNextEnemy', () => {
  it('true when the arena is empty and more enemies remain in the stage', () => {
    expect(shouldSpawnNextEnemy(2, 5, 0)).toBe(true)
  })

  it('false when an enemy is still alive/pending in the arena', () => {
    expect(shouldSpawnNextEnemy(2, 5, 1)).toBe(false)
  })

  it('false when the stage has already spawned every enemy, even with an empty arena', () => {
    expect(shouldSpawnNextEnemy(5, 5, 0)).toBe(false)
  })

  it('false when spawnedCount somehow exceeds totalEnemyCount (defensive)', () => {
    expect(shouldSpawnNextEnemy(6, 5, 0)).toBe(false)
  })
})

describe('isStageComplete', () => {
  it('true when every enemy has spawned and the arena is empty', () => {
    expect(isStageComplete(5, 5, 0)).toBe(true)
  })

  it('false while an enemy is still alive/pending, even if every enemy has spawned', () => {
    expect(isStageComplete(5, 5, 1)).toBe(false)
  })

  it('false while enemies remain to be spawned, even with an empty arena', () => {
    expect(isStageComplete(2, 5, 0)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run game/src/core/battle/turn/WaveSpawnTrigger.test.ts`
Expected: FAIL — `./WaveSpawnTrigger` does not exist yet.

- [ ] **Step 3: Write `WaveSpawnTrigger.ts`**

```typescript
// Turn-Based Combat — wave-spawn decision (spec: 2026-09-04-wave-spawn-
// trigger-design.md). Ported from StageWaveSystem.update()'s spawn/
// victory conditions, with the real-seconds spawnCountdown throttle
// dropped: turn-based combat has no real-time "too fast" to guard
// against, so the only rule left is "spawn the moment the arena is
// empty."

/**
 * True iff the stage still has an enemy left to spawn AND the arena is
 * currently empty (no living or pending enemy occupying it).
 */
export function shouldSpawnNextEnemy(
  spawnedCount: number,
  totalEnemyCount: number,
  aliveCount: number,
): boolean {
  return spawnedCount < totalEnemyCount && aliveCount === 0
}

/**
 * True iff every enemy in the stage has already spawned AND the arena
 * is currently empty — mirrors StageWaveSystem.update()'s existing
 * victory-check condition (`active.spawnedCount >= stage.totalEnemyCount
 * && aliveCount === 0`).
 */
export function isStageComplete(
  spawnedCount: number,
  totalEnemyCount: number,
  aliveCount: number,
): boolean {
  return spawnedCount >= totalEnemyCount && aliveCount === 0
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run game/src/core/battle/turn/WaveSpawnTrigger.test.ts`
Expected: PASS, all 7 cases.

- [ ] **Step 5: Commit**

```bash
git add game/src/core/battle/turn/WaveSpawnTrigger.ts game/src/core/battle/turn/WaveSpawnTrigger.test.ts
git commit -m "feat(turn-combat): add WaveSpawnTrigger (turn-based stage spawn/complete decision, no real-time throttle)"
```

---

### Task 2: Full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS, zero regressions. No live file was touched, so nothing outside `WaveSpawnTrigger.test.ts` should be affected.

- [ ] **Step 2: Run typecheck**

Run: `npx vue-tsc --noEmit` (or the project's existing typecheck script — check `package.json`'s `scripts` for the exact command already used elsewhere in this repo before running).
Expected: PASS, zero errors.

- [ ] **Step 3: Commit any fixups**

If Step 1-2 required fixes beyond what Task 1 anticipated, stage exactly the changed files and commit:

```bash
git add -A
git commit -m "fix: address regressions found during WaveSpawnTrigger full-suite verification"
```

If no fixes were needed, skip this step.

## Not Covered By This Plan

- Wiring `WaveSpawnTrigger` into any real turn-based battle loop (`TurnBattleSystem` Slice 1 has no wave concept today).
- `pickEnemyForSpawn`'s boss-priority selection logic — already pure/time-agnostic in the live file, reusable as-is at cutover time, not ported here.
- `resolveBossSummons()` (boss mid-battle summon spawning) — unrelated to this plan.
- Any change to `StageWaveSystem.ts` or `GameManager.ts`.
