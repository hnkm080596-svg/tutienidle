# Fixpoint audit wave 5 — AUT (authority/consistency)

Auditor: w5-AUT worker. Branch `codex/hoa-cau-fireball-vfx` @ `66746ede` (wave-4 tip).
Read-only on production code; no live Supabase on this box — every SQL-side claim is
SOURCE_PROOF (legs quoted with line numbers); client-side claims are executable and
pinned in `src/services/save/w5aut.repro.test.ts` (12 tests, all green) +
`npm run type-check` clean, on `devin/w5-aut-report`.

Wave-4 delta under audit (`git log 0afd0b2f..66746ede` — one commit, `66746ede`):
- `supabase/migrations/202610060001_beta_save_boundary_hardening.sql` —
  `player.nodeLevels` non-object guard in `_check_save_payload` (:219-222) and the
  `CHARACTER_NAME_INVALID` / `CHARACTER_NAME_UNAVAILABLE` code split in
  `create_character` (:316-321).
- `supabase/migrations/202610060002_beta_character_reset.sql` — new
  `reset_character(p_session_id)` security-definer RPC: `_assert_session_locked`
  → character row `for update` → `delete from public.characters` → DELETED /
  NO_CHARACTER.
- Client wiring: `SupabaseCloudSaveService.resetCharacter` (:533-548),
  `CloudSaveCoordinator.resetCharacter` (:83-85), `SaveIncompatibleScreen`
  `handleReset` (remote RPC → `deleteSave()` → `markResetNotice()` → reload),
  `useAppLifecycle` `deleted` → `requireCharacter`, `App.vue` onResume
  `bootFlow.fail()` on live-replacement reject.

Verification executed:
- `npx vitest run src/services/save/w5aut.repro.test.ts` — 12/12 pass.
- `npx vue-tsc --noEmit -p tsconfig.json` — clean.
- Full read of the two migrations, `SupabaseCloudSaveService` (993 lines),
  `CloudSaveCoordinator`, `SaveIncompatibleScreen.vue`, `useAppLifecycle.ts`,
  `SupabaseCharacterCreationService`, `SupabaseSession.ts`, `SupabaseHttp.ts`,
  `SaveSystem.deleteSave`, `PendingSaveJournal`, plus every `references
  public.characters` FK across `supabase/migrations/`.

---

## Focus-area results — what was attacked, what held

**(1) reset_character concurrency / cascade / idempotency / revoke→reset — holds.**

- *Same-user concurrent write vs reset:* serialized, no deadlock. Every RPC
  takes locks in the same order — profile (`_lock_caller_profile`) → session
  (`_assert_session_locked`) → character `for update`
  (`202609300001:224-296`; reset at `202610060002:14-27`). A write holding the
  chain commits or aborts before reset's `delete` runs; a reset landing first
  makes the write's own character select find nothing → `NO_CHARACTER` reject
  (`202609300001:782+`). Two genuinely concurrent sessions can't exist:
  `account_sessions_one_active_per_user` is a unique index on
  `revoked_at is null` — a second login's `claim_active_session` revokes the
  first session, so the "session B writes while session A resets" window is
  closed at the claim layer.
- *FK cascade completeness:* every table with `references public.characters`
  cascades — `character_saves` PK FK (`202608240001:70`) plus the composite
  `character_saves_owner_is_character_owner` (`202609300001:160-163`; NOT VALID
  still enforces delete actions), `time_checkpoints` (:173),
  `save_mutation_receipts` (:194). `feedback_reports.character_id`
  (`202609300004:91`) is a bare uuid with no FK — dangling attribution rows by
  design ("Absent character or save row stores NULLs"). `talent_rolls` is
  user-scoped, no character FK — survives intentionally. `save_inventory` is a
  view (`_classify_save_row`, `202609300001:1041+`) — nothing to cascade.
  `profiles` is account-level and correctly survives. **No cascade miss.**
- *Idempotency:* second call returns NO_CHARACTER → client maps to `'absent'`
  → same `deleteSave()` + reload path. Verified executable.
- *Pending-journal resurrection:* pending records bind
  `{environmentId,userId,characterId}`; after delete, load sees NO_CHARACTER →
  `quarantinePending('character-missing')`; a recreated character gets a new
  uuid → char-id mismatch → quarantine; the checkpoint leg (`character_id <>`)
  → CHECKPOINT_INVALID. No replay path can stamp the old save onto char #2.
  Mutation receipts cascade with the character, so a reused `mutation_id` can't
  false-positive MUTATION_ID_REUSED after reset.
- *Revoke→reset:* revoked session → `'session revoked'` (28000) → PostgREST 400
  → `mapError` detail match (:225) → SESSION_REVOKED non-retryable → screen
  aborts with the message. Escape exists but is indirect — see W5-AUT-4.
