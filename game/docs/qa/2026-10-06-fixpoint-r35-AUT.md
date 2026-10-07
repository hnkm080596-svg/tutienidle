# Fixpoint audit r35 — AUT (adversarial exploit)

Auditor: r35-AUT worker (Devin session). Base: `codex/hoa-cau-fireball-vfx`
@ `b1ffef6c` (the full r34 adjudication). Role: assume the r34 discard is
exploitable — `discardStaleBattle()` immediately before
`authority.markReady()` (~useAppLifecycle.bootGame :740), the tail
try/catch re-latch, `authority.beginChecking()` inside the outer try —
then siblings of each class: partial-teardown survivability, the discard
weaponized against an honest battle, the catch arm's freeze on a stopped
clock, the markReady→enterGame window, beginChecking throwability, the
null-turnBattle discard, and the pause/resume/stopAll seams on a
discarded battle.

In-place audit on the audit commit (test+doc writes only — P1/P2
read-only on production code). Every claim below carries an EXECUTED
deterministic repro in `src/services/save/auditR35AUT.probe.test.ts`
(16 tests, all green — `npx vitest run <file> --pool=threads`,
`@vitest-environment node`, `Date.now` and `Math.random` mocked: the
combat rng is `FunctionCombatRng(() => Math.random())`, designed to be
intercepted there). Report branch: `devin/audit-r35-AUT-b1ffef6c`.

Verification executed:
- `npx vitest run src/services/save/auditR35AUT.probe.test.ts
  --pool=threads` — 16/16 green.
