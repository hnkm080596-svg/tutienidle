# QA Review: beta stage roster lock (Phase-4)

- Date: 2026-09-30
- Mode: quick
- Verdict: FAIL — the task-owned diff itself verified clean (funnel,
  census, uniform-resistance, read-model delegation all proven), but
  QA-2026-09-30-ROSTER-1/2 are Confirmed SOURCE_PROOF defects *caused
  by* the roster lock: kill quests and family-exclusive equipment
  pointing at now-unspawnable species. Legitimacy note: the lock
  REQUIRES dormant species to be unreachable, so the defect is the
  dangling references in quest/drop data — outside this phase's write
  scope (stage domain). The fixes belong to the content-owner phase /
  coordinator adjudication; the it.fails repro pins them.
- Task-owned paths:
  - `game/src/data/stage/ChapterStages.ts` + `ChapterStages.test.ts`
  - `game/src/data/stage/Stages.ts` + `Stages.test.ts`
  - `game/src/data/stage/BetaStageRoster.test.ts` (new)
  - `game/src/core/stage/StageSpawnableEnemies.ts` (new)
  - `game/src/core/game/StageWaveSystem.ts`
  - `game/src/core/enemy/EnemyStatInput.ts` + `EnemyStatInput.test.ts`
  - `game/src/data/enemy/MortalEnemies.ts`, `FoundationEnemies.ts`
  - `game/src/core/game/GameManagerStageOps.ts` + `.test.ts` (new)
  - `game/src/core/game/GameManagerAutoFarmOps.ts`
  - `game/src/core/game/GameManager.ts`
  - `game/src/core/game/TemplateRegistry.ts`
  - `game/src/components/panels/StageSelectPanel.test.ts`
  - `game/src/core/game/GameManager.verticalSlice.test.ts`
  - `game/src/core/game/GameManager.hiddenChannel.test.ts`
  - `game/src/core/game/GameManager.perfectClear.feasibility.test.ts`
  - `game/src/core/simulation/earlygame/EarlyGameSession.test.ts`
  - `game/src/data/quest/quests.betaRoster.qa.test.ts` (new, QA allowlist)
  - `game/docs/design/2026-09-30-beta-stage-roster-audit.md`
  - Exclusions: none (all dirty paths are task-owned).

## Scope and Risk Map

Changed systems: stage pool authoring (ChapterStages builder + the 3
chapter literals), spawn funnel gate (StageWaveSystem), boss stat
multiplier + authored boss resistances, a new additive read-model
ops class, registry `getAll`, auto-farm eligibility exposure.

Mapper output: domains combat-and-tribulation, economy-and-progression,
pinia-phaser-sync, time-and-offline; `deepAuditCandidate: true` on
"critical state boundary: time-and-offline". Escalation decision: NOT
escalated — code inspection bounds the risk confidently. The diff
touches no save shape, no clock/offline accrual, no persistence
boundary, no Pinia store shape, and no Phaser lifecycle; the mapper's
time-and-offline hit is adjacency of `GameManagerAutoFarmOps.ts`
(reads `perfectClearSeconds`, unchanged semantics — the new
`isAutoFarmStageEligible` reuses the existing `resolveValidAutoFarmStage`
guard verbatim). The one materially cross-system consequence found
(quests referencing now-unspawnable species) is recorded as findings.

