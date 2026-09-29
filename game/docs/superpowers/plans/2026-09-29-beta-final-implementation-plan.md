# BETA-FINAL Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task by task under Astra's coordination. Internal independent reviewers follow repository QA law; do not treat a worker result as a gate seal. Steps use checkboxes for execution tracking.

**Goal:** Deliver a signed, supportable Windows Closed Beta with real Supabase save/session authority and a verified distribution/update/recovery journey.

**Architecture:** PostgreSQL RPC owns session admission, save revision and idempotent commits. Existing gameplay owners retain simulation and restore semantics; one session coordinator gates their admission and one cloud-save queue owns persistence. Electron main owns credentials, signing-independent native operations, diagnostics export and update installation through typed preload contracts.

**Tech Stack:** Existing Vue 3.6 prerelease/TypeScript/Vite/Pinia/Phaser, Vitest/Playwright, Electron/electron-builder, Supabase Auth/PostgreSQL/PostgREST and GitHub Actions. Keep the pinned Vue family intact; any new dependency is an explicit task-scoped addition to package and lockfile.

**Spec:** [BETA-FINAL master spec](../../qa/missions/2026-09-29-beta-final-production-readiness.md).

**Owner:** Astra. **Status:** PLAN_READY for documentation review; implementation and all B1-B10 seals remain unexecuted. **Planning baseline:** fetched `origin/master @ f1049b5e42757f14aebee18bab3569dc43c37d09`, 2026-09-29. The reviewed planning branch is `codex/beta-final-plan` in `E:/tutienidle/.agent-worktrees/beta-final-plan`.

## Global constraints

- Supabase is the save authority in Beta. `localStorage` is cache/recovery/export only.
- Beta has no silent fallback to mock/local services.
- Guest is a real persistent Supabase anonymous identity and has cloud save.
- Every production save read/write is active-session guarded. A valid JWT from a revoked game session is insufficient.
- CAS conflict never triggers a blind overwrite or automatic gameplay-state merge.
- Character creation never persists `{}` as a valid remote save.
- No simulation advances while network/session/save authority is unresolved.
- Credentials, tokens, raw saves, and signing secrets never enter logs, feedback, diagnostics, artifacts, or Git history.
- This plan does not authorize production migration, secret provisioning, release publication or merge. The user's current request authorizes committing/pushing the two planning documents and opening their PR.
- Current supported target is a proposed Windows 11 x64 certification baseline; EXT-08 must confirm the release support matrix. Do not imply Windows 10/ARM64 support without evidence.
- Paths below are repository-relative. Commands run from `game/` unless marked repository root. New symbols/files are **planned contracts**, not claims that the baseline implements them.

## 1. Review disposition and G0/G1 record

This change has one responsibility: make the umbrella implementable and reviewable as a series of bounded PRs. Production code is unchanged. Read-only source inspection covered current factories, `CloudSaveCoordinator`, `SupabaseSession`, `SupabaseAuthService`, `SupabaseCharacterCreationService`, SQL migrations, `useAppLifecycle`, `App.vue`, player restore/save, Settings import/reset, Electron bridge/quit and packaging config. Roadmap R10 and the online/cloud row remain partial, consistent with source.

Primary-agent review plus an independent fresh-context reviewer produced these corrections to the spec:

| ID | Severity | Counterexample / source evidence | Resolution in spec and plan |
|---|---|---|---|
| R1 | High | `assert_active_session` checks then updates without one serialization boundary; another claim can win between them | Common per-user transaction lock and deterministic interleavings; PR2 |
| R2 | High | Removing direct policies and old create signature before client replacement breaks `SupabaseRemoteSave` and provisioning | Staging-first migrations, compatibility matrix and coordinated maintenance cutover; PR2/7 |
| R3 | Medium | Server commits revision 8 but response is lost; local base 7 is misclassified as divergent conflict | Durable mutation ID/receipt, same-input retry, no extra revision; PR2/4 |
| R4 | High | B4 needs CI from B5, B6 needs B9 health, B8 seal needs B7 although B7 consumes B8 | Separate implementation acceptance from evidence seals; early health contract and restricted draft CI; dependency table below |
| R5 | Medium | Silent packet drop after a healthy heartbeat is unknowable until a deadline | 30-second heartbeat, 10-second deadline, at most 40-second health lease; immediate pause after observation; PR5 |
| R6 | Medium | B3 freezes package before updater/feedback/diagnostics change its bytes | Capability qualification first; final candidate freeze after all product PRs, recheck exact artifact-dependent gates; PR15 |
| R7 | High | Concurrent manual/quit saves bypass lifecycle-only `saveInFlight`; stale ACK can clear newer journal | One save queue and identity-bound journal clearing; PR4/5 |
| R8 | High | `resolveSupabaseSession` deletes refresh state on every error; game-session revoke can orphan guest | Single-flight refresh, transient error retention, separate game session from Auth identity; PR5/6 |
| R9 | Medium | Settings import/reset and recovery still call local save APIs; quit ACK is sent in `finally` | Explicit remote-mode tool policy and result-bearing flush used by quit/update/logout; PR3/5 |
| R10 | High | Synthetic `.invalid` email does not establish a usable verified identity upgrade | EXT-09 disposable-provider proof before dependent implementation; PR6 admission stop |
| R11 | Medium | Offline restore uses client `lastSavedAt` and process-local dedupe | Server-authorized cold-boot time window, durable post-accrual save, zero-accrual live reconnect; PR5 |
| R12 | High | Retrying pending save at reopen changes transport ACK time and can erase elapsed offline reward | Separate progression cutoff and server checkpoint retained across retries; PR2/4/5 |
| R13 | High | Old baseline ignores health/version floor and continues on local cache after RPC failure | Versioned claim/admitted protocol, revoked old sessions and denied old RPC/table access; controlled old installs replaced, no claim of stopping old local binaries |

These are specification findings, not assertions that production fixes/tests have run. Review evidence is SOURCE/contract reasoning; no product fixed-point verdict is claimed.

G0 scope: only the master spec and this plan in the documentation PR; unrelated main-checkout edits are excluded. G1 Q1-Q12 are answered by the spec authority ledger plus the task-level interfaces/consumer/tests below. Save/session modules S1-S6 and lifecycle L3/L4 are planned for PR2-7; UI/runtime modules apply only when their actual consumers change. G2-G4 production checks, OCR, P13/P14 and gameplay QA are N/A for this docs-only PR under architecture-workflow proportionality; implementation PRs execute them as triggered. Documentation checks cover actual baseline paths, links, type names, milestone dependencies, coverage and resulting-state review.

## 2. Dependency graph, admission and evidence

`I` means a working implementation/contract milestone accepted at PR scope. `E` means the gate's required environment/artifact evidence is sealed. Merging `I` never invents `E`. Each PR has one scoped branch/worktree and may split further if review boundaries require it.