- *Cross-user safety:* the RPC only ever touches `v_session.user_id` derived
  from `auth.uid()` — `p_session_id` from another user's session can't pass the
  assert. `grant execute` is `authenticated` only. Reset is deliberately NOT
  protocol-gated (`_assert_session_locked`, not `_assert_session_protocol`) so
  a stale client can still recover — correct.

**(2) create_character after hard-delete — holds.**

- `exists(characters where user_id)` (:295) runs under the profile lock before
  the roll is taken `for update` (:298-300) — serialized against a concurrent
  create/reset; the `characters.user_id` unique constraint backstops anyway.
- `consumed_at` is set only on success (:334); a roll that was minted but never
  consumed before the reset remains consumable by the next create (same user,
  still bound to `talent_ids[1:3]`) — harmless reuse, no cross-account leak.
- `normalized_name` is freed by the hard delete (the unique index is global,
  not partial) → name reuse works.
- `is_character_name_available` probe + `CHARACTER_NAME_INVALID` /
  `CHARACTER_NAME_UNAVAILABLE` split verified — see W5-AUT-5 for the residual
  charset-divergence nit.

**(3) nodeLevels guard boundary — the crash class is dead; deep legs stay residual.**

The guard (:219-222) correctly precedes the `jsonb_each` scan (:245) and the
`hoa_linh_ngo` leg (:252-261); a non-object value can no longer raise inside a
set-function. Boundary table (server = SOURCE_PROOF on cited legs; client =
EXECUTED through `validateGameSaveShape`):

| Shape | Server | Client | Verdict |
|---|---|---|---|
| key absent / `{}` | accept | accept | consistent |
| `null` / `[]` / `"x"` / `5` | SAVE_INVALID :219-222 | reject (isObject) | consistent — W4 fix works |
| `{"zz": {"a":1}}` nested object | accept (non-number values skipped :246) | reject :1840-1844 | residual class — recoverable via reset |
| `{"zz": "x"/null/true/-1}` | accept | reject (non-finite / `<0`) | residual — recoverable |
| `{"thuy_linh_ngo": 0.5}` | accept (`>=1` leg :247 skips) | reject (registered node, non-integer :1890+) | residual pin ✓ |
| `{"thuy_linh_ngo": 1}` | reject :243-251 | reject (element mismatch) | consistent |
| `{"hoa_linh_ngo": 1}` w/o committed pair | reject :252-261 | reject | consistent |
| `{"core_fake": 1}` | accept (no core leg) | reject (:1851-1858) | residual pin ✓ |
| `{"zz": 0.5}` unknown key, fractional | accept | accept (undefined node → continue) | consistent |

All residuals are members of the already-enumerated W4-AUT-2 class — now
recoverable through `reset_character` because a `'ready'`-classified remote row
that fails client shape lands on `SaveIncompatibleScreen`, which mounts the
reset affordance. No *new* class found in the nodeLevels surface.

**(4) client resetCharacter() path — mapping verified; two gaps, below.**

- Service (:533-548): binding-miss → `'unavailable'` AUTH_EXPIRED
  non-retryable; RPC `DELETED`→`'deleted'`, **any other status → `'absent'`**
  (:544 — pin; swallows contract drift); transport/raise → `mapError`.
- Coordinator (:83-85): bare passthrough — does **not** bump generation, zero
  revision, drain the save queue, or clear the adapter's `characterId`/
  checkpoint (contrast `reset()` :183-193 which does all of it). See W5-AUT-3.
- Screen: `unavailable` aborts with the mapped message; `deleted`/`absent` →
  `deleteSave()` (clears SAVE_KEY + IMPORT_HANDOFF + REVISION + every
  envelope key for the account slot — journal/acked/quarantine across all
  environment ids, `SaveSystem.ts:671-698`) → `markResetNotice()` →
  `window.location.reload()`. No swallowed errors: every non-success maps to a
  visible `unavailable` toast.

**(5) wedge classes reset_character cannot reach — one real gap found.**

See W5-AUT-1: the recovery surface mounts only via `saveIssue.report` →
`saveIssue.status` (`App.vue:1176-1190`). The `CHARACTER_UNINITIALIZED` stage's
first-write failure lands on the *generic* error surface instead, so a
deterministic write rejection wedges the account with no reset affordance —
one stage earlier than the W4-AUT-1 class the wave-4 fix targeted.

---

## Findings

### W5-AUT-1 — the reset surface is unreachable from the pre-first-save stage (Medium)

Chain (each hop verified):

1. `create_character` provisions the character row but no save row
   (`202610060001:329-333` — design: first write is `expected_revision=0`).
