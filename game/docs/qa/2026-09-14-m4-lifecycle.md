# QA — M4 Boot/Host Lifecycle Fencing (ARCH-013 / L04)

Date: 2026-09-14 · Branch: `arch/m4-lifecycle` · Worktree: `.agent-worktrees/arch-m4-lifecycle` · Mode: full P3 (lifecycle infrastructure)

## Scope

Generation-fence every async boundary that could outlive its owning
application generation: app boot (`useAppLifecycle`), combat clock source
(`RafClockSource`), dynamic host bootstrap (`useDynamicRegion` +
`PhaserCanvas` retry hook), asset publication (`AssetBundleManager`),
Electron bridge subscriptions (`useElectronBridge` + `electron/preload.ts`),
and root teardown (`App.vue`). Same identity idiom as M3 strict fencing —
a captured generation compared after every `await`, not a shared boolean.
No second clock, no resource-policy rewrite.

## Verdict: PASS WITH EVIDENCE (P14 deferred — isolated worktree)

## Evidence

- `npm run type-check` → exit 0 (vue-tsc --build clean).
- `npm run build` → exit 0 (built in 7.18s; pre-existing chunk-size warnings only).
- `npx vitest run` → 551 files / 3889 tests; **4 failed** (see Known failures).
- Focused touched scope: 7 files / 85 tests green —
  `useAppLifecycle`, `useElectronBridge` (new), `RafClockSource`,
  `useDynamicRegion`, `PhaserCanvas`, `AssetBundleManager`, `App.wiring`.

## Audit repro closed

`deferred load -> stopAll() -> resolve` previously produced
`{intervals:1, restores:1, entries:1, handle:1}`. The new fence test
asserts outcome `skipped` with zero restores, zero intervals, zero route
entries (home/error/character), zero offline-modal/error writes — plus
a failure-status variant proving stale loads cannot route `boot.fail()` /
`saveIssue.report` into a torn-down App.

## Checks performed

| Check | Result |
|---|---|
| Boot generation bump on `stopAll()`; stale continuation no-ops after every await | OK — `lifecycleGeneration` captured pre-await, re-checked post-load; covers ok/fail/empty/new-character branches |
| Post-stopAll writes blocked | OK — `stopped` gates `bootGame`, `startTickLoop`, `startAutosave`, `persistProgress`; teardown is terminal (one instance per mount) |
| Double boot | OK — `bootInFlight` dedupe preserved; `finally` reset keeps auth-retry working |
| RAF self-stop inside callback | OK — post-callback generation re-check before `requestAnimationFrame` tail; stop+start inside callback keeps exactly one live loop (both tested) |
| Callback exception resilience | OK — pre-existing try/catch test still green |
| Host retry after failed import/construct | OK — `pendingBootGeneration` dedupes same-generation starts only; failure leaves `game === null` so `start()` re-runs; `bootError` cleared before retry |
| Retry wired to coordinator | OK — `PhaserCanvas` watches `routeAdapter.transitionId`; restarts only when `bootError !== null` AND `targetRoute` ∈ `PRIMARY_SCENE_ROUTES` (home/combat/tribulation). `retry()` bumps `transitionId` (coordinator:235). Healthy host + non-Phaser target both proven inert |
| Loader swap fences publication | OK — `loaderGeneration` bump on `setLoaderScene`/`dispose`; stale DOM + Phaser batch continuations **reject** (`'superseded'`) instead of publishing into the new cache; identity-guarded `inFlightLoads` delete protects the new generation's dedupe entry |
| Electron subscriptions removable | OK — preload `onSystemSuspend`/`onSystemResume`/`onBeforeQuitFlush` return `removeListener` disposers; `useElectronBridge` returns an aggregate disposer |
| Root unmount disposes owned resources | OK — `onUnmounted` now stops `combatClockSource` (rAF loop or main-process IPC) and runs `electronBridgeDispose`; pre-existing coordinator/adapter/asset disposal retained; double-subscribe prevented on second 'entered' |

## Files changed

