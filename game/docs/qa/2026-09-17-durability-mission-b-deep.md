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

---

# Addendum — external audit round 2 (mission-b-fix worktree)

- Date: 2026-09-17
- Trigger: external second-round review verdict REQUEST CHANGES — 1 High (B5 restore lease), 1 Medium (B2 grant-phase exception boundary), 1 coverage gap (B1 native Electron evidence).
- Verdict: findings Confirmed → repaired in this pass; B1 native runtime evidence captured.

## QA-2026-09-17-B7: persisted auto-farm loses its StageManager lease after reload (High — CONFIRMED, repaired)

- Invariant: one authority per lease — a persisted `autoFarmStage` must hold the single `StageManager` slot, or nothing may tick/pay on it.
- Pre-fix flow: `player.restoreFromSave` restores `autoFarmStage`; `GameManagerSaveRestore` only ran `settleAutoFarmOffline` (no slot re-acquire); `tickAutoFarm` read persisted state alone. After reload `StageManager.active === null` → slot reads free → manual stage start succeeds → real battle runs CONCURRENT with a farm that keeps calling `battleLoot.beginBattle()/setSession()/setChannel('idle')` every cycle over the shared reward session.
- Repro (normal path, no corrupt save): perfect-clear A → start auto-farm A → quit → relaunch → auto-farm ticks while slot is free → start stage B succeeds → both run.
- Fix:
  - `GameManagerAutoFarmOps.reconcileAutoFarmRuntime(player)` — restore-time command that validates the persisted lease (registered stage, `perfectClearStageIds` membership, valid `perfectClearSeconds`) and re-acquires the slot via `stageManager.start` WITHOUT touching `lastCheckedMs` (deliberately not `startAutoFarm`, which re-anchors the timestamp and would wipe the offline remainder). Idempotent: a slot already held by the same farm stage is the desired end state, not a conflict.
  - Wired in `GameManagerSaveRestore.restoreFromSave` after the offline settle block — on EVERY restore with a player slice, not only inside the >60s settle gate (a fast reload restores an armed farm too).
  - `tickAutoFarm` fails closed: `stageManager.get()?.stageId !== autoFarm.stageId` → return, before any reward roll.
  - `stopAutoFarm` releases the slot only when the held lease's stageId matches the farm — stopping a farm can never kill an unrelated battle's lease.
  - Dead leases are dropped: unregistered stage, missing perfect-clear, or invalid cycle time all clear `player.autoFarmStage` instead of arming an inert slot-blocker.
- Regression coverage: `GameManager.autoFarmRestore.test.ts` drives the REAL `restoreGameSession` seam (not hand-set `player.autoFarmStage`): persisted farm → slot re-acquired → `startStage(B)` refused → `stopAutoFarm` releases → `startStage(B)` succeeds; restored farm pays via world tick; lost lease → tick pays nothing; unregistered stage → cleared; never-cleared stage → cleared; same-farm re-restore → lease survives (idempotency).

## QA-2026-09-17-B8: `onNewCharacter` throw escapes the boot transaction (Medium — CONFIRMED, repaired)

- Invariant: the create-character transaction resolves visibly on every outcome; grants run at most once per process.
- Pre-fix: `onNewCharacter?.()` ran before `newCharacterGrantsApplied = true`, outside any try/catch. A mid-grant throw escaped `bootGame` as an unhandled rejection (the `await bootGame(true)` caller has no catch), leaving `boot.fail()` unreached, the flag false on a partially-mutated runtime, and a retry re-running the non-idempotent grants — the same double-grant class as QA-B1, one seam earlier.
- Fix: flag set BEFORE the callback; callback awaited inside try/catch (await because a promise-returning function is silently assignable to `() => void`); on throw → generation fence → `onError(t('save.createFailed'))` → `boot.fail()` → `{ status: 'failed' }`. Retry hits the existing dirty-transaction branch (`hardReset` + `skipped`), so grants never re-run on partial state.
- New i18n key `save.createFailed` (en + vi) — the grant-phase failure is not a save failure, so it no longer reuses `panels.settings.notifications.saveFailed`.
- Regression coverage: `useAppLifecycle.test.ts` — "onNewCharacter THROWS mid-grant" asserts `failed` + `boot.fail` + `onError` + no save + no enterGame, and that a retry takes the hardReset/skipped path with the callback invoked exactly once.

## B1 native runtime evidence — CAPTURED

- Artifact: `game/scripts/electron-quit-flush-smoke.mjs` — launches the real packaged build (`dist-electron/main.js`) under the repo's Electron binary with an isolated `--user-data-dir`, drives the packaged renderer (`dist/` served over loopback HTTP via the app's own `VITE_DEV_SERVER_URL` hook — absolute `/assets/...` URLs cannot resolve under `loadFile(file://)`; the quit-flush IPC path under test is identical).
- Scenario executed: guest auth → create character "SmokeBot" → baseline save observed (`lastSavedAt=…272312`) → live Pinia mutation `cultivation=54321` → `app.close()` → native close held by quit-flush → renderer `player.save()` → `flush-complete` ACK → process exit → relaunch same profile.
- Result: relaunched save carries `cultivation=54321` and `lastSavedAt=…274724` — strictly newer than the pre-close read, proving the quit-flush was the last writer; guest re-auth restored into game home. `[smoke] RESULT: PASS`.
- Environment notes discovered: `ELECTRON_RUN_AS_NODE=1` in the host env makes `electron.exe` run as plain Node (`import 'electron'` then resolves to the npm path package, not the builtin — named ESM imports fail). The smoke deletes it from the child env. Fresh worktrees lack `node_modules`; `PLAYWRIGHT_CORE_FROM`/`ELECTRON_EXE` env overrides cover that.

## Residual risk (unchanged dispositions)

- QA-B4 (mid-loop reward throw leaves anchor un-advanced) and QA-B5 (far-future `lastCheckedMs` stalls) remain Suspected/Low backlog items — the fail-closed tick narrows neither, both still bounded by the 24h cap.
- The `deepAuditCandidate` mapper flag on this diff is addressed by the manual routing above plus the full `restoreGameSession`-seam integration tests; no unmapped-path risk remained after inspection.
