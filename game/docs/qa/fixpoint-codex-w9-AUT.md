# Fixpoint audit wave 9 — AUT (authority/lifecycle)

Auditor: w9-AUT worker. Base: `codex/hoa-cau-fireball-vfx` @ `9d65d894`.
Delta under audit: `git diff 4f456cfd..9d65d894` (wave-8 adjudicated fixes —
boot-write arms narrowed to positive set `DATA_REFUSE_CODES =
{SAVE_INVALID, SAVE_TOO_LARGE}` + refused-payload export at scope `'remote'`
on BOTH write paths; `markFailed` dedup removed; `resumeFailureStreak` resets
only on `'terminal'`/`'resumed'`; `reconnectInFlight` covers the local
branch; `attemptReconnect` guards `state !== 'reconnecting'`;
`enterTerminal`/`pause` reorder owned cleanup before dep fan-out; aborted
transitions `detach('headless')`; curtain reopen aborts its own fresh signal
on timeout; pins updated).
Read-only on production code; no live Supabase on this box — RPC-side claims
are SOURCE_PROOF; every client-side candidate below carries an EXECUTED repro
(`src/services/session/w9aut.repro.test.ts`,
`src/presentation/w9aut.repro.test.ts`, `src/composables/w9aut.repro.test.ts`
— scratch harnesses run against the real `OnlineSessionController` /
`GamePresentationCoordinator` + `PresentationSession` / `useAppLifecycle`
with a REAL controller + REAL `GameManager`/`buildGameSave`, not committed as
pins). Report branch: `devin/w9-aut-report`.

Verification executed:
- `npx vitest run src/services/session src/services/cloudSave src/composables
  src/presentation` — 68 files / 623 tests green (incl. the three w9 repro
  harnesses: 18 repro tests, all passing).
- Full read of `OnlineSessionController` (:1-561 — `pause` :235-250,
  `observeSaveResult` :271-298, `markFailed` :221-229, `enterTerminal`
  :368-383, `armRetry`/`clearRetry` :448-463, `attemptReconnect` :465-560),
  `useAppLifecycle` both arm gates (commit :538-581, firstSave :664-704) +
  `DATA_REFUSE_CODES` :39-55 + every `loaded.status` branch :402-448,
  `SupabaseCloudSaveService.save` producers (:791-993 — `ensureIdentityForSave`
  :470-500, journal.put :864-872, REJECTED map :974-988 incl.
  `SAVE_SCHEMA_UNSUPPORTED → SAVE_INVALID` :975-977, unknown status :992) +
  `mapError` (:218-246), `CloudSaveCoordinator` `adapterThrow`/
  `staleGenerationResult` (:14-30), `LocalCloudSaveService` (only
  `retryable:true` unavailables), `SaveIncompatibleScreen.vue`
  (`remoteResettable` :32, Export gate :163, uncaught `resetCharacter` :78),
  `saveIssue` store, `useBootFlow.fail` (:104-111), `GamePresentationCoordinator`
  (request preempt :208-231, executeTransition :286-569, catch/headless
  :487-569, reopen abort :538-552, `isUnchanged`/`isSameRequest`
  :591-626, `withTimeout` :639-671), `createGamePresentation.runAdmitted`
  (:95-180), `PresentationSession` (`begin`/`hold`/`detach`/`end`/
  `isBlocking` :93-192), `useTribulation.checkTribulationOutcomeAction`
  (:136-245), `App.vue` (authority dep wiring :534-540, `onStateChange`
  :683-693 non-throwing, `isBooted` gate :994/:1183/:1240/:1249,
  `void bootGame` :1049 — uncaught).
- Wave-8 adjudication + the three w8 reports read first, per dispatch.

---

## Verdict: PASS WITH EVIDENCE (0 Critical / 0 High / 0 Medium / 1 Low / 3 Nit)

All eight wave-8 fix items hold under attack; no confirmed Medium-or-higher
finding remains. The whitelist is complete in BOTH directions: every producer
of `unavailable && !retryable` either lands in `DATA_REFUSE_CODES` (the only
classes where remote destruction is the honest remedy) or routes to its own
terminal / the generic card where reset cannot heal. Low/Nit findings below
are adjudication inputs, not blockers.

