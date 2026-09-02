# QA Review: Save & Cloud Subsystem Exploration (Read-Only Audit)

- Date: 2026-09-02
- Mode: quick (read-only exploration pass; no reproduction tests authored per task instruction)
- Verdict: PASS WITH GAPS (exploration audit — hypotheses ranked, no production changes made)
- Task-owned paths: `game/src/services/save/`, `game/src/services/cloudSave/`, `game/src/composables/useBootFlow.ts`, `game/src/App.vue`, `game/src/stores/player.ts` (consumer), `game/src/core/game/GameManager.ts` (buildGameSave/restoreFromSave)

## Scope and Risk Map

Read-only adversarial exploration of the save/cloud subsystem. No files modified, no tests authored, no commits made. Consumers traced: `stores/player.ts` (`save`/`load`/`restoreFromSave`), `App.vue` (boot + autosave lifecycle), `core/game/GameManager.ts` (`buildGameSave` is in SaveSystem; `restoreFromSave` at GameManager.ts:3055, `preflightSaveRegistryReferences` at :3032).

## Invariant Ledger

| # | Invariant class | Invariant | Evidence | Risk |
|---|---|---|---|---|
| I1 | Conservation | buildGameSave() persists every field the validator requires, and vice versa | SaveSystem.ts:524-577 vs saveShapeValidation.ts:451-528; SaveRoundTrip.test.ts:45 | Medium |
| I2 | Boundedness | Persisted numerics are validated against NaN/Infinity/negative | saveShapeValidation.ts `isFiniteNumber`/`isNonNegativeNumber` guards | High |
| I3 | Synchronization | Two overlapping autosaves / pagehide races do not corrupt or fabricate success | App.vue:195-227 saveInFlight gate; coordinator single-instance | High |
| I4 | Atomicity | Destructive ops back up prior raw save before overwrite; write/read split non-atomic documented | SaveSystem.ts:706-712, 735-744, 819-821; comments :14 | Medium |
| I5 | Exactly-once | Registry-restore does not double-apply equipment modifiers or double-count materials | GameManager.ts:3111-3141, 3055-3211 | Medium |
| I6 | Lifecycle | Autosave interval/listeners cleaned up; no leak on unmount | App.vue:229-247, 559-578 | Low |
| I7 | Recoverability | Corrupt/wrong-version save not silently replaced by new game | SaveSystem.ts:609-659; App.vue:396-404 | High |
| I8 | Idempotency | restoreFromSave() re-runnable without drift | GameManager.ts:3055 | Low |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
|---|---|---|
| Static read of all files under scope | Done | All cited lines read directly |
| No test authored | By task instruction | Read-only audit |

## Findings

### SAV-01: `structuredClone` on quests may throw on non-serializable in-memory state
- Severity: Low
- Status: Suspected
- Invariant: Conservation
- Evidence: SaveSystem.ts:575 `quests: structuredClone(gameManager.questManager.getState())` — if `QuestManagerState` ever contains functions/class instances, `structuredClone` throws synchronously inside `buildGameSave`, which is called inside the autosave promise in `persistProgress` (App.vue:203). The throw is caught at App.vue:212-214 (`catch` around `player.save`), so it degrades to a silent skipped save, not a crash. Only if quests state is plain data (expected) is this a no-op. Low-risk because it cannot corrupt; but a plain `JSON` spread would be cheaper and would fail identically in `writeGameSave` JSON.stringify.
- Blast radius: autosave reliability only, no data loss beyond one skipped tick.

### SAV-02: `validateEquipmentSlotEntries` normalizes `enhanceFailStreak:0` but not `enhanceLevel` default
- Severity: Low
- Status: Coverage gap
- Invariant: Boundedness
- Evidence: saveShapeValidation.ts:435-445 — only `enhanceFailStreak` gets a default `0`; `enhanceLevel` is required non-negative (line 435) and throws issue if absent. So a legacy slot without `enhanceLevel` fails the whole save (classified 'corrupted' at load). Intentional (comment :409-412 documents NaN risk), but worth noting the asymmetry: `enhanceFailStreak` is repaired, `enhanceLevel` is rejected. This is defensible policy, not a bug — flagging as coverage gap since no test asserts the "enhanceLevel missing → corrupted" path specifically (only general shape tests).

