# Stage Auto-Farm ("Hoàn Mỹ") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 3rd auto-battle mode — "Auto-farm Hoàn Mỹ" — that unlocks per-stage once the player clears it under a binary "Hoàn Mỹ" (Perfect) condition, then repeats that stage at half the qualifying clear's wall-clock time with no real battle simulation, no animation, and rewards rolled directly. It is the **only** mode in combat allowed to grant rewards while offline.

**Architecture:** New `PlayerData` fields track per-stage Hoàn Mỹ achievement + the qualifying clear's wall-clock duration + the single active auto-farm slot. A new `AutoFarmSystem`-style set of methods on `GameManager` computes the Hoàn Mỹ condition at the real turn-based victory point, drives a real-time cycle timer while online, and settles missed cycles on load using the exact `ProductionSystem.settleWorkersOffline`/`GameClock.calculateOfflineTime` pattern already in the codebase. Rewards are rolled by feeding a synthetic "already-defeated" enemy list through the existing `BattleLootSystem.processDefeatedEnemies()` — the same shim technique `GameManager.grantTurnBattleRewards()` already uses for real turn-based victories — so no new reward-granting logic is invented. UI adds a 4th `BattleRunMode` chip to `StageSelectPanel.vue`, gated on the stage's Hoàn Mỹ status.

**Tech Stack:** Vue 3 + TypeScript, Pinia, Vitest.

**Spec:** [2026-09-04-stage-auto-farm-design.md](../specs/2026-09-04-stage-auto-farm-design.md)

## Global Constraints

- Không dùng `any` nếu không cần thiết (project convention, `game/CLAUDE.md`).
- Không thay đổi architecture ngoài phạm vi đã liệt kê trong plan này.
- Ưu tiên sửa code hiện tại thay vì viết lại.
- Chạy `npx vue-tsc --noEmit` sau MỖI task chạm vào code TypeScript sống — không gộp nhiều task rồi mới typecheck 1 lần.
- Chỉ auto-farm Hoàn Mỹ được phép nhận reward khi offline (`Date.now()`-based). `manual`/`repeat`/`progress` giữ nguyên hành vi online-only hiện có — **không được** vô tình cho chúng catch-up offline khi sửa `GameManagerSaveRestore.ts`.
- `Date.now()` chỉ được dùng ở đúng 2-3 chỗ mới (ghi `perfectClearSeconds`, track `autoFarmStage.lastCheckedMs`, tick auto-farm cycle) — không lan ra các hệ thống combat khác vốn đang `deltaSeconds`-driven.
- Save-version bump bắt buộc (3 field mới trên `PlayerData`) theo đúng quy ước hiện có trong `game/src/services/save/saveVersion.ts` (tăng const + changelog comment, không viết migration).

---

### Task 1: Survey exact turn-based victory hook + confirm `completedStageIds` wiring

Spec §3.4 assumed the Hoàn Mỹ check hooks into `StageWaveSystem.ts:124-126` (the `completedStageIds.push` line) — **that assumption needs verification before any code is written**, because that block only runs inside `StageWaveSystem.update()`'s `battle.state === 'fighting' && aliveCount === 0` branch, and `GameManager.syncLegacyBattleState()` (`GameManager.ts:3166-3180`) sets the *legacy* `battle.state` to `'victory'` directly during the fixed-step loop — which may cause `StageWaveSystem.update()` to return early (`battle.state !== 'fighting'` guard, `StageWaveSystem.ts:104-106`) before ever reaching the `completedStageIds.push` line, for turn-based (TurnBattle-driven) stages specifically.

**Files:**
- Read only: `game/src/core/game/GameManager.ts:3043-3182` (full `updateBattleFixedStep`/`grantTurnBattleRewards`/`syncLegacyBattleState`)
- Read only: `game/src/core/game/StageWaveSystem.ts:81-183` (full `update`/`stopRepeat`)
- Read only: `game/src/core/combat/CombatEntity.ts:1-50` (confirm `currentHp`/`maxHp` fields on the type used by `TurnBattleParticipant.entity`)

- [ ] **Step 1: Confirm whether `completedStageIds` currently gets pushed for turn-based (TurnBattle) stage victories at all**

Run: `git log --oneline -- game/src/core/game/StageWaveSystem.ts | head -5` and read `GameManager.ts:3043-3182` fully. Write down (as a plan-adjacent note, not committed — just for your own reference in later tasks) which of these is true:
- (a) `completedStageIds.push` still fires correctly for TurnBattle victories via some path not yet identified in this plan, OR
- (b) it's a genuine pre-existing gap (turn-based stage wins never push `completedStageIds`), in which case Task 3 below must ALSO add the push (not just the Hoàn Mỹ tracking) at the same hook point.

This determines whether Task 3's Step 3 needs an extra 2 lines or not — do not skip this, guessing wrong here breaks stage progression silently (a correctness bug far worse than anything Hoàn Mỹ-related).

- [ ] **Step 2: No commit for this task** — it's pure investigation feeding Task 3. Move directly to Task 2.

---

### Task 2: `PlayerData` fields + save version bump