| ID | Severity | Class | Surface |
|---|---|---|---|
| W9-AUT-1 | Low | test-evidence gap | `src/services/save/w5aut.repro.test.ts` armed firstSave pins assert `expect.any(String)` for the refused `raw`, but the file's stub `gameManager` lacks every `buildGameSave` getter → the export throws → `raw` is always `''` → the pins PASS on the degraded path and cannot detect a regression that hides Export. The shipped `useAppLifecycle.test.ts` commit-arm pins do have full getters + `raw.length > 0` (:1187-1188); the firstSave arm has no shipped-file pin asserting non-empty `raw`. (My w9 harness verifies the real behavior end-to-end.) |
| W9-AUT-2 | Nit | uncaught dep-fanout at boot arm sites | `authority.observeSaveResult` (:538, :665) and `authority.markFailed` (:403/:419/:436/:479) run inside `bootGame`'s try with NO catch — a throwing `onStateChange`/`onPause` dep propagates out of `bootGame` into `App.vue`'s `void bootGame()` (:1049) → unhandled rejection, boot parked at `startInitializing` with no error surface. Pre-existing propagation class (enterTerminal always propagated; the delta only made cleanup atomic — net improvement). Shipped deps are non-throwing → unreachable today. |
| W9-AUT-3 | Nit | AUTH_EXPIRED asymmetry cluster (pre-existing) | save-path `unavailable+AUTH_EXPIRED+!retryable` → `'revoked'` terminal (observeSaveResult :287-291), but the same code via `markFailed(loaded.code)` on a load 'unavailable' → `authorityStateForError` default → `'reconnecting'` (:221-227); and `markFailed`'s non-terminal path can regress a live `'revoked'` back to `'reconnecting'` on a boot retry (terminal-inequality guard exists only in `beginChecking`/`observeSaveResult`, not `markFailed`). Both exits flow through `acknowledge()` (:340-349 accepts `'reconnecting'` + terminals), and the overlay is `isBooted`-gated anyway → no user-visible wedge. Unchanged by the delta. |
| W9-AUT-4 | Low (hypothesis — flagged, not confirmed) | residual wedge class | A *persistent server-side* refuse in the `SERVER_ERROR` bucket (e.g. a poisoned remote checkpoint producing `CHECKPOINT_*` rejects that a fresh authoritative load cannot heal) stays unarmed → generic card retries forever where remote reset would be the only heal. No producer deterministically derives this client-side — every enumerated `SERVER_ERROR` class self-heals (fresh load, `empty`→creation, journal-local fault, or already-landed write). Recorded as the conscious tail-risk the whitelist accepts, not a confirmed defect. |

---

## Attack-surface verdicts (dispatch checklist)

### 1. Whitelist completeness — BOTH directions — VERIFIED (SOURCE_PROOF enumeration + EXECUTED spot-checks)

`DATA_REFUSE_CODES = {SAVE_INVALID, SAVE_TOO_LARGE}` (useAppLifecycle :42-55;
gates identical at :558-563 and :681-686 — `status==='unavailable' &&
!retryable && code && DATA_REFUSE_CODES.has(code)`). Producer enumeration of
every `unavailable+!retryable` write-path outcome in
`SupabaseCloudSaveService.save` + `ensureIdentityForSave` +
`CloudSaveCoordinator`:

