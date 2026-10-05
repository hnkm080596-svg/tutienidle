# Fixpoint audit wave 7 — AUT (authority/lifecycle)

Auditor: w7-AUT worker. Base: `codex/hoa-cau-fireball-vfx` @ `cc4a51e7`.
Delta under audit: `git diff 1bd0763f..cc4a51e7` (wave-6 adjudicated fixes —
5 production files + migration `202610070002` + repro/pin harnesses).
Read-only on production code; no live Supabase on this box — SQL-side claims
are SOURCE_PROOF; every client-side candidate below carries an EXECUTED repro
(`src/services/session/w7aut.repro.test.ts`,
`src/composables/w7aut-fail.repro.test.ts` — scratch harnesses, run against the
real `OnlineSessionController` / `GamePresentationCoordinator`, not committed
as pins). Report branch: `devin/w7-aut-report`.

Verification executed:
- `npx vitest run src/services/session src/services/cloudSave src/composables
  src/presentation` — 602/603 green; the one failure is this audit's own
  negative-result probe (test D, see Negative results).
- Full read of `OnlineSessionController` (all 519 lines), the reconnect
  pipeline, `GamePresentationCoordinator` (preempt :213-225, failure catch
  :484-545, dispose :271-281), `useAppLifecycle` first-save gate (:596-644),
  `useBootFlow.fail()` (:97-110), `CloudSaveCoordinator.resetCharacter`
  (:87-95) + `adapterThrow`/`staleGenerationResult` (:14-30),
  `SupabaseCloudSaveService` (`mapError` :218-247, `ensureIdentityForSave`
  :470-505, REJECTED map :968-988, `resetCharacter` :533-550), migration
  `202610070002`, `SaveIncompatibleScreen.vue` (reset gate + Export gating),
  and `App.vue` deps binding (:611-682).
- Wave-6 adjudication + the three w6 reports read first, per dispatch.

---

## Verdict: FINDINGS (1 Medium / 5 Low / 2 Nit)

| ID | Severity | Class | Surface |
|---|---|---|---|
| W7-AUT-1 | Medium | authority / arm under-coverage | `useAppLifecycle` firstSave gate: non-RPC refuses (`SERVER_ERROR !retryable` from HTTP-4xx, NO_CHARACTER/CHARACTER_DELETED, unknown statuses) skip the arm → permanent generic boot wedge, save-issue surface never offered |
| W7-AUT-2 | Low | lifecycle / stale counter | `resumeFailureStreak` survives `acknowledge()`/`stopAll()`/`beginChecking()` → a fresh admission escalates to 'recovery' on its FIRST throw (EXECUTED) |
| W7-AUT-3 | Low | lifecycle / missing generation gate | catch-path `markFailed('recovery')` escalates unconditionally → clobbers a deliberate exit or a finer terminal set inside `onResume` (EXECUTED, local mode; remote incidentally safe) |
| W7-AUT-4 | Low | lifecycle / leaked rejection | local-mode `attemptReconnect` still lets `markReady`/`markFailed` deps-callback throws escape the floated promise as unhandled rejections — the W6-AUT-2 class, narrowed not closed (EXECUTED) |
| W7-AUT-5 | Low | lifecycle / dead observability | `fail()` bound-10 + breadcrumb unreachable on the one starvation path left: a hung `inFlightPromise` parks attempt-0's preempt-await forever (EXECUTED; intersects excepted W6-COR-5) |
| W7-AUT-6 | Low | sibling hole | a deterministically throwing `deps.reconnect()` churns the full RPC chain every retry tick forever — the budget covers `onResume` throws only (EXECUTED) |
| W7-AUT-7 | Nit | redundant transition | arm's `markFailed('recovery')` is a second `enterTerminal('recovery')` — `observeSaveResult` already landed there for both armed codes |
| W7-AUT-8 | Nit | stale comment | local-branch comment cites "let the retry cadence fire again" — local mode has no retry cadence (`armRetry` early-returns without `deps.reconnect`) |

---

## Findings

### W7-AUT-1 (Medium) — firstSave arm under-coverage: a real payload refuse can arrive under `SERVER_ERROR` and skip the arm

`useAppLifecycle.ts:627-630` — the wave-6 arm gates on
`firstSave.status === 'unavailable' && !firstSave.retryable &&
(code === 'SAVE_INVALID' || code === 'SAVE_TOO_LARGE')`. That covers the
RPC-status refuses (`save()` :968-988 maps `REJECTED` `SAVE_INVALID` +
`SAVE_SCHEMA_UNSUPPORTED` → `SAVE_INVALID`, `SAVE_TOO_LARGE` → `SAVE_TOO_LARGE`,
all `retryable:false` — verified). But three other permanent-refuse classes
land as `SERVER_ERROR, retryable:false` and slide past the gate into the
generic path (`onError(firstSave.message)` + `boot.fail()`, :637-643):

