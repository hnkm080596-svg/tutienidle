# Fixpoint audit r32 — INT (integration coherence)

Auditor: r32-INT worker (Devin session). Base: `codex/hoa-cau-fireball-vfx`
@ `1d27aee4` (the full r31 adjudication). Role: do the r31-corrected layers
still agree with each other at every consumer and seam — the non-negative
persisted domain `[0, 2^52)` vs every real caller feed
(`restoreClockMs`/`settleNowMs`/`offlineSinceMs`/`Date.now` derivations),
restoreJobs-drop vs restoreStates/QuestManager park contracts, the mint
headroom guards vs legitimate far-future stampers, `bootGame`'s
`simPaused = false` re-baseline vs `entryStage`/`resumeSimulation`/
`pauseSimulation` ordering, the `appliedAtMs` `min(bound, now)` clamp vs
the `boundTimedEffectClocks` restore seam + `<= lastSavedAt` pin, and
every new deny-return vs its caller's handling.

Worktree: `.agent-worktrees/audit-r32-int` @ `1d27aee4`. Read-only on
production code; every claim below carries an EXECUTED deterministic repro
in `src/services/save/auditR32Int.probe.test.ts` (8 tests, all passing —
`npx vitest run <file> --pool=threads`, `@vitest-environment node`,
`Date.now` mocked). Report branch: `devin/audit-r32-INT-1d27aee4`.

Verification executed:
- `npx vitest run src/services/save/auditR32Int.probe.test.ts --pool=threads`
  — 8/8 green.
- Full read of the r31 surfaces at the audit commit:
  `useAppLifecycle.ts` (:160-181 flag/generation state, :228-247
  startTickLoop gate, :261-305 pauseSimulation/resumeSimulation,
  :335-740 bootGame incl. :346 re-baseline + :716-734 markReady/clock/
  tick/enterGame tail, :784-803 stopAll), `App.vue` (:592-618 local
  refuse arm ordering, :704-749 onPause/onResume/onStateChange wiring,
  :806-822 acknowledgeAuthority/teardownToAuth, :1095-1105
  onAuthenticated), `OnlineSessionController.ts` (:345-363
  acknowledge/stopAll), `GameManagerSaveRestore.ts` (:349-475
  restoreClockMs/settleNowMs/offlineSinceMs derivations),
  `WorkerLaneAdvance.ts` (:146-188 guard + deny-return shape),
  `ProductionSystem.ts` (:129-189 restoreStates verbatim/shift arms,
  :430-470 tickWorkers caller, :488-511 settleOffline),
  `ProductionOffline.ts` (:90-206 settleWorkersOffline incl. the
  :184-194 seeded-head field-epoch re-stamp),
  `AlchemySystem.ts` (:334-338 alchemySecondsFor, :376-463 restoreJobs
  drop/shift arms, :512-518 startJob headroom, :660-790 tick domain
  guard), `DecomposeSystem.ts` (:76 cycleMs, :168-174 tick headroom,
  :292-339 restore merge + settleOffline window guards),
  `QuestManager.ts` (:147-204 restore normalize arm),
  `GameManagerTurnBattleOps.ts` (:231 clock field, :384-433
  setCombatClockSource/freezeCombat/resumeCombat/state getters,
  :1991-1996 beginBattleCycle stop()+start(), :2406-2453 abandonBattle
  teardown), `GameManagerPersistentEffectOps.ts` (:307-385 stackable/
  non-stackable/push clamp arms, :403-432 activateTuLinhTran),
  `stores/player.ts` (:119-196 boundTimedEffectClocks +
  payoutExpiresAtMs), `saveShapeValidation.ts` (:421-426 domains,
  :1588-1609 appliedAtMs pins, :1640-1760 TLT/pill writer bounds,
  :3374-4644 the non-negative sibling pins), `CombatClock.ts` (:77-101
  start/freeze/stop semantics), `AlchemySurface.vue` (:310-371
  reason -> alchemy.reason.* map incl. invalid_clock locales en+vi).

---