**Files:**
- Modify: `game/src/core/player/Player.ts` (interface near line 199-201, default factory near line 275)
- Modify: `game/src/services/save/saveVersion.ts`
- Modify: `game/src/stores/player.artifact.test.ts:33`, `game/src/stores/player.aiStrategy.test.ts:31`, `game/src/stores/player.restoreFromSave.test.ts:34` (any hand-built `PlayerData` fixture that lists `completedStageIds: []` needs the 3 new fields added alongside it)

**Interfaces:**
- Produces: `PlayerData.perfectClearStageIds: string[]`, `PlayerData.perfectClearSeconds: Record<string, number>`, `PlayerData.autoFarmStage: { stageId: string; lastCheckedMs: number } | null` — every later task in this plan reads/writes these exact names.

- [ ] **Step 1: Add the 3 fields to the `PlayerData` interface**

In `game/src/core/player/Player.ts`, right after the existing `completedStageIds: string[]` field (line ~201), add:

```ts
  // Auto-farm Hoàn Mỹ (2026-09-04 spec) — stage đã đạt điều kiện "Hoàn
  // Mỹ" (HP đội mất <=75% + turn < stage.perfectClearTurnLimit). Ghi 1
  // LẦN lúc đạt lần đầu, không cập nhật lại sau đó.
  perfectClearStageIds: string[]

  // Wall-clock giây của lần đạt Hoàn Mỹ đầu tiên cho stage đó — dùng
  // làm cycleSeconds = giá trị này / 2 cho auto-farm. Đây là 1 trong
  // đúng 2-3 chỗ combat được phép đọc Date.now() (xem plan
  // 2026-09-04-stage-auto-farm.md's Global Constraints).
  perfectClearSeconds: Record<string, number>

  // Stage đang auto-farm (chỉ 1 tại 1 thời điểm, khớp StageManager's
  // single-active cardinality). null = không có auto-farm nào đang chạy.
  autoFarmStage: { stageId: string; lastCheckedMs: number } | null
```

- [ ] **Step 2: Add matching defaults to `createDefaultPlayer()`**

In `game/src/core/player/Player.ts` near line 275, right after `completedStageIds: [],`, add:

```ts
    perfectClearStageIds: [],
    perfectClearSeconds: {},
    autoFarmStage: null,
```

- [ ] **Step 3: Add the same 3 fields to the 3 hand-built `PlayerData` test fixtures**

In each of `game/src/stores/player.artifact.test.ts`, `game/src/stores/player.aiStrategy.test.ts`, `game/src/stores/player.restoreFromSave.test.ts`, find the line `completedStageIds: [],` (or equivalent) inside the hand-built `PlayerData` object literal and add the same 3 lines from Step 2 directly after it.

- [ ] **Step 4: Run typecheck to confirm no other fixture is missing the fields**

Run: `npx vue-tsc --noEmit`
Expected: any remaining hand-built `PlayerData` literal missing the 3 fields shows as a compile error (TS excess/missing property) — fix each one the same way as Step 3 until it passes clean.

- [ ] **Step 5: Bump save version**

In `game/src/services/save/saveVersion.ts`, change:

```ts
export const CURRENT_SAVE_VERSION = 55 as const
```

to `56`, and add a changelog comment above it in the existing style:

```ts
// v56 (2026-09-04, stage-auto-farm spec): 3 field PlayerData mới —
// perfectClearStageIds (stage đã đạt điều kiện Hoàn Mỹ),
// perfectClearSeconds (wall-clock giây lần đạt đầu tiên, dùng làm cơ
// sở cycleSeconds cho auto-farm), autoFarmStage (slot auto-farm đang
// chạy, null nếu không có). Save v55 bị từ chối (dev phase, không
// migration).
export const CURRENT_SAVE_VERSION = 56 as const
```

- [ ] **Step 6: Run full test suite for player store**

Run: `npx vitest run game/src/stores/player.artifact.test.ts game/src/stores/player.aiStrategy.test.ts game/src/stores/player.restoreFromSave.test.ts game/src/core/player`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add game/src/core/player/Player.ts game/src/services/save/saveVersion.ts game/src/stores/player.artifact.test.ts game/src/stores/player.aiStrategy.test.ts game/src/stores/player.restoreFromSave.test.ts
git commit -m "feat(player): add perfectClearStageIds/perfectClearSeconds/autoFarmStage fields, bump save v56"
```

---

### Task 3: `Stage.perfectClearTurnLimit` field + Hoàn Mỹ condition computation at turn-based victory

**Files:**
- Modify: `game/src/core/stage/Stage.ts`
- Modify: `game/src/core/game/GameManager.ts` (near `grantTurnBattleRewards()`, `GameManager.ts:3112-3156`)
- Test: `game/src/core/game/GameManager.perfectClear.test.ts` (new)

**Interfaces:**
- Consumes: `PlayerData.perfectClearStageIds`/`perfectClearSeconds` (Task 2), `TurnBattle.totalTurnsElapsed: number` (existing, `GameManager.ts:2414`), `TurnBattle.player.entity: CombatEntity` with `currentHp`/`maxHp` (existing, `CombatEntity.ts`).
- Produces: a private `GameManager` method that computes and records Hoàn Mỹ on turn-based victory — later tasks (auto-farm cycle roll) don't call this directly, but Task 4's UI gating reads `PlayerData.perfectClearStageIds` this task writes to.

- [ ] **Step 1: Add `perfectClearTurnLimit` to the `Stage` interface**

In `game/src/core/stage/Stage.ts`, after the existing `bossEnemyId?: string` field, add:

```ts
  // Auto-farm Hoàn Mỹ (2026-09-04 spec) — số turn tối đa để đạt điều
  // kiện "Hoàn Mỹ" (kết hợp với ngưỡng HP đội mất <=75%, hardcode ở
  // GameManager). undefined = stage này chưa định nghĩa ngưỡng, không
  // bao giờ đạt Hoàn Mỹ (an toàn — không mở khoá auto-farm ngoài ý
  // muốn cho stage chưa balance). Content work, set theo từng stage.
  perfectClearTurnLimit?: number
