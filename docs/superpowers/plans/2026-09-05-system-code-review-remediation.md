# TutienIdle System Code Review Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khắc phục các lỗi đã xác nhận trong audit toàn hệ thống, đơn giản hóa action playback, tăng độ an toàn lifecycle/offline settlement, và bổ sung regression coverage mà không thay đổi architecture ngoài phạm vi cần thiết.

**Architecture:** Ưu tiên sửa theo rủi ro: trước hết bảo vệ action playback khỏi callback cũ và lifecycle teardown, sau đó giới hạn offline economy, rồi xử lý UI/lifecycle/accessibility và chất lượng test. Giữ nguyên public API hiện có khi có thể; các thay đổi API acknowledgement phải được truyền token xuyên suốt từ GameManager đến CombatScene.

**Tech Stack:** Vue 3, TypeScript, Vite, Vitest, Pinia, Phaser 4.

**Spec:** `docs/superpowers/plans/2026-09-05-system-code-review-remediation.md` — kế hoạch này dựa trên audit code review ngày 2026-09-05; chưa có design spec riêng.

## Global Constraints

- Chỉ sửa trong `game/` và các test/docs liên quan trực tiếp đến task.
- Không thêm dependency.
- Không dùng `any` mới; dùng type/interface/`unknown` phù hợp.
- Không thay đổi Phaser scene topology, store public API, hoặc save migration ngoài yêu cầu.
- Mỗi task phải có regression test trước implementation nếu hành vi có thể kiểm thử tự động.
- Không đọc hoặc ghi secret files (`.env`, API keys, bearer tokens).
- Verification mặc định là **quick**; dùng **full** nếu chạm config, dependency, asset pipeline, router, root store hoặc Phaser scene manager.
- Với code production từ 5 dòng trở lên: chạy code simplifier trước code review.
- Sau implementation phải chạy adversarial QA quick; nếu phát hiện rủi ro broad ở save/time/economy/lifecycle thì escalate deep.
- Không commit, merge, push hoặc deploy nếu user chưa cấp quyền trong lượt hiện tại.

---

## Audit Findings Mapped to Tasks

| Finding | Task | Priority | Status to achieve |
|---|---:|---:|---|
| Delayed action acknowledgements cross action/battle boundaries | 1 | P0 | Confirmed fixed by tokenized tests |
| `setPresentationActive(false)` stale/inconsistent drain | 1 | P0 | Confirmed fixed by teardown/idempotency tests |
| VFX completion timing detached from real tween | 2 | P1 | Completion handle test passes |
| Unbounded offline auto-farm settlement | 3 | P0 | Large elapsed input is bounded |
| `useBagGridLayout` misses late ref assignment | 4 | P1 | Conditional mount test passes |
| App interval/listener/subscription cleanup | 5 | P1 | Remount/duplicate boot tests pass |
| Theme keyboard/accessibility semantics | 6 | P1 | Keyboard and ARIA tests pass |
| Dialog labeling/focus hardening | 6 | P2 | Accessible name/description tests pass |
| Playback tests lack edge cases | 7 | P1 | Duplicate, late, multi-target tests pass |
| Combat test harness has widespread `any` | 8 | P2 | Narrow typed adapter reduces new/spread `any` |
| Brittle bundle/E2E tests | 9 | P2 | Only if separately authorized; otherwise document |

## File Map

### Task 1 — Tokenized playback and idempotent teardown

- Modify: `game/src/core/game/GameManager.ts`
- Modify: `game/src/core/battle/turn/TurnActionPresentationEvents.ts` if event payload types require token fields
- Modify: `game/src/game/scenes/CombatScene.ts`
- Test: `game/src/core/game/GameManager.actionPlayback.test.ts`
- Test: new or existing `game/src/game/scenes/CombatScene.*.test.ts` focused on delayed callbacks

### Task 2 — VFX completion ownership

- Modify: `game/src/game/support/ActionImpactVfx.ts`
- Modify: `game/src/game/scenes/combat/combat-vfx-spawner.ts`
- Modify: `game/src/game/scenes/CombatScene.ts`
- Test: `game/src/game/support/ActionImpactVfx.test.ts`
- Test: focused CombatScene playback test

### Task 3 — Bounded offline auto-farm

- Modify: `game/src/core/game/GameManager.ts`
- Modify: `game/src/core/game/GameManagerSaveRestore.ts` only if the shared cap belongs at restore boundary
- Inspect/use: `game/src/core/time/GameClock.ts` or the project’s existing offline-cap helper
- Test: `game/src/core/game/GameManager.autoFarmOffline.test.ts`

### Task 4 — Dynamic bag grid observer

- Modify: `game/src/composables/useBagGridLayout.ts`
- Test: new `game/src/composables/useBagGridLayout.test.ts`