- **HTTP-layer refuse** (`mapError` :240): any PostgREST 4xx that never
  reaches the RPC's own status protocol — malformed-envelope 400s during
  version skew, or an oversized-body 413. This is the literal sibling of the
  armed class: the server refused the *request* (payload), deterministically,
  forever — but the mapped code is `SERVER_ERROR`, not `SAVE_TOO_LARGE`.
  `CHARACTER_UNINITIALIZED` boots carrying a large local snapshot are the
  realistic trigger. Every boot re-lands the same refuse → permanent wedge on
  the generic error surface; the save-issue surface (with the remote-reset
  remedy that would actually fix it) is never offered.
- **`NO_CHARACTER` / `CHARACTER_DELETED`** (`ensureIdentityForSave` :498-500,
  REJECTED map :980-982 — both `SERVER_ERROR !retryable`): the row vanished
  between load and first write. Consequence is weaker: next boot's load
  returns 'empty'/'deleted' → creation → self-heals — one wasted cycle on the
  wrong surface.
- **Unrecognized RPC status** (:992 → `SERVER_ERROR !retryable`) — forward-compat
  hole: any future server refuse code defaults here, silently unarmed.

The gate's own comment (:617-626) explains why the arm is deliberately narrow —
"arming remote destruction there would offer the wrong remedy on a healthy
account" — citing `CHECKPOINT_*`/`CUTOFF_REGRESSION`/`MUTATION_ID_REUSED` as
the feared false-positives. That fear does not apply on the first-write gate:
a revision-0 first save cannot regress a cutoff, reuse a mutation id, or hold
a stale checkpoint — those rejects cannot fire here. The actionable residue is
that `SERVER_ERROR !retryable` conflates "server refused the request" (payload
fault — remedy applies) with "server rejected the mutation" (authority fault —
fresh load is the remedy), and the gate cannot tell them apart. A dedicated
code (e.g. `REQUEST_REFUSED`) for the HTTP-layer/identity-missing classes — or
arming on `detail` — would close the hole without re-opening W6-AUT-1.

Severity reasoning: the trigger is narrower than W6-COR-3's RPC refuse, but
the wedge class is identical (permanent boot failure, wrong surface, remedy
exists and is never offered).

### W7-AUT-2 (Low) — `resumeFailureStreak` bleeds across admissions; a fresh session escalates on its first throw

`OnlineSessionController.ts:154` — `resumeFailureStreak` is reset only by a
successful `onResume` (:473, :503). Nothing else clears it: `acknowledge()`
(:331-339), `stopAll()` (:343-348), `beginChecking()` (:192-202),
`enterTerminal` (:358-368). EXECUTED (w7aut.repro.test.ts test A): two
throwing resumes in admission 1 (streak 2) → `acknowledge()` → re-login →
`beginChecking` → `markReady` → suspend → ONE throw → `markFailed('recovery')`
fires immediately. The "3 consecutive throws" budget is measured across
admissions, not within one.

Consequence: a new admission escalates to the recovery surface after 1–2
faults instead of 3. For a deterministic thrower the destination is identical;
the deviation is a fresh session losing its retry budget to a prior session's
faults. Low.

Fix direction (not applied — audit only): reset the streak in `beginChecking`
(new admission) or in `acknowledge`/`stopAll` (deliberate teardown).

### W7-AUT-3 (Low) — catch-path `markFailed('recovery')` ignores the generation fence the success path applies

`OnlineSessionController.ts:466-472` (local) and :496-502 (remote) — the
success path guards `markReady` behind `generation === this.generation`
(:474, :504) precisely so an `onResume` that invalidated admission wins
(markFailed inside onResume bumps the generation; `acknowledge()` does too).
The catch path applies no such check: at streak ≥ 3 it calls
`markFailed('recovery')` unconditionally. So an `onResume` that deliberately
parked the session — `markFailed('SESSION_REVOKED')` → 'revoked', or
`acknowledge()` → 'signed-out' — and *then* threw is dragged back out to
'recovery' on the third strike. `enterTerminal` has no terminal-sticky guard
(:358-368), so 'recovery' overwrites 'revoked' — the same clobber class
W6-COR-3 fixed one seam over.

EXECUTED (test C, local mode): 'revoked' → 'recovery' confirmed on the third
strike. Remote mode is incidentally safe: `enterTerminal` clears the retry
cadence (:365), so the streak can't advance after the first park (test D —
verified negative: 'revoked' stands through 2 extra ticks).