### SAV-03: `loadGame` handoff consumes `IMPORT_DISCARDED_EQUIPMENT_HANDOFF_KEY` even when it doesn't match the current raw save
- Severity: Low
- Status: Suspected
- Invariant: Exactly-once / Conservation
- Evidence: SaveSystem.ts:668 always removes the handoff key, then :679-691 only uses it if `normalizedRaw === raw`. If the key was written by a previous import whose raw save has since been overwritten (e.g., a later autosave), the mismatch branch silently discards the count — and the key is removed. This is a mild under-count of the "discarded equipment" UI banner, not a save-corruption. The normalization is applied at import time and to the save itself, so the count is only cosmetic.
- Blast radius: cosmetic notification count; no state loss.

### SAV-04: `LocalCloudSaveService.save` sets revision even though `writeGameSave` may have failed after partial write
- Severity: Medium
- Status: Suspected
- Invariant: Atomicity
- Evidence: LocalCloudSaveService.ts:17-33 — `writeGameSave` returns `{status:'ok'}` on `localStorage.setItem` success. `setItem` is atomic per-key; if it throws (quota), `writeGameSave` returns 'failed' and the revision is NOT written (line 31 only reached on `ok`). So the only non-atomic window is a crash between the `setItem(SAVE_KEY)` and `setItem(SAVE_REVISION_KEY)`. On such a crash, revision stays stale and the next save gets a conflict → coordinator resyncs via `load()`. This is a benign self-healing window, not a data-loss path. Classified as suspected because the two writes are not in a transaction; but the coordinator recovery makes it low-impact.

### SAV-05: Autosave `saveInFlight` gate prevents overlap but pagehide + interval can still race a rejected boot
- Severity: Low
- Status: Suspected
- Invariant: Synchronization
- Evidence: App.vue:196 guards `persistProgress` against re-entry, but `onPageHide`/`onVisibilityChange` (App.vue:219-227) fire `persistProgress()` without checking `entryStage`/`saveInFlight` (they bypass the guard's first condition since they don't set flags themselves — actually they call `persistProgress()` which DOES check `saveInFlight` at line 196). The gate holds. However, `persistProgress` does not serialize ordering between the interval callback and the pagehide callback — both may run; the second is a no-op due to `saveInFlight`. The residual risk is that a save started before `pagehide` may complete after the tab is gone, which is acceptable. Low/no real defect.

### SAV-06: `saveInFlight` uses `finally` but a rejected promise from `player.save` still clears the flag — correct — but no timeout on a hung coordinator
- Severity: Low
- Status: Coverage gap
- Invariant: Synchronization
- Evidence: App.vue:212-216 — if `player.save` never resolves (e.g., a future cloud adapter with a network hang), `saveInFlight` stays `true` forever, permanently disabling all future autosaves. The current `LocalCloudSaveService` is synchronous-ish (async but resolves immediately), so not reachable today. Flagging as a coverage gap for the future Supabase adapter.

### SAV-07: `buildGameSave` spreads `player` and overwrites `lastSavedAt` but keeps `lastSavedAt` in PlayerData state
- Severity: Low
- Status: Confirmed (by design, no defect)
- Invariant: Conservation
- Evidence: SaveSystem.ts:528-532 — `lastSavedAt: Date.now()` is stamped into the serialized copy. `stores/player.ts:189` also sets `this.lastSavedAt = Date.now()` before `buildGameSave`. Both set it to ~same value; the in-memory `lastSavedAt` is used at next offline calc (GameManager.ts:3180, :3194) as `offlineSinceMs`. Since the store updates it on save and the save embeds it, there's a small window where the save file's `lastSavedAt` (from `buildGameSave` at :531) could be newer than the store's (if a tick mutated state after save). This is benign; the offline calc uses `save.player.lastSavedAt` which is the serialized value — consistent.

### SAV-08: Offline cultivation added to `player.cultivation` is not validated against NaN from `cultivationPerSecond`
- Severity: Medium
- Status: Suspected
- Invariant: Boundedness
- Evidence: stores/player.ts:243 `this.cultivation += offline.cultivation` — `offline.cultivation = cultivationPerSecond * elapsedSeconds` (OfflineProgressSystem.ts:24-26). The shape validator (saveShapeValidation.ts:179-180) guards `cultivationPerSecond` to non-negative finite on load. But a live in-memory `cultivationPerSecond` produced by `cultivate()` (stores/player.ts:80-93) is `Math.max(0.01, ...)` so never NaN/negative. The only NaN path would be a corrupted save already rejected by `validateGameSaveShape`. Low actual risk; the validator covers it. Flag as low/suspected only because the offline math is not independently re-clamped.

