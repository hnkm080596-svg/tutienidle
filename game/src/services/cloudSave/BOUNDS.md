# Cloud save adapter boundary (R10, AR-15 + beta-final B1)

`cloudSaveCoordinator` is composed by the single backend bundle
(`services/backend/backendBundle.ts`, explicit `VITE_BACKEND_MODE = mock | supabase`).
There is no environment/config branching inside
`CloudSaveServiceFactory.ts` — the factory re-exports whatever the bundle
resolved, and the bundle only ever produces ONE compatible shape
(auth + character-creation + cloud-save services) per mode.

## Mode `mock` — local-only boundary (unchanged invariants)

`LocalCloudSaveService` under the hood. `CloudSaveService.capability` is
`'local-only'`, and `CloudSaveServiceFactory.test.ts` still guards this:
the test environment resolves the mock composition, so any regression
that made the default export remote-capable fails immediately.

"Local-only" specifically means:

- **Storage:** a single `localStorage` key pair (`SAVE_KEY` +
  `SAVE_REVISION_KEY`, see `services/save/SaveSystem.ts`), not a remote
  table/bucket.
- **Concurrency:** compare-and-swap on a `revision` integer, but the
  compare-and-swap itself is **not atomic** across the two `localStorage`
  writes (revision written first, then the save payload — see the 9.11
  comment in `LocalCloudSaveService.save()`). Two tabs/processes writing at
  the same instant is last-writer-wins, not a real transaction.
- **Transport:** none. Everything is synchronous local disk I/O wrapped in
  `Promise`s to match the `CloudSaveService` interface shape.
- **Conflict semantics:** `CloudSaveCoordinator` resyncs the latest local
  revision and retries once (`recoveredFromConflict`) — a storage-level
  CAS repair, not a network race.

## Mode `supabase` — remote-authoritative boundary (B1.5–B1.9)

`SupabaseCloudSaveService` under the hood. `capability` is
`'remote-authoritative'`; the server RPC surface owns admission, revision
CAS, and idempotent commit. Everything the client does is mapping and
caching — never an independent authority:

- **Load:** `load_game_state(p_session_id)` is the authoritative boot
  read. The old newest-wins login reconciliation (`SupabaseRemoteSave`)
  is retired — two remote mechanisms may not coexist. Statuses map to the
  `CloudSaveLoadResult` union, including `uninitialized` (character row
  exists, no save row — rebuild the starter snapshot) and `deleted`
  (terminal, no recovery surface).
- **Write:** `write_character_save` CAS via `expectedRevision` +
  `mutationId` + server-issued `timeCheckpoint` (checkpoint anchored by
  the load, or `heartbeat_session` when a save-first path needs one —
  never fabricated).
- **Conflict:** TERMINAL. `CloudSaveCoordinator` returns the result
  unchanged for `remote-authoritative` capability — no re-sync, no retry
  write (B1.6). Recovery is a fresh authoritative load.
- **Cache:** localStorage keeps only server-ACKed bytes + revision
  (revision-first ordering). The cache is a mirror, never a source of
  truth — read only by the export/status seams, never by `load()` for
  authority. PR4 replaces this transitional split-key form with the
  identity-bound envelope.
- **Client pipeline parity:** a downloaded payload passes the SAME
  version gate → shape validation → normalization → acceptance gate as a
  local load. A payload the server committed but this build cannot
  consume surfaces as `incompatible`/`corrupted` with raw preserved for
  recovery — never silently restored.
- **Recovery surfaces:** manual import in remote mode validates/exports
  the file only (`services/save/recoveryApi.ts`) — no client-side path
  may overwrite the cloud row. Cache reset clears local keys and
  restores whatever the authoritative row holds; exports stamp
  source + revision onto the artifact filename.
- **Errors:** PostgREST/guard raises (errcode `28000`) and HTTP classes
  map onto `BackendErrorCode` (`SESSION_REVOKED`, `PROTOCOL_OUTDATED`,
  `AUTH_EXPIRED`, `SERVER_ERROR`, `NETWORK_UNAVAILABLE`, `SAVE_INVALID`,
  `SAVE_TOO_LARGE`, `CONFIGURATION_ERROR`); server `REJECTED` codes keep
  their meaning through `detail`.

**Release admission stays `blocked`** until PR4–PR6 seal the durable
journal, online admission, and identity surfaces — the composition
resolves and is testable, but it is not launchable.
