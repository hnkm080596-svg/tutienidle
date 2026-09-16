# QA Review: Mission A — Save integrity (fix/save-integrity)

- Date: 2026-09-17
- Mode: deep (mandatory escalation — save/cloud recovery boundary change; mapper `deepAuditCandidate: true`)
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - `game/src/services/save/saveShapeValidation.ts`
  - `game/src/services/save/SaveSystem.ts`
  - `game/src/services/save/saveTypes.ts`
  - `game/src/services/save/saveVersion.ts` (comment-only)
  - `game/src/core/production/DecomposeSystem.ts`
  - `game/src/core/quest/QuestManager.ts`
  - `game/src/stores/player.ts`
  - `game/src/stores/uiFlagsPersistence.ts`
  - `game/src/App.vue` (one-line wiring swap to `installAutomationFlagsPersistence`)
  - Test files: `saveShapeValidation.test.ts`, `SaveSystem.quota.test.ts`, `SaveSystem.saveLoadRoundTrip.test.ts`, `SaveSystem.conformance.test.ts`, `DecomposeSystem.saveRestore.test.ts`, `QuestManager.test.ts`, `player.restoreFromSave.test.ts`, `ui.flags.test.ts`
- Exclusions: untracked docs in the worktree (`docs/specs`, `docs/superpowers/plans`, audit doc) — plan/spec artifacts, not runtime code.

## Scope and Risk Map

