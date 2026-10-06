# Fixpoint audit r30 — INT (integration coherence)

Auditor: r30-INT worker (Devin session). Base: `codex/hoa-cau-fireball-vfx`
@ `33ade943` (the full r29 adjudication). Role: do the r29-corrected layers
still agree with each other at every consumer and seam — entryStage gate vs
other tick/save drivers, return-result early exit vs every caller, verbatim
restores vs write-gate normalization, requireArray/optionalArray `[]`
returns vs every element validator, nodeLevels cap-gate vs other nodeLevels
consumers, setProtected vs EquipmentSystem surfaces,
EQUIPMENT_PROTECTION_CAP vs save gate parity.

Worktree: `.agent-worktrees/audit-r30-int` @ `33ade943`. Read-only on
production code; every claim below carries an EXECUTED deterministic repro
in `src/services/save/auditR30Int.probe.test.ts` (11 tests, all passing —
`npx vitest run <file> --pool=threads`, `@vitest-environment node`,
`Date.now` mocked). Report branch: `devin/audit-r30-INT-33ade943`.

Verification executed:
- `npx vitest run src/services/save/auditR30Int.probe.test.ts --pool=threads`
  — 11/11 green.
- Full read of the r29 surfaces at the audit commit:
  `useAppLifecycle.ts` (:236-246 tick gate, :261-298 pause/resume,
  :313-331 persistProgress gate, :522-560 boot-commit arm, :636-700
  firstSave arm), `App.vue` (:561-620 persistPlayer + refuse arm,
  :199-201 combat clock install, :385-401 abandonFailedCombat),
  `OnlineSessionController.ts` (:226-233 markFailed, :276-306
  observeSaveResult, :373-391 enterTerminal+onPause), `useBootFlow.ts`
  (:97-114 fail() retry loop), `SaveIncompatibleScreen.vue` (:60-133 all
  remedies reload/export), `GamePresentationCoordinator.ts` (:44-50 route
  graph, :390-470 deactivate step), `PhaserSceneAdapter.ts` (:179-199
  deactivate = scene.stop only), `GameManagerTurnBattleOps.ts` (:384-433
  combat clock wiring, :795-860 awaitStep fallback),
  `CombatClock.ts` (:119 getFreezeReasons), `ProductionSystem.ts`
  (:129-180 restoreStates, :478-499 settleOffline),
  `ProductionOffline.ts` (:50-200 settleWorkersOffline),
  `WorkerLaneAdvance.ts` (:146-163 guard), `AlchemySystem.ts` (:376-443
  restoreJobs, :469-480 startJob guard, :628-640 tick guard, :750-764
  settleOffline), `DecomposeSystem.ts` (:148-180 tick),
  `TribulationDirector.ts` (:840-885 restoreRuntime),
  `QuestManager.ts` (:1-30 sole stamp census, :163-168 restore marker),
  `saveShapeValidation.ts` (:438-495 require/optionalArray, :3043-3052
  nodeLevels gate, :3470-3576 cycle pins, :3577-3685 productionSites,
  :3895-4298 equipment entries + protection cap, :4307-4360 slot entries,
  :4485-4550 bindings, :4595-4640 decompose/tribulation pins),
  `EquipmentBag.ts` (:160-200 setProtected sole writer + protectedCount
  union), `EquipmentDissolve.ts` (:59-64/:119-124 flag guards),
  `EquipmentRefine.ts` (:268-271), `EquipmentInstanceSnapshot.ts`
  (:102-103 flag preservation), `GameManagerAlchemyOps.ts` (:169-185
  startJob caller nowMs=Date.now()), `stores/player.ts` (:370-470
  cultivation accrual clamps), `GameManagerSaveRestore.ts` (:349-460
  restoreClockMs/settleNowMs/offlineSinceMs derivations + all callers).

---

## Verdict: PASS WITH EVIDENCE (0 Critical / 0 High / 1 Medium / 0 Low / 1 Nit)

The r29 corrections are internally coherent at every consumer EXCEPT one
driver the entryStage fix never reaches: turn battles advance on the
dedicated CombatClock, not the gated tick interval — under LOCAL authority
a coded autosave refuse mounts the error surface while a live battle keeps
resolving behind it.

