# QA Review: pc-tag-system branch (feat/pc-tag-system)

- Date: 2026-09-12
- Mode: quick
- Verdict: PASS WITH GAPS — one Confirmed defect (design-level) found during review, escalated to the user, fixed on the branch with a user ruling; P14 browser check deferred (isolated worktree).
- Task-owned paths: `game/src/core/enemy/{EnemyTag,Enemy}.ts`, `game/src/data/enemy/EnemyTags.ts`, `game/src/data/stage/{ChapterStages,Stages}.ts`, `game/src/core/game/{StageWaveSystem,GameManagerTurnBattleOps}.ts`, `game/src/core/battle/turn/TurnBattleSystem.ts` (round counter), `game/src/core/stage/{Stage,EffectiveEnemyCount}.ts`, `game/src/core/dev/enemySpawnDebug.ts`, `game/src/App.vue`, `game/src/components/panels/StageSelectPanel.vue`, locales, plus task-owned `*.test.ts`.

## Scope and Risk Map

Mapper output: 3 domains (combat-and-tribulation, economy-and-progression, ui-input-lifecycle), `deepAuditCandidate: true`, 11 unmapped paths (stage data/builder, spawn system, dev helper, art tier prose).

Escalation decision: stayed quick. No new persisted state (`perfectClearStageIds`/`perfectClearSeconds` already exist and are save-covered); `roundsElapsed`/`actedThisRound` live on the in-memory `TurnBattle` only. The spawn change is a one-owner swap (`createEliteVariant` → `applyEnemyTags`) with characterization + seeded tests; boss path untouched. Idle rate/gate/cap untouched (D6). The plan's six mandatory hypotheses (a)-(f) were each exercised below.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
|---|---|---|---|---|---|---|---|
| INV-PC-1 (hyp. a) | `perfectClearStageIds`/`Seconds` / TurnBattleOps | second qualifying clear; already-PC stage cleared normally | Once-only: first record never overwritten or removed | Repeat | B4 cases | `GameManager.perfectClear.test.ts` (6 new cases) | High — resolved; save round-trip of a recorded PC not separately re-tested (field pre-existing, covered by SaveRoundTrip) |
| INV-PC-2 (hyp. b) | `eliteChance` roll / StageWaveSystem | forced hit / forced miss | Tag attaches through `rollChance` owner only | Value mutation (Math.random 0 / 0.99) | prefix, `isElite`, maxHp x2.5 | `GameManager.bossRepeatCycle.test.ts` | High — resolved |
| INV-PC-3 (hyp. c) | `allowTags` option / TurnBattleOps idle cycle | auto-farm cycle online + offline catch-up with forced hit | Idle never rolls tags | Timing boundary (channel) | every `pickEnemyForTurnSpawn` result untagged; both offline/online paths funnel through `rollAutoFarmCycleReward` (lines 1511/1551 → 1562) | `GameManager.autoFarm.test.ts` + code path check | High — resolved |
| INV-PC-4 (hyp. d) | boss variant / StageWaveSystem | idle floor-10 final spawn, forced hit | Boss base, no tag; drop-system idle keeps boss modifier | Timing boundary | `isBoss`, no `Tinh Anh` prefix, maxHp x7 | `GameManager.bossRepeatCycle.test.ts` (idle floor-10 case) | High — resolved |
| INV-PC-5 (hyp. e) | `perfectClearTurnLimit` / builder + predicate | best-case flawless run on real floor shapes | Reachability: a flawless run CAN record PC on every floor | Boundary (best case) | measured `totalTurnsElapsed`/`roundsElapsed` at victory vs limit | `GameManager.perfectClear.feasibility.test.ts` | **Confirmed defect — fixed (see Findings)** |
| INV-PC-6 (hyp. f) | dev helper / App.vue | production build | No debug surface in `dist/` | Environment | `grep __tutienEnemySpawnDebug dist/assets/*.js` → no match | build artifact | Low — resolved |
| INV-PC-7 | boss + tag stack / StageWaveSystem | active floor-10 forced hit | Stack = x7 x2.5, both flags, both prefixes | Value mutation | name/flags/maxHp | `GameManager.bossRepeatCycle.test.ts` | Medium — resolved |
| INV-PC-8 | `bossEnemyId` floors 1-9 | UI badge | Truthful metadata: badge only on floor 10 | Data | StageSelectPanel badge absent on floor 1, present on 10 | `StageSelectPanel.test.ts` | Low — resolved |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
|---|---|---|
| `npm run type-check` | 0 errors | |
| `npm run build` | success | chunk-size warnings only; `dist/` has no `__tutienEnemySpawnDebug` |
| `npx vitest run` (full, before the rounds fix) | 507 files / 3412 tests, 1 pre-existing flake (`TurnBattleSystem.selfBuff.qa.test.ts`, passes 3/3 isolated) | |
| Feasibility probe, actor-action limit 3/5 | floors 1/5/9 best case 32/69/67 actions, PC never recorded; floor 10 = 1 | `[QA-e]` console lines |
| Feasibility, rounds, limits 20/24/28/15 | best case 8/15/18/0 rounds, 3-hit 14/16/21/12 — all 8 record PC | permanent guard `GameManager.perfectClear.feasibility.test.ts` |
| Round counter unit | 4/4 (dedupe, dead excluded, mid-round spawn joins) | `TurnBattleSystem.rounds.test.ts` |
| `npx eslint .` | 4 pre-existing errors in untouched files (`scripts/patch-t14.cjs`, `Skills.chain.test.ts`, `tests/e2e/reduced-motion.spec.ts`) | not task-caused |