| PR | Gate / deliverable | Implementation prerequisites | Evidence that may remain pending |
|---|---|---|---|
| 1 | B2 identity foundation | Current baseline | Packaged display/save/feedback/update identity closure |
| 2 | B1-A SQL/RPC, health, local Supabase harness | 1-I for build contract | Authorized Beta deployment and real environment |
| 3 | B1-B adapter/composition/provisioning | 2-I | Durable journal, online admission and guest recovery; Beta launch remains disabled |
| 4 | B1-C queue/cache/journal/reconciliation | 3-I | Full lifecycle and two-device certification |
| 5 | B1-D pause/reconnect/flush/offline-time | 4-I | Guest persistence and packaged environment |
| 6 | B1-E guest/upgrade/logout | 5-I plus EXT-09 proof | Actual Beta service evidence |
| 7 | B1-F cutover and real Supabase proof | 2-6-I; EXT-01/05/09 | Final signed RC rerun; this may seal B1 on production-like Electron |
| 8 | B3 package configuration/assets | 7-I; EXT-08/10 | Final signed RC artifact checks |
| 9 | B4 signing configuration | 8-I | Real signing via PR10 CI; EXT-02 |
| 10 | B5 protected draft pipeline/candidate feed | 8/9-I; EXT-03/04 | Public promotion until final B10 seal |
| 11 | B8 diagnostics/local bundle | 1/5-I | Final packaged bundle proof, no dependency on B7 |
| 12 | B6 updater | 2 health + 5 flush + 10 feed + 11 diagnostic contracts | Signed N/N+1 update; EXT-02/04/05 |
| 13 | B7 feedback | 2 RPC + 11 diagnostics + 1 identity; EXT-06 | Beta intake correlation |
| 14 | B9 operations and drills | 7/10/12/13-I; EXT-07 | Final RC compatibility and operator drill |
| 15 | B10 certification / artifact-dependent reseals | All product PRs integrated; required external inputs resolved | No product edits; candidate remains frozen |

Numbering is recommended merge order, not authorization to publish intermediate builds. PR11 can proceed after PR5 if signing is externally blocked, with its dependencies unchanged. PR6's provider experiment and external procurement start early. A blocked certificate does not block source/docs work that can be verified without it.

The RC artifact flow, with no dependency cycle:

```text
PR1-14 product state integrated -> exact source SHA and release version locked
-> full source verification -> compile and sign application binaries
-> assemble/sign installer -> metadata/checksums -> draft + restricted feed
-> exact-artifact B2-B9 checks and B10 N/N+1 certification
-> explicit publication authorization -> promote same bytes and feed metadata
```

Each source/contract fix creates a new candidate and invalidates affected evidence. The baseline updater N and proposed release N+1 have separate SHA/version/schema/build IDs and artifact hashes. For the first Beta, create a signed internal bootstrap N with the updater already implemented; an updater-less baseline cannot prove an update.

## 3. Shared contracts and file map

Keep interfaces near their owning feature; no general framework rewrite. Shared contracts must be importable by renderer/main without pulling Vue/Phaser or Node into the wrong bundle.

| Files (planned unless existing is stated) | Responsibility |
|---|---|
| `game/src/shared/build/BuildIdentity.ts`, `game/scripts/release/build-identity.mjs` | Immutable validated build metadata; generated module/manifest from one invocation |
| Existing `game/src/services/cloudSave/CloudSaveService.ts`, `CloudSaveCoordinator.ts`, factories | Remote result types, sole save queue/composition; preserve explicit local-only development mode |
| `game/src/services/cloudSave/SupabaseCloudSaveService.ts`, `PendingSaveJournal.ts`, `AckedSaveCache.ts`, `reconcilePendingSave.ts` | RPC transport, durable local envelope, acknowledged projection, pure reconciliation decision |
| `game/src/services/session/OnlineSessionController.ts`, `BackendStatus.ts`, `game/src/shared/session/FlushResult.ts` | Health/admission/generation state and shared native flush result |
| Existing `game/src/services/supabase/SupabaseSession.ts`, auth/character services | Auth identity, single-flight refresh and metadata provisioning |
| `game/src/main-process/GuestCredentialStore.ts`, existing Electron main/preload/bridge | OS-protected guest refresh credential and allowlisted IPC |
| Existing `game/src/services/save/SaveSystem.ts`, `saveKeys.ts`, `game/src/stores/player.ts`, `game/src/core/game/GameManagerSaveRestore.ts`, `game/src/composables/useAppLifecycle.ts`, `game/src/App.vue` | Canonical snapshot/restore, server-time context and real runtime admission |
| `game/src/shared/diagnostics/DiagnosticEvent.ts`, `game/src/services/diagnostics/DiagnosticRecorder.ts`, `game/src/main-process/DiagnosticBundle.ts` | Allowlisted records, redaction/ring, bounded native persistence/export |
| `game/src/shared/update/UpdateState.ts`, `game/src/main-process/UpdateService.ts`, `game/src/composables/useUpdates.ts` | Typed update projection, provider/native installation, UI binding |
| `game/src/services/feedback/FeedbackService.ts`, `SupabaseFeedbackService.ts`, `game/src/components/common/FeedbackDialog.vue` | Validated report intake/preview and idempotent delivery |
| `.github/workflows/beta-checks.yml`, `.github/workflows/beta-release.yml`, `game/scripts/release/*` | Unprivileged checks, protected build/draft/promotion, identity/artifact verification |
| `game/docs/operations/beta/` | Environment/cutover/release/incident/backup runbooks and evidence templates |

Contract sketches fix cross-PR semantics; implementations use actual `GameSave` and canonical owners, without `any` casts:

```ts
export interface BuildIdentity {
  readonly productName: string
  readonly appVersion: string
  readonly buildId: string
  readonly gitSha: string
  readonly saveSchemaVersion: number
  readonly backendEnvironment: 'development' | 'staging' | 'beta' | 'production'
  readonly releaseChannel: 'development' | 'beta'
  readonly builtAtUtc: string
}

export interface SaveBinding {
  environmentId: string // environment + non-secret project fingerprint
  userId: string
  characterId: string
  generation: number // runtime fence, never persisted as server authority
}
export interface PendingSave {
  format: 1
  environmentId: string
  userId: string
  characterId: string
  mutationId: string
  baseRevision: number
  timeCheckpoint: { checkpointId: string; elapsedMonotonicMs: number }
  schemaVersion: number
  buildId: string
  createdAtUtc: string
  rawPayload: string
  localByteHash: string
}
export interface SaveReceipt {
  mutationId: string
  committedRevision: number
  currentRevision: number
  serverTimeUtc: string
}
export type FlushResult =
  | { status: 'saved'; requestId: string; generation: number; revision: number }
  | { status: 'blocked' | 'failed'; requestId: string; generation: number; code: string }
export type AuthorityState =
  | 'signed-out' | 'checking' | 'ready' | 'reconnecting'
  | 'conflict' | 'revoked' | 'recovery' | 'maintenance' | 'update-required'
```

`SaveReceipt.currentRevision > committedRevision` means retrieve/validate the current remote row before installing a cache. Revisions must be nonnegative safe integers at the TypeScript boundary; reject unsupported bigint ranges instead of losing precision. Generation fences every asynchronous state write, not only UI transitions.

## 4. Repeated task execution rules

At each PR, read current laws/spec/this plan and the task's named source/tests. Refresh `origin/master`, record base SHA and drift, inspect status, create/reuse an isolated branch. Fill a G0 card and Q1-Q12 with actual owners/consumers. Run the installed QA prepare/preflight workflow for production tasks according to `game/docs/qa/protocol/agent-instructions.md`; do not invent ledger fields or treat `PLAN_READY` as `IMPLEMENTATION_READY`.

For code tasks: add the specified falsifying scenario, run its focused test to establish the old behavior/missing contract, implement the owner and consumers, then rerun. Each checkbox below is a reviewable task; use short commits within it only when authorized. Full mode is required here for architecture/build milestones: `npm run verify`, plus the task-specific SQL/Electron/Playwright commands. Focused commands accelerate the repair loop, not replace required final gates. Add the standard simplify/OCR/runtime/adversarial/sequential review evidence as triggered. Failed teardown, missing Supabase, skipped credentials or absent signing is an explicit gap.

