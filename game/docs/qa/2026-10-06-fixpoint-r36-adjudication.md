# Fixpoint r36 — adjudication

Wave r36 blind audit of r35 adjudication commit `bb7bc574`
(`codex/hoa-cau-fireball-vfx`). Auditors: COR / AUT / INT.

## Verdicts

| Role | Verdict | Findings | Report |
|------|---------|----------|--------|
| COR | PASS WITH EVIDENCE | 0C / 0H / 0M / 1L / 2N | `2026-10-06-fixpoint-r36-COR.md` |
| AUT | FAIL | 0C / 0H / 1M / 2L / 2N | `2026-10-06-fixpoint-r36-AUT.md` |
| INT | FAIL | 0C / 0H / 1M / 1L / 2N | `2026-10-06-fixpoint-r36-INT.md` |

COR and INT independently converged on the same three seams (dead-handle
churn in the admin-latch park, the `setCombatClockSource` reason wipe, and
the 'user-pause' owner-desync on carried latches); AUT's two Nits are the
same two seams, and its Medium is the only live finding the wave produced
beyond them - an adjudicated contract-honesty case, not a new hole.

## Fixed

### F1 — 'user-pause' carried into a new battle while its owner already reset (r36-INT-1 Medium + r36-COR-3 Nit — converged)

The r35-AUT-2 latch-preserving restart is correct for latches whose owner
flags are session-scoped ('authority-pause' — `useAppLifecycle.simPaused`,
'tab-hidden' — `useCombatPause.isPaused`), but wrong for 'user-pause':
`CombatTopBar`'s `watch(battle)` resets `userPaused` on battle identity
change WITHOUT calling `resumeCombat`, and its unmount release never runs
during a restart (the bar stays mounted inside `CombatTopRail`). A cycle
minted while user-paused started frozen behind a pause button rendering
"unpaused" — a silent frozen farm reachable by pausing right before the
killing blow lands with `repeatContinuously` on.

Fix: `beginBattleCycle` step 7 filters 'user-pause' out of the carried
snapshot (`GameManagerTurnBattleOps.ts` ~:2063). The latch dies with the
battle it was taken on — identical to the pre-carry semantics the UI
already assumed. Session-scoped latches still carry verbatim; the
pipeline's own pair ('turn-in-flight', 'not-revealed') remains exempt /
re-derived as before. Probe flips: COR D4 + INT A1 now assert
`running`/`[]` post-restart.

### F2 — `setCombatClockSource` wiped every freeze reason on source swap (r36-COR-2 Nit + r36-INT-4 Nit — converged)

Same `stop()+start()` defect class r35-AUT-2 closed in `beginBattleCycle`,
on the sibling seam: `wasRunning = state !== 'stopped'` counted 'frozen'
as running, `stop()` cleared the reason set, and the new `CombatClock`
started empty — a mid-latch swap (test/sim callers; production's only
call is App.vue init on a stopped clock) silently unfroze a latched clock
and even dropped 'turn-in-flight' while its token stayed claimed.

Fix: snapshot `getFreezeReasons()` before `stop()` and re-`freeze()` each
verbatim after `start()` — same battle, same owners, no boundary crossed.
Probe flips: COR E + INT D1 now assert the frozen set survives the swap
(including 'turn-in-flight' — the token listener re-binds, it does not
re-claim, so preserving the reason is what keeps the claim coherent).

### F3 — admin-latch park re-arm grew `pendingStepTimers` one dead handle per fire (r36-COR-1 Low + r36-INT-3 Nit — converged)

The r35-AUT-1 administrative gate re-arms `setTimeout` every
`ANIMATION_FALLBACK_MS` while a step is parked under an administrative
latch, and pushed each new handle into `pendingStepTimers` without
removing the just-fired (dead) one. On the designed wedge — a frozen
zombie battle kept latched after a rejected restore — that is ~21,600
dead handles/day (memory-only; `clearPendingSteps` drains the array
wholesale on the next pipeline/cycle entry/discard, and the live timer
was always the closure's own `timer` var, so no double-fire channel ever
existed).

Fix: splice the fired handle out before pushing the re-armed one —
`pendingStepTimers` now holds live timers only and stays flat under a
permanent wedge. Probe flips: COR C1 + INT D2 assert the array length is
unchanged across 10 fires.

### F4 — the 'Continue' curtain outlived the battle that latched it (r36-INT-2 Low)

`useCombatPause.isPaused` drives the `CombatPauseOverlay` and is cleared
only by a visible-transition or `continueBattle` — but 'tab-hidden' dies
on `combatClock.stop()`, which cannot reach the composable ref. A discard
(boot re-entry / reconnect-'replaced' / reset) or `abandonBattle` while
the overlay was up left a stale curtain over the post-teardown session:
the new battle ticked beneath it until the user clicked Continue.

Fix: `App.vue` watches `stateVersion` (bumped by every `bumpState()` —
the per-second tick plus every panel mutation — so it covers all
teardown paths) and clears `isCombatPaused` the moment 'tab-hidden' is
no longer in `getFreezeReasons()`. A legitimate carry across an
auto-repeat restart keeps the curtain while its latch lives (the reason
survives — only 'user-pause' is filtered, F1), so no false-clear. Probe
pin: INT E source-asserts the watch + flag-clear + the overlay binding.

### F5 — stale-cycle fallback closures invalidated by a cycle epoch (r36-AUT-2 Low)

