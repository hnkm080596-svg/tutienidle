# Fixpoint r37 — adjudication

Wave r37 blind audit of r36 adjudication commit `796df2ee`
(`codex/hoa-cau-fireball-vfx`). Auditors: COR / AUT / INT.

## Verdicts

| Role | Verdict | Findings | Report |
|------|---------|----------|--------|
| COR | PASS WITH EVIDENCE | 0C / 0H / 0M / 2L / 3N | `2026-10-07-fixpoint-r37-COR.md` |
| AUT | PASS WITH EVIDENCE | 0C / 0H / 0M / 2L / 1N | `2026-10-07-fixpoint-r37-AUT.md` |
| INT | PASS WITH EVIDENCE | 0C / 0H / 0M / 0L / 1N | `2026-10-07-fixpoint-r37-INT.md` |

First PASS-only wave in a while — all three auditors verified every r36
mechanism and still converged on two sibling seams: the
live-handles-only bookkeeping of `pendingStepTimers` (three auditors)
and scope mismatches where a session-scoped thing rides a battle-scoped
vehicle (queue + clock-state gate). Six fixes below; one accepted
residual.

## Fixed

### F1 — live-handles-only invariant of `pendingStepTimers` violated on three more arms (r37-COR-1 + r37-AUT-3 + INT nit — converged)

r36 spliced the just-fired handle on the administrative-latch re-arm but
left three other arms that can keep a dead handle in the array:

- the `isBlocking()` deferral arm re-armed a new `setTimeout` while the
  fired handle stayed parked (bounded to 8 dead entries per parked step
  — INT's nit estimated exactly this bound and recommended leaving it;
  COR and AUT both flagged it as the same class, so it is fixed rather
  than accepted);
- the cap-drain arm (`deferredMs >= AWAIT_STEP_DEFERRAL_CAP_MS`) returned
  without removing its dead handle either;
- the ACK/settle path (`parkedDone`) ran `clearTimeout` on an
  already-fired handle — correct for the live case — but likewise left
  the handle entry parked until `clearPendingSteps`.

Fix: the deferral arm now splices its just-fired handle on EVERY
deferral path (re-arm and cap-drain share the same splice before
deciding); the settle path splices the fired handle next to its
`clearTimeout`. The parked `pendingStepDone[signal]` entry stays armed —
`drainPendingPlayback` routes its completion through `settleStep` and
wedges the token in RESOLVING if the entry is consumed first. Probe
flips: COR C2/C3, AUT G, INT :308.

### F2 — same-generation settled-step stale fallback re-arms an orphan chain (r37-COR-2)

The r36 epoch guard kills fallbacks from a prior cycle, but a queued
callback fired in the SAME generation after its real settle consumed
`pendingStepDone[signal]` still ran the whole body: it wrote a fresh map
entry and re-armed a new fallback timer for a step nobody owns — an
orphan `awaitStep` chain that defers under `isBlocking()` up to the
cap, then mechanically drains playback a second time. Harmless for
correctness (runtime pending guards reject the drive) but it kept
arming real timers on a dead step.

Fix: right after the epoch check the fallback now early-returns when
`pendingStepDone[signal] === undefined` — a consumed entry means the
step already settled through its real channel. Probe flip: COR A3
asserts no re-arm and no map residue.

### F3 — `abandonBattle` emitted `battle_end` before teardown (r37-COR-3)

`emitAbandonEnd()` ran before `clearCycleEntryState` +
`combatClock.stop()`: any listener that started a new battle during the
emit had its minted cycle immediately torn into a zombie — clock
stopped, token reset, state still 'fighting'. Subscribers were verified
to consume the event payload (cue name, next backdrop variant, cleared
presentation state) — none read `getTurnBattle()` synchronously — so
moving the emit AFTER teardown is safe and preserves the
`battleEndEmitted` once-per-cycle guard (its reset lives in the reward
ops' own cycle hook).

### F4 — swap carried a foreign 'turn-in-flight' on an IDLE token (r37-COR-4)

The r36 `setCombatClockSource` latch-preserving re-freeze copied every
reason verbatim — including a foreign 'turn-in-flight' planted while
`turnToken` sat IDLE (token reset emits unconditionally, but only on
cycle transitions; an externally frozen reason could arrive between
them). The new clock then ran frozen on a reason only the token
listener can clear — with no turn in flight to clear it, the battle
froze permanently.

Fix: the re-freeze loop skips 'turn-in-flight' when
`turnToken.getState() === 'IDLE'`. A non-IDLE token still re-freezes
its own latch (the pipeline is mid-flight). Probe flip: COR A2b now
expects `[]`/`running` and steps landing.

### F5 — session-scoped manual-mode intent rode the battle-scoped boundary queue (r37-AUT-1)

`setBattleManualMode` queued the flag write through
`enqueueAtTurnBoundary` — the battle-scoped queue cleared undrained at
combat-over (`onTurnDrained`) and at every cycle teardown
(`clearCycleEntryState`). The flag itself is session-scoped (not in the
runtime's `resetPendingState`, read live at claim time and live again
inside `acknowledgeTurnReady`'s manual-pause routing), so a toggle made
during the final turn silently died with the queue while the flag —
now stale — persisted into the next battle.

The write must stay queued: spec 9.1 forbids a mid-resolution flip
(`acknowledgeTurnReady` reads the live flag to route a claimed actor
into manual pause — a direct write hijacks the resolving turn;
`commandBoundary.test.ts` pins this). Fix instead mirrors the intent:
`pendingManualMode` records the requested value at toggle time; both
undrained clear sites now run `dropBoundaryQueue()`, which re-lands the
pending intent on the flag before emptying the queue; a drained queue
clears the slot itself. Combat-over and teardown both re-land;
`drainBoundaryQueueIfIdle` keeps draining normally. Probe flips: AUT
F1/F2/F3.

### F6 — `isCombatActive` treated a battle-less frozen zombie as active (r37-AUT-2)

`App.vue`'s curtain gate `clockState !== 'stopped'` passed the accepted
r35 zombie residual — a discarded battle whose clock is frozen (not
stopped) — so `useCombatPause` could arm `isPaused` + the 'tab-hidden'
latch over error/auth screens with no battle behind them, parking the
admin latch until a real battle landed.

Fix: `isCombatActive` now also requires `getTurnBattle() !== null` — a
frozen clock only counts when a battle still lives on it. Probe flip:
AUT E section rewrites the predicate stub with a `hasBattle` arm.

## Accepted residual (recorded, not fixed)

- **r37-COR-5 (Nit)** — the curtain-clear watch is bump-starved during
  'authority-pause': `isPaused` keeps `resumeCurtain` armed while the
  post-teardown clock carries the authority latch, so the curtain
  clears on the authority path's own unlatch rather than the watch.
  Cosmetic and bounded (the authority path clears the latch itself);
  the alternative — keying the watch on latch-set changes — adds a
  second clear channel for zero behavioral gain.

## Verification

- `npm run type-check`: clean.
- Three r37 probes + `commandBoundary.test.ts` (spec 9.1 pin): 55/55
  green after flip.
- Scoped 82-file suite (save/combat/App): 682+4xfail green — one
  pre-existing RNG flake (same buff-landing class documented in r36)
  passed on identical re-run.
- `src/services/save` + `tests/architecture` + `src/composables`:
  2979+7xfail green.
- ESLint on all touched files: 0 problems.
- P15 ASCII: comments kept ASCII; probe edits include fixed-direction
  assertions only.
