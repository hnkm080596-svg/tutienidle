# Fixpoint r37 — COR audit of the r36 adjudication (commit 796df2ee)

Blind correctness audit. Role: COR. Scope: the six r36 claims + the
r36-AUT-1 accepted bound + sibling attack surfaces. Probe file:
`game/src/services/save/auditR37Cor.probe.test.ts` — 16 tests, all green
(`npx vitest run src/services/save/auditR37Cor.probe.test.ts --pool=threads`).

**Verdict: PASS WITH EVIDENCE** — 0 Critical / 0 High / 0 Medium /
2 Low / 3 Nit. Every headline claim verified against code + probes; two
bounded residual defects and three nits recorded below.

---

## 1. Freeze-reason census (attacks claim 1 — owner-scoped carry)

Closed union at `CombatClock.ts:30-35`: `'tab-hidden' | 'not-revealed' |
'turn-in-flight' | 'authority-pause' | 'user-pause'`. Every
`freezeCombat`/`resumeCombat` producer was enumerated; there is no fifth
producer and no sixth string anywhere in `src/`:

| Reason | Producer | Owner scope | Carry verdict |
|---|---|---|---|
| `user-pause` | `CombatTopBar.togglePause` (only) | battle-scoped — `watch(battle)` resets `userPaused` on identity change WITHOUT resuming | correctly filtered by step 7 |
| `authority-pause` | `useAppLifecycle.pauseSimulation` | session-scoped (`simPaused` survives) | correctly carried |
| `tab-hidden` | `useCombatPause.onVisibilityChange` (only) | session-scoped (`isPaused` survives) | correctly carried |
| `turn-in-flight` | `attachTurnTokenToClock` listener (only) | pipeline-owned | never reaches the snapshot: `clearCycleEntryState` → `turnToken.reset()` → `setState('IDLE')` emits on EVERY reset (no change check, `TurnToken.ts:80-86`) → by-name `resume('turn-in-flight')` strips it — including a foreign latch (probe A2a) |
| `not-revealed` | `syncOffScreenFreeze` (only) | derived from `session.isBlocking()` | re-derived at step 7, not carried stale (probe A1 + r36-D3) |

**CONFIRMED.** 'user-pause' is genuinely the only battle-scoped latch, and
the stronger result fell out of the census: the carry cannot receive
'turn-in-flight' even if one was frozen externally — `reset()` emits
unconditionally, so the listener's resume deletes the reason by name on the
old clock before the snapshot reads it (probe A2a). Producer discipline is
not load-bearing on the restart path. It IS load-bearing on the swap path —
see r37-COR-4.

## 2. Cycle-epoch guard coverage (attacks claim 4)

`pendingStepGeneration` has exactly two write sites: init `:281` and
`clearPendingSteps` `:941` (incremented first, before the wipe). Callers of
`clearPendingSteps`: `beginTurnPipeline` `:775` and `clearCycleEntryState`
`:1629`. Callers of `clearCycleEntryState`: `beginBattleCycleCommitted`
`:1833`, `discardInFlightBattle` `:1714` (covers `discardFailedCycle`
`:1661` and public `discardStaleBattle` `:1683`), `abandonBattle` `:2575`.
Every `this.turnBattle` write (`:1695` null-out, `:1906` mint) lives inside
those funnels; `pendingStepDone`/`pendingStepTimers` have no writer outside
`awaitStep`/`settleStep`/`clearPendingSteps`.

A dequeued-but-unrun stale fallback is a macrotask: it can never interleave
inside any of those synchronous teardowns, so by the time it runs the
generation has already moved → bail at `:839`. Probe B1 pins the bump on
all four real paths (same-battle re-pipeline via a second claim, abandon,
discard, restart). One ordering residual: `abandonBattle` emits
`battle_end` BEFORE its own teardown tail — r37-COR-3.

**CONFIRMED** — coverage is complete.

## 3. Splice re-arm identity (attacks claim 3)

`timer` is the closure-captured `let`; at fire time it holds the
just-fired handle, `indexOf(timer)` finds exactly that handle (numeric
id / Timeout-object identity — unique per arming), splice removes it, the
re-arm pushes the new handle. The pipeline is serial → at most one parked
step exists → no cross-step aliasing. Probe C1 pins identity (not just
length) across N re-arms via queue-captured timers: `[id0] → fire → [id1]
→ fire → [id2]`.

**CONFIRMED** on the admin-latch arm. The claim "the array holds live
timers only" is false on two sibling writers — r37-COR-1.

## 4. Source-swap preservation (attacks claim 2)

Snapshot → stop → new instance → rebind step listener + `attachTurnTokenToClock`
→ `start()` (iff `wasRunning`) → verbatim re-freeze → `syncOffScreenFreeze`.

