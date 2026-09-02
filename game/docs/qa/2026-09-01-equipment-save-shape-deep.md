# QA Review: equipment save shape normalization

- Date: 2026-09-01
- Mode: deep (mandatory escalation from quick because save/cloud recovery behavior changed)
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `game/src/services/save/saveShapeValidation.ts`, `game/src/services/save/saveShapeValidation.test.ts`, `game/src/services/save/SaveRoundTrip.test.ts`, `game/src/services/save/SaveSystem.ts`, `game/src/services/save/SaveSystem.test.ts`, `game/src/services/cloudSave/CloudSaveService.ts`, `game/src/stores/player.ts`

## Scope and Risk Map

The task replaces the stale persisted-equipment validator with the current `grade`/`quality`/`forgeUses*` contract, normalizes optional slot failure streaks, and separates discardable legacy equipment entries from structural save corruption. `SaveSystem` consumes the normalized result and exposes `discardedEquipmentCount`; the local cloud adapter preserves it through object spread and the player-store load helper preserves it through its returned outcome.

The changed-risk mapper routed the exact task-owned paths to `save-and-cloud` and `pinia-phaser-sync`, listed persisted progression/inventory plus boot/recovery UI as one-hop consumers, returned `deepAuditCandidate: true`, and returned no unmapped paths. Current code confirmed the material path as validator → `loadGame()` → `LocalCloudSaveService`/coordinator → `App.vue` boot → `GameManager.restoreFromSave()`. The UI does not yet render the discard counter; the brief deliberately reserves that toast for later work.

