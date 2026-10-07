# Fixpoint r39 — COR audit of the r38 adjudication (commit 56098103)

Blind correctness audit. Role: COR. Scope: the eight r38 attack claims
(step-7 'turn-in-flight' IDLE strip, boundary-queue FIFO guard, drain
try/catch, hoisted fired-handle splice, intent-slot hoist,
enemyManager.clear at committed step-1, stageSnapshot in
grantTurnBattleRewards, entryStage gate) + sibling seams. Audit commit
`56098103` on `codex/hoa-cau-fireball-vfx` (= code commit `c3f1503a` +
report docs). Probe file:
`game/src/services/save/auditR39COR.probe.test.ts` — 12 tests, all green
(`npx vitest run src/services/save/auditR39COR.probe.test.ts --pool=threads`).

**Verdict: PASS WITH EVIDENCE** — 0 Critical / 0 High / 2 Medium /
2 Low / 1 Nit. All eight fixes verified correct within their claimed
scope; two sibling misses in the same classes the batch fixed (the
freeze-reason carry and the post-emit live read), two bounded ordering
defects in the queue/intent machinery, one cosmetic gate edge.

---

## Findings

### r39-COR-1 (Medium) — the step-7 strip is reason-scoped, not plant-scoped: foreign 'authority-pause' / 'tab-hidden' carry verbatim and wedge the fresh battle; the stage-mint emit plants 'turn-in-flight' *past* the strip entirely

**Claim attacked:** `beginBattleCycleCommitted` step 7
(`GameManagerTurnBattleOps.ts:2191-2205`) filters the carried snapshot to
`reason !== 'user-pause' && !(reason === 'turn-in-flight' && token ===
'IDLE')` — claimed sufficient because 'turn-in-flight' was the only
foreign reason reachable through the `presentation_session_started` emit
window.

**Confirmed mechanism.** The emit at :2174 sits between the token reset
(`clearCycleEntryState` at :1903) and the latch snapshot (:2191), so a
listener inside it can plant any reason — the strip only removes two of
the five. Freeze-reason census (`freezeCombat`/`resumeCombat` callers):

- `'turn-in-flight'` — produced solely by the token listener in
  `attachTurnTokenToClock`; cleared only on a token transition. A plant
  on an IDLE token is a permanent wedge — **stripped correctly** (the
  probe in r38 already proved it).
- `'user-pause'` — battle-scoped owner (CombatTopBar resets without
  resuming) — **dropped correctly**.
- `'not-revealed'` — carried verbatim, but `syncOffScreenFreeze()` at
  :2211 re-derives it from `session.isBlocking()` right after the
  replay, so a foreign plant cannot survive a non-blocking session —
  **neutralized**.
- `'authority-pause'` — carried verbatim. Its only in-session resumer is
  `resumeSimulation` (`useAppLifecycle.ts:299`), gated on `simPaused`,
  which a foreign plant never arms. Result: permanent frozen clock, no
  curtain, no unlatch until next boot.
- `'tab-hidden'` — carried verbatim. Its only resumer is
  `continueBattle` (`useCombatPause.ts:53`), gated on `isPaused`, which a
  foreign plant never arms. Heals only via a *real* hide→show cycle plus
  a Continue click — a session that never hides stays silently frozen
  (no curtain to explain it).

**Repro (probes A1/A2):** listener on `presentation_session_started`
calls `freezeCombat('authority-pause' | 'tab-hidden')` inside the emit;
`startBattleWithPlayer` mints; the fresh clock comes up
`getFreezeReasons() === [reason]`, `getCombatClockState() === 'frozen'`,
and a 260-step claim window produces `totalTurnsElapsed === 0` — the
wedge the 'turn-in-flight' fix removed, intact for two siblings.

**Sibling seam — the strip cannot reach stage mints at all.** 'stage'
cycles skip the :2161 presentation block; their
`presentation_session_started` emit runs inside
`mintCombatSessionForLaunch` (:2487) **after** step-7. A plant there
lands directly on the already-running clock — even 'turn-in-flight',
which the strip provably removes from the carry channel, wedges the
battle permanently (probe A3: plant → release hold → reasons
`['turn-in-flight']`, clock frozen, 0 turns over 260 steps).

