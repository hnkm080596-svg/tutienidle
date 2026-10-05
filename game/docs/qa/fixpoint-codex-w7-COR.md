# Fixpoint wave-7 CORRECTNESS audit — wave-6 delta

Branch `codex/hoa-cau-fireball-vfx` @ `cc4a51e7` (report branch
`devin/w7-cor-report`). Auditor role: COR — adversarial verification of
the **wave-6 delta only** (`git diff 1bd0763f..cc4a51e7`: 2 commits,
15 files, +1165/-47): `create_character` tombstone absorb
(202610070002), the narrowed firstSave arm gate + clobber removal
(`useAppLifecycle.ts`), the resume-failure budget
(`OnlineSessionController.ts`), error-route preemption
(`GamePresentationCoordinator.ts` + `useBootFlow.fail()` bound 10 +
breadcrumb), `remoteResettable` computed + export `v-if`
(`SaveIncompatibleScreen.vue`), and the flipped/added pins
(w5int/w5aut/w6int repro, `OnlineSessionController.test.ts`,
`resetCharacter.spec.ts`).

Method: fresh clone (`/home/ubuntu/work/tutienidle-w7`), `npm ci` in
`game/`, Node 22 via linuxbrew. Full source trace of every wave-6 fix
plus sibling hunt across all dispatched vectors (other `report()` /
`markFailed` arms, other `request()` callers, other `characters`
writers vs `user_id UNIQUE`, abort-preemption races: catch-path reopen
serialization, holdToken/session leaks, `whenIdle`/`inFlightPromise`
re-entry). Live verification below.

## Verdict

**The wave-6 delta is NOT clean: 0 Critical, 0 High, 3 Medium, 2 Low,
3 Nit.**

Every wave-6 Medium+ claim verifies at source level and the repro pins
run green — but three defects survive: (1) the arm gate covers only the
firstSave write site while the same deterministic payload-reject on the
B1-D commit write produces no recovery surface at all (EXECUTED repro);
(2) the delta's own new test pin fails `npm run type-check` on the tip,
falsifying the adjudication's "type-check clean" line (EXECUTED); (3)
the new error-preemption abort path returns 'failed' for transitions
carrying accepted domain commands, so `runAdmitted`'s compensate —
which only fires on 'rejected' — leaves admitted+held sessions orphaned
(SOURCE_PROOF). Two Lows cover the budget fix's residual contract holes;
three Nits are recorded for completeness.

Under the fixpoint threshold ruling, **W7-COR-1/2/3 block the next
adjudication round.**

## Verified claims (wave-6 Medium+)