For planned test files outside the baseline Vitest include (`src/**/*.test.ts`, `tests/architecture/**/*.test.ts`), the same PR must add a separate explicit config/script. All code snippets below are test or interface seeds, not unreviewed full implementations. Named scenario fixtures are created with real production composition in the corresponding task, with failure injection only at clock/storage/transport/OS boundaries.

## 5. PR1 — B2 BuildIdentity foundation

**Files:** create `game/src/shared/build/BuildIdentity.ts`, `game/src/shared/build/BuildIdentity.test.ts`, `game/scripts/release/build-identity.mjs`, `game/scripts/release/build-identity.test.mjs`; modify `game/package.json`, lockfile, `game/vite.config.ts`, `game/electron/main.ts`, `game/src/components/panels/SettingsPanel.vue`, `game/src/components/common/ErrorScreen.vue` and actual locale dictionaries located by their current imports. Generated output is build output, not a separately hand-edited source.

**Interfaces:** generator consumes package version/current save schema/full Git SHA and allowlisted CI metadata; produces one frozen `BuildIdentity`, renderer define and main define plus JSON manifest. Development builds use an explicitly marked development identity; release requires all fields, clean tree and matching tag/version. It cannot access arbitrary environment values for serialization.

- [ ] Add generator tests with known source inputs and secret sentinel fields. Prove missing SHA, mismatched version/tag and `0.0.0` release fail before build. Use `node --test scripts/release/build-identity.test.mjs`.
- [ ] Implement validation/generation and make renderer/main consume the same invocation. Read save version from the existing canonical module through a build-safe path, not a second hard-coded 87.
- [ ] Wire Settings/error display; add component assertions for version/build/SHA/schema/environment. Preserve localized UI primitives and read Vue/UI skills when editing them.
- [ ] Verify built main/renderer and manifest values agree. Existing `dist:win` must retain its behavior except identity generation; run full mode and production file-protocol smoke when packaged capability is available.

```ts
expect(identity.gitSha).toBe(input.gitSha)
expect(identity.saveSchemaVersion).toBe(CURRENT_SAVE_VERSION)
expect(JSON.stringify(identity)).not.toContain('planted-secret-value')
expect(Object.isFrozen(identity)).toBe(true)
```

**Acceptance:** one generated identity and fail-closed release input validation. **Later proof:** PR2 persists build ID, PR11/13 consume it, PR15 checks exact packaged identity. **Suggested commit:** `feat: establish beta build identity`.

## 6. PR2 — B1-A transactional backend and integration harness

**Files:** create forward migrations `game/supabase/migrations/202609300001_beta_authority_prepare.sql` and `202609300002_beta_authority_cutover.sql` (choose later unused timestamps on execution if necessary); create `game/supabase/tests/beta_authority.sql`, `game/tests/integration/supabase/authority.spec.ts`, `game/tests/integration/supabase/fixture.ts`, `game/playwright.supabase.config.ts`, `game/scripts/supabase/run-contract.mjs`, `game/docs/operations/beta/backend-cutover.md`; modify `game/package.json`/lock for harness commands as needed. Historical SQL stays unchanged.

**Interfaces:** prepare creates guarded versioned RPCs, save receipt/checkpoint tables, compatibility status and shared per-user locking. Cutover removes direct policies/grants and legacy claim/create overloads; final public RPC contract is spec B1.3. `claim_active_session(deviceLabel, protocolVersion, buildId)` records admitted protocol and every guarded operation validates it. `create_character` only provisions metadata. `load_game_state` distinguishes no-character/uninitialized/ready/deleted/incompatible data and returns progression cutoff/server checkpoint. `get_backend_status()` is observational, returns protocol version, accepted save schema, maintenance and minimum/supported client versions; unauthenticated callers receive no private state.

- [ ] Build disposable local Supabase fixture with real Auth/JWT/PostgREST. `npm run test:supabase` starts or requires an explicitly identified isolated project, applies migrations, seeds server talent catalog from canonical authored data, and fails nonzero when infrastructure is absent. No “skip = pass.” Service-role setup remains test-process-only and never enters browser or committed evidence.
- [ ] Write a two-connection SQL interleaving test: lock the user's profile row, let claim/save wait, release in each order, then assert only the admitted session commits. Add simultaneous claim and simultaneous revision-0 insert schedules. Lock order is profile -> session -> character -> save/receipt; all participating RPCs follow it.
- [ ] Add receipt/CAS cases: 0->1, 7->8, identical mutation retry stays 8, changed payload with reused ID rejected, mismatch leaves row/receipt unchanged, already-committed old receipt versus newer row, wrong user, revoked user, deleted character, unsupported schema and oversized bytes.
- [ ] Store progression cutoff independently of write timestamp. Issue server checkpoints bound to owner/character/anchor/lease; validate bounded monotonic offset, nondecreasing cutoff and request fingerprint. Add pending-at-T0/retry-at-T1, lost-ACK, expired/missing checkpoint proof, backwards/out-of-lease offset and prior-session replay tests. Existing verified history needed for a pending replay is preserved; missing proof reaches recovery, never guessed accrual.
- [ ] Implement constraints/RPCs. Derive owner from verified JWT. Check active session before receipt lookup. Bind receipt to request fingerprint server-side; use a deterministic server JSONB digest, not a client byte hash. Restrict function grants and search path, and bound payload/build/device fields. Receipt pruning is an operator job with a seven-day minimum; expired receipt retry never bypasses CAS.
- [ ] Add direct table/old overload/view attack through both anonymous-user and registered-user JWTs. Snapshot before rejection and prove zero row/revision/receipt mutation. Validate schema match and reject `{}` server-side.
- [ ] Run fresh-install and historical-upgrade migration paths. Seed old `{}` and valid saves, prove inventory/recovery classification preserves bytes/rows. Write client/schema compatibility table and phase-specific permission queries to the cutover runbook.

Transaction skeleton (same account lock in every session/save/provisioning operation):

```sql
select user_id from public.profiles where user_id = auth.uid() for update;
-- Reject missing caller/profile; then validate active session under this lock.
-- Resolve owned character; check prior mutation fingerprint; lock save row.
-- Validate payload and expected revision, mutate row + receipt atomically.
-- Keep all locks until transaction commit; failure leaves no partial write.
```

**Commands:** `npm run test:supabase`, then full verification. **Acceptance:** staging/local contracts and both migration histories proved; no live cutover yet. **Stop:** deployed migration inventory unavailable, destructive cleanup proposed, or test can only pass as service role. **Suggested commit:** `feat: add session-serialized save RPC contracts`.

## 7. PR3 — B1-B real adapter, provisioning and composition

**Files:** modify existing auth/character/cloud factories, `SupabaseCharacterCreationService.ts` and its contract test, `CloudSaveService.ts`, `CloudSaveCoordinator.ts`, `game/src/composables/useAppLifecycle.ts`, `game/src/App.vue`, `game/src/components/panels/SettingsPanel.vue`, `game/src/components/common/SaveIncompatibleScreen.vue` (recovery import/delete), `game/src/services/cloudSave/BOUNDS.md`; create `SupabaseCloudSaveService.ts` and `.test.ts`, `game/src/services/session/BackendStatus.ts`, `game/src/services/character/initializeCharacter.ts` and `.test.ts`. Retire `SupabaseRemoteSave.ts` only after consumer census/tests prove it unused.

