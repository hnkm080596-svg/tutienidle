# Fixpoint audit r34 — AUT (adversarial exploit)

Auditor: r34-AUT worker (Devin session). Base: `codex/hoa-cau-fireball-vfx`
@ `db694183` (the full r33 adjudication). Role: assume every r33 fix is
exploitable — the post-admission `resumeCombat('authority-pause')` unlatch
in `useAppLifecycle.bootGame` (:729-751 tail) and the `restoreStates`
`.flatMap` inverted-pair drop (:158-200) — then siblings of each class:
the OTHER fail/early-return arms, adjacent stamp pairs, lane accounting,
the post-markReady window, and the coordinator/deny-guard seams both
fixes lean on.

In-place audit on the audit commit (test+doc writes only — P1/P2
read-only on production code). Every claim below carries an EXECUTED
deterministic repro in `src/services/save/auditR34Aut.probe.test.ts`
(10 tests, all passing — `npx vitest run <file> --pool=threads`,
`@vitest-environment node`, `Date.now` mocked where the save clock
matters). Report branch: `devin/audit-r34-AUT-db694183`.

Verification executed:
- `npx vitest run src/services/save/auditR34Aut.probe.test.ts --pool=threads`
  — 10/10 green.
- `npm run type-check` — clean.
- Full read of the r33 surfaces at the audit commit:
  `useAppLifecycle.ts` (:229-247 tick gate, :261-305 pause/resume gates,
  :309-331 persistProgress gates, :335-757 bootGame — every fail arm
  returns before :729 markReady; tail is synchronous try/finally with NO
  catch, :802-823 stopAll), `useBootFlow.ts` (:94-96 enterGame =
  fire-and-forget `void coordinator.request('home')`; :97-112 fail =
  10-attempt retry loop), `GamePresentationCoordinator.ts` (:43-51
  ALLOWED_EDGES, :193-263 request admission: rejected on in-flight
  conflict, 'error'-target preemption, :286-529 executeTransition,
  :510-511 aborted-session detach-to-headless),
  `OnlineSessionController.ts` (:183-191 canMutate, :195-221
  beginChecking guard + markReady timers-before-fanout, :240-255 pause,
  :276-303 observeSaveResult local-only early-return, :365-388
  transition + enterTerminal cleanup-first),
  `GameManagerTurnBattleOps.ts` (:380-456 freeze/resumeCombat delegates,
  :480-501 syncOffScreenFreeze + advanceCombat drop-rule),
  `PresentationSession.ts` (:93-191 hold/attach/release/detach +
  isBlocking), `App.vue` (:561-654 persistPlayer refuse arm + r30-INT-1
  freeze ordering, :693-737 onPause/onResume wiring, :806-822
  acknowledgeAuthority + teardownToAuth, :981-1093 bootGame callers —
  `void bootGame(false)` :1104, `await bootGame(true)` :1122),
  `ProductionSystem.ts` (:129-206 restoreStates flatMap arms,
  :236-272 setWorkerAssignment clamp, :411-487 tickWorkers,
  :576-636 rollHiddenChannelRewards counter semantics),
  `WorkerLaneAdvance.ts` (:133-136 mintedSpanMs, :161-203 deny-guard
  incl. pending.some stamp sweep, :226 seed loop bound on slots not on
  lane count, :307-345 saved-lane continuation + seededPending),
  `AlchemySystem.ts` :401-411 restoreJobs drop arm,
  `ProductionOffline.ts` (:105-209 settleWorkersOffline — slots are
  reallocated by allocateWorkerSlots, restored activeWorkerSlots zeroed
  first; :184-200 field-epoch re-stamp with 2^52 headroom),
  `SaveSystem.ts` (:273-343 restoreGameSession — no shape gate here;
  preflight + try/catch; :341-343 detachSaveValue JSON boundary,
  :345-417 buildGameSave, :421-435 writeGameSave unvalidated write,
  :524 load-path validateGameSaveShape), `CloudSaveCoordinator.ts`
  (:56-67 load passthrough, :141-195 driveSave wire-form
  validateGameSaveShape -> SAVE_INVALID non-retryable refuse),
  `SupabaseCloudSaveService.ts` (:441/:748 remote-load validates),
  `saveShapeValidation.ts` (:3475-3587 cycle pins incl. ordering :3533
  + span-exactness :3571 + startedAtMs<=lastSavedAt :3581, :3589-3704
  site pins incl. lane ceiling :3670-3677, assignedWorkers :3636-3641,
  hiddenChannelCycles int-map :3645-3651, parent-siteId match
  :3690-3699).
- Caller/gate census: every admission seam (local `inspectLocalSave`/
  `loadGame`, `importSaveRaw`, remote load, `driveSave` outgoing gate)
  runs `validateGameSaveShape`; `restoreGameSession` consumes only
  gate-admitted payloads; `restoreStates`/`restoreJobs` feed solely
  from `GameManagerSaveRestore` inside that flow. Ungated feeds are
  test/tool callers only.

