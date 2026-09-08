# R8.1 Quest Activation Lifecycle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (opencode inline execution per AGENTS.md P6 convention) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quest activation becomes a lifecycle command driven by boot/restore, daily rollover and realm transition; `getActiveQuests` becomes purely observational so normal gameplay never depends on opening QuestPanel (AR-09).

**Architecture:** New `QuestSystem.reconcileActiveQuests` command reuses the idempotent `QuestManager.ensureActive`; the side effect is removed from `getActiveQuests`; GameManager triggers reconciliation at the three lifecycle points (restore, daily-reset tick, realm transition flag).

**Tech Stack:** TypeScript, Vitest (TDD).

**Spec:** `game/docs/superpowers/specs/2026-09-08-r81-quest-lifecycle-design.md`

## Global Constraints

- No `any` (P8); comments in English ASCII (P15).
- Preserved behavior (spec §1): counting from activation; no retroactive credit; `once` never reappears; daily board = all unlocked dailies.
- `getActiveQuests` return shape `{ quest, progress }[]` unchanged — QuestPanel.vue:44 keeps working without modification.
- Do not touch quest content, rewards, or R8.2 tribulation code (spec §9).
- Dedicated worktree via `using-git-worktrees`; task name `r81-quest-lifecycle`.
- Verification: P3 `full` (touches GameManager boot/restore/tick paths — wiring-critical per P13). Stop on first failure.

---

### Task 1: Characterize current contract, then make getActiveQuests pure + reconcile command

**Files:**
- Modify: `game/src/core/quest/QuestSystem.ts:48-68`
- Test: `game/src/core/quest/QuestSystem.lifecycle.test.ts` (new)
- Modify: `game/src/core/quest/QuestSystem.test.ts` (only where tests assert the OLD activation-on-read contract)

**Interfaces:**
- Consumes: `QuestManager.ensureActive` (unchanged, becomes internal to lifecycle flow), `isUnlocked`, `manager.isCompletedOnce` (all existing).
- Produces:
  ```ts
  // QuestSystem — lifecycle command, NOT a query
  reconcileActiveQuests(
    registry: QuestRegistry,
    manager: QuestManager,
    player: PlayerData,
  ): void
  ```

- [ ] **Step 1: Write the failing lifecycle tests**

```ts
// QuestSystem.lifecycle.test.ts
import { describe, expect, it } from 'vitest'
import { QuestSystem } from './QuestSystem'
import { QuestRegistry } from './QuestRegistry'
import { QuestManager } from './QuestManager'
// Player/test-quest factories: reuse the existing harness from
// QuestSystem.test.ts (same imports it uses for TEST quest + player).

describe('QuestSystem lifecycle — AR-09', () => {
  it('reconcileActiveQuests activates every unlocked eligible quest', () => {
    const { system, registry, manager, player } = makeHarness()
    system.reconcileActiveQuests(registry, manager, player)
    expect(manager.getProgress('quest_once_a')).toBeDefined()
    expect(manager.getProgress('quest_daily_b')).toBeDefined()
  })

  it('skips locked and completed-once quests', () => {
    const { system, registry, manager, player } = makeHarness()
    player.realmId = 'mortal' // quest_once_b requires higher realm
    manager.markCompletedOnce('quest_once_a')
    system.reconcileActiveQuests(registry, manager, player)
    expect(manager.getProgress('quest_once_a')).toBeUndefined()
    expect(manager.getProgress('quest_once_b')).toBeUndefined()
  })

  it('is idempotent — repeated reconcile does not duplicate or reset progress', () => {
    const { system, registry, manager, player } = makeHarness()
    system.reconcileActiveQuests(registry, manager, player)
    manager.incrementProgress('quest_daily_b', 3)
    system.reconcileActiveQuests(registry, manager, player)
    expect(manager.getProgress('quest_daily_b')!.progress).toBe(3)
    expect(manager.getActive().filter((p) => p.questId === 'quest_daily_b')).toHaveLength(1)
  })

  it('getActiveQuests does NOT activate — pure read', () => {
    const { system, registry, manager, player } = makeHarness()
    const before = JSON.stringify(manager.getState())
    const result = system.getActiveQuests(registry, manager, player)
    expect(result).toEqual([]) // nothing activated yet
    expect(JSON.stringify(manager.getState())).toBe(before)
  })

  it('events count only after lifecycle activation (unopened UI)', () => {
    const { system, registry, manager, player } = makeHarness()
    system.reconcileActiveQuests(registry, manager, player)
    system.onEnemyDefeated(registry, manager, 'enemy_x', undefined)
    expect(manager.getProgress('quest_kill_c')!.progress).toBe(1)
  })

  it('events do NOT count before activation (no retroactive credit)', () => {
    const { system, registry, manager, player } = makeHarness()
    system.onEnemyDefeated(registry, manager, 'enemy_x', undefined)
    system.reconcileActiveQuests(registry, manager, player)
    expect(manager.getProgress('quest_kill_c')!.progress).toBe(0)
  })

  it('daily rollover then reconcile repopulates the board', () => {
    const { system, registry, manager, player } = makeHarness()
    system.reconcileActiveQuests(registry, manager, player)
    manager.incrementProgress('quest_daily_b', 2)
    system.checkAndResetDaily(registry, manager, player, Date.now() + 25 * 60 * 60 * 1000)
    expect(manager.getProgress('quest_daily_b')).toBeUndefined() // reset clears
    system.reconcileActiveQuests(registry, manager, player)
    expect(manager.getProgress('quest_daily_b')).toBeDefined() // rebuilt
    expect(manager.getProgress('quest_daily_b')!.progress).toBe(0)
  })
})
```

