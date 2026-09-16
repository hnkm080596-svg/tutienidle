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
