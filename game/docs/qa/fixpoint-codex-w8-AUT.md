# Fixpoint audit wave 8 — AUT (authority/lifecycle)

Auditor: w8-AUT worker. Base: `codex/hoa-cau-fireball-vfx` @ `4f456cfd`.
Delta under audit: `git diff cc4a51e7..4f456cfd` (wave-7 adjudicated fixes —
firstSave arm blacklist `NON_DATA_WEDGE_CODES` + new B1-D commit arm at scope
'local'; `resumeFailureStreak` reset at admission boundaries + generation-gated
catch escalation; `markReady` inside try; `onResume` awaited
(`void | Promise<void>`); reconnect-pipeline throws share the streak;
`aborted` flag on `TransitionResult` + `runAdmitted` compensate-on-aborted;
`fail()` retries 'failed'; curtain reopen bounded by `DEADLINES.curtainOpen`).
Read-only on production code; no live Supabase on this box — RPC-side claims
are SOURCE_PROOF; every client-side candidate below carries an EXECUTED repro
(`src/composables/w8aut.repro.test.ts`,
`src/services/session/w8aut.repro.test.ts`,
`src/presentation/w8aut.repro.test.ts` — scratch harnesses run against the
real `useAppLifecycle` / `OnlineSessionController` /
`GamePresentationCoordinator` + `PresentationSession`, not committed as
pins). Report branch: `devin/w8-aut-report`.

Verification executed:
- `npx vitest run src/services/session src/services/cloudSave src/composables
  src/presentation` — 68 files / 616 tests green (incl. the three w8 repro
  harnesses: 16 repro tests, all passing).
- Full read of `OnlineSessionController` (:190-534), `useAppLifecycle` both
  arm gates (:534-559 commit, :650-682 firstSave) + `NON_DATA_WEDGE_CODES`
  (:43-50), the authority terminal map (`authorityStateForError`,
  `OnlineSessionController` :118-137 + `observeSaveResult` :268-295),
  `CloudSaveWriteResult` producers (`SupabaseCloudSaveService` :795-992 —
  `ensureIdentityForSave` stale-gen, journal.put, COMMITTED_* , REJECTED
  map; `CloudSaveCoordinator` `adapterThrow`/`staleGenerationResult`
  :14-30, save catch :121/:130), `SaveIncompatibleScreen.vue` (reset gate
  :32, uncaught `resetCharacter` :78), `saveIssue` store (:23-43),
  `useBootFlow.fail()` (:96-110), `GamePresentationCoordinator`
  (executeTransition :286-561, retry :152-191, ALLOWED_EDGES :43-51),
  `createGamePresentation.runAdmitted` (:95-186), `PresentationSession`
  (hold/detach/end/isBlocking :95-192), `TribulationDirector`
  (isBlocking gate :344, start refusal :244, clear :791, restoreRuntime
  :843-872), `useTribulation` (:56-75).
- Wave-7 adjudication + the three w7 reports read first, per dispatch.

---

## Verdict: FINDINGS (2 Medium / 1 Low / 1 Nit)

| ID | Severity | Class | Surface |
|---|---|---|---|
| W8-AUT-1 | Medium | authority / arm over-coverage | `useAppLifecycle` firstSave arm: the blacklist arms EVERY non-blacklisted `unavailable && !retryable` result at scope `'remote'` — including uncoded local faults and the whole `SERVER_ERROR` bucket (`PENDING_JOURNAL_*`, `COMMITTED_MALFORMED`, `CHECKPOINT_*`, `CUTOFF_REGRESSION`, `MUTATION_ID_REUSED`) — where remote reset is the wrong or actively harmful remedy (EXECUTED) |
| W8-AUT-2 | Medium | lifecycle / orphan session | `useTribulation` is the only session-kind caller passing no `compensate` to `runAdmitted` → an abort (error-route preemption) leaves the adopted session `detach('hold')`-ed forever → `isBlocking()` freezes `TribulationDirector.update()`, `active` stays 'ongoing', `start()` refuses → breakthrough soft-locked until reload; gear already unequipped (EXECUTED) |
| W8-AUT-3 | Low | lifecycle / non-atomic terminal | `enterTerminal` assigns state before callbacks and the catch-path `markFailed('recovery')` is unguarded → a throwing `onStateChange`/`onPause` leaves the retry cadence armed behind a nominal 'recovery' → the next tick's `attemptReconnect` (no state guard) can revive the terminal back to 'ready' without `acknowledge()` (EXECUTED) |
| W8-AUT-4 | Nit | lifecycle / no dedup | local-mode `attemptReconnect` returns before `reconnectInFlight` is ever set (:488 is remote-only) → rapid suspend/resume double-runs `onResume` (EXECUTED) |

