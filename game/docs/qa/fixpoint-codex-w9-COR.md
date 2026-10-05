# QA Fixpoint — Wave 9 — COR (correctness) audit

**Delta under audit:** `4f456cfd..9d65d894` — the wave-8 adjudicated fixes
(DATA_REFUSE_CODES positive whitelist + refused-payload `raw` + scope 'remote'
on both boot arms; controller ordering/guards; headless detach on abort;
bounded catch-path reopen; pin updates).

**Method:** fresh clone @ 9d65d894 (detached HEAD), `npm ci` (node 22),
`npm run type-check` clean, `npx vitest run` over touched scopes
(composables/useAppLifecycle.test, services/session, services/save,
services/cloudSave, presentation, core/presentation) = 79 files / 1252 tests
green. Every changed site plus its producers/consumers read end-to-end
(SupabaseCloudSaveService REJECTED map + mapError + ensureIdentityForSave +
journal producers; CloudSaveCoordinator adapterThrow/staleGenerationResult;
SaveSystem buildGameSave/detachSaveValue/exportSaveToFile; recoveryApi
validateRecoveryData; SaveIncompatibleScreen affordances; PresentationSession;
createGamePresentation runAdmitted/compensate; useTribulation outcome drain;
GameManager sessionPort fan-out; server-side REJECTED census in
supabase/migrations). EXECUTED claims backed by a scratch harness
(`src/scratch-w9-cor.repro.test.ts`, 7 cases, run green, deleted — never
committed).

**Verdict: 0 Critical / 0 High / 0 Medium / 1 Low / 2 Nit**

## Verified claims — wave-8 fix ledger

