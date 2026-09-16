# Mission B — Runtime Durability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Game only acknowledges persistence when data is actually committed; no session soft-locks from lifecycle races.

**Architecture:** Quit-flush checks the typed save result before acking; character creation becomes a boot transaction (save before runtime start); stage slot release is unconditional on defeat; async battle-start results are awaited everywhere; auto-farm gets a real stop path.

**Tech Stack:** TypeScript, Vue 3, Electron IPC, Vitest, Playwright (wiring checks only).

**Spec:** `docs/specs/2026-09-16-audit-remediation-spec.md` Mission B. Audit evidence: `docs/qa/2026-09-16-full-project-scout-audit.md` T1-2, T1-4, T1-5, T1-6, T1-8, T1-12, T6-51, T6-52.

## Global Constraints

- Dev-stage rule: no migrations / compat shims; fix code directly.
- P8: no `any`. P15: English ASCII comments. P16: new UI strings via `t()`.
- P13: B1/B2 touch boot + Electron IPC — verify with the relevant e2e or a manual runtime check, not just unit tests.
- P17: presentation must not become gameplay authority — stop controls issue commands to domain ops.
- Worktree: `.agent-worktrees/durability` (branch `fix/durability`).

---

### Task 1: Quit-save acknowledgement + re-entrancy guard

**Files:**
- Modify: `game/src/composables/useElectronBridge.ts:65-80` (quit flush handler)
- Modify: `game/electron/main.ts:120-157` (`bindQuitFlush`)
- Test: `game/src/composables/useElectronBridge.test.ts` (extend — mock electronAPI + `player.save` returning `{status:'failed'}`)

**Interfaces:**
- Consumes: `player.save(gameManager): Promise<SaveWriteResult>` where `SaveWriteResult = {status:'ok'} | {status:'failed'; reason}`.
- Produces: renderer only acks flush-complete when `status==='ok'` OR after logging failure — see decision below.

- [ ] **Step 1: Failing tests**
  - `player.save` resolves `{status:'failed'}` → handler still calls `notifyFlushComplete()` (app must not hang — the 2s main-process timeout is the backstop) BUT logs the failure via `console.error` AND pushes a notification through the notification store if reachable. Assert the log/notification path.
  - Main-process: second `close` event while a flush is in-flight must not re-send `app:before-quit-flush` to the renderer. Assert `webContents.send` called once for two rapid `close` events (unit-test `bindQuitFlush` with a fake win/event, or e2e).
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement**
  - `useElectronBridge`: capture `const result = await player.save(gameManager)`; if `result.status !== 'ok'` → `console.error('[electron] quit flush save failed', result)` + notification-store push (if store injectable/available via `useNotificationStore()`); `finally { notifyFlushComplete() }` stays — app still closes (documented: window close is not blocked by save failure; failure is logged + surfaced).
  - `electron/main.ts`: split state — `const flushingWindows = new WeakSet<BrowserWindow>()`; in `bindQuitFlush`: `if (flushedWindows.has(win) || flushingWindows.has(win)) return` — add to `flushingWindows` on first event, move to `flushedWindows` in `finish`.
- [ ] **Step 4: PASS + type-check.**
- [ ] **Step 5: Commit** `fix(electron): ack quit-flush result, guard re-entrant close`

---

### Task 2: Character-creation boot transaction

**Files:**
- Modify: `game/src/App.vue:647-676` (`onCharacterCreated`), `game/src/composables/useAppLifecycle.ts` (bootGame seam — find where tick loop starts)
- Test: `game/src/composables/useAppLifecycle.test.ts` (extend — simulate save failure → assert tick loop not started / torn down)

**Interfaces:**
- Consumes: `bootGame(isNew: boolean)` outcome `{status:'entered'|'skipped'|'failed'}`; `cloudSaveCoordinator.save(...)`.
- Produces: durable save commits before `startTickLoop` for the new-character path.

- [ ] **Step 1: Failing test** — `onCharacterCreated` path where `cloudSaveCoordinator.save` returns `{status:'conflict'|'failed'}` → assert `startTickLoop` never ran, or `lifecycle.stopAll()` torn it down; `bootError` set.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement** — reorder so the new-character durable save lands before the tick loop starts. Two acceptable shapes:
  1. Split `bootGame` so new-character flow is `initialize → grants → save → startTickLoop → entered`; OR
  2. On save failure in `onCharacterCreated`, call `lifecycle.stopAll()` + reset entered state before `bootFlow.fail()`.
  Choose (1) if `useAppLifecycle` exposes a clean seam; (2) is the minimal-diff fallback. Record the choice in the report.
- [ ] **Step 4: PASS + type-check.** P13: wiring-critical — run `tests/e2e` boot spec if one exists; else state manual check needed.
- [ ] **Step 5: Commit** `fix(boot): commit first durable save before starting runtime`

---

