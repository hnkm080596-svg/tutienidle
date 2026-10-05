# Fixpoint wave-6 CORRECTNESS audit — codex aggregate

Branch `codex/hoa-cau-fireball-vfx` @ `1bd0763f` (report branch
`devin/w6-cor-report`). Auditor role: COR — adversarial correctness
review of the **wave-5 delta only** (`git log 66746ede..1bd0763f`):
`saveIssue.scope` + reclassification, migration
`202610070001_deleted_character_predicates.sql`,
`GamePresentationCoordinator.whenIdle()` + `useBootFlow.fail()` bounded
retry, `OnlineSessionController.attemptReconnect` onResume-before-markReady
reorder, `CloudSaveCoordinator.resetCharacter` → `this.reset()`,
strict reset mapping, charset message, and the w4int/w5int/w5aut +
useBootFlow repro pins.

Method: full source trace of every dispatched attack vector, verified
against the defining migrations (202608240001 / 202609240001 /
202609300001 / 202610050002 / 202610060001 / 202610060002) and live
verification: `npm run type-check` PASS; scoped vitest
(useAppLifecycle, useBootFlow, w4int/w5int/w5aut repro) 5 files /
74 tests PASS; adjacent `services/session` + `services/cloudSave` +
`stores` + App route-mount witness 26 files / 230 tests PASS. All
findings below are SOURCE_PROOF (deterministic static proof against the
checked-in code) — no runtime confirmation is claimed.

## Verdict

**The wave-5 delta is NOT clean: 1 High, 2 Medium, 2 Low, 2 Nit.**

The schema leg of the migration defeats itself: `characters.user_id` is
`uuid not null unique` (202608240001:44, never dropped), so the
tombstone-only account this migration exists to un-wedge passes the new
live-only exists-check and then hits `unique_violation` on the bare
`insert into public.characters(user_id, …)` — an opaque PostgREST error
instead of either a created character or the clean `CHARACTER_EXISTS`
rejection the pre-fix code produced. In the client, the firstSave
permanent-reject arm (`useAppLifecycle.ts:624`) is broader than the
"authoritative refusal" its comment claims, and the unconditional
`markFailed('recovery')` after `observeSaveResult` clobbers the finer
terminals that call already set.

Under the fixpoint threshold ruling, **W6-COR-1/2/3 block the next
adjudication round.**

## Findings

### W6-COR-1 (High, REAL_DEFECT) — `user_id UNIQUE` still wedges every tombstoned account the migration claims to free

`characters.user_id uuid not null unique references auth.users(id)`
(202608240001:44). No later migration drops it (grep-verified across
`alter table public.characters` / `drop constraint` in every migration).
One user can therefore hold **at most one characters row, live or
tombstone** — live+tombstone coexistence is impossible, which the
migration's own comments get wrong (":63-66", ":200-202", ":450-452"
all reason about "a tombstone coexisting with a fresh character").

Consequence chain for a tombstone-only account (a row with
`deleted_at is not null` — reachable today only via operator/legacy
soft-delete since no code path writes `deleted_at`, but that is exactly
the population the migration exists for, per its own header ":3-9"):

1. `create_character` exists-check `:383` —
   `where user_id = v_session.user_id and deleted_at is null` — passes.
2. Name check `:408` passes (partial index is live-only).
3. `is_character_name_available` `:36-45` now also returns `true` for
   the tombstone's own name — the probe tells the client the name is
   free.
4. `insert into public.characters(user_id, …)` `:417` — no
   `on conflict`, no tombstone cleanup — raises `unique_violation`
   (23505) on `user_id`.
5. PostgREST surfaces it as a generic 4xx → `mapError` →
   `SERVER_ERROR` → the client shows "server refused the request" and
   any retry wedges identically.

Net: the migration's stated fix ("an account with a soft-deleted row
could never re-create") **does not hold for a single real tombstoned
account** — the failure mode changed from a clean `CHARACTER_EXISTS`
rejection to an opaque uniqueness crash. The correct fix is one of:
delete/absorb the tombstone row inside `create_character` before insert
(symmetrical with `reset_character`'s hard-delete rationale at
":462-465"), or drop the `user_id` unique and add a partial unique
`(user_id) where deleted_at is null` — which would also make the new
live-first `order by` meaningful instead of dead code (see Nit below).

### W6-COR-2 (Medium, REAL_DEFECT) — firstSave `unavailable && !retryable` arms remote destruction for failure classes that never proved the remote row bad

`useAppLifecycle.ts:614-629`: on `firstSave.status !== 'ok'` the code
arms `saveIssue.report('corrupted', '', undefined, 'remote')` — which
mounts `SaveIncompatibleScreen`'s "Delete Server Character" button →
`reset_character` → hard `delete from public.characters` — whenever
`status === 'unavailable' && !retryable`. The comment (":617-623")
justifies this as "the authoritative side refuses the starter
snapshot", i.e. a REJECTED write. But the `retryable:false` set is far
wider. From `SupabaseCloudSaveService.mapError` (:218-247):

