# Phase A0 — Fix Stale Legacy `battleSystem` Reads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two live bugs where a closure built during the Slice 6 turn-based cutover was left reading from the dead legacy `battleSystem`/`BattleSystem` instead of the live `this.turnBattle` — Bất Tử Thể's debuff-cleanse/buff-grant silently writing to an unread `BuffPool`, and `CombatTopBar`'s enemy "alive" count always reading 0.

**Architecture:** Full cutover of `CombatSystem`'s survive-lethal buff effects from legacy `BuffSystem`/`BuffPool`/`BuffRegistry` types to `TurnBuffSystem`/`TurnBuffPool`/`TurnBuffRegistry` (no dual-type shim); `GameManager` composes the stage-progress "alive" count itself from `this.turnBattle` instead of delegating it to `StageWaveSystem`'s legacy-only dependency.

**Tech Stack:** TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-07-phase-a0-stale-legacy-battle-reads-design.md`

## Global Constraints

- **No dual legacy/turn-based shim.** Component 1 is a full type cutover
  — `surviveEffects` only ever holds turn-based types after this plan.
- **`battle/legacy/` itself is not deleted or otherwise restructured**
  beyond the two specific reads this plan repoints — that's roadmap C1.
- **Run tests from `game/`**: `cd game && npx vitest run <path>`.

---

## Task 1: Add `getAll()`/`remove()` to `TurnBuffSystem`

**Files:**
- Modify: `game/src/core/battle/turn/TurnBuffSystem.ts`
- Test: `game/src/core/battle/turn/TurnBuffSystem.test.ts`

**Interfaces:**
- Consumes: `TurnBuffPool.getAll()`/`removeInstance()` (`TurnBuffPool.ts:17-19,29-31`, already exist).
- Produces: `TurnBuffSystem.getAll(): TurnBuff[]`, `TurnBuffSystem.remove(id: string, sourceId: string): void`.

- [ ] **Step 1: Write the failing tests**

```typescript
// game/src/core/battle/turn/TurnBuffSystem.test.ts — add to existing file
describe('getAll / remove', () => {
  it('getAll returns every active buff instance', () => {
    const pool = new TurnBuffPool()
    const buffs = new TurnBuffSystem(pool)
    buffs.apply(testDefinition('bong'), sourceA, target, testRegistry)
    buffs.apply(testDefinition('te_cong'), sourceA, target, testRegistry)

    expect(buffs.getAll().map((b) => b.id).sort()).toEqual(['bong', 'te_cong'])
  })

  it('remove deletes exactly the (id, sourceId) instance', () => {
    const pool = new TurnBuffPool()
    const buffs = new TurnBuffSystem(pool)
    buffs.apply(testDefinition('bong'), sourceA, target, testRegistry)

    buffs.remove('bong', sourceA.id)

    expect(buffs.getAll()).toHaveLength(0)
  })
})
```

Use this test file's existing `testDefinition`/`testRegistry`/`sourceA`/`target`
fixture helpers — read the file first for exact names before writing.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd game && npx vitest run src/core/battle/turn/TurnBuffSystem.test.ts -t "getAll / remove"`
Expected: FAIL — neither method exists on `TurnBuffSystem` yet.

- [ ] **Step 3: Implement both methods, ported verbatim from `BuffSystem`**

Add to `TurnBuffSystem.ts`, alongside `getStacks()`:

```typescript
  // Phase A0 — ported verbatim from BuffSystem.getAll()/.remove()
  // (BuffSystem.ts:422-424,426-428). Needed by CombatSystem.killIfDead()'s
  // survive-lethal cleanse, which must operate on the LIVE turn-based
  // pool, not the legacy one — see A0 spec Component 1.
  getAll(): TurnBuff[] {
    return this.pool.getAll()
  }

  remove(id: string, sourceId: string): void {
    this.pool.removeInstance(id, sourceId)
  }
```

