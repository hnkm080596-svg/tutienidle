# BETA-FINAL — Production Readiness & Distribution

**Status:** SPEC_READY — implementation has not started

**Mission owner:** Astra

**Target:** Closed Beta, Electron/Windows

**Canonical baseline:** `origin/master @ f1049b5e42757f14aebee18bab3569dc43c37d09`

**Baseline refreshed:** 2026-09-29 (remote fetched before audit)

**Primary backend:** Supabase Auth + PostgreSQL + PostgREST/RPC

**Implementation policy:** one umbrella mission, independently sealed gates, multiple reviewable PRs; never one aggregate implementation PR

**Execution plan:** [Astra implementation plan](../../superpowers/plans/2026-09-29-beta-final-implementation-plan.md)

**Review revision:** 2026-09-29 — authority races, recovery, credential lifecycle, release dependencies and source-consumer census expanded; production gates remain unsealed.

---

## 1. Mission outcome

BETA-FINAL turns the current development build into a distributable Closed Beta whose online authority, build identity, Windows packaging, signing, release/update channel, feedback, diagnostics, operations, and release-candidate evidence are coherent end to end.

The mission is complete only when a signed release candidate installed on a clean Windows machine can use a real dedicated Beta Supabase project to complete this journey without violating any gate below:

```text
install -> launch -> guest/auth -> create character -> first durable cloud save
-> play -> autosave -> close/reopen -> exact restore
-> session revoke and network-loss handling -> reconnect
-> update to the next Beta build -> save survives
-> submit feedback/export diagnostics -> rollback drill -> final certification
```

`npm run verify`, a successful installer build, or a green individual PR is necessary evidence, never Beta certification by itself.

## 2. Scope and non-negotiable constraints

In scope:

- B1 Supabase production backend, auth, guest, active-session authority, remote cloud-save CAS, pending journal, reconnect, and recovery;
- B2 runtime/build identity;
- B3 production packaging and installer metadata;
- B4 Windows code-signing plumbing and real signed-artifact proof;
- B5 deterministic release pipeline, GitHub Release, checksums, and provenance;
- B6 update channel and auto-update UX;
- B7 in-game Beta feedback;
- B8 structured diagnostics and a privacy-safe local report bundle, with a remote-provider boundary;
- B9 Beta operations, health, quota, backup, restore, rollback, and incident runbook;
- B10 clean-machine release-candidate certification against real Supabase.

Hard constraints:

1. Supabase is the save authority in Beta. `localStorage` is cache/recovery/export only.
2. Beta has no silent fallback to mock/local services.
3. Guest is a real persistent Supabase anonymous identity and has cloud save.
4. Every production save read/write is active-session guarded. A valid JWT from a revoked game session is insufficient.
5. CAS conflict never triggers a blind overwrite or automatic gameplay-state merge.
6. Character creation never persists `{}` as a valid remote save.
7. No simulation advances while network/session/save authority is unresolved.
8. One semantic rule/state has one owner; migration removes or explicitly retires the old competing path.
9. Credentials, tokens, raw saves, and signing secrets never enter logs, feedback, diagnostics, artifacts, or Git history.
10. Each gate has its own acceptance evidence and seal. A later gate may consume a sealed contract but may not weaken it.
11. No commit, push, release publication, deployment, signing-secret upload, or production migration is authorized merely by this spec.

Explicit non-goals:

- gameplay/content rebalance;
- broad UI redesign unrelated to the required release surfaces;
- automatic merge of two divergent characters or saves;
- offline play for the Supabase Beta build;
- production remote crash telemetry unless a provider and privacy policy are separately approved;
- retroactive editing of already-applied Supabase migrations;
- claiming bit-for-bit equality for timestamped Authenticode output.

## 3. Re-audit of current `master`

The original working checkout was `qa/beta-2026-09-29` at the same SHA as `origin/master`, with unrelated modified/untracked work. The first audit read the fetched Git object directly. The review/plan PR uses the isolated `codex/beta-final-plan` branch at that same freshly fetched baseline. Unrelated work is excluded.

Evidence labels:

- **SOURCE:** directly observed at the baseline commit;
- **INFERRED:** architectural conclusion from source;
- **EXTERNAL:** depends on credentials, service configuration, hardware, or a human decision not present in Git.

| Gate | Current evidence at `f1049b5e` | Status before mission |
|---|---|---|
| B1 | **SOURCE:** `CloudSaveServiceFactory.ts:8` always constructs `LocalCloudSaveService`; `useAppLifecycle.ts:269` continues on the local slot when remote sync fails; `SupabaseRemoteSave.ts` only reconciles at login; `CloudSaveCoordinator.ts` retries local conflict with last-writer-wins semantics. | BLOCKED for production Beta |
| B1 | **SOURCE:** `AuthServiceFactory.ts:7` and `CharacterCreationServiceFactory.ts:6-9` select mock when Supabase config is absent. | Silent mock fallback exists |
| B1 | **SOURCE:** `SupabaseCharacterCreationService.ts:66` sends `p_initial_save: {}`; migrations insert that payload into `character_saves`. | Fake remote save exists |
| B1 | **SOURCE:** `saves_own_insert` and `saves_own_update` at migration lines 201-202 allow direct PostgREST writes based only on `auth.uid()`; those writes do not call `assert_active_session`. | Revoked-session bypass exists |
| B1 | **SOURCE:** Supabase credentials live only in `sessionStorage`; `saveKeys.ts` maps every guest to the shared `guest` namespace even when it has a Supabase `userId`. | Guest restart/namespace contract fails |
| B1 | **SOURCE:** `useAppLifecycle` already requires the first save before starting clock/tick, and `buildGameSave`, shape validation, acceptance, recovery UI, `save_revision`, and server-owned `updated_at` already exist. | Useful foundations; preserve them |
| B2 | **SOURCE:** `package.json:3` is `0.0.0`; no build ID, Git SHA, channel, backend environment, or identity surface exists. Save schema is `CURRENT_SAVE_VERSION = 87`. | Missing |
| B3 | **SOURCE:** `electron-builder.yml` has NSIS skeleton; line 27 says there is no custom icon. `electron/main.ts:100` references `build/icon.ico`, but no tracked `game/build` asset exists. | Skeleton only |
| B4 | **SOURCE:** no signing configuration or secret contract is tracked. **EXTERNAL:** no certificate evidence is present. | Missing / externally blocked |
| B5 | **SOURCE:** no tracked `.github` release workflow exists; only local `dist:win` is defined. | Missing |
| B6 | **SOURCE:** no `electron-updater` dependency, updater owner, channel, manifest, or update UX exists. | Missing |
| B7 | **SOURCE:** no Beta report submission service/UI exists. Historical comments containing “bug report” are not a feedback system. | Missing |
| B8 | **SOURCE:** Vue error boundary/store display only the current message; no structured ring buffer, main/renderer crash aggregation, redaction, or diagnostic bundle exists. | Partial local error UI only |
| B9 | **SOURCE:** no maintained Beta operations/backup/rollback/quota runbook or backend compatibility/maintenance contract exists. | Missing |
| B10 | **SOURCE:** browser E2E covers local-save paths; there is no signed-installer, auto-update, real-Supabase clean-Windows certification. | Missing |