- `npm run type-check` — clean.
- Full read of the r34 surfaces at the audit commit:
  `useAppLifecycle.ts` (:335-380 bootGame entry + bootInFlight guard +
  simPaused re-baseline, :386 remoteAuthoritative gate, :370-371
  beginChecking inside try, :493 restoreGameSession rebind point,
  :543-604 remote post-accrual commit leg incl. `await
  player.save(gameManager)` :547 + refuse arms, :606-727 grant path
  incl. `firstSave` :663, :731-780 discard->markReady->tail try/catch->
  finally, :261-305 pauseSimulation/resumeSimulation entryStage gates,
  :802-823 stopAll),
  `GameManagerTurnBattleOps.ts` (:813-860 awaitStep — real-time
  setTimeout fallback at ANIMATION_FALLBACK_MS=4000 driving
  driveStepWork when the session is not isBlocking, 8x deferral cap;
  :868-875 clearPendingSteps kills pendingStepTimers + pendingStepDone;
  :888-899 driveStepWork; :906-912 settleHeadlessStep; :917-938
  onTurnDrained -> token resolve -> settleCombatOutcome; :944-990
  settleCombatOutcome — victory+repeatContinuously+live lease ->
  restartTurnBattleCycle, else combatClock.stop() :989; :1527-1530
  commitCycleRng; :1555-1572 clearCycleEntryState; :1588-1654
  discardFailedCycle/discardStaleBattle/discardInFlightBattle —
  field-by-field: turnBattle=null, session.end(getCurrentSession()),
  stageWaves.stopRepeat, enemyManager.clear, surviveLethal null,
  cycle-entry state, combatClock.stop(), all bindings nulled; :1760-1790
  beginBattleCycle ordering incl. rewardOps.resetRewardState :1770 and
  preserveStageBinding :1783-1790; :2001-2021 session re-open policy +
  combatClock.stop()+start() :2020-2021; :2193 restartTurnBattleCycle;
  :2213-2274 startStage incl. pendingCycleRng cleared in finally),
  `GameManagerBattleRewardOps.ts` (:40-46 resetRewardState,
  :74-180 grantTurnBattleRewards — processDefeatedEnemies per-kill
  loot :107, battleEndEmitted once-guard :121, bankPassiveCarry :133,
  stopRepeat release :141, publishBattleEnd :149, settleTechniqueMastery
  :156, recordPerfectClearIfEligible :158, completedStageIds dedup push
  :167),
  `PresentationSession.ts` (:182-192 isBlocking — headless false, no
  currentSession false, else held||!released),
  `OnlineSessionController.ts` (:183-192 canMutate, :195-211
  beginChecking = pure field writes + clearRetry + transition,
  :216-221 markReady timers-before-fanout, :240-255 pause, :345-363
  acknowledge/stopAll, :470-552 attemptReconnect generation fences),
  `useBootFlow.ts` (:36-74 entryStage derived from routeAdapter,
  :94-96 enterGame = void coordinator.request, :97-112 fail retry
  loop),
  `players.ts`/`player.ts` (:673-679 restoreFromSave = stale-key sweep
  + `Object.assign(this, restoredPlayer)` — IN-PLACE rebind: the
  player's live $state object keeps its identity),
  `initializeCharacter.ts` (:56-99 — writes via applyCreationProfile
  onto `player.$state` — same in-place object),
  `StageWaveSystem.ts` (:149-154 rollbackFailedStart identity-checked,
  :165-178 stopRepeat, :186-188 holdsActiveStageLease),
  `TribulationDirector.ts` (:202-207 — owns a SEPARATE
  PresentationSession instance; the ops session the discard ends can
  never be the tribulation one).
- Discard ordering claim re-checked line by line:
  `discardInFlightBattle` is pure field mutation all the way down —
  `session.end` is identity-checked and only flips fields,
  `stageWaves.stopRepeat` releases the wave system's own lease under an
  ownership check, `enemyManager.clear` empties an array, all the
  null-outs are writes. Nothing in the teardown can throw: partial
  teardown is not constructible in production code.
- Ghost-drain channel verified against `awaitStep`: the parked
  fallbacks run on wall-clock `setTimeout` and never consult the
  CombatClock — `driveStepWork` executes the real turn mechanics
  (declare/impact/complete -> drain -> token resolve ->
  settleCombatOutcome). A frozen clock is irrelevant to the path.

---

## Verdict: FAIL (0 Critical / 1 High / 1 Medium / 0 Low / 0 Nit)

The r34 discard does its advertised job exactly once — at :740 on an
'entered' boot it kills the battle, the pending step timers, the
session, the lease, and every binding, deterministically and
idempotently (probed field-by-field, including the tail-catch deny
direction on the stopped clock). What it does not — and cannot —
protect is the window BETWEEN the $state rebind and the discard:
`awaitStep`'s real-time fallback timers keep resolving the ghost's
parked pipeline on wall-clock seconds while the boot awaits, and the
mint lands on whichever character now owns the bound object — which is
the loaded/created character, because `restoreFromSave` and
`initializeCharacter` both rebind `player.$state` IN PLACE. On a
`repeatContinuously` stage the ghost does worse: its terminal victory
restarts a fresh live cycle that unlatches 'authority-pause' itself and
resumes the combat clock — so a FAILED boot keeps a RUNNING auto-farm
behind the error surface instead of the frozen zombie the r33 doctrine
(and the :353-357 comment's own invariant) assumes. Both findings are
executed end-to-end.

| ID | Severity | Class | Surface |
|---|---|---|---|
| R35-AUT-1 | Medium | lifecycle / cross-owner mint | `awaitStep` real-time fallbacks (`GameManagerTurnBattleOps.ts:813-860`) drain a parked mid-turn ghost on wall-clock time — `freezeCombat('authority-pause')` is never consulted by the timer path. Between `restoreGameSession`'s in-place `Object.assign` rebind (:493 -> player.ts:679) and `discardStaleBattle()` (:740), every real-time await is a live mint window; the concrete one is the remote-authoritative post-accrual commit leg `await player.save(gameManager)` (:547) — plus `firstSave` (:663) on the create/grant arm (initializeCharacter writes onto the same `$state` object). EXECUTED: released-session interactive ghost parked at 'ready', clock frozen -> 3 fallback ticks on fake timers -> `battle.state === 'victory'`, `battle_end` emitted, `completedStageIds` minted onto the bound object; the same drain executed INSIDE the held-open `player.save` await mints onto the rebound character before the discard runs; an `Object.assign`-rebind executed mid-drain does not lose the mint. Also minted silently: `phaGiapCarryStacks` (overwrite via bankPassiveCarry — a defeat-terminal ghost can WIPE the loaded character's banked stacks), per-kill loot via `processDefeatedEnemies`, `settleHiddenTrialIfDue` records, `perfectClear*` on the fast-kill path, technique mastery. DENY BOUNDS: local-only boot has no real-time await pre-discard (executed: ghost cannot mint); the mint is bounded to the in-flight turn + its terminal per cycle; `completedStageIds` dedups (:167); the battle must be parked mid-turn on an interactive/released (or cap-drained held) session — a 'fighting'-phase ghost on a frozen clock is inert until it next claims; the terminal token lands 'COMBAT_OVER' so no new claims post-victory on non-repeat stages. Severity Medium: real silent cross-character mint, narrow-ish trigger (parked ghost + remote-authoritative commit that outlasts ~4s/fallback tick), bounded payload. |
| R35-AUT-2 | High | lifecycle / doctrine violation + self-perpetuating zombie | `settleCombatOutcome` (:976-984): victory + `turnBattleRepeatContinuously` + live stage lease -> `restartTurnBattleCycle()` -> `beginBattleCycle` step 7 executes `combatClock.stop()` + `combatClock.start()` (:2020-2021) — `stop()` clears EVERY freeze reason including the boot's 'authority-pause', then `start()` takes the clock to 'running'. The ghost battle unlatches the exact latch the fix leans on, installs a fresh live battle, and re-arms the reward once-guards (`resetRewardState` :1770) — every subsequent victory pays loot/carry/terminal again, on RAF frames plus the same real-time fallbacks. EXECUTED: frozen parked repeat ghost -> 3 fallback ticks -> `getTurnBattle()` is a NEW battle object, `getCombatClockState() === 'running'`, `getFreezeReasons() === []`; EXECUTED END-TO-END under the real `bootGame`: remote-authoritative boot, commit leg held open -> ghost drains to victory and self-restarts mid-await -> commit refuses (retryable 'unavailable') -> `boot.fail()` -> outcome 'failed' -> the kept "zombie" is `getCombatClockState() === 'running'` with an empty reason set — and it keeps resolving further victories indefinitely (asserted a third cycle spins up). `pauseSimulation` can never re-latch it (entryStage is 'error', not 'game'); autosave/tick stay gated; only the next 'entered' boot's discard or a tab kill terminates it — and the minted state rides along inside the NEXT boot's post-accrual commit (`player.save` snapshots `$state`, mint included). Severity High: violates the shipped "failed boot keeps the frozen zombie" contract outright (the kept zombie is live), self-perpetuating and unbounded while the surface dwells, mints real progression into a character that never fought — silently, with no terminal event suppression able to fire post-discard. Trigger is the common case (combat logout mid-turn on a repeating farm stage) gated by any pre-discard failure — which is exactly the arm the doctrine exists for. |

## Attack log — rejected candidates (verified held)

- **Partial teardown / survivable discard** — `discardInFlightBattle`
  is pure field mutation top to bottom; `session.end`, `stopRepeat`'s
  identity-checked release, `enemyManager.clear`, and the binding
  null-outs cannot throw, so a half-torn ghost is not constructible.
- **Discard weaponized against an honest battle** — the only caller is
  `bootGame` at :740, behind the binding-rebind paths; a battle that
  still legitimately owns `playerDataForTurnBattle` cannot be the one
  present at that point by construction (the rebind already repointed
  ownership). Verified: nothing else calls `discardStaleBattle` /
  `discardFailedCycle` outside startStage's failed-launch arm.
- **Catch arm's freeze re-latching a stopped clock** — executed:
  `freezeCombat('authority-pause')` and `resumeCombat` post-discard are
  exact no-ops on 'stopped' (clock never re-runs, reasons stay []).
  Both directions deny.
- **`resumeCombat` having already run when the tail throws** — the
  tail is synchronous; the throw can only come from
  markReady/resume/clock.start/tickLoop/enterGame, and the catch's
  freeze lands on a stopped clock either way — no resurrection.
- **markReady->enterGame window post-discard** — fully synchronous;
  `entryStage` is derived from the route adapter (useBootFlow :36-74),
  `canMutate` false during 'checking', tick/persist gates closed; a
  second `bootGame` mid-flight is 'skipped' (executed) and `stopAll`
  mid-commit resolves 'skipped' with the zombie untouched (executed).
- **`beginChecking` throwing** — pure field writes + `clearRetry` +
  `transition`; the only throwable member is an injected `onStateChange`
  listener (injected-fault class, same as r34-AUT-2's markReady). The
  outer try's `finally` now releases `bootInFlight` correctly either
  way — verified by construction and by the 'skipped' second-boot probe.
- **Null-turnBattle discard tearing down a concurrent caller's state**
  — executed on an empty manager: true no-op. `session.end` targets
  `getCurrentSession()` of the OPS session (combat-kind only);
  `TribulationDirector` owns a separate `PresentationSession` instance
  (:202-207) the discard cannot reach; `stopRepeat` is identity-checked
  against the wave system's own lease; `combatClock.stop()` clearing
  non-battle freeze reasons is inert on a stopped clock and the next
  `beginBattleCycle` re-baselines anyway — the r34 comment claims
  exactly this.
- **Stale renderer ACK post-discard** — executed: acknowledge* calls on
  the pre-discard playback token no-op; token state stays 'IDLE'.
- **Double discard / discard on the grant path** — idempotent
  (executed); `pendingCycleRng` is cleared in `startStage`'s finally
  (:2254) so a refused launch leaves nothing for the discard or the
  next launch to trip over.
- **`pauseSimulation`/`resumeSimulation`/`stopAll` on a discarded
  battle** — pause/resume gate on `entryStage === 'game'` + `simPaused`
  and cannot interleave with the synchronous discard; stopAll's
  terminal latch keeps the zombie only on the failure arms (the surface
  R35-AUT-2 attacks).
- **`boot.enterGame` rejected-request post-discard** — same
  fire-and-forget route request as r34-AUT-1's accepted residual; the
  discard makes the post-admission state strictly emptier, not wider.
- **`ProductionSystem.restoreStates` comment** — re-verified: the
  `<=` inverted-pair drop runs BEFORE the domain check at :140/:171,
  so the comment's claim (inverted drops first; only non-inverted
  out-of-domain parks verbatim) is accurate.
- **Honest-same-character battle discard** — the discard only fires
  post-rebind on 'entered'; a battle that survived to that point was
  already dead per the contract. Same-by-design as the adjudicated
  "entered boots start battleless" pin.
- **Ghost mint into the pre-rebind (old) object** — drains landing
  before `restoreGameSession`'s Object.assign write onto the dead
  character's fields, erased by the rebind itself; only the post-rebind
  window (R35-AUT-1) carries mints into live state.
- **`restoreGameSession` partial-application mint gap** — a
  restore-time throw returns 'rejected' BEFORE the commit leg; the
  ghost then mints onto a half-restored object but the boot never
  reaches the discard — the zombie it leaves is covered by the
  failed-boot arm analysis (R35-AUT-2 territory), not a third class.

## Coverage notes for the coordinator

- The wave's core surprise: the adversarial contract treats the CombatClock
  as the ghost's leash, but `awaitStep`'s pendingStepTimers run on wall
  time — every fixed or frozen-clock invariant the discard leans on is
  bypassed by the timer channel. Any adjudication should decide whether
  the fixpoint needs a real-time deadman (e.g. `discardStaleBattle` moved
  BEFORE the rebind awaits, or a `stepOwner`/generation check inside
  `driveStepWork` so a rebound-session's parked timers can never drive
  work) — not a comment on what the clock state is.
- R35-AUT-2's narrowest repair surface is `beginBattleCycle`'s
  `stop()+start()` pair (:2020-2021) — the same lines that legitimately
  clear stale reasons on a real cycle start are what erase
  'authority-pause' under a ghost restart. If adjudicated fixable, gating
  the restart arm on the authority/mutation state (or freezing rather
  than starting when 'authority-pause' is latched) closes the
  self-unlatch without touching the repeat UX.
- R35-AUT-1's narrowest repair is ordering, not mechanism: the discard
  only needs to precede the first post-rebind real-time await, or the
  drain needs a generation check (`presentationOps.session` already
  tokens work — the parked pendingSteps could carry the boot/boot
  generation and driveStepWork could refuse stale ones).
- Probes now pin, end-to-end: the silent discard on 'entered'
  (no terminal, no banking, clean clock), the local-mode no-window deny,
  the remote commit-leg live window, the failed-arm running-zombie
  violation, second-boot 'skipped', and stopAll-mid-commit fail-safe —
  six boot arms, all executed rather than asserted from prose.
