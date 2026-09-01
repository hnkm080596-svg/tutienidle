# Save and Cloud

## Load When

Changes touch `src/services/save/`, `src/services/cloudSave/`, `src/composables/useBootFlow.ts`, save issue/offline summary persistence stores, `App.vue` boot/autosave integration, or any persistent field added to a `GameManager`-managed system.

## State Owners and Boundaries

`src/services/save/SaveSystem.ts` owns current save construction, local-storage read/write, shape validation, backup/recovery helpers, and current-version classification. `src/services/cloudSave/CloudSaveCoordinator.ts` owns the in-memory revision used to load/save one cloud session and retries one conflict after a resync. `src/services/cloudSave/CloudSaveService.ts` implementations provide storage behavior. `src/composables/useBootFlow.ts` consumes outcomes and chooses user-visible recovery. Old-save migration compatibility is explicitly out of scope in this development phase.

## High-Risk Invariants

- A current-shape snapshot round-trips through save/load without losing required state.
- Ordinary local saves write directly; selected destructive operations back up the prior raw save first, so no unimplemented atomic-write guarantee is assumed.
- Corrupt, partial, and wrong-version current data are classified without silently replacing it as a new game.
- Cloud writes use the coordinator revision; conflict handling follows the current last-writer-wins resync-and-one-retry policy.
- Two overlapping writers or autosaves do not leave the coordinator permanently stale after a recoverable conflict.
- Network interruption surfaces an unavailable/error result without fabricating a successful revision.

## Attack Recipes

- Build a populated current-version save, write it, load it, and compare required persisted collections/fields; observe an accepted current shape.
- Inject or simulate interruption/failure at a local write, then inspect the main and backup raw saves: for ordinary direct saves, expose the absence of an atomic recovery guarantee; for a documented backup-first destructive path, call `restoreBackup()` and observe restoration of the prior raw save.
- Replace the raw current save with malformed JSON and a valid-version partial shape; observe `corrupted`, no silent reset, and a recovery path.
- Use two coordinator instances against a revisioned fake service; write from one, then save stale data from the other; observe resync plus at most one retry and a refreshed revision.
- Start overlapping autosave promises, make one unavailable, and verify the later result and displayed issue reflect the actual outcome rather than a fabricated success.

## Cross-System Chains

- Combat loot → bags/player state → `buildGameSave()` → local reload.
- Boot `loadGame()` outcome → `useBootFlow` stage → recovery or character-creation UI.
- Cloud conflict → coordinator resync → retry result → autosave/UI issue reporting.

## Existing Test Seams

`SaveSystem.test.ts` covers empty/ok/incompatible/corrupted classification, shape guards, backup/restore, delete, and import behavior. `SaveRoundTrip.test.ts` verifies generated current saves pass shape validation. `saveShapeValidation.test.ts` exercises current-shape validation. `CloudSaveCoordinator.test.ts` covers revisions, conflict recovery, repeated conflict, and reset. `useBootFlow.test.ts`, `tests/e2e/save-reload.spec.ts`, and `tests/e2e/boot-fresh.spec.ts` cover boot/reload handoffs.

## Coverage Gaps to Look For

Look for tests that model concurrent autosaves at the integration boundary, not only coordinator calls in isolation. Check whether corrupt-data UI exposes a safe observable action before any subsequent write. Do not add migration assertions for older save versions; migration compatibility is deliberately excluded.