2. Next boot: `load_game_state` → `CHARACTER_UNINITIALIZED`; client routes
   `'uninitialized'` → grants → `onNewCharacter` → first save
   (`useAppLifecycle.ts:538-598`).
3. If `write_character_save` returns `REJECTED` (e.g. `SAVE_INVALID`,
   `SAVE_TOO_LARGE`), the service maps it to `'unavailable'`,
   `retryable: false` (`SupabaseCloudSaveService.ts:966-986`).
4. `bootGame` calls `onError` + `boot.fail()` (:609-615) → `entryStage =
   'error'` — but `saveIssue.report` is **never** invoked.
5. `SaveIncompatibleScreen` mounts only when `saveIssue.status` is set
   (`App.vue:1176-1190`). The generic error surface offers only a
   back-to-auth button — no reset path.
6. Re-auth → `load` → still `CHARACTER_UNINITIALIZED` → the dirty-transaction
   guard resolves to `hardReset()` + reload (pinned by
   `useAppLifecycle.test.ts:538-574`) → same rejection → loop.

Result: an account in this state is operator-only recoverable, while
`reset_character` sits unused. This is the W4-AUT-1 wedge shape, shifted one
stage earlier — W4's premise "every residual class reaches the recovery
surface" fails exactly where the save row doesn't exist yet.

Trigger honesty: today there is no *known* writer overshoot — the w4 mirror
makes the server's accepted set a superset of the client's emitted set for the
starter snapshot. The class fires when any future drift makes the server
reject a legitimate first write (`SAVE_TOO_LARGE` on a bloated starter
payload, a new server leg, a schema gate). The mirror's own existence is the
argument that such drift is worth defending against — and this stage is where
the defense is missing.

Fix options for the coordinator: (a) in `useAppLifecycle`, when the first save
of an `'uninitialized'` boot is a non-retryable `unavailable`, route it through
`saveIssue.report('corrupted', …)` so the reset surface arms; (b) add a
reset affordance to the generic error surface when `remoteAuthoritative`; or
(c) accept and document operator-only recovery for this stage.

Evidence: EXECUTED — `w5aut.repro.test.ts` "first-save rejection never arms
the recovery surface" (asserts `saveIssue.report` never called, `boot.fail`
called); SOURCE_PROOF for the stage chain.

### W5-AUT-2 — `reset_character` is blind to tombstones; stale "soft-delete" docs invite creating one (Low)

The RPC selects `where user_id = … and deleted_at is null` (`202610060002:24`).
`deleted_at` has **no writer in the repo** — it exists for the documented
B1.10 operator tombstone flow (the load path honors it at
`202609300001:657-662` → `CHARACTER_DELETED`; `write_character_save` gates on
it; `permanent_delete_after` and the `character_deleted` view column are
equally write-dead).

If an operator ever sets `deleted_at` (the documented way to retire a
character), the account wedges in a loop the reset RPC cannot see:
load → `CHARACTER_DELETED` → client `'deleted'` → `requireCharacter` →
`create_character` → `exists(user_id)` (unfiltered, :295) →
`CHARACTER_EXISTS` → error → and `reset_character` itself returns
`NO_CHARACTER`→`'absent'` because its own predicate excludes the tombstone —
the recovery tool's blind spot is exactly the state it was built around.

Amplifier: the wave-4 migration header and client comments call this
"soft-delete"/"tombstone" (`202610060002` header; `CloudSaveService.ts:111`;
`CloudSaveService` type comment on `CloudSaveResetResult`;
`useAppLifecycle.ts:387-389`; `SaveIncompatibleScreen.vue:66`) while the code
hard-deletes. The stale docs literally describe the operator action that
creates the unresettable wedge.

Trigger is operator/deployment-dependent (no client path sets `deleted_at`) →
Low by the W4-AUT-7 precedent. Fix is one token: drop the `and deleted_at is
null` predicate so the delete also clears tombstones.

Evidence: SOURCE_PROOF (migration :24 vs the unfiltered exists-check and the
CHARACTER_DELETED leg).

### W5-AUT-3 — `CloudSaveCoordinator.resetCharacter` leaves stale revision/identity (Low)

`reset()` (:183-193) is the full fence: `generation++`, `revision = 0`,
`service.advanceGeneration()` (clears `characterId` + checkpoint), drains the
queued writer with STALE_GENERATION. `resetCharacter()` (:83-85) does none of
it — a bare passthrough.

Contained today: `SaveIncompatibleScreen.handleReset` is the sole caller and
always reloads the page before any other save can run. But a post-reset
`coordinator.save()` in the same mount would CAS `expected_revision` from the
deleted character's chain and journal under its stale `characterId` — a
landmine for the next caller that forgets the reload. Pin executed:
`w5aut.repro.test.ts` shows `getRevision()` stays 5 after reset and the next
save still passes `expectedRevision=5`.