### Task 3: Release stage slot on defeat during auto-repeat

**Files:**
- Modify: `game/src/core/game/GameManagerBattleRewardOps.ts:135-137` (repeat-mode defeat path)
- Test: `game/src/core/game/` — colocated test (check for existing `*BattleReward*.test.ts`; else extend the stage/battle ops test file)

**Interfaces:**
- Consumes: `StageManager.active` release semantics; `stopRepeat()`.
- Produces: defeat releases the stage slot unconditionally.

- [ ] **Step 1: Failing test** — arrange: `stageManager.start(...)`, `repeat` armed → force `battle outcome = defeat` → assert `stageManager.active` is null and a subsequent `stageManager.start(...)` succeeds.
- [ ] **Step 2: FAIL** (slot leaks).
- [ ] **Step 3: Implement** — on defeat outcome, release the active stage slot regardless of repeat mode (stage system's contract: death stops stage and auto-repeat). Do not change victory path.
- [ ] **Step 4: PASS.**
- [ ] **Step 5: Commit** `fix(battle): release stage slot on defeat during auto-repeat`

---

### Task 4: Async refight contract

**Files:**
- Modify: `game/src/composables/useBattleActions.ts` (return type), `game/src/components/game/combat/CombatVictoryPanel.vue:93-111`, `game/src/components/game/combat/CombatDefeatPanel.vue:85-100`, `game/src/composables/useAutoRetryCountdown.ts` (callback type)
- Test: composable/panel tests — colocated or `src/composables/*.test.ts`

**Interfaces:**
- Produces: `startBattle`/`refight` signature `Promise<boolean>` consumed by `await`; countdown callback type `() => void | Promise<void>`.

- [ ] **Step 1: Failing tests** — `refight()` resolves `false` → victory panel re-enables retry + shows continue; defeat panel retry button re-enabled; no stuck state.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement** — make the API `Promise<boolean>`; `await` at call sites; on `false`/rejection reset retry/pending state. Update `useAutoRetryCountdown` to await callback results.
- [ ] **Step 4: PASS + type-check.**
- [ ] **Step 5: Commit** `fix(combat): await async refight results, reset state on failure`

---

### Task 5: Auto-farm stop + timestamp guard

**Files:**
- Modify: `game/src/core/game/GameManagerAutoFarmOps.ts:134,159-168` (`lastCheckedMs` settle guard), `game/src/components/panels/StageSelectPanel.vue` (stop control), combat HUD component (persistent indicator — find the mounted HUD: `CombatBuildHud`/`PhapTuCombatHud` chain)
- Test: `GameManagerAutoFarmOps` colocated test + a thin component test if conventions allow

**Interfaces:**
- Consumes: `stopAutoFarm()` (exists, zero callers), `ui` store state for armed mode.
- Produces: stop callable from HUD + panel; `lastCheckedMs` clamped so corrupt small-positive values can't double-pay.

- [ ] **Step 1: Failing tests**
  - Domain: `lastCheckedMs = small positive` + offline settle → total paid never exceeds one capped window.
  - UI: auto-farm armed → HUD shows indicator with stop control; clicking calls `stopAutoFarm`.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement**
  - Settle: `effectiveLastChecked = Math.max(lastCheckedMs, now - CAP)` semantics — verify against existing cap code before writing.
  - HUD: indicator rendered when auto-farm armed; dispatches stop command (A7: command to domain op, no state mutation in component).
  - Panel: stop/deactivate control alongside start; on `startAutoFarm() === false` keep panel open + show reason (also fixes T4-38 partially — the unconditional close).
- [ ] **Step 4: PASS + type-check.** P13/P14: this is user-visible wiring — note for reviewer whether e2e coverage exists; if not, flag manual verification.
- [ ] **Step 5: Commit** `fix(autofarm): wire stop control and clamp corrupt timestamps`

---

### Task 6: Detached `$subscribe` cleanup

**Files:**
- Modify: `game/src/App.vue:97-108, 686+` (`onUnmounted`)

- [ ] **Step 1: Implement** — capture `const automationFlagsUnsubscribe = ui.$subscribe(...)`; call it in `onUnmounted`. (May already be partially done by Mission A Task 5 — check first; if the disposer is captured but not wired, wire it; if fully done, skip and note.)
- [ ] **Step 2: type-check + run `npx vitest run src/stores` sanity.**
- [ ] **Step 3: Commit** `fix(app): dispose detached automation-flags subscription`

---

## Mission B done-criteria

- Quit path logs/surfaces save failure; no double-flush on rapid close.
- New character cannot reach a ticking runtime without a committed save.
- Defeat+repeat releases the stage slot; refight failures recover UI state.
- Auto-farm stoppable from HUD + panel; no timestamp double-pay.
- `npm run type-check` + `npx vitest run src/composables src/core/game src/components/game` green; P4 quick QA; P5 code-review.
