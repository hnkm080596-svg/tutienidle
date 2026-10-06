# Fixpoint audit r30 — AUT (adversarial exploit)

Auditor: r30-AUT worker (Devin session). Base: `codex/hoa-cau-fireball-vfx`
@ `33ade943` (the full r29 adjudication). Role: assume every r29 fix is
exploitable — mint/wedge/self-brick paths through the new `clockOk` guards
(boundary at exactly `2**53` vs persisted `2**52`, `+0` vs `-0`,
`-Infinity` verbatim restores leaving digest state), the `startJob`
origination gate, the `entryStage` tick gate (paused/resume arms, other
stage values), `setProtected` pool counting (union semantics, equipped
items, bypassed payload restores), the refuse-arm early return skipping
the latch; then siblings of each class.

In-place audit on the audit commit (test+doc writes only — P1/P2
read-only on production code). Every claim below carries an EXECUTED
deterministic repro in `src/services/save/auditR30Aut.probe.test.ts`
(22 tests, all passing — `npx vitest run <file> --pool=threads`,
`@vitest-environment node`, `Date.now` mocked where the save clock
matters). Report branch: `devin/audit-r30-AUT-33ade943`.

Verification executed:
- `npx vitest run src/services/save/auditR30Aut.probe.test.ts --pool=threads`
  — 22/22 green.
- Full read of the r29 surfaces at the audit commit:
  `AlchemySystem.ts` (:377-426 restoreJobs clockOk/shift/foldable,
  :469-475 startJob invalid_clock origination gate, :619+ tick guard),
  `ProductionSystem.restoreStates` (:129-171 same clockOk shape),
  `DecomposeSystem.ts` (:158 tick zero-advance, :279-286 restore
  clockOk/verbatim merge, :298-352 settleOffline),
  `QuestManager.restore` (:144-170 lastDailyResetAtMs clamp/verbatim),
  `TribulationDirector.restoreRuntime` (:~870 verbatim cooldownUntil),
  `useAppLifecycle.ts` (:238-243 entryStage+canMutate tick gate,
  :265/:290/:318 pause/resume/persist gates),
  `App.vue` (:578-608 coded-refuse arm + `return result`, tick clock),
  `SaveIncompatibleScreen.vue` (every recovery exit = reload),
  `useBootFlow.ts` (:36-70 entryStage promote-only derivation),
  `GamePresentationCoordinator.ts` (:540-575 error/pin lifecycle),
  `saveShapeValidation.ts` (:415-427 isBoundedTimestamp,
  :3895-4299 validateEquipmentEntries, :5062-5105 ok contract),
  `EquipmentBag.ts` (:14 soft cap, :23 EQUIPMENT_PROTECTION_CAP,
  :38-115 add/autoDissolveOverflow, :162-205 setProtected union pool),
  `EquipmentDissolve.ts` (:28-88 truthy flag guards),
  `GameManagerAutoFarmOps.ts` (:214-310 settleAutoFarmOffline NaN guard,
  tick re-anchor), `WorkerLaneAdvance.ts` (:146-160 full guard set),
  `GameManagerSaveRestore.ts` (:363-475 clock provenance,
  equipment re-feed loop), `saveTypes.ts` (:298
  sanitizeRestoreAuthority), `SupabaseCloudSaveService.ts` (:968-989
  REJECTED envelope), `BackendStatus.ts` DATA_REFUSE_CODES.

---

## Verdict: FAIL (0 Critical / 0 High / 2 Medium / 1 Low / 1 Nit)

The r29 batch holds under most direct attack — the verbatim arms park
crafted stamps in the deny direction, the refuse arm's early return skips
only the cosmetic latch, and the protection-cap union pool counts
correctly. Two Medium findings: (1) `DecomposeSystem.settleOffline`
guards `nowMs` but leaves its sibling input `offlineSinceMs` unguarded —
`NaN` skips the confiscation arm and pays the entire backlog to the
5000-cycle bound, on the exact signature r29 just patched; (2) the
equipment validator type-checks `equipped` but never `locked`/`favorite`,
so a crafted `locked:'yes'` passes cleanly and produces permanently
un-removable items — a self-brick of the whole equipment channel.

