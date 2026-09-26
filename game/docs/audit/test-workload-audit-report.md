# Test Workload & Redundancy Audit — Tiên Hiệp Idle

Audit-only mission. Evidence + remediation plan. No production/test/config/CI changes were made; the only artifacts are this report and raw profiling data under `game/docs/audit/profiling/`.

## 1. Executive Summary

- **Default gate = 777 Vitest files / 7,268 cases** (`vite.config.ts` include: `src/**/*.test.ts` + `tests/architecture/**/*.test.ts`). Wall clock: **301–315 s** (median ~308 s, two timed runs).
- **One file owns ~94 % of the wall clock**: `src/core/simulation/earlygame/PerfectionEconomy.test.ts` (15 cases, 296.7 s file time). It is a *measurement* suite — it drives full early-game playthrough simulations (`measureNormalRun`/`measurePerfectionRun`, 600 s timeouts, 3 seeded runs + determinism re-run + a normal/perfection cross-run).
- **Measured projection**: `vitest run --exclude src/core/simulation/earlygame/PerfectionEconomy.test.ts` → **57.6 s wall (−81 %)**. The remaining 776 files sum to ~43 s of file time; the residual wall is dominated by module transform/import (~200 s cumulative across workers) and fork-pool startup, not test execution.
- Nothing else in the suite is expensive: file #2 is `EssenceSubstitutionEconomy.test.ts` at 8.7 s; p90 file time is ~0.1 s.
- Test-code mass is the real redundancy story: **156,087 LOC of tests**; `GameManager*` family alone is 101 files / ~23.5 k LOC; `TurnBattleSystem*` family 48 files / ~19 k LOC. Nearly all are sub-second — deletions here buy maintainability and case-count, not wall time.
- Found **3 high-confidence SAFE_DELETE** files (+1 case): 2 RETIRED stubs that assert `expect(true)` only, 1 QA-probe file verbatim-subsumed by an adversarial test exercising the same exported authority (mutation-validated), and 1 turnManualMode case subsumed by a stronger QA twin. Modest but airtight.
- **Execution-graph defect**: `import.meta.glob(eager)` in `statDomainWhitelist.test.ts` and `StatCalculator.theTu.test.ts` imports sibling `.test.ts` files → **483 duplicate case-executions (6.6 % of the gate)**. Fix = a `!**/*.test.ts` negation already used by `LegacySkillCoverage.test.ts`.
- Playwright E2E (separate gate): 33 tests / 30 pass / 3 pre-existing failures / 11.4 min.
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

Classification legend: **UNIQUE** (sole protection), **OVERLAPPING** (shared + unique assertions on the same seam), **STRICTLY_SUBSUMED** (→ SAFE_DELETE candidate). Method: leaf-level test-name collision analysis (`profiling/test-names.json`), then file-pair reads of every candidate twin — never filename alone.

### 5.1 Structural redundancy found (execution-graph defect)

**483 executed cases are duplicate registrations**, not extra coverage:

| File | Own cases | Foreign cases | Cause |
|---|---:|---:|---|
| `tests/architecture/statDomainWhitelist.test.ts` | 4 | **424** | `import.meta.glob('../../src/data/**/*.ts', {eager:true})` matches every `src/data/**/*.test.ts`; the imported `describe`/`it` blocks register and run under this file |
| `src/core/stats/StatCalculator.theTu.test.ts` | 16 | **59** | `import.meta.glob('../../data/**/TheTu*.ts', {eager:true})` matches `TheTu*.test.ts` siblings |

Evidence: the JSON reporter attributes 428 cases to `statDomainWhitelist` (158 ms) while the same cases also execute in their own files (`Talents.test.ts` 13, `Stages.test.ts` 12, …). `LegacySkillCoverage.test.ts:88` already uses the correct pattern — `['../../data/**/*.ts', '!../../data/**/*.test.ts']` — and registers only its own 11 cases. The fix is a test-code edit (`!../../**/*.test.ts` negation), i.e. a REWRITE_CHEAPER item (§14), not a deletion — the duplicates are subsumed by construction (the identical test runs in its own file).

### 5.2 File-pair twin classification (all reads done, not filename-inferred)

