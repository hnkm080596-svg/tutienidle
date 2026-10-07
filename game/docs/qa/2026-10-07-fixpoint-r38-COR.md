# Fixpoint r38 — COR audit of the r37 adjudication (commit de4c4fb4)

Blind correctness audit. Role: COR. Scope: the seven r37 attack claims
(live-handles splice, same-generation settled-check, emit-after-teardown,
foreign 'turn-in-flight' strip, pendingManualMode slot, isCombatActive
gate, r37-COR-5 bound) + sibling seams. Probe file:
`game/src/services/save/auditR38COR.probe.test.ts` — 14 tests, all green
(`npx vitest run src/services/save/auditR38COR.probe.test.ts --pool=threads`).

**Verdict: PASS WITH EVIDENCE** — 0 Critical / 0 High / 1 Medium /
3 Low / 2 Nit. Five of seven claims verified clean; one fix does not
cover the defect it was written for (F6); four bounded residual defects
and one nit recorded below.

---

## Findings

### r38-COR-1 (Medium) — F6's `isCombatActive` gate excludes a zombie shape that cannot exist and passes the one that does

**Claim attacked:** App.vue `isCombatActive` = `getCombatClockState() !==
'stopped' && getTurnBattle() !== null` — "the accepted battle-less
'frozen' zombie residual would otherwise let a hidden tab arm the
curtain over an error/entry screen with nothing to continue into."

**The reported zombie is a KEPT battle, not a discarded one.** The
r37-AUT-2 evidence names the fail arms (boot-fail, rejected-restore).
Every one of those arms returns BEFORE `discardStaleBattle`
(`useAppLifecycle.ts:741` runs only on the success path; r36-COR A2
verified `discardStaleBattle` never runs on the reject arm). `turnBattle`
is nulled only inside `discardInFlightBattle` (`:1751`), so the zombie
keeps its battle object: shape = `turnBattle !== null` + clock 'frozen'
('authority-pause'). The new predicate's second clause is therefore
satisfied by exactly the shape it claims to exclude — on a hidden tab the
handler still arms `isPaused` + 'tab-hidden' over the error surface.

**The guarded shape is unreachable.** `combatClock.start()` exists only
inside `beginBattleCycleCommitted` step 7 and `setCombatClockSource` —
both synchronous with a live (or kept) battle. `freeze()` is a no-op on
'stopped' (`CombatClock.ts`). Every path that nulls `turnBattle`
(`discardInFlightBattle`) stops the clock in the same synchronous block.
There is no code path that produces `turnBattle === null` + 'frozen'.