- Order: `getFreezeReasons` is `Array.from(Set)` — insertion order; re-freeze
  replays it verbatim (probe D3).
- Stopped clock: `stop()` already emptied the reason set, `freeze()` no-ops
  on a stopped clock, `wasRunning=false` skips start — nothing to lose
  (probe D2).
- Mid-turn coherence: token still CLAIMED post-swap; the re-bound listener
  fires only on the next transition — 'turn-in-flight' arrives via the
  snapshot, and the RESOLVING→IDLE transition at turn end resumes it on the
  NEW clock instance. Probe D1 drives this end-to-end: swap mid-turn → ACK
  drain on the surviving token → IDLE → latch released on the new instance
  → steps land on the new source.
- `wasRunning=false` skips `syncOffScreenFreeze` — consistent: every later
  start point re-derives (`:2119`, `:2400`).

**CONFIRMED**, one misuse edge — r37-COR-4.

## 5. Curtain watch (attacks claim 5)

`App.vue:514-518` fires on `stateVersion` bump: `isCombatPaused && !reasons
includes 'tab-hidden'` → clear. Data contract verified — every teardown
synchronously empties the reason set (`stop()`/`clearCycleEntryState`), so
the watch input is always satisfied one bump later (probes E1/E2 cover
abandon + discard). A legitimate carry keeps the latch → curtain correctly
stays. Condition order inside the watch is irrelevant — both conjuncts are
reads of already-consistent state.

**CONFIRMED**, one starvation nit — r37-COR-5.

## 6. r36-AUT-1 bounds + restoreCheckpoint (claims 6, 7)

ACK gates: `isSessionBlocking()` first, then `token !== playbackToken`
reject — per-phase pending slots enforce ordering inside the shared token.

- Cannot exceed the residual: after the third ACK the phases are null and
  the token is IDLE-side; replayed ACKs of the same token die silently
  (probe F1).
- Cannot land on a different owner: `resetPendingState` inside
  `clearCycleEntryState` wipes `playbackToken` to `''` and the pending
  triple; the next cycle mints a fresh token — a stale token is rejected
  while the live one still drains (probe F2).
- Cannot survive a discard: post-discard the pending triple is null and
  `getPendingPlaybackToken()` is null; a stale-token ACK triple is a
  three-way reject (probe F3).
- `restoreCheckpoint` (`EarlyGameSession.ts:644-662`): successful
  `restoreGameSession` → `discardStaleBattle()` at `:654` → `this.player`
  re-point at `:655`. Third seam of the boot/reconnect ghost class, closed.

**CONFIRMED** — the acceptance bounds hold.

## Findings

### r37-COR-1 — Low — `pendingStepTimers` is not live-handles-only on two residual writers

`awaitStep`'s `isBlocking` deferral arm (`GameManagerTurnBattleOps.ts:886-891`)
re-arms `setTimeout` and pushes WITHOUT splicing the just-fired handle — the
exact defect class F3 fixed on the admin arm at `:878-883`. Same omission on
the settle path (`:926-929`): `parkedDone` calls `clearTimeout(timer)` but
never removes the handle from the array — every ACK-settled step leaves one
dead handle behind.

Repro evidence (deterministic): probe C3 — park a step, mock
`session.isBlocking() → true`, advance two fallback intervals → array grows
`armed → armed+2` (no splice); probe C2 — `settleStep('ready')` → array
retains the cleared handle plus the next step's live one (`length === 2`).

Bound (why not Medium): `deferredMs` reaches
`AWAIT_STEP_DEFERRAL_CAP_MS = 32000` after ≤8 fires → forced
`drainPendingPlayback` (probe C3 asserts the warn + drain), and
`clearPendingSteps` wipes the array every turn/restart/discard. Maximum
residue ≈ 8 dead handles per parked step + 1 per ACK settle — memory noise,
self-cleaning, never unbounded.

### r37-COR-2 — Nit — zombie re-arm chain after a step's own settle