| Pair | Shared seam | Verdict | Distinct protection in the QA/adversarial twin |
|---|---|---|---|
| `ActionGauge.test` / `.adversarial` / `ActionGaugeAdapter.test` | gauge arithmetic | OVERLAPPING | adversarial pins negative-refund floor 0; adapter pins clamp + `CombatOperationSkip` |
| `TurnQueue.test` / `.adversarial` | `resolveNextTurn` | OVERLAPPING | adversarial pins all-zero / all-negative speed termination |
| `TurnSkillAction.test` / `.adversarial` | selectAction/commitAction | OVERLAPPING | 6 INV-S2 probes (cooldown floor, no-resource-on-select, AOE target shape) |
| `WaveSpawnTrigger.test` / `.adversarial` | wave completion | OVERLAPPING | negative-input rejection + waveIndex=count−1 boundary + mutual exclusion |
| `ResourceTurnHook.test` / `.adversarial` | turn-start deltas | OVERLAPPING | NaN/Infinity delta rejection |
| `introPhase.test` / `introPhase.qa.test` | intro→countdown | OVERLAPPING | +1-tick boundary, mid-intro abandon→slot release, repeat-reject, 2 s catch-up |
| `talentv4.test` / `talentv4.qa.test` | talent combat passives | OVERLAPPING | INV-1..4 (correct pool incl. turn pool, cross-battle reset, no-save-leak, A0 cleanse) |
| `turnManualMode.test` / `turnManualQa.test` | manual-turn pause | OVERLAPPING | INV-TM-1..7 (exactly-once, no-pause no-op **+1 stronger**, mid-pause toggle-off, refight chain) — one shared case, §13.4 |
| `GameManager.r7qa` / `GameManagerSaveRestore.onceOnlySettle` | boot-settle | OVERLAPPING | decompose-channel settle not covered by the autoFarm spy test |
| `GameManager.r81qa` / other restore tests | restore boundary | OVERLAPPING | quest progress / completed-once restore boundary |
| `GameManager.r9qa` | wash-ticket persistence | UNIQUE | sole pin: wash ticket must not persist |
| `GameManager.coreLevelChain.qa` | cross-system chains | UNIQUE | sole pin: core-level chain sequencing |
| `resolveDrops.test` / `.gating.qa` | drop resolution | OVERLAPPING | `van_kiem_quyet` never-lootable invariant (pool + boss path) |
| `BreakthroughOutcomeService.test` / `.qa` | breakthrough outcome | OVERLAPPING | facade tick-path once-only + failure-after-exhaustion |
| `TribulationOutcomeService.test` / `.loiKiep` / `.startSide` | tribulation outcome | OVERLAPPING | loi_kiep stack accounting, start-side prep parity |
| `CompanionGifts.test` / `.wiring` | gift registry vs seam | OVERLAPPING | registry invariants vs realm/stage seam exactly-once |
| `CombatExitConfirmModal.test` / `.focus` | modal behavior vs focus | OVERLAPPING | focus-trap lifecycle (focus-in, Escape, Tab cycle) |
| `CombatScheduler.review-round-2` | scheduler ordering | OVERLAPPING | settle ordering/drain semantics vs base scheduler tests |
| `EquipmentSystem.test` / `.wash` | forge/wash | OVERLAPPING | one shared name (`forgeUsesRemaining=0`) on different operations — keep |
| `SeededRandom.test` vs `runtime/rng/rng.test` | RNG | **UNIQUE** | different RNG implementations/authority — same-named tests, different units |
| `MaterialBag` / `PillBag` stack-snapshot twins | bag immutability | **UNIQUE** | same invariant name on different authorities |
| `AncientBeastTrial` / `QuanTheDiversion` "rejects a closed lineage" | lineage gates | **UNIQUE** | different domains, different authority |
| `EnhanceTab` / `WashTab` "hiện đủ 6 slot" | equipment UI | **UNIQUE** | different components |
| `GameManager.artifactGradeUpgrade` / `.setArtifactPath` "không có artifact → no-op" | artifact facade | **UNIQUE** | different facade methods |

### 5.3 STRICTLY_SUBSUMED (proofs in §13)

1. `src/core/game/GameManager.bossSummon.test.ts` — RETIRED stub; sole body is `expect(true).toBe(true)`.
2. `src/core/game/GameManager.phapTuChain.test.ts` — RETIRED stub; same.
3. `src/core/battle/turn/TurnBattleSystem.qadebug.test.ts` — single selectTarget same-row test verbatim-identical (same scenario objects, same assertion) to `TurnBattleSystem.adversarial.test.ts` INV-S1-4; file's own comment states it is "a regression test for the probe-writing process itself, not production behavior". Mutation-validated (§13.3).
4. `GameManager.turnManualMode.test.ts` case `submit khi KHÔNG pause → false` — STRICTLY_SUBSUMED by `turnManualQa` INV-TM-5 (identical call + adds `totalTurnsElapsed` unchanged). Case-level only; the file stays.

