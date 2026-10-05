# Fixpoint audit wave 6 — AUT (authority/boundary confirmation)

Auditor: w6-AUT worker. Base: `codex/hoa-cau-fireball-vfx` @ `1bd0763f`.
Delta under audit: `git diff 66746ede..1bd0763f` (wave-5 adjudicated fixes only —
production files + `w5aut/w5int` repro harnesses + migration `202610070001`).
Read-only on production code; no live Supabase on this box — SQL-side claims are
SOURCE_PROOF (legs quoted with line numbers); client-side claims were verified by
reading + the shipped repro harnesses. Report branch: `devin/w6-aut-report`.

Verification executed:
- `npm run type-check` — clean.
- `npx vitest run src/services/save src/composables src/services/session src/stores src/components/common` — 90 files / 1112 tests green.
- Full read of `CloudSaveCoordinator`, `SupabaseCloudSaveService` (save/load/heartbeat/resetCharacter + mapError taxonomy), `SaveIncompatibleScreen.vue`, `saveIssue` store, `useAppLifecycle` (all load branches + first-save arming), `useBootFlow`, `OnlineSessionController`, migration `202610070001` + all `references public.characters` FKs + the `characters` table definition.

---

## Verdict: FINDINGS (1 High / 1 Medium / 3 Low / 2 Nit)

| ID | Severity | Class | Surface |
|---|---|---|---|
| W6-AUT-1 | High | authority/scope-overreach | firstSave `!retryable` arming covers non-remote-wedge failure classes; remote reset offered on healthy rows |
| W6-AUT-2 | Medium | lifecycle/authority asymmetry | local-mode `attemptReconnect`: `onResume` throw = unhandled rejection + permanent 'reconnecting' (no retry) |
| W6-AUT-3 | Low | stale authority read | `remoteResettable` is a non-reactive const captured at setup from `saveIssue.scope` |
| W6-AUT-4 | Low | surface honesty | FirstSave arming reports `raw: ''` — Export downloads a 0-byte file labelled as the save |
| W6-AUT-5 | Low | misclassification | remote-branch `onResume` throw retried forever as 'unavailable' — a deterministic client fault churns the full reconnect RPC every 10s |
| W6-AUT-6 | Nit | dead predicate | `(deleted_at is null) desc` ordering is inert: `characters.user_id` is UNIQUE — live+tombstone can never coexist |
| W6-AUT-7 | Nit | residual race | `bootFlow.fail()` bounded-3 retry can still dead-drop under ≥3 back-to-back in-flight conflicts |

---

## Findings

### W6-AUT-1 (High) — `unavailable && !retryable` is broader than the wedge it was built for; arms "Delete Server Character" on healthy remote rows

`useAppLifecycle.ts:622-628`: the wave-5 arming for W5-AUT-1 fires on ANY
non-retryable `unavailable` first-save. The intended wedge class is *the server
refused the payload* (`SAVE_INVALID`, `SAVE_SCHEMA_UNSUPPORTED`, `SAVE_TOO_LARGE`
— `SupabaseCloudSaveService.save()` :966-986 maps these from `REJECTED`). But the
same predicate also matches classes where the remote row is NOT the offender:

- **`NETWORK_UNAVAILABLE`** (`mapError` :244-247, `retryable:false` — "the write
  may or may not have committed; only a fresh load resolves that ambiguity").
  A 10s timeout / fetch abort on the first-write POST is a *common* mobile event.
  Result: the recovery screen tells the user their save is corrupted and offers
  `saveIncompatible.actions.resetCloud` = "Delete Server Character". If the write
  in fact committed, the remote row holds revision-1 good data; on connectivity
  return, `reset_character` executes and hard-deletes a healthy character — the
  exact class of defect W5-COR-1 (rated High) fixed one hop earlier in the gate.
- **`CHECKPOINT_*` / `CUTOFF_REGRESSION` / `MUTATION_ID_REUSED`** (`save()` :981-985:
  `SERVER_ERROR` non-retryable). The service's own comment at :979-980 states the
  remedy: "recovery is a fresh authoritative load" — a checkpoint lease that
  expired during a long creation flow self-heals on reload; deleting the
  character is the wrong authority action and the RPC will succeed (network is
  up), so this is a real deletion path, not a dead button.
- **`SESSION_REVOKED` / `PROFILE_MISSING`/`SESSION_INVALID` / `PROTOCOL_OUTDATED` /
  `AUTH_EXPIRED` (no binding)** — auth/protocol faults. Two extra defects ride
  along: (a) `observeSaveResult` (:615) already enters the correct terminal
  (`'revoked'`, `'update-required'`) and the arming's `markFailed('recovery')`
  (:624) then *overwrites* it — `enterTerminal` has no guard, so the authority
  state is misclassified; (b) the destructive affordance is presented where
  `reset_character`'s own `_assert_session_protocol` gate cannot even run.
- **`SAVE_ADAPTER_THROW` / `STALE_GENERATION`** (coordinator `adapterThrow` /
  `staleGenerationResult`, both `retryable:false`) — local artifacts. Mostly
  fenced upstream (the `bootGeneration !== lifecycleGeneration` check at
  :608-611 precedes the arming block for the generation cases), which proves the
  predicate alone cannot distinguish "remote refused the bytes" from "local
  plumbing failed".

Source proof: the discriminating signal that exists — `firstSave.code` — is
computed and discarded; the arming never consults it. Repro (existing harness
shape): in `w5aut.repro.test.ts` `makeStubs()`, set `player.save` to return
`{status:'unavailable', code:'NETWORK_UNAVAILABLE', retryable:false}` → current
code produces `saveIssue.report('corrupted','',undefined,'remote')` +
`markFailed('recovery')` — the destructive remote-scoped surface armed on a
fault where the remote row is provably uninvolved.

Suggested fix direction (for the adjudicator, not implemented — QA write
boundary): arm only on `code ∈ {SAVE_INVALID, SAVE_SCHEMA_UNSUPPORTED,
SAVE_TOO_LARGE}` (the payload-refusal set), and let `observeSaveResult`'s
classification stand for everything else; or pass the RPC-boundary verdict
through so non-payload permanents route to `onError`/`markFailed(code)` — never
to a remote-scoped corruption claim.

### W6-AUT-2 (Medium) — local-mode `attemptReconnect`: `onResume` throw escapes as an unhandled rejection and wedges the session in 'reconnecting' forever

`OnlineSessionController.ts:452-462`: the no-`reconnect` branch runs
`deps.onResume?.('same')` *outside* any try/catch on a `void`-floated promise.
Wave-5 correctly reordered `markReady()` after it under the generation guard,
but the two siblings now disagree on throw semantics:

- Remote branch (:466-489): throw → `catch` → classified 'unavailable' → stays
  'reconnecting' with the 10s retry armed.
- Local branch: throw → rejects `attemptReconnect()` → unhandled rejection; the
  session stays `'reconnecting'` with **no retry ever armed** — `armRetry()`
  (:430-431) early-returns when `deps.reconnect` is absent, `pause()` only calls
  `attemptReconnect` when `deps.reconnect` exists (:234), and the lease/
  heartbeat machinery never runs in local mode.

Reachable: `suspend()` → 'reconnecting' → `resumeFromSuspend()` → the throw.
The `w5int` harness itself notes the real-world trigger (localStorage
`SecurityError` inside `restoreGameSession`) and documents having *observed* the
unhandled rejection — the shipped pin (`w5int.repro.test.ts:187-210`) is lexical
(`indexOf` ordering), i.e. it pins the gap in place rather than the corrected
behavior. Effect: `canMutate()` permanently false, sim frozen, no cadence — the
only escapes are another OS suspend cycle (re-throws) or reload. Severity Medium:
same wedge class as W5-INT-3 in the sibling branch the wave-5 fix left behind.
Fix direction: wrap the local `onResume` in the same try/catch; since local mode
has no retry cadence, the throw should route to an acknowledgeable terminal
surface rather than silent 'reconnecting'.

### W6-AUT-3 (Low) — `remoteResettable` captured non-reactively; a second `report()` while mounted leaves the destructive gate on stale scope

`SaveIncompatibleScreen.vue:31`:
`const remoteResettable = remoteAuthoritative && saveIssue.scope === 'remote'`
evaluates once at setup. `report()` (`stores/saveIssue.ts:30-44`) always
overwrites `scope` (default `'remote'`), so the store's single slot is
newest-issue-wins — but the gate does not follow: a 'remote' report mounting the
screen keeps `remoteResettable=true` even if a later 'local'-scope report lands,
and vice-versa (remote→local flip = "Delete Server Character" armed on a healthy
row; local→remote flip = destructive leg wrongly hidden → reload-loop).

Reachability check (why Low, not High): every `report()` call site sits behind a
terminal transition or generation fence — `useAppLifecycle:402/422/463` (load
branches end in `boot.fail()` + return), `:626` (first-save arming), `App.vue:676`
(resume-reject inside `onResume`, killed by the generation bump if authority
already went terminal). `saveIssue.clear()` has no production caller, but the
screen unmounts whenever `entryStage` leaves 'error', and re-mount re-evaluates
the const. Within one mount, no second report can currently arrive — the hazard
is latent: any future "retry boot in place" affordance or a new report() caller
silently re-opens W5-COR-1. Fix direction: `computed` (or re-read `saveIssue.scope`
inside `handleReset` at click time).

### W6-AUT-4 (Low) — FirstSave arming exports a 0-byte artifact presented as the save

The arming reports `raw: ''` (`useAppLifecycle.ts:626`). `handleExport`
(`SaveIncompatibleScreen.vue:51-58`) passes it to `exportSaveToFile`
(`SaveSystem.ts:707-722`) which wraps `new Blob([''])` — a 0-byte `.json`
download labelled "Download Save (.json)". A user told "save corrupted" can
believe they preserved their data while exporting nothing; the actual
recoverable artifact (the rejected starter snapshot in the local envelope) is
not what gets exported. Same dishonesty class as the 'corrupted' body copy for
what is a write-*rejection*, not corruption. Low: no data is destroyed by the
export itself, but the surface lies about the object it claims to preserve.
Fix direction: omit/disable Export when `raw === ''`, or export the local
envelope explicitly labelled as such.

### W6-AUT-5 (Low) — remote-branch `onResume` throw = unbounded retry of the full reconnect pipeline

`OnlineSessionController.ts:486-488`: a throwing `onResume` (client-side restore
fault, deterministic) is swallowed by the pipeline `catch` and classified
'unavailable' — the 10s retry interval then re-runs the *entire* reconnect RPC
pipeline (transport → auth → heartbeat → load → reconcile) forever. Safer than
the pre-fix fake-ready, but a permanent client bug masquerades as transient
authority loss: unbounded server churn + perpetual 'reconnecting' overlay, and
nothing ever surfaces the real failure. Fix direction: distinguish pipeline
throw from post-pipeline (`onResume`) throw — the latter is a local terminal
fault, not an authority loss (e.g. `enterTerminal('recovery')` or a bounded
retry count before surfacing).

### W6-AUT-6 (Nit) — canonical `(deleted_at is null) desc` ordering is inert under `characters.user_id UNIQUE`

`characters.user_id uuid not null unique` (`202608240001:43`, never dropped in
any later migration — checked all `alter table public.characters` /
`drop constraint` sites) means at most ONE row per user exists, tombstone or
live. The wave-5 premise in the migration header ("a live row coexisting with a
tombstone", `202610070001:6-9`) is schema-impossible: the ordering added to
`load_game_state`/`write_character_save`/`reset_character` can never pick between
two rows, and `FOR UPDATE ... LIMIT 1` always locks the single row — which is the
correct row, so no defect, but the claimed invariant the ordering defends does
not exist. Harmless dead-defence; keep-or-simplify is an adjudicator call.
Adjacent truth the ordering hides: two *concurrent* `create_character` calls
(same user, different names) race the `exists()` check at `202610070001:383` —
the loser hits `user_id` unique_violation → raw 500 → `SERVER_ERROR`
non-retryable at the client instead of `CHARACTER_EXISTS`. Narrow, self-healing
on retry, pre-existing shape — Nit.

### W6-AUT-7 (Nit) — `bootFlow.fail()` bounded retry can still dead-drop; `whenIdle` no-ops on non-conflict rejects

`useBootFlow.ts:98-108`: three attempts, `whenIdle()` between. Two residual
edges: (a) ≥3 back-to-back in-flight transitions still drop the terminal error
route (boundedness trades the old silent-drop for a bounded silent-drop); (b)
`coordinator.request` has several `status:'rejected'` causes beyond in-flight
conflict (`GamePresentationCoordinator.ts:156-225` — disposed/terminal/dedup);
when the reject is not in-flight, `whenIdle` resolves immediately and the loop
burns all three attempts instantly. Both narrower than the pre-fix hole the
change closed — Nit, recorded for completeness.

---

## Negative results — what was attacked and held

1. **`reset()` on `'absent'` does not wipe a live revision** — remote-'absent' is
   `NO_CHARACTER` ground truth: a live local revision against a genuinely-absent
   remote row is already incoherent (revision>0 requires a prior committed row),
   so zeroing revision/generation/queue is the correct reset, not a wipe of live
   state. The local-adapter fabricated `'absent'` (`CloudSaveCoordinator.ts:88-90`)
   is unreachable in product code — the only `resetCharacter` caller is the
   recovery screen, gated by `remoteAuthoritative`. Queued writers drained via
   `staleGenerationResult` → `observeSaveResult` → terminal-aware (already
   'recovery'). Clean.
2. **Unknown RPC status → `unavailable` retryable `SERVER_ERROR` aborts cleanly** —
   `SaveIncompatibleScreen.vue:78-81`: error notification + early return; screen
   stays mounted, button retryable, coordinator NOT reset (remote may exist) —
   conservative direction is correct; no wedge, no retry storm (single await,
   user-driven).
3. **'local'-scope report cannot reach `remoteResettable`** — gate requires
   `scope === 'remote'`; pending-conflict/quarantined report 'local'
   (`useAppLifecycle.ts:422`); the destructive leg is structurally excluded.
   Second-report overwrite semantics: unreachable within one mount (see AUT-3);
   across mounts, latest report owns the surface — consistent single-slot
   authority.
4. **Tombstone-only `reset_character` → DELETED → 'deleted' → reload →
   `NO_CHARACTER` → 'empty' → `requireCharacter`** — same destination as
   'absent'; lifecycle routing consistent (`SupabaseCloudSaveService.load`
   :623-633, `useAppLifecycle` :389-397, :425-428). `FOR UPDATE ... ORDER BY ...
   LIMIT 1` locks the returned (only) row — correct. All four
   `references public.characters` FKs `on delete cascade` (saves :202608240001:70,
   checkpoints/receipts :202609300001:173,194; receipts' checkpoint_id `set
   null`) — hard delete cannot FK-fail.
5. **`generation === this.generation` is the right discriminator** — every
   ownership change (`acknowledge`, `stopAll`, `markFailed`, `pause`,
   `enterTerminal`) bumps `generation`, so an `onResume` that delegates to any
   of them correctly suppresses the trailing `markReady()`; a same-generation
   `onResume`-internal `markReady` is idempotent (transition/arm guards). Held.
6. **`w5aut`/`w5int`/`useBootFlow` pins are behavioral post-fix pins** — revert
   the fixes and they fail: `FROBNICATED` → 'absent' would fail the strict-map
   `toEqual` (:132-145); coordinator passthrough revert leaves `getRevision()===5`
   (:181-209); arming revert never calls `report` (:292-330), with the retryable
   sibling as the negative control (:332-373); `fail()` retry is exercised
   against a real in-flight transition (`useBootFlow.test.ts:87-117`). Gap
   noted: coordinator-side `'absent'`→`reset()` leg is unpinned (service-level
   `NO_CHARACTER→absent` pin exists; the containment pin covers only 'deleted').

## Residual / out-of-scope notes

- `remoteAuthoritative` in `handleExport` (:55) reads `getRevision()` live — fine
  for the remote path; on the FirstSave-arming surface the revision is
  misleading-but-harmless metadata on an empty artifact (folded into AUT-4).
- `w5int` notes its own lexical-pin weakness; AUT-2 is the defect that pin
  freezes in place.
- All SQL legs verified by source only — no live Supabase on this box; the
  wave-5 disposition records staging/beta application of `202610070001`.
