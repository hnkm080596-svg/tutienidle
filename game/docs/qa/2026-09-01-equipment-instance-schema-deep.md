# QA Review: EquipmentInstance schema bridge

- Date: 2026-09-01
- Mode: deep
- Verdict: FAIL
- Task-owned paths: `game/src/core/equipment/EquipmentInstance.ts`, `game/src/core/equipment/EquipmentInstance.test.ts`, `game/src/core/equipment/ItemGradeRefs.ts`, `game/src/core/equipment/EquipmentSystem.ts`, `game/src/core/equipment/EquipmentSystem.test.ts`, `game/src/core/equipment/EquipmentBag.ts`, `game/src/core/equipment/EquipmentBag.autoDissolve.test.ts`, `game/src/core/equipment/EquipmentNaming.ts`, `game/src/core/item/ItemRoll.test.ts`, `game/src/core/game/BattleLootSystem.ts`, `game/src/core/game/GameManager.ts`, `game/src/core/game/GameManager.buildSnapshot.test.ts`, `game/src/composables/useEquipmentTooltip.ts`, `game/src/composables/useEquipmentTooltip.test.ts`, `game/src/components/panels/EquipmentHallPanel.vue`, `game/src/components/panels/EquipmentHallPanel.test.ts`, `game/src/components/panels/EquipmentPaperdoll.vue`, `game/src/components/panels/EquipmentPaperdoll.test.ts`, `game/src/components/panels/bag-sections/EquipmentBagSection.vue`

## Scope and Risk Map

The audit followed new instance creation through loot, bag ownership, refinement/dissolve consumers, Vue presentation, save construction, validation, and browser reload. The changed-risk mapper selected combat-and-tribulation, economy-and-progression, inventory-equipment, Pinia/Phaser synchronization, time/offline, and UI lifecycle. It marked the task as a deep-audit candidate because `GameManager` is a critical time/offline boundary and the task crosses six mapped domains, so the required quick review escalated to deep mode.

One-hop consumers include combat loot/reward presentation, player stats/loadout, economy costs, persisted ownership, Vue panels, and save/offline progression. Task 5 drop semantics, Task 7 save validation and corrupt-data validation, Tasks 8/9 refinement balance, Task 19 UI unification, old-save migration, and live/cloud services were explicitly excluded from production changes. The current-save handoff was still audited because `EquipmentInstance` is persisted directly.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-EI-1 | `EquipmentSystem` creates `EquipmentInstance` | Roll a drop and publish the new schema | Boundedness: `grade` and five-value `quality` are valid, forge uses match quality, and retired fields are absent | Value mutation/schema omission | Runtime instance fields plus compile-time fixture contract | Unit | High: every equipment entry crosses this boundary |
| INV-EI-2 | `BattleLootSystem` and `EquipmentBag` own reward-to-bag transition | Grant a random/fixed drop, add it, and auto-dissolve overflow | Conservation/exactly-once: one drop produces one owned item or one dissolve reward using the derived realm and unified quality | Repeat/cross-system chain | Bag count, reward material, notification/particle path | Integration | High: ordinary combat flow and economy side effect |
| INV-EI-3 | `EquipmentSystem` owns wash/refine/dissolve mutation | Spend the new per-item forge budget | Atomicity/boundedness: failed operations do not mutate; successful operations reduce `forgeUsesRemaining` without going negative | Zero/exhaustion/repeat | Instance budget, affixes, material balances | Unit | High: persistent economy mutation |
| INV-EI-4 | Tooltip, bag, paperdoll, and hall computed state | Render/sort/filter an instance with grade, quality, and optional realm level | Synchronization: UI derives realm/ranks/forge display from the new fields without a legacy instance read or stale mirror | Missing optional field/stale state | Rendered labels, ranks, rows, and tooltip | Component integration | Medium-high: broad visible surface |
| INV-EI-5 | `SaveSystem` validator and `GameManager.restoreState` | Save a character containing equipment, reload, then restore | Recoverability/synchronization: a current-shape snapshot written by the app is accepted and reaches the home state with the item intact | Interruption/reload/cross-system chain | Validator result and visible `.game-root` after reload | Playwright | Critical: persistence and boot availability |
| INV-EI-6 | `GameManager` fixed-step and battle reward orchestration | Deliver reward-adjacent updates in split/lumped deltas | Exactly-once/determinism: schema-only loot changes do not duplicate rewards or alter catch-up ownership | Timing boundary/degraded environment | Fixed-step and realm-reward assertions | Integration | Medium: mapper-selected one-hop regression |
| INV-EI-7 | `EquipmentBag` ownership and ordering | Add duplicates/overflow candidates and rank by new fields | Idempotency: duplicate IDs remain one item; ordering reads only new fields | Repeat/value ordering | Bag entries and dissolve selection | Unit | Medium-high: inventory ownership invariant |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| Focused bridge/runtime suite | PASS | 9 files, 71 tests; schema, system, bag, tooltip, panels, snapshot, roll, and random drop |
| Deep focused suite | PASS | 11 files, 112 tests; additionally exercised fixed-step, realm reward, save round-trip seam, and shape tests |
| `npm.cmd run test` | PASS | 276 files, 1615 tests in 92.05s |
| `npm.cmd run type-check` | PASS | `vue-tsc --build`, zero errors |
| `npm.cmd run build` | PASS | 647 modules transformed; only existing chunk-size warning |
| `npm.cmd run test:e2e` | FAIL | 5 of 6 tests reported PASS; `save-reload.spec.ts` timed out and the runner required interruption after it stopped producing terminal output |
| `npx.cmd playwright test tests/e2e/save-reload.spec.ts --reporter=line` | FAIL (confirmed) | Direct log: `[SaveSystem] ... equipment[0].forgePoints ... phải là number hữu hạn >= 0`; then `.game-root` was absent after reload. The runner again did not terminate after reporting the assertion and was interrupted. |
| Legacy consumer grep | PASS | No `instance`/`candidate` access to `realmId`, `rarity`, `forgePoints`, or `forgePotential` in task-migrated production consumers |
| `git diff --check` | PASS | No whitespace errors; Git only emitted line-ending conversion warnings |

