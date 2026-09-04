# Turn Battle System — Slice 7: Manual UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the player pause on their own turn, see 3 fixed skill slots (basic/special/ultimate) reflecting real turn-based readiness, tap one to cast it, and have the engine resume using that exact choice instead of its own auto-priority — while auto mode continues to never pause.

**Architecture:** Split `TurnBattleSystem.resolveNextStep()` into `peekNextActor()` (advances gauges, returns who's up, resolves nothing) and `resolveActorTurn()` (does everything else, optionally with a forced skill slot). `GameManager`'s fixed-step loop calls `peekNextActor()` first; if the player is up, manual mode is on, and no choice has been submitted yet, the loop stops and waits. `CombatSkillPresentation.ts` is rewritten against the real `TurnBattle`/`TurnBattleParticipant` shape (it currently reads an entirely different, real-time `Battle` shape and is 100% dead code against the live engine — confirmed by survey, see Task 4). The 3 path-specific Hud components (`KiemTuCombatHud.vue`, `PhapTuCombatHud.vue`, `MortalCombatHud.vue`) each render exactly 3 fixed `CombatSkillSlot` instances via a rewritten shared composable; `KiemTuCombatHud.vue` additionally sheds its legacy Ultimate button/channel-tick slider, which currently call into the retired real-time `battleSystem` and no longer do anything.

**Tech Stack:** Vue 3 + TypeScript, Pinia, Vitest.

**Spec:** [2026-09-04-turn-battle-system-slice7-manual-ui-design.md](../specs/2026-09-04-turn-battle-system-slice7-manual-ui-design.md)

## Global Constraints

- Không dùng `any` nếu không cần thiết (`game/CLAUDE.md`).
- Không thay đổi architecture ngoài phạm vi đã liệt kê trong plan này.
- Ưu tiên sửa code hiện tại thay vì viết lại toàn bộ file — trừ `CombatSkillPresentation.ts` (Task 4), nơi khảo sát xác nhận file hiện tại đọc 100% field không còn tồn tại trên `TurnBattle` (dead code chống lại engine sống), nên viết lại theo shape mới là đúng, không phải "viết lại cho vui".
- Targeting KHÔNG bao giờ do người chơi chọn — spec §4/§5 xác nhận rõ, không có bước nào trong plan này thêm target-picking UI.
- Chạy `npx vue-tsc --noEmit` sau MỖI task chạm code TypeScript sống.
- Channel skill manual casting, slider Nhịp Tụ Lực (bat_kiem) redesign — ngoài phạm vi (spec §5). Task 7 CHỈ gỡ bỏ control cũ đã chết (quyết định người dùng 2026-09-04, xem note dưới), không thiết kế control mới thay thế.
- **Quyết định người dùng (2026-09-04, lúc viết plan)**: `KiemTuCombatHud.vue`'s slider Nhịp Tụ Lực + nút Ult riêng (gọi `gameManager.battleSystem.tryPlayerUltimate()`/`setChannelTickSeconds()`/`ultAutoEnabled`, import `UltimateSystem.ts`'s `canUseUltimate`) đang gọi vào `battleSystem` real-time đã bị Slice 6 retire khỏi vòng lặp thật — **gỡ bỏ hẳn** trong Task 7, không giữ song song với 3 nút mới.

---

### Task 1: Split `resolveNextStep()` into `peekNextActor()` + `resolveActorTurn()`, thread forced-slot selection

**Files:**
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts` (the whole `resolveNextStep()` body, `TurnBattleSystem.ts:151-299`)
- Modify: `game/src/core/battle/turn/TurnSkillAction.ts` (`selectAction()`, `TurnSkillAction.ts:116-140ish`)
- Test: `game/src/core/battle/turn/TurnBattleSystem.slice7qa.test.ts` (new)

**Interfaces:**
- Consumes: current `resolveNextTurn()` (`TurnQueue.ts:23`), current `selectAction(participant)` (`TurnSkillAction.ts:116`), current `TurnBattleParticipant`/`TurnBattle`/`TurnStepResult` shapes (`TurnBattleSystem.ts:34-111`, unchanged by this task).
- Produces: `TurnBattleSystem.peekNextActor(battle: TurnBattle): TurnBattleParticipant | null`, `TurnBattleSystem.resolveActorTurn(battle: TurnBattle, actor: TurnBattleParticipant, forcedSlot?: 'basic' | 'special' | 'ultimate'): TurnStepResult`, `selectAction(participant: TurnBattleParticipant, forcedSlot?: 'basic' | 'special' | 'ultimate'): SelectedAction` — Task 2 (`GameManager`) calls both new `TurnBattleSystem` methods directly.

- [ ] **Step 1: Read the full current `resolveNextStep()` body fresh**

Read `game/src/core/battle/turn/TurnBattleSystem.ts:145-299` in full (already captured verbatim above in this plan's design notes, but re-read at execution time in case anything changed) — this is the exact logic Step 3/5 below split into two methods, unchanged in behavior for the no-forced-slot path.

- [ ] **Step 2: Write the failing tests for the split**

Create `game/src/core/battle/turn/TurnBattleSystem.slice7qa.test.ts`. Follow the existing fixture pattern used by `TurnBattleSystem.slice5qa.test.ts` (read that file first for the exact test-harness helpers — fixture `TurnBattleParticipant`/`TurnBattle` builders, `CombatSystem` stub — before writing these):

```ts
import { describe, expect, it } from 'vitest'
// import the same fixture builders TurnBattleSystem.slice5qa.test.ts uses