All pre-existing Task 1–4 equipment/UI changes and their QA artifacts were excluded from this Task 7 audit except where current equipment snapshots were required as input evidence. No old-save version migration was reviewed because the development-build policy explicitly excludes it.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-SAVE-1 | Current equipment snapshot / `SaveSystem` + validator | Build, serialize, validate, load, reload | A non-empty current-schema equipment save is accepted without field loss | Interruption, cross-system chain | Validator success, restored app identity/resources after browser reload | Vitest integration + Playwright | Critical: prior bug prevented boot |
| INV-SAVE-2 | Legacy equipment array / validator | Encounter `realmId` or `rarity`; discard only that entry | Legacy equipment is removed once, counted once, and does not corrupt the remaining save | Stale state, value mutation | Normalized array excludes legacy entry; count is 1; load status remains `ok` | Vitest unit/integration | Critical: recovery without whole-save loss |
| INV-SAVE-3 | Current equipment entry / validator | Validate grade, quality, and forge budget | Malformed current-schema equipment is not silently accepted or discarded as legacy | Value mutation | Missing/invalid grade or quality, non-finite/negative budget, and remaining > total produce shape issues | Vitest unit | High: prevents NaN/crash propagation |
| INV-SAVE-4 | Non-equipment save state / `SaveSystem` | Load partial or malformed current-version save | Legacy discard does not weaken structural corruption handling elsewhere | Value mutation, corruption | Missing required materials/player fields remains `corrupted` | Vitest integration | Critical: no silent reset/unsafe boot |
| INV-SAVE-5 | Slot snapshot / validator | Load optional `enhanceFailStreak` | Missing streak normalizes to 0; negative/non-finite streak is rejected | Value mutation | Normalized slot has 0; negative case reports exact path | Vitest unit | High: bounded future pity state |
| INV-SAVE-6 | Imported current save / `SaveSystem` | Import legacy equipment then store normalized current save | Accepted import cannot persist rejected equipment or overwrite the prior save on structural failure | Reorder, interruption | Import succeeds for discardable legacy input and stored equipment is empty; malformed current save is rejected | Vitest integration | High: destructive import boundary |
| INV-SAVE-7 | Cloud revision / coordinator | Load normalized local outcome; later save or conflict retry | Normalization does not alter revision ownership or fabricate save success | Concurrency, repeat | Coordinator conflict/reset suite and full type-check remain green; local adapter forwards load outcome by spread | Vitest + static boundary inspection | High but unchanged transaction logic |
| INV-SAVE-8 | Boot and presentation lifecycle / App + stores | Reload a save containing newly generated equipment | Boot reaches the game instead of recovery UI and does not duplicate saved rewards | Interruption, cross-system chain | Focused reload E2E passes; full E2E save-reload case passes | Playwright | Critical user-observable outcome |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx.cmd vitest run src/services/save/saveShapeValidation.test.ts src/services/save/SaveRoundTrip.test.ts src/services/save/SaveSystem.test.ts` | PASS | 3 files, 74 tests; covers current schema, legacy discard/count, corruption distinction, slot default, import normalization, and non-empty round trip |
| `npm.cmd run test` | PASS | 276 files, 1630 tests |
| `npm.cmd run type-check` | PASS | `vue-tsc --build`, zero errors |
| `npm.cmd run build` | PASS | 647 modules transformed; only the existing large-chunk warning |
| `npx.cmd playwright test tests/e2e/save-reload.spec.ts --reporter=line` | PASS | 1 test passed in 58.5s against a separately managed Vite server; prior `equipment[0].forgePoints` rejection did not recur |
| `npm.cmd run test:e2e -- --reporter=line` | PARTIAL / unrelated flaky check | Save reload and four other cases passed; desktop ink-wash layout failed once at 29.85px vs 32px, then the exact case passed on its required single rerun |
| Current-code one-hop inspection | PASS | `LocalCloudSaveService` preserves the counter through `{ ...outcome }`; `CloudSaveCoordinator` returns the service result unchanged; `player.load()` now preserves the outcome through spread |

## Findings

No Confirmed, Suspected, or material Coverage-gap finding remains in Task 7 scope.

## New or Changed QA Tests

No additional QA-only reproduction test was needed. The Task 7 regression changes in `saveShapeValidation.test.ts`, `SaveRoundTrip.test.ts`, and `SaveSystem.test.ts` provide decisive lower-layer oracles, and the existing `tests/e2e/save-reload.spec.ts` proves the browser lifecycle symptom is resolved.

## Gaps and Residual Risk

- The UI toast that will consume `discardedEquipmentCount` is intentionally deferred by the brief. This audit proves the counter reaches the local/cloud load outcome, not its future presentation wording or timing.
- `enhanceFailStreak` remains an optional normalized save field until Task 10 adds the runtime slot behavior. This audit does not preempt or claim that future pity mechanic.
- Backward migration of older save versions remains intentionally out of scope; only legacy equipment entries inside the current-version development save are discarded.

## Pre-existing Failures

- The full E2E matrix produced one inconsistent, task-unrelated desktop ink-wash geometry result (`29.850006103515625 < 32`). The exact required rerun passed (1/1, 12.3s), so it is classified Flaky rather than a Task 7 defect. No Task 7 path changes UI layout or CSS.

## Fix Round 1 QA Addendum

Review exposed a cross-reload ownership gap: import normalized legacy equipment before storing it, so the next load could no longer reconstruct the discard count. The fix keeps that count in a one-shot local-storage marker outside the `GameSave` schema. A successful validated load consumes the marker and adds it to the load outcome; corrupted or incompatible loads leave it available for recovery. Restore/delete clear it so an abandoned import cannot leak into a different save.

The cloud success contract now requires `discardedEquipmentCount: number`; zero is explicit when no equipment was removed. Focused tests prove the import-to-reload count reaches `LocalCloudSaveService` and passes unchanged through `CloudSaveCoordinator`. Import regression coverage also proves the normalized save contains no legacy equipment, the pre-import save remains recoverable in backup, malformed imports leave the main save unchanged and create no backup, and the imported counter is reported once.

Fix-specific verification:

- RED: focused import/cloud suite had 2 failures / 25 passes; both owner-facing count assertions received `0` instead of `1`.
- GREEN: combined save validation, round-trip, import, local-cloud, and coordinator suite passed 5 files / 81 tests.
- Full Vitest: 276 files / 1631 tests passed.
- Type-check and production build passed; build retained only the existing chunk-size warning.
- Full Playwright: 5/6 passed initially; the unrelated compact ink-wash inset check measured `30.700897216796875 < 32`, then its exact one-test rerun passed in 13.2s. This remains classified Flaky.

Verdict remains `PASS WITH EVIDENCE`. No production UI or toast behavior was added in this round.

## Fix Round 2 QA Addendum

Round 1's bare numeric marker did not identify the save that owned it, and import persisted backup/main before the marker. Review directly reproduced both defects. The repaired handoff contains the exact normalized raw payload plus its count, is written before backup/main mutation, and is consumed once only after a successful current-shape load. A payload mismatch is consumed without attribution, which makes an intervening autosave/pagehide write fail safely.

### Round 2 invariant ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-IMPORT-1 | Imported normalized save / `SaveSystem` | Import legacy entry, then load exact stored payload twice | The exact imported payload receives its discard count once | Repeat, interruption | First load count `1`, second load count `0`, normalized equipment empty | Vitest integration | Critical: owner-visible recovery event |
| INV-IMPORT-2 | Pending handoff + main save / `SaveSystem` | Import, then successfully write a different live save before reload | A handoff is never attributed to a different persisted payload | Reorder, stale state, pagehide-style write | Loaded live name is preserved and discard count is `0` | Vitest integration | Critical: false recovery attribution |
| INV-IMPORT-3 | Existing main/backup / `SaveSystem` | Marker storage throws before accepted import is persisted | Import returns `false`; neither main nor backup changes | Degraded environment, interruption | Exact pre-import raw main and prior backup remain | Vitest integration | Critical: destructive-boundary atomicity |
| INV-IMPORT-4 | Existing main/backup / `SaveSystem` | Import malformed current save | Validation rejection occurs before all storage mutation | Corruption | Main unchanged and no new backup | Vitest integration | Critical: recoverability |
| INV-IMPORT-5 | Local/cloud load owner | Load exact imported payload through adapter/coordinator | Successful cloud result always carries the numeric count | Cross-system chain | Local owner sees `1`; coordinator propagates nonzero unchanged and zero explicitly | Vitest integration + type-check | High: future UI ownership |

### Round 2 evidence

- RED: `npx.cmd vitest run src/services/save/SaveSystem.test.ts` failed 2 / passed 20. Intervening write expected `0` but received `1`; simulated marker quota failure escaped as `QuotaExceededError`.
- Focused GREEN: combined validator, round-trip, import, local-cloud, and coordinator suite passed 5 files / 83 tests.
- Type-check: PASS, zero errors.
- Full Vitest: PASS, 276 files / 1633 tests.
- Production build: PASS, 647 modules transformed; existing chunk-size warning only.
- Full Playwright: first auto-managed-server attempt reached the sixth case but did not terminate and had no final result, so it was stopped as `Not verified`. The identical matrix against a separately managed Vite server passed 6/6 in 1.6 minutes.
- Risk mapper: `save-and-cloud`, persisted progression/inventory and boot/recovery UI one-hop consumers, `deepAuditCandidate: true`, no unmapped paths.

No unresolved Confirmed, Suspected, or material Coverage-gap finding remains in Fix Round 2 scope. Verdict remains `PASS WITH EVIDENCE`; the existing UI still does not render a toast.
