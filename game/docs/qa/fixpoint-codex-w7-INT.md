# Fixpoint QA — Wave 7, INT (adversarial integration)

- **Reviewer**: INT (integration/adversarial)
- **Target**: `codex/hoa-cau-fireball-vfx` @ `cc4a51e7` (post-wave-6 state)
- **Inputs**: `fixpoint-codex-adjudication.md` (wave-6 dispositions), `git diff 1bd0763f..cc4a51e7`, three w6 reports, w5int/w5aut/w6int repro+pin files
- **Scope attack**: the six dispatched seams across the wave-6 delta — coordinator error-request preemption (abort + await-settle + recursion), `useBootFlow.fail()` bound-10 interplay, `OnlineSessionController` resume-failure budget, `useAppLifecycle` firstSave arm gate vs `CloudSaveWriteResult` producers, `saveIssue` scope/screen interplay under the new computed gate, migration `202610070002` tombstone absorb vs concurrent `create_character`.
- **Evidence**: EXECUTED_REPRO (new `src/services/save/w7int.repro.test.ts`, 9/9 pass on this tree), EXECUTED_VERIFY (`vitest run src/presentation src/services/session src/services/save src/composables/useBootFlow.test.ts` = 69 files / 1078 tests, all pass; **`npm run type-check` FAILS on the tip — W7-INT-1**), SOURCE_PROOF, INFERRED.

## Verdict: FINDINGS — 1 Medium + 4 Low + 5 Nit

| ID | Severity | Class | Root | Surface |
|---|---|---|---|---|
| W7-INT-1 | **Medium** | TEST_DEFECT | TST-04 | `w5aut.repro.test.ts` parametric arm-gate pin (added by wave-6) fails `vue-tsc` — type-check/`npm run verify` red on `cc4a51e7` |
| W7-INT-2 | Low | REAL_DEFECT | STA-04 | `resumeFailureStreak` is cleared only by a successful `onResume` — leaks across `acknowledge()` + re-admission; one throw post-re-auth escalates to `'recovery'` |
| W7-INT-3 | Low | REAL_DEFECT | CON-05 | error-preemption `await inFlightPromise` has no deadline — inherits the catch-path reopen's timeout-free `curtain.open`; a never-settling port wedges the error request forever |
| W7-INT-4 | Low | REAL_DEFECT | STA-05 | "the retried request takes the cleared slot first" is falsified — a settle-chained competitor lands first and is aborted `'failed'` per hop; preempted session-route holds detach `'hold'` (live uncommitted session, `failedRequest` pin wiped) |
| W7-INT-5 | Nit | REAL_DEFECT | CON-08 | `fail()`'s retry loop is vestigial — `'rejected'` is unreachable for `{target:'error'}` on a live coordinator; the starvation breadcrumb only fires post-dispose, where its "stayed busy" claim is wrong |
| W7-INT-6 | Nit | REAL_DEFECT | CON-03 | `dispose()` mid-preempt settles the preempting request — `'rejected'` when the recursion lands post-dispose, `'failed'` when the error transition landed first; neither hangs |
| W7-INT-7 | Nit | REAL_DEFECT | STA-05 | latent/pre-existing: `inFlightRequest` is set at `:243` but `inFlightPromise` at `:249` — a `request()` issued inside the sync-head `notify()` skips the in-flight guard and double-allocates a second live transition |
| W7-INT-8 | Nit | REAL_DEFECT | STA-05 | firstSave arm double-terminal: `observeSaveResult` already maps `SAVE_INVALID→'recovery'`; the arm's `markFailed('recovery')` re-enters terminal (generation +2, `onPause('terminal')` ×2) |
| W7-INT-9 | Nit | REAL_DEFECT | CON-06 | two `{target:'error'}` requests dedup-share by `isSameRequest` (target+session only) — a second error request carrying `behindCurtain` domain work would drop it silently (no such caller today) |
| W7-INT-10 | Low | REAL_DEFECT | CON-05 | conditional: if the `'error'` transition itself fails (`renderer.prepare` wedge → 10s deadline, `deactivate` throw, dispose), `fail()` treats `'failed'` as terminal-success — the error stage never mounts and armed surfaces (SaveIncompatibleScreen) never show |