### Task 5 — App lifecycle idempotence

- Modify: `game/src/App.vue`
- Test: existing App tests or new focused `game/src/App.lifecycle.test.ts`

### Task 6 — UI accessibility and dialog semantics

- Modify: `game/src/components/settings/ThemeSwitcher.vue`
- Modify: `game/src/components/common/OverlayPanel.vue`
- Modify: `game/src/components/common/ConfirmModal.vue`
- Modify: `game/src/composables/useDialogFocus.ts` only where required by confirmed tests
- Test: relevant component/accessibility tests

### Task 7 — Playback edge-case regression suite

- Modify: `game/src/core/game/GameManager.actionPlayback.test.ts`
- Modify: `game/src/core/battle/turn/TurnBattleSystem.actionPlayback.test.ts`
- Test: focused CombatScene callback test

### Task 8 — Typed combat test adapter and fixture simplification

- Create: `game/src/game/scenes/combat/testHarness.ts` only if existing helpers cannot be reused
- Modify: CombatScene test files that currently fabricate `any`
- Test: same files after adapter migration

### Task 9 — Test hygiene follow-up

- Modify only with explicit scope approval: `game/src/bundle-split.test.ts`, `game/tests/e2e/save-reload.spec.ts`
- Prefer separate follow-up plan if moving build tests or changing E2E preconditions.

---

## Task 1: Tokenize playback callbacks and make presentation teardown idempotent

**Files:** See File Map Task 1.

**Interfaces:**

- Produces a playback token type/value that identifies one pending action lifecycle.
- `acknowledgeTurnReady`, `acknowledgeActionImpact`, and `acknowledgeActionComplete` accept the token in a backwards-compatible way only if existing non-Phaser callers require it; otherwise update all call sites atomically.
- `setPresentationActive(false)` drains or clears all pending playback state and is safe when called repeatedly.

- [ ] **Step 1: Add failing state-machine tests.**

Add tests that:

1. Enable presentation, advance to `turn_ready`, disable presentation, and assert `isActionPlaybackWaiting()` is false.
2. Repeat for declared and impact phases.
3. Call `setPresentationActive(false)` twice and assert no extra damage, turn count, event, or completion occurs.
4. Start a second action and invoke the first action’s stale acknowledgement; assert the second action remains pending.

Example assertion shape:

```ts
const oldToken = gameManager.getPendingPlaybackToken()
gameManager.setPresentationActive(false)
gameManager.startNextActionForTest()
gameManager.acknowledgeActionImpact(oldToken)
expect(gameManager.getTurnBattle()?.totalTurnsElapsed).toBe(expectedTurns)
```

Use the project’s actual observable API if a token getter is not appropriate; tests must not depend on private fields.

- [ ] **Step 2: Run the focused tests and verify failure.**

Run:

```powershell
npx.cmd vitest run src/core/game/GameManager.actionPlayback.test.ts src/game/scenes/CombatScene.lifecycle.test.ts
```

Expected: new teardown/token tests fail before production changes.

- [ ] **Step 3: Replace independent pending fields with an explicit playback state.**

Prefer a discriminated union:

```ts
type PendingPlayback =
  | { phase: 'ready'; token: string; actor: TurnBattleParticipant }
  | { phase: 'declared'; token: string; actor: TurnBattleParticipant; declared: TurnDeclaredAction }
  | { phase: 'impact'; token: string; actor: TurnBattleParticipant; declared: TurnDeclaredAction; targetIds: string[] }
  | null
```

If a full union is too invasive for this task, introduce one generation/token field and a single drain helper while preserving the existing fields. The final implementation must make stale acknowledgement a no-op.

- [ ] **Step 4: Implement `drainPresentationState()`.**

The helper must snapshot and clear pending state before applying completion. It must handle each phase exactly once, call the same state synchronization needed by normal paths, and leave `isActionPlaybackWaiting()` false. Terminal battle states must not leave a pending phase waiting for Phaser.

- [ ] **Step 5: Pass token/generation through CombatScene delayed callbacks.**

Capture the token when scheduling each delayed callback. At callback execution, call the acknowledgement only with that token. Cancel or invalidate pending callbacks during scene teardown. Do not rely only on optional chaining; it prevents crashes but not cross-battle mutation.

- [ ] **Step 6: Run focused tests.**

Run:

```powershell
npx.cmd vitest run src/core/game/GameManager.actionPlayback.test.ts src/game/scenes/CombatScene.lifecycle.test.ts
```

Expected: all tests pass, including stale-callback and repeated-teardown cases.

- [ ] **Step 7: Simplify and review the diff.**

Run code simplifier on the changed production code, then run the code-review gate. Fix any issue with confidence at least 80 before continuing.

