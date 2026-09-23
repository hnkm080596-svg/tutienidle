# QA Review: M-F-ARTIFACT-DEFER (artifact domain deferred to Kim Dan+)

- Date: 2026-09-23
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths: `game/src/core/artifact/ArtifactDomain.ts` (new), `Artifact.ts`, `ArtifactProgression.ts`, `core/realm/ReleasePolicy.ts`, `core/material/Material.ts`, `core/game/BattleLootSystem.ts`, `GameManagerRealmAdvanceOps.ts`, `battleLootTestSetup.ts`, `core/tribulation/BreakthroughOutcomeService.ts`, `core/phap-tu/PhapTuPath.ts`, `data/artifact/NguHanhChau.ts`, `data/breakthrough/BreakthroughScopedResources.ts`, `data/materials/materials.ts`, `data/ui/commandWheelCatalog.ts`, `components/game/DongFuCommandWheel.vue`, `services/save/saveVersion.ts`, plus the flipped/new test files (`ReleasePolicy.test.ts`, `ReleasePolicy.artifactDeferred.test.ts`, `ArtifactProgression.test.ts`, `player.artifact.test.ts`, `GameManager.{setArtifactPath,artifactGradeUpgrade,cultivationPathRewards}.test.ts`, `BattleLootSystem.artifactDrop.test.ts`, `BreakthroughOutcomeService.test.ts`, `CultivationPathKit.test.ts`, `DongFuCommandWheel.test.ts`, `useTribulation.artifact.test.ts`, `cultivationRitualFlow.integration.test.ts`, `SkillPathPanel.test.ts`, `tests/e2e/cultivation-path-ritual.spec.ts`) and docs (`docs/systems/artifact.md`, `docs/game-guide.md`, spec/plan).

## Scope and Risk Map

changed-risk-map.mjs: domains {combat-and-tribulation, economy-and-progression, inventory-equipment, pinia-phaser-sync, save-and-cloud, ui-input-lifecycle}; `deepAuditCandidate: true` ("critical state boundary: save-and-cloud", "cross-system: 6 domains"); 20 unmappedPaths (tests/docs/data files routed manually below).

**Escalation decision — quick is sufficient, documented:** the change is one coherent seam (a single deferred-domain unlock declaration consumed by grant/normalize/EXP/ops/wheel/delivery), not a broad system change. The save-boundary flag is `saveVersion.ts` (a version constant + comment) plus `normalizeArtifactProgress`'s awaken gate — restore semantics are bounded and pinned: ownership is never destroyed, access is gated at domain seams. Every one-hop consumer of the changed transitions (loot material arm, ops guards, wheel context, tribulation outcome, realm reward grant, offline/autofarm via `BattleLootSystem.processDefeatedEnemies`) is exercised by direct tests, the mocked-open boundary file, or the P14 e2e oracle. No clock/offline, migration, or cloud-write semantics changed; no Vue/Pinia/Phaser lifecycle ownership moved.

unmappedPaths routing: test files -> test-evidence pack (rules applied via P18 review); docs -> documentation only; `PhapTuPath`/`NguHanhChau`/`materials.ts`/`BreakthroughScopedResources`/`commandWheelCatalog` -> content/registry (integrity-pinned); `GameManagerRealmAdvanceOps` -> ops under combat-and-tribulation; `battleLootTestSetup` -> test harness; `e2e spec` -> P14 runtime evidence.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
|---|---|---|---|---|---|---|---|
| INV-ADF-1 | `player.artifact` ownership / ArtifactProgression.normalize | restoreFromSave normalize | A persisted artifact whose id matches the path is NEVER destroyed by the gate; only awakening is gated | Stale state (beyond-ceiling/dormant save) | `artifact` retained, exp preserved | Unit (ReleasePolicy.test: dormant exp 9; beyond-ceiling exp 7) | High: save loss class |
| INV-ADF-2 | domain access / all seams | grant, awaken, EXP, ops, wheel, delivery, tier advance | Below unlock realm -> nothing materializes and nothing is accessible, under ANY window | Cross-system chain | undefined artifact, false ops, 0 drops, 0 exp, disabled slot | Unit + mocked boundary + e2e | High: mission core |
| INV-ADF-3 | stone delivery / material arm | retained TC row resolves | Delivery composes window AND player reach (never window-only) | Timing boundary (below/at/above unlock) | bag amount 0 vs 1 on the SAME authored row | Unit (both windows) | High: economy |
| INV-ADF-4 | wheel reason / commandWheelCatalog | disabledReason ladder | release-hidden vs progression-lock vs definition-pending distinct, terminal arm unshadowed | Reorder (ladder arms) | reason strings per context | Unit (both windows) | Medium |
| INV-ADF-5 | authored row / StageDropTables | table unchanged | `doan_bao_thach` row retained so KD delivery resumes without table edit | Stale state | row present w25; suppressed pre-delivery | Unit + code read | Medium |
| INV-ADF-6 | unlock declaration / ArtifactDomain leaf | every surface keys the shared constant | no second authored realm literal; no import cycle | Value mutation (retarget drift) | integrity tests pin reward key, material tag, definition field | Unit (integrity describe) | Medium |
| INV-ADF-7 | offline/autofarm | AutoFarm tick -> processDefeatedEnemies | deferred material + EXP routes share the gated authority | Cross-system chain | same material arm + EXP feed | Code read (GameManagerAutoFarmOps routes to BattleLootSystem) | Medium |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
|---|---|---|
| `npx vitest run` (full suite inside `npm run verify`) | 6910 pass, 3 fail non-task | 2x `spawnSync magick ENOENT` (environment, ImageMagick absent); 1x `SettingsPanel.test.ts` confirm-modal null — reproduced failing on the stashed BASE (pre-existing, not task-caused) |
| `npm run type-check` + `npm run build` | clean, built 1.92s | inside `npm run verify` |
| Scoped rerun post-fix (8 files incl. new positive-leg case) | 97 pass | ReleasePolicy.test.ts 33/33 after adding the real-window positive-leg pin |
| `npx playwright test cultivation-path-ritual -g "artifact deferred"` | pass 40.6s | real browser: TC restore keeps artifact undefined; phap_bao slot `aria-disabled` |
| P14 scratch wheel-tooltip spec (deleted after) | pass 18.8s | TC wheel phap_bao disabled + `#global-tooltip` shows `Chưa mở trong bản hiện tại` |
| `grep` ownership/access write sites | 3 artifact writers, all gated | normalize (awaken gate), realm-reward grant (record keyed at GC + release check), BreakthroughOutcomeService awaken (realm + domain gate) |
| ArtifactPanel reachability | sole entry = wheel slot; `activate()` returns on disabledReason; ops guards are the second wall | DongFuCommandWheel.vue:300/:324 |