---

## W7-INT-1 — Medium — `npm run type-check` is RED on the wave-6 delta tip

**Class** TEST_DEFECT · **Root** TST-04 (stale fixture: the pinned test file no longer type-checks)

**Evidence**: EXECUTED_VERIFY — `npm run type-check` (`vue-tsc --build`) on `cc4a51e7`:

```
src/services/save/w5aut.repro.test.ts(382,5): error TS2345: Argument of type
  '(code: "NETWORK_UNAVAILABLE" | "SESSION_REVOKED" | "SERVER_ERROR" | "PROTOCOL_OUTDATED") => Promise<void>'
  is not assignable to ... '(...args: ["SERVER_ERROR", ...] | ...) => Awaitable<...>'.
  Source has 2 element(s) but target allows only 1.
src/services/save/w5aut.repro.test.ts(384,7): error TS2322: Type 'Mock<...code: BackendErrorCode...>'
  is not assignable to type 'Mock<...code: "SAVE_INVALID"...>'
```

The wave-6 commit `cc4a51e7` added the 4-code parametric `it.each` pin (w5aut.repro.test.ts:375-427) with a 1-argument callback against 2-element tuples (`['SERVER_ERROR', 'unrecognized/authority REJECTED classes']`, …) and a `player.save` mock whose inferred signature was bound to `'SAVE_INVALID'` by the earlier single-case test. Vitest runs it fine (esbuild strips types — the pin passes at runtime), but `vue-tsc` rejects both lines, so the P3 gate command and `npm run verify` fail on the audited tip. The wave-6 "verification green" evidence for this file was therefore taken before the final edit or the gate was not re-run.

Impact: every subsequent `npm run verify`/`type-check` on this branch is red until the pin's typing is fixed — the fixpoint loop's own evidence command is compromised on the very delta it verified. Test-file only; no production defect.

**Fix direction**: give the `it.each` callback both tuple elements (`async (code, _why) =>`) and widen the `player.save` mock type (e.g. `code: BackendErrorCode`, `retryable: boolean` in the earlier single-case stub, or type the mock explicitly).

---

## W7-INT-2 — Low — `resumeFailureStreak` survives `acknowledge()` and re-admission: one post-re-auth throw escalates to `'recovery'`

**Class** REAL_DEFECT · **Root** STA-04 (stale dependent state across a lifecycle boundary)

**Evidence**: EXECUTED_REPRO — `w7int.repro.test.ts` W7-INT-1a (local branch) and W7-INT-1b (remote branch), both green.

`RESUME_FAILURE_BUDGET=3` counts *consecutive* `onResume` throws; the counter is reset ONLY at `OnlineSessionController.ts:473/503` (a successful `onResume`). `acknowledge()` (:331-339) bumps generation, clears heartbeat/retry, transitions `'signed-out'` — and leaves the streak armed. `beginChecking`/`markReady` likewise never touch it. Executed sequence (local mode): ready → suspend → resume throws ×2 (streak 2, `'reconnecting'`) → `acknowledge()` → `beginChecking`/`markReady` (fresh admission) → suspend → **ONE** resume throw → `authorityState === 'recovery'` — the escalation fires on the new admission's first failure before its retry cadence ran once. The ratchet is then permanent: a second acknowledge/re-admit/throw cycle lands `'recovery'` immediately again.

Defensible reading: the throws were still literally consecutive (no success between) — a deterministic restore fault is still deterministic after re-auth, and the budget exists to stop exactly that churn. The counter-argument: `acknowledge()` is the *owned* reset boundary — generation, timers, and state all re-derive there, and the budget's docstring ("consecutive onResume throws before a deterministic resume fault escalates") scopes escalation to a churning reconnect episode. A transient throw in admission A (e.g. a storage hiccup) is then permanently banked: one blip today + one blip after the user re-auths next week + one more a month later = terminal `'recovery'` with zero retries in the newest admission. Effect is a premature/incorrect terminal surface, not corruption → Low.