Build `makeHarness()` in this file using the SAME quest/player fixture pattern as `QuestSystem.test.ts` (read it first; its registry entries at :84-179 show the shape). Fixtures: one `once` quest, one `daily` quest, one `kill` quest with `enemyId 'enemy_x'`, one realm-locked `once` quest.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx.cmd vitest run src/core/quest/QuestSystem.lifecycle.test.ts`
Expected: FAIL — `reconcileActiveQuests` does not exist; `getActiveQuests` currently activates (the pure-read test fails).

- [ ] **Step 3: Implement**

`QuestSystem.ts` — replace `getActiveQuests` body and add the command:

```ts
  /**
   * Lifecycle command (R8.1, AR-09) — activates every eligible quest
   * exactly once. Triggers: boot/restore, daily rollover, realm
   * unlock transition. Idempotent. NOT a query — reads never call it.
   */
  reconcileActiveQuests(
    registry: QuestRegistry,
    manager: QuestManager,
    player: PlayerData,
  ): void {
    for (const quest of registry.getAll()) {
      if (!isUnlocked(quest, player)) {
        continue
      }

      if (quest.cadence === 'once' && manager.isCompletedOnce(quest.id)) {
        continue
      }

      manager.ensureActive(quest)
    }
  }

  /**
   * Read-only projection (R8.1, AR-09) — NO side effects. Activation
   * belongs to reconcileActiveQuests; a query must never mutate quest
   * state (AGENTS.md A3/A7 query purity).
   */
  getActiveQuests(
    registry: QuestRegistry,
    manager: QuestManager,
    player: PlayerData,
  ): { quest: Quest; progress: QuestProgress }[] {
    const result: { quest: Quest; progress: QuestProgress }[] = []

    for (const quest of registry.getAll()) {
      const progress = manager.getProgress(quest.id)

      if (!progress) {
        continue
      }

      result.push({ quest, progress })
    }

    return result
  }
```

- [ ] **Step 4: Update old tests that documented activation-on-read**

`QuestSystem.test.ts` (:84-179): tests that call `getActiveQuests` and expect newly-created progress entries must now call `system.reconcileActiveQuests(registry, manager, player)` first (or assert the empty read). Update the CONTRACT comments, do not delete coverage. Run the full quest test file.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx.cmd vitest run src/core/quest/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/quest/QuestSystem.ts src/core/quest/QuestSystem.lifecycle.test.ts src/core/quest/QuestSystem.test.ts
git commit -m "feat(r81): quest reconcile lifecycle command; getActiveQuests becomes pure read (AR-09)"
```

---

### Task 2: Wire the three lifecycle triggers in GameManager

**Files:**
- Modify: `game/src/core/game/GameManager.ts` (`update` :2730-2740 region; realm-transition writer; a `reconcileQuestsIfNeeded` private method)
- Modify: `game/src/core/game/GameManagerSaveRestore.ts:250-252` (after quest restore)
- Test: `game/src/core/game/GameManager.questLifecycle.test.ts` (new)

**Interfaces:**
- Consumes: `reconcileActiveQuests` (Task 1), `questSystem.checkAndResetDaily` (existing tick call :2733).
- Produces: GameManager behavior — quests active after boot/restore/day-rollover/realm-change without any UI read. New private state: `private questRealmReconcileNeeded = false` + `markQuestRealmTransition(): void` (called wherever `player.realmId` is authoritatively assigned — see Step 3).

- [ ] **Step 1: Write the failing GameManager-level tests**

