# Fixpoint QA — Wave 9, INT (adversarial integration)

- **Reviewer**: INT (integration/adversarial)
- **Target**: `codex/hoa-cau-fireball-vfx` @ `9d65d894` (post-wave-8 state)
- **Inputs**: `fixpoint-codex-adjudication.md` (wave-8 dispositions), `git diff 4f456cfd..9d65d894` (whitelist arms + payload export; 'terminal'-only streak reset; local reconnectInFlight; attemptReconnect 'reconnecting' guard; enterTerminal/pause reorder; headless detach on abort; reopen abort; pins), the three w8 reports.
- **Scope attack**: the seven dispatched seams — headless-detach end-to-end (preempt → drain → `start()` + UI event leak during the error surface); attemptReconnect's new `'reconnecting'` guard vs suspend/resume + every post-reorder caller (any path where a skip strands `'reconnecting'`); both arms `'remote'` + whitelist honesty + the SERVER_ERROR generic wedge; pause() reorder heartbeat-vs-retry double-arm; reopen abort timeout teardown (curtain.open impl); enterTerminal ordering vs synchronous `acknowledge()` from `onStateChange`; `DATA_REFUSE_CODES` vs `mapError`/non-RPC producers.
- **Evidence**: EXECUTED_REPRO (three scratch harnesses — `src/presentation/w9int.preempt.test.ts`, `src/services/session/w9int.reorder.test.ts`, `src/composables/w9int.arms.test.ts` — 19/19 pass, REAL coordinator + controller + session + lifecycle; temp files, not committed), EXECUTED_VERIFY (`npm run type-check` clean @ `9d65d894`; scoped vitest `src/presentation src/services/session src/composables/useAppLifecycle.test.ts src/composables/useTribulation src/composables/useBootFlow.test.ts src/components/game/PresentationTransitionOverlay.test.ts src/core/tribulation src/services/save` = 87 files / 1236 tests, all pass incl. the wave-8 pins), SOURCE_PROOF, INFERRED.

## Verdict: PASS WITH EVIDENCE — 0 Medium+; 3 Low + 3 Nit recorded

All six wave-8 fixes verify under execution. The two structural notes that remain are honest-shape issues (the headless drain has no engine in every shipped flow; the SERVER_ERROR wedge is the accepted tradeoff restated), not regressions.

| ID | Severity | Class | Root | Surface |
|---|---|---|---|---|
| W9-INT-1 | Low | REAL_DEFECT | CON-05 | `detach('headless')` works exactly as adjudicated — but every shipped `'error'` producer fires while authority is `'checking'`/terminal, so the tick engine (`canMutate` gate → `tick()` → `TribulationDirector.update` + `checkTribulationOutcomeAction`) is already dead when the surface mounts: the advertised "orphan drains to an outcome, breakthrough un-wedges itself" never executes mid-error in production. The user-visible heal is unchanged from pre-fix (acknowledge → re-admission → `restoreRuntime`→`clear()`). Fix still correct as defense-in-depth; the mechanism claim should be re-scoped |
| W9-INT-2 | Low | REAL_DEFECT | STA-05 | latent two-sided shape if any future producer issues `'error'` while `'ready'`: the headless drain commits the outcome + emits `tribulation_outcome` under the error surface (bus-level EXECUTED — today only the audio cue listens), then the settle's `{target:'home'}` request autonomously tears down the error card and applies realm consequences the user never saw (EXECUTED — the request IS admitted on a committed `'error'` route) |
| W9-INT-3 | Nit | REAL_DEFECT | STA-04 | `beginChecking()` from `'reconnecting'` leaves the armed retry handle behind into `'checking'` — now provably inert under the new state guard (EXECUTED: fires early-returns until `markReady`/`enterTerminal` clears it). Pre-guard this same leak ran the full reconnect RPC mid-boot-admission — the guard closed a real hazard; a symmetric `clearRetry()` in `beginChecking` would tidy the residue |
| W9-INT-4 | Nit | REAL_DEFECT | STA-04 | markReady fan-out throw residue (pre-existing W8-COR-7 class): post-guard the skipped-`clearRetry` retry handle is INERT in `'ready'` — heal now waits for the health lease (≤40 s) via `canMutate`→`pause`→retry→`resumed`, not the 10 s cadence the w8 analysis assumed would re-run `markReady`. Still self-heals (EXECUTED full cycle); strictly less churn than the pre-guard blind re-RPC |
| W9-INT-5 | Nit | REAL_DEFECT | CON-05 | a *retryable* data-class refuse (`unavailable retryable:true` + `SAVE_INVALID`) still lands `'recovery'` terminal via `observeSaveResult` (the `retryable` flag is inspected only for `AUTH_EXPIRED`) but keeps the generic card — terminal authority behind a surface with no reset affordance. Pre-existing mapping, surfaced by the arm audit; coarse but defensible (a refused payload retried byte-identical refuses identically) |
| W9-INT-6 | Low | REAL_DEFECT | CON-05 | the SERVER_ERROR-bucket wedge is confirmed real and exactly as adjudicated: permanent non-data commit refuse → `'checking'` (pause no-ops outside `'ready'`) + generic card, `acknowledge()` inert → every boot deterministically re-wedges with no user-facing escape (EXECUTED). This is the accepted burn-healthy-row tradeoff — restated so the exception stays visible: a genuinely permanent SERVER_ERROR-class refuse has NO self-serve remedy |