If a fallback was already dequeued into the macrotask queue when its step
settles via ACK (settle `clearTimeout`s the handle but does not splice it —
r37-COR-1's second half), the stale-in-time but same-generation fire hits
the admin-latch arm, finds its dead handle via `indexOf`, splices it, and
re-arms a NEW live timer for a step that no longer exists. The orphan chain
re-fires every `ANIMATION_FALLBACK_MS` while the latch holds; on release it
drives a token-rejected ACK + idempotent `done()` (`completeStep` ignores a
non-parked step). Bounded: ≤1 orphan chain per settled step, killed by the
next `clearPendingSteps`. Reachability: requires a fire-dequeued→settle
interleave under an active admin latch — rare; pure CPU overhead.

### r37-COR-3 — Low — `abandonBattle` emits `battle_end` before its teardown tail

Ordering: `turnBattle.state='defeat'` `:2549` → `emitAbandonEnd()` `:2563`
→ `enemyManager.clear()` `:2569` → `clearCycleEntryState()` `:2575` →
`combatClock.stop()` `:2576`. During the synchronous emit the battle
reference still points at the defeat-stamped object and the token may be
IDLE — a subscriber that synchronously starts a battle (direct API call, or
`enqueueAtTurnBoundary` hitting the `!turnBattle || IDLE` immediate-run
arms at `:639-647`) mints a live cycle that the abandoned battle's tail
then tears down: a fresh battle left stopped-clock, reasons wiped, enemies
cleared — a zombie nobody owns.

Repro evidence (deterministic): probe B2 — a `battle_end` subscriber calls
`startBattleWithPlayer` mid-abandon; post-abandon `getTurnBattle()` is the
re-minted battle with `getCombatClockState()==='stopped'` and zero steps
ever landing. Reachability: none today — the four subscribers
(`PhaserCanvas` snapshot clear, `combatAudioBinding`, backdrop variant,
skilldef dispatch) never start battles synchronously. Fragile ordering, not
a live defect; the symmetric fix is emit-after-teardown or a re-entrancy
guard on the boundary arms.

### r37-COR-4 — Nit — swap-path verbatim carry trusts producer discipline

`setCombatClockSource` has no `turnToken.reset()` — a foreign
`'turn-in-flight'` latch (any `freezeCombat` caller; the reason is public
API surface) carries verbatim onto the new clock, where nothing ever
resumes it: the token is IDLE so no transition fires the listener, the
frozen clock never emits steps so no claim ever happens — a
self-perpetuating frozen zombie until a teardown wipes the clock.

Repro evidence: probe A2b — `freezeCombat('turn-in-flight')` on a running
battle → `setCombatClockSource` → reasons `['turn-in-flight']`, `frozen`,
500 combat seconds land zero steps. Reachability: no producer freezes a
pipeline-owned reason today; the restart path is already immune (probe
A2a — `reset()` strips it by name). Defensive hardening, not a live bug.

### r37-COR-5 — Nit — curtain-clear watch is bump-starved during 'authority-pause'

`pauseSimulation` clears `tickHandle` (`useAppLifecycle.ts:270-273`) — the
per-second tick stops, so `bumpState()` no longer fires and the `App.vue`
`stateVersion` watch cannot run while the sim is paused. If a teardown
clears 'tab-hidden' inside that window (the replaced-lineage discard inside
`onResume` runs before `resumeSimulation` restarts the tick), `isPaused`
stays stale-true for the pause duration. Reachability: bounded —
`resumeSimulation` restarts the tick immediately after, the authority
overlay covers the curtain meanwhile (`inert` layering), and panel
mutations still bump. Cosmetic only.

## Pinned accepted residuals (verified still true, NOT findings)

verbatim-parked non-inverted out-of-domain stamps; NaN-in-pair park-verbatim
+ write-gate wedge (deny-direction, BYPASS-only); boot-path discard contract
(entered=battleless 'stopped' [], failed=frozen zombie kept); dangling
post-discard internals write-guarded/inert; `turnBattleSystem`/`combatRng`
mounted-by-design; `boot.enterGame` rejected-route 'entered' bounded by
gates + 'not-revealed'; markReady throw = injected-fault class;
r36-AUT-1 ACK-channel drain under admin latch (bounds re-verified above —
the seam itself not re-reported).

## Probe coverage map

| Probe | Pins |
|---|---|
| A1 | all-five-reason census across a mid-turn 'fresh' swap: user-pause dropped, session pair carried, turn-in-flight stripped pre-snapshot, not-revealed re-derived |
| A2a | restart strips even a foreign turn-in-flight (unconditional reset emit) |
| A2b | r37-COR-4: swap carries a foreign turn-in-flight → permanent frozen zombie |
| B1 | generation bumps on re-pipeline / abandon / discard / restart |
| B2 | r37-COR-3: mid-emit re-mint is torn down by the abandon tail |
| C1 | splice swaps the exact fired handle across N re-arms |
| C2 | settle path leaves a dead handle (r37-COR-1, part 2) |
| C3 | deferral arm grows +1/fire without splice; cap drain bounds it (r37-COR-1, part 1) |
| D1 | mid-turn swap: token claim + turn-in-flight coherent on rebound listener; ACKs drain on the new instance |
| D2 | stopped clock swap stays stopped, empty reasons |
| D3 | verbatim re-freeze preserves Set insertion order |
| E1/E2 | teardown clears 'tab-hidden' synchronously (watch input contract) |
| F1 | ACK replay post-resolve is a silent reject (residual bound) |
| F2 | stale token rejected on the next minted cycle; live token still drains (owner bound) |
| F3 | post-discard ACK triple rejects; pending wiped (discard bound) |