**Root class:** `freezeCombat` is a public unsanitized latch-setter —
any reason, any moment, no owner check. The step-7 strip fixed one
carry-channel manifestation; the class persists wherever a synchronous
listener can reach `freezeCombat`. An honest bound exists for
'turn-in-flight' (token IDLE = orphaned by construction) but not for
'authority-pause'/'tab-hidden' at the ops layer — legitimate carries are
required (boot-admission mint under authority pause; mint while the tab
is hidden), so closing this needs latch provenance (owner identity on
the reason) rather than a predicate. **Severity Medium:** identical
consequence and reachability to the item r38 fixed; adjudication may
accept it as residual, but it should be a recorded decision.

### r39-COR-2 (Medium) — `recordPerfectClearIfEligible` still reads the timer binding post-emit: a mid-emit mint writes a permanent 0-second perfect clear and locks the stage out of autofarm

**Claim attacked:** r38-AUT-3 snapshotted `activeStageForTurnBattle`
before `publishBattleEnd` (`GameManagerBattleRewardOps.ts:151`) so a
`battle_end` listener minting inside the emit cannot rebind the credit.
The fix covered the **stage** binding — it missed the **timer**
binding: `const startedAtMs = this.deps.getStartedAtMs() ?? Date.now()`
at :226 is a live read executed *after* the emit.

**Mechanism chain (probes B1–B3):**
1. Stage battle with `perfectClearTurnLimit`; `turnBattleStartedAtMs`
   stamped at launch (:2477).
2. Victory → `grantTurnBattleRewards` → `publishBattleEnd` emits
   `battle_end` (:157) — a listener mints inside it.
   - 'fresh' mint → `!preserveStageBinding` → `turnBattleStartedAtMs =
     null` (:1949) → post-emit read hits `?? Date.now()` →
     `clearSeconds = 0`.
   - 'stage' mint → `mintCombatSessionForLaunch` restamps
     `turnBattleStartedAtMs = Date.now()` (:2477) → `clearSeconds = 0`.
3. `player.perfectClearStageIds.push(stage.id)` +
   `player.perfectClearSeconds[stage.id] = 0` — and per B4 semantics the
   first record is **never overwritten** (:212-214), so the bogus 0 is
   permanent in the save.
4. Consequence chain: `isValidCycleSeconds` requires `>= 1 &&
   Number.isFinite` (`GameManagerAutoFarmOps.ts:21-27`), so
   `resolveValidAutoFarmStage` rejects the stage forever — the stage is
   flagged perfect-clear yet permanently autofarm-ineligible, and the
   `perfect_clear` emit broadcasts the same bogus 0 to audio/UI
   consumers.