| Claim | Result | Evidence |
|---|---|---|
| W6-COR-1 tombstone absorb (202610070002) | VERIFIED | SOURCE_PROOF: live-only exists-check `:35`, live-only name check `:60`, absorb `delete ... where user_id = ... and deleted_at is not null` `:72-73` before insert `:74-78`; same-name re-creation provably works (check is live-filtered); ordering sound — the absorb precedes the insert and the name check precedes both. Live spec `resetCharacter.spec.ts:73-117` asserts tombstone -> CHARACTER_DELETED -> create -> CREATED -> count=1 (unrunnable here — needs staging env; SOURCE_PROOF stand-in). |
| W6-COR-2 arm gate narrowed to SAVE_INVALID/SAVE_TOO_LARGE | VERIFIED | SOURCE_PROOF `useAppLifecycle.ts:627-636` + EXECUTED: 4-code parametric pin (`w5aut.repro.test.ts:375-427`) green; w7cor control test re-confirms the arm fires on the firstSave path. Gate is complete vs `mapError`'s payload-reject set (SAVE_SCHEMA_UNSUPPORTED folds to SAVE_INVALID client-side, `SupabaseCloudSaveService.ts:974-988`). |
| W6-COR-3 `markFailed('recovery')` clobber removed | VERIFIED | SOURCE_PROOF: `markFailed` now runs only inside the gated arm (`:632`); AUTH_EXPIRED keeps the `'revoked'` path (`:385`, `OnlineSessionController.ts:278-282`). |
| W6-COR-4 / W6-AUT-5 resume-failure budget | VERIFIED (sync) | EXECUTED: 3 new pins in `OnlineSessionController.test.ts` green (local thrower -> 'recovery' after 3 cycles; remote thrower -> 'recovery' after 3 ticks; success resets streak). Residual contract holes = W7-COR-4/5 below. |
| W6-COR-5 fail() bound 10 + breadcrumb | VERIFIED | SOURCE_PROOF `useBootFlow.ts:99-110`. Post-preemption, an 'error' request can no longer resolve 'rejected' from contention — the bound+breadcrumb now covers only the disposed-path dead-drop; consistent. |
| W6-COR-6 / W6-AUT-3 `remoteResettable` computed | VERIFIED | SOURCE_PROOF `SaveIncompatibleScreen.vue:32` computed over `saveIssue.scope`; `.value` reads at `:63-83` reactive. |
| W6-AUT-4 export `v-if="saveIssue.raw"` | VERIFIED | SOURCE_PROOF `:163` — the armed-firstSave case (`raw:''`) no longer offers a 0-byte export. |
| W6-INT-1 error-route preemption | VERIFIED | EXECUTED: `w6int.repro.test.ts` (chained-competitor preempt) + flipped `w5int` pin green. Ordering proof re-derived and confirmed below. |
| W6-INT-2 (=COR-3) AUTH_EXPIRED stays 'revoked' | VERIFIED | subsumed by the gate — see W6-COR-3 row. |
| W6-INT-3 local onResume inside try | PARTIAL | throw-classify half delivered (`:464-477`); the in-flight-guard half was not — see W7-COR-4. |
| W6-AUT-2 local throw -> 'reconnecting' not fake-ready | VERIFIED (sync) | EXECUTED pin green; async escape = W7-COR-4. |

## Findings

### W7-COR-1 (Medium, REAL_DEFECT) — the wave-6 arm covers only the firstSave write; the B1-D commit write still wedges a live character with no recovery surface

The arm gate at `useAppLifecycle.ts:627-636` sits inside the
`uninitialized`-load branch only. The sibling remote write — the B1-D
post-accrual commit at `:502-532` (`commit = await player.save(...)`)
— takes `authority.observeSaveResult(commit)` + `recordSaveOutcome` +
generic `onError` + `boot.fail()` for every non-'ok' result. There is
no arm: `saveIssue.report` is never called, so `saveIssue.status`
stays unset and the error route mounts the generic card
(`App.vue:1183` requires `saveIssue.status` for
`SaveIncompatibleScreen`).

Same defect class the wave-6 fix was built to close: a server-side
deterministic payload rejection (`unavailable && !retryable &&
SAVE_INVALID|SAVE_TOO_LARGE` — `mapError`'s REJECTED class,
`SupabaseCloudSaveService.ts:974-988`) on a **live, loadable**
character's accrued commit. The 'ok' load proves the stored head is
healthy; the accrued write can then never land. Every retry loops
identically: load 'ok' -> commit -> REJECTED -> generic fail. In-game
the same reject enters authority `'recovery'` via `observeSaveResult`
(`:520`, `authorityStateForError` :123-127); the `'recovery'` overlay's
only exit is acknowledge -> signed-out -> re-auth -> the same wedge
(`App.vue:734-754`). No export, no delete, no accurate message — the
failure is presented as a transient boot error.