## Findings

### QA-2026-09-12-003: Fixed perfect-clear limit 3/5 unreachable on floors 1-9
- Severity: High (feature-dead: PC chip and the idle auto-farm gate could never open on 27/30 stages)
- Status: Confirmed → fixed with user ruling
- Repro: `GameManager.perfectClear.feasibility.test.ts` — a one-shot player vs 1-HP, 0-damage enemies on builder floors 1/5/9 needed 32/69/67 actor actions; limit was 3.
- Root cause: spec v3 closed "turn" as one actor action (including enemy actions) and fixed X=3 without a feasibility measurement; waves spawn sequentially and every living enemy acts between player actions, so the count scales with enemy count (10-18).
- Fix (user decisions): count ATB rounds (`TurnBattle.roundsElapsed`, a round closes when every living participant has acted once); limit = `totalEnemyCount + 10` on floors 1-9, `15` on the boss floor. Both variants of the guard now record PC on every measured floor.
- Note: on master the field was unset on every stage, so PC was already dead there; this branch is the first time it can fire.

## New or Changed QA Tests

- `src/core/game/GameManager.perfectClear.feasibility.test.ts` (new, permanent guard with measurement lines)
- `src/core/battle/turn/TurnBattleSystem.rounds.test.ts` (new)
- `src/core/game/GameManager.bossRepeatCycle.test.ts` (+5 spawn-mode cases), `GameManager.autoFarm.test.ts` (+1 idle-no-tag), `GameManager.perfectClear.test.ts` (+6 B4), `StageSelectPanel.test.ts` (badge moves to floor 10), `Stages.test.ts`, `ChapterStages.test.ts` (builder rules)

## Gaps and Residual Risk

- P14 live-browser check deferred (isolated worktree): StageSelect boss badge only on node 10, encounter summary without spawn interval, PC chip after a real clear, `__tutienEnemySpawnDebug` in dev console. Run from the main checkout after merge.
- `perfectClearSeconds` round-trip through save after a first PC not re-tested here (pre-existing field/coverage).
- The +10 margin / boss 15 are first-cut release values from a dummy-enemy measurement; real enemy HP/attack will push rounds higher than the 3-hit variant on high floors — playtest flag.

## Pre-existing Failures

- `TurnBattleSystem.selfBuff.qa.test.ts` chance-based flake (known class), not task-caused.