**Interfaces:** explicit `mock | supabase` mode constructs one compatible backend bundle. Remote adapter consumes authenticated binding/BuildIdentity, implements `load()`/`save(snapshot, expectedRevision)` with typed backend result mapping. Preserve invalid/corrupted raw data for recovery. `initializeCharacter(metadata, owners)` uses the current App starter-grant owners and deterministic server picks; no reroll or duplicated grant logic.

- [ ] Extend factory tests: absent mode/credentials in release cannot instantiate mock; explicit development mock keeps local behavior. Add a release admission block until PR4-6 prerequisites are integrated; unsealed Supabase infrastructure is testable, but is not a launchable Beta artifact.
- [ ] Replace login reconciliation with authoritative RPC load; preserve shape/acceptance/registry validation. Update the coordinator so `remote-authoritative` conflict is terminal and never runs the current load-latest/retry-overwrite branch.
- [ ] Remove `p_initial_save` from client provisioning and use metadata-only server result. Extract the real initial-grant path without moving domain formulas. Cover process loss after provisioning and before first ACK: uninitialized metadata reconstructs one starter snapshot and revision 1 precedes tick.
- [ ] Census manual/import/reset/recovery APIs and classify each consumer. Remote mode validates/exports imported recovery data without overwriting cloud; cache reset restores cloud; hide/disable character-reset actions that lack a server transaction with truthful copy. Development tools remain explicit mock-only. Export identifies cloud/pending source and revision.
- [ ] Update BOUNDS and focused tests to describe the authorized remote boundary. Do not weaken the old local test by deleting its invariant; retain local-mode assertion and add remote-mode proof.

```ts
const result = await coordinator.save(snapshot)
expect(result.status).toBe('conflict')
expect(remoteWriteAttempts).toHaveLength(1)
expect(remoteRow.payload).toEqual(previousRemotePayload)
expect(tickCountBeforeFirstRemoteAck).toBe(0)
```

**Commands:** `npx vitest run src/services/cloudSave src/services/character src/composables/useAppLifecycle.test.ts`, `npm run test:supabase`, full mode and actual boot E2E. **Acceptance:** RPC path and consumers are wired; no parallel login/local authority in Supabase mode. **Suggested commit:** `feat: route beta saves through guarded Supabase authority`.

## 8. PR4 — B1-C durable journal, queue and lost-ACK recovery

**Files:** create `PendingSaveJournal.ts`, `AckedSaveCache.ts`, `reconcilePendingSave.ts` and adjacent tests under `game/src/services/cloudSave/`; modify existing coordinator, adapter, `saveKeys.ts`/tests and player save consumers; extend real Supabase integration fixture/cases.

**Interfaces:** `PendingSaveJournal.read(binding)`, `put(record)`, `clearMatching(binding, mutationId)` return typed storage failure; `AckedSaveCache` stores payload+revision+identity as one envelope; pure `reconcilePendingSave(pending, remote, receipt)` returns `retry-same | already-committed | conflict | quarantine`. One coordinator queue serializes every save caller. Snapshot building remains canonical and detached.

- [ ] Add storage failure injection before journal write, after journal/before transport, after remote commit/before response, after ACK/before cache write, after cache/before clear. Assert remote never overwritten and pending retained where unresolved.
- [ ] Add overlapping manual/autosave/quit calls. Keep an in-flight record immutable; queue one later detached snapshot, then assign its expected revision and new mutation ID after ACK. All flush callers join/drain this queue rather than start independent writes.
- [ ] Implement identity-bound single-envelope cache/journal and local byte hash validation, including the snapshot's server checkpoint and elapsed monotonic offset. Retries preserve its progression cutoff even when transport commit happens much later. Isolate by environment/project/user/character. Atomic storage replacement does not imply disk durability on abrupt OS failure; report storage/quota errors and preserve the server ACK as authority.
- [ ] Implement already-committed receipt resolution and genuine-conflict actions. Do not compare client `JSON.stringify` hash with server `jsonb::text`. If receipt commit is older than current remote, retrieve the current state rather than caching an obsolete payload.
- [ ] Test reset/logout/user switch while old transport resolves; old generation cannot advance revision, clear journal, write cache or resume UI. Quarantine mismatched/corrupt records for explicit export.

```ts
expect(await retrySameMutationAfterLostAck()).toMatchObject({ status: 'already-committed' })
expect(await readServerRevision()).toBe(8)
expect(await countCommitsForMutation()).toBe(1)
expect(await journal.read(otherBinding)).toBeNull()
expect(await journal.clearMatching(binding, olderMutationId)).toBe(false)
```

The five scenario helpers above are test-fixture functions implemented in this PR using its actual queue/adapter/journal plus real RPC for commit count; no fake CAS implementation is an oracle.

**Commands:** `npx vitest run src/services/cloudSave src/services/save/saveKeys.test.ts src/stores/player.save.test.ts`, `npm run test:supabase`, full mode. **Acceptance:** every named crash point has a deterministic recovery outcome and no duplicate durable write. **Suggested commit:** `feat: persist identity-bound pending saves and idempotent recovery`.

## 9. PR5 — B1-D online admission, reconnect, offline accrual and flush

**Files:** create `game/src/services/session/OnlineSessionController.ts`/test, `game/src/shared/session/FlushResult.ts`; modify `useAppLifecycle.ts`/test, `App.vue`, `game/src/stores/player.ts`/restore tests, `SaveSystem.ts`/restore tests, `game/src/core/game/GameManagerSaveRestore.ts` and its `onceOnlySettle`/`boundary`/`replace` tests, `game/src/core/idle/GameClock.ts` only where its explicit time-input API needs extension, `game/src/main-process/quitFlush.ts`/test, `game/src/composables/useElectronBridge.ts`/test, Electron main/preload and actual gameplay command/clock admission owners discovered by census. Create `game/tests/e2e/beta-authority.spec.ts` and `game/playwright.beta.config.ts` with production timing scale 1.

**Interfaces:** `OnlineSessionController` owns `AuthorityState`, generation, monotonic health deadline and `canMutate()`; all clocks/commands consume that decision. `pause(reason)` is reversible and distinct from terminal `stopAll()`. `flush(requestId)` returns `FlushResult`. Existing restore accepts an explicit `cold-boot` server time window or `live-replacement` zero-accrual context; reward formula/caps remain domain-owned.