| Producer | code | Arm? | Verdict |
|---|---|---|---|
| no binding (:796) / identity load stale-gen (:488) | `AUTH_EXPIRED` / `SESSION_REVOKED` | no | own terminal `'revoked'` — re-auth remedy, correct |
| heartbeat re-anchor failure | `mapError` codes | no | transient/`'revoked'` — correct |
| no checkpoint after heartbeat (:824) / `CHARACTER_DELETED` (:982) | `SERVER_ERROR` (`NO_CHARACTER` detail) | no | heals via next load `'empty'`/`'deleted'` → creation flow — correct |
| mid-save generation bump (:840) | `SERVER_ERROR` (`STALE_GENERATION`) | no | reset/logout drop — unreachable at single-boot scope — correct |
| journal put failure (:864-872) | `SERVER_ERROR` (`PENDING_JOURNAL_*`) | no | LOCAL storage fault — remote reset cannot heal — honest |
| COMMITTED with malformed revision (:902) | `SERVER_ERROR` (`COMMITTED_MALFORMED`) | no | **save already landed** — armed reset would burn a healthy row — correct exclusion |
| REJECTED `SAVE_INVALID` / `SAVE_SCHEMA_UNSUPPORTED` (:975-977) | `SAVE_INVALID` | **yes** | **VERIFIED: schema refuses still arm via the mapping** |
| REJECTED `SAVE_TOO_LARGE` (:978-979) | `SAVE_TOO_LARGE` | **yes** | intended |
| REJECTED default (`CHECKPOINT_*`, `CUTOFF_REGRESSION`, `MUTATION_ID_REUSED`) (:983-988) | `SERVER_ERROR` | no | heal = fresh authoritative load — correct (see W9-AUT-4 for the speculative persistent tail) |
| unknown RPC status (:992) | `SERVER_ERROR` | no | contract drift — reset cannot heal — honest |
| `adapterThrow` (:14-21), `staleGenerationResult` (:23-30) | **uncoded** | no | client fault — EXECUTED stays `'checking'` + generic card (see below) |
| status `'conflict'` (:958-966) | n/a | no | routes `'conflict'` terminal — remote reset would destroy the OTHER device's winning save — correct exclusion |
| Local service | none exist | — | `LocalCloudSaveService` only emits `retryable:true` unavailables → arm unreachable locally; `observeSaveResult` early-returns without `deps.reconnect` — consistent |

