# Fixpoint audit r31 — INT (integration coherence)

Auditor: r31-INT worker (Devin session). Base: `codex/hoa-cau-fireball-vfx`
@ `e90f46a2` (the full r30 adjudication). Role: do the r30-corrected layers
still agree with each other at every consumer and seam — the tightened
persisted-clock domain `[0, 2^52)` vs every real caller feed
(`restoreClockMs`/`settleNowMs`/`offlineSinceMs`/`Date.now` derivations),
`pauseSimulation`-in-refuse-arm vs its `entryStage` guard and every recovery
exit, `locked`/`favorite` optional-boolean typing vs the `setProtected`
union pool and every flag consumer, and every new deny-return vs its
caller's handling.

Worktree: `.agent-worktrees/audit-r31-int` @ `e90f46a2`. Read-only on
production code; every claim below carries an EXECUTED deterministic repro
in `src/services/save/auditR31Int.probe.test.ts` (9 tests, all passing —
`npx vitest run <file> --pool=threads`, `@vitest-environment node`,
`Date.now` mocked). Report branch: `devin/audit-r31-INT-e90f46a2`.

Verification executed:
- `npx vitest run src/services/save/auditR31Int.probe.test.ts --pool=threads`
  — 9/9 green.
- Full read of the r30 surfaces at the audit commit:
  `useAppLifecycle.ts` (:160-176 flag declaration, :228-246
  startTickLoop/onTick gate, :249-260 startAutosave, :261-298
  pauseSimulation/resumeSimulation, :313-331 persistProgress gate,
  :335-733 bootGame incl. :350 beginChecking, :444-558 'ok' path,
  :522-575 remote commit refuse arm, :636-708 firstSave arm, :710-729
  markReady/clock/tick/enterGame tail, :768-824 stopAll/return surface),
  `App.vue` (:561-635 persistPlayer + coded-refuse arm, :692-737
  onPause/onResume wiring, :757-766 updateSurface, :804-809
  acknowledgeAuthority, :816-822 teardownToAuth),
  `OnlineSessionController.ts` (acknowledge/markFailed/observeSaveResult/
  enterTerminal chain), `useUpdates.ts` (:136-212 pause/resume admission
  pairing), `GameManagerSaveRestore.ts` (:349-560 restoreClockMs /
  settleNowMs / offlineSinceMs derivations + every settle caller),
  `saveTypes.ts` (:273-325 restoreAuthorityNowMs/sanitizeRestoreAuthority),
  `WorkerLaneAdvance.ts` (:120-179 guard + deny shape, :219-312 settle
  loop + O(1) jump arm), `ProductionSystem.ts` (:129-182 restoreStates,
  tickWorkers/settleOffline callers), `DecomposeSystem.ts` (:81-160,
  :242-330 restore/settleOffline guards), `QuestManager.ts` (:160-190
  verbatim arm), `AlchemySystem.ts` (:382-443 verbatim arm),
  `TribulationDirector.ts` (:843-894 restoreRuntime),
  `GameManagerPersistentEffectOps.ts` (:300-335 both clamp arms),
  `saveShapeValidation.ts` (:3904-4318 equipment entries incl. :3930-3933
  legacy-discard-before-counters and :4005-4015 typing gate; every
  `selectedTalentIds`/`persistentTimedEffects` walk),
  `EquipmentBag.ts` (:70-200 dissolve filter + setProtected +
  protectedCount).

---

## Verdict: FAIL (0 Critical / 0 High / 1 Medium / 1 Low / 2 Nit)

The r30 corrections hold at every consumer seam I attacked, EXCEPT the
flag the new refuse-arm freeze stands on: `pauseSimulation`'s own
`simPaused` latch survives the terminal → acknowledge → re-auth → re-enter
chain and silently disarms every later pause — including the very freeze
r30-INT-1 added.

