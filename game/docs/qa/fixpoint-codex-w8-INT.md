# Fixpoint QA — Wave 8, INT (adversarial integration)

- **Reviewer**: INT (integration/adversarial)
- **Target**: `codex/hoa-cau-fireball-vfx` @ `4f456cfd` (post-wave-7 state)
- **Inputs**: `fixpoint-codex-adjudication.md` (wave-7 dispositions), `git diff cc4a51e7..4f456cfd`, the three w7 reports, w7int/w7cor repro harnesses.
- **Scope attack**: the seven dispatched seams — `aborted` flag end-to-end (preempt → compensate → forgetSession; ERR surface + retry() on a compensated session; deadline-vs-abort ordering), both arm gates vs the real saveIssue store/screen (scope `'local'` affordances; envelope-less reset dead-click), bounded catch-path reopen (inert fresh signal; closed-curtain + failed-card UX), awaited `onResume` + generation-fenced `markReady`/`markFailed`, `fail()` 'failed' retry loop cost + remaining unbounded waits, dedup `isSameRequest` vs the shared `aborted` result, firstSave skip-`markFailed` premise under local mode / missing `deps.reconnect`.
- **Evidence**: EXECUTED_REPRO (new scratch `src/presentation/w8int.repro.test.ts`, 21/21 pass — temp file, not committed), EXECUTED_VERIFY (`npm run type-check` clean on `4f456cfd` — W7-INT-1's red gate is fixed; `vitest run src/presentation src/services/session src/services/save src/composables` = 89 files / 1244 tests, all pass), SOURCE_PROOF, INFERRED.

## Verdict: FINDINGS — 1 Medium + 3 Low + 3 Nit

| ID | Severity | Class | Root | Surface |
|---|---|---|---|---|
| W8-INT-1 | **Medium** | REAL_DEFECT | STA-04 | `OnlineSessionController.ts:517` — the new `resumeFailureStreak = 0` fires on EVERY non-`'resumed'` reconnect outcome, including `'unavailable'`: an alternating throw/unavailable session never reaches the budget — escalation back to `'recovery'` becomes probabilistic (and can be starved forever), a regression of the W6-COR-4 bounded-churn guarantee |
| W8-INT-2 | Low | REAL_DEFECT | STA-05 | aborted `'failed'` sessions are compensated only where `runAdmitted`'s caller passes `compensate` — tribulation has none by design (`useTribulation.ts`), and `handleSessionStarted`'s void request has no admitter at all: a preempted tribulation admission leaves a held zombie → `TribulationDirector.update()`'s `isBlocking()` gate freezes it and `start()`'s `active` guard refuses every later breakthrough (in-session permanent soft-lock) |
| W8-INT-3 | Low | REAL_DEFECT | CON-05 | commit arm (`useAppLifecycle.ts:536-559`) arms scope `'local'` correctly but its offered remedy cannot break the wedge: the refuse is produced by the accrued snapshot the server rejects, not the local envelope — reset → `deleteSave` → reload → load `'ok'` → same commit refuse → identical surface, deterministically; and `raw=''` hides the Export affordance the arm's own comment claims preserves the accrual |
| W8-INT-4 | Nit | REAL_DEFECT | CON-05 | newly-awaited `onResume` opens a contract-latent wedge: a never-settling `onResume` parks `attemptReconnect` with `reconnectInFlight` stuck true — every retry tick early-returns, the failure budget (throw-only) never applies, `'reconnecting'` forever with zero churn. Unreachable today (shipped `onResume` is synchronous) — same silent-hang class the bounded reopen just killed |
| W8-INT-5 | Low | REAL_DEFECT | CON-06 | `isSameRequest` dedups on target+session only — a second in-flight caller's `behindCurtain` work is silently dropped while it still resolves `'entered'`. Pre-existing contract (W7-INT-9 noted "no such caller"), but the caller shape now exists in production: `exitCombatToHome`'s abandon teardown and the tribulation/home drains are all `{target:'home', behindCurtain}` requests that can race each other |
| W8-INT-6 | Nit | REAL_DEFECT | STA-05 | abort landing during `'closing'` (`curtainClosed === false`) skips the catch-path reopen → the `'failed'` card renders over a closed curtain (black void) — and the preempted transition's `'Transition aborted'` error card still flashes for the duration of the pre-empting transition (cosmetic; the retry/back buttons it shows are dead — both reject on the in-flight request) |
| W8-INT-7 | Nit | REAL_DEFECT | STA-05 | firstSave arm's skip-`markFailed` premise (`observeSaveResult` already routed the two RPC codes) silently fails whenever `deps.reconnect` is absent — `observeSaveResult` early-returns → controller stays `'checking'` while the surface arms. Unreachable today: `LocalCloudSaveService` emits only retryable code-less refuses, and remote-authoritative ⇒ `reconnect` is always bound (bundle composition) |

---

## W8-INT-1 — Medium — `'unavailable'` outcomes now reset the resume-failure streak: bounded-churn guarantee regressed

**Class** REAL_DEFECT · **Root** STA-04 (stale dependent state / counter ownership)

**Evidence**: EXECUTED_REPRO — `w8int.repro.test.ts` C1 + C1-control, both green.

The delta added `this.resumeFailureStreak = 0` at `OnlineSessionController.ts:517` — placed AFTER the `'resumed'` block so it fires on every remaining outcome: `'terminal'` (harmless — `enterTerminal` bumps generation anyway) and `'unavailable'` (**not** harmless). Before this delta the streak was cleared only by a successful `onResume`; a run of throws stayed counted across interleaved transport non-answers.

Executed sequence (remote branch): `pause` → attempt 1 `resumed`→`onResume` throws → streak 1 → retry tick: `unavailable` → **streak 0** → `resumed`→throw → 1 → `unavailable` → 0 … — eight attempts, four deterministic restore crashes, `authorityState` stays `'reconnecting'` forever. The control run (all-`resumed`, throwing `onResume`) escalates at attempt 3 as designed.

Concretely: the W6-COR-4 budget exists to kill "deterministic resume fault churns the reconnect RPC forever". A deterministic thrower interleaved with flaky-network `unavailable` outcomes is exactly that failure under mixed conditions — escalation now requires **3 consecutive failures with no `unavailable` between**, turning a fixed 3-attempt bound into a geometric wait (~14 expected attempts ≈ 140 s at 50 % availability; provably unbounded when failures and unavailables strictly alternate). The same masking applies to the new outer-catch counter (`:526-528`): an always-throwing `reconnect` pipeline is also erased by any intervening `'unavailable'`.

**Fix direction**: drop the unconditional reset at `:517` (keep the pre-delta semantics — the streak is only consumed by a resume that actually ran and succeeded), or restrict it to `'terminal'`. If the intent was "an unavailable means the transport worked this round", note the budget's own docstring counts *consecutive `onResume` throws* — an `unavailable` is neither a throw nor a success; the conservative reading keeps the count.

---

## W8-INT-2 — Low — compensate coverage stops where the domain has no cancel: preempted tribulation admission = held zombie, breakthrough soft-locked

**Class** REAL_DEFECT · **Root** STA-05 (incomplete compensation across callers)

**Evidence**: EXECUTED_REPRO (A2) + SOURCE_PROOF (`TribulationDirector.ts:243-246`, `:343-345`; `useTribulation.ts:56-75`; `createGamePresentation.ts:164-186`).

The wave-7 fix's contract — "an aborted transition's accepted domain work is orphaned and must be compensated" — is implemented only inside `runAdmitted`, and only when the caller passes `compensate`. Two producers bypass it:

1. **`useTribulation.runAdmitted('tribulation', …)` passes no `compensate`** — deliberately ("there is no domain cancel-tribulation command, and the spec forbids inventing one"). Executed: tribulation admission preempted by an error request → `'failed'` `aborted:true` → `forgetSession` runs, nothing else does → the session stays `currentSession` and `isBlocking() === true` forever. Consequence (source-proved): `TribulationDirector.update()` early-returns on `isBlocking()` (`:344`) so the orphaned run can never reach an outcome, and `start()` refuses while `this.active` is set (`:244`) → **every later breakthrough attempt returns `false` until a full reload**. The tribulation was consumed at start (`targetRealmId` committed, `tribulation_started` emitted).
2. **`handleSessionStarted`'s `void coordinator.request({target: session.kind, session})`** (`createGamePresentation.ts:79`) — a session started outside `runAdmitted` (buffered/recovery emission) has no admitter to compensate: aborted → held zombie, same shape. All *live* production starts go through `runAdmitted` (verified: `useBattleActions`/`useTribulation` are the only starters), so this arm only matters for the boot-recovery emission path — narrower still.

Reachability of (1) needs an `'error'` request racing a tribulation start — the live producer is `onResume`'s rejected live-replacement → `bootFlow.fail()` (App.vue:649-682), i.e. the player clicks Đột phá while a reconnect completes badly. Narrow, but the consequence is session-permanent and invisible (the domain still believes a run is in progress). This is the W7-INT-4 zombie-session rider resurfacing with the fix's own boundary: "compensate" cannot cover a caller that has no domain cancel.

**Fix direction** (for adjudication, not this audit): either the director needs a cancel/mark-failed path for aborted admissions (spec question), or the coordinator could `detach(token,'headless')` aborted session-route transitions — letting the orphan tick headless to an outcome that clears `active` via the existing drain. Silently leaving `held` is the worst of the three.

---

## W8-INT-3 — Low — commit arm's `'local'` remedy is a deterministic re-wedge; the claimed export affordance doesn't exist

**Class** REAL_DEFECT · **Root** CON-05 (doctrine transfer: the pending-envelope remedy does not transfer to a payload-refuse wedge)

**Evidence**: EXECUTED_REPRO (D1a/D1b/D1c/D2) + SOURCE_PROOF (`SaveIncompatibleScreen.vue:32,61-94`, `SaveSystem.deleteSave`).

The arm fires correctly and honestly: executed — `load 'ok'` + commit `SAVE_INVALID !retryable` → `saveIssue.report('corrupted','',undefined,'local')` + `boot.fail()` + real controller lands `'recovery'` via `observeSaveResult` alone (the skip-`markFailed` premise holds); a code-less permanent refuse still arms and the arm's own `markFailed('recovery')` does the terminal work; a blacklist code (`NETWORK_UNAVAILABLE`) correctly falls through to the generic fail.

But the armed surface's remedy cannot break this wedge. For the pending-* classes the envelope *was* the wedge — dropping it heals. Here the refuse is produced by the post-accrual **snapshot** the server rejects, and nothing about `deleteSave()` (save/handoff/revision/envelope keys) changes the snapshot the next boot commits. Executed: two consecutive `bootGame` cycles arm the identical surface (`D2`). So the flow is: player hits Reset → keys dropped → reload → healthy remote load → accrue → **same deterministic refuse → same screen**. Not a dead-click (verified: `deleteSave` returns `true` with no envelope present) — a working button that guarantees the same wedge. The only actual wedge-breaker (`resetCharacter`) is doctrine-forbidden because the remote head is healthy — true, but the doctrine should then be honest that this surface offers no remedy, not imply one.

Second defect in the same arm: the comment claims "the export affordance preserves what the accrual produced" — but `raw=''` and `SaveIncompatibleScreen` renders Export only when `saveIssue.raw` is non-empty (:163). The one affordance that could salvage the accrued state for manual recovery is absent; the accrual exists in memory at report time and could have been serialized into `raw`.

**Fix direction**: pass the serialized refused snapshot as `raw` (Export then works per the comment's own claim), and either accept-in-writing that no automated remedy exists for this wedge or surface an explicit "contact support / last-resort remote wipe" affordance — the current reset button is misleading.

---

## W8-INT-4 — Nit — hanging `onResume` wedges `reconnectInFlight` with no bound and no budget path

**Class** REAL_DEFECT · **Root** CON-05 (newly awaited dep call has no timeout; failure budget is throw-only)

**Evidence**: EXECUTED_REPRO (C3) + SOURCE_PROOF (`OnlineSessionController.ts:459-531`).

Now that `onResume` is awaited, a promise that never settles parks `attemptReconnect` forever: `reconnectInFlight` stays `true`, so every retry-tick call early-returns (`:459`), and the resume-failure budget only counts *throws* — a hang produces neither. Executed: `reconnect` resolves `'resumed'`, `onResume` never settles → `reconnect` called exactly once across 6 retry ticks, state pinned `'reconnecting'` — silent wedging with zero churn, externally indistinguishable from a slow-but-working reconnect.

Unreachable in production today — the shipped `onResume` (App.vue:649-682) is synchronous — but the await made the contract live for any future async resume; same silent-hang class the wave-7 bounded-reopen fix just killed for curtains.

**Fix direction**: bound the `onResume` await (e.g. `withTimeout` + count a timeout as a failed resume), or document the contract: `onResume` must be synchronous-or-bounded.

---

## W8-INT-5 — Low — `isSameRequest` drops a second caller's `behindCurtain` work silently

**Class** REAL_DEFECT · **Root** CON-06 (dedup key narrower than the request's semantic payload)

**Evidence**: EXECUTED_REPRO (E1) + SOURCE_PROOF (`GamePresentationCoordinator.ts:612-619`).

`isSameRequest` compares only `target` and `session`. Two in-flight-compatible requests `{target:'home', behindCurtain:A}` and `{target:'home', behindCurtain:B}` dedup → the second shares the promise, **its `behindCurtain` never runs, and it still resolves `'entered'`** — silently dropped domain work. W7-INT-9 recorded this as "no such caller today"; that is no longer accurate — `exitCombatToHome`'s abandon teardown (`useBattleActions.ts:121`), the error-shell's return-home (`App.vue:393`), and the tribulation outcome drains (`useTribulation.ts:206,235`) all issue `{target:'home', behindCurtain}` requests; an exit-teardown racing an in-flight home drain loses the battle-abandon. For `runAdmitted` callers the drop is additionally safe-but-lucky: the dedup'd twin's command never runs so `accepted` stays null and `compensate` correctly skips — verified in A1.

**Fix direction**: include `behindCurtain` presence/identity in `isSameRequest` (a request carrying domain work should never share a promise whose work differs), or reject/queue the second request instead of sharing.

---

## W8-INT-6 — Nit — abort-during-closing shows the `'failed'` card over a closed curtain; aborted-transition card flash

**Class** REAL_DEFECT · **Root** STA-05 (cosmetic state composition)

**Evidence**: EXECUTED_REPRO (A1, A6).

The catch-path reopen only runs under `request.behindCurtain && curtainClosed` (`:504`). An abort landing while the close is still in flight (`curtainClosed === false` — the `withTimeout` abort rejects before `:334` sets it) skips the reopen entirely → `phase:'failed'` renders the error card over fully closed panels — the black-void backdrop the reopen was built to avoid. Executed in A6 (`curtain.open` called only by the *preempting* transition). Separately, the preempted transition's `'Transition aborted'` record still flashes on the error card for the duration of the error transition's own close (A1); its Retry/Back are dead clicks while the preempting request is in flight (admission-`'rejected'`). Both cosmetic; the bounded-reopen question itself answers clean — the fresh signal is inert-but-harmless and the 2 s bound prevents the W7-INT-3 hang (A5).

**Fix direction**: reopen (or `phase:'failed'` without reopen) under the looser gate `curtainClosed || request.behindCurtain`-independent condition — i.e. also reopen when the abort interrupted a partially-closed curtain that nonetheless settled closed; or accept and document as cosmetic.

---

## W8-INT-7 — Nit — firstSave arm's skipped `markFailed` leaves no terminal when `observeSaveResult` can't route (latent)

**Class** REAL_DEFECT · **Root** STA-05 (premise holds only where `deps.reconnect` exists)

**Evidence**: EXECUTED_REPRO (D4) + SOURCE_PROOF.

The arm skips `markFailed` for `SAVE_INVALID`/`SAVE_TOO_LARGE` on the premise that `observeSaveResult` already routed them to `'recovery'`. Without `deps.reconnect`, `observeSaveResult` early-returns (`:279-283`) — executed: a coded firstSave refuse in local mode arms `saveIssue` + `boot.fail()` while the controller remains `'checking'` (no terminal, no admission mark). Unreachable today on both sides: `LocalCloudSaveService.save()` only ever emits `unavailable retryable:true` with no code, and remote-authoritative composition always binds `reconnect` (verified through `CloudSaveServiceFactory`/`backendBundle`: remote capability requires `status:'ready'` ⇒ `supabaseConfig` non-null ⇒ `runReconnectPipeline` bound). Contract-latent only — flag for any future local-mode coded refuse or a remote-without-reconnect composition.

---

## Seam verdicts (dispatched surfaces)

| Seam | Verdict |
|---|---|
| `aborted` flag ordering (`:493` read before `:499` abort) | CLEAN — pure deadline → `aborted:undefined` (A4-i); deadline+preempt race → `aborted:true` is the honest report (preemption did occur; compensation is the right semantics either way) (A4-ii) |
| `aborted:true` → runAdmitted → forgetSession + compensate | CLEAN for combat (A1: compensate exactly-once, session ended). PARTIAL — tribulation/`handleSessionStarted` uncovered → W8-INT-2 |
| ERR surface on a compensated session / `retry()` re-running the command | CLEAN — `retry()` never re-runs domain work (rejects `behindCurtain` requests, checks `isCurrentSession`); the compensated session is unreachable on a live card: the preempting request is in-flight (retry rejects) and the error transition's step-3 clears `error`; if that transition itself fails its catch overwrites `failedRequest` with the error request. Dispatch's "creates a NEW session" hypothesis falsified |
| scope `'local'` affordances + envelope-less reset | SURFACE-OK / REMEDY-ILLUSORY — correct buttons shown (local reset + import; remote reset correctly gated off), no dead-click (`deleteSave` → `true` on absent keys), but the offered remedy deterministically re-wedges and `raw=''` hides Export → W8-INT-3 |
| bounded catch-path reopen + never-aborted fresh signal | CLEAN — inert `abortPromise` is harmless; 2 s bound lands `'failed'` instead of hanging (A5). Cosmetic rider: reopen is skipped when the abort arrives during closing → W8-INT-6 |
| awaited `onResume` + generation-fenced `markReady`/`markFailed` | CLEAN — parked-resume cannot clobber a deliberate exit (C2) nor a mid-flight `markFailed` (C2b); async rejects count like sync throws (C2c). Latent hang rider → W8-INT-4 |
| `fail()` 'failed' retry loop + unbounded catch paths | CLEAN — each retry is a full transition; loop is bounded (≤10 × ~56 s worst-case deadline chain) and `whenIdle` inherits the now-fully-bounded `inFlightPromise` — no unbounded catch-path wait remains (the reopen was the last one; `renderer.deactivate` is not in the catch path) (B1/B1b) |
| dedup `isSameRequest` vs shared `aborted` | CLEAN for admitters — a second `runAdmitted` is serialized by `isAdmitting`, not dedup'd; a plain dedup'd twin has no `accepted` work to compensate (A1). `behindCurtain`-drop rider → W8-INT-5 |
| firstSave skip-`markFailed` premise (local / no-`reconnect`) | SAFE-BY-UNREACHABILITY — remote boots always bind `reconnect`; local can't emit coded refuses; latent shape → W8-INT-7 |
| `resumeFailureStreak` resets | PARTIAL — `beginChecking`/`acknowledge` resets correct (W7-INT-2 fixed); the new `:517` reset over-reaches onto `'unavailable'` → W8-INT-1 |

## Verification run

- `npm run type-check` (`vue-tsc --build`) on `4f456cfd`: **clean** (the W7-INT-1 red gate is fixed).
- `npx vitest run src/presentation src/services/session src/services/save src/composables`: **89 files / 1244 tests, all pass**.
- `npx vitest run src/presentation/w8int.repro.test.ts` (scratch, uncommitted): **21/21 pass** — A1 aborted→compensate+dedup-twin; A2 tribulation zombie; A3 genuine-fail keeps session + retry() re-mounts; A4 deadline ordering + preempt race; A5 bounded reopen; A6 abort-during-closing; B1/B1b fail() retries 'failed' + 10-attempt breadcrumb; C1/C1-ctrl streak reset on 'unavailable' vs escalation; C2/C2b/C2c generation-fenced markReady/markFailed + async rejects; C3 hanging onResume wedge; D1a-c commit arm vs real controller; D2 deterministic re-arm; D3 firstSave arm vs real controller; D4 local-mode latent gap; E1 dedup drops behindCurtain.
