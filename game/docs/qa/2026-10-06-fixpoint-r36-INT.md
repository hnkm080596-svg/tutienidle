# Fixpoint r36 — INT (integration coherence)

Wave r36 blind audit of the r35 adjudication commit `bb7bc574`
(`codex/hoa-cau-fireball-vfx`). Role: INT — verify the five r35 changes
still agree with each other and their consumers. Probe evidence:
`src/services/save/auditR36Int.probe.test.ts` (9 tests, all green:
`npx vitest run src/services/save/auditR36Int.probe.test.ts --pool=threads`).

## Verdict: FAIL — 0C / 0H / 1M / 1L / 2N

## Confirmed findings

### R36-INT-1 (Medium) — 'user-pause' survives the auto-repeat restart while its UI owner resets → silent frozen farm with an "unpaused" icon

The r35-AUT-2 latch-preserving restart is correct for 'authority-pause' and
'tab-hidden' (their owner flags are session- or tab-scoped and persist
across battle identity), but wrong for 'user-pause' — the one reason whose
owner lifecycle is battle-scoped.

Mechanism chain (probe A1/A4 reproduces every step deterministically):

1. User pauses mid-turn: `CombatTopBar.togglePause` →
   `gameManager.freezeCombat('user-pause')` (`CombatTopBar.vue:97-103`).
2. The in-flight turn still completes — `CombatAnimationRuntime.acknowledge*`
   (`CombatAnimationRuntime.ts:265/322/418`) gates ONLY on
   `isSessionBlocking()`, not on freeze reasons. By design the ACK channel
   finishes the claimed turn; this is what makes the window reachable.
3. That turn is terminal (last enemy dies) → `settleCombatOutcome` →
   `restartTurnBattleCycle` → `beginBattleCycle` step 7
   (`GameManagerTurnBattleOps.ts:2063-2069`) snapshots `['user-pause']`,
   runs `stop()+start()`, re-freezes it. Probe A1 asserts:
   `getFreezeReasons()` on the NEW battle is exactly `['user-pause']`,
   clock 'frozen', `getTurnTokenState()` 'IDLE'.
4. `beginBattleCycle` mints a NEW `TurnBattle` object → CombatTopBar's
   `watch(battle)` (`CombatTopBar.vue:110-112`) fires on the identity
   change and sets `userPaused.value = false` WITHOUT calling
   `resumeCombat`. Its comment at :108-109 — "a stale 'user-pause' never
   leaks into the next battle" — is now stale: the leak is exactly what
   happens. CombatTopBar mounts unconditionally inside CombatTopRail
   (`CombatTopRail.vue:11`), so `onUnmounted` (:117-121, the release path)
   never runs during a restart.

Result: the repeated battle sits frozen on 'user-pause' with the pause
button rendered unpaused. Nothing on screen explains why the farm stopped;
the user must double-toggle (freeze → resume) or remount the component to
flush the orphan reason. Probe A4 shows the new battle takes zero ticks
while the carried latch holds and resumes the moment it is released.

Reachability: user pauses while a turn is in flight AND that turn ends the
battle AND `repeatContinuously` + live stage lease hold — a narrow but
normal sequence (pause right before the killing blow lands). Not gated by
'tab-hidden' starvation: user-pause keeps RAF alive, so the ACKs arrive.

Sibling check — the other two external reasons carry coherently:
'authority-pause' is owned by `useAppLifecycle.simPaused` (session-scoped;
`resumeSimulation` releases it post-restart — probe A2); 'tab-hidden' is
owned by `useCombatPause.isPaused` (persists; Continue releases it — probe
A3). Only 'user-pause' pairs a battle-scoped flag with a clock-scoped latch.