---

## Verdict: PASS WITH EVIDENCE (0 Critical / 0 High / 0 Medium / 2 Low / 1 Nit)

The r33 batch holds under attack. Every fail arm still returns before
`markReady()` :729, so a failed or stale-booted re-entry keeps
'authority-pause' latched on the CombatClock (pinned on the
rejected-restore arm and the mid-firstSave generation fence — the two
arms the r33 probe did not cover). The success tail markReady ->
resumeCombat -> clock.start -> startTickLoop -> enterGame is fully
synchronous: no RAF frame, tick, or lifecycle event can interleave, and
'not-revealed' covers any combat session that is still held off-screen
(the overlay pause case that motivated r33). The flatMap drop is
exactly the ordering-parity the validator already pins; crafted
out-of-domain pairs that still park verbatim are unreachable through
any admission seam.

Two Low findings, both pre-existing seam hygiene surfaced by attacking
the tail (neither is an r33 regression — r33 narrowed, not widened,
the exposure), plus one Nit doctrine asymmetry.

| ID | Severity | Class | Surface |
|---|---|---|---|
| R34-AUT-1 | Low | lifecycle / wedge | `useBootFlow.enterGame` (:94-96) fires `coordinator.request('home')` once and detaches the promise — no retry, no `whenIdle` requeue, no preemption (unlike `boot.fail()`'s 10-attempt loop and the 'error' target's abort-priority). `GamePresentationCoordinator.request()` returns 'rejected' whenever a conflicting transition is still in flight (:209-231). An in-flight competitor at tail time — the mount transition into the current surface settling late, or a user-driven nav during a slow remote load — leaves `bootGame` returning `{status:'entered'}` with markReady done, heartbeat armed, `clock.start()` + tick loop armed, and the combat unlatch applied, while the mounted surface never becomes 'game'. EXECUTED: `boot.enterGame` stub that never promotes `entryStage` (the rejected-request equivalent) -> outcome 'entered', `markReady` called once, `authority-pause` cleared, clock 'running', `entryStage` still 'auth'. BOUNDS (executed): the armed tick interval stays stage-gated (`entryStage==='game' && canMutate` -> onTick not called) and `persistProgress` early-returns; combat sessions leaving a route detach to 'hold', so 'not-revealed' keeps any live battle frozen off-screen anyway — no headless turn resolution. A second user-driven boot re-runs enterGame and heals (`bootInFlight` resets in `finally`). Severity Low: real asymmetry, narrow trigger, no state damage, self-healing — sibling of the documented W6-INT-1 starvation class but for the non-terminal target. |
| R34-AUT-2 | Low | lifecycle / zombie admission | `bootGame`'s success tail (:727-753) sits inside `try/finally` with NO catch — a synchronous throw from `markReady()`, `resumeCombat()`, `clock.start()`, `startTickLoop()`, or `enterGame()` propagates out of `bootGame` as a rejected promise. The only plausible thrower is `markReady()`'s `onStateChange` fan-out (the other four are field writes, `Set.delete`, `window.setInterval`, or a void-detached async request that cannot propagate). EXECUTED: stub `markReady` throwing -> `bootGame` rejects, `boot.fail` never runs, tick never armed, combat latch holds (the r33 placement makes this arm fail-safe). With the REAL `OnlineSessionController`: a throwing `onStateChange` leaves `authorityState === 'ready'`, `canMutate() === true`, and the heartbeat interval armed behind the rejected boot — a zombie half-admission (callers `void bootGame` :1104 / event-handler `await` :1122 surface it only as unhandled rejection). Severity Low: requires an app-code fault in a dep, not attacker input; consequence is a stranded 'ready' controller + armed timers on the auth screen, no sim mutation (no tick loop armed). Worth a `try/catch` -> `boot.fail()` wrapper or a comment pin acknowledging the arm-safe direction. |
| R34-AUT-3 | Nit | doctrine asymmetry / unreachable wedge | `restoreStates` parks a NaN-stamped pair verbatim (`NaN <= NaN` fails the drop; `NaN > restoreNow` fails the shift) — executed: a `{startedAtMs: NaN, completesAtMs: NaN}` cycle lands in `workerCycles`, `advanceWorkerLanes`'s `pending.some` stamp sweep freezes the whole site (a sibling honest due lane never settles), and `buildGameSave` -> wire (NaN -> `null`) -> `validateGameSaveShape` fails `isNonNegativeBoundedTimestamp` -> every later write refuses SAVE_INVALID. Sibling `AlchemySystem.restoreJobs` DROPS the identical shape (executed: `getJobs()` empty). REACHABILITY BOUND (executed): the same bytes fed as a crafted save fail `validateGameSaveShape` outright — load/import/remote seams all validate before `restoreGameSession`, so the parked arm is defense-in-depth only. The accepted-residual wording "parks self-harm own channel" understates it mechanically (the write refusal is whole-save) but correctly in reachability. Nit: pick one doctrine across the two restore seams or record the divergence as intentional. |

