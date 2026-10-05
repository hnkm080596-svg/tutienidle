# Fixpoint wave-5 CORRECTNESS audit — codex aggregate

Branch `codex/hoa-cau-fireball-vfx` @ `66746ede` (report branch
`devin/w5-cor-report`). Auditor role: COR — adversarial correctness
review of the **wave-4 delta** (`git log 0afd0b2f..66746ede`):
migrations `202610060001` (nodeLevels guard + `CHARACTER_NAME_INVALID`
split) + `202610060002` (`reset_character` RPC hard-delete),
`App.vue` onResume reject → `bootFlow.fail()`, `useAppLifecycle`
'deleted' → `requireCharacter`, `SaveIncompatibleScreen` remote reset +
reload, `CloudSaveService`/impl/Coordinator `resetCharacter`,
`SupabaseCharacterCreationService` `invalid_name`, w4 pin/repro tests.

Method: full source trace of every dispatched attack vector + a 12-pin
witness suite (`tests/architecture/w5corResetSurfaceScope.qa.test.ts`,
all green — each pin asserts one defect leg at HEAD). Prior waves'
findings are NOT re-litigated; only the post-fix state was attacked.

## Verdict

**The wave-4 delta is NOT clean: 1 High, 2 Medium, 4 Low, 1 Nit.**
The `reset_character` fix itself is correct at the RPC layer — locking,
idempotence, cascade, and session binding all hold — but its single UI
consumer now presents a character-deleting RPC behind a confirm dialog
whose copy promises the server data survives, and mounts that button on
surfaces where the remote save is healthy. Separately, the 'deleted' →
creation route added in the same commit rests on a factually false
premise: none of the uniqueness checks it depends on ignore tombstones.

Under the fixpoint threshold ruling (`1a0f133f` — stop once no Medium+
remains), **W5-COR-1/2/3 block the next adjudication round.**

## Findings

### W5-COR-1 (High) — Remote reset fires on surfaces whose remote save is HEALTHY

`useAppLifecycle.ts:406-417` routes `pending-conflict` and
`pending-quarantined` — **local-envelope states** — through the same
`saveIssue.report('corrupted', loaded.pendingRaw)` + `boot.fail()` as
remote corruption. Both statuses mean the remote `character_saves` row
parsed fine and is the valid head:

- `pending-conflict` = the local pending record diverged from a remote
  head that moved past it (ordinary lost-ACK replay / CAS window).
- `pending-quarantined` = a pending record was parked for identity/bind
  mismatch or replay-reject; the remote row is the healthy save of the
  server's current character (a corrupt remote row never reaches this
  status — `load()` maps it to `incompatible`/`corrupted` first).

The mount is the same `SaveIncompatibleScreen`, whose remote leg
(`SaveIncompatibleScreen.vue:54-87`) gates only on
`remoteAuthoritative` — a capability constant — and then calls
`cloudSaveCoordinator.resetCharacter()` → `delete from public.characters`
(`202610060002:31-36`), cascading the save row, checkpoints and receipts
of a **healthy** character. Pre-wave-4 the same button was a local-cache
clear that could never destroy server data. The component cannot tell
"the corrupt bytes live server-side" (its own comment, `:20-24`) from
"the pending record lives local-side"; the lifecycle comment at
`:411-412` even describes the designed fix for this class — *"deleteSave
drops the envelope keys so a resolved pending never wedges the next
boot"* — i.e. a LOCAL drop, which the new remote delete now precedes.

Consequence: irreversible, total character loss server-side on a
diagnosable local-envelope state, behind a confirm whose copy (below)
actively denies it. Reachable through ordinary network-loss flows, no
crafted input needed.

- Evidence: pins `useAppLifecycle routes pending-* to the same surface`,
  `fires resetCharacter on adapter capability alone`,
  `reset_character hard-deletes` — all green at HEAD.
- Fix sketch (audit scope — not applied): gate the remote leg on the
  reported class (only `incompatible`/`corrupted` remote rows), or carry
  the status through `saveIssue.report` and keep the pending-surface
  reset local-only.

### W5-COR-2 (Medium) — Reset confirm copy promises the server save survives

