# Test Workload & Redundancy Audit — Tiên Hiệp Idle

Audit-only mission. Evidence + remediation plan. No production/test/config/CI changes were made; the only artifacts are this report and raw profiling data under `game/docs/audit/profiling/`.

## 1. Executive Summary

- **Default gate = 777 Vitest files / 7,268 cases** (`vite.config.ts` include: `src/**/*.test.ts` + `tests/architecture/**/*.test.ts`). Wall clock: **301–315 s** (median ~308 s, two timed runs).
- **One file owns ~94 % of the wall clock**: `src/core/simulation/earlygame/PerfectionEconomy.test.ts` (15 cases, 296.7 s file time). It is a *measurement* suite — it drives full early-game playthrough simulations (`measureNormalRun`/`measurePerfectionRun`, 600 s timeouts, 3 seeded runs + determinism re-run + a normal/perfection cross-run).
- **Measured projection**: `vitest run --exclude src/core/simulation/earlygame/PerfectionEconomy.test.ts` → **57.6 s wall (−81 %)**. The remaining 776 files sum to ~43 s of file time; the residual wall is dominated by module transform/import (~200 s cumulative across workers) and fork-pool startup, not test execution.
- Nothing else in the suite is expensive: file #2 is `EssenceSubstitutionEconomy.test.ts` at 8.7 s; p90 file time is ~0.1 s.
- Test-code mass is the real redundancy story: **156,087 LOC of tests**; `GameManager*` family alone is 101 files / ~23.5 k LOC; `TurnBattleSystem*` family 48 files / ~19 k LOC. Nearly all are sub-second — deletions here buy maintainability and case-count, not wall time.
- Found **3 high-confidence SAFE_DELETE** files: 2 RETIRED stubs that assert `expect(true)` only, and 1 QA-probe file verbatim-subsumed by an adversarial test exercising the same exported authority. Modest but airtight.
- The dominant lever is **tiering, not deletion**: move measurement/simulation sweeps to Tier C (or the existing `vitest.lab.config.mts` harness) → ~−81 % default wall with zero coverage loss.

## 2. Baseline

| Metric | Value |
|---|---|
| HEAD SHA | `552b4aeaee7e5fb68e2d203a0688d09958cc483b` (branch `test-workload-audit`, = origin/master `be1bdf8d` + task-doc commit) |
| Vitest | 4.1.11, pool `forks` (default), environment `node`, 8-core box / 31 GiB |
| Default include | `src/**/*.test.ts`, `tests/architecture/**/*.test.ts` (from `vite.config.ts` `test` block; no `vitest.config.*` exists) |
| Lab include | `tests/lab/**/*.test.ts` via `vitest.lab.config.mts` (`npm run lab`) — outside default gate |
| Default-gate files | **777** (733 `src/**` + 44 `tests/architecture/**`) |
| Total executable Vitest files | **779** (777 + 2 lab) |
| Total executed cases (default) | **7,268** (6,676 in `src` + 592 architecture) |
| Pass / fail / expected-fail / skip / todo | 7,262 pass / 2 fail (env: `magick` binary absent — `src/assets/dongFu*.test.ts`) / 4 `it.fails` expected-fail / 0 skip / 0 todo |
| Default wall-clock | run 1: 314.7 s, run 2: 300.7 s → **median ~307.7 s** (min 300.7, max 314.7, Δ 4.5 %) |
| Vitest phase split (run 2) | transform 24.7 s + import 176.3 s + tests 343.8 s + env 61.7 s (cumulative across workers) |
| Lab suite | 2 files / 2 cases / 4.4 s wall (`npm run lab`) |
| Full Vitest suite (default + lab) | 779 files / 7,270 cases / ~312 s wall (median default + lab) |
| Architecture tests | 44 files / 592 cases / ~3.6 s cumulative file time |
| Playwright | 19 spec files / 26 tests (`tests/e2e/*.spec.ts`, `npx playwright test`, workers=2, timeout 90 s) — runtime §10 |
| Scene tests (`src/game/scenes/**`) | 34 files — **all pass** (npm `canvas@3.2.3` present); no canvas-env failures observed |
| Env failures (baseline noise) | 2: `src/assets/dongFuBackgroundAssets.test.ts`, `src/assets/dongFuBuildingPipeline.test.ts` — `spawnSync magick ENOENT` (ImageMagick not installed on this box) |

Evidence: `docs/audit/profiling/per-file-durations.tsv` (per-file wall time + case counts, JSON reporter run), `setup-census.tsv`, `test-names.json` (vitest list → per-file case names).

## 3. Runtime Profile

Total file time across 777 files: **340.1 s** (≈ wall 300–315 s; effective parallelism ≈ 1.1 — the suite is latency-bound on one giant file).

### 3.1 Top 50 slowest files