All other examined twins: **KEEP** — adversarial/QA twins systematically pin *degenerate-input and boundary* invariants the happy-path files do not exercise.

### 5.4 Historical accretion context

Full history (not shallow). Test-file creation commits: **65 in 2026-08, 414 in 2026-09** — peak days 34 (09-17), 29 (09-15), 29 (09-04), 28 (09-02). The suite is ~6 weeks old and accreted at up to ~34 files/day through review-round/qa/adversarial mission passes. That pattern explains the shape: many small boundary-pin files, very few true duplicates (the review process deduplicated by family, not by assertion).

## 6. GameManager Family Audit

Strict family `GameManager.*`: **101 files / 572 cases / 4.0 s** file time (~23.5 k LOC). Including `GameManagerSaveRestore*`/`GameManagerCompanionOps`/`GameManagerTurnBattleOps`: 113 files / 748 cases / 4.3 s.

**Pattern**: one facade method cluster per file (`GameManager.stageLease`, `GameManager.kiemTuTree`, `GameManager.autoFarm*`, `GameManager.perfectClear*`, …). Construction cost is trivial: 395 `new GameManager(` across 186 files ≈ 2.1/file; per-file median <0.1 s.

**Facade-vs-owner check** (task §5 — is the facade re-testing what the owner already pins?): sampled `GameManager.decompose`/`autoFarm`/`statRefresh`/`stageLease` — each exercises the *GameManager seam* (session state, restore wiring, cross-system propagation) rather than re-asserting owner internals; the owner-level equivalents live in `src/core/**` files with different invariants. `GameManagerSaveRestore.onceOnlySettle` is spy-based proof of the once-only gate — thin but unique.

**Verdict**: no file-level subsumption besides §13. Family is OVERLAPPING by design at the facade seam; bulk is a STRUCTURAL_MERGE_ONLY candidate (§17), not a runtime win.

## 7. TurnBattleSystem Family Audit

Named `TurnBattleSystem*`: **48 files / 358 cases / 1.4 s** (~19 k LOC); whole `src/core/battle/turn/` dir: 74 files / 543 cases / 1.6 s. 210 `new TurnBattleSystem(` constructions, concentrated in 56 files.

- `TurnBattleSystem.test.ts` (base behavior) + `.adversarial.test.ts` (INV-S1 degenerate inputs) + 40+ slice/regression files — distinct invariant sets per file (verified pairwise on the twins in §5.2).
- `TurnBattleSystem.qadebug.test.ts` → STRICTLY_SUBSUMED (§13.3).
- `GameManagerTurnBattleOps.turnEngine` + `turnManual*` — facade-side manual/pause invariants; overlap with TBS unit tests is at a different seam (facade vs engine).

**Verdict**: family is cheap (0.5 % of Σ file time) and genuinely diversified. The task doc's migration-order suspicion (TBS as first workload target) is refuted by measurement — TBS work is a maintainability matter only.

## 8. Save/Restore Audit

31 files / 654 cases / **0.7 s** total. Layers:

| Layer | Files | Role |
|---|---:|---|
| Service (`SaveSystem.*`, `SaveMigration`, `SaveRoundTrip`, `saveShapeValidation` 356-case matrix, `saveKeys`, `saveVersion`) | 8 | authority-layer round-trip + shape validation |
| Facade (`GameManagerSaveRestore.*`, `GameManager.*Restore*`, `player.save`/`restoreFromSave`) | 10 | GameManager seam: what state crosses save/load |
| Side systems (`BuffPersistence`, `DecomposeSystem.saveRestore`, `TribulationDirector.persist*`) | 7 | per-system persistence pins |
| Cloud (`SupabaseRemoteSave`, `LocalCloudSaveService.quota`, `CloudSave*`) | 6 | remote/quota seams |

