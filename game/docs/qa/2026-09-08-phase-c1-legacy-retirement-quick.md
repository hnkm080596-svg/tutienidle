# QA Review: Phase C1 — battle/legacy Retirement

- Date: 2026-09-08
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - `game/src/core/battle/legacy/**` (DELETED: BattleSystem, UltimateSystem,
    LavaZone, SwordZone, HazardZoneSystem, README + 4 test files)
  - `game/src/core/battle/BattleSystem.*.test.ts` (29 retired stubs DELETED)
  - `game/src/core/battle/Playtest.continuousCombat.test.ts` (DELETED)
  - `game/src/core/battle/Battle.ts` (lavaZones/swordZones fields removed)
  - `game/src/core/game/GameManager.ts` (shim removal) + kiemTuWiring test
  - `game/src/core/game/StageWaveSystem.ts` (dead loop removal)
  - `game/src/core/game/StageWaveSystem.spawnTelegraph.test.ts` (DELETED)
  - `game/src/data/progression/PhapTuNodes.dao.test.ts` (import re-point)

## Scope and Risk Map

Deletion-heavy change. Every removed prod behavior was verified dead before
deletion (survey in spec): no prod caller of battleSystem.update(),
stageWaves.update(), resolveBossSummons(), setArtifactRuntime,
setChainDefinition since Slice 6. Risk bounded per-invariant below.

## Invariant Ledger

| ID | State/owner | Action | Invariant | Attack operator | Observable oracle | Test layer | Priority |
|---|---|---|---|---|---|---|---|
| INV-C1-1 | Battle start | startBattleWithPlayer/startBattle | Single engine: TurnBattle created, no legacy mirror; Kiếm resources still init'd (KT reset, BK seed permanent) | Missing collaborator (removed battleSystem.start) | kiemTuWiring test: currentKiemYTemp === 20 via turn player entity | Integration | High |
| INV-C1-2 | getBattle() consumers (7 UI sites + tests) | Read battle state/player/enemies | Compatibility: cast TurnBattle still exposes state/player/enemies/null-when-idle | Stale shape | type-check + full suite + mvpLoop/enemyClear/repeatStage tests pass | Unit + type-check | High |
| INV-C1-3 | abandonBattle | Player exits mid-fight | Behavior preserved: turnActive gate sets defeat, stage released, repeat stopped | Missing legacy branch | existing abandon tests pass | Unit | High |
| INV-C1-4 | Rewards | grantBattleRewardIfNeeded | Exactly-once: turn path unchanged; legacy fallback removed (no turn battle = nothing to grant) | Missing collaborator | existing reward tests pass | Unit | High |
| INV-C1-5 | Persistent buffs (Kiếp Thương) | applyPersistentBuff outside battle | Targeting: entity source = turn player when battle active, else caller stats, else ghost | Stale state | existing dotPha/talent tests pass | Unit | High |
| INV-C1-6 | Stage unlock/repeat | startStage + repeat flow | Behavior preserved: isStageUnlocked gate, stopRepeat on abandon/defeat | Missing collaborator | repeatStage/introPhase/stageProgress tests pass | Unit | High |
| INV-C1-7 | Import graph | Post-deletion compile | Recoverability: zero references to battle/legacy remain | Broken import | type-check 0 errors + grep 'battle/legacy' → 0 | Type-check + grep | High |
| INV-C1-8 | PhapTuNodes.dao | PHAP_TU_ULTIMATE_IDS source | Synchronization: same data, correct module | Drift | dao test passes (same assertions, new import path) | Unit | Medium |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
|---|---|---|
| `grep battle/legacy` after deletion | 0 matches in src (only doc/git-history references) | |
| Full suite (worktree) | **2841/2841 pass, 413 files** (33 legacy-pinned tests retired with the engine) | |
| `npm run type-check` | 0 errors | after each surgical step |
| `npm run build` | BUILD OK | final gate |
| mvpLoop / enemyClear / repeatStage / stageProgress / talentv4 / introPhase / dotPha / artifactGradeUpgrade suites | all pass within full run | consumer compatibility (INV-C1-2..6) |

## Findings

### Suspected (non-blocking)

1. **Artifact combat remains inert in real gameplay** (pre-existing since
   Slice 6, NOT caused by C1 — C1 removes the dead driver). HUD reads
   `getBattle().artifactRuntime` → EMPTY state as before. Turn-side
   artifact implementation is a separate future feature; flagged in
   roadmap 10.4.
2. `core/battle` modules only legacy consumed (`SkillEffectResolver`,
   `ChainStateSystem`, `EnemyAttackSystem`, `PhapTuBattleResourceSystem`,
   `KiemTranOnHitSystem` partially) remain in place per spec scope —
   candidates for a follow-up dead-code pass (C-phase hygiene).
3. `syncLegacyBattleState` kept as a no-op because
   CombatAnimationRuntime's deps contract still references it; the
   contract field can be dropped in a later touch.

### Confirmed: none.

## New or Changed QA Tests

- `GameManager.kiemTuWiring.test.ts` test 1 rewritten: asserts
  `getTurnBattle().players[0].entity.currentKiemYTemp === 20` through the
  live turn battle (was: legacy mirror battle.player).

## Gaps and Residual Risk

- None material. Deletion completeness proven by type-check + grep + full
  suite. P14 not triggered (no rendering/interaction change; combat
  visuals flow through the unchanged entity-snapshot event path).

## Pre-existing Failures

None — full suite green before and after on this branch.