Roadmap consistency: `game/docs/roadmap.md:2677` still describes cloud save as partial/local-adapter-only. The mission must update that maintained status only after the relevant gate seals; this spec does not mark implementation as done.

## 4. Target authority model

```text
BuildIdentity ------------------------------+
                                             |
Supabase Auth -> ActiveSessionAuthority      |
                       |                     |
                       v                     v
                 CharacterAuthority -> SupabaseCloudSaveService
                       |                     |
                       +-> PostgreSQL RPC <-+
                              |
                              +-> canonical character_saves revision

local cache <- only server-acknowledged snapshots
pending journal <- unacknowledged snapshot + base revision
diagnostics/feedback <- redacted metadata + explicit user description
release pipeline -> signed installer + update metadata + checksums/provenance
```

Authority ledger:

| Rule/state | Current authority | Target authority | Retirement condition |
|---|---|---|---|
| Runtime save | `LocalCloudSaveService` | Supabase RPC through `SupabaseCloudSaveService` | Beta composition has no local-authoritative write path |
| Save ordering | local revision plus login reconciliation | server `save_revision` CAS | no client timestamp/newest-wins overwrite path remains |
| Active game session | `account_sessions` for some RPCs; JWT/RLS for direct saves | `assert_active_session` on every save/session RPC | direct client write policy removed |
| Guest identity | transient session + shared `guest` key | persistent Supabase UUID | restart proves same UUID and isolated cache namespace |
| Build identity | package/config fragments | generated immutable `BuildIdentity` | all displayed/reported values originate from one object |
| Error evidence | current UI string | structured redacted diagnostics owner | Error UI, feedback, export consume the same record model |
| Release artifact | local developer command | CI-produced, signed, checksummed, provenance-bound artifact | publication cannot bypass release gates |
| Update | none | update service + main-process installer authority | manual download remains recovery only, not the primary channel |

## 5. Gate law and evidence law

Every B1-B9 implementation gate must:

1. materialize its own task card and relevant Q1-Q12 evidence from `architecture-worker-workflow.md`;
2. use an isolated worktree for production changes;
3. characterize current behavior before migrating it;
4. add tests that fail for the violated invariant before relying on the new path;
5. run the project-required simplify -> P3 -> P18 -> P13/P14 -> P4 -> sequential-review sequence as triggered;
6. record exact candidate identity and runtime environment;
7. end with zero unresolved actionable findings inside its scope, or remain unsealed with the canonical QA outcome;
8. update the authority ledger and maintained roadmap only when evidence supports the new status.

PR acceptance and a product gate seal are different milestones. A narrowly scoped foundation PR may merge with its local acceptance proved while dependent packaged/service evidence remains explicitly unsealed. B2's generated identity foundation, B3's packaging plumbing and B4's signing plumbing do not wait for consumers or CI that a later PR creates. B5 first produces a restricted draft candidate; B6/B10 test those exact bytes through a restricted candidate feed; public promotion happens only after B10 and explicit publication authority. Never label a foundation merge as a sealed release gate.

`PASS WITH GAPS`, `QA_UNVERIFIED`, `QA_FINDINGS_OPEN`, and `QA_BLOCKED_SCOPE` do not seal a gate. For final B10, only the canonical protocol terminal predicate may emit `QA_FIXED_POINT_REACHED`.

---

## 6. B1 — Supabase production authority

### B1.1 Observable outcome

Login, register, Guest, character provisioning, save/load, autosave, close flush, reconnect, logout, and guest upgrade all use one Supabase-backed authority. A player cannot advance while cloud authority is unavailable, revoked, or conflicted.

### B1.2 Explicit backend composition

Introduce an explicit backend mode such as:

```text
VITE_BACKEND_MODE=mock | supabase
```

Beta/release builds require `supabase`; missing URL or anon key fails the build or lands on a dedicated fatal configuration screen before auth. Factories must not infer mode from optional variables and must not fall back to mock:

```text
supabase -> SupabaseAuthService
         -> SupabaseCharacterCreationService
         -> SupabaseCloudSaveService

mock     -> MockAuthService
         -> MockCharacterCreationService
         -> LocalCloudSaveService
```

The artifact manifest records backend environment (`development`, `beta`, or `production`) without recording credentials.

### B1.3 Server contract

Add forward-only migrations. Do not edit applied migration history.

Required RPCs:

- `claim_active_session(p_device_label, p_protocol_version, p_build_id)` admits only supported protocol versions and records that version on the session. Cutover removes the old device-label-only overload; all guarded operations also validate the admitted session protocol. This is compatibility enforcement, not attestation that an unmodified signed client issued the request.

- `load_game_state(p_session_id uuid)`:
  - calls `assert_active_session`;
  - derives owner from `auth.uid()`;
  - derives the account's single active character server-side;
  - returns a structured state: `NO_CHARACTER`, `CHARACTER_UNINITIALIZED`, `SAVE_READY`, `CHARACTER_DELETED`, or deterministic session/auth error;
  - for `SAVE_READY`, returns character metadata, schema version, save revision, payload, transport timestamp, progression cutoff, server time checkpoint, and last client build ID.
- `write_character_save(p_session_id, p_expected_revision, p_schema_version, p_payload, p_build_id, p_mutation_id, p_time_checkpoint)`:
  - calls `assert_active_session`;
  - locks/resolves the owned save row in one transaction;
  - inserts revision 1 only when the row is absent and expected revision is 0;
  - updates only when expected revision equals current revision;
  - returns structured success/conflict/error with the authoritative revision;
  - sets server-owned `updated_at`; client time is diagnostic only;
  - enforces an evidence-derived payload-byte ceiling and returns `SAVE_TOO_LARGE` without mutation;
  - does not trust renderer-supplied `user_id` or arbitrary `character_id`.
- `heartbeat_session(p_session_id)` validates the active session and returns server time and a bounded time checkpoint/lease. Target cadence is approximately 30 seconds while gameplay is active; successful save RPCs also count as health evidence.
- `revoke_current_session(p_session_id)` makes logout semantics explicit and idempotent.
- `get_backend_status()` returns an authenticated, read-only compatibility/maintenance projection needed by boot and B6. Define this in B1-A; B9 adds operational procedures, not a late prerequisite for boot.