No current caller hits this — App's `onResume` only calls
`markFailed('recovery')` and never throws after it. Contract-latent. Low.

### W7-AUT-4 (Low) — local-mode `attemptReconnect` still leaks deps-callback throws out of the floated promise

W6-AUT-2 wrapped `onResume` in a try (:464-466) but left the rest of the
local branch naked: `markReady()` (:475) and the escalation's own
`markFailed('recovery')` (:469) run outside it. `markReady` calls
`transition('ready')` → `deps.onStateChange?.('ready')` (:355); `enterTerminal`
calls `deps.onPause?.('terminal')` (:368). A throw in either propagates out of
`attemptReconnect` → `void`-floated at :256 → unhandled rejection — the exact
class W6-AUT-2 was filed on, narrowed to one callback only.

EXECUTED (test B): `onStateChange` throwing on 'ready' → `unhandledRejection`
captured. Consequence is degraded vs the original wedge: `transition` assigns
`this.state` *before* invoking `onStateChange`, so the session lands 'ready'
correctly and local-mode `armHeartbeat`/`armRetry` are vacuous anyway
(:378, :435 both early-return without `probe`/`reconnect`). The residue is
rejection noise (console + any window.onerror telemetry) plus whatever
post-callback work is skipped. Remote mode self-heals: the same throw lands
in the outer catch (:513-514) → 'unavailable' → next tick re-runs `markReady`
where `transition` early-returns (same state) and `armHeartbeat`/`clearRetry`
complete. Low.

### W7-AUT-5 (Low) — `fail()`'s bound-10 and breadcrumb are unreachable on the one starvation path left

`useBootFlow.ts:104-110` retries `coordinator.request({target:'error'})` on
`'rejected'` up to 10 attempts, then logs a "starved" breadcrumb. Post-preempt
(wave-6), an error request can only resolve `'rejected'` when the coordinator
is disposed or the request is invalid — competing transitions get aborted
(:221-224), not waited out. The starvation class that remains is a **hung
`inFlightPromise`**: e.g. the W6-COR-5-excepted wedge at
`GamePresentationCoordinator.ts:524`, where the failure-path
`curtain.open(transitionId, new AbortController().signal)` has no deadline and
an un-abortable fresh signal. If that hangs, `executeTransition` never
settles → the error request's `await this.inFlightPromise.then(...)` (:223)
never returns → `fail()` is parked *inside attempt-0's await* — the loop
condition is never re-evaluated, the bound never engages, and the breadcrumb
never prints. The observability added this wave is dead code on precisely the
dead-drop path it was written for.

EXECUTED (w7aut-fail.repro.test.ts): a `behindCurtain` request whose domain
command rejects drives the failure path into a never-settling `curtain.open`;
`bootFlow.fail()` then runs 20 ticks with zero `console.error` calls and the
original request still pending.

This intersects the accepted W6-COR-5 exception (the hung reopen itself is
already excused); the new finding is narrower — the wave-6 breadcrumb does not
observe the starvation it claims to. Low.

### W7-AUT-6 (Low) — sibling hole: a deterministically throwing `deps.reconnect()` churns forever — the budget covers `onResume` throws only

The resume-failure budget bounds the throw class at `onResume`. One frame up,
`runReconnectPipeline` has no internal try — a throwing `refreshAuth`,
`heartbeat`, or `load` propagates to `attemptReconnect`'s outer catch
(:513-514), which classifies *every* throw as 'unavailable' → stays
'reconnecting' → the retry interval fires the full auth-refresh + heartbeat +
load RPC chain again every `reconnectRetryMs` (10s) forever, with no
escalation — the same "deterministic client fault churns forever" class
W6-COR-4 was filed against, one layer removed.

EXECUTED (test E): `reconnect` that always throws → 7 calls across 6 ticks,
still 'reconnecting', zero escalation.

Distinguishing a deterministic pipeline bug from a transient transport throw
is the honest hard part — that is presumably why the budget was scoped to
`onResume`. Still a real sibling of the closed finding. Low.

### W7-AUT-7 (Nit) — arm's `markFailed('recovery')` is a redundant second `enterTerminal`

`useAppLifecycle.ts:615,632` — `observeSaveResult(firstSave)` runs before the
gate. For both armed codes in remote mode, `authorityStateForError` maps to
'recovery' and `observeSaveResult` already calls `enterTerminal('recovery')`
(:287). The gate's `markFailed('recovery')` then re-enters: second
`generation++`, second `transition` (early-returns), second
`onPause('terminal')`. Idempotent and harmless — the call (or a comment
saying why it stays) could go.