Subsumption check: `saveShapeValidation` (356 parametrized shape cases) vs `SaveSystem.test`'s 4 corrupted-save cases — the latter exercise the `loadGame`→reject *mapping seam*, not the shape matrix; OVERLAPPING, keep. Restore-boundary QA files (hiddenLineageRestore, talentPassiveRestore, restoreLeak, hiddenTypePersist, onceOnlySettle) each pin a distinct leak/once-only invariant not present in the happy-path round-trips. **No SAFE_DELETE here.** `player.save.test.ts` (2 cases) is thin but sole coverage of `Player.toSaveData` field selection — UNIQUE.

## 9. Architecture Audit

44 files / 592 registered cases / **3.6 s** (of which 424 cases are the §5.1 foreign duplicates; own cases = 168). All use `helpers/scanTs.ts` or `import.meta.glob` scans; none spawn heavy subprocesses except `eslintCoreSeverity` (0.8 s, eslint invocation) and two fs-scan files (~0.7 s each). Median <50 ms — the family is already cheap and high-value (drift guards).

Defect found (see §5.1): `statDomainWhitelist.test.ts`'s eager glob imports sibling `.test.ts` files — causing double execution *and* misattribution. Fix pattern already exists in-repo (`LegacySkillCoverage.test.ts`). One more: `artExtentDeclared`/`staticArtExtentDeclared`/`enemyArtEnumeration` share asset-scan walks — micro-overlap, keep.

## 10. E2E Audit

Playwright (`tests/e2e/*.spec.ts`, workers=2, per-test timeout 90 s, webServer auto-spawns vite): measured run → **33 tests executed (19 spec files), 30 passed / 3 failed, 11.4 min wall**.

Failures (master @ be1bdf8d, audit did not touch code):
- `combat-idle-motion-capture` — player-frame animation advance (timing/frame-sensitive),
- `standing-slot-panel` — `[data-wheel-slot]` click blocked: "element is not enabled" after 175 retries,
- `technique-frozen-warning` — frozen-cycle warning on Trúc Cơ confirm.

Not classified as env noise without deeper triage (not in audit scope); they are outside the default vitest gate already. E2E is its own tier — **no duplication claim** vs vitest; it covers browser seams vitest cannot. `wave-vfx-capture`/`combat-idle-motion-capture` are artifact-capture specs (screenshots) — candidates for a manual/nightly tag rather than per-PR, but already excluded from the vitest gate.

## 11. Property/Invariant Opportunities

The codebase already uses exhaustive/property-style scans where they pay: `ChapterStages`/`Stages` wave-sum invariant over all floors, `saveShapeValidation` 356-case matrix, `TalentPools`/`buffs` registry census, `catalogPreloadParity`. Remaining candidates where *a property replaces example enumeration*:

- **`PerfectionEconomy` driven cases (8)**: the income-tolerance assertions are effectively a sampled property (`∀ seed ∈ {11,23,7}: measured income ∈ tolerance`). Its own analytic cases already derive `expectedEssencePerKill`/`expectedKillsForBody` from the drop tables directly — the analytic invariants are the regression pin; the 600 s-driven runs are *evidence generation* (the file's comment says the design doc's table is sourced from this run). Move to Tier C (§12), no rewrite needed.
- **`EssenceSubstitutionEconomy`**: band-residency measurement per seed — same class; analytic locks (`lockConversionRatio` pure rule, tight-budget failure) already pin the contract. Tier B.
- **`TrucCoJourney`/`EarlyGameSession`/`MortalChapterJourney`**: pinned-leg-order journeys on real seams — true integration tests, not measurement; keep as-is or Tier B.
- **selectTarget / TurnQueue ordering**: could gain a fast-check property (forall priorities: argmin Chebyshev in same-row pool, deterministic first-min) — *generality* gain, no runtime gain; low priority.
- **`TurnBattleSystem.adversarial` INV-S1 suite**: already property-shaped examples; fine as-is.

No file currently warrants a property rewrite *for speed* — the one slow file is slow because it drives 8 full playthroughs, and the fix is tiering.

## 12. Default-vs-Full Gate Proposal

Existing seams to reuse: `vitest.lab.config.mts` (`tests/lab/**`, `npm run lab`) is already an out-of-default tier; Playwright is already separate.