**Probe evidence:** mocked `Date.now` advances +5s during the battle —
control records `5`; with a fresh mint inside the emit the record lands
`0`; a stage mint lands `0` the same way. Stage attribution itself is
correct (the snapshot fix holds — the record lands on the *ended*
battle's stage); only the seconds are wrong.

**Severity Medium:** same emit-window class as the fixed item, strictly
worse consequence — AUT-3's unfixed variant dropped or misattributed
writes; this one persists a dishonest record that permanently disables a
feature on that stage.

### r39-COR-3 (Low) — `drainBoundaryQueueIfIdle` recreates the IDLE+empty window mid-drain: a queued command that calls a boundary API runs inline ahead of the rest of the batch

**Claim attacked:** the r38 guard made `enqueueAtTurnBoundary` queue
whenever `boundaryQueue` is non-empty, preserving arrival FIFO.

**Confirmed mechanism (probe C):** the drain swaps the queue out
(`const queued = this.boundaryQueue; this.boundaryQueue = []` ~:706)
then iterates — so while a batch is executing, `boundaryQueue.length
=== 0` and the token is IDLE. A queued command that calls back into a
boundary API (e.g. `setBattleManualMode`) takes the **inline arm**
mid-drain and lands ahead of the rest of the batch. Order: queue
`[foreignCmd, applyFalse]`; during drain `foreignCmd` calls
`setBattleManualMode(true)` → inline write `true` → then the queued
`applyFalse` lands `false`. FIFO-correct behavior (nested intent queues
behind the batch) would end `true` — the drained order inverts the
arrival order the r38 fix was written to establish.

**Sibling note:** the swapped batch is not generation-checked — a
command that re-mints mid-drain (`startBattleWithPlayer` inside a queued
closure) leaves the dead battle's remaining commands executing against
the new cycle's session. Today the only enqueued producer is the manual
closure (a session-scoped flag write that converges via
`pendingManualMode` re-land), so no current producer exhibits either
shape — the exposure is the public `enqueueAtTurnBoundary` seam.
**Severity Low.**

### r39-COR-4 (Low) — `setBattleManualMode`'s slot hoist and queue push disagree under a nested call: pendingManualMode holds the last-*invoked* intent while the queue drains in *enqueue* order

**Claim attacked:** writing `pendingManualMode = enabled` at method top
(:2722) guarantees the slot always mirrors the latest toggle before the
stranded rescue can reach `dropBoundaryQueue`.

**Confirmed mechanism (probe D):** the slot write happens at top, but
the call's own boundary command is pushed at :2758 — *after* the rescue.
When manual ON is parked at AWAITING_INPUT and `setBattleManualMode(false)`
runs the rescue, `beginTurnPipeline(stranded,'ready')` synchronously
emits `turn_ready` (`notifyReadyActor` → `emitTurnReady` at
`CombatAnimationRuntime.ts:487`). A listener calling
`setBattleManualMode(true)` inside that emit enqueues `applyTrue`
**before** the outer call's `applyFalse` — queue order
`[applyTrue, applyFalse]` inverts invocation order
`[outer:false, nested:true]`. Drain lands `false` — the *first*-invoked
intent wins, while `pendingManualMode` (had a drop run) would have
re-landed `true`. The two arms of the same latch resolve the identical
interleaving to different values. Probe records the write order
`[true(arm), false(rescue), true(applyTrue), false(applyFalse)]` →
final flag `false`.

**Severity Low:** reachable only via a nested synchronous caller inside
the rescue window (no production listener does this today), each outcome
is individually defensible, and the flag is session-scoped (self-heals
at next toggle) — but the hoist's documented invariant ("slot mirrors
the toggle") only holds for non-overlapping calls.

### r39-COR-5 (Nit) — a failed transition *into* a game route keeps `entryStage === 'game'` over the mounted error surface, so `isCombatActive` still arms the pause curtain

**Claim attacked:** `entryStage` is the admission signal the boot-fail
zombie lacks — the fail arms land 'error'.

**Verified edge (probe E):** `useBootFlow`'s stage derivation
(:53-62) promotes 'game' when `routeAdapter.error.value?.failedRequest
.target` is a game route — deliberately, to keep the Phaser host mounted
for retry. A *mid-session* failed transition into home/combat/
tribulation therefore leaves `stage === 'game'` while the error card is
mounted; with a live frozen battle the gate `entryStage === 'game' &&
clockState !== 'stopped'` still passes, so a hidden tab arms
`isPaused` + 'tab-hidden' over the error surface — the boot-fail shape
the fix excluded, reached through the side door.

**Bounded:** `PresentationTransitionOverlay` (which renders the error
shell) sits above `OVERLAY_LAYERS.combatPause` (900), so the armed
curtain is visually covered; the latch dies with the battle's teardown;
and a mid-session transition failure is rare. **Severity Nit** —
intentional stage promotion, cosmetic consequence.

---

## Verified-clean claims (attacked and rejected as findings)

- **Step-7 strip completeness (for 'turn-in-flight'):** the token is
  *provably* always IDLE at :2191 — `turnToken.reset()` runs in step 1
  (:1903 `clearCycleEntryState`), and no listener-reachable path can
  re-claim: `turnToken.claim()` exists only inside `stepTurnBattle`'s
  fighting branch and `beginTurnPipeline` (private); public token
  mutators gate on AWAITING_INPUT. The only eventBus emit inside the
  committed block is `presentation_session_started` (:2174; 'stage'
  kind skips that block entirely — `emitTurnBattleEntitySnapshot`,
  `status_vfx_*`, `attack`, `reactive_proc` all live in
  `stepTurnBattle`, post-mint). A legitimate non-IDLE 'turn-in-flight'
  cannot reach step 7 — the strip is neither over- nor under-aggressive
  for the reason it covers.
- **FIFO guard interleavings:** single-threaded — no enqueue can land
  between the `boundaryQueue.length === 0` read and `command()`. The
  `resolve()` → IDLE token transition completes synchronously (the clock
  listener's `resume` runs inside `setState`), so no half-resolved IDLE
  exists. Double-toggle mid-turn queues both closures in order and
  `pendingManualMode` tracks the last writer (r38 pin reproduced).
- **Hoisted splice correctness:** `timer` is reassigned per re-arm, so
  `indexOf(timer)` in the same closure always identifies the just-fired
  handle; a stale same-epoch delivery of a cleared handle hits the
  `pendingStepDone[signal] === undefined` settled check *before* the
  splice (bails clean — pin); no two fallbacks share a handle (each
  `awaitStep` owns its `setTimeout`); no arm needs the fired handle kept
  (the cap-drain arm's entry consumption calls `clearTimeout(timer)` on
  an already-dead handle — harmless). Deferral re-arm keeps exactly one
  live handle across repeated fires (probe F1).
- **Intent-slot hoist (non-stranded path):** a plain
  `setBattleManualMode` writes the slot then queues; the closure lands
  the flag and nulls the slot in the same synchronous pair — no throw
  can split them (`runtime.setBattleManualMode` is a flag write that
  cannot throw); readers are only `dropBoundaryQueue` (re-land) and the
  closure itself (probe F3).
- **enemyManager.clear ordering:** runs at :1914 — before every spawn
  path in the committed block (initial enemy, wave factory, entry
  summons). Registry census: sole writer `EnemySystem.spawn`/`despawn`;
  sole readers `BattleLootSystem.processDefeatedEnemies` +
  `getAliveEnemies`; cleared consistently on discard (:1781) and abandon
  (:2655). A nested mint's step-1 clear sweeping the outgoing battle's
  leftovers mid-emit is safe — `battle_end` payload consumers read the
  *event*, not the registry (no current listener reads enemyManager
  during emit). A mint that fails post-clear unwinds through
  `discardFailedCycle` — the registry is already empty, and cleared
  entities have no dangling readers.
- **stageSnapshot on both terminal paths:** victory binds the snapshot
  for both `recordPerfectClearIfEligible` (:166) and
  `completedStageIds` (:170-186); the defeat arm never consults the
  stage (probe F2: mid-emit mint inside a *defeat* `battle_end` leaves
  `completedStageIds`/`perfectClearStageIds` empty — no misattribution).
- **entryStage transition graph:** 'game' + stopped clock + live-combat
  semantics is unobservable (the stop→start replay inside step-7 is
  synchronous; terminal states have stopped+dead battle — gate correctly
  false). The reverse (non-'game' + running + live battle) is bounded by
  promote-only demotion — the stage stays 'game' until the route
  actually changes; a live battle under 'auth' post-logout is covered by
  the next boot's discard.
- **Adjudicated-accepted bounds re-verified:** no re-report — the
  bump-starved curtain, finish-the-swing ACK drain bounds, parked
  out-of-domain stamps, NaN write-gate wedge, boot-path discard
  contract, post-discard internals, mounted-by-design
  turnBattleSystem/combatRng, rejected-route 'entered', markReady
  injected-fault class, and 'user-pause' dies-at-boundary semantics all
  hold at 56098103 as adjudicated.

## Attack-surface coverage notes

- Emit windows between step-1 token reset and the step-7 snapshot:
  `presentation_session_started` (:2174, fresh/test only) is the sole
  listener-reachable seam inside the committed block; the stage-mint
  emit (:2487) runs after step-7 (covered under COR-1's sibling).
- `pendingManualMode` readers: `dropBoundaryQueue` (re-lands then nulls)
  and the enqueued closure (nulls on land) — enumerated complete.
- `enemyManager` writers/readers: `EnemySystem.spawn`/`despawn` (add/
  remove), `BattleLootSystem.processDefeatedEnemies` + `getAliveEnemies`
  (read), three `clear()` sites (:1781 discard, :1914 committed step-1,
  :2655 abandon) — enumerated complete.
