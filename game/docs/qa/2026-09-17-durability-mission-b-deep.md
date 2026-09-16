# QA Review: Mission B durability/lifecycle (fix/durability @ HEAD)

- Date: 2026-09-17
- Mode: deep (mandatory escalation: save/cloud + time/offline + Vue/Pinia lifecycle triggers; mapper `deepAuditCandidate: true`, 4 domains, 7 unmapped paths — all manually routed below)
- Verdict: FAIL → both Confirmed findings repaired in the same task; evidence below

- Task-owned paths:
  - `game/electron/main.ts`, `game/src/main-process/quitFlush.ts` (quit-flush owner, Task 1)
  - `game/src/composables/useElectronBridge.ts` (save-result ack, Task 1)
  - `game/src/composables/useAppLifecycle.ts`, `game/src/App.vue` (boot first-save transaction, Task 2; subscribe dispose, Task 6)
  - `game/src/core/game/GameManagerBattleRewardOps.ts` (defeat stage release, Task 3)
  - `game/src/composables/useBattleActions.ts`, `useAutoRetryCountdown.ts`, `CombatVictoryPanel.vue`, `CombatDefeatPanel.vue` (async start/refight, Task 4)
  - `game/src/core/game/GameManagerAutoFarmOps.ts`, `AutoFarmIndicator.vue`, `StageSelectPanel.vue`, `GameRoot.vue`, `vi.json`/`en.json` (auto-farm stop + timestamp guard, Task 5)
- Unmapped-path routing: `electron/main.ts` + `quitFlush.ts` → ui-input-lifecycle + save-and-cloud (persistence on close); `useAppLifecycle.ts`/`App.vue` → save-and-cloud + ui-input-lifecycle; `useBattleActions.ts`/`useBattleActions` consumers → combat-and-tribulation + pinia-phaser-sync; `GameManager*Ops.ts` → combat-and-tribulation + time-and-offline; `useElectronBridge.ts` → save-and-cloud.
- Exclusions: none (all task-owned paths reviewed).

## Invariant Ledger