**Uncoded `adapterThrow` on firstSave → generic card: honest, and strictly
better than the pre-fix behavior.** The throw is client-side
(serialization/journal fault); remote reset could not heal it either, so the
generic card's retry is the only honest surface. Under the wave-8 blacklist
the same throw armed `'remote'` and burned a fresh character per boot while
still wedging. EXECUTED (`w9aut.repro.test.ts` in composables): uncoded
`{unavailable, retryable:false, detail:'SAVE_ADAPTER_THROW'}` → no arm, no
`saveIssue.report`, single `onError`+`boot.fail`, authority stays
`'checking'` (see #3 note on why `'checking'` not `'reconnecting'`).

### 2. Refused-payload export on the firstSave arm — VERIFIED (EXECUTED)

At arm time the state IS the just-granted starter — and it serializes:
boot harness with a REAL `GameManager` + starter-granted `player.$state`
(mortal skill + spell initiation + realm node) → `SAVE_INVALID` refuse →
`saveIssue.report('corrupted', raw, undefined, 'remote')` where `raw`
deep-equals `JSON.stringify(buildGameSave(player, gameManager))` modulo the
`Date.now()` `lastSavedAt` stamp — ~8 KB of real payload, `JSON.parse` clean.
(Note: `buildGameSave` provably already ran inside `player.save()` for the
refuse verdict to exist — `stores/player.ts:253` calls it before the write —
so a fresh throw at arm time would itself be a regression.) The `catch → ''`
degradation hides only the Export button (`v-if="saveIssue.raw"` :163); the
remote-reset surface still mounts — acceptable by design. Companion evidence
gap recorded as W9-AUT-1.

### 3. AUTH_EXPIRED ordering — VERIFIED (EXECUTED, no double surface)

`observeSaveResult` runs BEFORE the arm gate at both sites (:538 commit,
:665 firstSave). EXECUTED: firstSave `AUTH_EXPIRED,!retryable` → controller
lands `'revoked'` exactly once (single `onStateChange('revoked')`), arm never
fires (code not in the data-class set), `saveIssue.report` never called,
generic card once. No `'revoked'` terminal + arm stack. Additionally the
authority overlay is `isBooted`-gated in App.vue (:1240/:1249) — during boot
it is suppressed regardless.

Adjacent semantics worth noting (not defects): `pause()` is gated to
`'ready'` (:236-238) → a mapped-`'reconnecting'` save result during boot is a
NO-OP (`checking` retained — EXECUTED); `markFailed` has its own
`'reconnecting'` bookkeeping path with no cadence, by design (:218-227);
`enterTerminal` re-entry on the same state is naturally idempotent
(`transition` early-returns :361-362) — the removed markFailed dedup is safe.

### 4. `resumeFailureStreak` 'terminal'-only reset — VERIFIED (EXECUTED)

- Throw-heavy run interleaved with `'unavailable'` outcomes (T,U,T,U,T) →
  escalates to `'recovery'` at `RESUME_FAILURE_BUDGET` = 3 — the streak is
  NOT reset by `'unavailable'` anymore (:548 comment).
- `'unavailable'`-only run ×12 → stays `'reconnecting'` forever — transport
  outage retries forever, correct.
- `'resumed'` after throws → streak reset → `markReady` → `'ready'`.
- `'terminal'` → `resumeFailureStreak = 0` + `enterTerminal(outcome.state)`
  (:536-546) — bookkeeping reset + owned exit.

### 5. `enterTerminal` ordering — VERIFIED (EXECUTED)

New order :372-382: `generation++ → clearHeartbeat → clearRetry →
transition → onPause`. EXECUTED with a throwing `onStateChange('recovery')`:
`markFailed('recovery')` propagates the throw AND post-throw state is already
terminal with heartbeat+retry cleared (`handles.size === 0`); the leaked
retry tick captured before the clear runs `attemptReconnect` and is stopped
by the `state !== 'reconnecting'` guard (:472) before it touches the
reconnect dep (`reconnect` call count stays 1 — the single call being
`pause()`'s own immediate attempt, generation-fenced); no revival to
`'ready'`; `acknowledge()` still exits cleanly. No caller catches the
propagation mid-flight: `heartbeatTick`'s catch self-fences by generation
+ `pause` no-ops on non-'ready'; `bootGame` has `finally` only (see W9-AUT-2).

### 6. `pause()` ordering + local-mode non-stranding — VERIFIED (EXECUTED)

New order :239-249: `generation++ → clearHeartbeat → armRetry → transition →
onPause → void attemptReconnect()`. `armRetry` runs while `state === 'ready'`
— safe: the scheduled tick cannot interleave the synchronous section
(single-threaded; the callback fires a future `attemptReconnect` which
re-reads state). EXECUTED: throwing `onStateChange('reconnecting')` or
throwing `onPause` propagates out of `pause()` while the retry interval is
already armed → the next tick still drives `deps.reconnect` → cadence
survives the fan-out throw. Local mode (no `deps.reconnect`): `armRetry`
no-ops (:449) AND the immediate attempt is skipped (:247 guard) →
`'reconnecting'` waits for `resumeFromSuspend()` → local branch
`onResume → markReady` → `'ready'` — EXECUTED, not stranded (the only
local-mode entry to `'reconnecting'` is `suspend()`, and its owned exit is
`resumeFromSuspend` — symmetric).

### 7. `reconnectInFlight` covers the local branch — VERIFIED (EXECUTED)

`reconnectInFlight = true` now sets BEFORE the local/remote split (:480);
two rapid `resumeFromSuspend()` calls while a pending `onResume` awaits →
`onResume` invoked exactly once. The flag resets in `finally` on both
branches — no permanent lockout on a throwing resume (the streak budget
owns that escalation instead, W8-INT-1).

### 8. Aborted transitions detach 'headless' — VERIFIED (EXECUTED)

Real `GamePresentationCoordinator` + `PresentationSession`: tribulation-
shaped `runAdmitted` parked at `assets.ensureFor`, preempted by
`request({target:'error'})` → run lands `{failed, aborted:true}` → catch
detaches `holdToken` with `'headless'` (:506-507) → `getMode() ===
'headless'`, `isBlocking() === false` → the orphan's domain drain
(`TribulationDirector.update` gate :344) is open. No double-release: the
coordinator detaches the token once and keeps no live reference (a second
`detach` on the same token is an idempotent no-op, EXECUTED); `retry()`
rejects because the error transition's own step-3 clear dropped the
failed-request record (`error === null` post-entry). Combat-shaped control
with `compensate` → fires exactly once and ends the session — the W7-COR-3
contract holds under the new policy.

**Headless drain → UI double-event: no.** SOURCE_PROOF: `commitOutcome` is a
once-only domain commit; `checkTribulationOutcomeAction`'s `settleOutcome`
re-settles the SAME bound receipt idempotently (:160-165 comment) and issues
`request({target:'home', behindCurtain: consumeReceipt})` — `'error'→'home'`
is an ALLOWED edge (:50), so the drain navigates home and shows the single
outcome announcement there; the error card is displaced by design (the
committed domain outcome is the truth the abort orphaned). One commit → one
receipt → one drain → one announcement; `director.clear()` runs only inside
the curtain.

**Reopen timeout aborts its own signal — VERIFIED (EXECUTED):** behindCurtain
reject → catch enters the reopen branch → `curtain.open` with the fresh
`reopenController.signal` hangs → `DEADLINES.curtainOpen` fires → the
catch-path `reopenController.abort()` (:549) runs — captured signal
`aborted === true`, transition settles `'failed'`, no wedge.

### 9. Boot arm gates + post-reset boot — VERIFIED (EXECUTED + SOURCE_PROOF)

The arms live in the `'ok'` commit path and the else-branch grant path —
which covers MORE than `'uninitialized'`: `'empty' + createNewCharacter` is
the same path. EXECUTED: remote-authoritative `'empty'` load +
`createNewCharacter: true` → grant path → `SAVE_INVALID` first save → arm
fires at scope `'remote'`, single `'recovery'`. Post-reset boot sequence:
`reset_character` → next load `'deleted'` → `requireCharacter` → creation →
`bootGame(true)` → same grant path + arm — full coverage, no dead-end.
`'empty' && !createNewCharacter` → `requireCharacter` (:445) → the creation
flow reaches the same path. Local-mode `'empty' + createNewCharacter` runs
`coordinator.reset()` + synthetic empty (:388-389) — arm unreachable locally
(local producers can't emit coded `!retryable`), correct.

---

## Findings detail

### W9-AUT-1 (Low) — committed scratch pins cannot detect the degraded-export regression on the firstSave arm

`src/services/save/w5aut.repro.test.ts` :440-489 — the armed firstSave pins
(`SAVE_INVALID`/`SAVE_TOO_LARGE` → `expect.any(String)` for `raw`) run against
the file's `makeStubs` `gameManager` (:267-279), which lacks
`techniqueManager`/`skillManager`/`materialBag.getAll`/`equipmentBag`/
`pillBag`/`buildingManager.getAll`/`equipmentSlotManager`/`alchemySystem`/
`questManager`/`decomposeSystem`/`tribulationDirector` — every getter
`buildGameSave` calls. So `buildGameSave(player.$state, gameManager)` throws
at the first getter → the arm's catch yields `refusedPayload = ''` →
`expect.any(String)` still passes. SOURCE_PROOF + EXECUTED context: the pins
verify the gate fires but are blind to the wave-8 payload-export feature
regressing to the empty/degraded path (Export hidden). The shipped
`useAppLifecycle.test.ts` makeStubs DO carry the full getter set (:87-100)
and assert `raw.length > 0` for the COMMIT arm (:1187-1188) — the firstSave
arm has no shipped-file equivalent; its only pin coverage is this
unfalsifiable scratch pin. Severity Low: test-evidence gap only — the real
behavior is verified non-empty by the w9 harness; no product defect.

### W9-AUT-2 (Nit) — dep-fanout throws at the boot arm/terminal sites escape `bootGame` uncaught

`authority.observeSaveResult(commit)` (:538) / `observeSaveResult(firstSave)`
(:665) / `authority.markFailed(...)` (:403, :419, :436, :479) run inside
`bootGame`'s `try` which has only a `finally` (:727-730) — a throwing
`onStateChange`/`onPause` (dep-injected) propagates to `App.vue`'s
`await lifecycle.bootGame` (:933) inside `void bootGame(false)` (:1049) →
unhandled rejection, boot parked at `startInitializing`/LoadingScreen, no
error surface. The delta deliberately made this propagation CLEANER (cleanup
now precedes the fan-out — the throw leaves a coherent terminal); the
propagation itself is a pre-existing class (same as W7-AUT-4's floated
rejections). Shipped `onStateChange`/`onPause` are non-throwing
(App.vue :647/:683-693) → unreachable in production → Nit.

### W9-AUT-3 (Nit) — AUTH_EXPIRED / terminal-regression asymmetry (pre-existing)

`observeSaveResult` special-cases `AUTH_EXPIRED+!retryable` → `'revoked'`
(:287-291), but the same code arriving via `markFailed(loaded.code)` on a
load `'unavailable'` → `authorityStateForError` default → `'reconnecting'`
(:221-227). Follow-on: a boot retry after a `'revoked'` first-save — where
`beginChecking` correctly early-returns on the terminal (:199) — re-hits a
failing load → `markFailed('AUTH_EXPIRED')` → the non-terminal branch
transitions `'revoked' → 'reconnecting'`, regressing the owned terminal
(only `enterTerminal` guards targets; `markFailed`'s transient path has no
terminal-source guard). No user-visible wedge at boot: the overlay is
`isBooted`-gated and `acknowledge()` accepts `'reconnecting'` anyway —
semantic drift only, unchanged by the delta → Nit.

### W9-AUT-4 (Low, hypothesis — flagged, not confirmed) — the persistent-server-refuse tail the whitelist cannot arm

Every enumerated `SERVER_ERROR`-bucket producer self-heals: `NO_CHARACTER`/
`CHARACTER_DELETED` → next load `'empty'`/`'deleted'` → recreation;
`CHECKPOINT_*`/`CUTOFF_REGRESSION`/`MUTATION_ID_REUSED` → next load re-anchors
checkpoint/cutoff; `PENDING_JOURNAL_*` → local fix; `COMMITTED_MALFORMED` →
the write already landed. The residual: a server-side authority state
persistently rejecting with `CHECKPOINT_*`/`CUTOFF_REGRESSION` that NO fresh
load can heal (e.g. a poisoned remote checkpoint) would wedge the account
unarmed — generic card retries forever — where `resetCharacter` is the only
heal. Unconfirmed: no client-side producer deterministically re-derives it;
it requires server-row corruption outside any observed flow. Recorded as the
whitelist's conscious tail-risk for the adjudicator; if the class is judged
real, the arm would need a `detail`-keyed second set rather than the `code`
set — deliberately NOT recommended for implementation from a hypothesis.

---

## Negative results — attacked and held

- **Whitelist over-coverage closed.** The w8 SERVER_ERROR/uncoded arm classes
  are all unarmed now; every armed class is a data-class refuse where
  remote reset is the only heal. EXECUTED: armed codes single-terminal
  `'recovery'` + scope-`'remote'` report on BOTH boot write paths.
- **No double surface on AUTH_EXPIRED.** EXECUTED once-`'revoked'` + arm
  never fires; overlay `isBooted`-gated during boot regardless.
- **No revival through a leaked tick.** EXECUTED: `attemptReconnect`'s state
  guard + `reconnectInFlight` + generation fence hold under a throwing
  fan-out AND a pending in-flight attempt.
- **`markFailed` dedup removal is safe**: `enterTerminal` on an already-equal
  terminal early-returns inside `transition` — re-entrant markFailed is
  idempotent without the dedup.
- **No orphaned sessions / double-release.** EXECUTED: aborted session
  detaches 'headless', drains, and the coordinator holds nothing to
  double-release; `retry()` cannot resurrect it; combat compensate fires
  exactly once.
- **Reopen listener leak closed.** EXECUTED: hung reopen's fresh signal is
  aborted on deadline.
- **Local mode consistent:** arm unreachable; `observeSaveResult`
  early-returns; suspend→resume round-trips once.
- **`SAVE_SCHEMA_UNSUPPORTED` still arms** via the `SAVE_INVALID` map
  (:975-977) — VERIFIED.

## Residual / out-of-scope notes (pre-existing, unchanged by the delta)

- `SaveIncompatibleScreen.handleReset` `await
  cloudSaveCoordinator.resetCharacter()` (:78) uncaught — carried since w7,
  already on record (w8-AUT residuals).
- `MAINTENANCE`-class mapError → `SERVER_ERROR` taxonomy gap — carried since
  w6.
- Scratch repro files `w9aut.repro.test.ts` (×3) are audit evidence, not
  shipped pins — left uncommitted per wave convention.