## Findings

### QA-2026-09-23-ADF-1: domain-scoped `rewardGranted` dedup no longer asserted
- Severity: Low
- Status: Coverage gap (non-material)
- Invariant: INV-ADF-3
- Preconditions: deferred domain (real window)
- Reproduction: `BattleLootSystem.artifactDrop.test.ts` "rewardGranted" case now asserts bag = 0; the dedup semantics for a domain-scoped material are unobservable while delivery is gated
- Expected: dedup coverage preserved for when the domain opens
- Actual: dedup is a generic `rewardGranted` flag shared by all drop kinds and remains covered on untagged materials; the domain-scoped path is additionally covered in the open window by the retained-row test (exactly 1 stone)
- Evidence: test file diff; mocked boundary "delivers the stone to a Kim Dan player" asserts amount === 1
- Test file: none added (assertion is moot while the gate suppresses delivery; redundant on open)
- Owner subsystem: core/game loot
- Blast radius: none today; a future dedup regression under an open window would surface via delivery counts

## New or Changed QA Tests

None added by this QA pass — the mission's own TDD suite covers every high-risk hypothesis: `ReleasePolicy.artifactDeferred.test.ts` (open-window matrix: predicate flips, normalize KD/TC/mismatch, grant, EXP=2, retained-row KD=1/TC=0, ops succeed + combat guard, wheel ladder 4 arms incl. definition-pending terminal, banked tier release), `ReleasePolicy.test.ts` (predicate boundary legs incl. in-window positive + unknown fail-closed, integrity census + cross-field pin), flipped TC suites (ritual/tribulation/kit/ops/drops/wheel/player restore), and the flipped e2e oracle.

## Gaps and Residual Risk

- The open-Kim-Dan window cannot run under real policy today by definition; positive behavior is proven via the consistent-semantics mock (same composition over `getRealmIndex`/`REALMS`) plus the real predicate's legs pinned under the real window. Residual: a mock drift on a future retarget — mitigated by the integrity pins binding every surface to `ARTIFACT_UNLOCK_REALM_ID`.
- `rewardGranted` dedup for the domain-scoped material is subsumed by gate-0 (QA finding above; non-material).
- Beyond-ceiling KD save (e.g. a future-era save) is pinned dormant at unit level; no e2e for that seed shape — bounded by the same predicate legs.

## Pre-existing Failures

- `SettingsPanel.test.ts > reset save > autosave` — `confirm-modal` null; reproduced on the stashed base (identical failure without this diff).
- `dongFuBackgroundAssets`/`dongFuBuildingPipeline` — `spawnSync magick ENOENT` (ImageMagick absent from environment).
- `cultivation-path-ritual.spec.ts` TC seed predates the M-F-TECHNIQUE v75 `gradeHistory` validator — the realm bump left the live grade lagging with no grade-1 record, so restore rejected the seeded save BEFORE any mission assertion. Fixed test-side (canonical `{1:{finalRank:0,completionState:'partial'}}` born-sealed record on both TC seeds); the oracle now runs green.