**Session linearization:** claim, assertion, revoke, provisioning, load and save serialize on the same per-user lock, acquired before character/save locks. Re-check the active session under that lock and hold it through commit. If a save wins the lock first, it commits before the new claim; if the claim wins first, the old save is rejected. A check followed by an unlocked write is invalid. Parallel claims must serialize rather than fail unpredictably on the partial unique index.

**Ambiguous commit:** `p_mutation_id` is a client-generated UUID persisted before sending. A server receipt, unique by owner + mutation ID, binds character identity, expected revision, schema, build ID, time checkpoint and server-computed canonical payload digest to the committed revision. Under the active-session lock, an identical retry returns the previous receipt without incrementing revision; reuse with different content is rejected. A revoked session cannot use receipt lookup to bypass revocation. Load returns the current revision and the last committed mutation ID. If the acknowledged mutation is older than the current revision, load the current remote state before resuming; never install a stale receipt payload as cache. Retain receipts at least seven days; older/unrecognized retries use normal CAS and conflict recovery without guessing. The client-local byte hash checks journal integrity; it is not compared with a PostgreSQL JSONB digest computed by a different serializer.

**Progression watermark:** `progression_cutoff_at` is stored separately from transport `updated_at`. A server checkpoint binds owner, character, server anchor time and bounded lease; pending data records that checkpoint ID plus elapsed monotonic time through which its snapshot has accounted for progression. The server verifies the issued checkpoint, bounded offset, nondecreasing cutoff and CAS binding before accepting the cutoff. It never accepts an arbitrary client wall-clock date. An identical retry cannot advance this watermark. A fresh active session may present the same owner's historical checkpoint only for the exact persisted pending operation after current-session validation; this does not admit an old session. Retain checkpoint proof while a matching retained receipt/pending replay can be validated; if proof is unavailable, use explicit recovery without inventing elapsed time. Server time bounds provide time/replay safety, not full simulation anti-cheat.

Database hardening:

- remove authenticated direct `SELECT`, `INSERT`, `UPDATE`, and `DELETE` policies/grants on `character_saves`; reads use the session-guarded RPC too; deny both anonymous and registered authenticated identities, including views and obsolete callable overloads;
- keep RLS as defense in depth;
- keep `security definer` functions on a fixed search path and restricted grants;
- enforce that a save's user matches its character owner, using schema/transaction constraints that cannot drift;
- keep one active session/account and one active character/account constraints;
- retain server-owned `updated_at`, but never use it as CAS authority;
- store `client_build_id` only for correlation, never save compatibility.

The database validates a nonempty object, supported `schema_version` equal to `payload.version`, required top-level shape, immutable character/talent/starter identity, finite bounded transport fields and UTF-8 payload size. Client registry preflight remains mandatory. This establishes durable ordering/ownership, not a claim that a client-simulated game has server-authoritative anti-cheat.

Cutover is explicit: apply/test forward migrations in disposable/staging Supabase first. Do not apply a policy-removal migration to a live project whose deployed client still uses direct PostgREST. Upgrade under maintenance with the complete compatible B1 client, revoke legacy game sessions, remove old claim/create overloads, preserve/export existing rows, inventory legacy `{}` rows and incompatible snapshots, and route invalid rows to recovery. Never infer an empty character from a malformed save or automatically delete historical rows. Old binaries are denied backend access; an old local-fallback binary cannot be remotely forced to stop its cached simulation. Require replacement/removal of controlled legacy tester installs before admission to the new Beta, and never promote their local progression automatically.

### B1.4 Character provisioning and first durable save

`create_character` provisions character metadata and consumes the server talent roll. It does not insert a fake `character_saves` row and no longer accepts `p_initial_save`.

```text
create_character succeeds
-> client applies deterministic starter initialization
-> buildGameSave()
-> write_character_save(expectedRevision=0)
-> revision 1 ACK
-> cache ACKed snapshot
-> start clock/tick and enter game
```

If the process/network dies after provisioning but before revision 1, `load_game_state` returns `CHARACTER_UNINITIALIZED`. The client reconstructs starter state only from canonical character metadata, runs the same idempotent initialization owner, and retries expected revision 0. It never rerolls talents, asks for a new name, duplicates grants, or creates another character.

### B1.5 Remote adapter, cache, and pending journal

Extend capability to `local-only | remote-authoritative` and implement `SupabaseCloudSaveService`. Absorb/retire `SupabaseRemoteSave.ts`; two remote mechanisms may not survive in parallel.

Before upload, the only accepted payload source is canonical `buildGameSave()`. After download, payload passes shape validation, normalization, `isSaveAcceptable`, registry preflight, and the normal restore path. “Came from server” is never a trust exemption.

Account-scoped keys use the Supabase `userId` for both registered and guest identities:

```text
tien-hiep-idle-save:<userId>          server-ACKed cache only
tien-hiep-idle-save-revision:<userId> authoritative revision mirror
tien-hiep-idle-save-pending:<userId>  unacknowledged recovery journal
```

The pending record contains user/environment/character identity, mutation ID, payload, base revision, time checkpoint, created time, build ID, schema version, and a local byte hash. Resolve environment isolation before using the illustrated keys: prefix by backend environment and project fingerprint (or use physically isolated app data); also check the envelope identity. Save flow is:

```text
build detached save -> validate -> persist pending journal
-> RPC CAS -> ACK
-> atomically advance ACKed cache/revision as far as browser storage permits
-> clear only the matching pending record
```

Storage failure is explicit. The client never marks a snapshot synced before server ACK. Cache corruption cannot overwrite a valid server row.

One per-session save queue serves autosave, manual save, initial save, quit, logout and update. It keeps the in-flight journal immutable; a newer requested snapshot waits until the first operation settles, then uses its ACKed revision and a new mutation ID. Clearing a journal compares the full owner/character/mutation identity. Stale generation callbacks cannot change another session's cache, revision, credential or journal. Store ACKed payload+revision in one envelope; old split keys are migration inputs only. On journal quota/write failure pause with explicit recovery/export and retry; do not claim durable progress.

### B1.6 Conflict, crash, and reconnect policy

Remote conflict is a lifecycle state, not coordinator auto-retry:

- server revision equals pending base revision: retry the same hashed pending snapshot once through CAS;
- server revision is greater: first resolve an identical committed mutation via the server receipt; otherwise do not write, pause and expose a conflict/recovery surface;
- server row absent and pending base is 0: retry initial save;
- no automatic merge of resources, progression, inventory, quests, or timestamps;
- no blind “load latest then overwrite” path.