```

- [ ] **Step 2: Write the failing test for Hoàn Mỹ computation**

Create `game/src/core/game/GameManager.perfectClear.test.ts`. Follow the existing test harness pattern used by other `GameManager.*.test.ts` files in the same directory (import `createTestGameManager`/equivalent helper already used by sibling tests — read `game/src/core/game/GameManager.zone.test.ts` for the exact harness setup before writing this, since the harness helper name isn't guessed here).

```ts
import { describe, expect, it } from 'vitest'
// import the same test-harness helper used by GameManager.zone.test.ts —
// confirm the exact import path/name by reading that file first.

describe('GameManager — Hoàn Mỹ condition on turn-based victory', () => {
  it('records perfectClearStageIds + perfectClearSeconds when HP loss <=75% and turns < perfectClearTurnLimit', () => {
    // Arrange: a GameManager test harness with a stage that has
    // perfectClearTurnLimit set high enough that a quick, low-damage
    // win qualifies. Drive the TurnBattle to victory using the same
    // pattern as existing TurnBattleSystem/GameManager turn-based
    // tests (read one such test in
    // game/src/core/battle/turn/TurnBattleSystem.slice5qa.test.ts or
    // GameManager's own turn-based test files for the exact
    // step-driving API before writing this).
    //
    // Assert: player.perfectClearStageIds includes the stage id;
    // player.perfectClearSeconds[stageId] is a positive number.
  })

  it('does NOT record Hoàn Mỹ when team HP loss exceeds 75%', () => {
    // Same setup, but the fixture takes enough damage that HP loss > 75%.
    // Assert: perfectClearStageIds does NOT include the stage id.
  })

  it('does NOT record Hoàn Mỹ when turns elapsed >= perfectClearTurnLimit', () => {
    // Same setup, but perfectClearTurnLimit set to 1 with a fight that
    // takes more than 1 turn.
    // Assert: perfectClearStageIds does NOT include the stage id.
  })

  it('does not overwrite perfectClearSeconds on a second Hoàn Mỹ clear', () => {
    // Win the stage under Hoàn Mỹ conditions twice; assert
    // perfectClearSeconds[stageId] equals the FIRST recorded value,
    // not the second.
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run game/src/core/game/GameManager.perfectClear.test.ts`
Expected: FAIL (`perfectClearStageIds` stays empty — no computation exists yet)

- [ ] **Step 4: Implement the Hoàn Mỹ computation, hooked into the confirmed victory point**

In `GameManager.ts`, inside `grantTurnBattleRewards()` (`GameManager.ts:3112-3156`), the terminal block already reads:

```ts
    if (turnBattle.state !== 'fighting' && !this.turnBattleEndEmitted) {
      this.turnBattleEndEmitted = true

      if (turnBattle.state === 'victory') {
        this.eventBus.emit('battle_end', { type: 'battle_end', state: 'victory' })
      }
    }
```

Change the `if (turnBattle.state === 'victory')` branch to also call a new private method:

```ts
      if (turnBattle.state === 'victory') {
        this.eventBus.emit('battle_end', { type: 'battle_end', state: 'victory' })
        this.recordPerfectClearIfEligible(turnBattle)
      }
```

Add the new method (near `grantTurnBattleRewards`):

```ts
  private turnBattleStartedAtMs: number | null = null

  private recordPerfectClearIfEligible(turnBattle: TurnBattle) {
    const stage = this.activeStageForTurnBattle
    const player = this.playerDataForTurnBattle

    if (!stage || !player || stage.perfectClearTurnLimit === undefined) {
      return
    }

    if (player.perfectClearStageIds.includes(stage.id)) {
      return
    }

    const entity = turnBattle.player.entity
    const hpLossPercent = ((entity.maxHp - entity.currentHp) / entity.maxHp) * 100

    const isPerfectClear =
      hpLossPercent <= 75 && turnBattle.totalTurnsElapsed < stage.perfectClearTurnLimit

    if (!isPerfectClear) {
      return
    }

    const startedAtMs = this.turnBattleStartedAtMs ?? Date.now()
    const clearSeconds = Math.max(0, (Date.now() - startedAtMs) / 1000)

    player.perfectClearStageIds.push(stage.id)
    player.perfectClearSeconds[stage.id] = clearSeconds

    // (Task 1 finding — nếu Task 1 xác định completedStageIds KHÔNG
    // được push cho turn-based victory ở đâu khác, thêm dòng đó ở
    // đây luôn, cùng chỗ, cùng điều kiện gate — không phải phạm vi
    // Hoàn Mỹ riêng nhưng đúng vị trí sửa nhất quán.)
  }
```

Set `this.turnBattleStartedAtMs = Date.now()` at the same point `startStage()` currently does its turn-based setup (`GameManager.ts:2829`, right where `this.turnBattle.wave = {...}` is assigned) — this is the stage-start timestamp needed for `clearSeconds`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run game/src/core/game/GameManager.perfectClear.test.ts`
Expected: PASS

- [ ] **Step 6: Run typecheck**

Run: `npx vue-tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add game/src/core/stage/Stage.ts game/src/core/game/GameManager.ts game/src/core/game/GameManager.perfectClear.test.ts
git commit -m "feat(combat): compute Hoàn Mỹ condition on turn-based stage victory"
```

---

### Task 4: Auto-farm cycle roll mechanism (online tick)

**Files:**
- Modify: `game/src/core/game/GameManager.ts`
- Test: `game/src/core/game/GameManager.autoFarm.test.ts` (new)

**Interfaces:**
- Consumes: `PlayerData.autoFarmStage`/`perfectClearStageIds`/`perfectClearSeconds` (Task 2), `BattleLootSystem.processDefeatedEnemies(battle: Battle)` + `.setSession(receiver, player)` + `.beginBattle()` (existing, `BattleLootSystem.ts:116-127,161-316`), `GameManager.buildPlayerRewardReceiver(player)` (existing, `GameManager.ts:2565-2583`), `StageWaveSystem.pickEnemyForTurnSpawn(stage, isFinalSpawn)` (existing, `StageWaveSystem.ts:300-302`), `EnemySystem.spawn`/`.despawn`/`.get` (existing), `enemyToCombatEntity()` (existing helper already imported in `GameManager.ts`), `StageManager.get()`/`.start()`/`.stop()` (existing, `StageManager.ts`).
- Produces: `GameManager.startAutoFarm(stageId: string): boolean`, `GameManager.stopAutoFarm(): void`, a private per-tick method called from the existing fixed-step loop that rolls completed cycles.

- [ ] **Step 1: Write the failing test for starting auto-farm exclusivity**

Create `game/src/core/game/GameManager.autoFarm.test.ts`. Read `game/src/core/game/GameManager.zone.test.ts` first for the exact test-harness helper this repo uses for `GameManager` unit tests, then:

```ts
import { describe, expect, it } from 'vitest'
// same harness import as GameManager.zone.test.ts

describe('GameManager — auto-farm start/stop exclusivity', () => {
  it('startAutoFarm fails for a stage not in perfectClearStageIds', () => {
    // Arrange harness with player.perfectClearStageIds = [] (default).
    // Act: gameManager.startAutoFarm('some_stage_id')
    // Assert: returns false, player.autoFarmStage stays null.
  })

  it('startAutoFarm succeeds for a Hoàn Mỹ stage and sets autoFarmStage', () => {
    // Arrange: player.perfectClearStageIds = ['stage_1'],
    // player.perfectClearSeconds = { stage_1: 100 }.
    // Act: gameManager.startAutoFarm('stage_1')
    // Assert: returns true; player.autoFarmStage = { stageId: 'stage_1', lastCheckedMs: expect.any(Number) }.
  })

  it('startAutoFarm fails while StageManager already has an active stage (manual/repeat/progress running)', () => {
    // Arrange: start a normal manual stage first (stageManager.start(...)
    // via the existing startStage() flow used by other GameManager tests).
    // Act: gameManager.startAutoFarm('stage_1') on a different, Hoàn-Mỹ'd stage.
    // Assert: returns false — StageManager slot already occupied.
  })

  it('stopAutoFarm clears autoFarmStage and frees the StageManager slot', () => {
    // Start auto-farm, then stopAutoFarm(), assert player.autoFarmStage === null
    // and stageManager.get() === null.
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run game/src/core/game/GameManager.autoFarm.test.ts`
Expected: FAIL (`startAutoFarm`/`stopAutoFarm` don't exist yet)

- [ ] **Step 3: Implement `startAutoFarm`/`stopAutoFarm`**

Add to `GameManager.ts`, near `startStage()`:

```ts
  startAutoFarm(stageId: string): boolean {
    if (!this.activePlayerData.perfectClearStageIds.includes(stageId)) {
      return false
    }

    if (this.stageManager.get() !== null) {
      return false
    }

    const stage = this.stageTemplates.get(stageId)

    if (!stage) {
      return false
    }

    // Occupies the same single-slot cardinality as manual/repeat/progress
    // (StageManager.start requires spawnIntervalSeconds — auto-farm never
    // spawns anything, but reuses the slot to keep exclusivity uniform).
    if (!this.stageManager.start(stage)) {
      return false
    }

    this.activePlayerData.autoFarmStage = { stageId, lastCheckedMs: Date.now() }

    return true
  }

  stopAutoFarm(): void {
    if (this.activePlayerData.autoFarmStage === null) {
      return
    }

    this.activePlayerData.autoFarmStage = null
    this.stageManager.stop()
  }
```

Replace `this.activePlayerData` above with whatever the real current-player accessor is in this file (read the surrounding 50 lines of `startStage()` first — other `GameManager` methods in this file take `player: PlayerData` as an explicit parameter rather than reading an internal "active player" field; if that's the case here too, change both methods' signatures to `startAutoFarm(player: PlayerData, stageId: string): boolean` / `stopAutoFarm(player: PlayerData): void` to match the established calling convention, and update the test calls accordingly).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run game/src/core/game/GameManager.autoFarm.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test for cycle-based reward rolling (online tick)**

Add to the same test file:

```ts
describe('GameManager — auto-farm cycle reward rolling', () => {
  it('rolls one reward cycle once cycleSeconds has elapsed, using real vi.useFakeTimers()', () => {
    // Use vi.useFakeTimers() + vi.setSystemTime() to control Date.now().
    // Arrange: player.perfectClearStageIds = ['stage_1'],
    // perfectClearSeconds = { stage_1: 100 } (so cycleSeconds = 50).
    // gameManager.startAutoFarm('stage_1').
    // Advance system time by 50_000ms, call gameManager's tick
    // (whatever the fixed-step update entrypoint is — same one other
    // GameManager tests use to drive ticks, e.g. gameManager.tick(deltaSeconds)
    // or App.vue's tick() equivalent — confirm exact name by reading a
    // sibling GameManager test file that drives ticks).
    // Assert: rewards were granted (check gameManager.getBattleRewardSummary()
    // or the specific bag/material the fixture's stage's enemy pool drops —
    // reuse whatever assertion style GameManager.zone.test.ts /
    // BattleLootSystem tests already use for "reward was granted").
    // Assert: player.autoFarmStage.lastCheckedMs advanced by exactly 50_000ms
    // (not more) — leftover partial-cycle time must carry over, not reset.
  })

  it('does not run TurnBattleSystem or spawn a visible battle while auto-farming', () => {
    // Assert gameManager.getTurnBattle() stays null throughout — this is
    // the "no real simulation, no animation" requirement from the spec.
  })
})
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npx vitest run game/src/core/game/GameManager.autoFarm.test.ts`
Expected: FAIL

- [ ] **Step 7: Implement the cycle-roll tick, hooked into the existing fixed-step loop**

In `updateBattleFixedStep` (`GameManager.ts:3043-3061`), add a call at the top of the `while (remaining > 0)` loop (before the existing `if (this.turnBattle ...)` block):

```ts
      this.tickAutoFarm(this.activePlayerData)
```

(Again, adjust to whichever player-passing convention Step 3 settled on.)

Implement:

```ts
  private tickAutoFarm(player: PlayerData) {
    const autoFarm = player.autoFarmStage

    if (!autoFarm) {
      return
    }

    const cycleSeconds = player.perfectClearSeconds[autoFarm.stageId]

    if (cycleSeconds === undefined) {
      return
    }

    const halfCycleMs = (cycleSeconds / 2) * 1000
    const now = Date.now()
    const elapsedMs = now - autoFarm.lastCheckedMs
    const completedCycles = Math.floor(elapsedMs / halfCycleMs)

    if (completedCycles <= 0) {
      return
    }

    const stage = this.stageTemplates.get(autoFarm.stageId)

    if (!stage) {
      return
    }

    for (let i = 0; i < completedCycles; i++) {
      this.rollAutoFarmCycleReward(player, stage)
    }

    autoFarm.lastCheckedMs += completedCycles * halfCycleMs
  }

  private rollAutoFarmCycleReward(player: PlayerData, stage: Stage) {
    this.battleLoot.beginBattle()
    this.battleLoot.setSession(this.buildPlayerRewardReceiver(player), player)

    const killedEntities: { entity: CombatEntity; rewardGranted: boolean }[] = []

    for (let i = 0; i < stage.totalEnemyCount; i++) {
      const isFinalSpawn = i === stage.totalEnemyCount - 1
      const template = this.stageWaves.pickEnemyForTurnSpawn(stage, isFinalSpawn)

      if (!template) {
        continue
      }

      const entity = enemyToCombatEntity(this.enemySystem.spawn(template))
      entity.alive = false

      killedEntities.push({ entity, rewardGranted: false })
    }

    const shimBattle = {
      player: killedEntities[0]?.entity ?? null,
      enemies: killedEntities,
    } as unknown as Battle

    this.battleLoot.processDefeatedEnemies(shimBattle)
  }
```

Note: `shimBattle.player` is only read by `processDefeatedEnemies` for the heal-on-kill HP branch (`BattleLootSystem.ts:177-184`) — using a defeated enemy entity there is a harmless placeholder since heal-on-kill math against a non-alive entity is inert; if `npx vue-tsc --noEmit` or the tests surface a real issue with this (e.g. a null-check assumption), read `BattleLootSystem.ts:161-316` fully at this point and adjust to pass `turnBattle`'s last-known player entity instead, or a minimal fixture `CombatEntity`.

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run game/src/core/game/GameManager.autoFarm.test.ts`
Expected: PASS

- [ ] **Step 9: Run typecheck**

Run: `npx vue-tsc --noEmit`
Expected: no errors

- [ ] **Step 10: Commit**

```bash
git add game/src/core/game/GameManager.ts game/src/core/game/GameManager.autoFarm.test.ts
git commit -m "feat(combat): auto-farm cycle reward rolling (online tick, no simulation/animation)"
```

---

### Task 5: Offline catch-up on load

**Files:**
- Modify: `game/src/core/game/GameManagerSaveRestore.ts` (near lines 225-269, the existing production/alchemy offline-settle call site)
- Test: `game/src/core/game/GameManagerSaveRestore.autoFarm.test.ts` (new) — or add to an existing offline-settle test file if one already covers production's offline path (check for `GameManagerSaveRestore.*.test.ts` / `*.offline.test.ts` files first and prefer extending one over creating a new file, per DRY).

**Interfaces:**
- Consumes: `PlayerData.autoFarmStage`/`perfectClearSeconds` (Task 2), `GameClock.calculateOfflineTime(state, timestamp, maxOfflineSeconds): OfflineTimeResult` (existing, `GameClock.ts:57-77`), `PRODUCTION_OFFLINE_CAP_SECONDS` (existing, `ProductionBalance.ts:115`), `GameManager.rollAutoFarmCycleReward` (Task 4, may need to become non-private or exposed via a thin public wrapper if `GameManagerSaveRestore.ts` is a separate module from `GameManager.ts` — check the actual relationship between these two files first: read `GameManagerSaveRestore.ts`'s top imports to see whether it's a mixin/method-group on the same class or a separate collaborator, and match Task 4's method visibility accordingly).

- [ ] **Step 1: Read the exact production offline-settle call site**

Read `game/src/core/game/GameManagerSaveRestore.ts:200-271` in full (the range this plan's earlier survey identified) to get the exact variable names (`elapsedOfflineSeconds`, `save.player.lastSavedAt`, the `> 60` gate, and how `productionSystem.settleOffline(...)`'s exact parameters are threaded) before writing the parallel auto-farm block — do not guess these names, copy them verbatim from what you read.

- [ ] **Step 2: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest'
// same harness pattern as the production offline-settle test this task
// is extending/sitting next to.

describe('GameManagerSaveRestore — auto-farm offline catch-up', () => {
  it('grants reward for completed cycles elapsed while offline', () => {
    // Arrange a save with player.autoFarmStage = { stageId: 'stage_1', lastCheckedMs: <10 minutes ago> },
    // perfectClearSeconds = { stage_1: 120 } (cycleSeconds = 60 -> 10 cycles in 10 minutes).
    // Act: load the save (drive whatever the real load/restore entrypoint is).
    // Assert: rewards were granted for ~10 cycles' worth (same assertion
    // style as Task 4's cycle-roll test), and autoFarmStage.lastCheckedMs
    // advanced close to "now".
  })

  it('caps offline auto-farm catch-up at PRODUCTION_OFFLINE_CAP_SECONDS, same as production', () => {
    // Arrange autoFarmStage.lastCheckedMs far beyond the cap (e.g. 30 days ago).
    // Assert: only cap-worth of cycles are granted, not the full elapsed span.
  })

  it('does NOT grant any reward for manual/repeat/progress modes while offline', () => {
    // Arrange a save with no autoFarmStage set (null) but a long elapsed
    // offline gap. Assert nothing related to combat rewards is granted
    // from this offline-settle path — manual/repeat/progress stay
    // online-only, confirming this task didn't accidentally widen scope.
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run game/src/core/game/GameManagerSaveRestore.autoFarm.test.ts`
Expected: FAIL

- [ ] **Step 4: Implement the offline catch-up block**

Immediately after the existing alchemy `settleOffline` call (the line right before `return this.deps.equipmentSystem.getModifiers()` per the earlier survey), add:

```ts
    if (save.player.autoFarmStage) {
      const { offlineSeconds } = calculateOfflineTime(
        { lastOnlineAt: save.player.autoFarmStage.lastCheckedMs },
        Date.now(),
        PRODUCTION_OFFLINE_CAP_SECONDS,
      )

      const stage = this.deps.stageTemplates.get(save.player.autoFarmStage.stageId)
      const cycleSeconds = save.player.perfectClearSeconds[save.player.autoFarmStage.stageId]

      if (stage && cycleSeconds !== undefined) {
        const halfCycleSeconds = cycleSeconds / 2
        const completedCycles = Math.floor(offlineSeconds / halfCycleSeconds)

        for (let i = 0; i < completedCycles; i++) {
          this.deps.gameManager.rollAutoFarmCycleReward(save.player, stage)
        }

        save.player.autoFarmStage.lastCheckedMs += completedCycles * halfCycleSeconds * 1000
      }
    }
```

Adjust `this.deps.gameManager.rollAutoFarmCycleReward(...)`'s exact access path once Step 1's read confirms how `GameManagerSaveRestore.ts` reaches back into `GameManager` (it may already hold a `gameManager` reference in `this.deps`, or it may BE a method group mixed onto `GameManager` itself, in which case just call `this.rollAutoFarmCycleReward(...)` directly and drop the `.deps.gameManager` indirection — match whatever Step 1 found, and if Task 4's `rollAutoFarmCycleReward` was written `private`, widen it to the minimum visibility this call site actually needs).

Import `calculateOfflineTime` from `game/src/core/idle/GameClock.ts` and `PRODUCTION_OFFLINE_CAP_SECONDS` from `game/src/core/production/ProductionBalance.ts` at the top of `GameManagerSaveRestore.ts`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run game/src/core/game/GameManagerSaveRestore.autoFarm.test.ts`
Expected: PASS

- [ ] **Step 6: Run typecheck**

Run: `npx vue-tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add game/src/core/game/GameManagerSaveRestore.ts game/src/core/game/GameManagerSaveRestore.autoFarm.test.ts
git commit -m "feat(combat): auto-farm offline catch-up (sole combat exception to online-only rewards)"
```

---

### Task 6: UI — 4th `BattleRunMode` chip

**Files:**
- Modify: `game/src/stores/ui.ts:78` (the `BattleRunMode` type) and its setter near line 322
- Modify: `game/src/stores/uiFlagsPersistence.ts:22` (`BATTLE_RUN_MODES` array)
- Modify: `game/src/components/panels/StageSelectPanel.vue` (chip markup lines 284-292, and the `start()`/`mode`/`canStart` logic near lines 156-184)
- Modify: i18n locale files providing `panels.stageSelect.modes.*`/`panels.stageSelect.modeHints.*` keys (find via `Grep` for `panels.stageSelect.modes.manual` to locate the exact locale JSON/YAML file(s) — do not guess the path)
- Test: `game/src/components/panels/StageSelectPanel.test.ts` (extend if it exists, else check whether this component has any existing test coverage at all before deciding whether to add one — read the directory first)

**Interfaces:**
- Consumes: `PlayerData.perfectClearStageIds` (Task 2), `GameManager.startAutoFarm`/`stopAutoFarm` (Task 4).
- Produces: `BattleRunMode = 'manual' | 'repeat' | 'progress' | 'perfect_farm'`.

- [ ] **Step 1: Extend the `BattleRunMode` type**

In `game/src/stores/ui.ts:78`:

```ts
export type BattleRunMode = 'manual' | 'repeat' | 'progress' | 'perfect_farm'
```

- [ ] **Step 2: Extend `uiFlagsPersistence.ts`'s runtime guard array**

In `game/src/stores/uiFlagsPersistence.ts:22`:

```ts
const BATTLE_RUN_MODES: readonly BattleRunMode[] = ['manual', 'repeat', 'progress', 'perfect_farm']
```

- [ ] **Step 3: Run typecheck to find every exhaustive `BattleRunMode` switch/ternary that needs a 4th branch**

Run: `npx vue-tsc --noEmit`
Expected: compile errors at every place a `BattleRunMode` union is matched non-exhaustively (e.g. `CombatVictoryPanel.vue:60,90-97` reads `ui.battleRunMode === 'progress'` inside an `if`, which is safe as-is since it doesn't exhaustively switch — but `StageSelectPanel.vue`'s mode-hint ternary at line 291 IS a chained ternary that needs a 4th arm). Fix each site found.

For `StageSelectPanel.vue:291`'s mode-hint ternary specifically, change:

```html
{{ mode === 'manual' ? t('panels.stageSelect.modeHints.manual') : mode === 'repeat' ? t('panels.stageSelect.modeHints.repeat') : t('panels.stageSelect.modeHints.progress') }}
```

to:

```html
{{ mode === 'manual' ? t('panels.stageSelect.modeHints.manual') : mode === 'repeat' ? t('panels.stageSelect.modeHints.repeat') : mode === 'progress' ? t('panels.stageSelect.modeHints.progress') : t('panels.stageSelect.modeHints.perfectFarm') }}
```

- [ ] **Step 4: Add the 4th chip, gated on Hoàn Mỹ status**

In `StageSelectPanel.vue`, add a computed near `canStart`:

```ts
const isSelectedStagePerfectClear = computed(() =>
  Boolean(selectedStage.value && player.perfectClearStageIds.includes(selectedStage.value.id)),
)
```

(Confirm the exact `player` store accessor already used elsewhere in this file — `player.$state.perfectClearStageIds` vs `player.perfectClearStageIds` — by reading how `player` is imported/used for other reads in this same file before writing this line.)

Add the chip in the `stage-select__mode` div (after the `progress` chip):

```html
<Chip
  :active="mode === 'perfect_farm'"
  :disabled="!isSelectedStagePerfectClear"
  @click="isSelectedStagePerfectClear && (mode = 'perfect_farm')"
>{{ t('panels.stageSelect.modes.perfectFarm') }}</Chip>
```

- [ ] **Step 5: Wire `start()` to call `startAutoFarm` instead of `startSelectedStage` when `mode === 'perfect_farm'`**

In `StageSelectPanel.vue`'s `start()` function, before the existing `startSelectedStage(...)` call, branch:

```ts
function start() {
  if (!selectedZone.value || !selectedStage.value || !canStart.value) {
    return
  }

  if (mode.value === 'perfect_farm') {
    gameManager.startAutoFarm(player.$state, selectedStage.value.id)
    ui.leftPanelMode = null
    return
  }

  startSelectedStage(selectedZone.value.id, selectedStage.value, mode.value)
}
```

(Match `gameManager`'s existing injection pattern in this file — it likely already needs `useGameManager()` imported if not already present; check the top of the file first.)

- [ ] **Step 6: Add the 2 new i18n keys**

Locate the locale file(s) containing `panels.stageSelect.modes.manual` (via Grep) and add `modes.perfectFarm` + `modeHints.perfectFarm` keys in the same file(s), matching existing Vietnamese copy style for the sibling keys (e.g. short 1-3 word chip label, 1-sentence hint).

- [ ] **Step 7: Manual smoke test**

Run the dev server, open Stage Select for a stage that has NOT been Hoàn Mỹ-cleared — confirm the 4th chip renders disabled. This plan cannot pre-seed a real Hoàn Mỹ clear through the UI alone (no stage in current content has `perfectClearTurnLimit` set yet — that's explicitly out of scope, see spec §4), so full end-to-end chip-enabled verification is deferred to whenever content sets a real `perfectClearTurnLimit` on a stage; note this limitation in the task's commit message rather than skipping the smoke test silently.

- [ ] **Step 8: Run typecheck + relevant tests**

Run: `npx vue-tsc --noEmit && npx vitest run game/src/components/panels`
Expected: no errors, PASS

- [ ] **Step 9: Commit**

```bash
git add game/src/stores/ui.ts game/src/stores/uiFlagsPersistence.ts game/src/components/panels/StageSelectPanel.vue
git commit -m "feat(ui): add perfect_farm 4th BattleRunMode chip, gated on Hoàn Mỹ status"
```

---

### Task 7: Full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS, no regressions in unrelated suites (particularly `game/src/core/game/GameManager.zone.test.ts`, `StageWaveSystem.*.test.ts`, `ProductionSystem.test.ts`, `GameManagerSaveRestore.*.test.ts`, `player.*.test.ts`).

- [ ] **Step 2: Run full typecheck**

Run: `npx vue-tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Re-read `game/docs/turn-based-combat-roadmap.md` mục 7 and update its status line**

Change the roadmap's "Auto-farm Hoàn Mỹ ... 🟡 Đã brainstorm + chốt thiết kế ... chờ viết spec/plan" table row to "🟢 Đã thực thi + merge" once this task's commit lands, matching the convention used for Combat Fairness Guards' equivalent status update.

- [ ] **Step 4: Commit the roadmap update**

```bash
git add game/docs/turn-based-combat-roadmap.md
git commit -m "docs: roadmap - Stage Auto-Farm (Hoàn Mỹ) implemented + merged"
```

## Self-Review Notes (for the plan writer, kept for traceability)

- **Spec coverage**: §3.1 terminology (Task 2-3), §3.2 condition (Task 3), §3.3 data model (Task 2), §3.4 hook point (Task 1 survey + Task 3, with an explicit correction that the spec's assumed `StageWaveSystem.ts:124-126` hook may not fire for turn-based victories — Task 1 resolves this before Task 3 commits to a location), §3.5 cycle mechanism (Task 4), §3.6 offline exception (Task 5), §3.7 slot exclusivity (Task 4 Step 1-4), §3.8 UI (Task 6). §4 (out of scope) and §5 (risks) are respected — no task attempts stage-map badges or `perfectClearTurnLimit` content balancing.
- **Known open question carried into Task 1**: whether `completedStageIds` currently updates at all for turn-based stage victories is unresolved as of this plan's writing (the survey that fed this plan found `syncLegacyBattleState()` may prevent `StageWaveSystem.ts:124-126` from ever firing post-cutover) — Task 1 forces this to be resolved with real code reading before Task 3 writes anything, rather than the plan guessing.
- **Type consistency check**: `PlayerData.autoFarmStage` shape (`{ stageId: string; lastCheckedMs: number } | null`) is used identically in Task 2 (definition), Task 4 (`startAutoFarm`/`tickAutoFarm`), Task 5 (offline settle), Task 6 (UI gate reads `perfectClearStageIds`, not `autoFarmStage`, correctly — the chip's enabled-state depends on Hoàn Mỹ achievement, not on whether farm is currently running).