| ID | Severity | Class | Surface |
|---|---|---|---|
| R30-INT-1 | Medium | freeze-surface gap / authority-tier asymmetry | `useAppLifecycle.ts:240` gates only `onTick` (autoFarm + tribulation tick + world update). Turn battles advance on `CombatClock` (`RafClockSource` in browser / `MainProcessClockSource` in Electron, installed `App.vue:199-201`), stepped by `advanceCombat` with no entryStage consultation; `awaitStep`'s fallback drives the mechanics with no renderer, so the pipeline resolves headlessly. The only `freezeCombat` producers are `pauseSimulation('authority-pause')` (:286), `useCombatPause('tab-hidden')`, `CombatTopBar('user-pause')`. The coded-refuse arm (`App.vue:589-606`) calls none of them. Remote tier is covered because `observeSaveResult` → `enterTerminal('recovery')` → `deps.onPause('terminal')` → `pauseSimulation` → `freezeCombat` fires before `bootFlow.fail()` while `entryStage` is still 'game'; under LOCAL authority `observeSaveResult` early-returns (`OnlineSessionController.ts:289-292`, no reconnect dep) so no freeze signal exists. Mechanism: local coded refuse (clock-forward skew write, or an imported save that loads-valid but writes-invalid — e.g. parked post-dated stamps) while a StageWave/auto battle is live → error card mounts → battle keeps resolving turns behind it (probe F1: battle reaches 'victory' on clock steps with `getFreezeReasons() === []` throughout; F3: remote cascades `onPause('terminal')`, local never fires). Impact bounded: writes refuse and every SaveIncompatibleScreen remedy reloads, so divergent state is in-memory only and discarded — but the r29 claim "sim freezes behind the mounted error surface" does not hold for the combat channel on the local tier. |
| R30-INT-2 | Nit | reachability note | `pauseSimulation`'s own `entryStage === 'game'` guard (:264) is now load-bearing for the remote freeze ordering: the cascade works only because `observeAuthoritySaveResult` runs before `bootFlow.fail()` in the arm. Reordering those two calls would silently unfire the remote combat freeze (entryStage already 'error' → guard returns). Code-verified correct today; fragile ordering worth pinning. |

---

## Rejected candidates (attacked, mechanism disproven or equivalent)