Conflict actions are retry authority check, export/quarantine the account-bound pending snapshot, and explicitly accept the current cloud state after preserving pending evidence. No overwrite button re-bases divergent local state onto the new revision. Reset to a fresh runtime before a cloud replacement; do not restore over dirty owners. A malformed/mismatched journal is exportable recovery data and is never uploaded automatically.

Reconnect order is fixed:

```text
pause simulation and stop mutation-producing loops
-> regain transport
-> refresh auth if required
-> heartbeat active session
-> load authoritative remote revision
-> reconcile pending journal
-> restore/confirm one coherent state
-> resume simulation and autosave
```

`navigator.onLine` alone is insufficient. Backend health and authenticated RPC success are required.

Closed-app idle progression is separate from “continue playing offline.” Elapsed time is authorized only after a cold boot has loaded a valid remote snapshot and must be derived from server time and its validated progression cutoff, not transport ACK time or an editable client wall clock. A live reconnect does not grant offline progress. Existing progression caps and domain owners remain authoritative.

The existing closed-app reward mechanic is retained. Cold boot reconciles pending writes first, creates a fresh runtime, and injects the server-authorized window from `progression_cutoff_at` to the captured cold-boot server time into the existing offline owners. Retry of a snapshot captured at T0 but uploaded at reopen T1 keeps cutoff T0, so it does not erase the T0..T1 reward window. Persist the post-accrual snapshot and new cutoff through CAS before tick or spend commands can start. A process crash discards uncommitted in-memory grants; retries use the same pending mutation/receipt, preventing a second durable grant. For a live reconnect with matching authority, resume preserved in-memory state without restore; if remote replacement is required, reset owners and restore with an explicit zero-accrual context. Client `lastSavedAt` and a WeakMap guard cannot authorize accrual across process restarts.

The explicit context reaches both `player.restoreFromSave` and `GameManagerSaveRestore.restoreFromSave` through `restoreGameSession`. Production, decomposition, auto-farm and alchemy currently compute separate client-clock windows; every affected owner consumes the same authorized interval while retaining its own cap/formula/delivery rules. A player-only change is an incomplete migration.

### B1.7 Error taxonomy and lifecycle response

Infrastructure must preserve at least:

```text
NETWORK_UNAVAILABLE
SESSION_REVOKED
AUTH_EXPIRED
SAVE_CONFLICT
SAVE_INVALID
SAVE_TOO_LARGE
SERVER_ERROR
CONFIGURATION_ERROR
```

Do not collapse these to `server_unavailable`. UI maps them to localized, actionable states.

On network loss or unresolved save/session health:

- immediately pause cultivation, combat, production, timers, rewards, and autosave mutation;
- show a reconnect overlay;
- preserve pending evidence;
- never continue from cache offline.

“Immediately” means in the same authority transition when an offline signal, failed/timed-out authenticated request, OS resume or expired health lease is observed. It is not a claim that an idle TCP connection detects a cable cut instantly. Heartbeat runs every 30 seconds with a 10-second request deadline; health lease expires no later than 40 seconds after the last successful authenticated operation, using a monotonic clock. No successful response may extend a lease after its generation was replaced. Gate player mutation commands as well as `useAppLifecycle` ticks, main-process combat ticks, battle settlement callbacks and catch-up/reward timers. Re-anchor clocks on resume so paused time is not fed back as a giant delta. Acceptance measures both detection latency and zero domain mutation after the blocked transition.

On `SESSION_REVOKED`:

- pause;
- stop heartbeat/autosave/retries;
- clear the invalid active game-session binding;
- show a dedicated “account used on another device” state;
- return to auth only through the owned acknowledgement flow.

Game-session revocation stops gameplay and clears the active game-session binding, not automatically the durable guest Auth identity. Keep its protected refresh credential for an explicit take-back/sign-in action; auto-reclaim would make two devices fight. Only definitive Auth credential revocation/signout or explicit guest reset removes it. Refresh is single-flight and generation-fenced. Timeout/5xx/network failure preserves the guest credential and journal; only a proven terminal refresh rejection marks the identity unrecoverable, with recovery messaging before creating any new guest.

### B1.8 Guest persistence and account transition

Guest uses Supabase anonymous signup and receives the same character/save/session protections as a registered user. Its refresh credential persists across Electron restart in an OS-protected Electron credential-storage seam exposed through narrow preload IPC until explicit logout/reset; release mode does not keep it as plaintext in `localStorage`/`sessionStorage`, and no password is invented. Registered-account persistence remains an explicit product policy: the conservative Closed-Beta default is session-scoped login unless a separately tested “remember me” option is approved.

Mandatory proof:

```text
guest UUID A -> create/save -> close process -> reopen -> guest UUID A
-> same character -> same revision lineage
```

Guest-to-registered upgrade uses Supabase-supported linking of the same identity whenever available:

```text
same user_id -> same character -> same save -> same revision history
```

The server updates the same profile from `account_kind='guest'` to `registered` and binds the normalized login identity without creating a second profile/character.

This is a provider proof obligation before B1-E implementation: the current client synthesizes `loginId@accounts.tien-hiep-idle.invalid`. Supabase's documented anonymous-to-password conversion requires a linked verified email/phone and manual linking enabled. Do not claim this existing login-ID scheme supports that flow without a disposable-project experiment. Preserve same UUID; if existing login policy cannot satisfy the provider, record EXT-09 and request the credential/recovery product decision before the dependent slice. Neither an unverified-email bypass nor a privileged password-update endpoint is implicitly approved. Profile finalization must derive verified Auth identity server-side and be resumable after Auth succeeds but profile update fails; user-editable metadata cannot establish registered authority. See [Supabase anonymous identities](https://supabase.com/docs/guides/auth/auth-anonymous).

If the platform forces a different target identity, transfer is an explicit server transaction; the client never copies/merges canonical saves. Signing into a different existing account while the guest owns a character is a blocking conflict state with no automatic mutation. The safe Closed-Beta default is cancel or continue as the existing account after explicit acknowledgement; character merge is out of scope.

### B1.9 Logout

Logout owns this order:

1. flush if the state is saveable;
2. if flush fails, present retry or explicit “logout with unsynced progress” acknowledgement;
3. revoke current active game session;
4. Supabase logout;
5. clear credential/session and explicit account binding;
6. retain ACKed cache unless user explicitly resets local data;
7. return to auth.

Guest logout warns that removing its sole credential prevents self-service return; offer upgrade/export/cancel before explicit abandon. Offline logout must distinguish local signout from confirmed server revoke: fence local generations and retain identity-bound pending data, but never report remote revocation succeeded if unreachable. Do not restore/replay the abandoned guest's pending data under the next user's identity.

### B1.9a Existing import, reset, recovery and close consumers