- [ ] Census all autonomous drivers and user mutators: lifecycle interval, main-process combat clock, battle callbacks/settlement, production/cultivation, reward/catch-up, Settings save and logout/quit. Add production-composition tests asserting representative resources/vitals/queues unchanged after admission blocks, not just `clock.stop()` calls.
- [ ] Implement state transitions: boot/checking -> ready only after auth/session/compatibility/load/pending/restore/durability checks; any observed authority failure -> pause; revoked/conflict/recovery stay terminal until explicit owned action. Timer starts/stops and listener cleanup are idempotent and generation-bound.
- [ ] Implement 30-second heartbeat with 10-second request deadline and 40-second maximum freshness lease. Successful authenticated saves can renew freshness; `navigator.onLine` can block but never prove health. Suspend/resume invalidates admission until validation, reanchors every clock and discards accumulated paused delta.
- [ ] Reconnect in spec order. Same remote lineage resumes the existing state without invoking restore; divergent replacement constructs/reset owners and applies cloud with zero offline accrual. User actions cannot mutate while overlay is visible even through keyboard/hotkey/late callbacks.
- [ ] Refactor `player.restoreFromSave` time inputs so Beta never derives elapsed from editable client clock or transport `updated_at`. Cold boot loads/reconciles, uses the preserved progression cutoff and current server checkpoint for bounded accrual, commits resulting snapshot plus new cutoff before any tick/spend, then resumes. A save captured at T0 and retried at T1 still accrues T0..T1. Repeated restore/crash/lost ACK tests prove one durable grant and no lost eligible interval; existing local mock clock semantics remain characterized.
- [ ] Pass that same explicit time window through `restoreGameSession` to `GameManagerSaveRestore.restoreFromSave`: production, decomposition, auto-farm and alchemy independently read `Date.now()`/`lastSavedAt` in the baseline and must all consume the authorized context. Zero-accrual live replacement restores queues/jobs without granting catch-up. Test amounts, output delivery, queue state, timed-effect expiry and reward/event counts across all these owners, including restart under a new active session with a valid historical pending checkpoint.
- [ ] Replace quit's untyped ACK/finally and 2-second auto-success with request/generation/sender-bound result. Wait for queue drain and remote ACK; failed normal close offers retry/cancel/explicit force-close. Update installation always refuses unsuccessful flush. Late ACK and a forged sender do not close/install. Wire all callbacks through the same flush owner.

```ts
expect(stateAfterTransportTimeout).toBe('reconnecting')
expect(domainSnapshotAfterBlockedCommands).toEqual(domainSnapshotAtPause)
expect(tickDeltaOnResume).toBeLessThanOrEqual(normalTickDelta)
expect(quitInstallCallsAfterFailedFlush).toBe(0)
expect(coldBootTickCountBeforeAccrualAck).toBe(0)
```

**Commands:** `npx vitest run src/services/session src/composables/useAppLifecycle.test.ts src/composables/useElectronBridge.test.ts src/main-process/quitFlush.test.ts src/services/save src/stores/player.restoreFromSave.test.ts src/core/game/GameManagerSaveRestore src/core/idle`; `npx playwright test --config playwright.beta.config.ts`; `npm run test:supabase`; full mode. Real Electron clock/quit proof is mandatory, browser-only cannot prove native IPC. **Acceptance:** blocked authority has zero mutations after the observed transition and no catch-up/duplicate grant on resume. **Suggested commit:** `feat: enforce online authority across runtime and native flush`.

## 10. PR6 — B1-E persistent guest, upgrade and logout

**Files:** modify `SupabaseSession.ts`/tests, `SupabaseAuthService.ts`, `AuthService.ts`/tests, `game/src/components/onboarding/AuthEntryScreen.vue`, `game/src/composables/resumeSession.ts` and their tests; create `game/src/main-process/GuestCredentialStore.ts`/test, `game/supabase/functions/finalize-account/index.ts` only if a verified Auth-derived profile synchronization endpoint is required, and a forward profile-finalization migration; modify Electron bridge/main/preload; add `game/tests/electron/guest-persistence.spec.ts` and explicit `game/playwright.electron.config.ts`.

**First proof before dependent production edits:** disposable Supabase project with anonymous auth/manual linking/provider settings mirroring intended Beta. Create guest, provision/save, link verified identity, establish password, refresh JWT and prove UUID unchanged. Current `.invalid` login ID cannot receive verification mail. If no supported same-identity path works with that product policy, record EXT-09 as `SCOPE_DECISION_REQUIRED`; finish independent refresh/storage/logout tests but do not invent a privileged bypass. Existing-account sign-in is a separate explicit switch, never a transfer/merge.

- [ ] Run provider proof, recording only sanitized UUID relationships/settings and outcomes, never credentials. Confirm registration/confirmation, guest abuse controls/rate limits, login normalization and recovery UX policies; rate limits come from actual project configuration.
- [ ] Implement main-owned OS-protected store with fixed app-data path and allowlisted IPC. Renderer receives only operations/session data necessary for its auth boundary, never arbitrary filesystem access. Persist refreshed guest credentials before retiring the old durable record. Safe-storage unavailable/corrupted is a recovery error, not plaintext fallback/new anonymous signup.
- [ ] Make refresh single-flight, generation-bound and error-classified. Transient 5xx/timeout/offline retains identity/journal; terminal Auth rejection stops entry and explains unrecoverability. Game-session revocation retains guest Auth identity for explicit take-back; no auto-claim loop.
- [ ] Implement supported same-UUID linking and resumable verified profile synchronization. Duplicate finalize is idempotent; interrupted finalize continues from authoritative Auth state. Auth profile metadata from the client cannot elevate account_kind or bind another login.
- [ ] Implement logout via PR5 flush/revoke/signout; guest abandon confirmation explains access loss and offers upgrade/export/cancel. Offline local signout cannot claim server revoke succeeded. Namespace binding is cleared and no pending journal migrates into another account.
- [ ] Exercise full process close/reopen with encrypted refresh credential, rotated token, rejected token, transient refresh failure and profile-finalization interruption. Registered default remains session-scoped unless a product ruling approves remember-me.

```ts
expect(reopenedGuest.userId).toBe(originalGuest.userId)
expect(upgradedUser.userId).toBe(originalGuest.userId)
expect(upgradedCharacter.id).toBe(originalCharacter.id)
expect(await credentialExistsAfterTransientFailure()).toBe(true)
expect(newGuestSignupCallsAfterRefreshTimeout).toBe(0)
```

**Commands:** `npx vitest run src/services/supabase src/services/auth src/main-process/GuestCredentialStore.test.ts`, `npx playwright test --config playwright.electron.config.ts tests/electron/guest-persistence.spec.ts`, `npm run test:supabase`, full mode. **Acceptance:** guest persistence/upgrade/logout verified, EXT-09 resolved by evidence or still visibly blocked. **Suggested commit:** `feat: preserve guest identity through restart and account transitions`.

## 11. PR7 — B1-F coordinated cutover and production-like proof

**Files:** expand `game/tests/integration/supabase/authority.spec.ts`, `game/tests/e2e/beta-authority.spec.ts`, `game/tests/electron/guest-persistence.spec.ts`; update `game/docs/operations/beta/backend-cutover.md`, `game/docs/qa/runs/beta-final-b1/` evidence and the online row in `game/docs/roadmap.md` only on seal. Repairs return to PR2-6 owners and invalidate dependent evidence.

- [ ] Inventory the actual target project's migration history and old client population through authorized operator output. Preflight backups/restore route; no connection strings or secrets in evidence.
- [ ] Materialize complete PR2-6 client. Compatibility matrix: old schema/old client = baseline only; prepared schema/old client = transition unsealed; cutover schema/old client = server access denied by retired overloads/revoked sessions/grants; cutover schema/new client = eligible after checks. Test every cell, including retained legacy JWT/session/cache. The old binary can continue local fallback; replace controlled tester installs before Beta enrollment and never ingest their later local progress automatically. Do not claim the new status endpoint stops a client that never calls it.
- [ ] With deployment authority, freeze writes/old sessions, apply prepared+cutover migrations, verify grants/overloads/constraints and versioned claim, replace controlled tester installs with the compatible client, and run read-only health/canary before admitting Beta play. If deployment authority is absent, keep local/staging results and gate unsealed.
- [ ] Run two independently authenticated devices, both claim orders, revoked direct table/RPC attempts, concurrent writes, forged fields, all journal crash points, guest restart/upgrade, token refresh, clock skew and first-save/no-tick proof. Ordinary authenticated JWTs are the attack principals.
- [ ] Lift the PR3 launch-admission block only after required B1 evidence closes; development mock mode stays explicit. Record exact client SHA/backend migration hashes; update BOUNDS/roadmap truthfully.