---

## W9-INT-1 — Low — headless drain is real but engineless in every shipped error flow; the un-wedge is still the restore path

**Class** REAL_DEFECT · **Root** CON-05 (fix mechanism correct, advertised effect unreachable under shipped wiring)

**Evidence**: EXECUTED_REPRO (`w9int.preempt.test.ts` — both cases) + SOURCE_PROOF (`useAppLifecycle.ts:249` tick gate, `App.vue:896` sole `checkTribulationOutcomeAction` callsite, `useBootFlow.ts:104-111` sole `request({target:'error'})` producer).

Executed end-to-end against the REAL coordinator + PresentationSession + TribulationDirector:

1. `start()` (interactive) → admission `request({target:'tribulation', session})` hung at `'awaiting-ready'` — `update(30)` is a frozen no-op (`secondsRemaining` unchanged): held ⇒ blocking, confirmed live.
2. `request({target:'error'})` preempts → admission lands `{status:'failed', aborted:true}` → session `getMode()==='headless'`, `isBlocking()===false` — the wave-8 detach works precisely.
3. `update()` then drains the run to `commitOutcome` while `currentRoute==='error'`; `tribulation_outcome` fires once, `committedOutcome` stamped.
4. The settle-shaped `{target:'home', behindCurtain: () => { director.clear(); return true }}` request is admitted over the committed error route, lands `'home'`, clears `active` → next `start()` returns `true`. The mechanism chain exists and functions.

**The gap**: no shipped `request({target:'error'})` producer ever runs while authority is `'ready'`. The sole producer is `useBootFlow.fail()`, and every caller's authority state at fire time is `'signed-out'` (`backendFatal`, App.vue:1086), `'checking'` (all boot arms / load failures / `onError` paths inside `bootGame`), or a terminal state (App.vue:677 — `markFailed('recovery')` runs BEFORE `bootFlow.fail()` in the onResume-rejected path). With authority terminal/'checking', `canMutate()` is false → the lifecycle interval never calls `tick()` → `TribulationDirector.update()` never runs → `checkTribulationOutcomeAction` (App.vue:896, the ONLY callsite) never runs → no drain, no settle, no `clear()`. Executed: with the REAL controller in `'recovery'`, the real lifecycle tick interval fires and the tick spy is never invoked.

So in production the orphan persists `active`-until-restore exactly as pre-fix: `acknowledge` → re-auth → `bootGame` → `restoreGameSession` → `restoreRuntime` → `clear()` un-wedges `start()` (verified by code path; unchanged escape). The fix's real deltas are: (a) the detached session no longer permanently holds `isBlocking()` for any non-App driver (tests, tools, future producers) — the permanent hold-zombie class is closed; (b) the leaked held-session resource is released. Worth keeping — but the adjudication note "the orphan drains to an outcome and breakthrough un-wedges itself" describes a mechanism that requires a driver that does not exist while the error surface is up.

**Fix direction** (adjudication): re-scope the claim — the heal is the restore path; headless detach is defense-in-depth for non-canMutate-gated drivers. If autonomous drain under the error surface is ever desired, it needs an engine that does not hang off `canMutate` (e.g. the controller driving `update()` during `'recovery'`) — deliberately NOT recommended here, see W9-INT-2.

---

## W9-INT-2 — Low — latent: an 'error'-while-'ready' producer would drain + apply consequences + tear down its own surface

**Class** REAL_DEFECT · **Root** STA-05 (latent only — no such producer ships today)

**Evidence**: EXECUTED_REPRO (drain emits `tribulation_outcome` while `currentRoute==='error'`; the settle request is admitted and lands `'home'`) + SOURCE_PROOF (`useTribulation.ts:206,235` — `request({target:'home'})` issued unconditionally after settle).