Also verified clean inside the same surface: `markFailed` called *inside* `onResume` bumps generation → the post-call `generation === this.generation` guard correctly skips `markReady` (App.vue's replaced-lineage reject path relies on this); the local branch needs no `reconnectInFlight` guard (`onResume` is synchronous, can't re-enter).

**Fix direction**: reset `resumeFailureStreak` in `acknowledge()`/`stopAll()` (the owned reset boundary) — or document that the budget is intentionally process-wide and rename accordingly.

---

## W7-INT-3 — Low — the preempt `await inFlightPromise` has no deadline: a never-settling catch-path reopen wedges the error request forever

**Class** REAL_DEFECT · **Root** CON-05 (undefined failure behavior at a port boundary)

**Evidence**: EXECUTED_REPRO — `w7int.repro.test.ts` W7-INT-2: aborted transition hangs in its catch-path `curtain.open`; the `{target:'error'}` request stays pending across 24 flushes (no `'rejected'`, no `'error'` mount, `phase` frozen `'loading'`); releasing the port promise lets the recursion mount `'error'`.

The preempt block (`GamePresentationCoordinator.ts:221-225`) aborts the in-flight transition and awaits its settle with no timeout. That await inherits every unbounded wait inside `executeTransition`'s own catch path — concretely `curtain.open(transitionId, new AbortController().signal)` at :524, deliberately given a fresh signal AND no `withTimeout`, so a `CurtainPort` whose `open` never settles wedges the *error* request itself. `fail()`'s first `await coordinator.request(...)` then never returns — its retry loop and breadcrumb never even start — externally identical to the silent starvation wave-6 was built to kill.

Blast radius bound: the shipped `PresentationTransitionOverlay.animateCurtain` self-heals via a 600ms safety timeout plus a settled-early-return, and `OnboardingStage`'s WAAPI `current.finished` (the one settle that can genuinely stall in a hidden tab) is only reachable for auth↔character exchanges, which are never `behindCurtain` — so no shipped port currently exhibits the hang. This is a contract-level hole on the new await, not a live wedge → Low.

Sibling verified clean while here: the aborted catch-path reopen is awaited inside `executeTransition` *before* its promise settles, so `await inFlightPromise` strictly serializes the reopen before the error transition's `curtain.close` — the shared-curtainState corruption the dispatch asked about cannot occur (the overlay comment at :503-524 documents exactly this serialization).

**Fix direction**: wrap the catch-path reopen in `withTimeout` (fresh signal, its own deadline) — or give the preempt await a bounded wait with an explicit reject outcome.

---

## W7-INT-4 — Low — "takes the cleared slot first" is falsified: a settle-chained competitor lands the slot first and eats an aborted `'failed'` transition per hop

**Class** REAL_DEFECT · **Root** STA-05 (wrong derived ordering claim + observable churn)

**Evidence**: EXECUTED_REPRO — `w7int.repro.test.ts` W7-INT-3: combat request parked at `'awaiting-ready'`; competitor `a.then(() => request('home'))`; `request({target:'error'})`. Result: A `'failed'`, **the competitor's request resolves `'failed'` (not `'rejected'`) — it executed a real transition and was itself aborted** — `curtain.close` invoked 3× (A + landed competitor + error), one `'Transition aborted'` error record observed, then `'error'` mounts.

The wave-6 comment (coordinator:217-219) claims the preemptor's `.then` continuation "was registered BEFORE the competitor's settle continuation, so the retried request takes the cleared slot first". The actual microtask order for the competitor shape it cites (a caller chained on the aborted request's *outer* promise):