| ID | Severity | Class | Surface |
|---|---|---|---|
| R31-INT-1 | Medium | flag-lifecycle gap re-arms the r30-INT-1 defect | `useAppLifecycle.ts` — `simPaused` (declared :168) is latched by `pauseSimulation()` and cleared ONLY by `resumeSimulation()` (:286-296). The recovery chain `acknowledgeAuthority()` (`App.vue:806-809` = `onlineAuthority.acknowledge()` + `bootFlow.showAuth()`) → sign-in → `bootGame` never touches the flag, and `bootGame`'s tail (:710-729: `markReady` → `clock.start()` → `startTickLoop(tick)` → `enterGame`) plus `App.vue:1050` `startAutosave()` re-arm a fully live sim *with the flag still set*. Probe S1: pause latches the flag + freezes combat; `showAuth()` + second `bootGame` → `'entered'` with `isSimPaused() === true` while tick+autosave intervals run; the next `pauseSimulation()` early-returns — `freezeCombat` call count stays 1, `getTickHandle()`/`getAutosaveHandle()` stay defined. Consequences (all remote-tier reachable — local has no acknowledge/reauth machinery, and the update-admission latch exits via resumeAdmission-on-fail or process relaunch): (a) a heartbeat-failed/reconnecting pause no-ops → `CombatClock` keeps resolving behind the veil (the freeze `onPause` exists to provide never fires); (b) a coded write refuse → the r30 refuse arm's `pauseSimulation()` no-ops → combat stays live behind the terminal card — the exact r30-INT-1 mechanism, now defeated through flag state the fix does not own; (c) `resumeSimulation` never fires on terminal/refuse paths, so the disarm persists for the re-entered session. Fix direction: `acknowledge()`/`showAuth` should drop the flag (or `bootGame` should re-baseline it) — a flag that outlives the mount that produced it is stale by construction. |
| R31-INT-2 | Low | sibling window-input asymmetry | `WorkerLaneAdvance.ts:160-162` admits `emptyLaneStartMs` as `\|x\| < 2^52` (negative finite still legal) while the r30-hardened `DecomposeSystem.settleOffline` (`:303-311`) requires `offlineSinceMs ∈ [0, 2^52)`. Both are fed the same value — `offlineSinceMs = min(lastSavedAt, authorityNowMs − elapsed·1000, Date.now())` (`GameManagerSaveRestore.ts:471-475`) — which goes negative on a validator-admitted `lastSavedAt < 0`. Probed W1: `advanceWorkerLanes(emptyLaneStartMs: -1e12)` mints exactly the 10-cycle budget (consumedBudgetMs = 10h, O(1) jump forfeits the tail) while `decompose.settleOffline(now, -1e12)` returns 0 with `nextCycleAt` parked. The decompose guard's own comment claims "parity with the workerLane window guards" — false on the negative arm. Probed control keeps this Low, not Medium: `emptyLaneStartMs = 0` mints the identical 10 cycles AND `settleOffline(now, 0)` pays the backlog on both channels — the negative arm grants nothing beyond the admitted deep-past class; the defect is coherence, not ceiling. |
| R31-INT-3 | Nit | domain inconsistency | `sanitizeRestoreAuthority` (`saveTypes.ts:322`) still admits `\|stamp\| < 2^52` sign-agnostic — a negative `untilMs`/`nowMs`/`sinceMs` passes the sanitizer and dies three hops later inside each consumer's `[0, 2^52)` guard (same deny outcome, more path). Not a behavior gap today — consumers deny correctly — but the sanitizer's domain no longer matches the unified seam domain it feeds. |
| R31-INT-4 | Nit | sibling-of-fix clamp gap | `GameManagerPersistentEffectOps.applyTimedEffect` clamps `expiresAtMs` on all three arms (stackable :322-330, non-stackable writer, push) but the pushed copy still carries `appliedAtMs` verbatim — a caller-crafted out-of-domain `appliedAtMs` persists and self-refuses the next `buildGameSave` write (same wedge class the expiresAtMs clamp closed). Doctrine only obligates arithmetic-extension writers, and no honest caller produces it — ungated-caller threat model. |

---

## Confirmed-coherent surfaces (attacked, no finding)