describe('TurnBattleSystem — peekNextActor/resolveActorTurn split', () => {
  it('peekNextActor returns the ready actor without resolving any action', () => {
    // Arrange a battle where player.speed >> enemy.speed (player up first).
    // Act: const actor = system.peekNextActor(battle)
    // Assert: actor === battle.player; battle.player.actionGauge advanced
    // (gauge mutation DID happen); enemy entity currentHp unchanged
    // (nothing was resolved); battle.totalTurnsElapsed unchanged (turn
    // count only increments in resolveActorTurn, per existing behavior at
    // TurnBattleSystem.ts:174).
  })

  it('peekNextActor returns null when no participant can act (mirrors resolveNextTurn returning undefined)', () => {
    // Arrange all participants dead. Assert peekNextActor(battle) === null.
  })

  it('resolveActorTurn resolves exactly the actor peekNextActor returned, auto-selecting by priority with no forcedSlot', () => {
    // Arrange a battle, actor = system.peekNextActor(battle)!.
    // Act: const result = system.resolveActorTurn(battle, actor)
    // Assert: same outcome resolveNextStep() would have produced in the
    // no-forced-slot case (reuse an existing Slice 2-5 assertion style —
    // e.g. targetIds non-empty, battle.totalTurnsElapsed incremented by 1).
  })

  it('resolveActorTurn honors a forcedSlot when that slot is ready', () => {
    // Arrange actor with both special (ready) and basic ready; ultimate on
    // cooldown. Act: resolveActorTurn(battle, actor, 'special').
    // Assert: result.skillId === actor.special!.skill.id (not the
    // auto-priority pick).
  })

  it('resolveActorTurn falls back to auto-priority when forcedSlot is not ready (defensive backstop, not an error)', () => {
    // Arrange actor.special with remainingCooldownTurns > 0.
    // Act: resolveActorTurn(battle, actor, 'special').
    // Assert: result.skillId is whatever auto-priority would have picked
    // (basic, or ultimate if ready) — NOT special, and no throw.
  })

  it('resolveNextStep() (thin wrapper) still produces identical behavior to before this task for every existing Slice 1-6 caller', () => {
    // Reuse one assertion from an existing Slice 5 test (e.g. wave spawn
    // triggering) verbatim against resolveNextStep() to prove the wrapper
    // didn't change observable behavior.
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run game/src/core/battle/turn/TurnBattleSystem.slice7qa.test.ts`
Expected: FAIL (`peekNextActor`/`resolveActorTurn` don't exist)

- [ ] **Step 4: Add `forcedSlot` support to `selectAction()`**

In `game/src/core/battle/turn/TurnSkillAction.ts`, change the signature and add the forced-slot branch BEFORE the existing priority checks:

```ts
export function selectAction(
  participant: TurnBattleParticipant,
  forcedSlot?: 'basic' | 'special' | 'ultimate',
): SelectedAction {
  if (forcedSlot === 'ultimate' && participant.ultimate &&
      participant.ultimate.remainingCooldownTurns === 0 &&
      hasResourceFor(participant.entity, participant.ultimate.skill)) {
    return slotAction(participant.ultimate)
  }

  if (forcedSlot === 'special' && participant.special &&
      participant.special.remainingCooldownTurns === 0 &&
      hasResourceFor(participant.entity, participant.special.skill)) {
    return slotAction(participant.special)
  }

  if (forcedSlot === 'basic' && participant.basic) {
    return { skillId: participant.basic.id, skill: participant.basic, damage: participant.basic.damage, targeting: participant.basic.targeting, slot: null }
  }

  // Existing auto-priority fallback (ultimate > special > basic) —
  // reached when forcedSlot is omitted, or the forced slot wasn't ready
  // (defensive backstop per spec §2, not an error).
  if (
    participant.ultimate &&
    participant.ultimate.remainingCooldownTurns === 0 &&
    hasResourceFor(participant.entity, participant.ultimate.skill)
  ) {
    return slotAction(participant.ultimate)
  }

  if (
    participant.special &&
    participant.special.remainingCooldownTurns === 0 &&
    hasResourceFor(participant.entity, participant.special.skill)
  ) {
    return slotAction(participant.special)
  }

  // ... existing basic fallback below, unchanged — read the current file
  // for its exact tail (basic-attack construction) before editing, this
  // plan only shows the new branches added above it.
}
```

Read the rest of the current `selectAction()` body (the basic-attack fallback tail) before editing, and keep it byte-identical below the new branches.

- [ ] **Step 5: Split `resolveNextStep()` in `TurnBattleSystem.ts`**

Replace the current `resolveNextStep()` method (`TurnBattleSystem.ts:151-299`) with:

```ts
  peekNextActor(battle: TurnBattle): TurnBattleParticipant | null {
    if (battle.state === 'countdown') {
      return null
    }

    const allParticipants = [battle.player, ...battle.enemies]

    for (const participant of allParticipants) {
      participant.alive = participant.entity.alive
    }

    const resolved = resolveNextTurn(allParticipants)

    if (!resolved) {
      battle.state = 'defeat'
      return null
    }

    return resolved.actor
  }

  resolveActorTurn(
    battle: TurnBattle,
    actor: TurnBattleParticipant,
    forcedSlot?: 'basic' | 'special' | 'ultimate',
  ): TurnStepResult {
    battle.totalTurnsElapsed = (battle.totalTurnsElapsed ?? 0) + 1

    const actorBuffSystem = new TurnBuffSystem(actor.buffs)

    // (unchanged from here on — copy the CC-check/tick/action-resolution
    // body verbatim from the current resolveNextStep(), TurnBattleSystem.ts
    // lines ~178-298, with exactly ONE change: `const action = selectAction(actor)`
    // becomes `const action = selectAction(actor, forcedSlot)`.)
  }

  resolveNextStep(battle: TurnBattle): TurnStepResult {
    if (battle.state === 'countdown') {
      return { state: 'countdown', actorId: '', skillId: '', targetIds: [], ccBlocked: false }
    }

    const actor = this.peekNextActor(battle)

    if (!actor) {
      return { state: 'defeat', actorId: '', skillId: '', targetIds: [], ccBlocked: false }
    }

    return this.resolveActorTurn(battle, actor)
  }
```

Copy the CC-check-through-return body from the CURRENT file (read it fresh per Step 1, not from this plan's earlier paraphrase) into `resolveActorTurn()` verbatim, changing only the `selectAction(actor)` call site to pass `forcedSlot`. Do not re-derive the CC/buff-tick/boss-trigger/damage-resolution logic from memory — copy it.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run game/src/core/battle/turn/TurnBattleSystem.slice7qa.test.ts`
Expected: PASS

- [ ] **Step 7: Run the full `turn/` suite to confirm no regression**

Run: `npx vitest run game/src/core/battle/turn`
Expected: PASS, same pass count as before this task (the wrapper must not change any existing Slice 1-6 test's outcome)

- [ ] **Step 8: Run typecheck**

Run: `npx vue-tsc --noEmit`
Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add game/src/core/battle/turn/TurnBattleSystem.ts game/src/core/battle/turn/TurnSkillAction.ts game/src/core/battle/turn/TurnBattleSystem.slice7qa.test.ts
git commit -m "feat(turn-combat): split resolveNextStep into peekNextActor/resolveActorTurn, thread forcedSlot"
```

---

### Task 2: `GameManager` manual-mode pause loop

**Files:**
- Modify: `game/src/core/game/GameManager.ts` (`updateBattleFixedStep`, `GameManager.ts:3072-3095`)
- Test: `game/src/core/game/GameManager.manualCombat.test.ts` (new)

**Interfaces:**
- Consumes: `TurnBattleSystem.peekNextActor`/`resolveActorTurn` (Task 1), `ui.combatInputMode` (Task 3 — read this task's Step 1 before writing, since Task 2 and Task 3 both touch the same pause condition; if executing in order, Task 3 must land first, or stub the read here and wire it properly once Task 3 exists — prefer doing Task 3 BEFORE Task 2 if a fresh read of this plan happens out of order, since Task 2 depends on it).
- Produces: `GameManager.submitPlayerSkillChoice(slot: 'basic' | 'special' | 'ultimate'): void`, a private `pendingPlayerChoice: 'basic' | 'special' | 'ultimate' | null` field, `GameManager.isWaitingForPlayerChoice(): boolean` (read by UI to know whether to show tappable slots).

- [ ] **Step 1: Write the failing tests**

Create `game/src/core/game/GameManager.manualCombat.test.ts`. Read `game/src/core/game/GameManager.zone.test.ts` first for the harness pattern (already used in the auto-farm plan's tasks — same convention applies here).

```ts
import { describe, expect, it } from 'vitest'

describe('GameManager — manual combat pause', () => {
  it('does not resolve the player turn while manual mode is on and no choice submitted', () => {
    // Arrange a harness with an active TurnBattle, player up next
    // (player.speed >> enemy.speed), ui.combatInputMode = 'manual'.
    // Act: gameManager.tick(some deltaSeconds spanning several fixed steps).
    // Assert: gameManager.isWaitingForPlayerChoice() === true; the
    // player's entity currentHp/enemy currentHp are unchanged (nothing
    // resolved); battle.state stays 'fighting'.
  })

  it('resolves the player turn once a choice is submitted, using that exact slot', () => {
    // Continue from the paused state above.
    // Act: gameManager.submitPlayerSkillChoice('special'); then tick again.
    // Assert: the resolved skillId matches the player's special skill;
    // isWaitingForPlayerChoice() returns to false; loop continues (enemy
    // turns proceed normally afterward within the same tick if gauge allows).
  })

  it('never pauses when combatInputMode is auto, even on the player\'s turn', () => {
    // ui.combatInputMode = 'auto'. Act: tick(). Assert: player's turn
    // resolved automatically (auto-priority), isWaitingForPlayerChoice() === false throughout.
  })

  it('never pauses for enemy turns regardless of mode', () => {
    // Arrange enemy up next (enemy.speed >> player.speed), manual mode on.
    // Assert enemy turn resolves without any pause/wait state.
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run game/src/core/game/GameManager.manualCombat.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement the pause loop**

In `GameManager.ts`, replace the `else if (this.turnBattle.state === 'fighting')` branch inside `updateBattleFixedStep` (`GameManager.ts:3086-3088`):

```ts
        } else if (this.turnBattle.state === 'fighting') {
          const actor = this.turnBattleSystem.peekNextActor(this.turnBattle)

          if (actor) {
            const isPlayerManualPause =
              actor === this.turnBattle.player &&
              this.ui.combatInputMode === 'manual' &&
              this.pendingPlayerChoice === null

            if (!isPlayerManualPause) {
              const forcedSlot = actor === this.turnBattle.player ? this.pendingPlayerChoice ?? undefined : undefined

              this.turnBattleSystem.resolveActorTurn(this.turnBattle, actor, forcedSlot)

              if (actor === this.turnBattle.player) {
                this.pendingPlayerChoice = null
              }
            }
          }
        }
```

Adjust `this.ui.combatInputMode` to whatever access pattern `GameManager.ts` actually uses to reach the ui store (it may not have a direct store reference — `GameManager` is a plain class per its own doc comment seen earlier this session, "GameManager là plain class, không phải Vue reactive state" — so it likely does NOT import the Pinia `ui` store directly. Read `GameManager.ts`'s constructor/top-of-class fields first to see how it receives caller-supplied flags today, e.g. compare to how `repeatContinuously` is passed as a parameter into `startStage()` rather than read from a store — the manual/auto mode is more likely threaded the same way: a method parameter or a settable field, not a direct store import. Match whichever pattern `repeatContinuously`/`activeStageForTurnBattle` already use, since `GameManager` plain-class architecture must not gain a new Pinia dependency).

Add the supporting fields/methods:

```ts
  private pendingPlayerChoice: 'basic' | 'special' | 'ultimate' | null = null

  // Set by the composable/UI layer, mirroring how other combat-adjacent
  // flags reach GameManager (see the pattern used for repeatContinuously
  // in startStage() — confirm exact convention before finalizing this
  // field's setter shape).
  combatInputMode: 'manual' | 'auto' = 'auto'

  submitPlayerSkillChoice(slot: 'basic' | 'special' | 'ultimate'): void {
    this.pendingPlayerChoice = slot
  }

  isWaitingForPlayerChoice(): boolean {
    if (!this.turnBattle || this.turnBattle.state !== 'fighting') {
      return false
    }

    const actor = this.turnBattleSystem.peekNextActor(this.turnBattle)

    return actor === this.turnBattle.player && this.combatInputMode === 'manual' && this.pendingPlayerChoice === null
  }
```

Note: calling `peekNextActor()` again inside `isWaitingForPlayerChoice()` re-runs the same gauge-advancement mutation `updateBattleFixedStep` already ran this tick — that is INCORRECT (gauge would double-advance). Before finalizing, read `resolveNextTurn()`'s exact mutation (`TurnQueue.ts:23-50`) to confirm whether calling `peekNextActor` twice in the same tick is idempotent or not; if not idempotent (likely, since it advances `actionGauge` each call), `isWaitingForPlayerChoice()` must instead read a CACHED result from the `updateBattleFixedStep` call (e.g. store the last `peekNextActor()` result in a field, `this.pendingActor: TurnBattleParticipant | null`, set inside `updateBattleFixedStep`, read by `isWaitingForPlayerChoice()`) rather than recomputing it — fix this before writing Step 1's tests to green, this is a correctness bug if left as shown above, not a placeholder to skip.

- [ ] **Step 4: Fix the double-peek bug found in Step 3**

Add `private pendingActor: TurnBattleParticipant | null = null`, set it inside `updateBattleFixedStep` right after calling `peekNextActor()`, clear it to `null` once `resolveActorTurn()` actually runs for that actor (same tick or a later one), and change `isWaitingForPlayerChoice()` to read `this.pendingActor` instead of calling `peekNextActor()` again. Re-derive the exact field-clearing points so `pendingActor` never goes stale across ticks (cleared exactly when `resolveActorTurn` consumes it, set exactly when a fresh `peekNextActor` finds a new ready actor).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run game/src/core/game/GameManager.manualCombat.test.ts`
Expected: PASS

- [ ] **Step 6: Run the full `battle/`+`game/` suites to confirm no regression**

Run: `npx vitest run game/src/core/battle game/src/core/game`
Expected: PASS, no regressions in existing auto-mode/repeat/progress tests

- [ ] **Step 7: Run typecheck**

Run: `npx vue-tsc --noEmit`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add game/src/core/game/GameManager.ts game/src/core/game/GameManager.manualCombat.test.ts
git commit -m "feat(turn-combat): GameManager pauses on player's turn in manual mode, resumes on submitted choice"
```

---

### Task 3: `combatInputMode` (manual/auto) UI flag

**Files:**
- Modify: `game/src/stores/ui.ts` (near `BattleRunMode`, `ui.ts:78`)
- Modify: `game/src/stores/uiFlagsPersistence.ts`

**Interfaces:**
- Produces: `ui.combatInputMode: 'manual' | 'auto'` (Pinia store field, default `'auto'`), persisted the same device-local way `battleRunMode` is (NOT save-schema — `uiFlagsPersistence.ts`'s existing doc comment explains why: per-device convenience, not character progression).
- Consumes: nothing new.

This is a SEPARATE axis from `battleRunMode` (`'manual' | 'repeat' | 'progress'`, which governs stage-boundary auto-refight/auto-progress behavior — unrelated to whether the player pauses mid-battle on their own turn). Do not conflate the two or reuse the `'manual'` string value's meaning across both.

- [ ] **Step 1: Read `ui.ts`'s existing `battleRunMode` field + setter for the exact pattern to mirror**

Read `game/src/stores/ui.ts` around line 78 and its setter near line 322 (seen in an earlier survey this session) in full before writing the new field, to match the store's existing getter/setter/persistence-hook style exactly.

- [ ] **Step 2: Add the field to the `ui` store**

Add `combatInputMode: 'manual' | 'auto'` state (default `'auto'`) to `game/src/stores/ui.ts`, following the exact same pattern `battleRunMode` uses (including whatever persistence-save-on-change hook `setBattleRunMode` calls, mirrored for a new `setCombatInputMode`).

- [ ] **Step 3: Extend `uiFlagsPersistence.ts`**

Add `combatInputMode` to `UiAutomationFlagSnapshot`, add an `isCombatInputMode` type guard mirroring `isBattleRunMode`, and load/save it alongside `battleRunMode` in `loadPersistedUiAutomationFlags`/`savePersistedUiAutomationFlags`.

- [ ] **Step 4: Run typecheck**

Run: `npx vue-tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Run existing ui store tests**

Run: `npx vitest run game/src/stores/ui`
Expected: PASS (check first whether `ui.ts` or `uiFlagsPersistence.ts` already has test files — if `uiFlagsPersistence.test.ts` exists, extend it with a round-trip test for `combatInputMode`; if it doesn't exist, do not create one just for this — matches this codebase's existing test coverage for `battleRunMode`, whatever that is)

- [ ] **Step 6: Commit**

```bash
git add game/src/stores/ui.ts game/src/stores/uiFlagsPersistence.ts
git commit -m "feat(ui): add combatInputMode (manual/auto) flag, separate from battleRunMode"
```

---

### Task 4: `CombatSkillPresentation.ts` turn-based rewrite

**Files:**
- Modify: `game/src/core/combat/CombatSkillPresentation.ts` (full rewrite — confirmed dead code against the live `TurnBattle` shape, see survey note below)
- Test: `game/src/core/combat/CombatSkillPresentation.test.ts` (full rewrite of its 6 existing tests, all currently failing — confirmed by this session's status check before this plan was written)

**Interfaces:**
- Consumes: `TurnBattle`/`TurnBattleParticipant`/`TurnSkillSlot`/`TurnSkillDefinition` (existing, `TurnBattleSystem.ts`/`TurnSkillAction.ts`), `GameManager.isWaitingForPlayerChoice()` (Task 2), `ui.combatInputMode` (Task 3).
- Produces: a new exported function replacing `buildLoadoutPresentation` — `buildTurnSkillPresentation(battle: TurnBattle, isPlayerTurnPaused: boolean): { basic: TurnSkillPresentationEntry; special: TurnSkillPresentationEntry; ultimate: TurnSkillPresentationEntry }`, and a new `TurnSkillPresentationStateKind = 'ready' | 'not_your_turn' | 'cooldown' | 'blocked_resource' | 'locked' | 'empty'` (per spec §4). Task 5's composable is the sole consumer.

**Survey note (grounding this task — confirmed 2026-09-04)**: the CURRENT `CombatSkillPresentation.ts` imports `Battle` from `../battle/Battle` (the real-time shape) and reads `battle.player.currentMp`/`.currentSwordIntent`/`.currentMomentum`/`.skillCadenceRemainingBySlot`/`.castingSkillId`/`.castTimeRemaining`/`.playerMaterialized`/`.stats.speed` directly off `battle.player` — none of these exist on `TurnBattleParticipant` (which only has `.entity: CombatEntity`, `.basic`/`.special`/`.ultimate`, `.actionGauge`, `.buffs`, etc.). It also calls `skillManager.getEquippedInSlot(slotIndex)` against the OLD N-slot loadout system Slice 2 already replaced with the 3-fixed-role model. This file has been producing garbage (or crashing, per the `CombatSkillPresentation.test.ts` 6/6 failures already observed) since Slice 6's cutover — this task is a real fix, not a style rewrite.

- [ ] **Step 1: Write the failing tests (full replacement of the existing test file)**

Rewrite `game/src/core/combat/CombatSkillPresentation.test.ts` from scratch against the new function. Read `game/src/core/battle/turn/TurnBattleSystem.slice2qa.test.ts` (or equivalent Slice 2 test file) first for the exact `TurnBattleParticipant`/`TurnSkillSlot`/`TurnSkillDefinition` fixture-building pattern used elsewhere in this codebase, then:

```ts
import { describe, expect, it } from 'vitest'
import { buildTurnSkillPresentation } from './CombatSkillPresentation'
// import the same TurnBattle/TurnBattleParticipant fixture builders used
// by TurnBattleSystem's own Slice 2+ tests

describe('buildTurnSkillPresentation', () => {
  it('basic is always ready (no cooldown, no resource gate) when it is the player\'s paused turn', () => {
    // Arrange a fixture TurnBattle with battle.player.basic set.
    // Act: buildTurnSkillPresentation(battle, true)
    // Assert: result.basic.state === 'ready'
  })

  it('special/ultimate report cooldown state with remainingCooldownTurns as an integer turn count, not seconds', () => {
    // Arrange battle.player.special.remainingCooldownTurns = 3.
    // Assert: result.special.state === 'cooldown'; result.special.cooldownRemaining === 3.
  })

  it('special/ultimate report blocked_resource when resource insufficient', () => {
    // Arrange battle.player.special.skill.resourceCost > entity's current resource value.
    // Assert: result.special.state === 'blocked_resource'.
  })

  it('a slot the participant does not have at all reports empty', () => {
    // Arrange battle.player.ultimate === undefined.
    // Assert: result.ultimate.state === 'empty'.
  })

  it('every slot reports not_your_turn when isPlayerTurnPaused is false, even if otherwise ready', () => {
    // Act: buildTurnSkillPresentation(battle, false)
    // Assert: result.basic.state === 'not_your_turn' (and special/ultimate too, if defined and otherwise ready).
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run game/src/core/combat/CombatSkillPresentation.test.ts`
Expected: FAIL (`buildTurnSkillPresentation` doesn't exist)

- [ ] **Step 3: Rewrite `CombatSkillPresentation.ts`**

Replace the entire file content with:

```ts
import type { TurnBattle, TurnBattleParticipant, TurnSkillSlot } from '../battle/turn/TurnBattleSystem'
import type { TurnSkillDefinition } from '../battle/turn/TurnSkillAction'
import { hasResourceFor } from '../battle/turn/TurnSkillAction'

export type TurnSkillPresentationStateKind =
  | 'ready'
  | 'not_your_turn'
  | 'cooldown'
  | 'blocked_resource'
  | 'locked'
  | 'empty'

export interface TurnSkillPresentationEntry {
  skillId: string
  cooldownRemaining: number
  cooldownTotal: number
  resourceCost: number
  state: TurnSkillPresentationStateKind
}

const EMPTY_ENTRY: TurnSkillPresentationEntry = {
  skillId: '',
  cooldownRemaining: 0,
  cooldownTotal: 0,
  resourceCost: 0,
  state: 'empty',
}

function basicEntry(basic: TurnSkillDefinition | undefined, isPlayerTurnPaused: boolean, entity: TurnBattleParticipant['entity']): TurnSkillPresentationEntry {
  if (!basic) {
    return EMPTY_ENTRY
  }

  if (!isPlayerTurnPaused) {
    return { skillId: basic.id, cooldownRemaining: 0, cooldownTotal: 0, resourceCost: basic.resourceCost ?? 0, state: 'not_your_turn' }
  }

  return { skillId: basic.id, cooldownRemaining: 0, cooldownTotal: 0, resourceCost: basic.resourceCost ?? 0, state: 'ready' }
}

function slotEntry(slot: TurnSkillSlot | undefined, isPlayerTurnPaused: boolean, entity: TurnBattleParticipant['entity']): TurnSkillPresentationEntry {
  if (!slot) {
    return EMPTY_ENTRY
  }

  const cooldownTotal = slot.skill.cooldownTurns
  const cooldownRemaining = slot.remainingCooldownTurns
  const resourceCost = slot.skill.resourceCost ?? 0

  if (!isPlayerTurnPaused) {
    return { skillId: slot.skill.id, cooldownRemaining, cooldownTotal, resourceCost, state: 'not_your_turn' }
  }

  if (cooldownRemaining > 0) {
    return { skillId: slot.skill.id, cooldownRemaining, cooldownTotal, resourceCost, state: 'cooldown' }
  }

  if (!hasResourceFor(entity, slot.skill)) {
    return { skillId: slot.skill.id, cooldownRemaining, cooldownTotal, resourceCost, state: 'blocked_resource' }
  }

  return { skillId: slot.skill.id, cooldownRemaining, cooldownTotal, resourceCost, state: 'ready' }
}

/**
 * Turn-based replacement for the retired N-slot `buildLoadoutPresentation`
 * (Slice 2 already replaced the loadout model with 3 fixed roles — this
 * file just hadn't caught up until Slice 7). `isPlayerTurnPaused` comes
 * from `GameManager.isWaitingForPlayerChoice()` — true only when it is
 * currently the player's turn, manual mode is on, and no choice has been
 * submitted yet.
 */
export function buildTurnSkillPresentation(
  battle: TurnBattle,
  isPlayerTurnPaused: boolean,
): { basic: TurnSkillPresentationEntry; special: TurnSkillPresentationEntry; ultimate: TurnSkillPresentationEntry } {
  const player = battle.player

  return {
    basic: basicEntry(player.basic, isPlayerTurnPaused, player.entity),
    special: slotEntry(player.special, isPlayerTurnPaused, player.entity),
    ultimate: slotEntry(player.ultimate, isPlayerTurnPaused, player.entity),
  }
}
```

Note: `'locked'` (in the state union) has no producer above — per spec §5's scope, there is no per-realm slot-unlock concept left in the 3-fixed-role model (unlike the old N-slot loadout's `unlockedSlotCount` gate) — keep the state in the union for forward-compat (a future "ultimate not yet learned" case might use it) but do not force a fake `'locked'` branch into this task; leave `'empty'` covering "slot doesn't exist for this participant" as the only not-ready-content state, matching what's actually representable today.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run game/src/core/combat/CombatSkillPresentation.test.ts`
Expected: PASS

- [ ] **Step 5: Run typecheck**

Run: `npx vue-tsc --noEmit`
Expected: no errors (this will surface every consumer of the old `buildLoadoutPresentation`/`CombatSkillPresentationState` — Task 5 fixes the one known consumer, `useCombatSkillPresentation.ts`; if typecheck finds others, read them and note in this task's commit message rather than silently leaving them broken)

- [ ] **Step 6: Commit**

```bash
git add game/src/core/combat/CombatSkillPresentation.ts game/src/core/combat/CombatSkillPresentation.test.ts
git commit -m "fix(turn-combat): rewrite CombatSkillPresentation against real TurnBattle shape (was dead code since Slice 6 cutover)"
```

---

### Task 5: `useCombatSkillPresentation.ts` composable rewrite

**Files:**
- Modify: `game/src/composables/useCombatSkillPresentation.ts` (full rewrite)

**Interfaces:**
- Consumes: `buildTurnSkillPresentation` (Task 4), `GameManager.getTurnBattle()` (existing, `GameManager.ts:2469-2471` per earlier survey this session), `GameManager.isWaitingForPlayerChoice()`/`submitPlayerSkillChoice()` (Task 2).
- Produces: `useCombatSkillPresentation()` returning `{ basic, special, ultimate, isPlayerTurnPaused, chooseSkill(slot) }` — Task 6/7/8 (Hud components) are the consumers.

- [ ] **Step 1: Rewrite the composable**

```ts
import { computed } from 'vue'
import { useGameManager, useStateVersion } from './useGameState'
import { buildTurnSkillPresentation } from '@/core/combat/CombatSkillPresentation'

export function useCombatSkillPresentation() {
  const gameManager = useGameManager()
  const { stateVersion } = useStateVersion()

  const isPlayerTurnPaused = computed(() => {
    stateVersion.value

    return gameManager.isWaitingForPlayerChoice()
  })

  const presentation = computed(() => {
    stateVersion.value

    const battle = gameManager.getTurnBattle()

    if (!battle) {
      return null
    }

    return buildTurnSkillPresentation(battle, isPlayerTurnPaused.value)
  })

  const basic = computed(() => presentation.value?.basic ?? null)
  const special = computed(() => presentation.value?.special ?? null)
  const ultimate = computed(() => presentation.value?.ultimate ?? null)

  function chooseSkill(slot: 'basic' | 'special' | 'ultimate') {
    if (!isPlayerTurnPaused.value) {
      return
    }

    gameManager.submitPlayerSkillChoice(slot)
  }

  return { basic, special, ultimate, isPlayerTurnPaused, chooseSkill }
}
```

Drop `batKiemTickSeconds`/`tuLucState`/`skillFor`/`unlockedSlotCount`/`loadout` entirely — confirmed no longer meaningful (channel-tick UI removed per Task 7's decision; `skillFor` looked up `skillManager` by id from the old loadout model, no longer applicable since `TurnSkillDefinition` isn't a live `Skill` object — Hud components read `skillId`/state directly from the new entries, no separate skill lookup needed for now; a display NAME for each skill is deferred, matching this rework's standing "content mapping is separate from mechanism" pattern — note this explicitly in Task 7/8's commit as a known display gap, not silently dropped).

- [ ] **Step 2: Run typecheck to find every consumer that breaks**

Run: `npx vue-tsc --noEmit`
Expected: compile errors in `KiemTuCombatHud.vue`/`PhapTuCombatHud.vue`/`MortalCombatHud.vue` (all 3 currently destructure `{ loadout, skillFor, tuLucState }`) — these are fixed by Task 7/8, not this task. Confirm no OTHER file imports this composable before moving on (the earlier survey found exactly these 3 as the only 6 call sites of `CombatSkillSlot`/this composable — re-verify with a fresh grep if uncertain).

- [ ] **Step 3: Commit**

```bash
git add game/src/composables/useCombatSkillPresentation.ts
git commit -m "feat(turn-combat): rewrite useCombatSkillPresentation for 3 fixed skill roles, drop dead channel-tick state"
```

(This task intentionally leaves the 3 Hud components broken at compile time until Task 7/8 — commit anyway, matching this rework's established big-bang pattern for multi-file cutovers seen in prior slices; do NOT skip typecheck between tasks, just expect and note the failure here rather than treating it as this task's bug.)

---

### Task 6: `CombatSkillSlot.vue` click handler

**Files:**
- Modify: `game/src/components/game/combat/hud/CombatSkillSlot.vue`

**Interfaces:**
- Produces: a new `click` emit, fired only when the slot is tappable (per spec §4: currently the player's paused turn, manual mode on, and the skill is ready).

- [ ] **Step 1: Add a `disabled` prop + `click` emit**

Read the current file fully (already shown verbatim earlier this session — no changes since) before editing. Add:

```ts
const props = withDefaults(defineProps<{
  // ...existing props unchanged...
  isTappable?: boolean
}>(), {
  // ...existing defaults unchanged...
  isTappable: false,
})

const emit = defineEmits<{ click: [] }>()

function onClick() {
  if (props.isTappable) {
    emit('click')
  }
}
```

Wire `@click="onClick"` and a `role="button"`/`tabindex="0"` (keyboard accessibility, matching this codebase's existing interactive-element conventions — check a sibling clickable component like `RadialSkillSelector.vue` for the exact pattern used) onto the root `.combat-skill-slot` div, and add an `is-tappable` class for a visual affordance (cursor/hover state) gated on `props.isTappable`.

- [ ] **Step 2: Manual smoke test deferred to Task 9** (this component has no dedicated test file today per the earlier survey — `⚠️ no covering tests found` — do not introduce one just for a click-emit wrapper; the meaningful behavior is exercised end-to-end once Task 7/8 wire it into a real Hud, verified there)

- [ ] **Step 3: Run typecheck**

Run: `npx vue-tsc --noEmit`
Expected: no NEW errors introduced by this file (the 3 Hud compile errors from Task 5 are pre-existing at this point, not caused by this task)

- [ ] **Step 4: Commit**

```bash
git add game/src/components/game/combat/hud/CombatSkillSlot.vue
git commit -m "feat(ui): add tappable click handler to CombatSkillSlot.vue (was presentational-only by design until now)"
```

---

### Task 7: `KiemTuCombatHud.vue` — remove legacy Ult/channel UI, wire 3 fixed slots

**Files:**
- Modify: `game/src/components/game/combat/hud/KiemTuCombatHud.vue` (full script rewrite — the current script is built entirely around the retired real-time `battleSystem`/`UltimateSystem.ts`/old loadout model, per this plan's opening survey note)

**Interfaces:**
- Consumes: `useCombatSkillPresentation()` (Task 5), `CombatSkillSlot.vue`'s new `isTappable`/`click` (Task 6).

- [ ] **Step 1: Read the full current file (script + template) fresh**

The script's first ~140 lines and part of the template were captured in this plan's grounding survey — read the FULL file (including the template tail not shown in that survey, and the `<style>` block) before editing, since this task removes several template sections (slider, Ult button) and their CSS needs matching cleanup, not just script changes.

- [ ] **Step 2: Remove legacy Ultimate/channel-tick code**

Remove: `onMounted` hook (lines 60-66, sets `batKiemTickSeconds`/`setChannelTickSeconds`), `onTuLucTickInput`, `ultAutoEnabled`, `ultInfo`, `canFireUlt`, `fireUltimate`, `getSwordCountForBattle`, `tuLucPercent`, `cadenceRemaining`/`useCadenceSmoothing` import, `canUseUltimate` import from `UltimateSystem.ts`, `getFormationSwordCount` import (confirm nothing else in this file still needs it before removing), `primary` computed (based on the old `loadout` array). Remove the corresponding template markup (slider input, Ult `GameButton`, `tuLucPercent` progress bar) and any now-orphaned CSS classes in `<style scoped>`.

- [ ] **Step 3: Wire the 3 fixed slots**

```ts
import { useCombatSkillPresentation } from '@/composables/useCombatSkillPresentation'

const { basic, special, ultimate, chooseSkill } = useCombatSkillPresentation()
```

Template (replace whatever remains of the old skill-slot markup):

```html
<div class="kiem-tu-combat-hud__row">
  <CombatSkillSlot
    v-if="basic"
    :skill-id="basic.skillId"
    :remaining="basic.cooldownRemaining"
    :total="basic.cooldownTotal"
    :resource-cost="basic.resourceCost"
    :is-tappable="basic.state === 'ready'"
    @click="chooseSkill('basic')"
  />
  <CombatSkillSlot
    v-if="special && special.skillId"
    :remaining="special.cooldownRemaining"
    :total="special.cooldownTotal"
    :resource-cost="special.resourceCost"
    :is-masked="special.state === 'cooldown'"
    :is-insufficient-resource="special.state === 'blocked_resource'"
    :is-tappable="special.state === 'ready'"
    @click="chooseSkill('special')"
  />
  <CombatSkillSlot
    v-if="ultimate && ultimate.skillId"
    :remaining="ultimate.cooldownRemaining"
    :total="ultimate.cooldownTotal"
    :resource-cost="ultimate.resourceCost"
    :is-masked="ultimate.state === 'cooldown'"
    :is-insufficient-resource="ultimate.state === 'blocked_resource'"
    :is-tappable="ultimate.state === 'ready'"
    @click="chooseSkill('ultimate')"
  />
</div>
```

Note: `CombatSkillSlot.vue`'s existing `skill?: Skill` prop expects a live `Skill` object (for name/description tooltip) — Task 5 dropped `skillFor()` (the old lookup), so this task has no `Skill` object to pass. Add a plain `label`/`skillId` fallback display for now (e.g. pass `:empty-label="basic.skillId"` so SOMETHING renders instead of a blank slot) and note in this task's commit message that real skill name/icon/tooltip display is a follow-up content-wiring gap, not silently dropped — matches this rework's standing pattern of separating mechanism from content display.

- [ ] **Step 4: Run typecheck**

Run: `npx vue-tsc --noEmit`
Expected: no errors for THIS file (2 of the 3 pre-existing Hud errors from Task 5 remain until Task 8)

- [ ] **Step 5: Manual smoke test**

Run the dev server, start a Kiếm Tu stage battle in manual mode, confirm: no crash, no dangling Ult button/slider, 3 slots render, tapping a ready slot on the player's paused turn advances combat using that skill (verify via battle log/HP change), enemy turns proceed without any pause.

- [ ] **Step 6: Commit**

```bash
git add game/src/components/game/combat/hud/KiemTuCombatHud.vue
git commit -m "feat(ui): KiemTuCombatHud - remove dead Ult/channel-tick controls, wire 3 fixed tap-to-cast slots"
```

---

### Task 8: `PhapTuCombatHud.vue` + `MortalCombatHud.vue` — wire 3 fixed slots

**Files:**
- Modify: `game/src/components/game/combat/hud/PhapTuCombatHud.vue`
- Modify: `game/src/components/game/combat/hud/MortalCombatHud.vue`

**Interfaces:**
- Consumes: same as Task 7.

- [ ] **Step 1: Read both files fully**

Neither file's template/script was fully captured by this plan's grounding survey (only confirmed they both render `CombatSkillSlot` and, for `PhapTuCombatHud.vue`, also `ArtifactCombatSlot`). Read both completely before editing — they may or may not carry the same kind of legacy real-time cruft `KiemTuCombatHud.vue` had; do not assume, verify.

- [ ] **Step 2: Wire the 3 fixed slots in each, same pattern as Task 7 Step 3**

Apply the same `useCombatSkillPresentation()` wiring and 3-slot template block from Task 7 to each file, preserving each file's own path-specific extras untouched (`ArtifactCombatSlot` in `PhapTuCombatHud.vue`, whatever `MortalCombatHud.vue` has beyond skill slots). If either file has its OWN legacy real-time cruft analogous to Kiếm Tu's Ult button/slider (only discoverable by Step 1's fresh read), remove it the same way Task 7 did, and note it explicitly in this task's commit message.

- [ ] **Step 3: Run typecheck**

Run: `npx vue-tsc --noEmit`
Expected: no errors anywhere (all 3 Hud compile errors from Task 5 now resolved)

- [ ] **Step 4: Manual smoke test**

Repeat Task 7 Step 5's smoke test for a Pháp Tu build and a Phàm Nhân (mortal) build.

- [ ] **Step 5: Commit**

```bash
git add game/src/components/game/combat/hud/PhapTuCombatHud.vue game/src/components/game/combat/hud/MortalCombatHud.vue
git commit -m "feat(ui): PhapTuCombatHud/MortalCombatHud - wire 3 fixed tap-to-cast slots"
```

---

### Task 9: Manual/auto mode toggle control

**Files:**
- Modify: whichever shared combat HUD chrome component already renders alongside all 3 path Huds (check `CombatBuildHud.vue`, the confirmed common parent of `PhapTuCombatHud.vue`/`MortalCombatHud.vue` per this plan's survey — read it first to find the right insertion point and confirm whether `KiemTuCombatHud.vue` shares the same parent or is mounted separately)

**Interfaces:**
- Consumes: `ui.combatInputMode`/setter (Task 3).

- [ ] **Step 1: Read `CombatBuildHud.vue` (and confirm `KiemTuCombatHud.vue`'s actual parent/mount point — it may differ, this plan's survey didn't confirm)**

- [ ] **Step 2: Add a simple 2-state toggle (reuse the existing `Chip`/`GameButton` component pattern already used elsewhere in this codebase for similar binary UI choices, e.g. `StageSelectPanel.vue`'s mode chips)**

```html
<div class="combat-input-mode-toggle">
  <Chip :active="ui.combatInputMode === 'auto'" @click="ui.setCombatInputMode('auto')">Tự Động</Chip>
  <Chip :active="ui.combatInputMode === 'manual'" @click="ui.setCombatInputMode('manual')">Thủ Công</Chip>
</div>
```

Place it wherever this shared chrome component's existing layout has room (exact position not designed here per spec §5 — functional requirement only); add minimal scoped CSS matching this component's existing style conventions.

- [ ] **Step 3: Manual smoke test**

Toggle to manual mid-battle, confirm the pause-on-player-turn behavior from Task 7/8's smoke tests actually engages; toggle back to auto mid-pause, confirm the paused turn resolves automatically without requiring a tap (per spec §3: "Auto mode never pauses regardless of whose turn it is").

- [ ] **Step 4: Run typecheck**

Run: `npx vue-tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add game/src/components/game/combat/hud/CombatBuildHud.vue
git commit -m "feat(ui): add manual/auto combat input mode toggle"
```

---

### Task 10: Full-suite verification + roadmap update

**Files:** none (verification), then `game/docs/turn-based-combat-roadmap.md`

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS. In particular, confirm `CombatSkillPresentation.test.ts`'s previously-failing 6 tests (found in this session's status check before this plan was written) now pass, and the previously-noted `PillSystem.profession.test.ts` `battle.player.stats.hpRegenPerTurn` failure — check whether it's now ALSO fixed as a side effect of this task's changes; if not, it remains a separate known gap (the `GameManager.getBattle()` shim casting `TurnBattle as unknown as Battle` still lacks a `.stats` field alias) — note its status in the roadmap update below, don't silently fix or silently ignore it.

- [ ] **Step 2: Run full typecheck**

Run: `npx vue-tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Update `game/docs/turn-based-combat-roadmap.md`'s Slice 7 row**

Change the Slice 7 row's status from "🟡 Design xong 2026-09-04, chờ Slice 6 merge mới viết plan" to "🟢 Xong" with the merge/commit reference, and link this plan file. Also update the roadmap's "Manual tap-to-cast UI" row (currently "🟢 Khảo sát xong, sẵn sàng cho khi TurnBattleSystem có skill loadout — cố ý CHƯA thiết kế giải pháp") to reflect it's now implemented, not just surveyed. Add a note under Slice 7 documenting the `PillSystem.profession.test.ts` `.stats` shim gap's final status per Step 1.

- [ ] **Step 4: Commit**

```bash
git add game/docs/turn-based-combat-roadmap.md
git commit -m "docs: roadmap - Slice 7 (Manual UI) implemented + merged, final BattleSystem Replacement slice done"
```

## Self-Review Notes (for the plan writer, kept for traceability)

- **Spec coverage**: §2 (split) → Task 1. §3 (GameManager loop) → Task 2 (with a real correctness bug — double gauge-advance from calling `peekNextActor()` twice per tick — caught and fixed within the task rather than left as a latent bug). §4 (UI: 3 buttons + `deriveState` rewrite) → Tasks 4-8, split further than the spec's single bullet because survey found the actual blast radius is 3 separate Hud files plus a fully-dead presentation layer, not the "add a click handler" the spec's own wording implied. §5 scope boundaries (no targeting UI, no channel manual cast) respected — no task adds either. The legacy Ult/channel-tick removal (Task 7) was NOT in the original spec text; it was a genuine mid-survey discovery escalated to the user via `AskUserQuestion` before finalizing this plan (per the "hidden complexity discovered mid-task upgrades scope, flag it" rule), not silently added.
- **Known gap NOT covered by this plan, tracked for later**: `GameManager.getBattle()`'s `Battle` shim (`GameManager.ts:2581-2587`, `turnBattle as unknown as Battle`) lacks a `.stats` alias on `.player`, breaking any remaining legacy consumer that reads `battle.player.stats.*` directly (found via `PillSystem.profession.test.ts`). This plan's Tasks 4-8 route entirely around `getBattle()` (using `getTurnBattle()` instead), so they don't fix or depend on this — Task 10 Step 1 explicitly re-checks and documents its status rather than assuming it's fixed.
- **Type consistency**: `'basic' | 'special' | 'ultimate'` slot-name literal type is used identically across Task 1 (`selectAction`/`resolveActorTurn`), Task 2 (`pendingPlayerChoice`/`submitPlayerSkillChoice`), Task 5 (`chooseSkill`), Task 7/8 (`@click="chooseSkill(...)"`) — no drift between them.