Import `TurnBuff` from `./TurnBuffTypes` if not already imported in this file.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd game && npx vitest run src/core/battle/turn/TurnBuffSystem.test.ts -t "getAll / remove"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add game/src/core/battle/turn/TurnBuffSystem.ts game/src/core/battle/turn/TurnBuffSystem.test.ts
git commit -m "feat(turn-combat): add TurnBuffSystem.getAll()/remove(), ports of BuffSystem"
```

---

## Task 2: Rewire Bất Tử Thể's `surviveEffects` to the live turn-based pool

**Files:**
- Modify: `game/src/core/combat/CombatSystem.ts` (`:21-23` imports, `:70-74` field type, `:95-103` method signature)
- Modify: `game/src/core/game/GameManager.ts` (`:2686-2697`)
- Modify: `game/src/core/game/GameManager.talentv4.test.ts` (`:106-142`, existing test asserts the old legacy shape)
- Test: extend `game/src/core/game/GameManager.talentv4.qa.test.ts`

**Interfaces:**
- Consumes: Task 1's `TurnBuffSystem.getAll()`/`.remove()`. `TurnBuffSystem.apply()`
  (already exists, unchanged). `TURN_BUFF_REGISTRY` (already exists,
  used elsewhere in `GameManager.ts`). `this.turnBattle.players[0].buffs`
  (`TurnBattleParticipant.buffs: TurnBuffPool`, already exists).
- Produces: `CombatSystem`'s `surviveLethalSession.surviveEffects` is now
  typed `{ buffSystem: TurnBuffSystem; registry: TurnBuffRegistry }`.

- [ ] **Step 1: Write the failing integration test**

Read `game/src/core/game/GameManager.talentv4.qa.test.ts` in full first
for its existing fixture pattern (how it builds a minimal `PlayerData`
with `bat_tu_the` selected, how it forces a lethal hit, and how it reads
back turn-based battle state) — reuse that pattern exactly, don't
build a new one.

```typescript
// game/src/core/game/GameManager.talentv4.qa.test.ts — add to existing file
it('A0: Bat Tu The cleanse + Tu Sinh Ngo grant land on the LIVE turn-based pool', () => {
  const manager = new GameManager(/* ...same construction this file's other tests use... */)
  const player = /* ...same bat_tu_the player fixture this file's other tests use... */
  const stats = /* ...same stats fixture... */
  const enemy = /* ...same enemy fixture... */

  manager.startBattleWithPlayer(player, stats, enemy)

  const turnBattle = manager.getTurnBattle()!
  const playerParticipant = turnBattle.players[0]!

  // Seed a debuff directly on the live turn-based pool (matching how a
  // real hit would have applied it) — read TurnBuffSystem.apply()'s
  // signature and TURN_BUFF_REGISTRY's exported member names to pick a
  // real debuff id, don't invent one.
  new TurnBuffSystem(playerParticipant.buffs).apply(
    TURN_BUFF_REGISTRY.get('bong'), // or whatever real debuff id this test suite already uses elsewhere
    /* source entity */ playerParticipant.entity,
    /* target entity */ playerParticipant.entity,
    TURN_BUFF_REGISTRY,
  )

  // Force a lethal hit on the player through the real production path
  // this file's other survive-lethal tests already use (search for how
  // an existing test in this file or GameManager.talentv4.test.ts drives
  // currentHp to lethal — reuse that exact call shape).

  expect(playerParticipant.entity.currentHp).toBe(1)
  expect(playerParticipant.buffs.getAll().some((b) => b.id === 'bong')).toBe(false)
  expect(playerParticipant.buffs.getAll().some((b) => b.id === 'tu_sinh_ngo')).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd game && npx vitest run src/core/game/GameManager.talentv4.qa.test.ts -t "A0"`
Expected: FAIL — the debuff is still present (cleanse writes to the
wrong pool) and `tu_sinh_ngo` is absent from `playerParticipant.buffs`.

- [ ] **Step 3: Change `CombatSystem`'s `surviveEffects` type to turn-based**

In `game/src/core/combat/CombatSystem.ts`:

Replace the imports at `:21-23`:
```typescript
import { BuffRegistry } from '../buff/BuffRegistry'
import { BuffSystem } from '../buff/BuffSystem'
import { BuffPool } from '../buff/BuffPool'
```
with:
```typescript
import type { TurnBuffRegistry } from '../battle/turn/TurnBuffTypes'
import type { TurnBuffSystem } from '../battle/turn/TurnBuffSystem'
```
(check first whether `BuffPool`/`BuffSystem`/`BuffRegistry` are used
anywhere else in this file — if so, keep whichever of the three imports
is still needed and only drop the ones that become unused).

Change the field declaration at `:70-74`:
```typescript
  private surviveLethalSession: {
    playerEntityId: string
    guard: SurviveLethalGuard
    surviveEffects?: { buffSystem: TurnBuffSystem; registry: TurnBuffRegistry }
  } | null = null
```

Change the method signature at `:95-103` (`setSurviveLethalSession`) the
same way:
```typescript
  setSurviveLethalSession(
    session: {
      playerEntityId: string
      guard: SurviveLethalGuard
      surviveEffects?: { buffSystem: TurnBuffSystem; registry: TurnBuffRegistry }
    } | null,
  ): void {
    this.surviveLethalSession = session
  }
```

No change needed inside `killIfDead()` (`CombatSystem.ts:461-514`) itself
— `effects.buffSystem.getAll()`, `.remove(buff.id, buff.sourceId)`, and
`.apply(tuSinhNgo, entity, entity, effects.registry)` all now resolve to
`TurnBuffSystem`'s methods (Task 1's `getAll`/`remove`, and the
already-existing `apply`) with the same call shape as before — this is
exactly why Task 1 ported those two methods with matching signatures.

- [ ] **Step 4: Rewire the `GameManager.ts` call site**

In `GameManager.ts:2686-2697`, change:

```typescript
      surviveEffects: {
        buffSystem: new BuffSystem(this.battleSystem.getPlayerBuffs() ?? new BuffPool()),
        registry: this.buffRegistry,
      },
```

to:

```typescript
      surviveEffects: {
        buffSystem: new TurnBuffSystem(this.turnBattle!.players[0]!.buffs),
        registry: TURN_BUFF_REGISTRY,
      },
```

`this.turnBattle` is non-null here because `this.startBattle(playerEntity, enemy)`
(called a few lines above, at `GameManager.ts:2677`) sets it via
`buildTurnBattle()` before this code runs — confirm this ordering still
holds by reading `startBattle()` in full before making this change (it
should still be `battleLoot.beginBattle()` → `passiveSystem.resetStacks()`
→ `setSurviveLethalSession(null)` → `battleSystem.start(...)` →
`this.turnBattle = this.buildTurnBattle(...)`, matching the version read
during this plan's spec-writing — if the order has changed, adjust the
non-null assertion or add an explicit guard instead of assuming).

Add `import { TurnBuffSystem } from '../battle/turn/TurnBuffSystem'` to
`GameManager.ts`'s import block if not already present (`TURN_BUFF_REGISTRY`
is already imported and used elsewhere in this file per A2's plan —
reuse the existing import).

- [ ] **Step 5: Update the existing test that asserts the old legacy shape**

Read `GameManager.talentv4.test.ts:106-142`
("session gắn surviveEffects (buffSystem của player + registry)") in
full — it currently asserts `surviveEffects.buffSystem` is a legacy
`BuffSystem` instance / reads from `battleSystem.getPlayerBuffs()`.
Update its assertions to check the turn-based shape instead (mirror
Step 1's new test for the exact shape to assert), so this test doesn't
regress to testing the bug that Step 3-4 just fixed.

- [ ] **Step 6: Run test to verify it passes**

Run: `cd game && npx vitest run src/core/game/GameManager.talentv4.qa.test.ts src/core/game/GameManager.talentv4.test.ts`
Expected: PASS

- [ ] **Step 7: Run the full existing `CombatSystem.surviveLethal.test.ts` suite**

Run: `cd game && npx vitest run src/core/combat/CombatSystem.surviveLethal.test.ts`
Expected: PASS — this file's own fixtures construct `surviveEffects`
directly (per the earlier audit read); if any fixture there still builds
a legacy `BuffSystem`/`BuffPool`, update it to build a `TurnBuffSystem`/
`TurnBuffPool` instead, following the same pattern as Step 5.

- [ ] **Step 8: Type-check**

Run: `cd game && npx vue-tsc --noEmit`
Expected: No new errors (this surfaces every remaining call site that
still passes a legacy-typed `surviveEffects` object).

- [ ] **Step 9: Commit**

```bash
git add game/src/core/combat/CombatSystem.ts game/src/core/game/GameManager.ts game/src/core/game/GameManager.talentv4.test.ts game/src/core/game/GameManager.talentv4.qa.test.ts game/src/core/combat/CombatSystem.surviveLethal.test.ts
git commit -m "fix(combat): rewire Bat Tu The surviveEffects to the live turn-based buff pool"
```

---

## Task 3: Fix `CombatTopBar`'s "alive" enemy count

**Files:**
- Modify: `game/src/core/game/StageWaveSystem.ts` (`:16-30` deps interface, `:198-208` `getProgress()`)
- Modify: `game/src/core/game/GameManager.ts` (`:3096-3098` `getStageProgress()`)
- Test: `game/src/core/game/GameManager.stageProgress.test.ts` (new file, or extend an existing `StageWaveSystem`/`GameManager` test file if one already covers `getStageProgress()`/`getProgress()` — check first)

**Interfaces:**
- Consumes: `TurnBattle.enemies: TurnBattleParticipant[]` (already
  exists), `TurnBattleParticipant.entity.alive: boolean` (already
  exists).
- Produces: `StageWaveSystem.getProgress()` returns
  `{ spawned: number; total: number } | null` (drops `alive`).
  `GameManager.getStageProgress()` keeps its existing public return type
  `{ spawned: number; total: number; alive: number } | null` — no
  consumer-facing (`CombatTopBar.vue`) change needed.

- [ ] **Step 1: Write the failing test**

Read `game/src/core/game/StageWaveSystem.ts` in full and search the repo
for an existing test file covering `getProgress()`
(`StageWaveSystem.*.test.ts` or a `GameManager.*.test.ts` that calls
`getStageProgress()`) before writing a new file — extend an existing one
if found, to avoid duplicating fixture setup.

```typescript
// game/src/core/game/GameManager.stageProgress.test.ts (new file, only if no existing coverage is found)
import { describe, it, expect } from 'vitest'
// import this project's existing GameManager test-construction helper —
// search GameManager.talentv4.qa.test.ts or similar for the pattern

describe('getStageProgress alive count (A0 fix)', () => {
  it('reflects the live turn-based enemy count, not the empty legacy one', () => {
    // Arrange: start a real turn-based battle with multiple enemies
    // spawned (use this test suite's existing multi-enemy stage fixture
    // if one exists — check StageWaveSystem's own test file first).
    // Act: kill one enemy through the real production damage path.
    // Assert: manager.getStageProgress()!.alive equals the count of
    // enemies still alive in manager.getTurnBattle()!.enemies, and is
    // NOT 0 while enemies remain.
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd game && npx vitest run src/core/game/GameManager.stageProgress.test.ts`
Expected: FAIL — `alive` reads `0` regardless of how many enemies are
actually alive (current bug).

- [ ] **Step 3: Remove `alive` from `StageWaveSystem.getProgress()`**

In `game/src/core/game/StageWaveSystem.ts:198-208`, change:

```typescript
    return {
      spawned: active.spawnedCount,

      total: effectiveTotalEnemyCount(stage),

      alive: this.deps.battleSystem.getBattle()?.enemies.length ?? 0,
    }
```

to:

```typescript
    return {
      spawned: active.spawnedCount,

      total: effectiveTotalEnemyCount(stage),
    }
```

Update `getProgress()`'s return type annotation (search this method's
signature line just above `:198` for the exact current type) to drop
`alive` from the shape.

Do NOT touch `resolveBossSummons()` (`StageWaveSystem.ts:218`, its own
separate read of `this.deps.battleSystem.getBattle()`) — confirmed by
the A0 spec's Non-Goals as a different, currently-dead code path, out of
scope for this task.

- [ ] **Step 4: Compose the real `alive` count in `GameManager.getStageProgress()`**

In `GameManager.ts:3096-3098`, change:

```typescript
  getStageProgress(): { spawned: number; total: number; alive: number } | null {
    return this.stageWaves.getProgress()
  }
```

to:

```typescript
  getStageProgress(): { spawned: number; total: number; alive: number } | null {
    const progress = this.stageWaves.getProgress()

    if (!progress) {
      return null
    }

    return {
      ...progress,
      alive: this.turnBattle?.enemies.filter((enemy) => enemy.entity.alive).length ?? 0,
    }
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd game && npx vitest run src/core/game/GameManager.stageProgress.test.ts`
Expected: PASS

- [ ] **Step 6: Run the full existing `StageWaveSystem`/`GameManager` test suites**

Run: `cd game && npx vitest run src/core/game/StageWaveSystem src/core/game/GameManager`
Expected: All existing tests PASS — check specifically for any test
asserting `getProgress()`'s old 3-field shape (with `alive`) and update
it to the new 2-field shape if found.

- [ ] **Step 7: Type-check and build**

Run: `cd game && npx vue-tsc --noEmit && npm run build`
Expected: No new errors.

- [ ] **Step 8: Commit**

```bash
git add game/src/core/game/StageWaveSystem.ts game/src/core/game/GameManager.ts game/src/core/game/GameManager.stageProgress.test.ts
git commit -m "fix(combat): read CombatTopBar's alive enemy count from the live turn battle"
```

- [ ] **Step 9: P14 visual verification**

This component changes a real HUD number (`CombatTopBar.vue`'s enemy
counter). Per this project's standing P14 requirement, open the game via
playwright-cli, start a real stage fight with multiple enemies, and
visually confirm the "alive" count in `CombatTopBar` decreases as
enemies die during a real turn-based battle (not stuck at 0 or at the
spawned total). Record the result (pass/fail + screenshot) before
considering this plan complete.

---

## Final Verification

- [ ] Full suite: `cd game && npx vitest run`
- [ ] Type-check: `cd game && npx vue-tsc --noEmit`
- [ ] Build: `cd game && npm run build`
- [ ] P14 pass recorded for Task 3 Step 9.