**Commands:** `npm run test:supabase`, both Beta browser/Electron configs and full mode. **Acceptance:** B1 matrix/seal per spec; signed RC re-executes artifact-dependent cases at PR15. **Suggested commit:** `test: certify beta Supabase authority and cutover`.

## 12. PR8 — B3 packaging and approved assets

**Files:** modify `game/electron-builder.yml`, `game/electron/main.ts`, `game/vite.config.ts`, `game/package.json`/lock; create `game/build/icon.ico` from approved source, `game/build/asset-provenance.md`, `game/scripts/release/inspect-package.mjs`, `.test.mjs`, `game/docs/operations/beta/windows-install.md`. Approved source is EXT-10; do not invent publisher metadata.

- [ ] Capture allowlisted package manifest and tests rejecting source/test/credential/dev-tool/log content. Confirm which updater/runtime dependencies must be bundled when added later; existing blanket `!node_modules/**/*` is not automatically correct after dependency changes.
- [ ] Set stable product/app/executable identity, per-user NSIS behavior, multi-size icon, copyright/publisher, version and artifact names. Ensure runtime icon is included at the path main loads, not merely builder input. Turn off dev tooling in release build.
- [ ] Validate CSP, no Node integration, context isolation/sandbox, allowlisted navigation/new-window and IPC sender/frame checks; exercise file-protocol boot with production assets and no Vite server.
- [ ] Build unsigned dry-run from clean checkout, inspect payload, install/uninstall/reinstall on clean supported Windows. Preserve guest userData by default; deleting it requires explicit local-data choice explaining guest access loss. Record taskbar/Explorer/installer/Apps metadata and local-data behavior.

**Commands:** `node --test scripts/release/inspect-package.test.mjs`, `npm run verify`, `npm run dist:win`, `node scripts/release/inspect-package.mjs --input release` (new inspection command, refuses ambiguous multiple candidate manifests). **Acceptance:** repeatable package capability and clean-machine dry-run. **Final seal:** signed candidate checks at PR15. **Suggested commit:** `build: finalize Windows beta package identity and contents`.

## 13. PR9 — B4 signing plumbing

**Files:** modify builder config; create `game/scripts/release/verify-signatures.ps1`, `game/scripts/release/signing-preflight.mjs`/test and `game/docs/operations/beta/signing.md`. Select configuration supported by the locked electron-builder version, not unversioned online examples.

- [ ] Add preflight fixtures proving missing certificate/service identity cannot produce a releasable Beta and PR/fork contexts never receive signing credentials. Redact secret-bearing failures at capture time.
- [ ] Configure the authorized certificate/service with protected CI references, SHA-256 and RFC3161 timestamp. Sign app binaries/helpers as builder assembles package; sign installer last. Track subject/thumbprint/expiry as public evidence only.
- [ ] Implement signature verifier enumerating expected signed files, rejecting missing/invalid/wrong-publisher signatures and tampering. Do not infer that trusted signing guarantees SmartScreen reputation.
- [ ] Run unsigned plumbing checks. If EXT-02 is resolved, use an authorized protected signing invocation and verify on clean Windows; otherwise retain a clearly unsealed B4 evidence obligation for PR10/15.

```powershell
$betaSignature = Get-AuthenticodeSignature -LiteralPath $ArtifactPath
if ($betaSignature.Status -ne 'Valid') { throw 'Invalid artifact signature' }
if ($betaSignature.SignerCertificate.Thumbprint -ne $ExpectedThumbprint) { throw 'Unexpected publisher' }
```

`ArtifactPath` and `ExpectedThumbprint` are typed script parameters supplied from the candidate manifest and approved certificate record; no secrets in them.

**Commands:** `node --test scripts/release/signing-preflight.test.mjs`, full mode; packaged sign/verify when authorized. **Acceptance:** signing plumbing and fail-closed verification; no false seal without real signature. **Suggested commit:** `build: enforce protected Windows signing and verification`.

## 14. PR10 — B5 draft release pipeline and candidate feed

**Files:** create `.github/workflows/beta-checks.yml`, `.github/workflows/beta-release.yml`, `game/scripts/release/manifest.mjs`/test, `game/scripts/release/publish-candidate.mjs`/test, `game/docs/operations/beta/release.md`; extend identity/package/signing checks.

- [ ] Separate read-only PR verification from protected signing/publishing. Pin action revisions and toolchain versions; record Windows image identity. Use job-scoped minimal permissions, protected environment, release concurrency and exact tag/SHA checks. Never execute untrusted PR head with release secrets.
- [ ] Implement validation -> npm ci -> full verify/integration -> compile -> sign app -> package/sign installer -> inspect signatures -> generate manifest/checksums/SBOM/provenance -> draft upload. Verify lock/toolchain/backend identity and reject dirty/tag mismatch. No CI log environment dump.
- [ ] Artifact manifest lists all installer/update metadata/blockmap files with SHA-256, version, source/build/schema/environment, signing identity and migration contract. Checksum generation happens after final signing; upload never rebuilds.
- [ ] Implement idempotent draft upload: matching existing asset hash is reusable; mismatch rejects. Never replace published version bytes. Test mocked provider authorization/asset responses; authorized draft smoke uses actual GitHub download and digest verification.
- [ ] Resolve EXT-04. Provide restricted candidate transport with the same provider contract as Beta, tester entitlement and unchanged package bytes. A private GitHub token stays on server/CI, never installer. Production feed is untouched during candidate QA. Public publication is a separate protected promotion job requiring B10 evidence and explicit authority.

```ts
expect(retryUploadWithSameHash.status).toBe('unchanged')
expect(retryUploadWithDifferentHash.status).toBe('rejected')
expect(promotionWithoutCertification.status).toBe('blocked')
expect(downloadedAssetSha256).toBe(manifestArtifact.sha256)
```

**Commands:** `node --test scripts/release/*.test.mjs`, full mode, controlled workflow/draft download when authorized. **Acceptance:** protected pipeline/draft bytes/feed usable for QA; B5 public promotion remains pending. **Suggested commit:** `ci: build immutable signed beta candidates and release evidence`.

## 15. PR11 — B8 diagnostics and local crash bundle

**Files:** create shared diagnostic contract, recorder/redactor/tests, main bundle/rotation/tests as section 3; modify existing `ErrorBoundary.vue`, `ErrorScreen.vue`, current error store located by imports, main/preload/bridge and lifecycle owner. Create `game/src/services/diagnostics/CrashReporter.ts` with `LocalBundleCrashReporter`; no remote vendor SDK.

**Interfaces:** `DiagnosticRecorder.record(event)` validates an allowlisted structured event before persistence; `exportBundle()` writes only through main's fixed-path/save-dialog flow. `CrashReporter.capture(record)` consumes already-redacted metadata. Bound entry count, field length, rotated file size/count and total bundle size by measured fixtures.

