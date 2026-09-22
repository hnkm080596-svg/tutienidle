# M-D — Perfection Economy Simulation — Plan

Spec: `md-perfection-sim.spec.md` **v11** (external `MD_SPEC_REVIEWED`) · Worktree: `.agent-worktrees/md-perfection-sim` · Branch: `feat/md-perfection-sim` · Base: `c1714dd0`

## Steps

1. **Session seams (sim-only, `EarlyGameSession`)**:
   - `combatCultivationParity: boolean` (default `false`) — parity lifecycle inside `runStage`, pinned ordering: pre-stage drain `investRefinement()→0` → `essenceBefore` snapshot → `startStage`/drive (per-step `cultivate(0.1)`+`breakthroughIfReady()` under an internal in-drive flag) → rewards settle → `essenceAfter`/`tinhHoaGained` → terminal counters (`battleSeconds`, kills, result, `uncountedStageRuns`) → post-terminal drain.
   - `materialAmount(id)` → `gameManager.materialBag.getAmount(id)`.
   - `lastRunStats { result, enemiesDefeated, counted }` — `enemies.filter(e => !e.entity.alive).length` on the terminal `TurnBattle`.
   - `simRunTotals` — cumulative: `stageRuns`, `victories`, `defeats`, `enemiesDefeated`, `battleSeconds`, `idleCultivationSeconds` (non-parity `cultivate` calls only), `tinhHoaGained` (per-run bag delta), `attributePointsEarned` (`breakthroughIfReady` success delta), `attributePointsSpent` (`allocateAttribute` success), `uncountedStageRuns`, `bodyCompletedAtSeconds` (recorded inside `investRefinement()` first time `completedTiers` hits 6, `T_wall` instant).
   - `runStage` return contract unchanged; flag default off → existing consumers unaffected.

2. **`PerfectionEconomy.ts`** (`core/simulation/earlygame/`):
   - `EconomyMeasurement` (two-axis record per spec §2).
   - `mortalStatBudget()` — `required = Σ(cap − createBaseStats()[stat])`; `available = CHARACTER_CREATION_ATTRIBUTE_POINTS + (mortal.maxLevel − createDefaultPlayer().realmLevel)`.
   - `reachableStatSourceCensus()` — `Reward` closed-type check, `PILLS` `random_main_stat` absence, quest `itemDrops` transitivity.
   - `expectedEssencePerKill()` / `expectedKillsForBody()` — from `STAGE_DROP_TABLES` mortal band + `BODY_REFINEMENT_TIERS` caps.
   - `measureNormalRun(seed)` — `CANONICAL_EARLY_LOOP` sliced through the `ritual` step; asserts `realmId === 'qi_refining'`; parity flag on.
   - `measurePerfectionRun(seed, opts?)` — mortal prefix (loop minus tribulation→end), then perfection window: farm best cleared stage → equipAll → invest → round-robin allocate (skip capped stats) → cultivate+BT toward 18. Decoupled axes, outcome precedence `achieved` → `safety_bound` → `proven_infeasible` per spec §3.3.

3. **`PerfectionEconomy.test.ts`** — TDD (spec §3.5 assertions first):
   - budget shortfall exact; census clean; driven-run verdict owner; conditional `realmLevelReached === 18` on `proven_infeasible` only; `uncountedStageRuns === 0`; body 6/6 + kills/income within ±25% of analytic; determinism same-seed; ≥3-seed variance.

4. **Report** `docs/p7/missions/md-perfection-sim.report.md` — measured bounds, kills, income, deficit, per-axis verdict, quantified gap, stage-boundary granularity note for body timestamps.

5. **Gates**: quick verify (type-check + sim/body/journey scopes), P18 OCR, P4 QA (test-infra → quick), P5 ≥3 sequential passes, external impl review → `MD_IMPL_REVIEWED`, commit + merge (authorized).

## Notes

- `investBodyChapter` returns essence consumed this call — the drain loop is `while (investRefinement() > 0)`.
- Round-robin allocate must skip stats already at cap or it spins on `allocateAttribute → false`.
- `simRunTotals.idleCultivationSeconds` excludes parity advances — the session knows via its internal in-drive flag during `runStage`.