## Verdict: FAIL (0 Critical / 0 High / 1 Medium / 0 Low / 1 Nit)

The r31 corrections hold at every consumer seam I attacked, EXCEPT the
combat half of the pause pair: `bootGame`'s new `simPaused = false`
re-baseline clears the composable latch but leaves the `CombatClock`
`'authority-pause'` reason orphaned — a battle frozen at terminal-pause
time re-mounts frozen forever behind a fully live sim.

| ID | Severity | Class | Surface |
|---|---|---|---|
| R32-INT-1 | Medium | paired-latch re-baseline orphans the combat freeze | `useAppLifecycle.ts:346`. The pause contract is TWO latches: `simPaused` (composable flag) AND `CombatClock.reasons` (`'authority-pause'`, latched by `pauseSimulation()` -> `freezeCombat` at :286, cleared only by `resumeCombat` inside `resumeSimulation` at :299). r31 re-baselined only the first. Chain: live battle -> `pauseSimulation()` (remote `onPause('terminal')` App.vue:702, or the local coded-refuse arm :612) -> freeze -> `acknowledgeAuthority()` (:806-809; `onlineAuthority.acknowledge()` transitions 'signed-out', does NOT stopAll -> `stopped` stays false) -> `showAuth` -> `onAuthenticated` (:1095) -> `bootGame(false)` -> `simPaused=false`, `clock.start()`, `startTickLoop`, `enterGame` -> `'entered'`. Post-entry the mounted `turnBattle` is still frozen: `getCombatClockState()==='frozen'`, `getFreezeReasons()` holds `'authority-pause'`; `resumeSimulation` dead-ends on `!simPaused` so `resumeCombat` can never fire (probed R1: `resumeCombat` spy never called, freeze survives re-boot, a direct `resumeSimulation()` call after entry is a no-op). Symptom: the player re-enters to a battle whose turns never advance, with no pause affordance — `'authority-pause'` has no user-visible toggle. Escapes (probed R2): a NEW battle's `beginBattleCycle` `combatClock.stop()+start()` (:1994-1995) clears all reasons; `abandonBattle` -> `stop()` (:2453); or any later pause+resume pair. `stopAll` and `setCombatClockSource` also never clear reasons for this chain (stopAll leaves the clock untouched; setCombatClockSource only re-runs at module setup App.vue:201, and freeze() no-ops on a stopped clock so a battle-less pause can't orphan). Fix direction: pair `simPaused = false` with `gameManager.resumeCombat('authority-pause')` in `bootGame` — `resume()` deletes only that reason from the set, a no-op when the clock holds none, so it cannot unfreeze a 'user-pause'/'tab-hidden' latch. |
| R32-INT-2 | Nit | push-arm clamp ceiling looser than one source class's writer bound | `GameManagerPersistentEffectOps.ts:379-385` clamps a pushed `expiresAtMs` to `2^52-1` (the magnitude domain), but the `tu_linh_tran` writer bound at the gate is tighter: `expiresAtMs <= lastSavedAt + TU_LINH_TRAN_DURATION_MS + 7d` (`saveShapeValidation.ts:1660-1684`). A crafted TLT push with expiry past that bound passes the clamp yet self-refuses the next `buildGameSave` write ('vượt biên writer') — the clamp's stated contract ("every written save must re-validate") does not reach this class. Probed C2-TLT: pushed `expiresAtMs` clamps to `2^52-1`, the save then fails validation on the writer bound. Unreachable honestly: the only TLT writer (`activateTuLinhTran` :419-432) stamps `now + 24h` authored; only an internal caller can craft the arg — same ungated-caller class as r31-INT-4. Deny direction is already correct (the write refuses rather than persists); listed so the next domain tighten knows the clamp ceiling is not the tightest bound per source class. |

---

## Confirmed-coherent surfaces (attacked, no finding)