- [ ] Write planted fake password/JWT/refresh-token/URL-query/path/raw-save redaction tests, including Error objects, stack traces, nested payloads and malicious renderer events. Prefer schema allowlists over regex-only cleanup. Freeform event transport payloads are not accepted.
- [ ] Wire renderer error/unhandled rejection/Vue boundary, main error and render-process-gone, save/session/quit events. Record build/route/code/correlation and coarse revision metadata, never full HTTP body or storage dump.
- [ ] Add bounded ring/rotation, safe concurrent append and export manifest/text summary. Native path access uses approved IPC; denied disk access cannot crash the game or leak original data.
- [ ] Induce real packaged renderer failure and export from surviving main/relaunch surface; verify usable bundle and exact identity. Define remote-provider interface only; privacy/provider approval remains external for remote telemetry.

```ts
expect(bundleText).not.toContain(plantedRefreshToken)
expect(bundleText).not.toContain(plantedRawSave)
expect(bundle.manifest.buildId).toBe(identity.buildId)
expect(bundle.events.length).toBeLessThanOrEqual(config.maxEntries)
```

**Commands:** `npx vitest run src/services/diagnostics src/main-process/DiagnosticBundle.test.ts`, full mode and packaged error/export test. **Acceptance:** B8 local bundle with stable report ID; B7 does not block it. **Suggested commit:** `feat: add bounded redacted beta diagnostics and local reports`.

## 16. PR12 — B6 updater with safe install admission

**Files:** shared update state, main UpdateService/tests, renderer useUpdates/tests as section 3; modify package/lock, main/preload/bridge, Settings/error UI and locales, builder provider config; create `game/tests/electron/beta-update.spec.ts`.

**Interfaces:** `UpdateService.check()`, `download()`, `install(requestId)` live in main. Renderer gets `UpdateState` and allowlisted actions, never arbitrary URL/file path/publisher. Installation consumes PR5 `FlushResult` and PR2 compatibility status; diagnostic events consume PR11.

- [ ] Add pure transition/provider tests for no-update/check error/available/progress/interrupted/corrupt/wrong publisher/wrong environment/older version. Keep download/check failures independent of healthy gameplay admission.
- [ ] Pin updater compatible with installed builder/Electron, configure beta channel/provider, expected publisher and HTTPS trust. Inspect package runtime dependencies and generated app-update/update manifests; do not ship a repository token or rely on arbitrary `setFeedURL`.
- [ ] Implement download/install state machine with cancellation/disposal and sender validation. Before install, pause admission, drain flush, verify exact current generation and successful remote revision. On failure keep candidate downloaded but do not install; explicit recovery choices do not turn failure into success.
- [ ] Wire existing UI primitives for update availability/progress/retry/later/notes. Backend minimum version/maintenance can block entry through session controller; update availability alone cannot.
- [ ] On two separately identified signed N/N+1 candidates, test restricted feed download/install/relaunch and same cloud revision lineage, interruption, 404, corrupt manifest/package, invalid signature, wrong channel, pending/conflicted save and close during install preparation.

```ts
expect(installCallsForFailedFlush).toBe(0)
expect(installCallsForStaleGeneration).toBe(0)
expect(installedBuild.buildId).toBe(nextManifest.buildId)
expect(restoredCharacter.id).toBe(characterBeforeUpdate.id)
```

**Commands:** focused main/composable Vitest files, `npx playwright test --config playwright.electron.config.ts tests/electron/beta-update.spec.ts`, full mode, package inspection/signature checks. **Acceptance:** real signed version-to-version proof; browser simulations alone do not seal B6. **Suggested commit:** `feat: add verified beta updates with cloud-save flush gating`.

## 17. PR13 — B7 feedback intake

**Files:** feedback service/types/adapter/dialog/tests as section 3; new `game/supabase/migrations/202609300003_beta_feedback.sql` and optional `game/supabase/functions/submit-feedback/index.ts` if required by the chosen rate-limit seam; main/renderer entry/error surfaces, locales and integration feedback tests.

**Interfaces:** `FeedbackService.submit(draft, idempotencyKey)` returns `accepted(reportId) | invalid | rate-limited | unavailable | session-revoked`; draft includes category/description/steps/optional contact, BuildIdentity and selected previewed redacted diagnostics. Server derives identity and validates active session for submission; local export remains available when revoked/offline.

- [ ] Set explicit field/total-byte/rate limits from approved EXT-06 policy and measured payload fixtures. Create server table/grants without public read or unrestricted insert. A client cannot spoof owner, build environment or authoritative revision attribution.
- [ ] Add server duplicate retry/rate limit/invalid payload/expired session/wrong owner tests. Store idempotency key scoped to owner; same key with different body rejects. Persist only approved fields and retention metadata.
- [ ] Implement form with canonical primitives, preserved draft after failure, preview/consent for attachments and stable report ID on success. An export remains local until user chooses submission. Error screen can export even if Auth is invalid.
- [ ] Submit from packaged Beta, check intake correlation to manifest/revision/report ID, inspect redaction and operator access. Exercise contact-free report and offline/revoked fallback.

```ts
expect(secondIdenticalSubmit.reportId).toBe(firstSubmit.reportId)
expect(await countReportsForIdempotencyKey()).toBe(1)
expect(unavailableSubmit.status).toBe('unavailable')
expect(formAfterFailure.description).toBe(originalDescription)
```

**Commands:** feedback Vitest/component tests, `npm run test:supabase`, full mode and actual packaged submit/export proof. **Acceptance:** report received with safe identity correlation and policy-controlled storage. **Suggested commit:** `feat: add privacy-scoped beta feedback intake`.

## 18. PR14 — B9 operations, backup and rollback

**Files:** create `game/docs/operations/beta/README.md`, `environments.md`, `health-and-quota.md`, `backup-restore.md`, `incident-response.md`, `compatibility-and-rollback.md`, `evidence-template.md`; extend release/cutover/signing/windows runbooks. Operational scripts under `game/scripts/operations/` are added only for concrete operator commands, with dry-run tests and explicit target validation.

- [ ] Fill environment inventory using non-secret project references, migration hashes, supported client/schema contracts, actual provider plan quotas, named accountable operators, backups/retention and alerts. Unknown owner/threshold remains external blocker, never a filled fake value. Record how operators obtain secrets without pasting them into docs.
- [ ] Rehearse maintenance/quota/client-floor controls already introduced in PR2. Prove client admission/error UX on backend outage and minimum-version mismatch. Record canary query, expected result, who changes control and rollback action.
- [ ] Restore an encrypted authorized backup into an isolated project. Verify Auth identities, profiles, characters, save rows/revisions/receipts, grants and migration compatibility—not only row count. Freeze/revoke sessions during any real recovery; document RPO/RTO from measured drill and provider guarantees.
- [ ] Exercise bad release: freeze production update feed, preserve immutable release evidence, assess schema compatibility, roll forward or explicitly reinstall a safe signed version. Automatic downgrade stays disabled. Old client must reject future save schema before mutation.
- [ ] Run incident tabletop for failed migration, quota, leaked key, certificate expiry, broken updater and feedback/diagnostic triage. Ensure another operator can follow prerequisites/action/observable/abort/escalation/recovery without session knowledge.

**Commands:** operator-specific dry-run/health/restore verification commands written and validated in the runbooks; full mode when production scripts/contracts change. **Acceptance:** real isolated restore plus timed tabletop with exact outputs and owners. **Suggested commit:** `docs: operationalize beta health backup and release recovery`.

## 19. PR15 — B10 exact-candidate certification

**Files:** evidence only under `game/docs/qa/runs/beta-final-rc/` and release checklist/runbook evidence references. Any product/test/oracle repair returns to the owning PR and produces a new reviewed state.