---

## Findings

### W8-AUT-1 (Medium) — firstSave arm over-coverage: the `SERVER_ERROR` bucket and uncoded results arm `'remote'` where remote reset is the wrong remedy

`useAppLifecycle.ts:666-670` — the wave-7-adjudicated firstSave arm fires on
`status === 'unavailable' && !retryable && !(code && NON_DATA_WEDGE_CODES.has(code))`
then `saveIssue.report('corrupted', '', undefined, 'remote')` (:679). The
adjudication note justified arming non-blacklisted codes on the premise that
"the first-write row is vacuous" — the character was just created, so the
remote-reset remedy only burns the fresh character. EXECUTED enumeration of
every producer outcome shows several armed classes where that premise or the
remedy itself is wrong:

- **`PENDING_JOURNAL_*`** (`SupabaseCloudSaveService` :864-872 — a
  pending-journal put failure aborts the transport attempt; the remote is
  never touched). The journal is client-side storage: a local fault arms a
  *remote-destruction* remedy. Wedge-loop: arm → user resets → next boot's
  load is 'empty'/'uninitialized' → recreate → the same local fault fires on
  the new first save → arm again — burns one freshly created character per
  boot cycle. EXECUTED: repro arms `'remote'` on
  `{status:'unavailable', retryable:false, code:'SERVER_ERROR',
  detail:'PENDING_JOURNAL_QUOTA'}`.
- **`COMMITTED_MALFORMED`** (:902 — write returned COMMITTED but the response
  revision could not be parsed). The write already landed; the server row now
  HAS a save. The "row is vacuous" premise is false for this class — remote
  reset deletes a real, healthy save row. EXECUTED arms `'remote'`.
- **`CHECKPOINT_*` / `CUTOFF_REGRESSION`** (REJECTED map :968-988 →
  `SERVER_ERROR`): authority refusals on time-grounding that self-heal on the
  next load's fresh checkpoint/cutoff. The arm destroys a fresh character for
  what is effectively a transient. EXECUTED arms `'remote'`.
- **`MUTATION_ID_REUSED`** (:968-988 → `SERVER_ERROR`): implies an earlier
  write with this mutation id already committed or is in flight — the remote
  row may already exist; same post-commit harm class. EXECUTED arms
  `'remote'`.
- **Uncoded results** (`CloudSaveCoordinator.adapterThrow`/`staleGenerationResult`
  :14-30 carry no `code`): `!(code && blacklist)` passes trivially — pure
  adapter-side exceptions (serialization throws etc.) arm `'remote'`.
  EXECUTED arms `'remote'` on an uncoded `unavailable,!retryable` result.