| Surface | Verification |
|---|---|
| Honest feeds can never go negative | `restoreClockMs = min(lastSavedAt \|\| Date.now(), Date.now())`, `settleNowMs = min(lastSavedAt + elapsed*1000, authorityNowMs, Date.now())`, `offlineSinceMs = min(lastSavedAt \|\| settleNowMs, authorityNowMs − elapsed*1000, Date.now())` — every derivation is min-clamped at `Date.now()`, so a negative requires a crafted negative `lastSavedAt` (admitted under its own magnitude pin). That class then hits the new `< 0` denies everywhere — deep-past residual class, pinned prior waves. |
| `restoreJobs` drop vs `restoreStates`/quest park | The asymmetry is documented and each policy is internally deny-lean: alchemy drops out-of-domain pairs (reservation inputs stay burned — no refund contract), production parks verbatim (deny lands in `advanceWorkerLanes`), quest normalize-clamps under a sane `[0,2^52)` clock and keeps verbatim under a bad one (:164-170). No sibling leaks a mint. |
| Deny-return shape at every `advanceWorkerLanes` caller | Deny returns `{completed: [], pending: [...params.pending], forfeited: 0, consumedBudgetMs: 0, seededPending: []}` — both callers (`tickWorkers` :450-468, `settleWorkersOffline` :157-170) write `state.workerCycles = result.pending` verbatim, so a deny preserves honest in-flight lanes, consumes no budget, and seeds nothing. Probed C1: a denied call with a VALID in-domain pending entry hands it back untouched (r31 only probed the empty-pending shape). |
| Headroom guards vs legitimate far-future mints | No honest caller mints near `2^52`: every `nowMs`/`restoreNowMs`/`emptyLaneStartMs` feed is ≤ `Date.now()` (~1.7e12) or a derived clamp. The only edge-of-domain mint anywhere is `applyTimedEffect`'s `expiresAtMs = 2^52-1` clamp output — itself inside the magnitude domain and bounded at restore by `boundTimedEffectClocks` (`provenance + duration`). |
| `Math.max(0, span)` in the headroom arms | A negative span would neutralize headroom — but every span is an authored constant or constructor arg (`alchemySecondsFor` returns `ceil(baseDuration/multiplier)` >= 1; `cycleMs = computeCycleSeconds(...) * 1000` positive; decompose `cycleMs` constructor-constant). Ungated-caller only. |
| `appliedAtMs` clamp vs restore seam + `<= lastSavedAt` pin | Push arm mints `min(2^52-1, Date.now())` — always ≤ the next write's `lastSavedAt` (stamped `Date.now()` at build) so the pin at :1600-1609 can't fire on a pushed record; `boundTimedEffectClocks` (:136-138) clamps the same field to `min(applied, nowMs, Date.now())` at restore — strict-subset consistent, no wedge path. Probed C2: crafted `appliedAtMs = 9e15` pushes as `Date.now()`, crafted `expiresAtMs = 9e15` pushes as `2^52-1`, and the resulting save validates clean. |
| `expiresAtMs` bare-bound clamp vs validator | `2^52-1` sits inside `isBoundedTimestamp` (`\|x\| < 2^52`); the pill-regen branch binds no expires window at admission (comment at :1733 — intentional; the live-seam bound `provenance + duration` at `boundTimedEffectClocks` :154-161 owns it). The TLT branch's tighter bound is covered in R32-INT-2. |
| `fieldEpochShiftMs` re-stamp (`ProductionOffline` :184-194) | The shift is `max(0, Date.now() − nowMs)`; when >0 it implies `nowMs < Date.now()`, so `completesAtMs + shift <= nowMs + cycleMs + (Date.now() − nowMs) = Date.now() + cycleMs << 2^52` — the re-stamp can never push a minted due out of domain. Succeeds only on seed-rooted heads (the documented r16/r17/r18 class). |
| `AlchemySystem.tick` parity without a headroom arm | `tick` (`:660-790`) mints no stamps — pure due-comparison + settle — so the `[0, 2^52)` clock guard (:677) suffices; nothing to headroom against. `settleOffline` delegates to `tick`. |
| `invalid_clock` deny -> UI | `startJob` returns `{ok:false, reason:'invalid_clock'}` (`:512-518`) -> `GameManagerAlchemyOps` passes the reason through (:169-198) -> `AlchemySurface.vue:369` maps `alchemy.reason.${reason}` with fallback — `alchemy.reason.invalid_clock` exists en+vi (locales :1580). Honest `Date.now()` feed makes it unreachable anyway. |
| Negative `lastSavedAt` + `workerCycles` conjunction | `isNonNegativeBoundedTimestamp(startedAtMs)` AND `startedAtMs <= lastSavedAt` are unsatisfiable when `lastSavedAt < 0` — a crafted save carrying both never reaches `restoreStates`; the bad-clock verbatim arm is byte-lane only (documented). |
| Remaining magnitude-domain stamps | `autoFarmStage.lastCheckedMs` consumers re-anchor on `<0` / `> now` / non-finite (`GameManagerAutoFarmOps.ts:271-275, 345-349`); `lastDailyResetAtMs` clamps future->now under a sane clock, verbatim under bad (QuestManager :164-170); `cooldownUntil` is non-negative-domain already (:4644); `decompose.nextCycleAt` non-negative (:4623); `hiddenChannelCycles` are integer counters, not ms stamps (:3645-3648). |
| `stopAll`/`teardownToAuth` vs re-boot | `stopped = true` dead-ends `bootGame` ('skipped') — the sign-out teardown cannot reach the orphan chain; the only re-boot path that CAN (acknowledge -> re-auth, `stopped` never set) is exactly the R32-INT-1 chain. |
| `WorkerLaneAdvance` budget/seat arms | `budgetMs` non-finite denies; negative budget collapses via `Math.max(0, budgetMs)` -> all completions forfeit — deny-lean, unchanged from r31. |