| # | File | Cases | File time | % of Σ | Primary authority |
|---:|---|---:|---:|---:|---|
| 1 | src/core/simulation/earlygame/PerfectionEconomy.test.ts | 15 | 296.7 s | 87.2 % | EarlyGameSession driven runs (measureNormalRun / measurePerfectionRun) |
| 2 | src/core/simulation/earlygame/EssenceSubstitutionEconomy.test.ts | 8 | 8.7 s | 2.6 % | earlygame economy sim |
| 3 | src/core/simulation/earlygame/TrucCoJourney.test.ts | 8 | 5.0 s | 1.5 % | earlygame journey sim |
| 4 | src/presentation/tribulationRouting.test.ts | 9 | 1.2 s | 0.4 % | presentation routing |
| 5 | src/core/audio/AudioManager.test.ts | 20 | 0.9 s | 0.3 % | audio |
| 6 | src/core/simulation/earlygame/EarlyGameSession.test.ts | 8 | 0.8 s | 0.2 % | earlygame session |
| 7 | src/presentation/host/useDynamicRegion.test.ts | 15 | 0.8 s | 0.2 % | presentation host |
| 8 | tests/architecture/asciiComments.test.ts | 1 | 0.8 s | 0.2 % | architecture scan |
| 9 | tests/architecture/eslintCoreSeverity.test.ts | 2 | 0.8 s | 0.2 % | architecture (eslint subproc) |
| 10 | src/presentation/presentationOwnership.test.ts | 4 | 0.7 s | 0.2 % | presentation ownership |
| 11 | tests/architecture/staticArtExtentDeclared.test.ts | 2 | 0.7 s | 0.2 % | architecture scan |
| 12 | src/core/game/GameManager.autoFarmOffline.test.ts | 7 | 0.5 s | 0.1 % | GM auto-farm |
| 13 | src/core/simulation/BattleSimulation.determinism.test.ts | 5 | 0.5 s | 0.1 % | battle sim determinism |
| 14 | src/core/drop/dropCharacterization.test.ts | 2 | 0.5 s | 0.1 % | drop tables |
| 15 | src/presentation/sessionHandoff.test.ts | 5 | 0.5 s | 0.1 % | presentation handoff |
| 16 | src/core/simulation/BattleMetrics.test.ts | 16 | 0.5 s | 0.1 % | battle metrics |
| 17 | src/composables/useBootFlow.test.ts | 7 | 0.5 s | 0.1 % | boot flow |
| 18 | src/core/simulation/earlygame/MortalChapterJourney.test.ts | 6 | 0.4 s | 0.1 % | earlygame sim |
| 19 | src/components/game/DongFuScene.test.ts | 6 | 0.3 s | 0.1 % | scene |
| 20 | src/core/game/GameManager.perfectClear.feasibility.test.ts | 8 | 0.3 s | 0.1 % | GM perfect-clear |
| 21 | src/components/game/HomeBuildingIcons.test.ts | 18 | 0.3 s | 0.1 % | UI |
| 22 | src/core/production/ProductionBalance.simulation.test.ts | 5 | 0.3 s | 0.1 % | production sim |
| 23 | src/core/kiem-tu/invariants.test.ts | 31 | 0.2 s | 0.1 % | kiem-tu |
| 24 | src/components/panels/EquipmentHallPanel.test.ts | 7 | 0.2 s | 0.1 % | UI |
| 25 | src/core/drop/dropEconomy.test.ts | 2 | 0.2 s | 0.1 % | drop economy |
| 26–50 | (all remaining files ≤ 0.2 s each — full table in `profiling/per-file-durations.tsv`) | | | | |

Top 50 cumulative: **326.9 s = 96.1 %** of summed file time — but #1 alone is 87.2 %; ranks 2–50 together are only ~9 %.

Median file 0.01 s, mean 0.44 s, p90 0.1 s, p99 0.8 s. **The suite is not "10–20 % of files owning the cost" — it is one file owning ~94 % of wall time.**

### 3.2 Runtime by authority family