Difference-in-kind acknowledged for the adjudicator: on this branch the
remote row's committed head is *provably* good (it loaded), so the
W6-COR-2 doctrine ("never arm destruction where the row wasn't proven
bad") argues the arm should NOT simply be replicated — but some
accurate surface (export/salvage of the healthy head, a truthful
'cannot commit' state instead of a retry-implying generic error) is
owed; today there is none.

**EXECUTED_REPRO**: `src/services/save/w7cor.repro.test.ts` — 'ok' load
+ `player.save` returning `{unavailable, SAVE_INVALID, retryable:false}`
=> `outcome 'failed'`, `boot.fail` x1, `saveIssue.report` NOT called,
`markFailed('recovery')` NOT called (positive control: same reject on
the 'uninitialized' path DOES arm `report('corrupted','',undefined,
'remote')` + `markFailed('recovery')`).

### W7-COR-2 (Medium, REAL_DEFECT) — the wave-6 delta's own pin fails `npm run type-check` on tip `cc4a51e7`

`npm run type-check` (vue-tsc --build) on the fresh clone at the
audited tip fails with exactly 2 errors, both inside the **new**
`it.each` block the delta added to `src/services/save/w5aut.repro.test.ts`:

- `:382` — `it.each([[code, desc], ...])` feeds a callback typed
  `(code) =>` — the row tuples carry two elements; the signature
  doesn't match the parametric contract.
- `:384` — `stubs.player.save` was inferred as
  `Mock<() => Promise<{...; code: 'SAVE_INVALID'}>>`; the re-assigned
  mock returns `code: BackendErrorCode` — not assignable.

The wave-6 adjudication (:249) records "type-check clean" as the
delta's verification claim — that claim is falsified at the tip
(executable evidence, not inference). Vitest still passes because
esbuild strips types — so the pins *run* (59/59 green) while the repo's
P3 gate (`npm run type-check`, and `npm run verify` transitively) is
red for the whole branch.

Cosmetic adjunct in the same block: the second tuple element (the
description string) is never used — the `%s` in the title consumes only
the code.

### W7-COR-3 (Medium, REAL_DEFECT) — error-preemption abort has no compensation path: admitted sessions are orphaned and domain teardowns are skipped on 'failed'

The new preempt (`GamePresentationCoordinator.ts:221-225`) aborts the
in-flight transition and lands it 'failed'. The failure path
(`:484-545`) detaches the transition's own hold — but nothing upstream
compensates the aborted transition's **already-committed domain work**:

1. **Orphaned admitted session.** `runAdmitted`
   (`createGamePresentation.ts:95-172`) runs the domain `command()`
   inside the transition's behindCurtain step (`:339-361`); the command
   admits + holds the session. If the abort lands after behindCurtain —
   any checkpoint in `:385-:454` (assets/deactivate/prepare awaits, all
   abort-linked) — the transition returns 'failed', and the compensate
   block at `:164-170` fires only on `'rejected'`. `forgetSession` +
   `options.compensate` are skipped, the session's id is already in
   `handledSessionIds` (`:139`) so `handleSessionStarted` will never
   re-route it, `detach(holdToken,'hold')` leaves the domain session
   held-not-attached (`PresentationSession.ts:145-161` — 'hold' policy
   retains hold semantics), and the retry pin
   (`error.failedRequest = preparedRequest`, `:539`) is destroyed when
   the error transition commits (`this.error = null`, `:480`) — so
   `retry()` cannot reach it either. Net: an admitted, held, unrendered
   session survives indefinitely — the exact class the `:166-168`
   comment says must never survive silently.

2. **Skipped domain teardown.** 'home' requests carrying behindCurtain
   teardown — `useBattleActions.ts:121` (combat exit: run-mode manual +
   `combat_scene_exit`), `useTribulation.ts:206`/`:235`
   (consumeReceipt/drainFailedRun), `App.vue:393-402`
   (abandonFailedCombat) — aborted inside the close window
   (`:325-333`) never run the teardown. Partially self-healing: the
   tribulation pending outcome re-issues on next tick (`:201-205`), and
   combat exit is reachable again via the error shell's back path; the
   residue is a battle left domain-active while the UI went to 'error'.

3. **Organic trigger.** During boot, fail() races only boot's own
   sessionless transitions. Post-boot the producer is `App.vue:674-677`
   — a remote reconnect whose replaced-lineage save fails
   `restoreGameSession` preflight — which fires exactly when a
   combat/tribulation entry or teardown exit can be in-flight.

Fix direction (for the fixers): either compensate on the aborted
'failed' landing (symmetric with 'rejected'), or refuse to abort
transitions whose behindCurtain already delivered.

### W7-COR-4 (Low, REAL_DEFECT) — the budget fix covers only synchronous onResume; the `=> void` dep signature still permits an async implementation that escapes everything

Both branches invoke `deps.onResume?.(...)` **unawaited** inside the
new try/catch (`OnlineSessionController.ts:465`, `:495`). The signature
(`:88-92`) is `(lineage, save?, serverAuthority?) => void` — TypeScript
admits an `async` implementation into that slot. For an async onResume:

- the call returns a pending promise — no synchronous throw — so the
  `catch` never sees the later rejection (unhandled rejection);
- `resumeFailureStreak = 0` runs immediately (`:473`, `:503`) — the
  budget never counts it;
- `markReady()` runs right away (`:475`, `:505`) — 'ready' while the
  restore has not landed, which is the precise dead-session window the
  original W5-INT-3/W6-AUT-2 fixes were written to close;
- in local mode the `reconnectInFlight` guard is never armed (`:480`
  sits in the remote branch only — W6-INT-3's second half undelivered),
  so the pending onResume can be re-entered by the next
  `resumeFromSuspend`; in remote mode the flag covers
  `deps.reconnect()` but the unawaited onResume can still overlap
  across retry ticks once `attemptReconnect` returns.

Current product wiring is synchronous (`App.vue:649-682`) — dormant
contract hazard, no live reach. Recorded Low rather than N/A because
the fix's claim ("a throwing resume is classified") is silently
conditional on sync-ness the type does not state.

### W7-COR-5 (Low, REAL_DEFECT) — `resumeFailureStreak` survives session reset/acknowledge and can escalate a fresh session's first resume fault

The streak is written at `:467/:497` (++), `:473/:503` (=0 on onResume
success), initialized `:154` — and nowhere else. `acknowledge()`
(`:331-339`), `stopAll()` (`:343-348`), `markReady()` (`:205-210`) and
the checking-state entry (`:200-202`) all leave it standing. A session
that died with streak 2, was acknowledged, and re-authenticated leaves
a residue: the *next* session's first throwing resume lands
`streak=3 >= RESUME_FAILURE_BUDGET` and escalates straight to
'recovery' — a healthy session killed by its predecessor's debt. Narrow
window; consequence is a wrongful (but acknowledgeable) terminal.

### W7-COR-6 (Nit, COVERAGE_GAP) — the live spec never exercises same-name re-creation over a tombstone

`resetCharacter.spec.ts:73-117` creates the tombstone under
`uniqueName('T')` and re-creates under `uniqueName('T2')`. The
SQL-level path for the *same* name is provably safe (name-availability
check `:60` filters `deleted_at is null`, so the tombstone's own
normalized_name is available pre-absorb) but unpinned — a future
regression that leaked tombstones into the check would wedge exactly
the re-create-your-own-name flow. Add a same-name case when the spec
next runs.

### W7-COR-7 (Nit, pre-existing) — deferred `markRouteMounted` can write `mountedRoutes` after unmount (phantom-ready)

`VueRouteAdapter.markRouteMounted` defers one `nextTick` (`:190-194`);
`markRouteUnmounted` is synchronous (`:196-198`). A route that mounts
and unmounts inside the same tick records a phantom
`mountedRoutes` entry, and a later `prepare` for that route resolves
Vue-ready instantly via the `mountedRoutes.has` fast path (`:107-109`)
— the readiness gate degrades one transition (commit before the real
mount). Pre-existing shape; the abort path widens reachability
marginally (aborted mounts are common now). Consequence is a bounded
paint-timing slip only.

### W7-COR-8 (Nit, pre-existing) — concurrent same-user `create_character` on different rolls still hits `unique_violation`

The absorb serializes the tombstone case, but two concurrent creates
for one user on *different* talent rolls both pass the live check
(`:35`) and both insert; the loser raises 23505 -> opaque 4xx. Same
-roll concurrency already serializes cleanly through the roll's
`FOR UPDATE` (`:38-43`, loser sees `consumed_at` -> clean
INVALID_TALENT_ROLL). Consequence is a retryable opaque error, not a
wedge; the constraint predates the delta.

## Attacked and cleared (negative results)

- **Continuation ordering (W6-INT-1 core claim)** — re-derived:
  `inFlightPromise` is the raw `executeTransition` promise; the
  in-flight request's `finally` continuation is registered first, our
  preempt `.then` second, and any competitor chained on the settle
  (whenIdle `.then`, dedupe-share awaits) resolves at least one
  microtask hop deeper — the re-request takes the cleared slot
  deterministically. A competitor pre-registered on the *same* promise
  (dedupe-share) can interpose once; the error request then preempts
  again and wins in <=2 cycles — no starvation path remains.
- **error-vs-error** — `isSameRequest` shares the promise before the
  preempt branch (`:216-219`); an error transition is never aborted by
  another error request.
- **Catch-path reopen vs new error transition's curtain use** — the
  catch-path `curtain.open` (`:524`, fresh `AbortController().signal`)
  is awaited *inside* the aborted transition, so it completes before
  `inFlightPromise` settles and before the error transition's own
  curtain ops; both curtain impls are bounded
  (PresentationTransitionOverlay 600ms safety + nextTick settle;
  OnboardingStage WAAPI abort). The surviving theoretical hang is the
  excepted W6-COR-5 case (no deadline on the catch reopen) — product
  ports make it unreachable.
- **whenIdle generation semantics** — `whenIdle` reads the current
  `inFlightPromise` (`:266-269`); post-preempt it is only reachable
  after a 'rejected' which error requests can't produce — dead path,
  consistent.
- **holdToken/session leak** — `detach(holdToken,'hold')` at `:494-495`
  covers every abort landing; tokens attach (`:447-452`) before the
  last checkpoint so post-commit aborts also detach cleanly.
- **Other `report()`/`markFailed` arms** — the remaining sites are
  correctly scoped: `:400-408` (incompatible/corrupted -> 'remote'
  default, gated by remoteAuthoritative downstream), `:411-424`
  (pending-* -> 'local'), `:454-465` (restore-reject -> 'remote'),
  `App.vue:674-677` (resume-reject -> 'remote' on server-verbatim
  bytes). No sibling arm defect besides W7-COR-1's missing write site.
- **Other `request()` starvation callers** — `request({target:'error'})`
  has exactly one producer (`useBootFlow.fail()` :105); `whenIdle` has
  exactly one caller (:107). Non-error requesters still
  reject-and-swallow (excepted class, W6-INT-6).
- **Other `characters` writers** — `create_character` is the only
  INSERTER (9 grep hits are all function redefinitions; newest
  202610070002 is authoritative). reset_character hard-deletes. No
  other UNIQUE-wedge producer.
- **error edge reachability** — `ALLOWED_EDGES` lists 'error' from
  every route including 'error' itself (`:43-51`); `canEnter('error')`
  is gateable only by in-flight, which the preempt clears.
- **dispose() during preempt await** — the re-request re-checks
  `disposed` and resolves 'rejected'; no settle-deadlock.
- **Curtain double-mutation during abort** — overlay's aborted-signal
  early-reject + single shared curtainState; the aborted transition's
  reopen is serialized ahead of E's ops by the in-flight await.

## Verification run

```
PATH=/home/linuxbrew/.linuxbrew/opt/node@22/bin:$PATH
npm run type-check                     → FAIL (2 errors, both in the
                                         wave-6-added it.each block of
                                         src/services/save/w5aut.repro.test.ts
                                         :382 TS2345 / :384 TS2322)
npx vue-tsc --build --force            → same 2 errors; zero elsewhere
npx vitest run src/services/save/w5aut.repro.test.ts \
  src/services/save/w5int.repro.test.ts src/services/save/w6int.repro.test.ts \
  src/services/session/OnlineSessionController.test.ts \
  src/composables/useBootFlow.test.ts
                                       → 5 files / 59 tests PASS
npx vitest run src/presentation/       → 36 files / 322 tests PASS
npx vitest run src/services/save/w7cor.repro.test.ts
                                       → 2/2 PASS (arm-miss repro +
                                         firstSave control)
```

`resetCharacter.spec.ts` (live Supabase) not executable on this box —
no staging env; the spec's SQL claims are verified by SOURCE_PROOF
against 202610070002 + 202608240001 + 202610070001.

## Files

- Report: `game/docs/qa/fixpoint-codex-w7-COR.md`
- Repro: `game/src/services/save/w7cor.repro.test.ts` (QA-write
  boundary: test file only; no production edits)

## Verdict line

FINDINGS(0 Critical, 0 High, 3 Medium, 2 Low, 3 Nit)
