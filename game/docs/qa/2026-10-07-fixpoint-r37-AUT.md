# Fixpoint r37 — AUT (adversarial) audit of `796df2ee`

Auditor: AUT (exploit hunter). Audited commit: `796df2ee` on
`codex/hoa-cau-fireball-vfx` (the full r36 adjudication). Method: assume
every r36 fix is exploitable, attack the fixes first, then siblings of each
class (adjacent latches, adjacent admission arms, adjacent timer paths).
Every claim verified against the checked-out source; confirmations carry
executed repros in `src/services/save/auditR37Aut.probe.test.ts` (16 tests,
all passing under `npx vitest run <file> --pool=threads`).

## Verdict

**PASS WITH EVIDENCE** — 2 Low + 1 Nit confirmed; no Critical/High/Medium.
All eight r36 mechanisms hold against their assigned attack vectors;
rejected candidates are enumerated at the bottom with their kill evidence.
The confirmed findings are sibling-class residuals, not defeats of any r36
fix.

---

## Confirmed findings

### r37-AUT-1 (Low) — the boundary-queue drop silently eats a session-scoped `battleManualMode` flip: a mid-turn toggle whose in-flight turn ends the battle never lands, and the stale flag persists into the next battle

`setBattleManualMode` queues the flag write through
`enqueueAtTurnBoundary` (`GameManagerTurnBattleOps.ts:2644-2646`) — the
battle-scoped queue that is cleared without draining at combat-over
(`boundaryQueue = []` inside `onTurnDrained`, :1012) and at every cycle
teardown (`clearCycleEntryState`, :1633). But the flag it writes
(`CombatAnimationRuntime.battleManualMode`, :59) is **session-scoped**: it
is not in `resetPendingState` (:546-554) and is read at claim time by
`tickPacing` (`manualMode: isBattleManualMode()`, :574).

So a session-scoped user intent is routed through a drop-on-death
battle-scoped queue. Concretely: the player toggles manual mode during the
battle's final turn; the turn resolves into COMBAT_OVER; the queued write
is discarded; the next battle — including an auto-repeat restart — claims
with the pre-toggle flag. A dropped *disable* leaves the next battle
parking player claims at AWAITING_INPUT the player turned off; a dropped
*enable* silently keeps auto. The user recovers by toggling again.

Executed repro (probes F1/F2/F3):

- F1: mid-turn `setBattleManualMode(true)` with a killing ACK drain →
  victory → `isBattleManualMode()` still `false` — the queued flip died
  with `boundaryQueue`.
- F2 (control): the identical queued flip on a non-terminal turn survives —
  `drainBoundaryQueueIfIdle` (:549) lands it at the next boundary. The drop
  is specifically the combat-over clear, not a general queue failure.
- F3: `battleManualMode` persists across `startBattleWithPlayer` verbatim —
  so whatever (stale) value survives the drop is what the next battle
  claims against.

Reachability: requires toggling during the battle's terminal turn (one
turn of window per battle), user-visible as a silently ignored toggle;
self-healing. Low.

### r37-AUT-2 (Low) — the curtain arm gate reads clock state only: `isCombatActive` passes for a 'frozen' clock with no battle, so the screen-unconditional `CombatPauseOverlay` can arm over a different screen

`useCombatPause`'s gate is `options.isCombatActive()` →
`getCombatClockState() !== 'stopped'` (`App.vue:491` wiring). `'frozen'`
passes the gate even when no `turnBattle` exists — the accepted zombie
residual (boot-fail / rejected-restore arms keep a latched clock,
`useAppLifecycle.ts:738-739` comment pins this as deliberate). On a hidden
tab the handler then latches `'tab-hidden'` AND sets `isPaused`, and
`CombatPauseOverlay v-if="isCombatPaused"` (:1296) renders a
"combat paused — continue" curtain over whatever is actually on screen —
an error/entry surface with no battle to continue into. `continueBattle`
dismisses it (the zombie stays 'authority-pause'-frozen, as before).

The same gate shape has a live-battle variant: a `'not-revealed'`-latched
battle while the player sits on a non-combat screen — clock `'frozen'` →
hide → curtain arms over that screen. That variant is defensible (the
pause described is real; the spec wants acknowledgement before resuming);
the battle-less-zombie variant has no legitimate reading.

Executed repro (probes E1/E2, composable level with a stubbed
`document.visibilityState` + the App.vue gate predicate verbatim):

- E1: owner reporting `'frozen'` (no battle needed) → `visibilitychange`
  → `isPaused` true + `freezeCombat('tab-hidden')` called — the curtain
  arms.
- E2 (gate control): owner reporting `'stopped'` → no arm.

The r36 teardown watch (`App.vue:514-518`) still works correctly — it
clears the flag when `'tab-hidden'` leaves the reason set. The finding is
in the arm gate, upstream of it. Reachability requires the already-
accepted zombie residual or a live off-screen battle + tab hide; cosmetic,
one-click dismiss → Low.

