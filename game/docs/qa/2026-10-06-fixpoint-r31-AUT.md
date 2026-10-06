# Fixpoint audit r31 — AUT (adversarial exploit)

Auditor: r31-AUT worker (Devin session). Base: `codex/hoa-cau-fireball-vfx`
@ `e90f46a2` (the full r30 adjudication). Role: assume every r30 fix is
exploitable — mint/wedge/self-brick paths through the new domain guards
(boundary 2^52 vs internal dues up to nowMs+cycleMs, the `!(...)` NaN-
complement form, verbatim arms), the flag-typing checks, the refuse-arm
pause call; then siblings of each class.

In-place audit on the audit commit (test+doc writes only — P1/P2
read-only on production code). Every claim below carries an EXECUTED
deterministic repro in `src/services/save/auditR31Aut.probe.test.ts`
(10 tests, all passing — `npx vitest run <file> --pool=threads`,
`@vitest-environment node`, `Date.now` mocked where the save clock
matters). Report branch: `devin/audit-r31-AUT-e90f46a2`.

Verification executed:
- `npx vitest run src/services/save/auditR31Aut.probe.test.ts --pool=threads`
  — 10/10 green.
- Full read of the r30 surfaces at the audit commit:
  `WorkerLaneAdvance.ts` (:120-330 — guard set :146-171 incl. the
  `!(nowMs + Math.max(0, cycleMs) < 2**52)` headroom, lane seed
  `emptyLaneStartMs + cycleMs`, `pending[]` `Math.abs` bounds, budget
  forfeit arm), `ProductionSystem.ts` (:129-182 restoreStates shift arm,
  :387-463 tickWorkers, :481-504 settleOffline delegation),
  `ProductionOffline.ts` (:120-190 settleWorkersOffline,
  `emptyLaneStartMs: offlineSinceMs` unguarded pass-through,
  fieldEpochShiftMs re-stamp), `DecomposeSystem.ts` (:151-203 tick
  `nowMs + cycleMs` mints, :242-291 restore clockOk/`min()` merge,
  :303-366 settleOffline incl. NEW `offlineSinceMs` guard :322),
  `AlchemySystem.ts` (:366-438 restoreJobs shift+foldable arms,
  :460-609 startJob `nowMs + duration` mint :563, :619-756 tick
  settle-only arms, :759-772 settleOffline delegating to tick),
  `GameManagerSaveRestore.ts` (:340-559 — restoreClockMs :363-366,
  settleNowMs :445-449, offlineSinceMs :471-475 — all min-clamped at
  Date.now()), `TribulationDirector.ts` (:843-894 restoreRuntime
  `min()` clamp), `QuestManager.restore` (:144-170 `min()` clamp),
  `GameManagerPersistentEffectOps.ts` (:307-377 stackable/non-stackable
  clamps), `saveTypes.ts` (:273-325 sanitizeRestoreAuthority |x| bound),
  `saveShapeValidation.ts` (:421-426 bound helpers, :2430 lastSavedAt
  SYMMETRIC |x| bound, :3484-3584 cycle span+ordering pins,
  :3705-3845 alchemy job admission, :3940-4015 equipment cap counters +
  locked/favorite optional-boolean, :4326-4417 slot entries,
  :4590-4630 decompose slice, :4638-4663 tribulation cooldownUntil),
  `App.vue` (:592-618 coded-refuse arm ordering, :702-733
  onPause/onResume arms, :1125-1154 mount refuse), `useAppLifecycle.ts`
  (:238-243 tick gate, :261-318 pause/resume/persist guards),
  `OnlineSessionController.ts` (:226-303 markFailed/enterTerminal/
  observeSaveResult pause cascade, :470-565 reconnect/onResume ordering),
  `GameManagerTurnBattleOps.ts` (:270-460 CombatClock freeze wiring,
  :805-912 pendingStepTimers/awaitStep), `CombatClock.ts` (freeze
  reason-set), `BackendStatus.ts` (:41 DATA_REFUSE_CODES = SAVE_INVALID,
  SAVE_TOO_LARGE), `BuildingSystem.ts` (:322-457 elapsed cap at
  PRODUCTION_OFFLINE_CAP_SECONDS), `GameClock.ts`/`OfflineProgressSystem`
  (elapsed clamps), `GameManagerAutoFarmOps.ts` (:214-310 re-anchor).