If any future path issues `request({target:'error'})` while authority is `'ready'` (a tick that keeps running), the headless fix makes the drain live mid-error: outcome commits (defeat ⇒ realm unchanged + `cooldownUntil` stamped; victory ⇒ realm consequences apply via `settleOutcome`), `tribulation_outcome` emits into the bus (today's only listener is the audio binding — a stray victory/fail cue under the error card), and the settle half's `{target:'home'}` request is *admitted on the error route* (edge `error→home` exists) — autonomously replacing the error surface while the user is reading it. Both halves executed in the harness.

Unreachable today by the same census as W9-INT-1. Flag so a future `'ready'`-state error producer inherits this shape knowingly — the teardown order (error preempt → domain drain → settle request) silently consumes the surface that was supposed to own the user's attention.

---

## W9-INT-3 — Nit — `beginChecking` leaves the armed retry behind; inert under the guard

**Class** REAL_DEFECT · **Root** STA-04 (cleanup not symmetric across all exits from `'reconnecting'`)

**Evidence**: EXECUTED_REPRO (`w9int.reorder.test.ts` beginChecking case) + SOURCE_PROOF (`OnlineSessionController.ts:195-208` — `beginChecking` bumps generation + resets streak + transitions, but never calls `clearRetry`).

`'reconnecting'` + armed retry → `beginChecking()` (re-auth entry) → `'checking'`: the interval keeps firing → each `attemptReconnect` early-returns on the new `state!=='reconnecting'` guard until `markReady`/`enterTerminal`/`acknowledge`/`stopAll` clears it. Executed: the retry tick fires, `deps.reconnect` is never invoked, the handle dies at `markReady`. Inert and bounded — but worth noting this leak was a *live* hazard pre-guard (the leaked tick would have driven the reconnect pipeline mid-boot-admission), which is positive evidence the wave-8 guard does real work. Tidy = `clearRetry()` inside `beginChecking`.

## W9-INT-4 — Nit — the guard changed the markReady-throw residue's recovery driver (retry-cadence → lease watchdog)

**Class** REAL_DEFECT · **Root** STA-04 (residual shape change, still self-healing)

**Evidence**: EXECUTED_REPRO (full cycle: throw → inert ticks → lease expiry → pause → retry → `resumed` → healed).

A dep throwing inside `markReady`'s `'ready'` fan-out (mid-`attemptReconnect` resume) skips `armHeartbeat`+`clearRetry` → `'ready'` with a dead heartbeat and an armed retry. The w8 analysis noted the leaked retry "re-attempts within reconnectRetryMs → markReady re-runs" — **no longer true**: the new state guard makes that tick early-return forever in `'ready'` (executed — `deps.reconnect` never re-invoked). The heal still exists but the driver moved to the health lease: at expiry `canMutate()`→`pause('health-lease-expired')`→`'reconnecting'`→ the armed retry now runs the pipeline → `resumed`→`markReady`→healed (executed). Net: ≤40 s degraded window instead of ~10 s, and the heartbeat-gap no longer churns a blind re-RPC — arguably a correctness improvement wearing slower recovery. Nit because the trigger is itself a dep-contract violation.

## W9-INT-5 — Nit — retryable data-class refuse ⇒ terminal `'recovery'` + generic card (pre-existing mapping)

**Class** REAL_DEFECT · **Root** CON-05 (retryable flag is read only inside the `AUTH_EXPIRED` early-exit)

**Evidence**: EXECUTED_REPRO (`w9int.arms.test.ts` retryable-SAVE_INVALID case) + SOURCE_PROOF (`OnlineSessionController.ts:287-298`).

`observeSaveResult` maps `SAVE_INVALID`/`SAVE_TOO_LARGE` to `'recovery'` regardless of `retryable` — so a *transiently*-flagged data refuse terminates admission (`enterTerminal` + `onPause('terminal')`) while the lifecycle arm declines the recovery surface (requires `!retryable`) → the user gets the generic error card sitting on a terminal authority. Escape is acknowledge → re-auth → re-boot — which will deterministically reproduce the refuse if the payload is really bad (correct caution) or recover if it was transient (coarse treatment of a retryable signal). Pre-existing mapping — surfaced because the arm now makes the `!retryable` distinction user-visible. Flag for awareness only.

## W9-INT-6 — Low — the accepted SERVER_ERROR wedge, confirmed end-to-end (restatement for the ledger)

**Class** REAL_DEFECT · **Root** CON-05 (deliberate tradeoff — kept visible per protocol)

**Evidence**: EXECUTED_REPRO (real controller + lifecycle) + SOURCE_PROOF.

Commit arm, `SERVER_ERROR retryable:false`: `observeSaveResult` maps `'reconnecting'` → `pause('save-failed')` → **early-return** (state is `'checking'`, not `'ready'`) → authority stays `'checking'`; lifecycle falls to `onError(commit.message)` + `boot.fail()` → generic card. Executed: `authorityState==='checking'`, `acknowledge()` is inert (still `'checking'`). Every subsequent boot: load `'ok'` → accrue → commit → same refuse → identical card — deterministic silent wedge, no Export, no reset. This is exactly the W8-AUT-1 tradeoff adjudication accepted (SERVER_ERROR-bucket refuses can mean COMMITTED_MALFORMED — the write *landed*; remote reset would burn a healthy row). Recording it as Low-with-evidence so the accepted exception stays visible: for a genuinely permanent server-side refuse of this class, **no** self-serve remedy exists — support intervention or a server fix is the only heal. If that ever becomes unacceptable, a bounded auto-retry or a manual "force re-push / abandon accrual" affordance is the design question, not a code change.

---

## Seam verdicts (dispatched surfaces)

| Seam | Verdict |
|---|---|
| headless-detach end-to-end (preempt→drain→`start()`) | CLEAN-MECHANISM / DEAD-IN-PRODUCTION — executed: in-flight preempt detaches `'headless'`, `isBlocking()→false`, `update()` drains, outcome commits, settle request lands + clears, `start()` re-opens. UI-event leak: only the audio cue listens to `tribulation_outcome` — benign. But no shipped producer ever preempts while `'ready'` → the drain has no engine during any real error surface → W9-INT-1; latent producer shape → W9-INT-2 |
| attemptReconnect `'reconnecting'` guard vs suspend/resume | CLEAN — executed: suspend→pause→armed-retry→immediate-attempt; `resumeFromSuspend` re-attempts once; concurrent resume+tick dedup'd by `reconnectInFlight`; no path where a guard-skip strands `'reconnecting'` (the guard can only skip when NOT reconnecting). Bonus: the guard also closes the pre-existing leaked-retry-in-`'checking'` hazard → W9-INT-3 |
| both arms `'remote'` + whitelist honesty + SERVER_ERROR wedge | CLEAN-HONEST — executed vs REAL controller: `SAVE_INVALID`/`SAVE_TOO_LARGE` arm `'remote'`+parseable-payload+`'recovery'` via `observeSaveResult` alone (no double `markFailed`); non-armed classes keep generic. SOURCE_PROOF: the two codes are emitted ONLY by `SupabaseCloudSaveService`'s server-REJECTED map (`:975-979`); `mapError` (`:218-247`) cannot produce them; local save emits no codes — the whitelist cannot arm on a local producer. SERVER_ERROR wedge = accepted tradeoff → W9-INT-6 |
| pause() reorder — heartbeat-vs-retry double-arm | CLEAN — executed: suspend round-trip leaves exactly one armed interval per state; `acknowledge`/`markFailed` inside the `'reconnecting'` fan-out land clean terminal/signed-out with the just-armed retry torn down before it can tick; an `onPause` throw still leaves retry armed → self-heals |
| reopen abort timeout teardown | CLEAN — SOURCE_PROOF: the real curtain (`PresentationTransitionOverlay.animateCurtain:91-103,125-134`) registers a real abort listener whose `cleanup()` removes both `transitionend` listeners + the 600 ms safety timeout; the shipped pin (`PresentationTransitionOverlay.test.ts:68-82`) already asserts abort-rejects. `withTimeout`'s own listener is removed in `finally`; `reopenController.abort()` on timeout now actually fires the curtain's listener instead of leaking — the W8-COR-4 fix is functional, not cosmetic |
| enterTerminal ordering vs sync `acknowledge()` | CLEAN — executed: `acknowledge()` inside the terminal fan-out lands `'signed-out'`; `onPause('terminal')` still fires after (stale `simPaused` is absorbed by the next boot's `startTickLoop`, which does not consult the flag); no cadence survives |
| `DATA_REFUSE_CODES` vs non-RPC producers | CLEAN — SOURCE_PROOF: no producer outside the server REJECTED map can emit the armed codes (see whitelist seam); W8-INT-7's latent local-mode shape remains unreachable (local emits code-less retryable refuses only) |

## Verification run

- `npm run type-check` (`vue-tsc --build`) on `9d65d894`: **clean**.
- `npx vitest run src/presentation src/services/session src/composables/useAppLifecycle.test.ts src/composables/useTribulation src/composables/useBootFlow.test.ts src/components/game/PresentationTransitionOverlay.test.ts src/core/tribulation src/services/save`: **87 files / 1236 tests, all pass** — includes the wave-8 parametric pins (both arms, armed + non-armed, raw non-empty) and the w5 repro pin.
- Scratch harnesses (uncommitted audit evidence): `w9int.preempt.test.ts` 2/2, `w9int.reorder.test.ts` 9/9, `w9int.arms.test.ts` 8/8 — **19/19 pass**.
