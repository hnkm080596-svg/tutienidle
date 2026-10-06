# Fixpoint r34 — Adjudication

**Audited commit:** `db694183` (r33 adjudication: post-admission combat unlatch + inverted-pair drop parity)
**Wave:** COR `5eefc65b`, AUT `07aa6b36`, INT `aea7cee1` — all three reported.
**Adjudication commit:** this commit.

## Verdicts

| Auditor | Verdict | Findings | Actionable |
|---|---|---|---|
| COR | FAIL | 0 C / 0 H / 0 M / 1 L / 3 N | 4 — all fixed |
| INT | PASS WITH EVIDENCE | 0 findings | 0 — first single-auditor empty report of the loop |
| AUT | PASS WITH EVIDENCE | 0 C / 0 H / 0 M / 2 L / 1 N | 0 — all three recorded as exceptions below |

**Aggregate actionable: 4** — all fixed. **Not an empty wave** — the loop continues to r35.

## Fixed

### COR-F1 (Low) — ghost battle resumes into the next character's session

A `TurnBattle` latched under `'authority-pause'` survived the
`deleted`/`empty` → `requireCharacter` → `create` path: nothing ever
abandoned it, `playerDataForTurnBattle`/`activeStageForTurnBattle` bound
the same `player.$state` object `initializeCharacter` reuses, and the
next successful boot's unlatch resumed the stale battle inside the new
character's session — a resolving ghost writing into char B's live
state. Reachable via sign-out mid-battle → re-login → row deleted →
create character, all in one app session. Bounded by the `'not-revealed'`
sibling latch for interactively-launched stage battles, but a
non-blocking-session battle (revealed stage, raw/test, autofarm shim)
actually resumed.

**Fix:** a boot that reaches admission now starts battleless.
`gameManager.discardStaleBattle()` runs immediately before
`authority.markReady()` in `useAppLifecycle.bootGame` — after every fail
arm (so a failed boot still keeps its frozen zombie, the r33 doctrine)
but before the latch clears. The discard is silent: no terminal event,
no banking (`abandonBattle()` was unusable — it banks carry into the
bindings the restore just rebound). Implementation shares the teardown
with `discardFailedCycle()` via a new private `discardInFlightBattle()`
in `GameManagerTurnBattleOps`: clears `turnBattle`, ends the combat
session, stops repeat waves, clears enemy/survive-lethal/cycle-entry
state, `combatClock.stop()` (drops every freeze reason), and releases
the player/stage/status-vfx/reaction/proc bindings.

Probe flips: every pin asserting "successful re-boot resumes the latched
battle" now asserts discard — `auditR34Cor` A18/B/C/D,
`auditR34Int` R2/R3/R5/R6, `auditR33Int` R2/R4, `auditR33Aut` B,
`auditR32Int` R1/R2.

### COR-F2 (Nit) — post-`markReady` tail throw leaves combat unlatched

A sync throw in `clock.start()`/`startTickLoop()`/`boot.enterGame()`
propagated through the `finally`-only `try` as an unhandled rejection —
combat unfrozen behind a non-game surface with no re-latch path
(`pauseSimulation` needs `entryStage === 'game'`). Injected-fault class
only, but the r33 doctrine comment claimed "a failed boot leaves the
battle frozen" while this arm admitted-then-threw.

**Fix:** the success tail is wrapped in `try/catch` — the catch
re-latches `'authority-pause'` via `freezeCombat` before rethrowing.
Post-F1 the discarded battle leaves the clock `'stopped'` regardless, so
the catch's freeze is a no-op on it — strictly deny-direction.

### COR-F3 (Nit) — "out-of-domain stamps park VERBATIM" overstates park coverage

The `<=` drop test runs before the domain check, so inverted
out-of-domain pairs (`{2^52, 2^52}`, `{-Infinity, -Infinity}`, …) drop
rather than park. Strictly-safe direction; claim precision only.

**Fix:** `ProductionSystem.restoreStates` comment now states the
ordering explicitly — the drop test wins over park-verbatim; only
NON-inverted out-of-domain stamps park.

### COR-F4 (Nit) — `authority.beginChecking()` outside the `try`

A throw there would strand `bootInFlight = true` forever — every later
`bootGame` returning `'skipped'` (permanent boot deadlock).
Injected-fault class; pre-existing structure.

**Fix:** `beginChecking()` moved inside the `try`, so the `finally`
releases the guard on any throw.

## Exceptions (recorded, no fix)

| ID | Sev | Claim | Why accepted |
|---|---|---|---|
| R34-AUT-1 | Low | `boot.enterGame()` = one-shot `void coordinator.request('home')` — a rejected request yields `'entered'` with authority admitted but the 'game' surface never mounts | Bounded by the tick/persist `entryStage` gates plus the `'not-revealed'` freeze for any fresh battle; post-F1 no stale battle can be live to exploit the window; self-heals on the next boot. Plumbing a request-result channel into `enterGame` is speculative scope for an unreachable-in-practice route conflict. Deny-direction: nothing writes. |
| R34-AUT-2 | Low | A throwing `markReady` propagates out of `bootGame` leaving the real controller `'ready'` with an armed heartbeat — "zombie admission", no fail card | Injected-fault class — production `markReady` is a pure state transition that cannot throw. Fail direction is safe: the F1 discard already ran so combat stays `'stopped'`, and the `finally` releases `bootInFlight` so a retry re-baselines cleanly. Same class as the accepted uncaught-throw residuals from prior waves. |
| R34-AUT-3 | Nit | `restoreStates` parks out-of-domain/NaN pairs verbatim while sibling `restoreJobs` drops them — doctrine asymmetry | Already-documented r31/r33 accept: a parked non-inverted out-of-domain pair idles only its own channel and is unreachable through any admission gate; the r33 fix closed the inverted-pair class that actually minted. |
| INT | — | PASS WITH EVIDENCE — zero findings | R1-R7 probed: markReady→enterGame window refuses persist; concurrent bootGame resolves 'skipped' with latch intact; corrupted/restore-rejected arms keep the latch; synchronous tail pinned; flatMap drop coherence + boundary matrix verified; ordering-denied entries refuse every subsequent write. |

## Verification

- `npm run type-check` — clean.
- `npx vitest run src/services/save src/core/production src/core/battle src/core/game src/composables src/App.test.ts --pool=threads` — **3925 passed**, 4 expected-fail, 4 skipped (359 files).
- `npx vitest run tests/architecture --pool=threads` — 995 passed (P15 ASCII ratchet included; all new comments plain ASCII).
- `npx eslint` on every touched file — 0 errors (3 warnings: 2 pre-existing `vue/one-component-per-file` in `useAppLifecycle.test.ts`, 1 unused `BOUND` in the auditor's own `auditR34Int` probe — retained verbatim).
- `useAppLifecycle.test.ts` stub gained `discardStaleBattle: vi.fn()` — the 14 prior failures were the partial `gameManager` double missing the new method, not behavior regressions.