`pendingStepDone` is signal-keyed with no cycle binding, and
`clearPendingSteps` can only `clearTimeout` handles - a fallback callback
already dequeued into the macrotask queue cannot be cancelled. AUT's
queue-captured repro: a cycle-N fallback firing after the cycle swap wiped
the NEW battle's parked settle (`pendingStepDone[signal] = undefined`) and
drove the new turn's declare early via the current playbackToken
(self-healing via the new step's own fallback; no mint, ordering violation
only). Fixed with a `pendingStepGeneration` epoch: `clearPendingSteps`
increments it (before wiping), `awaitStep` captures it at arm, and the
fallback closure early-returns on mismatch - a stale fire can no longer
touch the new cycle's map or token in ANY arm (drop, gate, deferral,
drive).

### F6 — `EarlyGameSession.restoreCheckpoint` rewrote `$state` with no discard (r36-AUT-3 Low)

A third in-place-rewrite seam of the r34/r35 ghost class:
`restoreGameSession` + `Object.assign` onto an owner the live battle's
bindings alias - no discard afterward. Sim/test-harness only (no
production path), but the contract is identical: a successful restore now
calls `discardStaleBattle()` before the session re-points `this.player`.

## Exceptions (recorded, not fixed)

| Finding | Severity | Reason |
|---------|----------|--------|
| r36-AUT-1 — the renderer-ACK channel (acknowledge*) drains the claimed turn under an administrative latch | Medium | **Accepted as designed (finish-the-swing).** The r35-AUT-1 gate's job was to stop NEW work and ghost drains on the wall-clock channel - both hold. The ACK channel completes the turn already claimed: bounded to in-flight residual, same-owner mints on 'same' lineage, evaporates under the restore sweep on 'replaced', unreachable during boot awaits (scene unmounted, no RAF) and 'tab-hidden' (RAF starved). Gating acknowledge* on freeze reasons would strand ACKs already consumed by the runtime and add resume latency without changing any adversarial outcome. Both sibling auditors verified the same seam as designed (INT rejected-candidates: 'the claimed turn completes so the pipeline can drain'; COR C5 pins `settleStep` completing mid-latch). What was dishonest was the contract language - the awaitStep comment and the r35-B probe name now say the gate covers the wall-clock channel only. |

## Probe flips (pins updated to the new contract)

- `auditR36Cor.probe.test.ts` C1 — admin park re-arms keep the handle
  array flat (was: `+3` dead handles across 3 fires).
- `auditR36Cor.probe.test.ts` D4 — 'user-pause' dies with its battle:
  post-restart `running`, reasons `[]`, steps advance (was: carried
  latch freezing the new battle).
- `auditR36Cor.probe.test.ts` E — source swap preserves the reason set
  verbatim (was: wipe to `[]` + 'running').
- `auditR36Int.probe.test.ts` A1 — 'user-pause' does not carry; new
  battle runs with `[]` (was: carried + frozen).
- `auditR36Int.probe.test.ts` A4 + B — freeze 'authority-pause' instead
  of 'user-pause' so the carried-latch pins keep exercising the session-
  scoped carry path.
- `auditR36Int.probe.test.ts` D1 — swap preserves `['turn-in-flight',
  'user-pause']`, clock stays frozen, admin gate still parks the
  fallback until release (was: wipe + ungated drain).
- `auditR36Int.probe.test.ts` D2 — wedged-zombie handle array flat
  across 10 fires (was: `>+5` growth).
- `auditR36Int.probe.test.ts` E (new) — source pin for F4: the
  `watch(stateVersion)` teardown, the 'tab-hidden' check, the flag
  clear, and the `v-if="isCombatPaused"` binding.
- `auditR36Aut.probe.test.ts` B1 — stale-cycle fallback is now a
  provable no-op: the new parked settle survives, no early declare, no
  `turn_cast_start` emit; the live fallback still heals the park
  (was: settle wiped + declare driven early).
- `auditR36Aut.probe.test.ts` C1 — handle array flat under an admin
  park (was: >=4 entries after 3 fires).
- `auditR36Aut.probe.test.ts` C3 — selective carry pinned end-to-end:
  'authority-pause' carries, 'user-pause' dies, 'not-revealed'
  re-derives, 'turn-in-flight' absent (was: 'user-pause' carried).
- `auditR36Aut.probe.test.ts` A1-A3 — unchanged, now pin the accepted
  finish-the-swing contract (ACK drain under latch, latch survives).
- `auditR35AUT.probe.test.ts` B-name — 'frozen means frozen on every
  channel' renamed to 'frozen on the wall-clock channel' (honesty fix
  for the accepted ACK drain).

## Verification

- `npm run type-check` — clean.
- `npx vitest run src/services/save src/composables tests/architecture
  --pool=threads` — 2921 passed / 7 expected-fail / 12 skipped.
- `npx vitest run src/core/game --pool=threads` — 1015 passed
  (one pre-existing flake: `GameManager.talentv4.qa.test.ts` A0 'hoa_an'
  buff landing is RNG-sensitive under pool contention; passed 1015/1015
  on re-run and 3/3 isolated runs — unrelated to the latch/timer diff).
- `npx vitest run src/core/simulation/earlygame + r25/r26-Int probes +
  CultivationTick --pool=threads` — 109 passed (the restoreCheckpoint
  discard breaks no journey sim).
- r36 probes (3 files) + `auditR35AUT` — 50/50 green post-flip.
- `npx eslint` on every touched file — clean.
- P15: all new comments plain ASCII.

## Loop status

r36 is NOT an empty wave (1 accepted-Medium contract-honesty case +
5 fixed findings across the three auditors, with AUT's two Nits being
duplicates of F2/F3). Wave r37 dispatches on the r36 adjudication commit.
