# Fixpoint r38 — adjudication

Wave r38 blind audit of r37 adjudication commit `de4c4fb4`
(`codex/hoa-cau-fireball-vfx`). Auditors: COR / AUT / INT.

## Verdicts

| Role | Verdict | Findings | Report |
|------|---------|----------|--------|
| COR | PASS WITH EVIDENCE | 0C / 0H / 1M / 3L / 2N | `2026-10-07-fixpoint-r38-COR.md` |
| AUT | PASS WITH EVIDENCE | 0C / 0H / 1M / 2L / 1N | `2026-10-07-fixpoint-r38-AUT.md` |
| INT | PASS WITH EVIDENCE | 0C / 0H / 0M / 1L / 2N | `2026-10-07-fixpoint-r38-INT.md` |

First wave where an auditor broke a fix landed by the previous wave
(r37-F6 gated `isCombatActive` on battle presence, which the real
zombie shape survives). Convergence was again strong: three auditors
independently found the same step-7 latch seam, two found the
pre-commit emit sibling, and all three hit the same
live-handles bookkeeping residue. Eight fixes below; no new accepted
residuals beyond the ones already on record.

## Fixed

### F1 — step-7 latch replay carries a foreign `turn-in-flight` onto an always-IDLE token (r38-COR-5 + r38-AUT-1 — converged, Medium)

r37-F4 added the IDLE-token strip for `turn-in-flight` on the
`setCombatClockSource` re-freeze arm, but `beginBattleCycleCommitted`'s
step-7 latch replay carries every reason except `user-pause` verbatim.
The token is always IDLE at that read (reset at step 1), so a
`turn-in-flight` present in the snapshot is foreign by construction —
the only producer is the token transition listener, and it can only be
planted inside the synchronous mint window
(`presentation_session_started` emit at :2150 runs before the snapshot).
A carried latch freezes the fresh battle permanently: frozen clock ->
no claim -> no transition to resume it.

Fix: the step-7 replay filter is now
`reason !== 'user-pause' && !(reason === 'turn-in-flight' && turnToken.getState() === 'IDLE')`
— the same predicate as the source-swap arm. Owned administrative
reasons (`authority-pause`, `tab-hidden`) still carry and unlatch
normally (AUT control probe verifies the carry path survives).
Probe flips: COR E, AUT A1.

### F2 — `enqueueAtTurnBoundary` IDLE-window inline run overtakes a pending queue (r38-COR-2, Low)

A queued boundary command waits for the next fighting-branch drain,
but a later command arriving while the token is IDLE ran inline —
ahead of the earlier queued one. Observable via the manual-mode
toggles: ON queued mid-turn, OFF arriving in the IDLE window landed
inline, then the stale ON drained last — the flag settled on the
opposite of the user's last intent.

Fix: the IDLE-window inline run now requires
`this.boundaryQueue.length === 0`; with a pending queue the later
command queues behind it and FIFO order is preserved. Probe flip:
COR B1 asserts last-intent-wins after the drain.

### F3 — `drainBoundaryQueueIfIdle` runs queued commands bare (r38-COR-6, Nit — fixed anyway)

The drain emptied the queue first, then ran each command with no
guard: a throwing command aborted the rest of the batch silently
(trailing commands lost; only `pendingManualMode` self-healed at the
next `dropBoundaryQueue`). No current enqueued closure can throw —
only manual-mode closures enqueue today — but the seam is the public
`enqueueAtTurnBoundary` surface for future commands.

Fix: each drained command is wrapped in try/catch — a throw logs a
warning and the drain continues. Probe flip: COR F asserts the manual
intent behind a throwing command lands in the same drain.

### F4 — live-handles residue on the remaining fallback arms (r38-COR-3 + r38-AUT nit + r38-INT-N1 — converged, Nit — fixed anyway)

r37-F1 spliced the just-fired handle on the deferral/cap-drain/settle
arms, but the drive arm and the dead/terminal arm still consumed the
entry without splicing their fired handle — bounded residue (~1 dead
entry per fired step, swept at `clearPendingSteps`), all three
auditors flagged the same asymmetry.

Fix: the splice is hoisted once to the top of the fallback, after the
epoch and settled checks — every arm below it inherits the invariant
dead-battle drop, admin-latch deferral, isBlocking deferral, cap-drain,
and the live drive. Probe flips: COR C1, AUT E2-nit, INT A2; r36-C2's
"array did not grow" pin retightened to "strictly smaller".

### F5 — `setBattleManualMode` writes its intent slot after the stranded-rescue (r38-AUT-2, Low)