- [ ] Freeze integrated source/contract/attack model and environment identities through canonical QA runner. Produce signed N and N+1 with manifest/SBOM/checksums; N contains working updater and compatible schema. Freeze final N+1 bytes after all runtime features are present.
- [ ] Recheck B2-B9 artifact-dependent evidence on final candidate: Settings/error identity, no secret/source content, publisher/icon/install policy, valid signatures, immutable download hashes, diagnostics/feedback, real health and backup/rollback readiness.
- [ ] Run the spec's 17-step B10 journey on clean supported Windows and actual Beta Supabase, with two device identities. Record exact outputs/revisions and traces, not just screenshots. Include both physical network loss detection bound and zero mutation after pause; all named crash/revoke/conflict/update scenarios remain required.
- [ ] Execute canonical full deterministic/runtime/adversarial/sequential review, independent Clean A and Clean B separated by new falsification attempts, required mutation coverage and exact final full verification. Use protocol ledger/scheduler; never invent clean verdicts from a review count. All actionable findings close or the candidate stays unsealed.
- [ ] Independently verify the terminal predicate and artifact manifest. Append certification receipt without modifying governed candidate files. With explicit publication authority, promote exact signed N+1 bytes and update metadata; verify post-publication download/signature/health. PR evidence can be merged without claiming unauthorized promotion occurred.

**Acceptance:** canonical B10 success sentence bound to exact candidate/environment; no missing platform/service evidence. **Suggested commit:** `docs: record frozen beta release candidate certification`.

## 20. External-input work queue

Resolve independent inputs early; only the dependent slice pauses. This plan does not purchase certificates, enable provider settings, publish assets or provision cloud infrastructure.

| Input | Earliest action and proof | Blocks |
|---|---|---|
| EXT-01 Supabase environments/access | Owner provisions disposable/staging/Beta; sanitized settings/migration inventory and Auth smoke | Real B1/B7/B9/B10 evidence |
| EXT-02 signing service | Confirm usable CI signing method, publisher/expiry and protected credentials | Real B4 and signed update/RC |
| EXT-03 GitHub protection | Owner configures environment approval/permissions/runner access | Protected signing/draft/promotion |
| EXT-04 artifact transport | GitHub repository was verified public on 2026-09-29; use published public assets where approved and resolve restricted draft/candidate transport before implementation | Updater provider and restricted candidate testing |
| EXT-05 clean Windows/two devices | Reproducible snapshots and environment manifest | Install/native/two-device seals |
| EXT-06 privacy/retention | Approve contact/diagnostic fields, retention/access/deletion and consent | Feedback collection; remote telemetry remains optional |
| EXT-07 backup operator/storage | Encrypted destination, retention, restore access and named owner | B9 restore and final recovery readiness |
| EXT-08 support matrix | Confirm Windows versions/architectures | Packaging/final coverage claims |
| EXT-09 credential upgrade policy | Real same-UUID linking experiment with current login-ID policy; decision if incompatible | B1-E implementation admission and B1/B10 seal |
| EXT-10 product art/publisher | Approved icon source/license and actual publisher metadata | Package/signing identity |

## 21. Coverage and handoff checks

| Spec requirement family | Implementing tasks | Decisive final evidence |
|---|---|---|
| B1 explicit remote authority/RPC/session/CAS/no bypass | PR2/3/7 | Ordinary JWT direct/RPC attacks and two-transaction ordering |
| B1 provisioning/restart/first durable tick | PR3/4/5/7 | Metadata-only create, crash before first ACK, no tick before revision 1 |
| B1 cache/journal/lost ACK/conflict | PR2/4/7 | Durable receipt, same-ID replay, genuine divergence refusal |
| B1 network/revoke/reconnect/time/flush | PR5/6/7 | Production clocks/user commands blocked; no catch-up/offline duplication |
| B1 guest persistence/upgrade/logout/isolation | PR6/7 | Real same UUID restart/linking and cross-account fences |
| B2 identity | PR1 plus consumers PR2/11/12/13 | Main/renderer/save/report/artifact manifest equality |
| B3 package | PR8/15 | Clean-machine signed final package inspection |
| B4 signing | PR9/10/15 | Real trust/publisher/tamper verification |
| B5 pipeline | PR10/15 | Exact source/toolchain -> immutable signed bytes -> authorized promotion |
| B6 update | PR12/15 | Signed N -> N+1 with same character/save lineage |
| B7 feedback | PR13/15 | Actual Beta intake with safe correlated report |
| B8 diagnostics | PR11/15 | Induced packaged error and redacted local bundle |
| B9 operations | PR14/15 | Restore drill/tabletop/health and compatible rollback |
| B10 certification | PR15 | Canonical terminal predicate for frozen exact candidate |

Before executing each task, reconcile current source changes with these planned contracts. Keep this single plan and master spec as the mission pair; task cards/evidence belong to scoped QA runs, not competing master specs. Do not create one implementation PR spanning these tasks. Stop each PR at its coherent accepted responsibility, report which implementation/evidence milestones remain, and continue the authorized dependency order.

Documentation validation for this planning PR: relative links and existing file references checked, proposed paths explicitly marked, B1-B10 coverage and acyclic milestone table reviewed, no production assertions presented as executed. Initial independent reviewer findings R1-R6 were reconciled into the spec; coordinator findings R7-R11 were addressed in the task contracts. A second independent resulting-state review found R12/R13, resolved with progression checkpoints, the full manager-restore consumer chain and explicit legacy-client admission limits.

Chronological documentation review evidence (2026-09-29):

1. Initial fresh-context spec review against original spec/baseline: six material findings R1-R6; coordinator verified the cited SQL/callers and corrected the contracts before plan review.
2. Fresh-context review of the corrected spec plus complete plan: R12/R13 remained actionable; coordinator verified `GameManagerSaveRestore`, retained-session entry and legacy local fallback, then corrected all affected producer/consumer/task contracts.
3. Resulting-state review after those fixes: reviewer re-read actual files, confirmed both findings closed and found no remaining material gap. Reviewed SHA-256: spec `4445e08e56436b5c63c5dc6e8027ab2133396a5c059eeee9e7a6afc1eafe833d`; plan `1ed45cb160f01b8357399320049d39989ad0a949280006a707ce0b76fa886df4`. These identify the reviewed documents before this evidence paragraph and whitespace-only Markdown hard-break cleanup; they are not claimed as the final committed file hashes.

Primary final checks repeat links/fences, current-source references, gate/PR coverage, contract names, dependency order, scope and staged whitespace after the reporting/formatting edits. Documentation status is ready for PR review. Production QA, SQL deployment, signing, real provider upgrade, Windows runtime and B1-B10 seals remain unexecuted; no `QA_FIXED_POINT_REACHED` claim is made.

## 22. Provider reference notes

Checked 2026-09-29; revalidate against the actual locked toolchain/project configuration at execution. Sources explain provider constraints; project product policy remains in the master spec.

- [Supabase anonymous sign-ins and identity conversion](https://supabase.com/docs/guides/auth/auth-anonymous): anonymous identity uses authenticated role, persistence loss matters, and conversion requires linking with provider verification. See EXT-09 rather than assuming synthetic email works.
- [electron-builder v26 auto-update](https://www.electron.build/v26/docs/features/auto-update/): use generated provider metadata and verify selected transport behavior with the pinned builder/updater pair.
- [electron-builder Windows signing](https://www.electron.build/docs/features/code-signing/code-signing-win/): application executables and installer need signing; use configuration supported by the installed release, not a copied moving-version example.