| # | Wave-8 fix | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | `DATA_REFUSE_CODES = {SAVE_INVALID, SAVE_TOO_LARGE}` whitelist replaces the NON_DATA_WEDGE_CODES blacklist on BOTH arms (firstSave :681-696, B1-D commit :558-573) | VERIFIED — coverage complete for today's producers | SOURCE_PROOF + EXECUTED_VERIFY. Server-side refuse census: `rpc_commit_save`'s REJECTED statuses are `SAVE_INVALID` (all `_check_save_payload` detail classes), `SAVE_TOO_LARGE`, `SAVE_SCHEMA_UNSUPPORTED` (→ mapREJECTED folds to `code: 'SAVE_INVALID'`), `NO_CHARACTER`/`CHARACTER_DELETED`/`CHECKPOINT_*`/`CUTOFF_REGRESSION`/`MUTATION_ID_REUSED`/unknown (→ `SERVER_ERROR`). Data-class = exactly the armed pair (schema-unsupported folds INTO `SAVE_INVALID`). Every armed-context producer is honest: COMMITTED_MALFORMED / PENDING_JOURNAL_* / STALE_GENERATION / SAVE_ADAPTER_THROW / uncoded → SERVER_ERROR-bucket or `code: undefined` → correctly unarmed. Auth/transport/protocol codes (NETWORK_UNAVAILABLE, SESSION_REVOKED, AUTH_EXPIRED, PROTOCOL_OUTDATED, MAINTENANCE, CONFIGURATION_ERROR, SAVE_CONFLICT) keep their own surfaces. No genuine data-class wedge can slip to the generic card; no non-data class arms. |
| 2 | Both arms pass `JSON.stringify(buildGameSave(player.$state, gameManager))` as `raw` in try/catch → `''` fallback | VERIFIED | EXECUTED + SOURCE_PROOF. `detachSaveValue` is a pure JSON round-trip clone — no source mutation, Proxy-safe. `buildGameSave` can throw (poisoned/circular state, missing manager) → caught → `raw:''` → Export hidden (`v-if="saveIssue.raw"`), surface still mounts — acceptable degradation. `lastSavedAt: Date.now()` is arm-time, not commit-time — the only honest snapshot available (no ticks run between commit call and arm in either boot path); nondeterminism is cosmetic for a salvage file. Payload size ≈ the refused write's (same builder, same fields, only the timestamp differs); nothing makes it larger in a way that matters — export is a local file, not a server-bound write. |
| 3 | Exported `raw` is importable | VERIFIED | EXECUTED. Scratch: real GameManager + real player store → `validateRecoveryData(JSON.stringify(buildGameSave(...)))` → `{status:'valid'}`. The remote-authoritative import path is validate+re-export only by design (recoveryApi.ts:6-13) — a dead-bytes salvage contract this payload satisfies. |
| 4 | Both arms at scope `'remote'`; conditional markFailed dedup deleted | VERIFIED | SOURCE_PROOF + pins. `remoteResettable = remoteAuthoritative && scope==='remote'` → the armed surface now offers the only real un-wedge (remote reset deletes a character whose writes can never commit) plus a working Export. `observeSaveResult` runs BEFORE the arm gate (:538/:665) and `authorityStateForError` maps both armed codes to 'recovery' → `enterTerminal` already landed → no duplicate markFailed (W7-INT-8 holds). For commit arms during boot, `onPause('terminal')` → `pauseSimulation()` early-returns on `entryStage!=='game'` — no stray sim pause. |
| 5 | `resumeFailureStreak` reset restricted to 'terminal' outcomes; 'unavailable' preserves the count | VERIFIED | SOURCE_PROOF. Streak resets at :524 ('resumed' path) and :545 ('terminal' bookkeeping) only. A deterministic thrower interleaved with 'unavailable' outcomes now accumulates → escalates to 'recovery' after 3 throws (W8-INT-1 closed). |
| 6 | `reconnectInFlight` covers the LOCAL branch (set before branch, finally-cleared) | VERIFIED | EXECUTED. Scratch: resumeFromSuspend burst during a pending `onResume('same')` → `onResume` invoked exactly once; W8-COR-3's double-resume window closed. The flag is set at :480 before the `!deps.reconnect` split and cleared in `finally` on both branches (early `return`s inside the remote branch still clear it). |
| 7 | `attemptReconnect` state-guards to `'reconnecting'` | VERIFIED — see W9-COR-1 for the one regression it introduces | SOURCE_PROOF + EXECUTED. Caller census: pause() transitions first; resumeFromSuspend() self-gates; retry ticks legitimately fire only during 'reconnecting'. Leaked ticks during 'checking'/'signed-out'/terminal now correctly no-op (W8-AUT-3's revival class fully closed — enterTerminal's clearRetry also precedes its fan-out). A retry armed during a boot-time `markFailed('reconnecting')` still proceeds — unchanged. |
| 8 | `enterTerminal` clears heartbeat+retry BEFORE transition/onPause; `pause()` clears heartbeat + arms retry BEFORE transition/onPause | VERIFIED | EXECUTED. Scratch: throwing `onStateChange` inside `pause('suspend')` still leaves state 'reconnecting' + heartbeat cleared + retry armed (the armed tick self-heals — the guard sees 'reconnecting'). Throwing `onStateChange` inside `markFailed('recovery')` → 'recovery' with BOTH timers cleared — no leaked tick can revive a nominal terminal. Dispatch's "heartbeat still armed" hypothesis disproved: `clearHeartbeat` runs at :243 before the fan-out. |
| 9 | Aborted transitions detach `'headless'` (was `'hold'`) | VERIFIED — no double-delivery | EXECUTED + SOURCE_PROOF. `detach(token,'headless')` sets mode=headless/held=false/released=true → `isBlocking()` false → the orphaned domain session drains to its outcome. `end()` still works post-detach (identity match only). Double-detach with the same token is idempotent (generation unchanged). Tribulation-shaped abort: `settleOutcome` is once-only and the drain's 'home' request just retries per tick — the outcome lands on a legitimate surface, not double. Combat-shaped abort: runAdmitted's compensate (`sessionPort.end`) runs synchronously in the same continuation after detach — no tick window for a stray drain. Under an error-route abort the sim is already frozen (entryStage/'ready' gates), so the orphan drains on re-admission/reload — restored via serialized runtime. Non-session aborts (holdToken null) keep the unchanged reopen path. The `aborted` flag is captured at :493 BEFORE the self-`controller.abort()` at :499 — a self-abort cannot taint it. |
| 10 | Catch-path reopen keeps its AbortController and aborts on timeout | VERIFIED | SOURCE_PROOF. `reopenController` is held in scope (:538); `withTimeout` reject → catch → `reopenController.abort()` (:549) — hung `curtain.open` listeners released. Awaited-before-phase-flip preserved → inFlightPromise still settles bounded (W8-COR-4 closed). |
| 11 | Pins: commit-arm parametric (armed×2 / non-armed×3) + w5aut row updates | VERIFIED — with one hollow assertion, W9-COR-2 | EXECUTED_VERIFY. useAppLifecycle.test.ts's stub gained all manager getters (`getAll`×7, `serializeRuntime`, `getJobs`, `getState`, `getSaveState`) so `buildGameSave` succeeds and `raw.length > 0` is real. The w5aut non-arm parametric correctly added SERVER_ERROR + undefined rows. See W9-COR-2 for the firstSave-arm `raw` assertion gap. |