| ID | Severity | Class | Surface |
|---|---|---|---|
| R30-AUT-1 | Medium | incomplete guard / mint | `DecomposeSystem.settleOffline` (DecomposeSystem.ts:298-352). The r29 guard covers `nowMs` (:307 `!Number.isFinite(nowMs) \|\| Math.abs(nowMs) >= 2**53 → return 0`) but `offlineSinceMs` — the other caller-supplied clock on the same signature — is unguarded. `Math.floor(NaN)` → `windowStartMs = NaN` → `fastForwardEndMs = Math.min(NaN, nowMs) = NaN` → the confiscation arm's `nextCycleAt <= fastForwardEndMs` is always false → skipped → the settle loop `while (nextCycleAt <= nowMs && settled < 5000)` pays every due cycle. Probed on a validator-admitted restored state (`{started:true, workers:1, nextCycleAt:0}`): `settleOffline(now, NaN)` → **5000** settles with essence output minted; the identical state under the honest `now-60s` window settles exactly **2**; `+Infinity` denies (0, backlog confiscated); `-Infinity` bounds by the 10h cap (~1200, honest semantics). Sibling asymmetry proves the gap is an omission, not policy: `settleAutoFarmOffline` early-returns on `!Number.isFinite(elapsedOfflineSeconds)` (GameManagerAutoFarmOps.ts:243) and `advanceWorkerLanes` guards `emptyLaneStartMs`/`budgetMs` (WorkerLaneAdvance.ts:150-160) — `settleOffline` is the only offline-settle entry left with an unguarded window input, and it is on the very function the r29 batch edited. Reachability: ungated/future callers only — the production caller passes `Math.min(lastSavedAt ?? settleNowMs, authorityNowMs - elapsed*1000, Date.now())`, always finite (GameManagerSaveRestore.ts:471-475). Same ungated-caller threat model every r29 guard cites; the patch is incomplete on its own signature. |
| R30-AUT-2 | Medium | validator gap / crafted self-brick | `validateEquipmentEntries` (saveShapeValidation.ts:3895-4299) `requireBoolean`s `equipped` (:3993) but never `locked`/`favorite` — a crafted truthy non-boolean flag passes with zero issues (probe: `validateGameSaveShape.ok === true` for `locked:'yes'`; `ok` ⟺ zero issues at :5060-5080). Both caps undercount it in lockstep: `unprotectedCount` requires `!== true` on all three flags, `protectedCount` requires `=== true` — a truthy string counts as unprotected and stays under the 500 refuse line. Restore re-feeds entries verbatim (`equipmentBag.add(structuredClone(entry))`, GameManagerSaveRestore) → `instance.locked === 'yes'` reads truthy to every consumer: `dissolveInstances` → `{ok:false,'locked'}` (EquipmentDissolve.ts:60), wash/refine guards identical, auto-dissolve filter `!instance.locked` excludes it (EquipmentBag.ts:88). Probed wedge: 500 crafted-locked entries + one honest drop → the honest drop self-dissolves on arrival (`rewards.length === 1`, crafted_0..crafted_499 all retained) — every future equipment drop does the same, permanently. No user escape: `setProtected` could heal it (`instance.locked === false` is false → proceeds → sets `false`), but it has no production caller today (dormant API — the 11th-flag refuse it owns is unreachable in production). The validator's own contract ("present-but-wrong-typed value is unproducible", realmLevel comment :3940) makes this exactly the class the gate exists to refuse. |
| R30-AUT-3 | Low | guard-window asymmetry | Two edges on the `2**53` bound: (a) `restoreJobs`' shift arm fires for ANY admitted `restoreNowMs` below a stamp — a negative-finite clock (`-(2**52)-1`, inside `\|x\| < 2**53`) re-anchors the queue deep-past and the next honest tick mints it whole (probe: shifted `startedAtMs === -(2**52)-1`, honest `tick(now)` delivers the pill). A `>= 0` pin would close the unbounded half; small-positive lying clocks are inherent to a clock argument (no epoch floor exists). (b) `startJob` and the restore re-anchors admit clocks in `[2**52, 2**53)` — stamped `startedAtMs`/`nextCycleAt` then sit outside the persisted domain (`isBoundedTimestamp` < `2**52`, saveShapeValidation.ts:421) and the NEXT save write refuses (deny direction, self-heals on the next honest restore via the same re-anchor). Both ungated-caller only — severity parity with r29-AUT-F2. |
| R30-AUT-4 | Nit | unreachable branch | `pauseSimulation`/`resumeSimulation` share the `entryStage === 'game'` gate (useAppLifecycle.ts:265/:290), so under the refuse-arm 'error' surface a live combat RAF never receives the freeze call — the r29 tick gate (:238) is what actually freezes the sim. Every recovery exit in SaveIncompatibleScreen reloads the page, so no catch-up channel exists — cosmetic dead code on this path only (pre-existing; unchanged by r29). |

## Attack log — rejected candidates (verified held)

- **`clockOk` boundary sweep**: `2**53` and `-2**53` denied, `2**53-1`
  admitted, `NaN`/`±Infinity`/`1e300` denied, string/null/object clocks
  denied (non-number `Number.isFinite` fails). `+0` vs `-0` identical
  (both finite, both < 2**53 → admitted; a zero clock stamps jobs in the
  tiny past — lying-clock semantics, outside the broken-clock doctrine).
  The 4.5e15 headroom between the guard (`2**53`) and the persisted bound
  (`2**52`) is unreachable through any real seam — no probe writes the
  gap except via an ungated caller (R30-AUT-3b).