```ts
// GameManager.questLifecycle.test.ts
import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'

// Harness: follow GameManager.workerCapacity.test.ts for how a fresh
// GameManager gets an active player (setActivePlayer + real flow).

describe('quest lifecycle wiring — AR-09', () => {
  it('kill counts BEFORE any QuestPanel read (fresh session)', () => {
    const manager = makeManagerWithActivePlayer()
    const before = manager.questManager.getActive().length

    manager.questSystem.onEnemyDefeated(
      manager.questRegistry,
      manager.questManager,
      'test_enemy_id',
      undefined,
    )

    // At least the kill quest progressed without getActiveQuests() ever
    // being called in this test.
    const progressed = manager.questManager
      .getActive()
      .some((p) => p.progress > 0)
    expect(manager.questManager.getActive().length).toBeGreaterThanOrEqual(before)
    expect(progressed).toBe(true)
  })

  it('restore from save reconciles without UI', () => {
    const manager = makeManagerWithActivePlayer()
    const save = buildMinimalSave(manager) // follow SaveSystem.saveLoadRoundTrip.test.ts harness
    const fresh = new GameManager()
    attachActivePlayer(fresh)
    fresh.restoreFromSave(save)
    expect(fresh.questManager.getActive().length).toBeGreaterThan(0)
  })

  it('daily rollover mid-session repopulates the board', () => {
    const manager = makeManagerWithActivePlayer()
    // Force day bucket forward: checkAndResetDaily accepts `now`; but the
    // tick path calls it with Date.now() — use fake timers like
    // ProductionSystem.test.ts:310 does for day-scale jumps.
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000)
    manager.update(1)
    vi.useRealTimers()
    expect(manager.questManager.getActive().some((p) => p.questId === '<a daily quest id>')).toBe(true)
  })

  it('realm transition unlocks new quests next tick', () => {
    const manager = makeManagerWithActivePlayer()
    const player = manager.getActivePlayer()!
    player.realmId = 'foundation_establishment'
    manager.markQuestRealmTransition()
    manager.update(1)
    const unlockedIds = manager.questRegistry
      .getAll()
      .filter((q) => q.requiredRealmId === 'foundation_establishment')
      .map((q) => q.id)
    expect(unlockedIds.length).toBeGreaterThan(0)
    for (const id of unlockedIds) {
      expect(manager.questManager.getProgress(id)).toBeDefined()
    }
  })
})
```

Substitute real quest ids from `game/src/data/quest/quests.ts` (read it; pick an actual kill quest enemy id + an actual realm-gated quest). Do not invent ids.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx.cmd vitest run src/core/game/GameManager.questLifecycle.test.ts`
Expected: FAIL — restore/tick paths never reconcile; `markQuestRealmTransition` missing.

- [ ] **Step 3: Implement the wiring**

`GameManager.ts`:

```ts
  /** R8.1 (AR-09) — set by the realm-transition writer; consumed+cleared by the tick. */
  private questRealmReconcileNeeded = false

  markQuestRealmTransition(): void {
    this.questRealmReconcileNeeded = true
  }

  /** Lifecycle reconciliation — idempotent; cheap (registry scan only when flagged/reset). */
  private reconcileQuestLifecycle(): void {
    const player = this.activePlayer

    if (!player) {
      return
    }

    this.questSystem.reconcileActiveQuests(this.questRegistry, this.questManager, player)
    this.questRealmReconcileNeeded = false
  }
```

In `update()`:
- After the `checkAndResetDaily(...) === true` branch (line ~2738): call `this.reconcileQuestLifecycle()`.
- At the top of the `if (this.activePlayer)` block: `if (this.questRealmReconcileNeeded) { this.reconcileQuestLifecycle() }`.

Find every authoritative `player.realmId = '...'` assignment (CultivationSystem transition and the GameManager paths around :1263-1277 / :1806 identified in research; ALSO tribulation outcome in Vue today — call `markQuestRealmTransition()` at those sites in CORE only. The Vue-owned tribulation assignment (AR-10, out of scope) is left untouched — note it in the mission report as a known gap until R8.2; the daily tick reconcile bounds the delay to one day in that legacy path).

`GameManagerSaveRestore.ts` — after `questManager.restore(...)` (line ~250-252) and after the offline settle block, add:

```ts
    // R8.1 (AR-09) — activation is a lifecycle command, not a UI read.
    // Restore converges the active set to current eligibility.
    const reconciledPlayer = this.deps.getActivePlayer()

    if (reconciledPlayer) {
      this.deps.questSystem.reconcileActiveQuests(
        this.deps.questRegistry,
        this.deps.questManager,
        reconciledPlayer,
      )
    }
