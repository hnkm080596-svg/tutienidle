# Fixpoint r38 — AUT (adversarial exploit hunter)

Blind audit of the r37 adjudication at `de4c4fb4`
(`codex/hoa-cau-fireball-vfx`; code commit `9881bc0b`).
Probe file: `src/services/save/auditR38AUT.probe.test.ts` (7/7 green,
`npx vitest run --pool=threads`).

## Verdict: PASS WITH EVIDENCE — 0C / 0H / 1M / 2L / 1N

## Findings

### r38-AUT-1 (Medium, CONFIRMED) — mint latch carry lacks the F4 IDLE-token strip for 'turn-in-flight'

`beginBattleCycleCommitted`'s step-7 restart (`GameManagerTurnBattleOps.ts:2167-2175`)
snapshots `combatClock.getFreezeReasons()`, drops only `'user-pause'`,
then `stop()` → `start()` → re-freezes each survivor. At that read the
turnToken is **always IDLE** (`clearCycleEntryState` → `turnToken.reset()`
at :1689 fires the attached listener, which resumes any 'turn-in-flight'
already present — a pre-mint foreign plant is stripped there). So a
'turn-in-flight' in the snapshot set is foreign by construction — it can
only arrive *inside* the mint's own synchronous emit chain, e.g. a
`presentation_session_started` listener (:2150, 'fresh'/'test' mints)
calling the public `freezeCombat('turn-in-flight')` — the exact window
the r36 'user-pause' filter (r36-INT-1) was built to cover.

Carried forward, the minted battle freezes on a reason only the token
listener clears — and a frozen clock never produces a claim, so no
listener fire ever resumes it. Permanent freeze, silently.

This is the same mechanism r37-COR-4 fixed on the `setCombatClockSource`
carry arm (:448 skips 'turn-in-flight' when `getState() === 'IDLE'`); the
`beginBattleCycleCommitted` carry arm is the identical pattern under an
identical IDLE guarantee and got no strip.

**Repro** (probe A): running battle → `presentation_session_started`
listener plants `freezeCombat('turn-in-flight')` → `startBattleWithPlayer`
→ `getFreezeReasons() === ['turn-in-flight']`, clock `'frozen'`, token
`IDLE`, and 600 clock-steps later the minted battle is still in `'intro'`.
Control probe A2: the same plant with `'authority-pause'` carries *and*
unlatches via `resumeCombat` — the carry channel itself is sound; the
defect is carrying an unowned reason.

**Reachability**: requires a foreign `freezeCombat('turn-in-flight')`
inside the mint's emit window (or any emit between `turnToken.reset()` and
the latch read). No production subscriber does this today — same
precondition the adjudication accepted for F4. Rated Medium per F4
precedent (permanent battle freeze; fix = extend the :2169 filter or the
same IDLE check).

### r38-AUT-2 (Low, CONFIRMED) — OFF-rescue reaching COMBAT_OVER synchronously re-lands the pre-call pending intent

`setBattleManualMode(false)`'s stranded-rescue (:2684-2703) runs
`beginTurnPipeline(stranded, 'ready')` — which in headless settles the
whole turn inline: the final enemy dies → `onTurnDrained` → token
`COMBAT_OVER` → `dropBoundaryQueue()` (:1068) — **before** this call's own
`pendingManualMode = false` write at :2714 executes. The drop therefore
re-lands the *previous* toggle's slot value.

Interleaving: manual flag already `true`, player claim parked in
`AWAITING_INPUT` → `setBattleManualMode(true)` (redundant ON:
`pending=true`, queue=[applyTrue]) → `setBattleManualMode(false)` →
rescue kills the last enemy mid-call → drop reads `pending=true` → flag
re-lands **true** — although the user's last intent was OFF. The OFF
call then writes `pending=false` and queues `applyFalse` on the dead
battle's queue (never drained).

**Repro** (probe B): assert `isBattleManualMode() === true` after the OFF
call on a `'victory'`/`COMBAT_OVER` battle — the observed stale value.

**Bound**: heals at the next drop — any mint's `clearCycleEntryState`
re-lands `pending=false` before the first claim-time read, so the
inversion can only be observed on the dead battle window (e.g.
`isBattleManualMode()` returning true post-defeat). Probe B asserts the
heal. Not a perma-defect; the fix shape is setting `pendingManualMode`
before the rescue pipeline rather than after.

### r38-AUT-3 (Low, CONFIRMED) — `grantTurnBattleRewards` post-emit reads bind to a mid-emit mint

`publishBattleEnd` emits `battle_end` at `GameManagerBattleRewardOps.ts:149`,
then the victory branch keeps working: `recordPerfectClearIfEligible`
(:158 → live `getActiveStage()` at :193) and the completion write
(live `getActiveStage()` at :162 → `completedStageIds.push` at :169 +
`issueCompanionGifts` at :174). A `battle_end` listener that mints a new
battle inside the emit replaces `activeStageForTurnBattle` synchronously —
`'fresh'` mints null it (:1923), a nested `startStage` rebinds it (:2421).