| ID | State/owner | Transition | Invariant | Attack operator | Oracle | Layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-B-01 | quit flush / `quitFlush.ts` WeakSets | close → flush → finish → close | Exactly-once flush; re-entrant close passes; duplicate close blocked | Repeat, interruption | second close sends no second IPC; post-finish close passes | unit (`quitFlush.test.ts`) | High — silent data loss |
| INV-B-02 | quit flush / `useElectronBridge` | save resolves non-ok or throws | Recoverability: failure logged+toasted, ack still sent | degraded env, value mutation | `notifyFlushComplete` in finally on every branch | unit | High |
| INV-B-03 | boot / `useAppLifecycle.bootGame` | create → grants → first save → tick | Atomicity + ordering: no ticking runtime on unpersisted character | interruption, degraded env | save before `clock.start`/`enterGame`; non-ok → fail | unit | Critical |
| INV-B-04 | boot retry / `bootGame` + App `onNewCharacter` | first save fails → error → re-create | Exactly-once grants; no persisted double grant | repeat, interruption | grant seams invoked once per character | unit repro | High |
| INV-B-05 | boot / `bootGame` | `player.save` throws | Recoverability: visible fail, no hang | degraded env | `boot.fail()` + `onError`, outcome `failed` | unit repro | Medium |
| INV-B-06 | defeat / `GameManagerBattleRewardOps` | battle settles defeat under repeat | Lifecycle: stage slot released unconditionally | repeat | `stopRepeat` on defeat+repeat | unit | High — session soft-lock |
| INV-B-07 | refight / panels + `runStageStart` | async start refused after commit-preparing state | Atomicity: failed start rolls back mode/selection | timing, interruption | mode→manual, selectedStageId restored | unit | Medium |
| INV-B-08 | auto-farm / `AutoFarmOps` | corrupt/stale `lastCheckedMs` | Boundedness: one capped window, never re-paid per tick | value mutation, stale state | anchor rebases into current window | unit | High — reward duplication |
| INV-B-09 | auto-farm / indicator+panel | user stops armed farm | Lifecycle: domain stop clears state + slot | repeat | `autoFarmStage=null`, `stageManager.stop()` | unit | Medium |
| INV-B-10 | App unmount / `uiFlagsPersistence` | unmount/remount (HMR) | Lifecycle: detached `$subscribe` not accumulating | repeat | disposer called from `onUnmounted` | wiring | Medium |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` | clean | after fixes |
| `npm run build` | clean (6.8s) | |
| `npx vitest run` (full) | 5152 passed / 4 expected-fail / 2 flake-timeouts | `kiem-tu/invariants.test.ts` file-scan grep guards timed out at 5s under parallel load; pass isolated at ~0.5s — pre-existing load flake class, same as Mission A |
| `npx playwright test tests/e2e/create-to-combat.spec.ts tests/e2e/boot-fresh.spec.ts` | 2 passed (2.2m) | in-worktree per P14; boot-fresh exercises Task 2 path, create-to-combat exercises Tasks 3/4 |
| `npm run test:e2e` (full) | Not verified | task-relevant specs only; full e2e sweep not run |
| INV-B-01/02 | unit green (`quitFlush.test.ts`, `useElectronBridge.test.ts`) | |
| INV-B-03 | unit green + e2e boot-fresh | ordering via `invocationCallOrder` |
| INV-B-06/07/08/09 | unit green (`repeatStage`, combat panels, `autoFarmOffline`, `AutoFarmIndicator`, `StageSelectPanel`) | |
| INV-B-10 | static wiring verified in `App.vue` `onUnmounted` | disposer call present; no dedicated runtime test |

## Findings

### QA-2026-09-17-B1: failed first save + retried creation double-grants starter content

- Severity: High
- Status: Confirmed → repaired in this task
- Invariant: Exactly-once / atomicity — one character creation grants one starter set.
- Preconditions: new-character boot reaches `onNewCharacter` (grants commit: buildings, materials, activePlayer), then `player.save` returns non-ok or throws (quota, storage blocked, conflict).
- Reproduction: `useAppLifecycle.test.ts` — "first save fails then retry creates again -> starter grants apply EXACTLY ONCE" (callback mirrors the same public seams App.vue's `onNewCharacter` drives: `buildingManager.add` ×2, `materialBag.add` ×2, `setActivePlayer`).
- Expected: grants applied once per created character.
- Actual (pre-fix): `buildingManager.add` called 4 times on retry — boot-error → auth → re-create re-ran the non-idempotent callback on already-granted state; the retried save then persisted the doubled state (also `baseStats +=` in `onCharacterCreated` double-applies).
- Evidence: intended failing test (4 vs 2).
- Fix: composable tracks `newCharacterGrantsApplied`; a subsequent `createNewCharacter` boot calls `deps.hardReset()` (App.vue passes `window.location.reload` — the project's established reset mechanism, same as `resetSaveFromSettings`) and returns `skipped` instead of re-granting.
- Owner subsystem: `useAppLifecycle` + App.vue boot wiring.
- Blast radius: persisted doubled buildings/materials/attribute allocations — only after a first-save failure, but then permanent.

### QA-2026-09-17-B2: throwing `player.save` leaves boot hung on the loading screen

- Severity: Medium
- Status: Confirmed → repaired in this task
- Invariant: Recoverability — every first-save outcome must resolve the boot transaction.
- Preconditions: `coordinator.save` has no try/catch; a `CloudSaveService` implementation that rejects (remote service network failure, unexpected `buildGameSave` throw) propagates out of `bootGame` as an unhandled rejection — `boot.fail()` never runs, `entryStage` never reaches `error`, app sits on LoadingScreen.
- Reproduction: same file — "player.save THROWS during first save -> boot still fails visibly instead of hanging" (pre-fix: rejection escaped).
- Fix: try/catch around the first-save await; on throw → `console.error` + `onError(t('panels.settings.notifications.saveFailed'))` + `boot.fail()` + `failed`, with the generation fence checked inside the catch.
- Note: `coordinator.load()` shares the throw-propagation exposure (pre-existing; both local paths are non-throwing since Mission A, so reachability requires a throwing service implementation). Recorded, not expanded — out of Task 2 scope.
- Blast radius: infinite loading screen under a degraded-environment save throw.

### QA-2026-09-17-B3 (Suspected, Low): pending refight commit vs. post-exit state

`runStageStart`'s `commit()` runs when `runAdmitted` resolves `entered`, independent of what the panel/user did meanwhile. In progress mode the victory panel's continue control is hidden and retry is disabled, so the window is narrow; a pending-refight failure can still write `ui.selectedStageId`/`battleRunMode` after the user navigated on via another exit path (e.g. pause overlay). Pre-existing structure — `commit` lived inside `runStageStart` before Task 4; Task 4 only added failure rollback. No decisive oracle built; record as Suspected/Low.

### QA-2026-09-17-B4 (Suspected, Low): mid-loop reward throw leaves anchor un-advanced

`tickAutoFarm`/`settleAutoFarmOffline` rebase `lastCheckedMs` only after the full reward loop; a `rollAutoFarmCycleReward` throw (e.g. missing profession grade in `createInstance`) abandons the tick with partial rewards granted and the anchor unmoved, so the next tick replays the window including already-paid cycles. Same ordering existed before this change (the rebase replaced `+=` in the same position), so exposure is unchanged; bounded by the 24h cap. Suspected/Low.

### QA-2026-09-17-B5 (Coverage gap, Low): far-future `lastCheckedMs` stalls auto-farm silently

A tampered save with `lastCheckedMs` far in the future yields negative `elapsedMs` → early return, anchor never rebased → farm never pays until wall-clock reaches it. Validator accepts any finite ≥0. Recoverable via the new stop control; self-inflicted only. Coverage gap — no save-side upper bound relative to now.

### QA-2026-09-17-B6 (Nit): armed-farm row hidden for unknown stageId

`StageSelectPanel`'s `armedFarmStage` resolves the stage through the catalog; an armed farm whose stageId vanished from the registry hides the row entirely. The `AutoFarmIndicator` still renders the raw id and the stop control works, so the user is not stuck — cosmetic inconsistency only.

## New or Changed QA Tests

- `src/composables/useAppLifecycle.test.ts` — +2 cases: double-grant retry repro (proves grant seams run once across a failed first save + retried creation, via the hardReset guard) and thrown-save repro (proves boot resolves `failed` rather than hanging). Both failed for the intended reason pre-fix and pass post-fix — retained as regression tests.

## Gaps and Residual Risk

- Full `test:e2e` sweep not run; task-relevant Playwright specs (boot-fresh, create-to-combat) verified in-worktree.
- `kiem-tu/invariants.test.ts` grep-guards are load-sensitive under the full suite (pre-existing flake class).
- B3/B4/B5 remain as bounded suspected/gap items — none block; all have workaround or pre-existing exposure.

## Pre-existing Failures

- `kiem-tu/invariants.test.ts` — two file-scan guards timeout under full-suite parallel load; pass in isolation. Not task-caused.
- `ChiHienQuan.integration.test.ts` — one gacha assertion flaked once under load in run 1, passed in isolation and on rerun. Not task-caused.