| Candidate | Rejection |
|---|---|
| Negative-magnitude `lastSavedAt` anchor (`isBoundedTimestamp` is sign-agnostic, `\|x\| < 2^52`) | Admitted (probe R1: wire validates with `lastSavedAt = -1e15`). But every derivation collapses to the deep-past epoch — `restoreClockMs`/`settleNowMs` = min(anchor, now) ≈ anchor — which is the same outcome class as a crafted-PAST marker the gate already admits, strictly weaker: pair-pins vs `lastSavedAt` (workerCycles/alchemyJobs `startedAtMs <= lastSavedAt` :3569/:3799, tribulation `cooldownUntil <= lastSavedAt + 300s` :4624-4637, timed-effect `appliedAtMs`/`expires` bounds :1598/:1674) collapse the admittable payload (probe R2: negative anchor + any `cooldownUntil >= 0` refuses). A mortal-tier save cannot even carry worker lanes (`autoWorkerCapacity: 0` → lane ceiling 0 without chi_hien_quan, :3655). No new grant, no new wedge. |
| `requireArray`/`optionalArray` returning `[]` after the cap issue diverging downstream consumers | `[]` is truthy → `if (productionSites)`/`if (alchemyJobs)` still invoke their validators with zero elements → zero per-element issues, verdict already refused (probe C1: over-cap `alchemyJobs` emits exactly one `.alchemyJobs` cap issue, no `alchemyJobs[i]` paths, and the `maxJobs` check sees length 0). `equipment`/`equipmentSlots` same shape. Normalized output is discarded on refuse — consistent. |
| `nodeLevels` cap-gate leaving sibling walks exposed | All `nodeLevels` key walks live inside `validateSkillCoreCoverage` (:3169/:3236/:3264), bound by the :3050 `Object.keys <= ID_COLLECTION_CAP` gate. `purchasedNodeIds` (:1210-1221) reads `player.nodeLevels[nodeId]` by property access only — never iterates the refused record. Clean. |
| `EQUIPMENT_PROTECTION_CAP` live-vs-gate divergence | Sole-writer claim holds: `instance[flag] = value` at `EquipmentBag.ts:193` is the only locked/favorite write site in production (dissolve/refine read-only guards :59-64/:268-271; snapshot copies existing flags :102-103 — count conserved). Live `protectedCount()` counts `locked \|\| favorite`; the gate counts `locked === true \|\| favorite === true` — identical predicate modulo truthiness edge cases unreachable by writers. Equipped instances stay in `bag.instances` (`setEquippedInternal` flips a flag, no removal) → `getAll()` → `save.equipment` counts them once; `equipmentSlots` entries carry no protection flags → no double count. Union semantics probed (C3): 10 protected + 11th refuses; double-flagging an already-protected item stays free; clearing one flag of a double-flagged item keeps the pool full. Probed C2: 11 protected entries refuse with the cap issue. Honest pre-r29 saves cannot exceed 10 (no writer existed) → load-side refuse unreachable for honest saves. |
| Verbatim-restore arms diverging from write-gate normalization | Every real caller feeds `restoreClockMs = min(lastSavedAt, Date.now())` — finite and `\|x\| < 2^52 < 2^53`, so `clockOk` is always true in production and the bad-clock verbatim arm is a dead guard for ungated callers only. Probed E1 (finite anchor shifts a post-dated lane pair to the restore clock, span preserved) and E2 (NaN anchor restores verbatim → parked, deny direction). Alchemy/quest/tribulation/decompose arms identical doctrine. |
| `persistPlayer` `return result` early-exit vs callers | Sole caller `persistProgress` ignores the return (:325); the early return only skips the `autosaveFailed` toast/latch — the claimed noise reduction is exact (the toast would be unobservable behind the mounted card anyway). Sibling save paths verified: boot-commit (:527) and firstSave (:643) arms carry their own coded-refuse escalation (`'remote'` scope); quit/install flushes and `flushSave` are teardown/manual paths where a transient result is correct — any data-class refuse re-fires on the next autosave and mounts the same arm within one cycle. No coherence gap. |
| `DATA_REFUSE_CODES` set contents drift | Unchanged `{SAVE_INVALID, SAVE_TOO_LARGE}` — docblock-only edit confirmed via `git diff 33ade943^ 33ade943`. |
| `bootFlow.fail()` 10-attempt retry starvation | Covers 'rejected'/'failed' transition results through in-flight conflicts; the only reachable dead-end is a disposed coordinator (app tearing down). Breadcrumb logged. Accepted residual. |
| `DecomposeSystem.tick` guard ordering (clock check before `workers <= 0` arm) | Under a hostile clock the guard denies before the `started = false` reset — a stale `started: true` survives one extra call but the `workers <= 0` arm re-runs first on the next honest tick and clears it before any settle/payout. No mint. |
| `hiddenChannelCycles` verbatim restore | `Record<string, number>` per-channel counters (:174-176, type :87) — cycle counts, not ms stamps; no clock semantics. Correct verbatim copy. |
| Adjacent ms-stamps inside restored slices | Census: `quests` slice has exactly one ms stamp (`lastDailyResetAtMs`); `tribulation` slice has exactly one (`cooldownUntil`; committedOutcome carries no clock fields); `workerCycles`/`alchemyJobs` carry only the `startedAtMs`/`completesAtMs` pairs the restore arm already covers. No sibling stamp escapes the doctrine. |
| `AlchemySystem.settleOffline`/`ProductionSystem.settleOffline` bypassing the new guards | Alchemy's delegates to the guarded `tick` (:759); Production's delegates to `settleWorkersOffline` → per-lane `advanceWorkerLanes` which carries the guard (:150-163); the wrapper's `fieldEpochShiftMs = max(0, Date.now() - nowMs)` under `nowMs = -Infinity` shifts seeded heads to +Infinity (parked, deny), under NaN/±2^53 is inert. Inherited parity holds. |
| `GameManagerAlchemyOps` startJob feeding a bad `nowMs` | Sole production caller passes `Date.now()` (:182). The new guard is a crafted-caller defense — consistent placement before all cost/burn. |
| `useCombatPause` 'tab-hidden' / `CombatTopBar` 'user-pause' freeze reasons vs refuse arm | Orthogonal user/visibility paths, correctly scoped; unrelated to the refuse surface. |

## Deliverables

- Probe: `src/services/save/auditR30Int.probe.test.ts` — 11 tests, all
  passing, deterministic (`Date.now` mocked via `vi.spyOn`,
  `@vitest-environment node`, `--pool=threads`).
- This report.
- Branch `devin/audit-r30-INT-33ade943` carrying only these two files.