`pendingManualMode = enabled` landed at :2714 — after the
stranded-rescue `beginTurnPipeline` at :2702. A rescue that reaches
COMBAT_OVER synchronously (headless settle) runs `onTurnDrained` ->
`dropBoundaryQueue` before this call's own write: the drop re-landed
the PRE-call slot, so a queued ON + OFF-rescue left the session flag
true on the dead battle. Bounded to the dead battle (next drop
re-landed the queued last intent) — but the flag read wrong in the
interim.

Fix: `this.pendingManualMode = enabled` moved to the top of the method
— the slot reflects the caller's intent before any synchronous queue
mutation below can observe it. Probe flip: AUT B asserts the flag
reads false immediately post-rescue.

### F6 — pre-commit `battle_end` emit: nested mint orphans its spawned enemies (r38-COR-4 + r38-INT-L1 — converged, Low)

`beginBattleCycle`'s pre-commit `emitAbandonEnd` at :1854 is
structurally pinned before the committed mint — a listener minting a
nested battle inside that emit is superseded by the outer mint (AUT-D
pinned the orphaning as safe envelope+1), but its spawned enemies
stayed registered in `enemyManager`: `clearCycleEntryState` never
touches the registry, which is swept only by abandon/discard.

Fix: `beginBattleCycleCommitted` step 1 now calls
`this.deps.enemyManager.clear()` right after `clearCycleEntryState` +
`battleGeneration += 1` — a committed mint starts with an empty enemy
field, sweeping nested-mint orphans and the outgoing battle's
leftovers. `clear()` is idempotent under the discard/abandon paths.
Probe flips: COR D, AUT D (the residue assertion now denies the
'superseded' ghost).

### F7 — `grantTurnBattleRewards` post-emit live `getActiveStage()` reads (r38-AUT-3, Low)

`publishBattleEnd` emitted `battle_end` at :149, then the victory
branch read `getActiveStage()` live at :162 (and inside
`recordPerfectClearIfEligible` at :193). A listener minting a 'fresh'
battle inside the emit nulled `activeStageForTurnBattle` — the ended
victory's `completedStageIds` write was silently dropped (or
misattributed). No current listener mints — latent ordering hazard,
same class F3 fixed in abandonBattle.

Fix: `const stageSnapshot = this.deps.getActiveStage()` captured before
`publishBattleEnd`; the victory branch binds the snapshot, and
`recordPerfectClearIfEligible` takes the stage as a parameter instead
of re-reading live. Probe flip: AUT C asserts `fixture_stage` records
as cleared.

### F8 — `isCombatActive` gated on battle presence, which the zombie survives (r38-COR-1, Medium — r37's F6 was wrong)

r37-F6 changed `isCombatActive` to
`clock !== 'stopped' && getTurnBattle() !== null` — but the reported
zombie is a KEPT battle + frozen clock: the boot-fail and
rejected-restore arms return before `discardStaleBattle`, so the gate
passes the exact shape it claims to exclude. The battle-less frozen
shape it guards is unmanufacturable (`freeze()` no-ops on 'stopped';
every null-out stops the clock).

Fix: the gate is now
`entryStage.value === 'game' && gameManager.getCombatClockState() !== 'stopped'`
— `entryStage` is the App-side admission signal the zombie actually
lacks (fail arms land on 'error'). Stale comment at :485 corrected
(r38-INT-N2). Probe flip: COR A1 models the entry-stage gate with a
control proving the admitted 'game' route still arms the curtain.

## Probe flips (assert-bug -> deny pins)

- `auditR38Cor.probe.test.ts`: A1 (entry-stage gate + control), B1
  (FIFO last-intent), C1 (flat timer array), D (registry holds exactly
  the live enemy), E (plant stripped, battle progresses), F (drain
  survives a throwing command). 14/14 green.
- `auditR38Aut.probe.test.ts`: A1 (plant dies with snapshot), B
  (intent slot written at top), C (completion write binds snapshot),
  D (no 'superseded' ghost), E2-nit (drive arm splices). 7/7 green.
- `auditR38Int.probe.test.ts`: A2 (dead/terminal arm retires its
  handle). E-section `isCombatActive` model updated to the
  entry-stage gate. 15/15 green.
- `auditR36Cor.probe.test.ts`: C2 pin retightened (timer array now
  strictly smaller after the drop).

## Verification

- `npm run type-check` — clean.
- `npx vitest run src/services/save tests/architecture src/composables`
  — 226 files, 3015 tests green (7 expected-fail), 0 failures.
- ESLint on all touched files — 0 errors, 0 warnings.

## Accepted residuals

None new. Prior acceptances remain on record: the bump-starved
curtain window (r37-COR-5 bound, cosmetic) and the RNG-sensitive buff
flake documented since r36 (unrelated to this diff).