- **TIER A — fast default** (`npx vitest run`, every PR): everything except the measurement/simulation files below. Projected wall **~57.6 s measured**, ~7,250 case-instances (post-deletion), ~6,766 after the glob fix.
- **TIER B — integration** (pre-merge or `vitest run tests/integration`-style include): `EssenceSubstitutionEconomy` (8.7 s), `TrucCoJourney` (5.0 s), `EarlyGameSession` (0.8 s), `MortalChapterJourney` (0.4 s), `ProductionBalance.simulation` (0.3 s), `BattleSimulation.determinism` (0.5 s), `dropCharacterization` (0.5 s) — ~16 s file time, ~45 cases.
- **TIER C — exhaustive/adversarial** (scheduled nightly + release): `PerfectionEconomy.test.ts` (296.7 s; or split: keep its 7 analytic cases in Tier A, move the 8 `{timeout:600_000}` driven cases to a `tests/lab` or `*.exhaustive` file), plus the existing lab gate and full Playwright run.

Rationale: Tier A loses nothing it could catch at PR time except long-horizon economy drift, which Tier B/C still detects on a schedule.

## 13. SAFE_DELETE Candidates

### 13.1 `src/core/game/GameManager.bossSummon.test.ts`

    Candidate: GameManager.bossSummon.test.ts (whole file, RETIRED stub)
    Protected behaviors: B1 — file exists as a marker for the retired boss-summon flow (documentation only)
    Surviving coverage: B1 -> git history + roadmap; no executable assertion exists to preserve (sole body: expect(true).toBe(true))
    Authority equivalence: n/a — no production authority is exercised
    Boundary equivalence: n/a
    Verdict: STRICTLY SUBSUMED

### 13.2 `src/core/game/GameManager.phapTuChain.test.ts`

    Candidate: GameManager.phapTuChain.test.ts (whole file, RETIRED stub)
    Protected behaviors: B1 — retired phap-tu chain marker (documentation only)
    Surviving coverage: B1 -> git history; sole body expect(true).toBe(true)
    Authority equivalence: n/a; Boundary equivalence: n/a
    Verdict: STRICTLY SUBSUMED

### 13.3 `src/core/battle/turn/TurnBattleSystem.qadebug.test.ts`

    Candidate: TurnBattleSystem.qadebug.test.ts (1 test: 'selectTarget probe hygiene (QA) > same-row ưu tiên …')
    Protected behaviors:
      B1 — selectTarget prefers a same-row candidate over a nearer other-row candidate (actor(0,4), otherRowNear(1,5), sameRowFar(3,4) → 'sameRowFar')
      B2 — the assertion reads `.id` off the returned participant without unsafe chaining (probe-hygiene meta-invariant, per file header comment)
    Surviving coverage:
      B1 -> TurnBattleSystem.adversarial.test.ts 'INV-S1-4: cùng hàng ưu tiên hơn khoảng cách Chebyshev tổng thể gần hơn' — identical scenario, identical assertion (expect(...).toBe('sameRowFar'))
      B2 -> the same INV-S1-4 also asserts `selectTarget(...)?.id` directly
    Authority equivalence: both files import the same `selectTarget` export from './TurnBattleSystem' and call it with the same argument shape — same canonical production authority, no seam difference
    Boundary equivalence: INV-S1-4 exercises the identical input boundary (same actor/positions/pool); it is equal (not weaker)
    Mutation validation (task §16): locally replaced `pool = sameRow.length>0 ? sameRow : living` with `pool = living` in TurnBattleSystem.ts → INV-S1-4 FAILED (expected 'sameRowFar', got 'otherRowNear'), i.e. the surviving test detects the exact defect qadebug guards. Mutation reverted and re-verified green; not committed.
    Verdict: STRICTLY SUBSUMED

### 13.4 `GameManager.turnManualMode.test.ts` — one case

    Candidate: case 'submit khi KHÔNG pause → false (no-op an toàn)' (~line 181)
    Protected behaviors: B1 — submitTurnChoice on a non-awaiting battle returns false and resolves nothing
    Surviving coverage: B1 -> GameManager.turnManualQa.test.ts 'INV-TM-5: choose khi KHÔNG awaiting là no-op an toàn, không resolve gì' — same call, same false assertion, PLUS totalTurnsElapsed unchanged (stronger)
    Authority equivalence: identical facade call gameManager.submitTurnChoice('basic')
    Boundary equivalence: surviving test strictly stronger (adds no-turn-advance check)
    Verdict: STRICTLY SUBSUMED (case-level; file remains)

**Total: 3 files + 1 case.** Nothing else met the proof bar — all other twin pairs have at least one boundary or degenerate-input assertion unique to each side; when uncertain, keep.