## Findings

### W9-COR-1 — the new `state !== 'reconnecting'` guard swallows the leaked-retry self-heal; a `markReady` mid-fan-out throw now leaves 'ready' with the heartbeat watchdog silently disarmed

**Severity: Low**
**Class:** COR (delta-introduced regression of a documented self-heal; latent trigger, bounded consequence)
**Evidence:** EXECUTED (scratch repro, deleted after run)

**Mechanism.** `markReady()` (:211-216) runs `renewHealthLease()` →
`transition('ready')` → `armHeartbeat()` → `clearRetry()`. A throw inside
`transition`'s `onStateChange` fan-out leaves: state `'ready'`, lease renewed,
heartbeat **unarmed**, the pause-armed retry **still armed**. Under wave 8 the
leaked tick re-ran `attemptReconnect` → `reconnect()` → `onResume` →
`markReady()` again — and the second `transition('ready')` same-state
early-returned (no fan-out, no rethrow), so `armHeartbeat`+`clearRetry`
completed and the watchdog restored within one `reconnectRetryMs` (this is
exactly the self-heal w8-COR-7 documented: "self-heals via the still-armed
retry … the window is ≤ reconnectRetryMs").

Under the delta's guard the leaked tick is a no-op: `attemptReconnect` returns
at :472 (`state !== 'reconnecting'`). The retry interval keeps firing no-ops
forever; the heartbeat watchdog stays disarmed for as long as the lease stays
fresh — and `observeSaveResult('ok')` renews the lease on every save, so a
save-healthy session can run indefinitely with no 30s probe. Recovery only
arrives via (a) 40s of write silence → `canMutate()` → `pause('health-lease-
expired')` → reconnect → healed, or (b) the first write/probe failure — i.e.
the same paths that detect a real authority loss, minus the proactive probe.

**EXECUTED repro:** 'ready' → `pause('suspend')` → deferred `reconnect`
resolved 'resumed' with `onStateChange` throwing on 'ready' → post-throw state
'ready' + zero armed heartbeat timers + retry still armed → firing the retry
tick does NOT call `reconnect` again (call count stays 1). Then `setNow(+41s)`
→ `canMutate()` → 'reconnecting' → tick → `reconnect` called → non-throwing
fan-out → 'ready' + heartbeat armed + retry cleared: the deferred heal works.

**Impact assessment.** The trigger is contract-latent — the shipped
`onStateChange` is a ref assignment + `recordDiagnostic`, which does not throw
— and the consequence self-heals through the lease watchdog (the tick loop
consults `canMutate()` every tick, so the 40s expiry is always detected while
the sim runs). What the delta removes is the *fast* self-heal w8 documented,
and what it leaves is silent: no diagnostic marks the unarmed-heartbeat state.
A deterministic `onStateChange`-on-'ready' thrower would loop
pause→reconnect→markReady-throw forever at ~40s periods — sim running,
probing dead — strictly worse than w8's one-tick heal, but that trigger means
a broken notification dep either way.

**Fix direction.** Reorder inside `markReady`: run `clearRetry()` +
`armHeartbeat()` BEFORE `transition('ready')` (arming before the possibly-
throwing fan-out leaves at most an extra armed retry interval in 'ready',
which is harmless and cleared by the next pause/acknowledge). Alternative:
teach the retry tick to re-arm the watchdog when it sees
`state==='ready' && heartbeatHandle===undefined`.

### W9-COR-2 — Nit: the firstSave-arm `raw` assertion in w5aut.repro.test.ts passes on the degraded empty-payload path

`w5aut.repro.test.ts`'s `makeStubs().gameManager` lacks the manager getters
`buildGameSave` reads (`techniqueManager.getAll`, `skillManager.getAll`,
`materialBag.getAll`, `equipmentBag.getAll`, `pillBag.getAll`,
`equipmentSlotManager.getAll`, `buildingManager.getAll`, `alchemySystem.getJobs`,
`questManager.getState`, `decomposeSystem.getSaveState`,
`tribulationDirector.serializeRuntime`, `productionSystem.getAllStates`).
Inside the arm, `buildGameSave` therefore throws → caught → `refusedPayload=''`
→ `report('corrupted','',undefined,'remote')`. The updated pins assert
`expect.any(String)` — which `''` satisfies — so the pins prove the arm fires
and its scope, but not the export-salvage payload their own comment claims
("The refused payload rides as `raw` for Export salvage"). EXECUTED: driving
the same arm with that stub shape reports `''`. The commit-arm pin does verify
non-empty (its stub gained the getters this wave). **Fix:** give the w5aut
stub the same getter set and assert `raw.length > 0` (or a parsed `version`
field), keeping the arm-vs-degradation distinction real.

### W9-COR-3 — Nit (standing note): whitelist under-coverage is the accepted direction, but the set is now the binding contract for "data-class"

`DATA_REFUSE_CODES` pins today's codes exactly; the dispatch's hypothetical —
a data-class refuse slipping to the generic card — is not reachable from any
current producer (SAVE_SCHEMA_UNSUPPORTED folds to SAVE_INVALID). If a future
migration adds a new data-class REJECTED detail that `mapREJECTED` does not
fold into an existing armed code (or emits a new `BackendErrorCode`), it lands
silently on the generic card — an under-arm, not an over-arm. Worth a comment
link in the migration convention docs, not a code change.

## Notes for adjudication

- No Critical/High/Medium: nothing in the delta regresses a shipped-flow
  path; every verified change is a strict tightening plus one honest-scope
  correction (commit arm 'local'→'remote') whose remedy is real this time.
- W9-COR-1 is the only genuine behavioral regression — a documented
  self-heal became a deferred heal under the new guard — reported at Low
  because the trigger requires a throwing notification dep (contract-latent)
  and recovery still arrives via the lease watchdog.
- The w8-documented `markReady` ordering gap itself is untouched by this
  delta; only the safety net around it changed.
- Surface census confirming the whitelist is complete: armed =
  {SAVE_INVALID (+SAVE_SCHEMA_UNSUPPORTED folded), SAVE_TOO_LARGE}; every
  other `rpc_commit_save` refuse → SERVER_ERROR or uncoded → generic card,
  which is correct: COMMITTED_MALFORMED means the save landed,
  PENDING_JOURNAL_* is a local fault, CHECKPOINT_*/CUTOFF_REGRESSION/
  MUTATION_ID_REUSED are authority rejects the remote reset cannot heal,
  NO_CHARACTER/CHARACTER_DELETED self-heal through boot's recreate path.
- `notifyWriteAck` has no production callers — lease renewal rides on
  `observeSaveResult('ok')` and heartbeat acks only. Pre-existing; it is the
  reason a W9-COR-1 occurrence can persist indefinitely under a save-healthy
  session (writes renew the lease so the expiry heal never fires until the
  session goes idle ~40s or a write fails).
- The firstSave pins' non-arm parametric correctly grew SERVER_ERROR +
  `undefined` rows; the armed parametric correctly dropped them — the w7
  blacklist's over-arm (uncoded faults armed remote reset) is closed.