| Surface | Verification |
|---|---|
| r30 refuse-arm ordering | `pauseSimulation()` precedes `bootFlow.fail()` inside the arm while `entryStage === 'game'` — probed S3 (source-order pin) and verified `:566` `observeAuthoritySaveResult` runs before the arm, so under remote the cascade pause already latched and the arm's call is a correct idempotent no-op. |
| `pauseSimulation` producers census | Exactly four callers: `onlineAuthority.onPause` (App.vue:702), the refuse arm (:612), `updateSurface` pauseAdmission (:761), and (resume side) onResume (:736). All four ride the same flag — the S1 defect hits all of them uniformly, no producer-specific divergence. |
| `useUpdates` admission pairing | `pauseAdmission` at flush start (:146), `resumeAdmission` fires on `onUpdateInstallFailed` (:197); install success relaunches the process — flag cannot strand in-process. Paired. |
| `onResume` rejected-restore arm skipping `resumeSimulation` | Correct: a `resumed` outcome only exists after a pause latched the flag — the sim is already frozen when `fail()` mounts the error card (:722-733). No second freeze needed. |
| `stopAll` not clearing `simPaused` | `stopped = true` dominates every subsequent call (`pauseSimulation`/`resumeSimulation`/`bootGame`/`persistProgress` all early-return) — the stale flag is inert under teardown. |
| Deny-return handling at `tickWorkers`/`settleOffline` | `advanceWorkerLanes` deny returns `{completed: [], pending: [...params.pending], forfeited: 0, consumedBudgetMs: 0, seededPending: []}` — `state.workerCycles = result.pending` preserves the saved lanes verbatim, zero completions reach `grantCycleRewards`, `snapshotNextDues` re-snapshots the unchanged heads. Caller-side handling coherent. |
| Tightened restore domain vs the real driver | `restoreClockMs = min(lastSavedAt, Date.now())` stays finite and, for validator-admitted negatives, lands in the verbatim arm at every seam — post-dated stamps park (deny) instead of re-anchoring deep-past (the pre-r30 mint). Probed V1/V1b: crafted `cooldownUntil = 1e15` under `-1e12` parks verbatim (deny) where the old `\|x\| < 2^53` domain would have clamped it deep-past into a free retry. Deny-lean direction confirmed at alchemy/production/quest/tribulation/decompose arms. |
| `settleNowMs`/`offlineSinceMs` feeds | `settleNowMs` negative (crafted-negative authority `untilMs` admitted by R31-INT-3's Nit) → `nowMs < 0` deny fires identically on both settle channels — symmetric. The only asymmetry is the `emptyLaneStartMs` window input (R31-INT-2). |
| Headroom guard | `!(nowMs + max(0, cycleMs) < 2^52)` denies exactly at the minted-due boundary — probed W2: `nowMs = 2^52 − cycleMs − 1` admits and parks a seeded head at `2^52 − 1` (inside the persisted domain); `nowMs = 2^52 − cycleMs` denies outright (zero-advance shape). NaN `cycleMs` → `max(0, NaN)` → deny. Correct. |
| `locked`/`favorite` typing vs consumers | Probed T1: `'yes'`/`1`/`0`/`null` all refuse; explicit `false` and absent admit and read unprotected to every consumer (`=== true` counters, truthy dissolve filter, `setProtected` union, `protectedCount`). Legacy-marker discard (:3930) precedes both cap counters — verified source order. |
| `selectedTalentIds`/`persistentTimedEffects` cap-gates | The only raw `player.selectedTalentIds` read (:3159) and the only raw `player.persistentTimedEffects` walk (:887-912) are both `length <= ID_COLLECTION_CAP`-bound; every other consumer reads the `requireArray`-bound `[]` after the cap issue lands. No ungated walk remains. |
| `budgetMs` sign | `hasBudget` + `Math.max(0, budgetMs)` → a negative budget collapses to 0 → every completion forfeits via the O(1) jump arm — deny-lean, no mint. |
| Boot-phase refuse arms | `bootGame`'s commit arm (:696 `'remote'`) and firstSave arm omit `pauseSimulation` correctly — the clock/tick loop only starts at :714/:726, nothing exists to freeze. Stage is never 'game' at those points anyway (guard would no-op). |

## Rejected candidates (attacked, mechanism disproven or equivalent)

| Candidate | Rejection |
|---|---|
| Negative `offlineSinceMs` granting a *new* mint ceiling vs the deep-past class | Probed W1 control: `emptyLaneStartMs = 0` mints the identical 10-cycle budget through production AND `settleOffline(now, 0)` pays the decompose backlog — the negative arm buys nothing the admitted 0-seed does not already buy (the same admissibility argument r30-INT's R1 made for `lastSavedAt`). Reported as the Low asymmetry, not a mint escalation. |
| Verbatim arm under negative `restoreClockMs` changing honest outcomes | A pre-dated (≤ anchor) pair restores verbatim identically under old and new domains — r30-INT's R1 pin still holds byte-for-byte; only the post-dated arm changed (shift → park), and post-dating a negative anchor is impossible-authored → park is the deny-correct outcome. |
| `resumeSimulation` re-entering 'game' but clearing intervals late | Verified order: flag cleared first, intervals re-armed, `freezeReasons` cleared, `resumeCombat('authority-pause')` fires, `clock.start()` re-anchors — a queued stale `clearHandle` cannot reach the NEW handles (cleared by value at pause time). |
| `DecomposeSystem.restore` verbatim arm under negative clock minting via `Math.max(0, restoredDeadline)` | A negative `restoredDeadline` clamps to `0` → deep-past deadline — identical to the already-admitted `nextCycleAt = 1` crafted-past class; same settle, no new leg. |
| Refuse arm racing a mid-flight route transition | `pauseSimulation` requires `entryStage === 'game'`; the arm runs synchronously inside `persistPlayer`'s resolution — under any stage ≠ 'game' the sim is not running (tick gate + enterGame ordering), so a no-op pause loses nothing. |
| `DATA_REFUSE_CODES` scope `'local'` under remote refuse | Prior-wave ruling verified still correct: the remote row holds the last-good write, so 'local' accurately labels the recovery surface on both tiers; the remote cascade's own terminal path (recovery overlay) runs in parallel, not in conflict. |
| `appliedAtMs`/`expiresAtMs` NaN in the stackable arm | `Math.max(0, NaN)` → NaN → `expiresAtMs = NaN` persists → self-refusing write — pinned prior wave as unreachable for honest callers (writer always stamps `Date.now()`/`duration > 0` inputs); unchanged by r30. |

## Deliverables

- Probe: `src/services/save/auditR31Int.probe.test.ts` — 9 tests, all
  passing, deterministic (`Date.now` mocked via `vi.spyOn`,
  `@vitest-environment node`, `--pool=threads`).
- This report.
- Branch `devin/audit-r31-INT-e90f46a2` carrying only these two files.