## 14. REWRITE_CHEAPER Candidates

| # | File | Current expensive path | Cheaper authority/seam | Coverage equivalence |
|---|---|---|---|---|
| R1 | `tests/architecture/statDomainWhitelist.test.ts` | `import.meta.glob('../../src/data/**/*.ts', eager)` also imports all `src/data/**/*.test.ts` → 424 duplicate executions | glob `['../../src/data/**/*.ts', '!../../data/**/*.test.ts']` (pattern already used by `LegacySkillCoverage.test.ts:88`) | identical — the foreign tests still run in their own files; whitelist scan sees the same non-test modules (it already `endsWith('.test.ts')`-skips them inside the loop) |
| R2 | `src/core/stats/StatCalculator.theTu.test.ts` | `import.meta.glob('../../data/**/TheTu*.ts', eager)` matches `TheTu*.test.ts` → 59 duplicate executions | add `!../../data/**/*.test.ts` | identical, same reasoning |
| R3 | `PerfectionEconomy.test.ts` (if kept in default) | 8 driven runs with `timeout:600_000` | none needed if moved (§12); alternative: reduce seed set {11,23,7}+normal+determinism → {11} + analytic tolerances widened | weaker — loses cross-seed variance evidence; prefer tiering |
| R4 | `GameManagerSaveRestore.boundary.test.ts` (90 cases / 1,477 LOC) | full `new GameManager` per boundary probe | could share one constructed fixture per describe via `beforeEach` reuse | identical assertions; ~ms-scale win — not worth it; listed to document the class |

Only R1/R2 are recommended — they fix a real defect (double execution + misattribution), costless.

## 15. MOVE_OUT_OF_DEFAULT_GATE Candidates

| File | Cases | File time | Recommended tier |
|---|---:|---:|---|
| `src/core/simulation/earlygame/PerfectionEconomy.test.ts` | 15 | 296.7 s | **C** (or split: 7 analytic cases stay A, 8 driven cases → C/lab) |
| `src/core/simulation/earlygame/EssenceSubstitutionEconomy.test.ts` | 8 | 8.7 s | B |
| `src/core/simulation/earlygame/TrucCoJourney.test.ts` | 8 | 5.0 s | B |
| `src/core/simulation/earlygame/EarlyGameSession.test.ts` | 8 | 0.8 s | B (optional — cheap enough to keep) |
| `src/core/simulation/earlygame/MortalChapterJourney.test.ts` | 6 | 0.4 s | B (optional) |
| `src/core/simulation/BattleSimulation.determinism.test.ts` | 5 | 0.5 s | B (optional) |
| `src/core/simulation/BattleMetrics.test.ts` | 16 | 0.5 s | B (optional) |
| `src/core/production/ProductionBalance.simulation.test.ts` | 5 | 0.3 s | B (optional) |
| `src/core/drop/dropCharacterization.test.ts` | 2 | 0.5 s | B (optional — characterization run) |
| Playwright artifact-capture specs (`wave-vfx-capture`, `combat-idle-motion-capture`) | — | (inside 11.4 min) | tag `@capture`, run on demand |

The single mandatory move is PerfectionEconomy. The optional Tier-B set is a secondary ~16 s.

## 16. KEEP_DEFAULT Inventory Summary

Everything else: **~770 files / ~7,200 cases / ~40 s Σ file time** — keep in default.

- All `*.adversarial.test.ts` / `*.qa.test.ts` twins (30 files / 96 cases / 0.47 s): pin degenerate-input boundaries absent from base files.
- All `GameManager.*` facade files except the 2 retired stubs: facade-seam invariants (restore wiring, once-only settle, lease/scope).
- All `tests/architecture/**` (168 own cases / ~3.6 s): drift guards; the cheapest protection-per-case in the suite.
- All save/restore files: distinct seam layers (§8).
- All scene/component/store tests incl. `src/game/scenes/**` (34 files, all pass with canvas@3.2.3 installed).
- The 4 `it.fails` in `GameManager.perfectClear.feasibility.test.ts`: deliberate playtest-debt markers — keep as documentation of known-unmet targets.

## 17. Structural-Only Consolidation

Maintainability-only candidates (no meaningful runtime reduction — do NOT count toward workload savings):

