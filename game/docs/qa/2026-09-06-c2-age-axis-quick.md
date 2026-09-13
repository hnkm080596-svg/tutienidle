# Adversarial QA — gp123 Task C2 (wood/ore age-axis migration) — quick mode

**Date:** 2026-09-06
**Scope:** task-owned diff of C2 (43 files: materials generator, production engine/catalog/balance, validators, tier conversion, vendor prices, decompose, alchemy fuel, buildings costs, enemy drops, quests, starter pack, save v57, docs).

## Route

- changed-risk-map: domains = combat-and-tribulation, economy-and-progression, inventory-equipment, save-and-cloud, ui-input-lifecycle; `deepAuditCandidate: true` (save boundary + 5 domains); `unmappedPaths: [useBagFilter.ts]`.
- unmapped path inspected: useBagFilter.ts is a pure Vue composable returning locale keys/labels for the bag UI — materiality is bounded by the MaterialBagFilter tests (5 passed) and type-check; no persistence or lifecycle risk.
- deep escalation considered: risk IS cross-system (save + economy), but every changed transition has a deterministic local oracle (data-integrity gate, drop-sink invariant, save-shape gate, economy simulation). All save-v56 → v57 behavior is intentionally "reject old saves" (dev phase, E8) — verified, no migration logic attempted. Risk confidently bounded; not escalating per dispatcher contract (coordinator runs phase-end QA).

## Hypotheses & evidence

| # | Hypothesis | Operator | Check | Result |
|---|---|---|---|---|
| 1 | Old-id material survives in registry (plain wood / quality suffix) | data-integrity gate (negation asserts) | ProfessionDataIntegrity: 5 new C2 tests | GREEN — no plain wood, no `_hoang.._tien` suffix, meta has no `quality` |
| 2 | Registry drift boot-fails after migration (materials ↔ validator id convention) | boot validator | `validateProfessionMaterialEntry` on every material; catalog completeness | GREEN (15/15) |
| 3 | Enemy drops reference deleted ids → sink invariant breaks | drop-sink invariant | EnemyDropSinkInvariant + all data tests | 27 files / 188 tests GREEN |
| 4 | Building/site upgrade cost points at non-existent wood → progression stalls | cost↔catalog consistency | buildings.rework + EconomySimulation sink tests | GREEN |
| 5 | Quest `collect` condition unreachable after rename | quest condition target | data suite GREEN; quest targets `qi_refining_ore_decade` which exists | GREEN |
| 6 | Save v56 loads with missing `profession.quality` → silent corruption | save-shape gate | saveShapeValidation requires `version === 57`; SaveMigration 7/7 GREEN | GREEN (old saves rejected by design, E8) |
| 7 | Starter pack grants items that no longer exist → new game stuck | App.vue starter-pack literals | starter ids = `mortal_wood_decade`/`mortal_ore_decade` (exist); registry-guarded add | GREEN (App + boot suites) |
| 8 | Forest/mine reward roll produces amount 0 or undefined material | statistical roll sanity | ProductionSystem roll tests (2000-seed distributions) | 18/18 GREEN |
| 9 | Decompose regex drift → wrong/no output | output formula | DecomposeSystem + DecomposeTab tests | 15/15 GREEN |
| 10 | Vendor prices undefined for wood/ore after axis rename | price-table lookup | VendorSystem 17 files / 301 tests GREEN (wood decade=2 … thuong_co=75; ore 3…120) | GREEN |
| 11 | Fuel-wood resolution fails (plain `mortal_wood` gone) → alchemy dead | fuel resolution incl. amounts | AlchemySystem 33/33 GREEN (`resolveFuelWood` age-aware) | GREEN |
| 12 | Bag family grouping breaks on new meta shape | familyKeyFor/variantRank | MaterialBagFilter 5/5 GREEN | GREEN |

## Verdict

**PASS WITH EVIDENCE** — 12/12 high-ranked hypotheses covered by focused green suites on top of full-suite runs (type-check ✅, build ✅, vitest 2629–2630/2630 with only the two known pre-existing flakes, each passing in isolation).

## Notes

- Pre-existing flakes observed during full runs (not C2-owned): `GameManager.actionPlayback.test.ts`, `dongFuBackgroundAssets.test.ts` — both pass in isolation; already flagged by C1/coordinator.
- Forest reward semantics intentionally changed: tier-fixed amounts (3/2/1) → age roll with `MATERIAL_AGE_AMOUNTS` (3/2/2/1/1). Balance values otherwise preserved 1:1.