`saveIncompatible.confirm.resetCloudBody` (vi.json:1874:
*"Save trên máy chủ không bị xoá — nếu dữ liệu server vẫn lỗi, màn hình
này sẽ hiện lại."* / en.json:1874: *"The cloud save is not deleted — if
the server data is still corrupt, this screen will return."*) was written
for the pre-wave-4 reset (local clear + remote reload). Post-wave-4 the
action **hard-deletes the whole `characters` row** — more than the save —
and the screen *cannot* "return": the account lands on character
creation. The button label "Tải Lại Từ Cloud" (Reload From Cloud)
similarly understates the action. The dialog is the user's consent basis
and it is false on every remote surface, intended ones included.

The sibling `panels.settings.confirm.resetCloudBody` (vi.json:807) makes
the same promise but remains true — `resetSaveFromSettings`
(App.vue:803-815) is still local-only. Only the `saveIncompatible.*` keys
are stale.

- Evidence: pins `saveIncompatible confirm copy claims the server save
  is not deleted` (vi + en) + `the screen consumes exactly that copy
  key` — green.
- Fix sketch: rewrite the remote-arm copy to state that the remote
  character is deleted permanently (and that recovery restarts from
  creation), or add a distinct destructive-confirm for it.

### W5-COR-3 (Medium) — 'deleted' → `requireCharacter()` dead-ends on a false premise

`useAppLifecycle.ts:386-392` routes `deleted` to `boot.requireCharacter()`
with the comment *"create_character ignores deleted rows"*. It does not:

- `create_character`'s `exists (select 1 from public.characters where
  user_id = ...)` (`202610060001`) has **no `deleted_at` predicate** → a
  tombstoned account gets `CHARACTER_EXISTS` on every submit; the client
  maps it to *"Nhân vật đã tồn tại trên máy chủ — tải lại để tiếp tục."*
  (SupabaseCharacterCreationService.ts:36) → reload → `deleted` →
  creation → `CHARACTER_EXISTS` → **infinite loop**, worse than the
  honest terminal error it replaced.
- `characters_reserved_name_unique` (202608240001:67) is a plain unique
  index — the tombstone's normalized name also stays taken, so even a
  hypothetical bypass of the exists-check dies on name availability.
- `is_character_name_available` (202608240001:116-126) likewise has no
  `deleted_at` filter.

Reachability: `deleted` needs a tombstone producer; none exists in-repo
today — but `deleted_at`/`permanent_delete_after` are designed columns
and `docs/online-login-cloud-save-plan.md:54-55,120-125` specifies the
7-day soft-delete flow this state exists for. The route is dead the
moment any producer ships, and the comment is wrong today.

- Evidence: 4 pins green (`exists-check has no deleted_at`, index not
  partial, `is_character_name_available` unfiltered, routing arm).
- Fix sketch: either keep `deleted` terminal (the 7-day-reservation
  design arguably wants that), or add `deleted_at is null` predicates +
  a partial-unique index — a schema decision, not an audit call.

### W5-COR-4 (Low) — `bootFlow.fail()` is droppable while a transition is in-flight

`useBootFlow.ts:97-99` fire-and-forgets `coordinator.request({target:
'error'})`; `GamePresentationCoordinator.request` rejects any request
conflicting with an in-flight transition
(`GamePresentationCoordinator.ts:209-215`) — no retry, no `clearError`,
the `void` swallows the rejection. A resume-reject landing inside a
user-initiated route transition (combat entry / curtain animation during
the reconnect RTT) leaves `entryStage` on the transition's target →
`SaveIncompatibleScreen` never mounts → the `saveIssue.report` write is
dead in exactly the same window W4-INT-1 fixed. Recovery still converges
(the terminal authority overlay 1950 → re-auth → next boot's own corrupt
path reports and gates), so the harm is a UX roundtrip, not data loss —
hence Low. The stale-status hijack half of W4-INT-1 is now contained:
the only exit from the mounted gate is reset→reload, which clears the
in-memory store.

- Evidence: pins `fail() fire-and-forgets coordinator.request` +
  `rejects a conflicting in-flight request` — green.
- Fix sketch: retry the error request once the transition settles
  (subscribe to `inFlightPromise` resolution), or give the coordinator a
  force-route for terminal surfaces.

### W5-COR-5 (Low) — `reset_character` skips the protocol gate

Every peer RPC in the boundary layer (`heartbeat_session`,
`load_game_state`, `write_character_save`, `create_character`) asserts
`_assert_session_protocol`; `reset_character` uses
`_assert_session_locked` — a stale-protocol session is denied every
mutation *except* deleting its own character. Defensible for a recovery
op, but undocumented and asymmetric; if intentional it deserves a
comment, if not it is a one-word gap. Separately: `response.status ===
'DELETED' ? 'deleted' : 'absent'` maps any future/unexpected status to
'absent' → proceeds to local reset + reload — harmless today (only two
statuses exist).

### W5-COR-6 (Low) — 'invalid_name' hint covers only length

`CHARACTER_NAME_INVALID` (length **or** charset) maps to *"Đạo danh phải
dài 2–20 ký tự."* (SupabaseCharacterCreationService.ts:40) — a charset
rejection shows a length-only hint. Same asymmetric-diagnostic class as
W4-INT-3 (the name_taken half was split off correctly); harmless — the
name is actually free. Also W4-INT-2 restated: the resume path still
reports `JSON.stringify(save)` (normalized/clamped bytes, App.vue:676)
where every other caller passes `loaded.raw` — now reachable because the
surface mounts; the Export button on a resume-reject hands out
re-serialized bytes, not the server's.

### W5-NIT-1 — Doc/comment mislabels of the hard delete

"soft-delete" wording survives into comments describing the new RPC:
migration `202610060002` header (*"reset_character soft-deletes... the
deleted_at tombstone unblocks fresh creation"* — no tombstone exists,
the row is gone), `SaveIncompatibleScreen.vue:66` (*"reset_character
soft-deletes it"*), `useAppLifecycle.ts:387`, service interface
comments. Actively misleading to operators (implies a recoverable
window + tombstone semantics that were deliberately rejected two lines
later in the same file).

## Verified holds (attacked, no defect)

- **z-order contract**: `saveGate` 4000 covers the authority terminal
  overlay 1950 — both mount post-fail(), the gate wins by documented
  layering (`OverlayLayers.ts`). The W4-INT-1 surface is genuinely
  reachable now.
- **Journal identity binding**: `journal.read` is strict-identity — a
  pending record for a deleted C1 quarantines on C2's load rather than
  replaying onto the fresh character; the server-side checkpoint binding
  (`CHECKPOINT_INVALID`) and CAS independently stop it.
- **Idempotent double reset**: `DELETED` → `NO_CHARACTER` → client
  'absent' → proceeds; no wedge.
- **Lock order**: session → character everywhere; reset serializes
  against in-flight `write_character_save`/`create_character`; a write
  that lost the race gets `NO_CHARACTER` → 'unavailable' (consistent).
- **Auth surface**: `grant execute to authenticated` only; anon 403;
  wrong/revoked session → `_assert_session_locked` → `SESSION_REVOKED` →
  'unavailable' non-retryable.
- **REJECTED NO_CHARACTER on write**: clears the matching journal record
  (`reconcilePendingSave` 'character-missing' arm) — no residual wedge.
- **`deleteSave()` envelope coverage**: save key + handoff + revision +
  all journal/acked/quarantine keys — reset leaves nothing behind.
- **Offline reset**: `binding()` null → 'unavailable' AUTH_EXPIRED;
  RPC throw → `mapError` → notification + **no reload** — correct.
- **'empty' vs 'deleted' routing**: identical `requireCharacter()` — the
  intended parity holds (the defect is in what the target can do, COR-3).
- **nodeLevels guard**: present-non-object → `SAVE_INVALID` before
  `jsonb_each` (no more unhandled exception); `null`/absent skip cleanly;
  residual accept-classes (non-number/zero/negative values, nested
  claims) are the adjudicated wedge class — now *destructively*
  recoverable via remote reset rather than permanently wedged.
- **Talent rolls after reset**: `create_talent_roll` mints user-bound
  rolls independent of characters; `create_character` consumes via
  `consumed_at` — fresh roll → fresh create works (pinned by the w4
  contract spec `resetCharacter.spec.ts`, needs live env to run).
- **`markResetNotice`/`consumeResetNotice`**: sessionStorage one-shot,
  consumed on the auth card after reload — continuity notice correct.
- **Heartbeat post-reset**: returns `OK` with null checkpoint on
  NO_CHARACTER — no flap; the screen always reloads anyway.
- **SaveIncompatibleScreen is the sole `resetCharacter` consumer**
  (grep-verified); the settings-panel reset stays local-only.

## Repro harness

`tests/architecture/w5corResetSurfaceScope.qa.test.ts` — 12 pins, all
green at `66746ede`. Re-run: `npx vitest run
tests/architecture/w5corResetSurfaceScope.qa.test.ts`. The pins assert
the defect mechanisms at HEAD (wiring + SQL + copy facts); a fix inverts
them — e.g. a status-gated remote leg makes `fires resetCharacter on
adapter capability alone` fail until the pin is updated.

Also green this session: `w4aut.repro.test.ts` (48), `w4int.repro.test.ts`
(5), `w4corSaveBoundaryMirror.qa.test.ts` + `saveBoundaryMirrorParity`
(`npx vitest run` of all four = 53 incl. 1 expected-fail marker).

## Finding ledger

| ID | Severity | Surface | Summary |
|---|---|---|---|
| W5-COR-1 | High | `SaveIncompatibleScreen` + `reset_character` | Remote reset reachable on pending-conflict/pending-quarantined — hard-deletes a healthy remote character; regression vs prior local-only reset |
| W5-COR-2 | Medium | `saveIncompatible.confirm.resetCloud*` copy | Confirm promises "server save not deleted / screen returns" — false on every remote surface post-wave-4 |
| W5-COR-3 | Medium | `useAppLifecycle` 'deleted' arm | Routes to creation, but `create_character` + name checks ignore `deleted_at` → tombstoned account loops CHARACTER_EXISTS forever; comment premise false |
| W5-COR-4 | Low | `bootFlow.fail()` / coordinator | In-flight transition rejects the error-route request; resume-reject surface can stay a dead write (convergent via re-auth) |
| W5-COR-5 | Low | `reset_character` | No `_assert_session_protocol` gate (peers have it); non-DELETED response maps to 'absent' |
| W5-COR-6 | Low | `SupabaseCharacterCreationService` | `invalid_name` message covers length only (charset half silently misled); W4-INT-2 normalized-raw export now reachable |
| W5-NIT-1 | Nit | comments/headers | "soft-delete"/"tombstone" wording on a hard delete (migration header, screen comment, service comments) |