### W7-AUT-8 (Nit) — local-branch comment describes a retry cadence that doesn't exist

`OnlineSessionController.ts:461-463` — "stay 'reconnecting' and let the retry
cadence fire again" sits in the local branch, but `armRetry` early-returns
without `deps.reconnect` (:435) — local mode has no retry cadence; each OS
resume is the only attempt. The comment was written for the remote branch's
model.

---

## Negative results — what was attacked and held

- **`markReady` clobbering `markFailed` inside `onResume`** — cannot happen.
  Every `markFailed` path bumps generation (mapped-'reconnecting' at :218,
  terminal via `enterTerminal` :362); both branches check
  `generation === this.generation` after `onResume` (:474, :504). Verified
  against App.vue's real onResume ('replaced' → markFailed('recovery') →
  generation bump suppresses the trailing markReady).
- **`markFailed('recovery')` leaving `retryHandle` armed** — cleared:
  `enterTerminal` → `clearRetry()` (:365). The shipped remote pin proves the
  cadence dies (`reconnectCalls` stays 3 through extra ticks).
- **Terminal revival via a queued retry tick** — safe: `reconnectInFlight`
  dedup (:452) + `clearRetry` in `enterTerminal` + the synchronous
  markFailed/finally window leave no interleaving.
- **Remote-mode terminal clobber** (test D) — held 'revoked':
  `enterTerminal` tears down the retry cadence so the streak can't advance
  post-park. The clobber is local-mode only (W7-AUT-3).
- **Error-preempt ordering** — deterministic: the preempt's `.then` on
  `inFlightPromise` (:223) is registered before any competitor continuation
  can exist (they chain on the caller-facing promise which resolves only
  after the outer `finally` :253-258). Worst case one extra abort cycle; an
  identical error request dedupes via `isSameRequest` (:211) instead of
  aborting. Converges.
- **`dispose()` during the preempt await** — cannot corrupt: abort() and the
  `.then` registration run in one synchronous stretch (:222-223), so no
  null-deref; the recursion re-enters `request()` which early-returns
  `'rejected'` on `this.disposed` (:194).
- **Aborted transition's error card** — overwritten correctly: the aborted
  frame lands 'failed' with `error={...}` (:535-541), then the error
  transition's step-3 clears it (:480). The transient 'failed' card never
  paints — the curtain stays closed through both transitions (only
  `behindCurtain` failures reopen, :496).
- **Coordinator-local unavailables skipping the arm** — correct:
  `adapterThrow`/`staleGenerationResult` (`CloudSaveCoordinator.ts:14-30`)
  carry no `code`, but they are not payload refuses — skipping the arm is the
  intended outcome. `LocalCloudSaveService` unavailables are all
  `retryable:true` → arm correctly inert locally.
- **Post-accrual commit sibling** (`useAppLifecycle.ts:506` second
  `player.save`) — a REJECTED payload refuse there flows through
  `observeSaveResult` → `enterTerminal('recovery')` — the designed terminal
  for a mid-session refuse; the first-save-only arm correctly does not apply.
- **`attemptReconnect` entry has no state guard** (:451) — neutralized:
  every caller gates (`resumeFromSuspend` :255, `pause` :230, retry ticks die
  with `clearRetry`).
- **Migration `202610070002` tombstone absorb ordering** — correct: live-exists
  `CHARACTER_EXISTS` and the lock/validation gates precede the
  tombstone-delete + insert (:72-74); invalid requests never delete.
  `resetCharacter` strict map (DELETED→'deleted', NO_CHARACTER→'absent',
  else `SERVER_ERROR` retryable) + `coordinator.reset()` on success verified.
- **`remoteResettable` computed fix + Export `v-if="saveIssue.raw"`** —
  verified against `SaveIncompatibleScreen.vue` :30, :160 and the reset flow
  (`resetCharacter` → 'unavailable' aborts with notify; else `deleteSave` +
  reload).
- **`fail()` on dispose** — the recursion resolves 'rejected', the loop burns
  its 10 attempts fast and prints the breadcrumb — bounded and observable.

## Residual / out-of-scope notes (pre-existing, unchanged by the delta)

- `MAINTENANCE`-class heartbeat/load errors still map to `SERVER_ERROR`
  through `mapError` (no MAINTENANCE detail branch) — pre-existing taxonomy
  gap, recorded in w6.
- Boot-time unarmed failures leave the authority in 'checking' (non-terminal,
  no cadence) — consistent with every other unarmed code; the error surface
  owns retry UX by design.
- Scratch repro files `w7aut.repro.test.ts` / `w7aut-fail.repro.test.ts` are
  audit evidence, not shipped pins — left uncommitted per wave convention.
