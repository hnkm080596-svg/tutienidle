# Local Audit — Slice: infra-state

**Scope:** `game/src/stores/`, `game/src/services/` (save, cloudSave, supabase, auth), `game/src/composables/`, `game/src/game/scenes/` lifecycle seams, `game/src/main-process/`, `game/src/App.vue` wiring.

**Auditor:** local primary agent. **Audit-only** — no production files modified.

Overall observation: this slice has already been through several audit rounds (comments reference ARCH-013, F-INT-01/02, QA-002, T1-8, Mission-B). Save restore, CAS, lifecycle fencing, and listener cleanup are deliberately hardened. Findings below are the residual defects/gaps that remain.

---

### INFRA-01 — MEDIUM — Remote newest-wins compares timestamps from two different machine clocks

- **Severity:** Medium
- **Location:** `game/src/services/cloudSave/SupabaseRemoteSave.ts:78` (parse remote `updated_at`), `:91` (local `lastSavedAt`), `:93` (the comparison `remoteUpdatedMs > localLastSavedAt`), `:141` (push writes `updated_at: new Date().toISOString()` — client wall clock, not Postgres `now()`)
- **Root cause:** `syncRemoteSaveOnLogin` picks a winner by comparing `character_saves.updated_at` — which is written by the *pushing client's* `new Date()` (line 141), not the database — against this device's `save.player.lastSavedAt`. Two different machines' wall clocks are compared directly with no skew guard. The `updated_at` column is also overwriteable client-side on every push, so its value is never a server-trusted timestamp.
- **Repro:** Device B's clock is +10 min ahead of real time. B pushes an older-progress save at real-time T (row records T+10m). Device A saves newer progress at real-time T+2m. A logs in again: `remoteUpdatedMs (T+10m) > localLastSavedAt (T+2m)` → pull → A's genuinely newer local save is overwritten by B's older payload. No prompt, no merge, silent rollback.
- **Impact:** Silent progress loss across multi-device same-account use; the reconciliation winner is effectively "which machine's clock is ahead", not "which save is newer".

---

### INFRA-02 — MEDIUM — Remote `character_saves` push is unconditional upsert — no CAS/conflict detection on the remote row

- **Severity:** Medium (design gap)
- **Location:** `game/src/services/cloudSave/SupabaseRemoteSave.ts:129-146`
- **Root cause:** The push path is a bare `POST /rest/v1/character_saves` with `Prefer: resolution=merge-duplicates` — an upsert keyed on character_id with no revision precondition (no `If-Match`, no `save_revision=eq.<expected>` in the query). All CAS machinery (`CloudSaveCoordinator` expected-revision, `LocalCloudSaveService` revision-first write) protects only the *localStorage* slot; the remote row is last-writer-wins.
- **Repro:** Devices A and B both logged into the same account. A logs in at T1 (syncs), B is already in-session. B reaches login-sync and pushes rev 30 while A pushes rev 50 — whichever POST lands last wins the remote row wholesale, and the loser's payload is gone. On the *next* login the "newest-wins" check (INFRA-01) then propagates whichever side happened to write last.
- **Impact:** Multi-device save conflict resolution is effectively arbitrary ordering, not revision-checked. Acceptable if single-device-per-account is an invariant — that invariant is not enforced anywhere visible in this layer.

---

### INFRA-03 — LOW — `createQuitFlush` wedges the window if `webContents.send` throws