`SettingsPanel.vue` currently calls `importSaveRaw`, `App.vue` calls `deleteSave`, and recovery surfaces can bypass the cloud coordinator. Census and migrate these callers before enabling Beta composition. Closed-Beta local import remains available as validation/export recovery data, not an authoritative overwrite; local reset is explicitly cache-only and reloads cloud. Remote character deletion/reset and arbitrary imported-cloud replacement need their own authorized server transaction and are not exposed as working Beta actions until implemented. Development mock mode keeps its existing local tools.

Main quit, updater restart and logout share one result-bearing flush (`saved | blocked | failed`) with request ID, generation, expected sender and confirmed remote revision. `notifyFlushComplete()` in a `finally` block and the current 2-second auto-close timeout are not remote success. Normal close failure offers retry/cancel/explicit force-close with preserved journal; updater install never runs on a failed/timeout flush. OS kill/power loss is handled by the already-written journal on next boot, not a promise that shutdown can always wait.

### B1.10 Acceptance tests

Required evidence includes:

- unit/property tests for adapter result classification, cache/journal atomicity, exact payload hash, CAS conflict, duplicate/stale callbacks, and session-generation fencing;
- SQL integration tests against a disposable real Supabase/Postgres contract for RLS/RPC grants, wrong owner, revoked session, concurrent CAS, first insert, oversize payload, and constraint failures;
- migration test from the currently deployed migration set, never only fresh-schema apply;
- Electron/browser integration proving pause/reconnect and no tick while blocked;
- two-client test proving device B revokes device A and A cannot read/write through direct PostgREST or RPC;
- crash-point tests before journal, after journal/before request, after server commit/before local ACK, and during cache update;
- guest restart, guest upgrade, token refresh, logout failure, and cross-account conflict tests;
- client-clock skew, cold-boot server-time offline accrual, live reconnect with zero duplicate offline grant, and repeated restore identity tests;
- first durable revision 1 before clock/tick;
- downloaded malformed/current-version, incompatible-version, and registry-invalid saves reach recovery without mutating live state;
- production composition test proving a Beta artifact cannot instantiate mock/local authority.
- deterministic overlapping claim/save/revoke schedules, identical mutation retry after lost ACK, altered mutation replay, expired receipt, older receipt versus newer current revision, and no stale cache/journal clear;
- overlapping manual/autosave/quit requests, import/reset/recovery bypass attempts, offline guest refresh preservation, explicit guest abandon, and sender/request-bound flush failure;
- health-lease expiry, blocked user commands and main combat ticks, OS suspend/resume re-anchoring, and post-accrual durable save before cold-boot tick.
- retry at T1 of pending progression captured at T0 preserves T0..T1 cold-boot accrual; changed/out-of-lease/backward checkpoints reject; lost ACK does not shift the cutoff; old-session replay cannot bypass current admission.

### B1.11 B1 seal

B1 seals only when the real Beta Supabase environment has passed the above matrix, direct save bypass is impossible, the old login-time reconciliation authority is retired, and a production-like Electron run demonstrates cloud autosave, restart restore, revoke, network pause, journal recovery, and conflict refusal. Mock-only tests cannot seal B1.

---

## 7. B2 — Build identity

Create one immutable generated `BuildIdentity` consumed by renderer, main process, save RPC, diagnostics, feedback, updater, and release manifest:

```text
productName
appVersion             semantic version, e.g. 0.1.0-beta.N
buildId                unique CI run/release identifier
gitSha                 full SHA; UI may show short SHA
saveSchemaVersion      CURRENT_SAVE_VERSION
backendEnvironment     development/staging/beta/production, never URL/key
releaseChannel         beta
builtAtUtc
```

Version/tag/package identity must agree; a mismatch fails release CI. Settings, fatal/error screens, feedback preview, and diagnostics display/carry it. `schema_version` remains save compatibility authority; build ID is correlation only.

Acceptance:

- unit test one generated source of truth and absence of secrets;
- build test injects known identity and proves renderer/main agree;
- packaged Settings and error surfaces show the exact release manifest values;
- save RPC persists the same build ID;
- missing required identity in release mode fails closed.

Foundation acceptance occurs in PR1; final seal occurs when one candidate manifest is byte-retained with the artifact and all later identity consumers match it. PR1 is not blocked waiting for B7/B8 to exist.

---

## 8. B3 — Production packaging

Finish the existing Electron/NSIS skeleton:

- stable `appId`, product name, executable name, publisher/company metadata, copyright, version, descriptions, and protocol/shortcut policy;
- tracked multi-size Windows `.ico` derived from an approved source asset and used consistently by executable, window, installer, shortcuts, and uninstall entry;
- explicit per-user/per-machine choice (recommended Closed-Beta default: per-user, no admin requirement);
- deterministic inclusion allowlist: built renderer/main/preload plus required licenses/assets only; no source, tests, `.env*`, keys, logs, screenshots, or dev helpers;
- ASAR policy and unpack list only where runtime requires it;
- file-protocol production boot, CSP/security checks, single-instance behavior, quit flush, install/uninstall, and clean reinstall;
- artifact naming includes product, version, channel, architecture.

Acceptance:

- `npm ci` and `dist:win` from a clean isolated checkout;
- archive/content inspection against an explicit allow/deny manifest;
- install, launch, create desktop/start-menu integration as configured, uninstall, and reinstall on a clean Windows VM;
- packaged app reaches the real Beta backend and completes boot without DevTools/Vite server;
- icon/metadata inspected in Explorer, installer, taskbar, and Apps & Features;
- quit flush has explicit bounded failure UX; timeout is not reported as saved.

Packaging acceptance can use an unsigned dry-run. Final B3/B4/B5 artifact flow is compile once -> inspect application payload -> sign executable/helpers during packaging -> assemble installer -> sign installer -> generate final update metadata/checksums -> freeze hashes -> clean-machine test -> publish the same bytes. Signing only an already assembled installer leaves embedded executables unsigned. Final B3 seal covers the exact signed artifact; later code/config changes require new artifacts and invalidated evidence.

---

## 9. B4 — Windows code signing

Implement signing plumbing without committing secret material:

- electron-builder signing configuration uses CI secret references such as `CSC_LINK`/`CSC_KEY_PASSWORD` or the selected hardware/cloud signer;
- protected environment and least-privilege release job;
- no secret on pull-request jobs or forks, no echo/debug dump, logs checked for redaction;
- RFC 3161 timestamp server, SHA-256 signing, executable/installer/helper coverage;
- explicit certificate subject/thumbprint recorded in release evidence;
- signing failure aborts publication; unsigned artifacts cannot enter the Beta update channel.

Acceptance:

- unsigned dry-run validates packaging without secrets;
- authorized release job produces a real Authenticode-signed installer;
- Windows signature verification and post-download verification pass on a clean machine;
- tampered artifact fails signature/hash checks;
- secret-absence and forked-PR jobs prove they cannot sign.

External blocker: a valid Windows code-signing certificate/signing service, credentials, timestamp connectivity, and owner authorization are required. Plumbing may be implementation-complete, but B4 is not sealed until a real signed artifact is verified.

---

## 10. B5 — Release pipeline and GitHub Release

Create a tag/manual-dispatch release workflow with protected publication:

1. checkout exact tagged SHA;
2. pin Node/runner/tool versions and run `npm ci` from the lockfile;
3. validate semantic version, tag, channel, BuildIdentity, migrations, and backend mode;
4. run full deterministic verification plus required integration/E2E suites;
5. compile once, sign application binaries during packaging, assemble/sign the installer, then freeze final artifacts; never rebuild between candidate QA and publication;
6. generate SHA-256 checksums, artifact manifest, dependency/SBOM inventory, and provenance linking tag/SHA/workflow/toolchain;
7. upload immutable artifacts to a draft GitHub Release;
8. expose the identical draft bytes and generated update metadata on an access-controlled candidate feed for B6/B10, with the production feed still unchanged; promote/publish only after B10 and explicit authorization approve the exact hashes.

“Reproducible” means another authorized run can reconstruct the same source/dependency/toolchain inputs and equivalent unsigned application payload. Authenticode timestamp/signature bytes may differ and are recorded rather than falsely claimed bit-identical. The distributed signed artifact's published checksum is immutable.

Acceptance:

- version/tag mismatch, dirty source input, missing identity, failed tests, unsigned output, or missing checksum blocks release;
- rerun does not overwrite a published version or silently replace assets;
- release notes include schema/backend/update compatibility and rollback notes;
- downloaded GitHub asset verifies signature and checksum;
- permissions prevent ordinary PR code from gaining signing/release secrets.

Pipeline acceptance: CI creates a verifiable draft and the restricted candidate feed, without waiting for B10. Seal: after B10 and publication authority, promote those same hashes. Draft GitHub assets alone are not assumed publicly available to an updater; candidate-feed access uses the approved B6 transport with a tester allowlist, not a shipped GitHub token.

---

## 11. B6 — Beta update channel

Main process owns updates; renderer receives a narrow typed IPC projection. Use `electron-updater` or an equivalent maintained provider behind an `UpdateService` contract.

Required states:

```text
idle -> checking -> available/not-available -> downloading
-> downloaded -> install-on-restart
or recoverable error
```

Rules:

- Beta checks only the Beta channel over HTTPS;
- update metadata is authenticated through the approved HTTPS provider and signed manifest when supported by the pinned toolchain; verify artifact hash and Windows publisher signature independently. The configured trust/publisher policy is fixed in the app; a renderer URL/publisher override is forbidden;
- no downgrade or cross-environment update;
- UI shows version, size/progress, retry/later, release notes, and actionable error;
- install/restart first runs the owned save flush and refuses to claim safety when unsynced;
- a failed check/download never corrupts the installed build or blocks ordinary play once backend authority is healthy;
- forced minimum version/maintenance policy comes from a signed/authorized backend compatibility contract, not arbitrary UI code;
- manual installer download remains recovery path.

Acceptance:

- signed `beta.N -> beta.N+1` update on a clean Windows machine;
- save created by N survives update and reload on N+1;
- interrupted download, corrupt package, bad signature, no network, no update, and update-server 404 are exercised;
- update while a save is pending follows the flush/conflict policy;
- channel isolation prevents Beta from receiving another channel.

External decision/blocker: if GitHub Release assets are private, do not embed a repository token in the client. Choose either public release assets or a private authenticated HTTPS update provider before B6 implementation. GitHub Release publication in B5 does not by itself settle updater transport.

Seal: the exact signed RC performs a real version-to-version update and preserves cloud/local recovery state.

---

## 12. B7 — In-game Beta feedback

Add a localized in-game form that submits through a narrow `FeedbackService`. Default Closed-Beta backend is a Supabase RPC/Edge Function and dedicated table with server-side ownership/rate limits; no service-role key is shipped.

Payload:

- category, description, optional reproduction steps, optional contact field;
- BuildIdentity;
- current route/screen and coarse gameplay context;
- save schema and authoritative revision, never raw save by default;
- selected redacted diagnostic entries only after preview/consent;
- stable report ID returned to the player.

Rules:

- tokens, passwords, anon key beyond its already-public client purpose, signing data, raw save, chat text, and unrestricted file paths are forbidden;
- submission validates length/type and rate limits server-side;
- network failure keeps the form and offers export/copy; it never claims success;
- repeated click uses an idempotency key to avoid duplicate reports;
- diagnostic attachment is opt-in and previewable.

Acceptance covers valid submit, duplicate retry, oversized/invalid content, rate limit, revoked session, offline export fallback, redaction, and feedback-build correlation.

Seal: a report from the packaged app appears in the Beta intake with matching build ID and no forbidden data.

---

## 13. B8 — Diagnostics and crash boundary

Create a structured bounded diagnostic owner shared by error UI, feedback, and export:

- renderer `error`, `unhandledrejection`, Vue error boundary, and owned lifecycle/network/save/update events;
- main-process uncaught errors, renderer-process-gone/crash metadata, updater and quit-flush outcomes;
- monotonic sequence, UTC time, severity, category, safe message/code, build identity, route, and correlation ID;
- bounded in-memory ring plus bounded rotated local persistence;
- central redaction before persistence or export.

Local report bundle is mandatory and includes manifest, redacted events, platform/runtime versions, release identity, backend environment, save schema/revision/hash metadata, and a human-readable summary. Raw saves and credentials are excluded unless a separate explicit recovery export is chosen by the user.

Define a `CrashReporter` provider boundary, but default to `LocalBundleCrashReporter`. A remote provider requires separate approval of vendor, data map, retention, consent, endpoint, credentials, and privacy text.

Acceptance:

- deliberate renderer exception, rejected promise, main/renderer crash signal, save conflict, network loss, updater error, and quit-flush timeout produce classified records;
- bundle redaction tests use planted fake tokens/passwords/paths and prove absence;
- log limits/rotation and concurrent writes do not crash the app;
- packaged error screen can export/copy the report ID and build identity.

Seal: a clean-machine induced error yields a usable redacted bundle with B2 identity and a stable report ID. B7 later proves intake correlation using that ID; B8 does not depend on B7 being implemented.

---

## 14. B9 — Beta operations

Maintain `docs/operations/beta/` as executable runbooks plus evidence templates:

- environment inventory and ownership for local/staging/beta Supabase projects;
- migration apply/verify/rollback policy; migrations are forward-only and backup precedes destructive schema change;
- authenticated health contract exposing service status, server time, schema/RPC compatibility, minimum/supported client version, and maintenance mode without secrets;
- quota dashboard checklist and alert thresholds derived from the actual Supabase plan at release time, not hard-coded stale numbers in this spec;
- backup schedule, encrypted export location, retention/owner, restore drill, and restore acceptance queries;
- release promotion, pause, rollback, revoked build, update-channel freeze, and incident communication procedures;
- signing certificate expiry/rotation, GitHub secret rotation, Supabase key rotation, and access offboarding;
- feedback/diagnostic triage, severity, duplicate linkage, and response ownership;
- Free-plan inactivity/availability check where applicable, with an owner and pre-Beta wake/health procedure.

Rollback separates:

- client rollback: only when save schema/backend compatibility says it is safe; updater never silently downgrades;
- backend rollback: prefer forward repair; database restore is an incident operation with write freeze and explicit owner;
- release rollback: remove/freeze update availability while preserving published evidence; never delete the only known artifact/checksum.

Acceptance:

- restore a backup into an isolated project and prove character/save revision integrity;
- simulate backend maintenance, quota warning, expired/invalid client, bad migration, compromised key, and bad release;
- on-call operator can identify exact build, freeze updates, communicate state, recover service, and preserve evidence using the runbook alone.

Seal: one timed tabletop plus one real backup/restore drill passes with named owners and retained evidence.

---

## 15. B10 — Final release-candidate certification

B10 changes no product code. Any discovered fix returns to the owning gate/PR, invalidates affected evidence, creates a new candidate hash, and restarts relevant certification cells.

Minimum environment:

- clean Windows 11 x64 VM or physical machine with no Node, Git, repo, prior app data, or dev certificate;
- Windows 10 x64 is tested only if B3 declares it supported;
- real Authenticode trust path and internet access;
- dedicated real Beta Supabase project at the exact production migration level;
- two device/VM identities for active-session revocation;
- current Beta N installer and signed Beta N+1 update.

Certification journey:

1. download GitHub Release asset; verify checksum/signature;
2. install and launch packaged app;
3. verify build identity/backend/channel;
4. create Guest, create character, prove revision 1 before first tick;
5. play through representative cultivation/combat/economy mutation and wait for cloud autosave;
6. terminate/reopen and prove exact remote restore;
7. force network loss and prove immediate global pause/no progression, then reconcile and resume;
8. log in on device B and prove A is revoked and cannot save;
9. recover/re-authenticate according to product flow;
10. upgrade Guest to registered identity and prove same character/revision lineage;
11. induce a controlled CAS conflict and prove no overwrite;
12. trigger pending-journal crash points and prove deterministic recovery;
13. update N -> N+1 and prove save/schema/backend compatibility;
14. submit feedback and export diagnostics; correlate report/build/revision and verify redaction;
15. close during save/update and verify truthful flush outcome;
16. execute rollback/freeze and backup-restore runbook drills;
17. uninstall/reinstall and confirm declared local-data policy.

Final evidence additionally follows the repository Internal Fixed-Point QA Protocol: frozen product/contract/attack/environment identities, full deterministic and runtime gates, coverage census, sequential resulting-state reviews, independent Clean A/B, novel attacks, targeted mutations, final full verification, and independent terminal predicate verification.

B10 seal is the exact canonical success sentence from the protocol for the frozen signed candidate. Anything else is an intermediate or blocked outcome, not “Beta ready.”

---

## 16. Execution order and PR breakdown

Recommended dependency order:

```text
B2 identity foundation (merge acceptance; full consumer seal later)
  -> B1 database/RPC authority
  -> B1 client adapter/composition
  -> B1 journal/session/reconnect/guest flows
  -> B1 real-Supabase integration seal
  -> B3 packaging
  -> B4 signing
  -> B5 draft release pipeline (promotion after B10)
  -> B8 diagnostics foundation
  -> B6 updater
  -> B7 feedback
  -> B9 operations and drills
  -> B10 frozen RC certification
```

Proposed PRs (each gets its own worktree, task card, QA ledger/evidence, and seal target):

| PR | Scope | Independent deliverable / review boundary |
|---|---|---|
| 1 | B2 | Generated BuildIdentity, display/test surfaces, release-mode fail-closed contract |
| 2 | B1-A | Forward migration: load/write/heartbeat/revoke RPCs, constraints, direct-save-policy removal, SQL integration harness |
| 3 | B1-B | Explicit backend composition and `SupabaseCloudSaveService`; retire login-only remote authority |
| 4 | B1-C | ACKed cache + pending journal + CAS/conflict/crash recovery |
| 5 | B1-D | Global online/session pause-reconnect lifecycle and error taxonomy |
| 6 | B1-E | Guest persistent identity, account-scoped keys, same-identity upgrade, logout/cross-account safety |
| 7 | B1-F | Real Supabase two-device/Electron integration and B1 seal; no unrelated product code |
| 8 | B3 | Icons, metadata, packaging allowlist, clean install/uninstall proof |
| 9 | B4 | Signing plumbing and authorized signed-artifact evidence |
| 10 | B5 | Protected CI release workflow, checksums, provenance, draft GitHub Release |
| 11 | B8 | Structured diagnostics, redaction, bundle export, crash-provider boundary |
| 12 | B6 | Update service/IPC/UX and signed N -> N+1 proof |
| 13 | B7 | In-game feedback service/UI consuming B2/B8 contracts |
| 14 | B9 | Health/compatibility contract, backup/restore/rollback/quota/incident runbooks and drills |
| 15 | B10 | Evidence-only frozen RC certification; fixes return to the owning earlier PR/gate |

PRs may split further when a responsibility cannot be independently reviewed in one coherent slice. They may not be collapsed merely to reduce PR count. Cross-PR interface changes require the producer contract and consumer update to remain runnable and explicitly versioned.

## 17. External dependencies and blockers