Production (8): `src/composables/useAppLifecycle.ts`,
`src/presentation/clock/RafClockSource.ts`,
`src/presentation/host/useDynamicRegion.ts`,
`src/components/game/PhaserCanvas.vue`,
`src/presentation/assets/AssetBundleManager.ts`,
`src/composables/useElectronBridge.ts`, `electron/preload.ts`,
`src/App.vue`.

Tests (6): `useAppLifecycle.test.ts` (+6 L04 cases),
`RafClockSource.test.ts` (+2), `useDynamicRegion.test.ts` (+3),
`PhaserCanvas.test.ts` (+3, jsdom `ResizeObserver` stub),
`AssetBundleManager.test.ts` (+4),
`useElectronBridge.test.ts` (new, +3).

## Known failures (all pre-existing, not caused by this diff)

1. `GameManager.perfectClear.feasibility.test.ts` — 3 failures this run
   (multi-hit floors 5/9/10; floor 1 borderline, up to 4 known). Documented
   playtest debt — roadmap wave-4 item "perfectClear feasibility quarantine
   (`it.fails`, playtest debt per user ruling)" is PENDING. File untouched;
   `src/core/**` is outside this diff entirely.
2. `tests/architecture/eslintCoreSeverity.test.ts` — 60s timeout under
   full-suite load (shells out to real ESLint; documented caution in
   `docs/superpowers/specs/2026-09-11-frontend-static-dynamic-boundary-design.md`).
   Isolated rerun: 2/2 pass in 1.7s. Known flake, not a defect in this work.

## Review round 1 (independent review → changes applied)

**Important — unmount-time save was dead code.** The new `stopped` gate on
`persistProgress` killed the documented final flush: the composable's
`onBeforeUnmount(stopAll)` runs strictly before `App.vue`'s `onUnmounted`
body reaches `persistProgress()`, so "persist first so a development reload
cannot roll the player back" could never fire. Fixed by dropping `stopped`
from `persistProgress`'s gate (kept on `bootGame`/`startTickLoop`/
`startAutosave`). Justification: every listener/interval-driven persist
caller is removed by `stopAll` anyway — the only post-stop caller is the
explicit unmount flush. `persistenceSuppressed`, `entryStage`, and
`saveInFlight` guards unchanged (reset-save flow still correctly suppressed).

**Minor — grant-less save on skipped boot.** `onCharacterCreated` saved
unconditionally after `bootGame(true)`; a `'skipped'` outcome means
`onNewCharacter` grants (technique/skill/buildings/starter materials) never
ran, so the save would record an incomplete character. `App.vue`'s
`bootGame` now returns the `BootOutcome`, and the save runs only on
`'entered'` — this also correctly drops the duplicate save on double-invoke
and the bogus save on `'failed'`.

**Regression coverage added:**
- `useAppLifecycle.test.ts` — mount-level ordering test: real `createApp`
  mount whose `onUnmounted` calls `persistProgress()` (mirroring App.vue),
  asserting `persistPlayer` fires after `stopAll` already ran. Plus the
  fence test updated: post-`stopAll` `persistProgress` now asserts the save
  DOES run (deliberate contract), while timers/listeners stay dead.
- Skipped-boot no-save lives in `App.vue`'s `onCharacterCreated` glue —
  not unit-mountable cheaply; covered by the composable's `'skipped'`
  outcome tests + this documented gate.

**Re-verification:** `npm run type-check` exit 0;
`npx vitest run src/composables src/presentation src/App.wiring.test.ts src/components/game/PhaserCanvas.test.ts` → 46 files / 333 tests green
(useAppLifecycle 18/18, App.wiring 28/28, useElectronBridge 3/3).

## Deferred / notes

- **P14 browser check deferred** — isolated-worktree exception
  (`.agent-worktrees/**`): browser launch unreliable here. Requires
  live-browser confirmation during branch finishing: boot → combat route →
  unmount/remount cleanliness, host retry UX, no ghost rAF loop.
- `onCharacterCreated`'s post-boot save in `App.vue` fires only on
  `'entered'` (see Review round 1 — a `skipped` boot never ran the starter
  grants, so saving would record an incomplete character).
- `waitForLoaderScene` resolvers pending at `setLoaderScene(null)` stay
  pending (unchanged); their `ensureLoaded` callers carry abort signals.
- No commits made; worktree left commit-ready.