**Repro (probes A1/A2):**
- A1: parked stage battle + `freezeCombat('authority-pause')` (the
  zombie's exact shape) → the App.vue predicate evaluates `true`, and
  the real `useCombatPause` composable arms `isPaused` + latches
  'tab-hidden' on a stubbed `visibilitychange` — the reported defect
  persists end-to-end.
- A2: `discardStaleBattle()` → `getTurnBattle() === null` + 'stopped';
  `freezeCombat('authority-pause'/'turn-in-flight')` afterward is a
  no-op — battle-less + frozen cannot be manufactured.

**Correctness assessment:** the fix is not wrong — it is ineffective. A
live-battle discriminator for the zombie does not exist at the ops layer
(the kept battle is state-indistinguishable from a real mid-flight
battle: `isTurnBattleInProgress` also returns true). A correct gate
needs the one piece of state the zombie lacks and a live battle has —
an admitted route/session (e.g. `entryStage`/boot-admission), which lives
outside `GameManager`. Severity Medium: the wave's reported defect is
unfixed and now carries a false "fixed" label.

### r38-COR-2 (Low) — `boundaryQueue` commands are not arrival-ordered: an IDLE-window command overtakes the pending queue

**Claim attacked:** the manual-mode intent rides `boundaryQueue`; drained
at the next fighting boundary.

`enqueueAtTurnBoundary` (:667-679) runs a command **synchronously** when
the token is IDLE — including when an earlier command is still sitting in
`boundaryQueue` awaiting its fighting-branch drain (the drain lives only
at the top of `stepTurnBattle`'s 'fighting' branch). Order of execution
is therefore: later-inline-command → then the drained older one.

**Mechanism chain (probe B1):**
1. mid-turn `setBattleManualMode(true)` → queued (`boundaryQueue` = [c_true]).
2. turn resolves non-terminally → token IDLE; queue still pending.
3. `setBattleManualMode(false)` arrives → IDLE branch runs it INLINE → flag = false, slot nulled.
4. next fighting step drains c_true → flag = **true** — the opposite of
   the user's last action, persisted (the flag is session-scoped and
   survives into the next claim-time read at `tickPacing`).

The window is ~0.1s (`COMBAT_STEP_SECONDS`) of game time per boundary —
narrow but reachable by a rapid double-toggle or a remount-time sync
(`CombatTopBar.onMounted` calls `setBattleManualMode` unconditionally).
Consequence shown in the report narrative: a landed `true` can claim the
next player turn as `AWAITING_INPUT` — the battle parks awaiting manual
input while the user believes auto is on; recoverable by any further
toggle or a manual choice. Probe B2 (control): two toggles both queued
while non-IDLE drain FIFO correctly.

The slot itself is NOT the defect — `pendingManualMode` tracks last
intent correctly; the FIFO violation lives in `enqueueAtTurnBoundary`'s
immediate-run branch (it should only run inline when the queue is empty,
or flush the queue first). Low: narrow window, user-recoverable.

### r38-COR-3 (Nit) — live-handles invariant is path-asymmetric: drive/dead-battle arms keep the fired handle resident

`awaitStep`'s fallback splices the just-fired handle on the admin-latch
re-arm (:916-921), the `isBlocking()` deferral arm (:930-936), and the
settle closure (:979-982) — but NOT on the drive arm (:963-968: entry
consumed → `driveStepWork` → `done()`) or the dead-battle drop (:904).
A fired fallback that drives its step leaves its dead handle in
`pendingStepTimers` beside the next arm's live one.

**Repro (probe C1):** fired 'ready' fallback → `pendingStepTimers` grows
1→2 (dead + the new 'impact' arm), then 2→3 on 'impact'. Control (C2):
the ACK-settle path keeps the array flat at 1. Bound: ≤ 3 dead handles
per epoch (one per signal), wiped by the next `clearPendingSteps` — no
wedge, no growth axis; the claimed "live timers only" invariant holds
only where it matters (permanent-wedge arms). Nit: cosmetic asymmetry; a
future arm-site copying the drive path inherits the residue.

### r38-COR-4 (Low) — `beginBattleCycle`'s pre-commit `emitAbandonEnd` retains the F3 re-mint seam: a nested mint's enemies leak in `enemyManager`

**Claim attacked:** `emitAbandonEnd` moved AFTER teardown in
`abandonBattle` because a `battle_end` listener minting mid-emit had its
cycle torn into a zombie.

The same emit exists at `beginBattleCycle` :1854 — structurally pinned
BEFORE the committed teardown (the outgoing battle must publish its
terminal before `resetRewardState` runs, and it fires while
`this.turnBattle` still references the outgoing battle and the clock is
still running). A `battle_end` listener that mints inside this emit runs
a full nested `beginBattleCycleCommitted` — mints battle A — then the
outer committed block mints battle B over it. `clearCycleEntryState`
never touches `enemyManager` (only `discardInFlightBattle`/`abandonBattle`
do), so A's spawned enemies are never cleared.

**Repro (probe D):** parked stage battle → listener re-mints inside the
emit → outer mint completes → `enemyManager.getAll()` holds TWO entries
with `templateId === 'fixture_enemy_2'` while the live battle references
one — the nested mint's spawn is an unreferenced orphan (spawn mints a
unique instance id per call, so the orphan is permanent, not shadowed).

Production `battle_end` subscribers (audio cue, CombatScene, PhaserCanvas
snapshot clear) consume the payload only — none re-mint, so reachability
needs a foreign listener (auto-advance style). Same accepted-risk class
F3 closed at the abandon site; the pre-commit emit is a sibling seam that
cannot move without restructuring the once-guard reset order. Low.

### r38-COR-5 (Low) — the step-7 latch replay has no 'turn-in-flight' IDLE strip (F4 sibling), exploitable through the synchronous emit window

**Claim attacked:** `setCombatClockSource` skips 'turn-in-flight' on
IDLE-token carry; the step-7 restart replay (:2167-2175) carries every
non-'user-pause' reason verbatim.

Normally 'turn-in-flight' cannot reach the step-7 snapshot:
`clearCycleEntryState` → `turnToken.reset()` → unconditional `IDLE`
emit → the token listener's `resume('turn-in-flight')` deletes it —
verified in r37-COR's census. But the `presentation_session_started`
emit (:2150, inside the 'fresh'/'test' session block) sits BETWEEN that
reset and the :2167 snapshot in the same synchronous block — a listener
planting `freezeCombat('turn-in-flight')` there lands it in
`latchedReasons` and it is re-frozen verbatim on the restarted clock.