---

## Task 2: Tie action completion to actual VFX completion

**Files:** See File Map Task 2.

- [ ] **Step 1: Add a failing VFX completion test.**

Stub the Phaser tween manager and verify that `spawnActionImpactVfx()` exposes a completion callback/handle that fires from the tween’s `onComplete`, not from a duplicated duration calculation in CombatScene.

- [ ] **Step 2: Run the test and verify failure.**

```powershell
npx.cmd vitest run src/game/support/ActionImpactVfx.test.ts
```

- [ ] **Step 3: Add a minimal completion-aware return value.**

Use an existing project pattern if present. The returned object should support completion and cleanup without requiring callers to know tween internals. Ensure both ground and upright graphics are destroyed exactly once.

- [ ] **Step 4: Update CombatScene/VFX spawner.**

Remove the duplicate duration calculation from `CombatScene.onActionImpact()`. Acknowledge action completion from the VFX completion callback with the matching playback token. If no VFX can be created, complete immediately.

- [ ] **Step 5: Test and simplify.**

Run the focused VFX and playback tests, then run code simplifier and code review for the final diff.

---

## Task 3: Bound offline auto-farm settlement

**Files:** See File Map Task 3.

- [ ] **Step 1: Add failing large-elapsed tests.**

Cover:

1. Multi-day elapsed time.
2. A very small positive cycle duration.
3. Exact cap behavior.
4. Preservation of fractional leftover time after capped settlement.

Assert both reward-call count and `lastCheckedMs` behavior.

- [ ] **Step 2: Run the focused tests and verify failure.**

```powershell
npx.cmd vitest run src/core/game/GameManager.autoFarmOffline.test.ts
```

- [ ] **Step 3: Reuse the project’s established offline cap.**

Do not invent a second conflicting rule if `GameClock` already defines the intended cap. Apply the cap at the boundary where offline elapsed time is normalized, then keep the cycle loop bounded. If design requires a different cap for auto-farm, define a named constant and test its exact value.

- [ ] **Step 4: Add defensive cycle validation.**

If `cycleSeconds <= 0`, return without looping. This prevents division by zero or non-finite cycle counts from malformed player state.

- [ ] **Step 5: Run focused tests, then full verification if shared time/economy code changed broadly.**

At minimum:

```powershell
npm.cmd run type-check
npx.cmd vitest run src/core/game/GameManager.autoFarmOffline.test.ts src/core/game/GameManagerSaveRestore.test.ts
```

Escalate to `npm.cmd run build` and the full suite when the shared offline helper or root GameManager behavior changes.

---

## Task 4: Make bag grid observation resilient to conditional rendering

**Files:** See File Map Task 4.

- [ ] **Step 1: Add a conditional-mount regression test.**

Mount a component with `gridRef` initially null, then render the grid, trigger the mock ResizeObserver, and assert `layout`, `pageSize`, and CSS variables update.

- [ ] **Step 2: Run the test and verify failure.**

```powershell
npx.cmd vitest run src/composables/useBagGridLayout.test.ts
```

- [ ] **Step 3: Watch `gridRef` instead of reading it only in `onMounted`.**

Disconnect the old observer when the ref changes, attach when a new element appears, and cleanup both watcher and observer on unmount. Guard `ResizeObserver` availability consistently with project conventions.

- [ ] **Step 4: Run the composable test and type-check.**

---

## Task 5: Make App boot/tick/listener lifecycle idempotent

**Files:** See File Map Task 5.

- [ ] **Step 1: Add failing lifecycle tests.**

Test that:

1. Calling the tick-loop starter twice creates one interval.
2. Calling character-created twice while the first boot is pending performs one boot/save flow.
3. Unmount removes event-bus handlers and detached subscriptions.

Use fake timers and a typed event-bus stub; do not expose secrets or use real network calls.

- [ ] **Step 2: Run focused App tests and verify failure.**

- [ ] **Step 3: Add idempotent guards and symmetric cleanup.**

Capture unsubscribe functions. Store named event handlers. Add `bootInFlight`/creation guard with reset on failure so retry remains possible.

- [ ] **Step 4: Run tests and inspect HMR/remount behavior.**

Because this touches app lifecycle broadly, use **full** verification before completion.

---

## Task 6: Fix theme, dialog, and focus accessibility

**Files:** See File Map Task 6.

- [ ] **Step 1: Add failing accessibility tests.**

Cover:

1. Theme activates with Enter and Space.
2. Selected theme exposes `aria-pressed` or radio semantics.
3. Dialog title and description are referenced by `aria-labelledby`/`aria-describedby`.
4. Focus restoration does not target a disconnected/disabled element.

- [ ] **Step 2: Use native controls where possible.**