## Attack log — rejected candidates (verified held)

- **`resumeCombat` throwing** — `combatClock.resume` is a `Set.delete`
  on a private field plus a state recompute; no reachable throw.
- **Tail interleave** — markReady through enterGame is fully
  synchronous; RAF frames, intervals, and Vue effects (default
  non-sync flush) cannot interleave. `enterGame`'s sync prefix on a
  'home' request takes no session hold, so no `syncOffScreenFreeze`
  runs either.
- **Post-markReady mutation persistence** — the only writes inside the
  window are the admission bookkeeping itself; the battle stays
  'not-revealed'-frozen until a session route reveals it.
- **Stale-generation early-returns** — every continuation fence
  (:389/:554/:639/:669/:680) precedes any further mutation;
  `beginChecking` no-ops on 'ready'/'checking'/non-recovery terminal
  (:196-201); executed: `stopAll` during the firstSave await resolves
  'skipped' with markReady/resumeCombat/enterGame never called and the
  latch held.
- **Equal-stamp pair survives** — `completesAtMs <= startedAtMs` is a
  `<=` check: equal stamps drop too (executed).
- **Drop corrupting lane accounting** — `workerCycles` length never
  denominates capacity: `tickWorkers`/offline reallocate
  `activeWorkerSlots` via `allocateWorkerSlots` each pass and the seed
  loop fills `lanes < slots`; executed: a site whose only cycle drops
  re-seeds one fresh in-domain lane next tick (slots=1, minted pair
  ordered and < 2^52).
- **Oversubscribed lanes** — validator lane ceiling :3670-3677
  (`betaEffectiveWorkerCapacity`) refuses saves holding more cycles
  than the pool; ungated feeds aside, `lanes > slots` cannot arrive.
- **Foreign-siteId cycle inside a parent site** — restoreStates does
  not check per-cycle siteId, but the validator pins the parent match
  (:3690-3699); an ungated feed could mint cross-site rewards through
  `grantCycleRewards(cycle)` — unreachable via gates; noted only.
- **`hiddenChannelCycles` crafted count** — validated as non-negative
  int map; a huge count buys at most one early guaranteed emission per
  channel (counter resets on emission, amount fixed 1) and the whole
  channel engine is scope-frozen under `isScopeHidden('hiddenContent')`.
  No mint.
- **`assignedWorkers` over-capacity** — clamped at write
  (`setWorkerAssignment` min(capacity)) and again at read
  (`allocateWorkerSlots` bounds by pool).
- **Duplicate siteId entries** — `states.set` last-wins; deterministic,
  single entry persists (executed).
- **Getter/proxy cycles, object-typed stamps** — the
  `detachSaveValue` JSON round-trip at the snapshot boundary and JSON
  parsing at every admission seam kill proxies/getters/exotic types;
  ungated in-memory feeds could double-read getters, but such a caller
  already owns the machine.
- **`enterGame` throwing** — `void coordinator.request(...)` detaches
  the promise; an internal rejection is unhandled-rejection noise, not
  a `bootGame` throw.
- **`pauseSimulation` dropped during transition windows** — the
  'game'-stage gate can eat an authority pause during the brief
  post-enterGame curtain, but the mutation gate (`canMutate`) denies
  ticks/saves and 'not-revealed' keeps any held battle frozen; the
  latch is re-armed by any later pause once 'game' mounts.
- **`restoreGameSession` partial application on reject** —
  `player.restoreFromSave` applies before `gameManager.saveOps`
  (:293-297); a mid-restore throw returns 'rejected' with player state
  already mutated — contained by the boot fail arm (sim never enters)
  and identity-hash commit ordering; pre-existing, not r33.
- **Teardown-terminal `stopped` latch** — `stopAll` permanently skips
  `bootGame` ('skipped'), so logout->login on the same mount cannot
  re-enter; this is a pinned contract
  (`useAppLifecycle.test.ts` :444 "teardown la terminal"), not a
  defect.

## Coverage notes for the coordinator

- Arms not previously pinned now have executed evidence: the
  rejected-restore fail arm and the success-region generation fence
  both preserve the combat latch; the enterGame one-shot asymmetry and
  the tail-throw propagation are now probed rather than assumed.
- If either Low is adjudicated as fixable, the narrow repairs are:
  `enterGame` -> await `coordinator.request` with a bounded
  `whenIdle` retry mirroring `fail()`'s shape (or escalate to 'error'
  after N refusals), and a `try/catch` around the :729-751 tail that
  routes throws to `boot.fail()`. Neither is required for convergence
  at Low severity.