- **Severity:** Low
- **Location:** `game/src/main-process/quitFlush.ts:47-73` — ordering: `preventDefault()` (45) → `flushingWindows.add(win)` (51) → `ipcMain.once('app:flush-complete', finish)` (70) → `win.webContents.send(...)` (71) → `setTimeout(finish, ...)` (73)
- **Root cause:** The timeout backstop is scheduled *after* `send`. If `send` throws (renderer process destroyed/crashed between the close event and the send — Electron throws "Object has been destroyed"), the exception propagates out of the close handler with `flushingWindows` already containing the window and no timeout armed. Every later 'close' event hits the `flushingWindows.has(win)` branch → `preventDefault()` + return → the window can never close via the close path; the registered `once` listener also leaks.
- **Repro:** Force-kill the renderer (`webContents.destroy()`/crash) without destroying the BrowserWindow, then close the window — `send` throws, window is now unclosable through the normal close path.
- **Impact:** Edge-case wedge; normal quits unaffected because the crash normally tears down the window anyway. Fix shape: schedule `timeoutHandle` (or wrap `send` in try) before sending.

---

### INFRA-04 — LOW — `useCombatPause.dispose` leaves the engine freeze-latch set if unmounted while paused

- **Severity:** Low
- **Location:** `game/src/composables/useCombatPause.ts:32-62`
- **Root cause:** `dispose()` only removes the `visibilitychange` listener. If the composable is disposed while `isPaused` is still true (App unmount during a tab-hidden pause — HMR in dev, or an Electron renderer reload), `freezeCombat('tab-hidden')` was latched on the GameManager and is never released. The GameManager survives the remount; the new composable instance starts with `isPaused=false`, so no overlay appears and nothing calls `resumeCombat`.
- **Repro:** In dev (HMR) or a reload-in-place: enter combat, switch tabs (pause latches), trigger a remount while hidden, return to the tab — battle is frozen, `isPaused` false, no Continue overlay; engine-side freeze reason `'tab-hidden'` still held.
- **Impact:** Stuck-frozen combat until the battle ends by other means or app restarts. Dev/HMR-adjacent severity in practice; cheap fix is `dispose()` also releasing the latch when `isPaused`.

---

### INFRA-05 — LOW — `restoreFromSave` payload-identity guard survives store reset: identical payload after `$reset` is skipped, not re-applied

- **Severity:** Low
- **Location:** `game/src/stores/player.ts:243-248` (guard) — `lastRestoredPayloads` is a `WeakMap` keyed on the store instance and never invalidated by `$reset`/external state wipe.
- **Root cause:** The QA-002 idempotency guard returns the cached `OfflineResult` when `computeRestoreIdentity(save)` matches. Identity is content-hash (excludes `lastSavedAt`), so a wipe of the store state (`$reset`, or delete-then-restore flow) followed by a restore of the *same* `save` object returns "already applied" — caller believes restore ran; the store keeps post-reset defaults.
- **Repro:** Requires a flow that resets the player store between two `restoreFromSave` calls carrying an identical payload — e.g. a recovery path that clears state then re-applies the same in-memory save object (the payload the guard still holds). Boot retry of the *same* save after a state-clearing recovery would hit it.
- **Impact:** Silent no-op restore in a rare ordering; the guard's whole purpose (double-apply protection) is preserved, so the fix is invalidating the WeakMap entry on reset rather than removing the guard.

---

### INFRA-06 — LOW — Remote pull adopts `character_saves.save_revision` into the local CAS counter

- **Severity:** Low
- **Location:** `game/src/services/cloudSave/SupabaseRemoteSave.ts:99` — `localStorage.setItem(resolveRevisionKey(), String(remoteRow.save_revision))`
- **Root cause:** The remote `save_revision` column is written by whichever device pushed last (`readLocalSaveRevision()` at line 139), so it mirrors *that device's* local CAS counter — not a remote-owned sequence. A pull copies that foreign counter into this device's revision key. If it's lower than the device's previous local counter (fresh-install device pushed a low-revision but newer save), the local CAS sequence regresses; consistency is maintained only because boot order runs `remoteSync()` before `coordinator.load()` re-reads the counter.
- **Repro:** Device A local rev 50; device B (fresh install, rev 3) pushes newer-timestamp save. A logs in: pull writes rev 3 into A's revision key; A's next save continues at 4. CAS still self-consistent, but the counter no longer means "number of local writes" and monotonicity assumptions (if any reader relies on it) break.
- **Impact:** Latent semantic drift; no live defect found in current readers, flagged because revision is dual-purpose (local CAS + remote mirror) with no written contract.