1. `P_Aexec` settles. Its handlers run in registration order: `request()`'s own `await promise` resume (registered first) → the preemptor's `.then` wrapper (registered at abort time).
2. The resume runs the `finally` — clears the slot — and resolves the outer promise, which queues the competitor's continuation **behind the preemptor's `.then` wrapper but ahead of the preemptor's `await` resume** (the wrapper resolving queues that resume one more hop out).
3. Queue order is therefore: `finally`-resume → wrapper → *competitor* → *preemptor resume*. The competitor's `request()` lands first, allocates a fresh transition, and the preemptor's recursion then aborts *it*.

Convergence still holds (each recursion re-preempts), so the fix works — but the stated invariant is wrong, and the true mechanism produces observable churn: every settle-chained competitor hop executes a doomed transition (`'Transition aborted'` error record + error-card flash until the error transition's step-3 clear), and each of those callers receives `'failed'` — a real-failure contract — where pre-wave-6 it received `'rejected'` — a transient-contention contract. Fire-and-forget domain callers (`useTribulation` drain, `useBattleActions` teardown) don't read results, but any awaiting caller chaining retries now misinterprets aborts as domain failures.

Rider finding (same rig): the preempted *session-route* transition had already adopted its session and taken a hold — its catch detaches `'hold'`, so `sessionId:7` remains the live combat session, uncommitted and unretried; the error transition's step-3 `this.error = null` wipes the `failedRequest` that was its only resume pin. Zombie-session by `detach('hold')` is the pre-existing failed-transition contract, but preemption newly routes it: the session survives with no surface aware it exists (asserted: `isCurrentSession` still true while `snapshot.error` is null). Whether that is a leak or intended retention depends on who owns reaping — worth an explicit ruling.

**Fix direction**: correct the comment to describe the observed mechanism (preempt wins by aborting whatever lands, not by landing first); consider `'aborted'` as a distinct `TransitionResult` status so chained callers can distinguish preemption from domain failure; rule on zombie-session reaping for preempted session routes.

---

## W7-INT-5 — Nit — `fail()`'s 10-bound loop is vestigial; the breadcrumb's stated cause is wrong when it fires

**Class** REAL_DEFECT · **Root** CON-08 (deferred mechanism accidentally live/dead)

**Evidence**: EXECUTED_REPRO (w7int W7-INT-4b: `console.error` fires once post-dispose with "stayed busy") + SOURCE_PROOF.

For `{target:'error'}` on a live coordinator, `'rejected'` is unreachable: every route's edge list includes `'error'` (ALLOWED_EDGES), `isValidRequest` passes unconditionally for it, `isUnchanged` returns `'unchanged'` (a success-class status that exits the loop), and the preempt branch aborts rather than rejects. The loop's `if (result.status !== 'rejected') return` therefore exits on attempt 0 under every live-coordinator outcome — `whenIdle` and attempts 2-10 are dead code. The only producer of `'rejected'` left is `this.disposed` — where the loop burns all 10 rounds instantly and logs `"error route request starved - coordinator stayed busy through the retry budget"`: the coordinator was dead, not busy, so the one observable breadcrumb misdescribes its only reachable trigger. Harmless; misleading.

**Fix direction**: drop the loop or re-purpose the breadcrumb for `status==='failed'` / disposed; if kept as a guard, fix the message to cover the disposed case.

---

## W7-INT-6 — Nit — `dispose()` mid-preempt settles cleanly (two reachable shapes)

**Class** REAL_DEFECT · **Root** CON-03 (underspecified terminal semantics — documented here as the pin)

**Evidence**: EXECUTED_REPRO — w7int W7-INT-4a. Error request parked on `await inFlightPromise` while the aborted transition's reopen is gated; `dispose()` runs; reopen resolves; aborted transition settles `'failed'`; the recursion re-enters `request()` post-dispose → `'rejected'`. The alternate order (error transition lands its slot *before* dispose — observed during test bring-up) ends `'failed'` via the dispose-abort instead. Both settle; neither hangs; the distinction (`'rejected'` vs `'failed'`) depends purely on which side of `dispose()` the recursion lands — cosmetic, but callers counting on a post-dispose `'rejected'` should know `'failed'` is equally reachable.

---

## W7-INT-7 — Nit (latent, pre-existing) — `request()` double-allocates the slot inside the sync head

**Class** REAL_DEFECT · **Root** STA-05

**Evidence**: EXECUTED_REPRO — w7int W7-INT-5: a subscriber calling `request()` inside the `notify()` at executeTransition's sync head (targetRoute assigned, `:300`) observes `inFlightRequest` set (':243') but `inFlightPromise` still null (':249' not yet reached) → the in-flight guard is skipped entirely → a second transition is allocated and both `executeTransition` bodies run concurrently (`curtain.close` called 2×; both resolve `'entered'`; slot identity ends mixed — `inFlightRequest`/`currentAbortController` belong to the nested request while `inFlightPromise` holds the outer's).