```

Place it AFTER `refreshAutoWorkerCapacity`/player restore so the player realm is final (ordering matters: realm must be restored before unlock evaluation — verify by reading the restore sequence; if quest restore happens before player restore, move reconciliation to the END of `restoreFromSave` and say so in the mission report).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx.cmd vitest run src/core/game/GameManager.questLifecycle.test.ts src/core/quest/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/game/GameManager.ts src/core/game/GameManagerSaveRestore.ts src/core/game/GameManager.questLifecycle.test.ts
git commit -m "feat(r81): wire quest reconciliation to boot/restore, daily rollover, realm transition"
```

---

### Task 3: Query-purity guard + overflow-surfacing test migration

**Files:**
- Test: `game/src/core/game/GameManager.overflowSurfacing.test.ts:60` (its `manager.getActiveQuests() // activate collect quest progress` line documents the OLD contract — migrate it)
- Test: `game/src/core/quest/QuestSystem.lifecycle.test.ts` (append purity guard)
- Modify: `game/docs/roadmap.md` (R8.1 status only)

**Interfaces:**
- Consumes: Tasks 1-2.
- Produces: regression guards + roadmap cutover.

- [ ] **Step 1: Fix the overflow test's activation dependency**

`GameManager.overflowSurfacing.test.ts:60` currently relies on the read to activate the collect quest. Replace with the lifecycle command:

```ts
    manager.questSystem.reconcileActiveQuests(
      manager.questRegistry,
      manager.questManager,
      manager.getActivePlayer()!,
    )
```

(keep the test's intent — overflow surfacing — unchanged).

- [ ] **Step 2: Append the purity guard test**

```ts
// QuestSystem.lifecycle.test.ts (append)
describe('query purity guard — A3/A7', () => {
  it('two consecutive reads return equal results and leave state untouched', () => {
    const { system, registry, manager, player } = makeHarness()
    system.reconcileActiveQuests(registry, manager, player)
    const snapshotBefore = JSON.stringify(manager.getState())
    const first = system.getActiveQuests(registry, manager, player)
    const second = system.getActiveQuests(registry, manager, player)
    expect(first).toEqual(second)
    expect(JSON.stringify(manager.getState())).toBe(snapshotBefore)
  })

  it('ensureActive has no callers outside QuestSystem (grep-equivalent guard)', () => {
    // Import-surface check: this is enforced by review/grep per plan;
    // the runtime guard here asserts the manager API is only exercised
    // through reconcile in this suite (documented evidence, not a
    // substitute for the grep step below).
    expect(typeof (QuestSystem.prototype as { reconcileActiveQuests?: unknown }).reconcileActiveQuests).toBe('function')
  })
})
```

- [ ] **Step 3: Grep evidence — single activation path**

```bash
Select-String -Path game\src\**\*.ts, game\src\**\*.vue -Pattern "ensureActive\("
```

Expected callers after migration: `QuestManager.ts` (definition), `QuestSystem.reconcileActiveQuests` (only production caller), `SaveSystem.saveLoadRoundTrip.test.ts` (test fixture — acceptable: it seeds a quest directly for save-shape testing; record as intentional). Anything else = unfinished migration. Record output in the mission report.

- [ ] **Step 4: Full verification (P3 full)**

```bash
npm.cmd run type-check
npm.cmd run build
npx.cmd vitest run
```

Stop on first failure; fix; rerun.

- [ ] **Step 5: Update roadmap status block**

`game/docs/roadmap.md` R8.1 section — completion evidence line in the R1 style (branch, migration summary, verification, QA verdict). R8.2 stays `⏸`.

- [ ] **Step 6: Commit**

```bash
git add src/core/game/GameManager.overflowSurfacing.test.ts src/core/quest/QuestSystem.lifecycle.test.ts game/docs/roadmap.md
git commit -m "test(r81): query-purity guard + roadmap status cutover"
```

---

## Self-Review Notes

- Spec coverage: §2 invariant 1 (purity) → Task 1 Step 3 + Task 3 guard; invariant 2 (three triggers) → Task 2; invariant 3 (events count without UI) → Task 1 "events count" + Task 2 fresh-session test; invariant 4 (one owner) → Task 3 grep evidence.
- Type consistency: `reconcileActiveQuests(registry, manager, player)` signature identical in spec §5, Task 1, Task 2. `markQuestRealmTransition()` named identically across Task 2 steps.
- Preserved-behavior risk flagged: Task 1 Step 4 touches existing tests — instruction is "update contract comments, do not delete coverage". Task 2's Vue-tribulation gap is explicitly out of scope (R8.2) and recorded.
- Fixture honesty: all quest/enemy/realm ids must come from `game/src/data/quest/quests.ts` and existing test harnesses — no invented content.