Fix direction (coordinator's call): either re-derive `userPaused` from
`getFreezeReasons()` on battle change instead of blind-resetting, or scope
the step-7 carry to reasons whose owners are not battle-scoped (i.e.
exclude 'user-pause' from the snapshot since its owner resets anyway).

### R36-INT-2 (Low) — `useCombatPause.isPaused` has no teardown channel: stale 'Continue' curtain outlives the battle that set it

`useCombatPause` (`useCombatPause.ts:44/53`) drives 'tab-hidden' both ways
from `document.visibilitychange`, and `isPaused` is cleared only by the
visible-transition or by `continueBattle`. `discardInFlightBattle`'s
`combatClock.stop()` clears the reason but cannot reach the composable ref
— and neither can `abandonBattle`'s `stop()` (`:2526`) or the non-repeat
combat-over `stop()` (`:1019`).

Aftermath: `CombatPauseOverlay` (`App.vue:1284`, `v-if="isCombatPaused"`)
stays mounted over the post-discard session or the next battle. The new
battle starts clean (snapshot empty → clock 'running' post-reveal) and
ticks beneath the curtain until the user clicks Continue — an unwatched
time window between reveal and the click.

Reachability: tab-hidden pause + reconnect-'replaced' discard (or boot
re-entry / reset-save while the overlay is up). The hidden-tab terminal
under a frozen clock is NOT a second path — renderer ACKs are RAF-starved
while hidden, so the in-flight turn stays parked (the admin gate then owns
it). Self-healing on the user's Continue click; bounded.

Fix direction: expose a teardown hook (e.g. `useCombatPause` watches the
battle/pause-activity gate and drops `isPaused` when there is nothing left
to pause), matching the contract the r34 boot discard already pins.

### R36-INT-3 (Nit) — the parked-forever admin gate accumulates dead timer handles on a permanently wedged zombie

r35-AUT-1's administrative latch gate re-arms `setTimeout` and pushes the
handle into `pendingStepTimers` (`:843/:850`), which is only ever emptied
by `clearPendingSteps` (`:898-905`). On the designed wedge (a zombie battle
kept frozen after a rejected restore — its unlatch never runs by design)
the gate re-arms every `ANIMATION_FALLBACK_MS` (4s) forever: probe D2 shows
the array grows monotonically while `vi.getTimerCount()` stays ≤ 8 (only
one live timer per parked step — the leak is the dead-handle array plus
timer churn on a dead battle, ~21,600 entries/day).

Bounded, no functional wrongness; listed so the wedge's footprint is known.

### R36-INT-4 (Nit) — `setCombatClockSource` is the same stop()+start() class AUT-2 fixed, without reason preservation

`:395-408` — `stop()` clears the whole reason set on the old instance and
the new `CombatClock` starts empty. `attachTurnTokenToClock` re-binds the
listener but `onStateChange` only fires on FUTURE transitions, so a mid-turn
swap loses 'turn-in-flight' too: token stays claimed, clock runs anyway.
Probe D1: after the swap `getFreezeReasons()` is `[]`, state 'running',
and the parked fallback — now ungated — drives the step through on the
next real-time tick, bypassing the AUT-1 gate entirely.

Reachability today: none in production (App.vue installs the source once at
setup, before any latch exists); reachable only from tests/sim tooling.
Recorded so any future caller that swaps sources mid-session knows the
seam exists.

## Rejected candidates (verified coherent — do not re-audit)

- **Synchronous restart vs the 'stopped' drop arm** — `beginBattleCycle` /
  `beginBattleCycleCommitted` contain no `await`/`yield` between
  `clearCycleEntryState` (:1790) and step 7 (:2063): JS run-to-completion
  means no parked timer can interleave inside the window, and every old
  `pendingStepTimers` handle is `clearTimeout`'d at entry before the new
  clock starts. Probe B1: ten fallback windows post-restart settle nothing
  and fire nothing on the new battle.
- **'turn-in-flight' in the step-7 snapshot** — impossible:
  `clearCycleEntryState` runs `turnToken.reset()` → `setState('IDLE')` →
  the `attachTurnTokenToClock` listener releases the reason BEFORE the
  snapshot is taken. Probes A1-A3 assert the post-restart set is exactly
  the external latch — no double-latch, no premature release.
- **Reconnect discard vs boot discard parity** — both call sites delegate to
  `discardInFlightBattle`; identical aftermath by construction (probe C1
  pins the surface under a latched ghost: 'stopped' clock, `[]` reasons,
  IDLE token, `getBattleBuffs` → `[]`). Both run before their arm's unlatch
  (`resumeSimulation` / bootGame's `:757` release), and the unlatch is a
  documented no-op on the 'stopped' clock — consistent either way.
- **`getBattleBuffs` `[]` post-discard** — every consumer iterates
  live-battle entity ids (`useTurnBattleInfo.buffsForTarget`,
  `BattleMetrics`, theBarBridge); a null battle yields no ids to query, and
  the `?? []` answer is the same shape those consumers already handle.
- **Latch-owner pairing under the admin gate** — each of the four external
  producers has exactly one owner that also unlatches: 'authority-pause' ↔
  pauseSimulation/resumeSimulation + bootGame :757; 'tab-hidden' ↔
  useCombatPause; 'user-pause' ↔ CombatTopBar; 'turn-in-flight' ↔ the
  token. Latch reasons are per-reason sealed — a UI un-pause can never
  unlatch 'authority-pause', and post-discard resume calls are no-ops on
  'stopped'. The failed-arm wedge (rejected restore keeps the zombie
  frozen forever) is the designed seal.
- **ACK channel ungated by latches** — designed seam: the claimed turn
  completes so the pipeline can drain; new time is what the clock gates.
  (Also the thing that makes R36-INT-1 reachable.)
- **`abandonBattle` clears 'user-pause'** — probe C2: abandon's
  `stop()` leaves `[]` reasons, so the restart arm is the ONLY cycle entry
  that can carry the latch; `startStage` after abandon is unreachable as a
  carry path.
- **`deferredMs` frozen during an admin park** — by design: the 8x
  deferral cap resumes counting only after release, and 'not-revealed' is
  owned by the deferral arm, not the admin gate (r35 pins kept green).

## Loop signal

One Medium (R36-INT-1) means the fixpoint has not converged: the r35-AUT-2
carry needs a per-reason scoping decision (battle-scoped owners vs
session-scoped owners) or a UI-side re-derive. Everything else mandated by
the checklist verifies clean.