No production subscriber calls `request()` inside `notify` today (verified: `VueRouteAdapter`/`App.vue` subscribers only write refs; `RouteMount` witnesses resolve waiters). Pre-existing on the base — not a wave-6 regression — recorded so the single-flight invariant's boundary is documented.

---

## W7-INT-8 — Nit — firstSave arm enters the terminal state twice

**Class** REAL_DEFECT · **Root** STA-05

**Evidence**: EXECUTED_REPRO — w7int W7-INT-6 on a real `OnlineSessionController`: `observeSaveResult({status:'unavailable', code:'SAVE_INVALID', retryable:false})` already maps to `enterTerminal('recovery')` (generation++, `onPause('terminal')`); the arm at `useAppLifecycle.ts:632` then calls `markFailed('recovery')` → a second identical terminal entry — generation +2 total, `onPause('terminal')` twice (`pauses === ['terminal','terminal']`). Harmless duplication — the arm's real work is `saveIssue.report` + `boot.fail()` — but the generation bump invalidates unrelated in-flight continuations a second time and the pause callback fires twice for one event.

---

## W7-INT-9 — Nit — second error request's `behindCurtain` payload would be silently dropped by dedup

**Class** REAL_DEFECT · **Root** CON-06

**Evidence**: SOURCE_PROOF — `isSameRequest` (:595-602) compares only `target` + session identity; `behindCurtain` is ignored, so a `{target:'error', behindCurtain:X}` arriving while an error transition is in-flight shares the sibling's promise and `X` never runs. No production caller issues `behindCurtain` with `target:'error'` today (the only `behindCurtain` callers are home-targeted teardown in `useTribulation`/`useBattleActions`/`App.vue`), so latent-only. The same note covers a non-error same-target dedup silently dropping domain work — equally unreachable today.

---

## W7-INT-10 — Low (conditional) — a failed `'error'` transition leaves `fail()`'s callers on the generic card, not the error stage

**Class** REAL_DEFECT · **Root** CON-05

**Evidence**: INFERRED + boundary-checked. `fail()` exits its loop on any non-`'rejected'` status — including `'failed'`. The `'error'` route carries no asset bundles (`getBundlesForRoute('error') === []`, AssetBundleCatalog:774) so `ensureFor` cannot realistically fail, but `renderer.deactivate(currentRoute)` and `renderer.prepare` still run — a wedged `RouteMount` for `'error'` hits the 10s `prepareReady` deadline, a throwing `deactivate` lands `'failed'` immediately, and dispose mid-flight does the same. On `'failed'`, `currentRoute` never commits `'error'` → the boot `stage` computed never returns `'error'` → `SaveIncompatibleScreen` (the surface the firstSave arm and the resume-reject path arm via `saveIssue.report`) never mounts; the user sees only the generic transition error card. Probability is low (needs error-route prepare/deactivate itself to fail) but it is exactly the wedge class wave-5/6 hunted → Low conditional.

---

## Seam verdicts (dispatched attack list)