Loaded packs: combat-and-tribulation, economy-and-progression.
Ledger rows consulted: QA-2026-09-12-009 (gate preservation when
migrating into pools — here the direction is narrowing + funnel
gating; verified no per-entry gates were lost because pools never
had them), QA-2026-09-12-011 (feasibility probe for authored numeric
thresholds — the new eliteChance ramp is a probability, reachability
vacuous), QA-2026-09-13-002 (asymmetric numeric guard — the exposed
eligibility read shares the existing guarded function).

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-ROSTER-1 | Stage pools / ChapterStages+Stages | Any spawn from any stage | Funnel: spawned identity ∈ stage's declared set | Value mutation (all 30 stages × final/non-final) | `pickEnemyForTurnSpawn` result ids | Vitest integration (`BetaStageRoster.test.ts`) | High — the core guarantee |
| INV-ROSTER-2 | Hidden beast / HiddenBeastSystem+StageWaveSystem | Primed kill window + forced substitution roll | A substitution may only surface a stage-declared id | Repeat + stale state (primed `hiddenBeastKills`, rng 0) | `huyet_mong` never returned on shipped stages; fixture weight-0 declaration still substitutes | Vitest integration | High — the only bypass producer |
| INV-ROSTER-3 | Boss stats / EnemyStatInput+data | `createBossVariant` on the 3 beta bosses | Uniform resistance across 5 elements | Cross-system chain (boss→combat defense) | `applyBossMultiplier` output + authored resistances | Vitest unit (`EnemyStatInput.test.ts`, `BetaStageRoster.test.ts`) | Medium |
| INV-ROSTER-4 | Stage catalog / Stages | Census | Exactly 3 chapters × 10 floors, 3 normals + 1 boss, 12 distinct ids | Enumeration | Catalog inspection assertions | Vitest unit | High |
| INV-ROSTER-5 | Read-model / GameManagerStageOps | Frontend reads stage surface | Read-model delegates unlock/start/farm authorities; no second rule | Stale state, reorder | Model fields vs authority outputs | Vitest integration (`GameManagerStageOps.test.ts`) | Medium |
| INV-ROSTER-6 | Quest kill credit / QuestSystem | Kill quests vs dormant species | Conservation: a completable quest needs a live kill source | Cross-system chain (stage roster → quest progress) | Spawnable-set membership per quest `enemyId` | Vitest (`quests.betaRoster.qa.test.ts`, it.fails) | High — found real defect |
| INV-ROSTER-7 | Equipment drop sources / FamilyDropTables | Family-exclusive equipment | Conservation: obtainable item needs a spawnable family | Cross-system chain | Family of each roster member vs exclusive pools | Source proof | Medium |
| INV-ROSTER-8 | Difficulty pacing / EarlyGameSession | Canonical loop under new pools | Boundedness of authored ramp | Value mutation (per-floor eliteChance) | Loop wall position characterization | Existing test re-pinned | Medium (balance flag) |
| INV-ROSTER-9 | Spawn internals / StageWaveSystem | Boss floor spawn order | Exactly-once: boss only on final spawn of floor 10 | Reorder (non-final vs final) | `pickEnemyForTurnSpawn` id + isBoss flag | Vitest integration | Medium |
| INV-ROSTER-10 | weightedRandom degenerate edge | weight-0 pool entries | Boundedness: weight-0 unreachable | Value mutation (rng 0, first entry) | Picked entry on degenerate roll | Source inspection + fixture test | Low |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` | clean | vue-tsc build, exit 0 |
| `npx vitest run` (full) | 7676 pass, 4 expected-fail, 4 task-fixed failures resolved | After re-pinning honest pins (panel species, reaction set, loop wall, ASCII comments); rerun of the 4 files green |
| Scoped vitest (stage/data + touched) | 80 pass + 4 expected fail | `src/data/stage/`, stageOps, hiddenChannel, EnemyStatInput, perfectClear.feasibility |
| `npx eslint <changed files>` | 0 errors, 0 warnings | After removing unused var in BetaStageRoster.test |
| Adversarial spawn probe | all 30 stages × {final,non-final} → only roster ids; `huyet_mong` never returned even with primed kills + rng 0 | `BetaStageRoster.test.ts` "adversarial funnel" block |
| Source audit of spawn producers | `pickEnemyForTurnSpawn` is the only stage spawn factory; `createBossVariant` only at StageWaveSystem:245; `activeStagePlayer` only set inside active `start()` (cleared at 140/165), so idle farm cannot substitute | grep call sites + code read |
| Quest kill matching | `onEnemyDefeated` compares template id exactly; tribulation excluded; hidden channel emits only `huyet_mong` | `QuestSystem.ts:344-371`, `BattleLootSystem.ts:421-428` |

## Findings

### QA-2026-09-30-ROSTER-1: three kill quests can never complete under the locked roster

- Severity: Medium
- Status: Confirmed (SOURCE_PROOF)
- Invariant: Conservation — a completable quest requires a live kill source
- Preconditions: any player reaching the relevant realm with the quest active
- Reproduction: `src/data/quest/quests.betaRoster.qa.test.ts` — the `it.fails`
  assertion lists `daily_kill_bandit_15` (`bandit`),
  `kill_foundation_stone_15`-family entries
  (`kill_foundation_stone_fungus_15` → `foundation_stone_fungus`,
  `kill_foundation_flood_dragon_whelp_10` → `foundation_flood_dragon_whelp`)
  whose enemyIds appear in no stage spawnable set.
- Expected: every explicit kill target is spawnable somewhere in beta.
- Actual: `bandit` (daily, 200 cultivation), `foundation_stone_fungus`
  (once, 120 skillInsight), `foundation_flood_dragon_whelp` (once, 200
  skillInsight) are dormant — kill credit matches template id exactly
  (`QuestSystem.onEnemyDefeated` line 361), no other producer emits them,
  and the hidden substitution can only surface stage-declared ids.
- Evidence: `quests.betaRoster.qa.test.ts` (it.fails repro), grep census
  of spawnable ids vs `quests.ts` kill conditions.
- Test file: `game/src/data/quest/quests.betaRoster.qa.test.ts`
- Owner subsystem: quest content data (`src/data/quest/quests.ts`) —
  NOT stage domain; retarget/remove is a content-phase decision.
- Blast radius: 3 stuck quest entries (1 daily income + 2 once rewards);
  no progression gate — stages don't require quests.

### QA-2026-09-30-ROSTER-2: three equipment bases lose their only drop source

- Severity: Low
- Status: Confirmed (SOURCE_PROOF)
- Invariant: Conservation — an obtainable item needs a spawnable drop source
- Preconditions: player farming for equipment drops
- Reproduction: `FamilyDropTables.ts` — `base_quan` exclusive to
  `magma_boar`, `base_hai` to `rock_bear`, `base_gioi` to `metal_beetle`;
  all three families are dormant under the roster.
- Expected: helmet/boots/ring bases remain reachable (or the exclusion
  is a conscious scope decision).
- Actual: no spawnable enemy carries those families. `base_truy`
  survives via roster boss `ferocious_flood_serpent` (family
  `flood_serpent`); `base_kiem` is covered by the mortal stage table.
- Evidence: `FamilyDropTables.ts` entries + roster family census.
- Test file: none (design adjudication needed — equipment sinks may be
  remapped in the balance phase rather than restoring families)
- Owner subsystem: drop-table/equipment data.
- Blast radius: 3 equipment bases unobtainable in beta.

## New or Changed QA Tests

- `game/src/data/quest/quests.betaRoster.qa.test.ts` — inventory pin +
  `it.fails` repro of QA-2026-09-30-ROSTER-1. Proves uncompletability
  by checking each explicit kill target against the union of shipped
  spawnable sets.

## Gaps and Residual Risk

- UI shows dormant quest names/descriptions referencing unspawnable
  species (`Sơn Tặc`, `Địa Tinh Giám`, `Giao Sủng` non-boss) until the
  owning phase retargets — flagged, not fixed (outside stage domain).
- `huyet_mong` is unreachable in beta (intended): its ×12
  `tinh_hoa_pham_the` catch-up valve closes; the mortal stage table
  remains the primary source (PerfectionEconomy.ts:176), so body
  refinement stays funded.
- EliteChance ramp 5%→21% and pure band-B pools made floor 4+ harder:
  EarlyGameSession canonical wall moved mortal_dong_5 → mortal_dong_4.
  Characterization re-pinned honestly; flagged for the Phase-8 balance
  matrix rather than treated as a defect (difficulty scaling via
  modifiers is the work-order intent).
- Stale comment in `StageDropTables.ts:59-60` still lists the old
  species mix (doc-only, Nit — not a runtime concern).

## Pre-existing Failures

- None observed in the audited surface. The 4 initially failing tests
  (asciiComments, StageSelectPanel, verticalSlice, EarlyGameSession)
  were task-caused pins and were re-pinned/fixed, not pre-existing.