### r37-AUT-3 (Nit) — the `isBlocking()` deferral re-arm leaks its just-fired timer handle; `pendingStepTimers` is not "live timers only" on that arm

The admin-latch arm (:878-883) splices the fired handle before pushing the
re-arm (the r36-COR-1/INT-3 fix). The deferral arm directly below it
(:886-891) pushes a fresh handle without splicing, so each fire leaves one
dead handle in `pendingStepTimers`. Bounded: `deferredMs` accumulates to
`AWAIT_STEP_DEFERRAL_CAP_MS` (`= ANIMATION_FALLBACK_MS * 8`, :131) so at
most ~8 dead handles per step-arm, all swept by `clearPendingSteps`; the
array only ever feeds `clearTimeout` calls, so dead handles are inert.

Executed repro (probe G1): parked step + re-held session → 3 deferred
fires → `pendingStepTimers.length` grows 1 → 4 (vs. the admin arm staying
flat at 1, pinned by r36 probe C1).

Nit — literal violation of the fix's stated invariant on one arm, zero
functional impact.

---

## Rejected candidates (verified clean on `796df2ee`)

1. **Same-generation stale-fallback wipe** (the r36-AUT-2 epoch guard's
   own edge — "a consumed step's queued fallback fires into a RE-ARMED
   same-signal settle"): killed by construction — `beginTurnPipeline`
   calls `clearPendingSteps` at its head (:775), so every pipeline is a
   new epoch; within one epoch a signal arms at most once, so there is no
   same-generation same-signal re-arm to wipe. What remains is the
   consumed-step fallback itself: probes A1/A2 pin that a
   double-dispatched `'ready'`/`'impact'` closure post-ACK-settle touches
   only its own already-`undefined` map key, drives `acknowledge*` onto
   consumed pending fields (rejected on `!pendingX`), and its `done()` is
   pipeline-idempotent — the armed other-signal settles, hp, declare
   count, and `turn_cast_start` emissions all unchanged. Probe A3 pins
   the underlying invariant (epoch strictly increases per claimed turn).
2. **`'user-pause'` crafted inside the restart window**: killed — the
   snapshot+filter (`getFreezeReasons().filter(r => r !== 'user-pause')`,
   :2111-2113) is the last act of the synchronous `beginBattleCycle`; a
   freeze injected *inside* the cycle via the `presentation_session_started`
   emit (:2094, fires between `turnToken.reset()` and the snapshot — the
   exact window the prompt isolated) is still filtered (probe B1). A
   post-cycle `'user-pause'` freeze is a legitimate new latch on the new
   clock (probe B2). `CombatTopBar`'s `watch(battle)` reads a
   `stateVersion`-driven computed, so it fires on battle-identity change —
   the rationale for dropping the carry is accurate.
3. **Source-swap orphaning the latch (`setCombatClockSource`)**: killed —
   reasons are plain strings re-frozen verbatim on the new instance; the
   token listener closes over `this.combatClock` (live read), so a
   post-swap resolve resumes `'turn-in-flight'` on the new clock and a
   reconnect `resumeCombat('authority-pause')` unlatches it there (probe
   C1: swap under `'authority-pause'` + in-flight turn → drain completes →
   resume → `'running'`). Stopped stays stopped (probe C2). The one
   theoretical gap — a `ClockSource` that fires `onFrame` synchronously
   inside `start()`, leaking one step before the re-freeze loop — has no
   instance in the codebase: `RafClockSource` is RAF-driven and
   generation-fenced, `MainProcessClockSource` is IPC, `ManualClockSource`
   is caller-driven. Recorded as a contract note for future sources.
4. **ACK-drain exceeding the in-flight turn's residual / landing on a
   different owner / surviving a discard** (r36-AUT-1 bounds): killed on
   all three axes — (i) per-turn `playbackToken` + per-phase consumed
   fields + `isSessionBlocking()` gate every ack; `''` is falsy so the
   post-reset token state rejects at `!token`; (ii) restore+discard are
   synchronous inside `onResume`/`restoreCheckpoint` with no interleave
   point — mints before the restore land on the soon-replaced owner and
   evaporate with it; (iii) post-swap stale tokens are rejected against
   the new `playbackToken` (probe D1 — no mint, no cast emit, token stays
   RESOLVING).
5. **Multiple terminal settlements through the ACK channel** (victory →
   restart → new claim → second drain): killed — `battleEndEmitted` is a
   once-per-cycle guard (`GameManagerBattleRewardOps.ts:24/44/66/122`);
   post-resolution ACKs with the *same* still-live token bounce off the
   consumed `pendingImpact` field (probe D2 — `battle_end` count stays 1,
   `totalTurnsElapsed` stays 1, clock stays `'stopped'`). A restarted
   cycle under a latch mints frozen — the second claim cannot start while
   latched, so no second pending set ever exists.
6. **Curtain teardown gap — stuck `isPaused` with `'tab-hidden'` absent**:
   killed — every teardown path (`discard`, `abandonBattle`, combat-over
   `stop()`) clears the reason set, and `bumpState` runs on every mutation
   + the per-second tick, so the `watch(stateVersion)` clears the flag
   within one flush. The surviving arm-side gap is reported as
   r37-AUT-2.
7. **`EarlyGameSession.restoreCheckpoint` discard ordering** (r36-AUT-3
   fix): holds — `restoreGameSession` is fully synchronous, the
   `'ok'`→`discardStaleBattle()` pair is atomic w.r.t. any drain, the
   discard gen-bumps pending steps and wipes pending playback (probe H1:
   mid-park restore → battle null, token IDLE, `playbackToken` null, clock
   `'stopped'`, player repointed). The `'rejected'` arm correctly leaves
   the old owner + old battle intact — a partial mid-restore throw leaves
   a torn-but-owned `$state` behind the live battle, same class as the
   accepted boot-fail zombie residual (bounded by the retry sweeping it).
8. **Terminal flip mid-park → pipeline wedge**: unreachable — every
   `battle.state` flip is either pre-claim (`tickPacing` victory :1320
   returns before `claim`), inside a step's own consumed settle
   (`completeAction` :4085/:4091, `resolveNextStep` :4183/:4188 headless-
   lane only), behind a `clearPendingSteps` bump (`abandonBattle`,
   `discard*`, pre-commit terminalize), or gated on `'fighting'` +
   `roundsElapsed >= survivalRounds` where reaching the threshold requires
   a `declareActorAction` whose own step-tail `settleCombatOutcome` already
   settled the trial before the next claim can park (`settleHiddenTrialIfDue`
   cannot newly flip during a park). The dead-battle drop arm therefore
   never observes a live parked entry.
9. **Deferred-complete token crossing a swap**: `deferredCompleteToken` is
   stored and drained inside `acknowledgeActionImpact`'s synchronous
   `publishingImpact` window (:419-421 + drain) — no interleave exists;
   `resetPendingState` clears it (:553).
10. **`pauseForManualActor` + `submitTurnChoice` under latch**: consistent
    — the runtime gates the submit on `isSessionBlocking` (:453), so a
    held session rejects (not queues) the choice and the token stays
    AWAITING_INPUT for the UI to answer post-release; a released session
    accepts and the impact/complete steps drain like any auto turn
    (finish-the-swing parity).
11. **Zombie re-arm loop in the admin-latch arm**: the re-armed fallback
    keeps `pendingStepDone[signal]` armed across the park; on release the
    drive arm consumes-or-rejects idempotently; the array stays flat
    (splice verified — `timer` still holds the just-fired handle at
    `indexOf` time). The sibling gap on the deferral arm is r37-AUT-3.
12. **`enqueueAtTurnBoundary` immediate-run during latch**: only caller is
    `setBattleManualMode` (:2644); token-IDLE execution writes an inert
    flag. Its queue-drop is r37-AUT-1.
13. **`drainPendingPlayback` double-drive**: fires all three
    `stepCompletionSink` hooks; already-settled signals no-op on the
    undefined map key; subsequent steps re-arm under their own caps —
    bounded self-completion (~1 cap per step).
14. **`pendingCycleRng` stale box after a failed cycle**:
    `commitCycleRng(this.pendingCycleRng?.stream ?? mintCycleRng())` — an
    unresolved box collapses to a fresh mint; a resolved-but-orphaned
    stream requires a throw inside committed steps 1-2 (injected-fault
    class), and the stream is a determinism flavor, not a safety boundary.
    Not a finding.

## Probe inventory

`src/services/save/auditR37Aut.probe.test.ts` — 16 tests, node env,
deterministic (`Math.random` pinned to 0; `vi.useFakeTimers()` for
wall-clock arms; `setTimeout` queue-captured for the uncancellable-task
edges; `document` stubbed for the composable gate):

- A (3): same-generation stale-fallback no-ops (ready + impact signals,
  double dispatch) + per-turn epoch increment pin.
- B (2): mid-cycle crafted `'user-pause'` filtered; post-cycle freeze
  roundtrips.
- C (2): mid-reconnect source swap preserves latches on the new instance
  and resume unlatches there; stopped stays stopped.
- D (2): stale-token ACKs rejected across a restart; live channel cannot
  mint a second terminal settlement.
- E (2): curtain arms on `'frozen'` clock without a battle (finding
  r37-AUT-2); `'stopped'` gate control.
- F (3): queued manual flip dropped at combat-over (finding r37-AUT-1);
  non-terminal control; session-scoped persistence pin.
- G (1): deferral-arm dead-handle accumulation, bounded (finding
  r37-AUT-3).
- H (1): `EarlyGameSession.restoreCheckpoint` sweeps a parked battle —
  token, playback token, clock, player repoint all verified.