Changed systems: save boundary (build/validate/load/backup/recovery/import), player store restore, decompose + quest domain restore, UI automation-flag persistence wiring. One-hop consumers: `loadGame`/`useBootFlow` boot path, `GameManagerSaveRestore.restoreFromSave` (all persisted slices), `SaveIncompatibleScreen`/`SettingsPanel` import/delete UI, autosave via `writeGameSave`. Escalation: save recovery + persistence-boundary changes are mandatory deep per the quick workflow.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-SAVE-1 | `validateGameSaveShape` | malformed element inside `quests`/`buildings`/`productionSites`/`alchemyJobs`/`decompose`/`talismans`/`formations` | Recoverability: reject before restore | Value mutation | `ok:false` with element paths | unit (`saveShapeValidation.test.ts`, 232 tests) | High — trust-boundary hole |
| INV-SAVE-2 | `buildGameSave` serializer | production site with `assignedWorkers` | Conservation: field survives save→load→restore→re-save | Interruption (reload) | `assignedWorkers===2` after round-trip | integration (`saveLoadRoundTrip.test.ts`) | High — silent worker-allocation loss |
| INV-SAVE-3 | `backupCurrentSave`/`restoreBackup`/`deleteSave`/`importSaveRaw` | storage throws (quota/SecurityError) | Recoverability: no uncaught throw; delete proceeds; import aborts when safety net unwritable | Degraded environment | `false`/no-throw; `SAVE_KEY` intact on failed import | unit (`SaveSystem.quota.test.ts`, 8 tests) | High — recovery UI crash |
| INV-SAVE-4 | `player.restoreFromSave` | payload with foreign keys (`__evil`, unknown `baseStats` key) | Conservation: foreign keys never enter `$state` nor re-save | Value mutation | `$state` lacks keys; declared fields restore | unit (`player.restoreFromSave.test.ts`) | High — self-replicating junk keys |
| INV-SAVE-5 | `installAutomationFlagsPersistence` (App.vue) | `combatInputMode`-only mutation | Synchronization: persisted snapshot reflects the flag | Stale state (single-field dirty check) | `loadPersistedUiAutomationFlags().combatInputMode === 'manual'` | unit (`ui.flags.test.ts`) | Medium — silent preference loss |
| INV-SAVE-6 | `DecomposeSystem.restore` | NaN/negative `nextCycleAt`, non-finite `workers` | Boundedness: no NaN timer, no NaN workforce | Value mutation | clamped workers, safe timer | unit (`DecomposeSystem.saveRestore.test.ts`) | High — per-tick runaway |
| INV-SAVE-7 | `QuestManager.restore` | `active:'x'`, `completedOnceIds` non-array, non-finite `lastDailyResetAtMs` | Boundedness | Value mutation | normalized to `[]`/`0` | unit (`QuestManager.test.ts`) | Medium |
| INV-SAVE-8 | whole payload | build→serialize→validate→restore→rebuild | Conformance fixpoint across all slices | Cross-system chain | deep-equal sans `lastSavedAt` | integration (`SaveSystem.conformance.test.ts`) | High — drift detector |
| INV-SAVE-9 | player whitelist completeness | every declared `PlayerData` key must survive restore | Conservation | — | `Object.keys(createDefaultPlayer())` covers all 53 interface fields | static + unit | Critical (resolved: complete) |
| INV-SAVE-10 | `importSaveRaw` ordering | backup fails after handoff marker prepared | Atomicity: no overwrite without written safety net | Degraded environment | returns `false`, `SAVE_KEY` untouched | unit | High |
| INV-SAVE-11 | `ensureSiteState` on restore | save missing a site definition | Recoverability: defaults materialize | Missing field | conformance test covers all 3 defs | integration | Medium |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` | pass | vue-tsc clean |
| `npm run build` | pass | vite build 11s, no errors |
| `npx vitest run` (full) | pass | 605 files / 5075 tests, 4 expected-fail |
| `npx vitest run src/services/save src/stores src/core/production src/core/quest` | pass | 43 files / 524 tests |
| `npx playwright test` (e2e save-reload) | Not verified | P14 isolated-worktree exception: browser launch unreliable inside `.agent-worktrees/**`; deferred to branch finishing per P14 |
| `Object.keys(createDefaultPlayer())` vs `PlayerData` fields | pass | 53/53 covered — whitelist cannot drop a declared field |

## Findings

### QA-2026-09-17-001: `importSaveRaw` proceeded without a written backup

- Severity: High
- Status: Confirmed → fixed during implementation review (pre-report)
- Invariant: Atomicity — a destructive overwrite must not proceed when its only recovery copy cannot be written.
- Preconditions: quota/SecurityError on `BACKUP_KEY` write while `SAVE_KEY` holds a valid save.
- Reproduction: `SaveSystem.quota.test.ts` — "importSaveRaw trả false khi BACKUP write throw".
- Expected: `false`, `SAVE_KEY` untouched.
- Actual (first implementation): `void backupCurrentSave()` proceeded to overwrite.
- Evidence: failing reasoning trace corrected before commit `fix(save): abort import on backup failure`; regression test added.
- Test file: `game/src/services/save/SaveSystem.quota.test.ts`
- Owner subsystem: `services/save/SaveSystem.ts`
- Blast radius: save-loss path on storage failure.

### QA-2026-09-17-002: `talismans`/`formations` elements unchecked at trust boundary

- Severity: Low (bags retired; serializer always emits `[]`; restore ignores entries — no runtime consumer)
- Status: Confirmed → fixed (added `validateStackEntries` for both)
- Invariant: Recoverability — every declared slice validates elements, not just array-ness.
- Evidence: `saveShapeValidation.test.ts` — "talismans/formations entry lệch shape bị từ chối".
- Test file: `game/src/services/save/saveShapeValidation.test.ts`
- Owner subsystem: `services/save/saveShapeValidation.ts`
- Blast radius: validator contract only.

No `Confirmed` finding remains open.

## New or Changed QA Tests

- `SaveSystem.quota.test.ts` — +5 cases: exception-safe backup/restore/delete/import + backup-failure import abort.
- `SaveSystem.conformance.test.ts` — whole-payload fixpoint: populated manager → JSON → validate → `restoreGameSession` → rebuild deep-equal.
- `SaveSystem.saveLoadRoundTrip.test.ts` — `assignedWorkers` round-trip.
- `saveShapeValidation.test.ts` — deep-element rejections incl. talisman/formation stacks.
- `ui.flags.test.ts` — real `installAutomationFlagsPersistence` wiring + combatInputMode-only mutation.
- `player.restoreFromSave.test.ts` — foreign-key whitelist (top-level + `baseStats`).
- `DecomposeSystem.saveRestore.test.ts`, `QuestManager.test.ts` — malformed-input clamps.

## Gaps and Residual Risk

- `hasBackup()`/`getRawSave()` remain unguarded `getItem` reads — a `SecurityError` on read would still throw to the caller. Outside Mission A's listed contract; recorded as a bounded coverage gap, not a defect (callers treat read failures as absence; no write is lost).
- `decompose.nextCycleAt` accepts arbitrarily large finite values — a hand-edited save could stall decompose indefinitely. Shape-valid, pre-existing semantics; low impact, noted not fixed.
- Playwright `save-reload` e2e deferred per P14 worktree exception — to run during branch finishing.

## Pre-existing Failures

None observed; full suite green (4 `expected fail` cases are marked-failing-by-design, unrelated).

## Post-Merge Review Addendum (2026-09-17)

Independent code review of the merged range `c57e8175..749be2f5` — verdict merge-safe, no Critical findings. Acted-on items (all fixed on master, pending commit):

**Fixed (Important — trust-boundary hole in player slice):**
- `validatePlayer` record/array fields were container-only. Now deep-checked: `baseStats`/`nodeLevels`/`nodeFreePurchaseRecord`/`skillLevels`/`skillCastCounts` values must be finite (non-negative where the field is a count); `selectedTalentIds`/`unlockedRealmEnhancements`/`purchasedNodeIds`/`completedStageIds`/`perfectClearStageIds`/`grantedRealmPassiveIds`/`openedMeridianIds` require string elements; `modifiers`/`externalModifiers`/`persistentTimedEffects[].modifiers` require object elements with non-empty `id`/`sourceId`/`sourceType`/`stat` and finite numeric fields (`stat` intentionally NOT catalog-checked — `migrateStatModifiers` runs after the boundary, so a STAT_TYPES membership check here would brick saves carrying unmigrated keys); `persistentTimedEffects` requires non-empty `id`/`sourceItemId` + finite `appliedAtMs`/`expiresAtMs`; `combatAiStrategy` must be in `COMBAT_AI_STRATEGIES`; `highestFoundationAchieved` must be a `FoundationType` when present; `artifact` deep-checked when present; remaining required numeric/boolean scalars (`autoWorkerCapacity`, `totalCultivationGained`, `bossKillCount`, `skillInsight`, `totalSkillInsightGained`, `cultivationInsightAccumulator`, `attributePoints`, `bodyRefinementCompletedTiers`, `bodyRefinementCurrentTierProgress`, `breakthroughGrade`, `hasSeenTutorial`, `isCultivating`) now type-checked.

**Fixed (Minor batch):**
- `validateProductionSitesSave`: `level` now requires integer >= 1 (was integer-only; parity with buildings).
- `restoreBackup`: `removeItem(handoff)` moved before `setItem(SAVE_KEY)` — a handoff-cleanup throw now leaves `SAVE_KEY` untouched, so `false` honestly means "nothing restored".
- `DecomposeSystem.restore`: null `settings` sub-object falls back to defaults instead of throwing on property read.
- `QuestManager.restore`: element filter and `lastDailyResetAtMs` now require `>= 0` (parity with validator contract).
- `ui.flags.test.ts`: renamed misleading `writeCountBefore` to `persistedModeBefore`.

**Deferred (documented, not defects):**
- Element-level foreign keys inside non-player entries (e.g. `{questId, progress, claimed, evil: ...}`) still self-replicate through build/restore — inert data, key-whitelisting inside every entry validator deferred as accepted residual.
- Stale import handoff marker on backup-failure abort — harmless (`loadGame` only consumes it on exact payload match and removes unconditionally).
- Future optional `PlayerData` field omitted from `createDefaultPlayer()` would be silently dropped by the A6 whitelist — mitigated today (all optionals explicitly present in defaults) and by the conformance test when the field is populated there.
- Unguarded `loadGame`/`hasBackup`/`getRawSave` reads — pre-existing, unchanged (see Gaps above).

**Verification:** type-check clean; full suite 5132 passed / 4 expected-fail (`eslintCoreSeverity` lint-probe timeout under full-suite load is a flake — passes in isolation in 2.5s).

## Post-Merge Review Round 2 (2026-09-17)

Second independent review (3 adversarial passes) — verdict REQUEST CHANGES with 6 P2. Disposition:

**Fixed:**
- MA-R1-01: `QuestManager.restore` now canonicalizes entries to `{questId, progress, claimed}` — foreign keys can no longer self-replicate through restore → buildGameSave.
- MA-R1-02: quest element filter and `lastDailyResetAtMs` require `>= 0` (parity with validator).
- MA-R1-03: production site `level >= 1` (integer-only previously allowed 0/negative → silent upgrade soft-lock).
- MA-R1-04: three layers — `preflightSaveRegistryReferences` rejects unknown `productionSites[].siteId`; `ProductionSystem.restoreStates` drops unknown siteIds defensively; validator enforces `cycle.siteId === parent siteId`. An orphan site previously held allocated worker slots while never producing.
- MA-R2-01: `deleteSave()` returns `boolean` and attempts every key removal even when one throws; both reload callers (`App.vue`, `SaveIncompatibleScreen`) gate `window.location.reload()` on success and surface an error notification on failure.
- MA-R2-02: `loadGame()` storage reads wrapped — `getItem(SAVE_KEY)` throw returns `{status:'storage_unavailable'}` (new LoadOutcome variant; deliberately not 'empty' so boot never starts a new character over an unreadable save). Handoff-marker read/remove degrade gracefully. `LocalCloudSaveService.load()` maps it to the existing `unavailable` status → `boot.fail()`. `hasBackup()`/`getRawSave()` now degrade to false/null.
- MA-R2-03: `restoreBackup` reordered — handoff cleanup before `setItem(SAVE_KEY)`, so `false` honestly means "nothing restored".
- MA-R3-01: `DecomposeSystem.tick` rebases the deadline to `now + cycleMs` after one catch-up run — the old form replayed a long-overdue backlog one run per tick (a burst spread across frames). Offline backlog remains `settleOffline()`'s job.
- MA-R3-02: far-future `nextCycleAt` (> now + cycleMs — unreachable by legit writers) rebases instead of stalling decompose indefinitely.

**Declined with reasoning:**
- MA-R2-04 (P3): handoff-first ordering in `importSaveRaw` is intentional — a non-storable marker must abort before mutating anything, or the save changes while the discarded-equipment counter is lost. A stale marker is inert (`loadGame` only consumes it on exact `normalizedRaw` match and removes it unconditionally).

**Tests added:** storage failure matrix (`getItem`/`removeItem` per-key throws for loadGame/deleteSave/restoreBackup/hasBackup/getRawSave), quest canonicalization bypass test, unknown-siteId preflight + restoreStates drop, cycle/siteId mismatch rejections, decompose rebase + far-future deadline, player record/array deep checks (~30 cases).

**Verification:** type-check clean; `npm run build` clean; full suite 5146 passed / 4 expected-fail; Playwright `tests/e2e/save-reload.spec.ts` — PASS on main checkout (real browser save → reload → boot → restore).

**Remaining documented residuals:** element-level foreign keys in non-player slices (inert); TG-01 — the conformance fixpoint proves round-trip idempotency, not serializer completeness (per-field coverage still relies on dedicated tests like `assignedWorkers`).