Consequences: (i) fresh mint → `getActiveStage()` returns null → the ended
stage's `completedStageIds`/perfect-clear/companion-gift writes are
silently dropped; (ii) stage mint → the same writes are *credited to the
newly minted stage*. Meanwhile `settleCombatOutcome` re-reads
`this.turnBattle` live at :1082, sees the non-terminal minted battle, and
skips `combatClock.stop()` — so the listener's mint correctly survives;
only the reward writes land on the wrong binding.

**Repro** (probe C): listener mints inside the victory emit →
`player.completedStageIds` does not contain `'fixture_stage'` while the
minted battle is live. The dead battle's local `turnBattle` const keeps
`state === 'victory'`, so the whole victory branch still runs — only its
stage reads rebind.

**Reachability**: no current `battle_end` subscriber mints (verified:
`CombatScene.onBattleEnd`, audio cue map, `clearPositionsSnapshot` are all
payload-only). Latent ordering hazard — same class F3 moved past the
emit in `abandonBattle`; the reward path was left emitting mid-function.

### r38-AUT-4 (Nit, CONFIRMED) — drive/dead-battle fallback arms still leave the fired handle parked

The r37 F1 live-handles-only invariant holds on the re-arm arms
(admin-latch :916-919, isBlocking :930-936, parkedDone :979-982), but two
arms still consume `pendingStepDone[signal]` without splicing the fired
timer handle: the live-drive arm (:963) and the dead-battle arm (:904).
Each drive leaves one dead handle beside the next step's live arm —
`pendingStepTimers` = [dead ready, live impact]. Bounded: ≤1 dead entry
per step, swept by the next `beginTurnPipeline`'s `clearPendingSteps`;
no accumulation path (both arms return without re-arming, so a wedge
cannot grow the array — the class F1 fixed was per-fire appends).

**Evidence** (probe E2): after one fallback drive,
`pendingStepTimers.length === 2` with `pendingStepTimers[0]` still the
fired handle.

## Rejected attacks (verified against code, not findings)

- **pendingManualMode "older intent re-lands after rescue"** (coordinator
  hypothesis): the slot is a single value overwritten at :2714 on EVERY
  call — including the rescue call — so queue order always agrees with
  last intent. The only stale-read path is the synchronous-COMBAT_OVER
  window (r38-AUT-2 above). A drain mid-flight (`drainBoundaryQueueIfIdle`)
  clears the slot inside each queued closure — consistent.
- **F2 same-generation signal reuse**: signals are 'ready'/'impact'/
  'complete' — each armed once per pipeline, and `beginTurnPipeline`
  bumps `pendingStepGeneration` at its head (:804), so a re-armed same
  signal is always a new epoch; the queued-stale-fallback attack dies at
  the r36 epoch check before the r37 settled-check is even reached.
  Probe E1 pins the settled-check's actual job: a consumed step's queued
  fallback early-returns with no re-arm and no map residue.
- **Swap arm (F4) double-unlatch**: stripping 'turn-in-flight' on IDLE
  cannot remove a different reason — the resume call names exactly that
  reason; and an IDLE-visible 'turn-in-flight' is always foreign (the
  token listener synchronizes the latch's lifetime to non-IDLE states).
  Non-IDLE swaps still carry it — correct, the pipeline is mid-flight.
- **Pre-mint foreign plant**: `freezeCombat('turn-in-flight')` before the
  mint is stripped by `turnToken.reset()`'s listener fire inside
  `clearCycleEntryState` — only the in-mint emit window lands (hence
  r38-AUT-1's channel).
- **F3 `abandonBattle` ordering**: `emitAbandonEnd` (:2637) is now the
  last statement before `return true` — nothing post-emit remains for a
  listener's mint to be torn by; `turnBattle` stays non-null during the
  emit; subscribers are payload-only.
- **F6 null-window mid-mint**: `getTurnBattle()` returns the outgoing
  battle (non-null) throughout `beginBattleCycleCommitted` until the
  :1962 assignment — no synchronous null window for `isCombatActive` to
  read mid-cycle; `null` only appears on discard paths (the intended
  zombie exclusion). Frozen+battle-present still arms the curtain.
- **r37-COR-5 bound verified**: the armed curtain can only outlive
  'authority-pause' if the authority path never resumes — `resumeSimulation`
  (:299) and `bootGame`'s catch-free path (:757) both unlatch; the overlay
  itself carries the Continue button, so even a bump-starved curtain is
  user-clearable. Bounded as adjudicated.
- **beginBattleCycle pre-commit emit (:1854)**: a mint inside it is fully
  constructed, then superseded by the outer mint's teardown+rebuild
  (probe D) — the listener's battle silently loses `turnBattle` but leaves
  no torn machinery; its only residue is one extra EnemyManager ghost on
  top of the registry's existing never-swept envelope (an ordinary
  non-staged replace already keeps the outgoing enemies). Latent, same
  minting-listener precondition as r38-AUT-3 — noted, not counted.

## Verification

- `npx vitest run src/services/save/auditR38AUT.probe.test.ts --pool=threads`: 7/7 green.
- All defect probes assert *observed* defective state (flag/freeze/completion
  readback), so each green test is itself the repro evidence.
- No production code touched; branch contains this report + probe only.