| Failure | code | retryable | Arms reset? |
|---|---|---|---|
| Server REJECTED codes (CHARACTER_DELETED, SAVE_INVALID, …) | per-code | false | **intended** |
| transport/TypeError (drop, CORS, offline mid-write) | NETWORK_UNAVAILABLE | false | **defect** |
| other non-2xx (400/404/409 — incl. the 23505 above) | SERVER_ERROR | false | **defect** |
| 'session revoked' | SESSION_REVOKED | false | **defect** |
| SESSION_PROTOCOL_OUTDATED | PROTOCOL_OUTDATED | false | **defect** |
| adapter-thrown non-SaveWriteError | SERVER_ERROR | false | **defect** |

`mapError`'s own comment on NETWORK_UNAVAILABLE says "retryable stays
false because only a fresh load resolves that ambiguity safely" — i.e.
the write may have COMMITTED (lost ACK) or never arrived; in both
sub-cases the remote row is healthy and the offered remedy deletes it.
A boot-time network blip during first save can therefore surface a
destructive "delete server character" affordance for a healthy account.
Secondary damage: in local-only mode (`resetCharacter` absent) the same
arm mounts a remote-scope surface whose delete button is a dead-end —
harmless but incoherent.

Fix direction: arm on REJECTED codes only (the unavailable result
already carries `code`), or re-`load()` once to disambiguate before
offering destruction.

### W6-COR-3 (Medium, REAL_DEFECT) — unconditional `markFailed('recovery')` clobbers the terminal `observeSaveResult` already chose

`useAppLifecycle.ts:615` calls `authority.observeSaveResult(firstSave)`
first — which correctly maps: `SESSION_REVOKED → 'revoked'`,
`PROTOCOL_OUTDATED → 'update-required'`, `AUTH_EXPIRED && !retryable →
'revoked'` (`OnlineSessionController.ts:274-284`,
`authorityStateForError` :112-131). Then `:625` unconditionally calls
`authority.markFailed('recovery')`, and `enterTerminal` (:354-365) has
**no terminal-sticky guard** — it `transition('recovery')` over
whatever state the observation just set. Net effect for a revoked
session or stale protocol during first save: the authority lands in
'recovery' (retry-able surface) instead of 'revoked'/'update-required',
**and** the 'remote'-scope corrupted report mounts the delete-character
button for what is an auth/protocol problem — the wrong remedy twice
over. Fix: only `markFailed('recovery')` when `observeSaveResult` left
the session non-terminal, or gate the whole arm on the REJECTED class
(W6-COR-2 fix subsumes this).

### W6-COR-4 (Low, REAL_DEFECT) — a throwing `onResume` now produces a silent unbounded reconnect loop

The reorder (`attemptReconnect` :447-491) is correct for a
*synchronous* `onResume` — generation guard covers `markFailed`,
`acknowledge`, `stopAll`, `enterTerminal`; `markReady` doesn't bump
generation so a double-mark is harmless; `pause()` can't interleave
(mid-resume state is 'reconnecting', not 'ready'). Residual: a
deterministically throwing `onResume` lands in the `:486` catch
("keep retrying") → `reconnectInFlight` clears → every
`reconnectRetryMs` (10s default) re-runs `reconnect()` (a remote fetch)
and `onResume` → throw → repeat **forever, silently**. Pre-fix the same
throw left a broken 'ready' once; post-fix it is a quiet infinite
remote-polling loop. In the no-`reconnect` local branch (:452-462) the
throw escapes `attemptReconnect` entirely — unhandled rejection per
retry tick, same infinite cadence. Defensible trade (honest state vs.
fake-ready) but undocumented and unbounded — consider a resume-failure
budget that escalates to `markFailed`.

### W6-COR-5 (Low, REAL_DEFECT) — `fail()` retry can still starve, and `whenIdle()` can stall forever

(a) The 3-attempt bound (`useBootFlow.ts:98-108`) exits silently after
three consecutive `rejected` results — sustained transition churn (a
user hammering route transitions while boot fails, or a wedged
in-flight promise) leaves the error surface unmounted with no
breadcrumb. Narrow window, real dead-end. (b) `whenIdle()`
(`GamePresentationCoordinator.ts:253-256`) awaits `inFlightPromise`,
which only settles when `executeTransition` returns — and its
error-path `curtain.open` (:511) is the one curtain call **without** a
`withTimeout` deadline (compare :448, which has one). A hung reopen
(e.g. `transitionend` never fires, DOM detached mid-animation) wedges
`inFlightPromise` permanently: `whenIdle()` never resolves, `fail()`
never lands 'error', and every later `request()` also returns
'rejected'. The coordinator-wedge half is PRE_EXISTING; the fail()-
depends-on-it half is new. Dispose is safe (inFlightPromise cleared →
whenIdle resolves → 3 fast rejects).

