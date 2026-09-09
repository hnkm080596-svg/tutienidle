# Cloud save adapter boundary (R10, AR-15 local scope)

`cloudSaveCoordinator` (see `CloudSaveServiceFactory.ts`) always wraps a
`LocalCloudSaveService`. There is no environment/config branching to a
remote adapter today — the factory unconditionally constructs the local
one. `CloudSaveService.capability` is `'local-only'`, and `CloudSaveServiceFactory.test.ts`
guards this: it fails immediately if the factory ever starts returning
anything else without a deliberate, separately-scoped change here.

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
  `Promise`s to match the `CloudSaveService` interface shape a remote
  adapter would eventually need.

**Auth is a separate product boundary.** `services/auth/*` /
`services/supabase/*` (character creation, Supabase-backed accounts) do
**not** imply an account-bound cloud *save* path — that would be a new,
explicitly-scoped remote-adapter mission (new `CloudSaveService`
implementation, real transactional writes, conflict UX, migration of the
local save on first login). Do not wire one in by branching inside
`CloudSaveServiceFactory.ts` without that scope.