### SAV-09: `restoreFromSave` calls `preflightSaveRegistryReferences` twice (once in `restoreGameSession`, once defensively)
- Severity: Low
- Status: Coverage gap
- Invariant: Idempotency
- Evidence: GameManager.ts:3056 calls `preflightSaveRegistryReferences(save)` and `restoreGameSession` (SaveSystem.ts:453) also calls it. Double validation is redundant but idempotent and cheap; the comment at :3030 documents it as intentional defensive re-run. Not a defect; noting as optimization.

### SAV-10: `loadGame` returns `corrupted` for version-valid shape-invalid saves, which blocks `SaveIncompatibleScreen` export path for shape-invalid data
- Severity: Low
- Status: Coverage gap
- Invariant: Recoverability
- Evidence: SaveSystem.ts:653-659 — shape failure → `{status:'corrupted', raw}`. `App.vue:396-404` handles corrupted via `saveIssue.report`. The `SaveIncompatibleScreen` presumably offers Export/Xoá for both. Since the raw is preserved (`raw`), recovery is possible. The only gap: the distinction between "wrong version" (incompatible) and "right version, bad shape" (corrupted) is surfaced to the user differently; a user with a shape-corrupt but version-valid save sees "corrupted" messaging. Cosmetic.

## Optimization Opportunities

1. `structuredClone` in buildGameSave (SaveSystem.ts:575) — use a shallow/JSON clone or `JSON.parse(JSON.stringify())` which is already happening in `writeGameSave` (SaveSystem.ts:583). `structuredClone` is fine but heavier; the double-serialization (clone + stringify) is wasteful per autosave. Consider serializing once.
2. `preflightSaveRegistryReferences` runs twice per restore (SaveSystem.ts:453 + GameManager.ts:3056). Could be invoked once.
3. `buildGameSave` is invoked on every autosave tick (15s) and on visibilitychange/pagehide; it re-serializes the entire `player` spread + all bags. The synchronous `JSON.stringify` of a large save (potentially hundreds of equipment entries) on the main thread at App.vue:583 could cause a jank spike. Consider throttling or caching.
4. The `loadGame` handoff logic (SaveSystem.ts:661-691) reads+removes a localStorage key on every boot even when no import happened — minor extra `getItem`/`removeItem` cost.

## Verified Clean

- `writeGameSave` returns `SaveWriteResult` and never throws; quota/unknown failures are surfaced to the coordinator (SaveSystem.ts:581-595). Good atomic failure handling for the storage write itself.
- `deleteSave()` backs up first and also clears `SAVE_REVISION_KEY` — prevents stale-CAS on next new character (SaveSystem.ts:735-744; rationale at :38-42).
- `importSaveRaw` enforces shape only for current-version imports, preserves raw for incompatible-version recovery, and writes the handoff marker before touching backup/save (SaveSystem.ts:770-824).
- `CloudSaveCoordinator` recovers from a stale revision via resync + single retry (CloudSaveCoordinator.ts:31-48), avoiding permanently-stale coordinator state.
- `loadGame` never writes to `SAVE_KEY` (no auto-migration write), so a corrupted/incompatible save cannot be silently overwritten on boot (SaveSystem.ts:634-647).
- Boot flow keeps `incompatible`/`corrupted` saves reachable via `saveIssue.report` (App.vue:396-404), preserving raw data for export.
- `suppressPersistence` + `stopAutosave()` on save reset (App.vue:249-254) prevents a reset-vs-autosave race.
- All shape validation is centralized at the load boundary and enforced by `SaveRoundTrip.test.ts`, giving a round-trip safety net (saveShapeValidation.ts:451-528; SaveRoundTrip.test.ts:45-100).

## Gaps and Residual Risk

- SAV-04/SAV-05/SAV-06 are suspected/converage-gap hypotheses without runtime reproduction; no tests were authored per the read-only audit instruction.
- No integration test models two concurrent autosaves at the App.vue boundary (only coordinator unit tests exist — CloudSaveCoordinator.test.ts), so the `saveInFlight` + pagehide interaction is untested.
- Future Supabase adapter (CloudSaveServiceFactory.ts:6) will introduce real async latency and network hang potential; SAV-06 (no timeout on `saveInFlight`) becomes material then.

## Pre-existing Failures

None observed during this read-only audit.