Prefer `<button type="button">` for theme cards. Preserve existing visual class hooks and data-testid values.

- [ ] **Step 3: Add stable per-instance dialog IDs.**

Use Vue `useId()` or an existing project ID helper. Do not use duplicate static IDs across multiple dialogs.

- [ ] **Step 4: Harden `useDialogFocus` only to the extent tests prove necessary.**

Remove old keydown handlers before registering new ones, invalidate stale `nextTick()` callbacks, and restore focus only to connected, visible, enabled elements.

- [ ] **Step 5: Run focused UI tests and the UI/UX review skill.**

Since this changes interaction/accessibility, run `ui-ux-pro-max` and the Vue best-practices skills before implementation. Run quick verification afterward.

---

## Task 7: Expand action playback regression coverage

**Files:** See File Map Task 7.

- [ ] **Step 1: Add tests for duplicate and out-of-order acknowledgements.**

Assert no duplicate damage, turn count, event, or reward.

- [ ] **Step 2: Add target/effect edge cases.**

Cover multi-target, miss/dodge, effect-only, reaction/follow-up, target death during impact, and terminal victory/defeat.

- [ ] **Step 3: Add delayed callback and shutdown cases.**

Use fake timers and generation tokens. Confirm callbacks from old battle cannot affect a new battle.

- [ ] **Step 4: Run focused playback tests and document any intentionally unsupported case.**

No test should pass merely because a callback is never invoked; assert observable state/event results.

---

## Task 8: Simplify and type combat test fixtures

**Files:** See File Map Task 8.

- [ ] **Step 1: Inventory repeated fixture shapes and `any` casts.**

Do not rewrite all tests at once. Start with action playback and lifecycle tests.

- [ ] **Step 2: Create a narrow typed adapter.**

The adapter may use one localized assertion boundary for Phaser’s untyped/dynamic surface, but production and individual tests should consume explicit interfaces.

- [ ] **Step 3: Replace duplicate entity setup with parameterized fixtures.**

Support overrides such as HP, attack, target count, and event handlers without duplicating full entity objects.

- [ ] **Step 4: Run focused tests and simplify the resulting diff.**

Do not alter production behavior in this task.

---

## Task 9: Test-hygiene follow-up

This task is optional and should be implemented separately unless explicitly approved because it may touch build/E2E conventions.

- [ ] **Step 1: Decide whether bundle checks belong in Vitest.**

If retained, assert manifest/module relationships. If moved, add a dedicated script and include full verification because `package.json` changes.

- [ ] **Step 2: Make save-reload resource setup deterministic.**

Seed a known spirit-stone amount before save and assert exact persistence instead of conditionally skipping the resource assertion.

- [ ] **Step 3: Run Playwright using the project’s E2E skill and verify no secrets are used.**

If the current environment cannot run browser E2E, report the limitation rather than weakening the assertion.

---

## Verification and Review Gates

For each production task:

1. Write failing regression test.
2. Confirm failure.
3. Implement minimal fix.
4. Run focused tests.
5. Run code simplifier.
6. Run `npm.cmd run type-check` and focused Vitest for quick mode.
7. Run `tutienidle-adversarial-qa` quick.
8. Run code-review over the simplified diff.
9. Fix all findings at confidence ≥80.

Use **full** verification for:

- Task 3 if shared offline/economy timing changes.
- Task 5 because App lifecycle is broad/shared.
- Task 9 if `package.json`, build scripts, Vite config, or E2E configuration changes.
- Any pre-release or milestone run.

Full mode:

```powershell
npm.cmd run type-check
npm.cmd run build
npx.cmd vitest run
```

Stop on first failure, investigate root cause, fix, and rerun the same verification mode.

## Completion Criteria

- No confirmed P0/P1 finding remains open.
- Action playback stale callbacks are rejected by token/generation tests.
- Presentation teardown is idempotent and leaves no pending phase.
- Actual VFX completion controls action completion.
- Offline auto-farm work is bounded.
- Conditional bag grid mount updates layout correctly.
- App boot/tick/listener lifecycle is idempotent and cleaned up.
- Theme and dialog accessibility tests pass.
- Focused action playback edge cases are covered.
- Simplifier and code review report no unresolved ≥80-confidence issue.
- Adversarial QA verdict is `PASS WITH EVIDENCE`, or a specific legitimate `FAIL WITH REASON` is documented.

## Deferred / Notes

- Bundle split test refactor and broad E2E changes are intentionally separated because they may require config/script changes and full verification.
- Removing Phaser physics bodies is not included until runtime ownership is verified; it remains a performance suggestion, not a confirmed defect.
- Full decomposition of `GameManager.ts` or `CombatScene.ts` is out of scope; only targeted state-machine and lifecycle simplification is planned.