- `GameManager.*` sprawl: 101 single-cluster files → could merge ~70 % into domain-grouped files (e.g. `GameManager.kiemTu*.test.ts` → one `kiemTu` suite). Saves ~20 k LOC of boilerplate; runtime unchanged (each file's fork/transform cost is amortized, not per-file dominant).
- `TurnBattleSystem.*` 48 named files → same consolidation class (~19 k LOC).
- The 5-file `GameManagerSaveRestore`/`SaveSystem` split is *semantic* (seam layers) — do not merge.
- `.adversarial`/`.qa`/`.review-round-N` naming is load-bearing evidence of provenance (which review round produced the pin) — keep the convention; merge only if renamed to preserve it.

## 18. Workload Before/After Model

| Phase | Files | Executed cases | Wall (measured/projected) | Σ file time |
|---|---:|---:|---:|---:|
| BEFORE (current default) | 777 | 7,268 | 307.7 s median | 340.1 s |
| **SAFE phase**: delete 3 files (−4 cases), fix 2 globs (−483 dup executions), move PerfectionEconomy → Tier C | 773 | ~6,766 | **~57.6 s (measured via `--exclude`; −81.3 %)** | ~43 s |
| **AGGRESSIVE-SAFE**: + move Tier-B set (7 src files, ~45 cases, ~16 s) | ~766 | ~6,720 | **~50–55 s (−82 to −84 %)** | ~27 s |
| Full suite unchanged | — | Tier A + B + C + lab + E2E retain every surviving case | C/lab ≈ +297 s scheduled; E2E 11.4 min unchanged | — |

Defect-detection parity argument: SAFE phase removes zero unique assertions (3 deletions proven subsumed; glob fix changes attribution only; PerfectionEconomy's analytic invariants can remain in default via file split if desired — otherwise its protection moves wholesale to the scheduled tier).

## 19. Risk Analysis

| Change | Risk | Mitigation |
|---|---|---|
| PerfectionEconomy → Tier C | Long-horizon economy drift escapes per-PR detection | schedule lab/C tier nightly; the 7 analytic cases (stat-budget, source census, drop-table income) can stay in Tier A as a split file, keeping cheap guards per-PR |
| Glob fixes (R1/R2) | None — test-code-only, verified pattern in-repo | one-file change each; verify `vitest list` shows only own cases |
| SAFE_DELETE ×4 | Retired-stub filenames carry historical meaning | git history retains them; deletion diff is self-documenting |
| Tier-B moves | Journey/integration regressions run less often | Tier B still runs pre-merge; only the C tier is scheduled |
| Doing nothing | default gate stays ~5 min where ~1 min suffices; the eager-glob defect continues double-executing 483 cases | n/a |
| Not fixing E2E's 3 failures | pre-existing failures (motion capture, slot panel, technique warning) on master — flag for triage, unrelated to this audit | file as separate defect reports |

## 20. Recommended Migration Order

The task doc's proposed order (TurnBattleSystem → GameManager → save/restore → …) is **refuted by measurement**: those families are 0.5 %/1.2 %/0.1 % of file time. Correct order by evidence:

1. **Move `PerfectionEconomy.test.ts` out of the default gate** (−81 % wall; optionally split analytic vs driven cases).
2. **Fix the two `import.meta.glob` double-run files** (R1/R2 — a real execution-graph defect; −483 dup cases).
3. **Delete the 4 proven-subsumed items** (2 retired stubs, qadebug file, 1 turnManualMode case).
4. **Move the Tier-B earlygame/sim set** (−~16 s more if desired).
5. *(Optional, maintainability)* Consolidate `GameManager.*`/`TurnBattleSystem.*` file sprawl — explicitly not a workload win.
6. Triage the 3 pre-existing Playwright failures.

Steps 1–3 are each a single-file/single-commit change with no interdependency — order is by impact, not necessity.

## 21. Evidence Appendix

| Artifact | Path |
|---|---|
| Per-file durations + case counts (JSON reporter run) | `docs/audit/profiling/per-file-durations.tsv` |
| Setup-census pattern counts | `docs/audit/profiling/setup-census.tsv` |
| Per-file test names (`vitest list`) | `docs/audit/profiling/test-names.json` |
| Baseline runs | `vitest run` ×2: 314.7 s, 300.7 s; `vitest list` 7,268 cases |
| Counterfactual | `vitest run --exclude '**/PerfectionEconomy.test.ts'` → 57.6 s wall |
| Mutation validation | `TurnBattleSystem.ts` `pool = living` → INV-S1-4 + qadebug both FAIL; reverted, re-verified green |
| E2E | `npx playwright test`: 33 tests, 30 pass / 3 fail, 11.4 min |
| Env failures | `dongFuBackgroundAssets`, `dongFuBuildingPipeline` — `spawnSync magick ENOENT` |

---

## FINAL VERDICT

    CURRENT DEFAULT:
      777 files
      7,268 executed cases (of which 483 are duplicate registrations from eager-glob imports)
      ~307.7 s wall (median of 314.7 s / 300.7 s)

    SAFE REDUCTION:
      4 case-instances removable by deletion (3 files + 1 case, all with strict proofs)
      483 duplicate executions removable by glob fix
      ~0.2 s runtime removable directly; deletion value is correctness/maintainability
      (<0.1 % of wall from deletions alone)

    DEFAULT-GATE REDUCTION:
      15 cases / ~296.7 s movable out of default (PerfectionEconomy → Tier C)
      optionally +45 cases / ~16 s (Tier-B earlygame/sim set)
      -81.3 % wall measured (-82 to -84 % projected aggressive)

    REWRITE-CHEAPER POTENTIAL:
      ~0.2 s runtime + 6.6 % of executed-case count (483 duplicates) removed by 2 glob negations
      evidence: JSON reporter attributes 428 cases to statDomainWhitelist (4 own) and 75 to theTu (16 own)

    PROJECTED DEFAULT:
      ~773 files
      ~6,766 executed cases (all duplicates removed, all deletions applied)
      ~57.6 s wall measured (≈ −81 %); ~50–55 s with the Tier-B set also moved

    PROJECTED FULL:
      ~7,266 surviving unique cases across Tier A + B + C + lab + E2E
      (every surviving case retained — tiering only)
      default ~57.6 s + Tier B ~16 s + Tier C ~297 s (scheduled) + lab 4.4 s + E2E 11.4 min

    COVERAGE/INVARIANT IMPACT:
      Zero unique-assertion loss. The 3 deleted files + 1 deleted case are
      strictly subsumed (§13 proofs; qadebug mutation-validated). The 483
      removed duplicate executions are registration artifacts — the same
      tests still run once in their own files. All tier moves preserve
      execution on a B/C schedule; only per-PR latency changes.

    TOP 10 HIGHEST-ROI CHANGES:
      1. Move src/core/simulation/earlygame/PerfectionEconomy.test.ts to Tier C / tests/lab — −81 % wall, zero coverage loss
      2. Add '!**/*.test.ts' to statDomainWhitelist.test.ts eager glob — −424 duplicate executions
      3. Add '!**/*.test.ts' to StatCalculator.theTu.test.ts eager glob — −59 duplicate executions
      4. Delete GameManager.bossSummon.test.ts + GameManager.phapTuChain.test.ts (retired expect(true) stubs)
      5. Delete TurnBattleSystem.qadebug.test.ts (subsumed by adversarial INV-S1-4; mutation-validated)
      6. Delete GameManager.turnManualMode.test.ts case 'submit khi KHÔNG pause → false' (subsumed by INV-TM-5)
      7. Move EssenceSubstitutionEconomy + TrucCoJourney (+ optionally EarlyGameSession/MortalChapterJourney) to Tier B — −~14 s
      8. Move BattleSimulation.determinism / BattleMetrics / ProductionBalance.simulation / dropCharacterization to Tier B — −~2 s
      9. Tag Playwright capture specs (@capture: wave-vfx, combat-idle-motion) for on-demand runs
      10. Triage the 3 pre-existing E2E failures (idle-motion capture, standing-slot panel, technique-frozen warning) and the 2 magick env failures

    DO NOT REMOVE:
      - All *.adversarial/*.qa twins — they pin degenerate-input and boundary invariants the base files do not exercise
      - GameManager.* facade tests — seam-level restore/wiring invariants distinct from owner tests
      - Save/restore seam layers (SaveSystem service, GameManagerSaveRestore facade, per-system persistence, cloud)
      - tests/architecture/** drift guards — cheapest protection per case in the suite
      - it.fails markers in GameManager.perfectClear.feasibility — deliberate playtest-debt documentation
      - PerfectionEconomy's 7 analytic cases — keep in Tier A even if the driven cases move

    [TEST-WORKLOAD-AUDIT] PASS