## Findings

### QA-2026-09-01-001: new-schema equipment saves fail current-shape reload validation

- Severity: Critical
- Status: Confirmed
- Invariant: INV-EI-5 — a current snapshot written by the application must pass its own current-shape validator and restore to a usable game.
- Preconditions: create a character, obtain equipment created with `grade`, unified `quality`, and `forgeUsesTotal/Remaining`, then save.
- Reproduction: run `npx.cmd playwright test tests/e2e/save-reload.spec.ts --reporter=line`.
- Expected: the saved character and spirit stones reload and `.game-root` becomes visible.
- Actual: `saveShapeValidation.ts` still requires retired `forgePoints`; it rejects `equipment[0]`, and reload never reaches `.game-root`.
- Evidence: Playwright browser lifecycle plus the direct SaveSystem validator log quoted in the verification table; the same test also failed in the complete E2E run.
- Test file: `game/tests/e2e/save-reload.spec.ts`
- Owner subsystem: `game/src/services/save/saveShapeValidation.ts` (scheduled Task 7 handoff)
- Blast radius: any current save containing at least one Task 4 schema equipment entry cannot reload through the normal boot path until Task 7 updates validation/current-save fixtures.

## New or Changed QA Tests

No QA reproduction test was added: the existing `game/tests/e2e/save-reload.spec.ts` is already the lowest conclusive browser reload oracle and failed for the intended validator reason. The confirmed pattern was added to `game/docs/qa/learned-defects.md`.

## Gaps and Residual Risk

- The Task 4 compile bridge intentionally retains an internal nine-value quality roll for old main-stat/affix balance tables until Tasks 5, 8, and 9; this audit does not claim final drop/refinement semantics.
- The two old equipment sort/filter controls temporarily map onto the closest new fields; Task 19 owns the unified interaction model.
- Corrupt/unmapped grades and save-shape constraints belong to Task 7. No cast or compatibility field was added to hide them.
- No two-tab/cloud concurrency test was run because this task does not change cloud coordination; current local reload was the decisive persistence oracle.
- Browser output contains extensive existing missing-i18n and root-route warnings. They are noisy but were not the direct failure oracle.

## Pre-existing Failures

- Before Task 4 production changes, a full Vitest baseline had one timeout in `src/assets/dongFuBuildingAssets.test.ts:66`; the single allowed focused rerun passed 1 file/3 tests. Later full suites passed all 276 files/1615 tests.
- Playwright runners did not exit after reporting the `save-reload` failure and were manually interrupted. The focused rerun nevertheless provided a deterministic validator log and assertion failure, so the finding is not based on runner termination behavior.