Also swept and found *correctly covered*: `NO_CHARACTER`/`CHARACTER_DELETED`
(:498-500, :824 — row vanished between load and first write → reset is a
reasonable remedy, next boot self-heals via 'empty'); post-await
`STALE_GENERATION` (:840 — unreachable at boot in shipped flows: reset()
callers' UIs are unmounted mid-boot); unknown RPC status (:992).

Contrast: the wave-7 **commit** arm at `'local'` scope (:556) is the safe
variant of the same over-coverage — `SaveIncompatibleScreen.remoteResettable`
is `remoteAuthoritative && scope==='remote'` (:32), so a wrongly-armed commit
only offers export/re-authenticate, never remote destruction. The
wrong-remedy class is confined to firstSave's `'remote'` scope.

EXECUTED repro: `src/composables/w8aut.repro.test.ts` — six armed cases
(table-driven), blacklist control (NETWORK_UNAVAILABLE → no arm, generic
`onError`+`fail()`), and the markFailed-skip control (SAVE_INVALID arms and
skips `markFailed`).

**Severity reasoning:** a confirmed user-facing flow that can destroy a
healthy remote save row (COMMITTED_MALFORMED) or burn a character per boot in
a self-perpetuating wedge loop (PENDING_JOURNAL_*) — a "wrong remedy" class
the blacklist was specifically meant to exclude, now present inside the armed
bucket. The fix direction (adjudicator's call): arm on a *positive* set of
first-save refuse codes (SAVE_INVALID/SAVE_TOO_LARGE, NO_CHARACTER/
CHARACTER_DELETED details, unknown-status) rather than a blacklist, or gate
the arm on `code !== 'SERVER_ERROR'` + require a `code` at all.

### W8-AUT-2 (Medium) — tribulation `runAdmitted` supplies no `compensate`: an aborted transition orphans the held session and soft-locks breakthrough

`useTribulation.ts:56-75` calls `presentation.runAdmitted('tribulation', cmd)`
with **no options** — the comment (:56-59) argues "orphaning is prevented up
front… `canEnter('tribulation')` is checked before this command runs." That
guard predates error-route preemption: `canEnter` (:139-144) only checks the
route edge, while a concurrent `request({target:'error'})` aborts the
*in-flight* transition after admission (`request` preempts on 'error',
:224-228).

EXECUTED (real `GamePresentationCoordinator` + `PresentationSession`,
`src/presentation/w8aut.repro.test.ts`): a tribulation-shaped runAdmitted
parked at `assets.ensureFor`, preempted by an 'error' request → result
`{status:'failed', aborted:true}` → catch detaches `holdToken` with policy
'hold' (:502-503) → `sessionPort.isBlocking()` stays **true** and
`getCurrentSession()` still returns the tribulation session — a live zombie.
`runAdmitted`'s compensate check (:164-177) runs, finds no `compensate`, and
settles. `retry()` rejects: the error transition's own step-3 `this.error =
null` (:483) clears the failed-request record, and the session-liveness check
(:152-191) would reject anyway.

Domain consequence (SOURCE_PROOF): `TribulationDirector.update()` early-returns
while `presentationSession.isBlocking()` (:344-346) → the `active` run set at
:298-314 never progresses, never settles, and `clear()` (:791) is only
reachable from settle/drain paths inside `update()`-driven resolution — or
from `restoreRuntime` (:843-872) on reload. `start()` refuses while
`this.active` (:244-245). Net: breakthrough is soft-locked until reload, and
`startTribulationPrepared` already unequipped the player's gear — silently
lost until the next save/restore.

Sibling asymmetry: combat reaps the same orphan through `abandonBattle` →
`presentationOps.session.end(session)` (`GameManagerTurnBattleOps` :2420) —
the adjudicated W7-COR-3 path. Tribulation was the only session-kind caller
left without a compensate.

EXECUTED control: a combat-shaped call with
`compensate = () => sessionPort.end(session)` under the identical preempt →
compensate fires exactly once, `isBlocking()` false, `retry()` still rejects
— no double-compensation on the aborted path.

**Severity reasoning:** a confirmed user-facing soft-lock of a progression
flow (breakthrough refuses forever until reload) plus silent gear loss —
reachable by any error-route preemption during the tribulation transition.

### W8-AUT-3 (Low) — `enterTerminal` is non-atomic and the catch-path `markFailed('recovery')` is unguarded: a throwing deps callback leaves the retry cadence armed behind the terminal

`OnlineSessionController.ts:365-376` — `enterTerminal` order: `generation++`
→ `transition(state)` → `clearHeartbeat` → `clearRetry` →
`deps.onPause?.('terminal')`. `transition` (:357-363) assigns `this.state`
*before* invoking `deps.onStateChange`. A throw inside `onStateChange` (or
`onPause`) skips every cleanup step after its call site — including
`clearRetry`. The escalation that triggers this —
`markFailed('recovery')` inside the catch at :512/:528 — is itself not inside
a try.

EXECUTED (`src/services/session/w8aut.repro.test.ts`): reconnect dep throws 3
consecutive times → streak hits the budget → `markFailed('recovery')` →
`onStateChange('recovery')` throws → (a) `authorityState` is already
`'recovery'` (the UI reads the nominal terminal), (b) the retry interval is
**still armed** (`scheduler.handles.size === 1`), (c) the next armed tick
runs `attemptReconnect` — which has no state guard (:458) — and a `'resumed'`
outcome lands `markReady` → the controller **revives `'recovery'` back to
`'ready'`** without `acknowledge()`, re-arming the heartbeat. Plus one
unhandled rejection floated from `void attemptReconnect()`.

This is the residual of w7's negative-result claim "terminal revival via a
queued retry tick — safe": that argument relied on `clearRetry` always
running; under a throwing deps callback it doesn't. Latent in shipped config
(App.vue's `onStateChange`/`onPause` are non-throwing today) — contract-level,
hence Low.

Adjacent (same class, SOURCE_PROOF): `pause()` :235-247 runs
`transition → clearHeartbeat → onPause → armRetry → attemptReconnect` — an
`onPause` throw propagates synchronously into `observeSaveResult`/
`persistPlayer` callers and skips both `armRetry` and the immediate attempt,
leaving 'reconnecting' with no cadence at all.

### W8-AUT-4 (Nit) — local-mode `attemptReconnect` never sets `reconnectInFlight`: rapid suspend/resume double-runs `onResume`

`OnlineSessionController.ts:463-486` — the local branch (no `deps.reconnect`)
runs `await deps.onResume?.('same')` and returns 'resumed' before the
`reconnectInFlight` flag is set (:488 is remote-only). EXECUTED: `suspend()` →
two rapid `resumeFromSuspend()` calls while `onResume` pends → `onResume`
invoked twice concurrently (no dedup). Harmless today (idempotent resume,
generation fence serializes the markReady) — recorded as a Nit asymmetry.

---

## Negative results — what was attacked and held

- **markFailed-skip correctness (both directions).** EXECUTED: with
  `deps.reconnect` bound, `observeSaveResult({unavailable, SAVE_INVALID,
  !retryable})` lands 'recovery' — the arm's skip of `markFailed` for
  SAVE_INVALID/SAVE_TOO_LARGE is sound because observe already owns the
  terminal. Without `deps.reconnect` the same result early-returns (:279-283)
  and reaches no terminal — but in shipped configs this path is unreachable:
  the local producers that emit `unavailable,!retryable` are
  `adapterThrow`/`staleGenerationResult`, and `LocalCloudSaveService.save`
  never produces a `!retryable` refuse; the arm can only fire under remote
  boots. No actionable local-mode wedge.
- **Remote-authoritative ⟹ `deps.reconnect`.** `App.vue` :611-631 binds
  `deps.reconnect` iff `composition.mode==='supabase' && composition.config`
  — the same condition as `remoteAuthoritative`. Every boot where the
  firstSave/commit arms can fire has the reconnect dep bound, so
  `observeSaveResult` never early-returns on an armed-class result in a
  shipped config.
- **The under-coverage direction of the blacklist is closed.** Enumerated all
  10 `BackendErrorCode`s against the arm: the six non-data codes are
  blacklisted (transport/protocol/auth — reset is never the remedy);
  SAVE_CONFLICT lands as status 'conflict' and never reaches the arm;
  SAVE_INVALID/SAVE_TOO_LARGE are the intended armed codes. No unarmed
  `{unavailable,!retryable}` code still wedges silently — everything unarmed
  lands on the generic `onError`+`boot.fail` surface (non-terminal
  'checking'), consistent with every other unarmed boot failure.
- **`'uninitialized'` while the remote row secretly has saves** — cannot
  happen: load()'s 'uninitialized' is the RPC's `CHARACTER_UNINITIALIZED`
  response; a pre-existing row returns 'ok' (or CAS-conflicts on write as
  'conflict', not 'unavailable'). The destructive-armed-pair worry is
  confined to the post-commit classes inside AUT-1.
- **Streak semantics post-fix.** EXECUTED control: alternating
  throw/'unavailable' never escalates — the budget is consecutive-only by
  reset-on-non-'resumed' (:517), so mixed-class flakiness cannot trip it.
  A deterministically throwing reconnect dep escalates after 3 — that is the
  intended w7 fix, and it cannot fire on transport flakiness alone:
  `performRefresh` catches internally (SupabaseSession :222-260) and the
  coordinator adapters return results rather than throwing. Acceptable
  determinism.
- **Aborted flag vs sessionPort — no double-compensation.** EXECUTED:
  `detach(holdToken,'hold')` deliberately retains (`held=true`,
  `isBlocking()` true); `forgetSession` only prunes the dedupe set; a
  compensate-armed session reaps exactly once and `retry()` rejects after
  `end()` — the aborted transition's card cannot resurrect it.
- **`fail()` 'failed' retry bound** — acceptable: 10 attempts with `whenIdle`
  between them + the breadcrumb; an instantly-failing error transition burns
  the bound fast but still lands the generic card — bounded and observable.
- **`enterTerminal` idempotence under dedup** — repeated `markFailed` with
  the same terminal is cheap (state already-equal → `transition`
  early-returns before `onStateChange`; `clearRetry`/`clearHeartbeat` still
  run). The dedup itself is not the hole; the throw-skip inside the first
  call is (AUT-3).

## Residual / out-of-scope notes (pre-existing, unchanged by the delta)

- `SaveIncompatibleScreen.handleReset` `await
  cloudSaveCoordinator.resetCharacter()` (:78) is uncaught — a service throw
  is an unhandled rejection with no user-facing fallback. Pre-existing
  latent; unchanged by this delta.
- `MAINTENANCE`-class heartbeat/load errors still map to `SERVER_ERROR`
  through `mapError` — pre-existing taxonomy gap carried since w6.
- Scratch repro files `w8aut.repro.test.ts` (×3) are audit evidence, not
  shipped pins — left uncommitted per wave convention.