Fix options: call `this.reset()` inside `resetCharacter` after a deleted/absent
result, or document the reload-only contract at the coordinator level.

Evidence: EXECUTED.

### W5-AUT-4 — revoked/expired session dead-ends on the recovery surface (Low)

When reset returns `'unavailable'` (revoked session, expired auth, profile
missing), the screen shows the mapped message and stays put — but
`SaveIncompatibleScreen` has no re-auth affordance (only export / import /
reset). The stored `sessionId` survives `window.location.reload()`
(sessionStorage, `SupabaseSession.ts:23`), so the escape is: manual reload →
`load` fails SESSION_REVOKED → generic error surface → back-to-auth → re-login
→ `claim_active_session` mints a fresh session → reset now works.

It works, but the user is told "đăng nhập lại để tiếp tục" on a screen with no
button to do it. Fix: surface a back-to-auth action when the reset error code
is SESSION_REVOKED/AUTH_EXPIRED.

Evidence: EXECUTED mapping (`w5aut.repro.test.ts`) + SOURCE_PROOF for the
screen's action set.

### W5-AUT-5 — name charset diverges from the server leg; rejection message mislabels (Nit → Low)

Client: `/^[\p{L}\p{N} _-]{2,20}$/u` (`CharacterCreationService.ts:45`) —
accepts Unicode letters AND all `\p{N}` classes (superscripts like `²`,
full-width letters like `Ｋ`, Vietnamese diacritics). Server:
`trim(p_name) ~ '^[[:alnum:] _-]+$'` (`202610060001:316-319`) — POSIX
`[[:alnum:]]` does not cover `\p{No}` under UTF-8 collations and narrows to
ASCII under `C`/`C.UTF-8`. So names like `Đạo Hữu²` (executable pin:
`isValidCharacterName` → true) can pass the client and the availability probe
(`is_character_name_available` only checks the normalized-name index), then
land `CHARACTER_NAME_INVALID` — mapped to "Đạo danh phải dài 2–20 ký tự",
a length complaint for a charset rejection; the user learns nothing about the
actual disallowed characters.

Self-recoverable (pick another name) → Nit-level UX, noted Low-adjacent only
because the message misdirects.

Evidence: EXECUTED client pin + SOURCE_PROOF for the server leg.

---

## Verified-closed (attacked, held — no finding)

- `reset_character` × concurrent write / claim: identical lock order
  (profile→session→character); single-active-session unique index;
  post-revoke writes fail `session revoked`. No deadlock, no ordering hole.
- Cascade coverage: `character_saves`, `time_checkpoints`,
  `save_mutation_receipts` all `on delete cascade`; `talent_rolls`,
  `profiles`, `feedback_reports` correctly survive (attribution/account-level);
  `save_inventory` is a view.
- Idempotency + local cleanup: NO_CHARACTER→'absent'→same `deleteSave()` +
  reload; envelopes/journal/acked/quarantine keys cleared for the account slot.
- Journal resurrection: identity binding + char-bound checkpoint +
  quarantine → deleted char's pending write cannot land on the successor.
- Post-delete create: exists-check + FOR UPDATE + unique indexes backstop;
  unconsumed rolls legally carry over; `normalized_name` freed.
- Reset RPC reachable from stale clients (no protocol gate) and scoped to
  `auth.uid()` — no cross-user surface.
- `App.vue` onResume live-replacement reject → `saveIssue.report('corrupted')`
  + `markFailed('recovery')` + `bootFlow.fail()` — the *load-side* wedge class
  does reach the recovery surface; W5-AUT-1's gap is specific to the
  pre-first-save stage.

## Residual / excepted notes (no action requested)

- `talent_rolls` has no per-user cap and `create_talent_roll` has no
  character-exists check: an authenticated user can mint unbounded roll rows
  (self-only, consumed-marking bounds reuse). Nit.
- `character_saves_owner_is_character_owner` is NOT VALID — existing rows are
  grandfathered; new writes are enforced. Pre-existing state, unchanged by w4.
- `feedback_reports` for a deleted character keep a dangling `character_id`
  (intended — plain attribution column, no FK).

## Verdict

`FINDINGS` — 1× Medium (W5-AUT-1), 3× Low (W5-AUT-2/3/4), 1 Nit-level Low
(W5-AUT-5). The wave-4 boundary fixes verify: the nodeLevels crash class is
dead, `create_character` post-delete is airtight, and every *load-side* wedge
class now reaches a working remote reset. The remaining Medium is the recovery
surface's coverage gap at the pre-first-save stage.