**Repro (probe E):** listener plants 'turn-in-flight' inside
`presentation_session_started` → `startBattleWithPlayer` → the new
clock reports 'frozen' on `['turn-in-flight']` alone (after releasing
the session's own 'not-revealed' latch) → 26s of clock advance produces
zero turn progress (the only clearer is the token listener, and a frozen
clock never produces a transition) → `resumeCombat('turn-in-flight')`
unwedges manually. Same permanent-wedge outcome F4 fixed on the swap
path; same foreign-plant reachability class. Low (no production
subscriber performs this plant).

### r38-COR-6 (Nit) — `drainBoundaryQueueIfIdle` runs commands bare; a throwing command silently drops the rest of the batch

`queued = boundaryQueue; boundaryQueue = []; for (const command of queued) command()` (:699-704) — no per-command guard. A throwing command aborts the loop AFTER the queue is emptied: trailing commands are lost from the drain. Today only manual-mode closures enqueue (a flag write + slot null — cannot throw), so reachability needs a foreign `enqueueAtTurnBoundary` caller.

**Repro (probe F):** queue [throwing-cmd, c_true] → resolve → drain throws; flag never landed, queue empty, `pendingManualMode` still armed → `abandonBattle` → `dropBoundaryQueue` re-lands the intent (self-heal via the r37 slot). The slot converts the silent loss into a bounded one — the undocumented behavior is the abort, not corruption. Nit.

---

## Verified-correct claims (rejected attacks)

| Claim | Attack | Result |
|---|---|---|
| F1 live-handles splice | `timer` is the closure `let`; each re-arm site splices BEFORE reassigning, so `indexOf(timer)` always identifies the just-fired handle. Cap-drain splices then intentionally leaves the settle entry armed for `drainPendingPlayback` → `stepCompletionSink` → `settleStep` routing (wedges otherwise). | **Rejected** (probe C/G2) |
| F2 `=== undefined` settled-check | Every `pendingStepDone[signal] = undefined` write (:904 dead-battle, :963 drive, :989 settle, :1002 wipe) marks a consumed/dropped step. A signal arms at most once per epoch — `clearPendingSteps` bumps the generation on every `beginTurnPipeline`, and each pipeline arms 'ready'/'impact'/'complete' exactly once (:813-839), so a stale closure can never meet a non-undefined entry that isn't its own step. | **Rejected** (probe G2) |
| F3 emit-after-teardown | All 3 `battle_end` subscribers consume payload only (audio cue map, CombatScene presentation, PhaserCanvas snapshot). `session.end`/`resetPendingState`/`combatClock.stop` emit nothing — the only event inside the teardown window is the emit itself. Probe G1: listener during `abandonBattle` observes 'stopped' clock + 'defeat' battle. Re-mint lands on a stopped clock correctly. | **Rejected** (probe G1) |
| F4 IDLE-token strip predicate | CLAIMED/RESOLVING legitimately carry mid-flight (the pipeline IS in flight); COMBAT_OVER always follows `combatClock.stop()` (:1118) which clears reasons — the latch can't survive to a swap that way. Probe G3: foreign 'turn-in-flight' on IDLE → swap strips it → new clock runs; the battle then claims normally. `turnToken.reset()`'s resume can never fire "on the old clock" mid-swap — the swap is synchronous with no reset inside. | **Rejected** (probe G3) |
| F5 slot coverage | `boundaryQueue` writers: push (:678), drain-empty (:700), drop-empty (:310). Undrained clears: `onTurnDrained` COMBAT_OVER (:1068) + `clearCycleEntryState` (:1689) — both run `dropBoundaryQueue`, which re-lands the slot. Drained closures null the slot inside the closure. Probe G4: combat-over drop re-lands the intent on the session flag. | **Rejected** (probe G4) |
| F6 gate direction | No false-negative window: the mint assigns `turnBattle` inside the synchronous committed block; `getTurnBattle() === null` only ever co-occurs with 'stopped' (post-discard). The gate's defect is the zombie-shape assumption, not a transition gap — folded into r38-COR-1. | see r38-COR-1 |
| r37-COR-5 bound | The armed curtain's own latch ('tab-hidden') dies with the battle: every teardown funnels through `combatClock.stop()` which clears the reason set; the stateVersion watch then clears `isPaused` on the next bump. A carried 'tab-hidden' into a new battle keeps the curtain armed — consistent (its latch lives). Probe G5: arm on the zombie → `abandonBattle` → 'tab-hidden' gone. No armed-forever state. | **Rejected** (probe G5) |

## Probe inventory

`auditR38COR.probe.test.ts`, 14 tests, all green:

- A1/A2 — r38-COR-1: real zombie passes the gate (end-to-end composable arm); battleless+frozen unreachable.
- B1/B2 — r38-COR-2: IDLE-window toggle overtakes the pending queue (lands inverted); control drains FIFO.
- C1/C2 — r38-COR-3: drive-arm leaves the fired handle (array grows 1→2→3); settle arm keeps it flat.
- D1 — r38-COR-4: nested mint inside the pre-commit emit leaks a second `fixture_enemy_2` entry.
- E1 — r38-COR-5: foreign 'turn-in-flight' inside the session-start emit rides the step-7 carry → permanent freeze until manual resume.
- F1 — r38-COR-6: throwing boundary command drops the rest of the batch; slot self-heals at the next drop.
- G1-G5 — pins: post-teardown emit ordering, settled-check no-op, IDLE-strip carry, combat-over slot re-land, curtain latch bound.