| Dispatched surface | Verdict |
|---|---|
| Aborted catch-path reopen vs error transition's `curtain.close` on shared `CurtainPort` | **CLEAN by construction** — the reopen is awaited inside `executeTransition` before the promise settles (:503-524); `await inFlightPromise` strictly serializes it before E's close. Leftover mid-flight `'closing'` states converge via transitionend/600ms safety in the shipped overlay. The *hung-port* residual is W7-INT-3. |
| Abort during `'awaiting-ready'`/other phases | **CLEAN** — executed at `'awaiting-ready'` (W7-INT-3 rig): withTimeout's abort-race rejects, lands `'failed'` with `'Transition aborted'`; reopen only when `behindCurtain && curtainClosed`. Same shape holds at `closing`/`loading`/`activating`/`opening` (abort listener + checkAborted at every step). |
| Two concurrent error requests | **CLEAN** — dedup shares the in-flight promise; both callers resolve `'entered'` on the same transitionId (executed, control matrix). Payload-drop nit: W7-INT-9. |
| Error request vs non-conflicting same-target in-flight | **CLEAN** — shares the promise unchanged (executed: same-target dup resolves with A's `'failed'`). |
| Recursion skipping `isUnchanged`/edge re-validation | **CLEAN** — `return this.request(request)` re-runs the *entire* pipeline (disposed/valid/unchanged/dedup/edge); nothing skipped. |
| `dispose()` mid-await | **SETTLES** — `'rejected'` (post-dispose recursion) or `'failed'` (dispose-abort) — W7-INT-6. |
| `fail()` bound-10 + preemption starvation | **CANNOT STARVE on a live coordinator** — `'rejected'` unreachable for `'error'`; loop vestigial + misleading breadcrumb (W7-INT-5). Residual hang relocated to the request itself (W7-INT-3); `'failed'` treated as terminal-success (W7-INT-10). |
| Resume budget: local vs remote / streak across markFailed→acknowledge→re-ready / generation interplay | **LEAK** — W7-INT-2 (executed both branches). markFailed-inside-onResume + generation guard: correct. |
| firstSave arm gate vs `CloudSaveWriteResult` producers | **COVERAGE COMPLETE** — every producible permanent payload-reject carries a code: REJECTED maps `SAVE_INVALID`+`SAVE_SCHEMA_UNSUPPORTED→'SAVE_INVALID'`, `SAVE_TOO_LARGE→'SAVE_TOO_LARGE'` (SupabaseCloudSaveService ~:968-988); coordinator synthetic unavailables (`adapterThrow`/`staleGenerationResult`) carry no code but aren't payload-rejects → correctly skip the arm. No code-less wedge path exists. Double-terminal nit: W7-INT-8. |
| `saveIssue` scope/screen interplay — second `report()` while mounted | **STILL UNREACHABLE** — all `report()` callers sit behind terminal/generation fences (markFailed→terminal precedes report; a second report needs a full re-admission cycle = fresh mount). `remoteResettable` computed is now live; residual copy/action desync (confirm-modal copy frozen at `requestConfirm` time vs branch re-derived at click) stays latent — needs a second in-flight report while the confirm modal is open. |
| Migration 202610070002 tombstone absorb vs concurrent `create_character` | **RACE-SAFE** — delete-before-INSERT inside one txn, after all reject checks, under the `FOR UPDATE` roll lock: same-roll callers serialize (loser sees `consumed_at` → `INVALID_TALENT_ROLL`); two different-roll creates hit the partial unique index → `23505`→`SERVER_ERROR` retry→`CHARACTER_EXISTS` (pre-existing recorded nit); a loser rollback removes delete+insert atomically — no torn tombstone. |

## Verification run

- `npx vitest run src/services/save/w7int.repro.test.ts` — **9/9 pass**.
- `npx vitest run src/presentation src/services/session src/services/save src/composables/useBootFlow.test.ts` — **69 files / 1078 tests, all pass** (w6int/w5int/w5aut pins still green at runtime).
- `npm run type-check` — **FAILS on `cc4a51e7`**: 2 errors, both in `w5aut.repro.test.ts` (:382, :384) — W7-INT-1. `w7int.repro.test.ts` itself type-checks clean.