---

## Verdict: PASS WITH EVIDENCE (0 Critical / 0 High / 0 Medium / 2 Low / 1 Nit)

The r30 batch holds against every production-reachable attack: all
restore clocks are min-clamped at `Date.now()`, the verbatim arms park
crafted stamps in the deny direction, the flag-typing refuses truthy
non-booleans, and the refuse-arm pause ordering covers the combat
channel on both local and remote paths. The two findings below are the
residual +span-mint class: clock ARGUMENTS are bounded to `[0, 2^52)`
but minted dues are `clock + span`, and only ONE mint point
(WorkerLaneAdvance's `nowMs`) received the companion headroom.

| ID | Severity | Class | Surface |
|---|---|---|---|
| R31-AUT-1 | Low | incomplete guard / wedge | The r30 batch enforced the persisted clock domain on the clock ARGUMENTS (`!Number.isFinite(x) \|\| x < 0 \|\| x >= 2**52`) but the minted stamps are `clock + span` — an admitted clock within a span of the bound mints persisted dues `>= 2^52` that self-refuse the next save write (isBoundedTimestamp -> coded `SAVE_INVALID` -> the r30 corrupted+terminal arm). Only `advanceWorkerLanes`'s `nowMs` input got the companion headroom `!(nowMs + Math.max(0, cycleMs) < 2**52)` (:157); every sibling `+span` mint point still stamps over-bound: (a) THE SAME FUNCTION's `emptyLaneStartMs` seed input — `|x| < 2^52` only (:162-166), seeds mint `dueMs = emptyLaneStartMs + cycleMs` (:~290) and persist `startedAtMs/completesAtMs` via buildProductionCycle (`startMs + span`, ProductionCycles.ts:37-38). PROBED: `advanceWorkerLanes({nowMs: currentMs, emptyLaneStartMs: 2**52 - 1, cycleMs: 30000, mode: 'deadline'})` -> `pending[0].startedAtMs === 2^52-1` (writable) and `pending[0].completesAtMs === 2^52 - 1 + 30000 >= 2^52` (refuses); control `nowMs = 2^52-1` same params -> zero-advance (the headroom does fire — on the wrong-input sibling). (b) `AlchemySystem.restoreJobs` shift arm: `shifted.completesAtMs = completesAtMs - shiftMs` = `restoreNow + span` (:398-400). PROBED: `restoreJobs([jobAt(2^52-1+span)], 2^52-1)` -> `getJobs()[0].completesAtMs >= 2^52`. (c) `ProductionSystem.restoreStates` shift arm — identical `restoreNow + span` arithmetic (:167-173, code-verified). (d) `AlchemySystem.startJob` — `completesAtMs = nowMs + alchemySecondsFor(recipe, roomLevel) * 1000` (:563, no headroom; code-verified). (e) `DecomposeSystem.tick` `nextCycleAt = nowMs + cycleMs` (:178/:188/:200) and `settleOffline`'s fast-forward/settle-loop `nextCycleAt +=` mints (:352, :362). PROBED: restored `{started:true, workers:1, nextCycleAt:0}` + `tick(2^52-1)` -> `getSaveState().nextCycleAt >= 2^52`; control `tick(2^52)` -> parked at 0. End-to-end: crafted saves carrying each minted over-bound stamp (workerCycles completesAtMs, alchemyJobs completesAtMs, decompose.nextCycleAt) all refuse at `validateGameSaveShape` (paths `productionSites[0].workerCycles[0]` / `alchemyJobs[0]` generic-entry refuse / `.decompose.nextCycleAt`). Reachability: ungated-caller only — every production clock input is min-clamped at `Date.now()` (restoreClockMs/settleNowMs/offlineSinceMs chains, GameManagerSaveRestore.ts:363-475; tickWorkers/startJob pass `Date.now()` directly), so the window `(2^52 - span, 2^52)` is unreachable today. Deny direction and self-heals on next honest restore. Same reachability profile the project adjudicated at Low for r30-AUT-F3b (admitted `[2^52, 2^53)` clocks minting out-of-domain stamps) — this is the narrower `+span` residue of the same hole the r30 fix narrowed. |
| R31-AUT-2 | Low | parity inconsistency / bounded mint | Asymmetric stamp domain: `advanceWorkerLanes` keeps the symmetric `Math.abs(x) >= 2**52` bound on `emptyLaneStartMs` (:164-166) and `pending[].startedAtMs/completesAtMs` (:167-168) while the r30 sibling fix on `DecomposeSystem.settleOffline` now denies the same window negative (`offlineSinceMs < 0 -> return 0`, :322). Crafted negative `player.lastSavedAt` IS admitted — the write bound `isBoundedTimestamp` is symmetric `|x| < 2^52` (saveShapeValidation.ts:2430, message itself says `|x|`), and the startedAt <= lastSavedAt pin can be satisfied by deeper-negative cycle stamps. Chain: `lastSavedAt = -4.4e15` -> `restoreClockMs = min(-4.4e15, authNow, Date.now()) = -4.4e15` -> all `clockOk` fail -> verbatim restore (deny); but `offlineSinceMs = min(lastSavedAt, authNow - elapsed*1000, Date.now()) = -4.4e15` -> `settleWorkersOffline` passes it as `emptyLaneStartMs` (ProductionOffline.ts:166) -> `|x| < 2^52` admitted -> seeds lanes deep-past -> deadline-mode settle pays up to budgetMs cap (bounded mint), while `decompose.settleOffline(settleNowMs, -4.4e15)` zero-settles for the identical crafted input. PROBED: `advanceWorkerLanes({emptyLaneStartMs: -(2^52-1), mode: 'deadline', budgetMs: 86.4e6})` -> `completed.length > 0`, `consumedBudgetMs <= budget`; and a negative pending pair `(startedAt=-(2^52-1), completesAt=-(2^52-1)+30000)` is admitted and completes once. Bounded output + the deep-past class is an adjudicated accepted residual — the NEW bit is only the parity break the r30 decompose guard introduced against the worker-lane sibling. |
| R31-AUT-3 | Nit | doctrine note | `DecomposeSystem.settleOffline`'s confiscation fast-forward `Math.floor(offlineSinceMs)` (:334) and `windowStartMs = max(nextCycleAt - cycleMs, ...)` are NaN-consistent under the new guard — verified held. The `min()` clamps (`decompose.restore` :286, `TribulationDirector.restoreRuntime` :872, `QuestManager.restore` :167) can NEVER exceed 2^52: the verbatim input is itself admission-bounded (`isNonNegativeBoundedTimestamp`), and `min(bounded, restoreNow + span) <= bounded` — rejected candidate, recorded for completeness. |

## Attack log — rejected candidates (verified held)

- **`!(...)` NaN-complement headroom form**: `!(nowMs + Math.max(0, cycleMs)
  < 2**52)` — `Math.max(0, NaN)` = NaN -> `nowMs + NaN < 2^52` is false ->
  `!false` = refuse. NaN in ANY operand denies. Correct form. Same shape on
  every r30 clock guard (`x < 0 || x >= 2**52`): NaN fails `isFinite` first.
- **verbatim arms**: restoreJobs/restoreStates/decompose.restore/
  tribulation/quest `clockOk` fails -> verbatim restore -> crafted
  post-dated/future stamps stay parked (deny). Probed re-assertion:
  `restoreJobs` under `restoreNowMs in {-1, 2^52, +Inf, NaN}` preserves the
  job's original stamps exactly.
- **foldable gate** (`restoreJobs` :409-424): `resSpecials.every(isObject)`
  gates digest re-derivation; non-foldable reservations keep the verbatim
  shifted job — no throw path. The settle-side witness
  (`verifyAlchemyJobReservation`) makes a fabricated job settle as failure.
- **refuse-arm pause ordering** (App.vue :612-614):
  `pauseSimulation()` -> `saveIssue.report` -> `bootFlow.fail()` runs while
  `entryStage === 'game'` on the coded-refuse arm; `pauseSimulation` clears
  the tick interval, stops GameClock, and `freezeCombat('authority-pause')`
  freezes CombatClock — the only out-of-gate accrual channel
  (GameManagerTurnBattleOps.ts:410-416 -> CombatClock.freeze). Remote
  arm covered identically via `markFailed` -> `enterTerminal` ->
  `onPause('terminal')` -> `pauseSimulation` while entryStage is still
  'game' (OnlineSessionController.ts:373-388, App.vue :729-733 — markFailed
  precedes report+fail). `observeSaveResult` early-returns in local-only
  mode (:287-290) so the explicit pauseSimulation call is the coverage.
  Boot refuse arms run pre-'game' — pause correctly no-ops (self-guard
  :265). `pendingStepTimers` animation fallbacks resolve at most one
  in-flight step post-freeze — bounded, intended per :843 comment.
- **flag-typing**: `locked`/`favorite` optional-boolean refuse truthy
  non-booleans (probed: `locked:'yes'` -> refuse at `equipment[0].locked`;
  `favorite:'yes'` -> refuse at `equipment[0].favorite`). Sibling truthy-
  read fields all typed: `equipped`/`decompose.started`/
  `committedOutcome.settlementError`/`receipt.talentConverted`/
  `receipt.questRealmTransitionMarked`/`autoRestart`/`hasSeenTutorial`
  required-boolean; `autoFarmStage` object-shaped; `equipmentSlots` entries
  carry only {slot, enhanceLevel, enhanceFailStreak} — no flag surface.
- **decompose `started` truthy restore** (`this.started = this.started ||
  Boolean(source.started)` :290): `started` is required-boolean at
  admission (:4622) — unreachable via save; the `||` merge is the documented
  restore-merge contract (don't rewind live state). Not exploitable.
- **`startedAtMs > restoreNowMs` shift predicate**: requires a post-dated
  stamp under a clockOk-passing (non-negative, <2^52) restoreNow — the
  `lastSavedAt >= startedAt` admission pin bounds it to crafted payloads
  with crafted-positive lastSavedAt, which routes through the same
  over-bound wedge chain (deny). Shifted pairs preserve the exact span.
- **settleAutoFarmOffline / BuildingSystem / cultivation offline**: elapsed
  inputs re-anchored (`lastCheckedMs` clamp :270-276) and accrual
  ceiling-capped (`min(elapsed, PRODUCTION_OFFLINE_CAP_SECONDS)` :329-331;
  `calculateOfflineTime` `maxOfflineSeconds` 24h); `claim`'s fractional-
  rewind `currentTime - fraction/rate` is bounded by `stored - amount < 1`.
- **cap-walk siblings** (r30-COR ancestry): `selectedTalentIds`,
  `persistentTimedEffects` element walks now cap-gated; legacy equipment
  entries (`realmId`/`rarity` markers) discarded BEFORE the
  unprotected/protected counters (:3921-3947) — a legacy entry can no
  longer inflate either counter; the walk itself is bounded by the
  upstream `requireArray` refuse (internal throws convert to refused
  verdict at :5120).

## Pre-existing residuals re-pinned (not findings)

Verbatim-parked stamps self-harm their own channel; `+0`/`-0` stamps mint
tiny-past; `Math.min(..., NaN)` in the stackable writer unreachable;
±1-2ms float boundary; `saveIssue.report` multi-write idempotent; 'local'
scope on both refuse paths; negative `lastSavedAt` collapses to deep-past
class (R31-AUT-2's bounded mint is the same class at one remove).