---

### INFRA-07 — LOW — Pill overflow discarded silently at restore (materials report it; pills don't)

- **Severity:** Low
- **Location:** `game/src/core/game/GameManagerSaveRestore.ts:299-303` — `pillBag.add(...)` return value (overflow count) discarded; compare `:286-297` + `:325-336` where material restore + auto-dissolve rewards DO accumulate `restoreOverflows` and emit `createBagOverflowEvent`.
- **Root cause:** `PillBag.add` clamps at `MAX_STACK_AMOUNT` and returns the lost amount (`PillBag.ts:23-29`); the restore loop drops the receipt, so an over-cap pill stack in the payload loses the excess with no event/log.
- **Repro:** Import/hand-edit a save whose `pills[].amount` exceeds `MAX_STACK_AMOUNT` (import normalizes shape, not caps) → restore → excess pills vanish silently; a material in the same situation would have produced an overflow toast.
- **Impact:** Inconsistent loss-reporting contract only — legit writes can't produce over-cap stacks, so reachable only via foreign/imported payloads.

---

## Notes reviewed and cleared (no finding)

- `useAppLifecycle` boot generation-fencing, `bootInFlight`/`saveInFlight` guards, autosave idempotent start, `stopAll` teardown — deliberately hardened; `startAutosave` correctly wired at `App.vue:602` only on `status:'entered'` after the first durable save commits (`useAppLifecycle.ts:283-285`).
- `detachSaveValue` JSON round-trip (`SaveSystem.ts:322`) — `NaN`→`null`, `undefined`/`Map` dropped — mitigated by `validateGameSaveShape` treating such corruption as `corrupted` at load rather than silently persisting bad state.
- `externalModifierSignature` (`player.ts:87-112`) covers all 13 `StatModifier` fields that exist in `StatCalculator.ts:22-56` — no uncovered-field staleness.
- `installAutomationFlagsPersistence` `{detached:true}` subscription is unsubscribed at `App.vue:655`; `introHandle` cleared at `App.vue:658`.
- `CombatScene`/`MainScene`/`TribulationScene` event subscriptions all pair `events.once('shutdown')` cleanup with named handlers; scale listeners removed at shutdown.
- `SupabaseSession` refresh path clears session on failure; session in `sessionStorage` is per-tab (deliberate — new tabs resolve to the `guest` save slot via `saveKeys.ts`).
- **Round-2, offline-window authority:** `GameManagerSaveRestore.ts:401-403` computes raw uncapped `elapsedOfflineSeconds`, but every consumer clamps its own window — production + decompose at `PRODUCTION_OFFLINE_CAP_SECONDS` = 10h (`ProductionBalance.ts:120`, `ProductionOffline.ts:64`, `DecomposeSystem.ts:241`), auto-farm at `DEFAULT_MAX_OFFLINE_SECONDS` = 24h (`GameManagerAutoFarmOps.ts:220-226`), cultivation via `GameClock.calculateOfflineTime`. The raw value only feeds the `>60s` gate. Different caps per subsystem are deliberate, not drift — cleared.
- **Round-2, wash/refine paid-op tickets:** `EquipmentWash.previewWashAffixes`/`commitWashAffixes` — cost deducted at preview, ticket consumed on EVERY commit attempt, bound by object identity + membership generation + issued-at snapshot, `invalidatePendingOperationTickets` on restore. Airtight — cleared.
- **Round-2, reward ops:** `GameManagerBattleRewardOps` `rewardsGranted`/`battleEndEmitted` flags give per-kill and terminal exactly-once semantics; abandon shares the once-guard; `bankPassiveCarry` overwrite can't double-count. `StageWaveSystem.start` is transactional (lease rollback on any pick/launch failure); lease release is identity-checked so a stale `stopRepeat` can't stomp a foreign owner. Cleared.