### W6-COR-6 (Nit, REAL_DEFECT) — `remoteResettable` is a non-reactive snapshot

`SaveIncompatibleScreen.vue:31` reads `saveIssue.scope` once into a
plain const. Safe today because every `report()` precedes mount
(RouteMount 'error' + `v-if="saveIssue.status"`; the pin at
w5aut asserts this), but a future `clear()` + re-`report()` cycle
(store supports both) would render a stale scope. One-line fix:
computed.

### W6-COR-7 (Nit, PRE_EXISTING) — residual races the delta neither caused nor fixed

- Name-taken race: two concurrent creates with the same normalized name
  → the partial index raises `unique_violation` → generic SERVER_ERROR
  instead of `CHARACTER_NAME_UNAVAILABLE` (identical pre-fix with the
  full index).
- Charset divergence: SQL `^[[:alnum:] _-]+$` vs client
  `/^[\p{L}\p{N} _-]{2,20}$/u` — `\p{N}` admits Nl/No that
  `[[:alnum:]]` never does (documented Low in the w4int pin).
- `ensureIdentityForSave` CHARACTER_DELETED → 'reconnecting' forever:
  unchanged pre-existing wedge.
- `mapError` has no MAINTENANCE mapping: unchanged pre-existing.

## Attacked and cleared

- **saveIssue scope classification** — all five `report()` callers
  audited: remote-load corrupted/incompatible → 'remote'
  (useAppLifecycle :402/:463); `pending-conflict`/`pending-quarantined`
  → 'local' (:422); firstSave permanent-reject → 'remote' (:626, but
  see W6-COR-2/3 on which failures reach it); resume-rejected remote
  bytes → 'remote' (App.vue:649-682). `clear()` resets scope to
  'remote' ✓. No caller skips the param where it matters.
- **Migration structure** — all five function signatures identical to
  their newest definers → grants persist (no grant statements needed).
  Cascade FKs (`character_saves`, `time_checkpoints`,
  `save_mutation_receipts`, composite) all `ON DELETE CASCADE` →
  reset_character's hard delete drains dependents. `heartbeat_session`
  already tombstone-aware (202609300001:953). `FOR UPDATE` + `LIMIT 1`
  + canonical ordering is coherent (though the ordering is dead code
  under `user_id unique` — covered by W6-COR-1). `v_checkpoint :=
  _issue_checkpoint()` does not clobber `FOUND` (PL/pgSQL binds FOUND
  to the prior SELECT INTO). `reset_character` verified tombstone-
  blind + `_assert_session_protocol` gated + hard-delete + returns
  DELETED/NO_CHARACTER — matches strict client mapping exactly.
- **attemptReconnect reorder** — covered under W6-COR-4: all
  generation-bumping paths enumerated; `'resumed'` while terminal is
  fenced at :467; `reconnectInFlight` re-entry blocked; double-markReady
  idempotent.
- **whenIdle / fail() semantics** — `inFlightPromise` cleared in
  request()'s finally before any whenIdle `.then` runs → retry reads
  post-settle state correctly; `isSameRequest` shares the in-flight
  promise (non-'rejected' → clean return); every route can reach
  'error' (ALLOWED_EDGES) so `fail()` is never edge-blocked; dispose
  safe.
- **CloudSaveCoordinator.resetCharacter → reset()** — non-'unavailable'
  statuses (DELETED, NO_CHARACTER, else) all bump generation, zero
  revision, drain queued resolvers; CAS expected-0 after reset
  confirmed by pin.
- **Repro pins honest** — w5aut: DELETED/NO_CHARACTER/FROBNICATED
  mapping, coordinator reset containment (rev 5→0), firstSave
  permanent-vs-retryable arming — each asserts post-fix behavior and
  fails at 66746ede. w5int: 'rejected' contract + onResume ordering
  (fails pre-fix: pre-fix markReady landed 'ready' before onResume).
  useBootFlow pin: real GamePresentationCoordinator + held curtain
  latch — fails pre-fix (single void request dropped on conflict).
- **Locales** — en/vi destructive copy honest ("Delete Server
  Character"/"Xoá Nhân Vật Server") matches the hard-delete RPC.
  `SupabaseCharacterCreationService` charset message now honest.

## Verification run

```
PATH=/home/linuxbrew/.linuxbrew/opt/node@22/bin:$PATH
npm run type-check                     → PASS (vue-tsc --build, 0 errors)
npx vitest run src/composables/useAppLifecycle.test.ts \
  src/composables/useBootFlow.test.ts src/services/save/w4int.repro.test.ts \
  src/services/save/w5int.repro.test.ts src/services/save/w5aut.repro.test.ts
                                       → 5 files / 74 tests PASS
npx vitest run src/services/session/ src/services/cloudSave/ \
  src/stores/ src/App.routeMountWitness.test.ts
                                       → 26 files / 230 tests PASS
```

## Verdict line

FINDINGS(1 High, 2 Medium, 2 Low, 2 Nit)