## Rejected candidates (attacked, mechanism disproven or equivalent)

| Candidate | Rejection |
|---|---|
| Post-dated parked pair re-written out-of-domain | A parked post-dated pair requires the shift-arm deny, which needs `restoreNowMs + span >= 2^52` — unreachable since every honest `restoreNowMs <= Date.now()` ~1.7e12, and a bad clock (`<0`) can't be produced by an admitted save (the workerCycles `>= 0 && <= lastSavedAt` conjunction rejects it first). |
| Crafted negative `appliedAtMs` inflating a stackable merge | `duration = max(0, effect.expiresAtMs − effect.appliedAtMs)` reads the NEW effect's arg, not the stored record — the stored negative stamp is provenance-only (merge keeps FIRST `appliedAt`, extends `expiresAtMs` from `existing`). No mint. |
| `offlineSinceMs` negative via authority skew | `authorityNowMs − elapsed*1000`: `elapsed = max(0, untilMs − sinceMs)` so the difference re-lands on `sinceMs` (>= 0 honest); a crafted pair only reaches the deep-past class already admitted. |
| `setCombatClockSource` clearing the orphan on re-entry | It runs once at module setup (`App.vue:201`), not per boot — and even when invoked it stops + re-mints the clock only when `wasRunning` (an in-flight frozen clock was 'frozen', not 'running' — `wasRunning` is `!== 'stopped'` so it WOULD re-mint, but the App never calls it again post-setup). No re-entry caller exists. |
| The freeze orphaning a battle-LESS pause | `CombatClock.freeze()` adds a reason only when state `!== 'stopped'` (:93-101) — with no live battle the freeze no-ops and nothing can orphan. The orphan needs a live battle at pause time. |
| Alchemy restore `flatMap` drop vs reservation witness | Dropped jobs never re-settle (no refund mint); shifted jobs re-derive the foldable digest before mutation (r28 seam intact — verified the shift writes a fresh `reservation` witness). |

## Deliverables

- Probe: `src/services/save/auditR32Int.probe.test.ts` — 8 tests, all
  passing, deterministic (`Date.now` mocked via `vi.spyOn`,
  `ManualClockSource` for the combat clock, `@vitest-environment node`,
  `--pool=threads`).
- This report.
- Branch `devin/audit-r32-INT-1d27aee4` carrying only these two files.