- **`restoreJobs` verbatim arm**: under `-Infinity`/`NaN` restoreNowMs the
  shift does not fire — stamps keep verbatim (probe asserts equality), a
  postdated job stays parked past honest `now` (deny). The reservation
  digest is NOT re-derived in the verbatim arm, so an original-stamp
  digest stays self-consistent — not a stale-digest wedge. Malformed
  `reservation.specialIngredients` still normalizes to `[]` in both arms
  (non-foldable → stale digest → settle-verify denies — pinned residual).
- **`DecomposeSystem.restore` verbatim merge**: `NaN` restoreNowMs →
  `Math.max(0, restoredDeadline)` parks a crafted-future deadline
  verbatim; `settleOffline(now, now-60s)` then pays 0 — probed.
- **`entryStage` gate**: 'intro'/'auth'/'character' freeze via the same
  predicate; 'error' via the refuse arm clears `routeAdapter.error` at
  coordinator step 3 (:397) so `pendingGameRoute` is null →
  `entryStage='error'` → frozen; a FAILED game-route transition keeps
  `failedRequest.target` ∈ GAME_ROUTES → `entryStage='game'` and the sim
  keeps running — deliberate host-reuse for retry (useBootFlow.ts:51-63
  comment), not a refuse-path hole. All SaveIncompatibleScreen exits
  (`reset both scopes`, reload-after-import) are `window.location.reload()`
  — no live catch-up payout channel exists.
- **Refuse-arm early return**: `return result` after `bootFlow.fail()`
  skips only the transient autosaveFailed toast + `saveFailureNotified`
  latch — the r29 fix for r29-AUT-F4's double-signal complaint; no
  bookkeeping is lost (`saveIssue.clear()` was already unreachable under
  remote refuse — pinned residual).
- **`setProtected` union pool**: second flag on an already-protected item
  free, 11th DISTINCT item refuses `protection_cap`, full unprotect frees
  the pool — probed. Equipped entries may hold flags (validator counts
  `locked===true` equipped entries as protected — consistent).
- **`requireArray`/`optionalArray` `[]` on capped arrays**: every
  `normalizedSave` consumer gates on `shape.ok` first (SaveSystem,
  recoveryApi, SupabaseCloudSaveService) — refused collections pay no
  element walk and reach no consumer.
- **`QuestManager.restore`**: honest clock clamps a crafted-future
  `lastDailyResetAtMs` to `now` (r11-AUT clamp intact — deny the
  free-reset, heal the freeze); bad clock → verbatim parked (deny).
  Sole `resetDaily` caller defaults `Date.now()` — unreachable seam.
- **`TribulationDirector.restoreRuntime`**: verbatim `cooldownUntil`
  parks under bad clock; admission span-pins it ≤ saveClock +
  TRIBULATION_COOLDOWN_SECONDS*1000 → far-future mint unreachable.
- **`settleAutoFarmOffline`**: `!Number.isFinite(elapsedOfflineSeconds)`
  early-returns BEFORE the re-anchor (GameManagerAutoFarmOps.ts:243) —
  the NaN-poisoning class F1 hits on DecomposeSystem is already closed
  here. `tickAutoFarm` self-heals malformed `lastCheckedMs`.
- **`advanceWorkerLanes`/`settleProductionOffline`**: every stamp input
  guarded (nowMs finiteness+2**53, slots bounds, budgetMs finiteness,
  emptyLaneStartMs finiteness+2**53, per-pending-cycle stamp pins).
- **`AlchemySystem.tick`/`settleOffline`**: hostile-clock table +
  `2**53-1` admitted-boundary already pinned by the r29 suite (38/38
  green here on the same harness shape).

## Probe inventory (22 tests, `auditR30Aut.probe.test.ts`)

- F1 suite (5): NaN mint 5000 + output; honest-60s control = 2;
  idempotent re-settle = 0; +Infinity deny 0 with timer pushed > now;
  -Infinity bounded ≤ 1200 (10h cap).
- F2 suite (5): validator admits `locked:'yes'` (ok===true, zero issues);
  verbatim restore + dissolve 'locked' refuse; 500-crafted wedge —
  honest drop dissolves, crafted survive; setProtected union pool
  semantics; equipped+locked allowed (held).
- F3 suite (8): startJob `invalid_clock` on NaN/±Infinity/±2^53/1e300
  before any cost read; admitted boundary clocks not `invalid_clock`;
  the `[2^52,2^53)` admitted-but-unpersistable window.
- F3a (1): negative-finite restoreNowMs shift mint (pill delivered).
- Held (3): restoreJobs verbatim under -Infinity (stamps identical, job
  parked, no pill) and NaN; DecomposeSystem restore verbatim park +
  settle-0 under NaN clock.