| Family | Files | Cases | Σ file time | % time | `new GameManager` | `new TurnBattleSystem` |
|---|---:|---:|---:|---:|---:|---:|
| simulation/earlygame | 12 | 103 | 313.1 s | 92.1 % | 5 | 0 |
| UI (components/composables/stores) | 98 | 562 | 7.4 s | 2.2 % | 51 | 0 |
| GameManager facade (misc `GameManager.*`) | 101 | 572 | 4.0 s | 1.2 % | 202 | 0 |
| architecture | 44 | 592 | 3.6 s | 1.0 % | 0 | 5 |
| presentation | 31 | 252 | 3.5 s | 1.0 % | 7 | 0 |
| other domain (loot/cultivation/tribulation/…) | 145 | 1,511 | 3.1 s | 0.9 % | 76 | 1 |
| TurnBattleSystem + turn layer | 75 | 557 | 1.5 s | 0.5 % | 1 | 201 |
| scene/phaser | 37 | 238 | 0.5 s | 0.2 % | 1 | 0 |
| battle (non-turn) | 23 | 252 | 0.5 s | 0.1 % | 0 | 0 |
| equipment | 24 | 376 | 0.4 s | 0.1 % | 0 | 0 |
| production | 13 | 118 | 0.4 s | 0.1 % | 0 | 0 |
| save system (services) | 20 | 520 | 0.4 s | 0.1 % | 8 | 0 |
| buff/reaction | 33 | 302 | 0.4 s | 0.1 % | 0 | 0 |
| skill/skilldef | 30 | 323 | 0.3 s | 0.1 % | 4 | 3 |
| data tables | 28 | 232 | 0.2 s | 0.1 % | 0 | 0 |
| progression | 15 | 179 | 0.2 s | 0.1 % | 5 | 0 |
| realm/body | 23 | 323 | 0.2 s | 0.1 % | 5 | 0 |
| GM TurnBattleOps | 4 | 24 | 0.1 s | <0.1 % | 19 | 0 |
| GM SaveRestore facade | 4 | 99 | 0.1 s | <0.1 % | 6 | 0 |
| BattleLootSystem | 8 | 57 | 0.1 s | <0.1 % | 0 | 0 |
| GM ProgressionOps | 3 | 15 | <0.1 s | <0.1 % | 3 | 0 |
| GM CompanionOps | 1 | 38 | <0.1 s | <0.1 % | 2 | 0 |
| **TOTAL** | **777** | **7,268** | **340.1 s** | 100 % | 395 | 210 |

## 4. Expensive Setup Census

Pattern census over all 777 default-gate files (`profiling/setup-census.tsv`):

| Pattern | Files | Occurrences | Notes |
|---|---:|---:|---|
| `new GameManager(` | 186 | 395 | +7 files via factory helpers (`createGameManager`-style); ≈2.1 constructions/file avg |
| `new TurnBattleSystem(` | 56 | 210 | concentrated in `src/core/battle/turn/**` (48 files) |
| `vi.useFakeTimers` | 34 | 71 | `advanceTimers*` 13 files / 36 sites |
| Vue `mount(` | 72 | 105 | component tests; Vue Test Utils/jsdom path |
| Phaser refs (`Phaser.` / `new Phaser`) | 9 | 24 | scenes under `src/game/scenes/**` mostly use lightweight scene harness, not real `Phaser.Game` |
| save/serialize/restore markers | 55 | 295 | includes `buildGameSave`/`loadGame`/`toSaveData`/`restoreFrom`/`GameManagerSaveRestore` |
| full-sim drivers (`measureNormalRun`/`measurePerfectionRun`/`EarlyGameSession`/`BattleSimulation`/`runBattle`/`simulateBattle`/`advanceBattle`/`stepBattle`) | 11 | 103 | dominated by earlygame |
| loops ≥ 3-digit bound | 44 | 77 | mostly bounded battle/step loops |
| tick loops | 27 | 80 | `.tick()`/`advanceTick`/`runTicks` |

### Setup class taxonomy

- **A — cheap pure-unit**: construct a domain object / call pure function. ~85 % of files.
- **B — integration**: `new GameManager()` + catalogs + player, `new TurnBattleSystem(...)`, save round-trips, Vue mount, scene harness without real renderer.
- **C — full runtime/simulation**: drives `EarlyGameSession` end-to-end playthroughs, `measurePerfectionRun` full-economy runs, large `combatSource.advance` loops to victory, or `runToCompletion` over many waves.

Category-C usage proving A/B behavior (`REWRITE_CHEAPER` candidates) — detailed list in §14; the canonical case is `PerfectionEconomy.test.ts` running 8+ full playthroughs where its own analytic helpers (`mortalStatBudget`, `reachableStatSourceCensus`, `expectedEssencePerKill`) already prove part of the contract at cat-A cost.

## 5. Semantic Redundancy Map

*(filled below — invariant maps per family in §§6–8)*

Classification legend: **UNIQUE** (sole protection), **OVERLAPPING** (shared + unique assertions), **STRICTLY_SUBSUMED** (→ SAFE_DELETE candidate).

## 6. GameManager Family Audit

*(pending)*

## 7. TurnBattleSystem Family Audit

*(pending)*

## 8. Save/Restore Audit

*(pending)*

## 9. Architecture Audit

*(pending)*

## 10. E2E Audit

*(pending)*

## 11. Property/Invariant Opportunities

*(pending)*

## 12. Default-vs-Full Gate Proposal

*(pending)*

## 13. SAFE_DELETE Candidates

*(pending — proof format per task §12)*

## 14. REWRITE_CHEAPER Candidates

*(pending)*

## 15. MOVE_OUT_OF_DEFAULT_GATE Candidates

*(pending)*

## 16. KEEP_DEFAULT Inventory Summary

*(pending)*

## 17. Structural-Only Consolidation

*(pending)*

## 18. Workload Before/After Model

*(pending)*

## 19. Risk Analysis

*(pending)*

## 20. Recommended Migration Order

*(pending)*

## 21. Evidence Appendix

*(pending)*