| ID | Dependency | Blocks | Resolution required |
|---|---|---|---|
| EXT-01 | Dedicated Beta Supabase project, admin access, URL/anon key, migration deploy access | B1/B7/B9/B10 | Provision staging + Beta projects; secrets stored only in authorized CI/runtime configuration |
| EXT-02 | Windows code-signing certificate or signing service | B4-B6/B10 | Choose issuer/service, provision protected secret/hardware access, record subject/expiry/timestamp policy |
| EXT-03 | GitHub Actions/Release permissions and protected environment | B5/B6/B10 | Repository owner configures least-privilege release workflow and required approvals |
| EXT-04 | Update artifact transport and restricted candidate feed | B5/B6 | Repository verified public on 2026-09-29; public GitHub assets are feasible for published Beta, but the draft/candidate transport still needs approval and proof; never embed repo token |
| EXT-05 | Clean Windows machines/VMs and second device identity | B3/B4/B6/B10 | Provide reproducible clean images and retained environment manifest |
| EXT-06 | Feedback retention/contact/privacy policy | B7/B8 | Approve collected fields, retention, access, consent copy, deletion process |
| EXT-07 | Backup destination/encryption/retention owner | B9/B10 | Provision storage and name operator; complete restore drill |
| EXT-08 | Supported Windows versions/architectures | B3/B10 | Declare matrix before packaging seal; do not imply untested support |
| EXT-09 | Guest conversion and credential recovery compatible with current login-ID scheme | B1-E/B1 seal/B10 | Prove same-UUID conversion in a disposable project; resolve verified identity/recovery policy if synthetic `.invalid` email cannot meet provider requirements |
| EXT-10 | Approved icon source and publisher/product metadata | B3/B4 | Select a licensed product asset and actual publisher identity; no invented company or default Electron icon in RC |

If an external dependency is absent, implementation may reach a documented plumbing milestone, but the affected gate remains `QA_UNVERIFIED` or `QA_BLOCKED_SCOPE`; it is not silently waived.

## 18. Stop conditions and rejection criteria

Stop the dependent slice and escalate when:

- source reality contradicts this authority model or a product decision would change player data semantics;
- a migration requires destructive production data action without backup/authorization;
- current dirty work overlaps the files a PR needs and cannot be isolated safely;
- a required secret/certificate/provider is unavailable;
- an acceptance test can pass only by weakening an oracle, enabling mock fallback, or skipping a real runtime path;
- any path can advance gameplay while session/save authority is unresolved;
- any direct `character_saves` write bypass survives;
- any conflict path can overwrite without exact expected revision;
- any report/update/release path can leak credentials or replace a published artifact;
- final candidate identity changes after evidence collection.

Reject a gate seal when evidence is mock-only, source-only where runtime proof is required, browser-only where packaged Electron proof is required, a preview instead of production wiring, a signed artifact different from the tested hash, or a run performed against a dirty/non-materialized candidate.

## 19. G0/G1 planning record for this umbrella

**Requested observable behavior:** a real signed Windows Closed Beta install completes the B10 journey against real Supabase.

**Single umbrella responsibility:** production readiness and distribution; individual gates own one coherent subordinate responsibility.

**Current owners:** auth/session/Supabase services, cloud-save services/coordinator, `useAppLifecycle`, Electron main/preload, electron-builder configuration, save validation/restore, and canonical QA protocol.

**Target owners:** authority table in section 4; gate-specific task cards must confirm exact symbols at their current base SHA.

**Existing primitives to reuse:** `buildGameSave`, validation/acceptance/restore, `CloudSaveCoordinator` boundary, Supabase HTTP/session/auth, active-session RPC primitives, first-save-before-tick lifecycle, ErrorBoundary/ErrorScreen, Electron narrow preload bridge, Internal QA protocol.

**Missing mechanisms:** remote runtime adapter, session-guarded save RPC, journal/reconnect state machine, build identity, packaging assets/metadata, signing, release/update pipeline, feedback, structured diagnostics, operations runbook.

**Production chain:** installer/update -> Electron main/preload -> Vue lifecycle -> auth/session -> character -> save adapter -> RPC/Postgres -> cache/journal -> diagnostics/feedback/operations evidence.

**State lifecycle:** specified per B1/B2/B6/B8; implementations must enumerate writers/readers/reset/persistence/async cleanup and stale-result policy.

**Explicit non-goals:** section 2.

**Verification:** gate acceptance plus B10 fixed-point certification.

**Stop condition:** B10 sealed for one frozen signed candidate, or canonical blocked/unverified outcome with exact dependency.

**Unresolved external assumptions:** section 17 only; no hidden product assumption is converted to “N/A.”

Q1-Q12 summary:

| Q | Evidence-based answer |
|---|---|
| Q1 | Section 1 journey plus gate failure semantics are observable acceptance, not implementation existence. |
| Q2 | One target owner per row in section 4; RPC owns server CAS/session/ownership atomically. |
| Q3 | B1/B2/B6/B8 specify state writers, persistence and resets; each PR must expand its local map. |
| Q4 | Section 19 production chain reaches packaged Electron and real backend; mock-only direct service tests are insufficient. |
| Q5 | Section 19 lists reused primitives; new boundaries represent present release concepts with immediate consumers. |
| Q6 | Contracts flow foundations -> services/domain lifecycle -> Electron/UI; renderer never receives raw signer/updater/backend authority. |
| Q7 | Network/session state may pace/pause runtime, but presentation does not decide save/session outcomes. |
| Q8 | B1 validation and B10 assembled journey cover load/save/update/feedback consumers without silent defaults. |
| Q9 | Health/build/diagnostic projections are read-only; queries do not claim sessions, mutate saves, or advance gameplay. |
| Q10 | Each async path defines duplicate, stale, failed, interrupted behavior and identity/generation/CAS policy. |
| Q11 | Local-only/mock remains development-only; `SupabaseRemoteSave` and direct-save policies retire at B1 seal; manual installer remains recovery-only after B6. |
| Q12 | One gate/PR responsibility, explicit evidence, external blockers, and B10 frozen-candidate stop prevent unrelated cleanup or false completion. |

## 20. Spec self-review result

- Coverage: B1-B10, all user-locked Supabase invariants, acceptance tests, seal criteria, external blockers, and PR order are represented.
- Current-source consistency: claims above were checked against fetched `origin/master @ f1049b5e`; working-tree-only files were not treated as baseline authority.
- Authority consistency: server revision/RPC owns save order; local storage never becomes canonical; build ID never replaces schema version.
- Scope consistency: one umbrella spec, but implementation remains decomposed into independently testable PRs.
- Placeholder scan: no TBD/TODO or “test later” placeholder is accepted as a gate requirement.
- Verification honesty: this document is docs-only and has not executed production gates; every implementation/runtime gate remains planned and unsealed.

---

## 21. Astra handoff rule

Astra executes the PR DAG in section 16 from fresh current-base audits. At the start of each PR, Astra re-reads `AGENTS.md`, `AstraDoctrine.md`, the architecture worker workflow, the QA protocol, this spec, the linked execution plan, the relevant roadmap/source/tests, and refreshes the remote/base identity. Historical reports are hypotheses, not proof. Astra records each scoped implementation acceptance and separately tracks pending environment/artifact seals under section 5, then proceeds to the next admitted dependency. The umbrella is complete only when B10 reaches the canonical terminal predicate.
