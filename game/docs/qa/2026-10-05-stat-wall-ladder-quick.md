# QA Review: stat-wall ladder retune (per-floor statScale + drop-table ore fix)

- Date: 2026-10-05
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths:
  - game/src/core/stage/Stage.ts
  - game/src/data/stage/ChapterStages.ts (+ ChapterStages.test.ts pin added in QA)
  - game/src/data/stage/Stages.ts
  - game/src/core/enemy/EnemyStatInput.ts
  - game/src/core/game/StageWaveSystem.ts
  - game/src/data/drop/StageDropTables.ts
  - game/src/core/simulation/earlygame/{EarlyGameLoop.ts,StatWall.test.ts,ElementBossMatrix.test.ts,TrucCoJourney.test.ts}

## Scope and Risk Map

changed-risk-map.mjs routed EnemyStatInput.ts to combat-and-tribulation;
the other 9 paths are unmapped — manual routing: StageWaveSystem.ts is the
single spawn authority for idle + turn + auto-farm paths
(GameManagerAutoFarmOps.ts:365 calls pickEnemyForTurnSpawn);
StageSystem.pickNextEnemyEntry has exactly one caller inside
pickEnemyForSpawn (returns the weighted entry BEFORE stamping — no
bypass). Stage.ts/ChapterStages.ts/Stages.ts are the data contract +
ladder tables (combat-and-tribulation). StageDropTables.ts crosses into
economy-and-progression (ore id -> enhance affordability).
Sim files are leaf test harnesses (no consumers).
deepAuditCandidate: false; risk confidently bounded by code inspection —
no escalation.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-SW-1 | Enemy stats / StageWaveSystem | spawn on a scaled floor | scale applied exactly once, on every spawn path | Reorder (all 5 return sites incl. elite/hidden) | spawned maxHp/might numbers | Vitest (StatWall.test) | High — the feature itself |
| INV-SW-2 | Shared registry templates / EnemySystem | repeated spawns | templates never mutated | Repeat, stale state | template stats after spawns | Vitest (StatWall.test) | High — silent corruption risk |
| INV-SW-3 | Stage config / ChapterStages | chapter definition | non-positive/non-finite scale rejected at config time | Value mutation (0, NaN, short array) | throw on defineChapterStages | Vitest (new pin) | Medium — latent config bug |
| INV-SW-4 | Ore drop / StageDropTables | foundation band roll | dropped ore must be spendable by that realm's enhance | Cross-system chain (drop -> enhance cost) | enhance consumes dropped ore | Vitest (TrucCoJourney) | High — impossible-wall bug fixed |
| INV-SW-5 | Spawn authority | every consumer of stage.enemyPool | no spawn path bypasses the scale | Cross-system chain | grep census of pool readers | source | High — a bypass erodes the wall silently |
| INV-SW-6 | Battle determinism / sessionRng | same seed re-run | identical outcomes | Repeat | pinned matrix outcomes | Vitest suite | Medium |
| INV-SW-7 | Boss floor / elite stack | 3% tinh_anh on floor-10 boss | still intended-hard, not impossible | Value mutation (extreme stack) | matrix/journey green | Vitest suite | Medium — see Finding 1 |
| INV-SW-8 | Persisted stage ids / SaveSystem | reload mid-ladder | scale is config, re-applied fresh; no migration | Interruption (reload) | completedStageIds-only persistence | source | Low |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run src/core/simulation/earlygame/StatWall.test.ts` | 3/3 green | spawn stamping + both bare-wall pins |
| `npx vitest run src/data/stage/ChapterStages.test.ts` | 25/25 green | new validation + stamping pins |
| `npx vitest run` (earlygame+stage+enemy+drop+game scope) | 165 files, 1224/1229 green + 4 expected-fail | 1 pre-fix flake fixed (elite rng roll in my pin, rng 0 -> 0.99) |
| `npm run type-check` | clean | — |
| BetaJourney + canonical loop | green, failedAt null | curated-build acceptance still clears all walls |
| One-hop consumer census (`pickNextEnemyEntry`, `enemyPool` readers) | single caller inside pickEnemyForSpawn | source |

## Findings

### QA-2026-10-05-001: tinh_anh elite stack on a floor-10 boss produces a 24.6k-hp engagement

- Severity: Low
- Status: Suspected
- Invariant: Boundedness/intended-difficulty — a 3% roll stacks
  elite x2.5 over boss x7 over floor scale 3.6 on mortal_dong_10
  (~24.6k hp vs ~9.8k for the plain king). Reachable but rare.
- Preconditions: elite-stack roll succeeds on the floor-10 boss.
- Reproduction: source-level multiplication is unambiguous; no sim
  failure observed because the roll is rare and the matrix/journey
  clears the plain boss.
- Expected: a rare over-budget fight, still intended under 'hard gate'.
- Actual: same — no oracle contradicts intended behavior.
- Evidence: source math + green suite; Suspected because no dedicated
  sim run targets this exact stack.
- Test file: none (a dedicated stacked-boss sim could pin it)
- Owner subsystem: StageWaveSystem / data
- Blast radius: 3% of floor-10 boss runs; gameplay, not correctness.

### QA-2026-10-05-002: element x boss parity gaps (pinned defeats)

- Severity: High (design), not a code defect
- Status: Confirmed by executed sim cells
- Invariant: authored threshold must be reachable by the maxed
  intended-point build — 4/15 matrix cells (fire/serpent, wood/croc,
  wood/serpent, earth/serpent) pin 'defeat' at dia+20 + maxed attrs.
- Evidence: ElementBossMatrix console — wood x croc bossHpLeft=4496,
  wood x serpent=3346, fire x serpent=360, earth x serpent=776.
- Test file: ElementBossMatrix.test.ts (pin via EXPECTED_OUTCOME)
- Owner subsystem: element kit data / ladder data
- Blast radius: those element mains cannot carry the act gate solo —
  escalated to Minh in the balance doc + task report, NOT silently
  weakened.

## New or Changed QA Tests

- `game/src/data/stage/ChapterStages.test.ts`: +2 `it` blocks — statScale
  stamping map + rejection of non-10/non-positive/non-finite arrays.

## Gaps and Residual Risk

- Stacked-elite floor-10 boss (Finding 1) has no dedicated sim pin.
- Farm-run counts in the balance doc are RNG-dependent by design
  (organic drop model); knife-edge floors may flip ±a few runs.
- The "0 farm runs" rows in the doc mean "cleared with the previous
  floor's grind output", not "bare-stats clears" — bare-stats walls are
  separately pinned red-line in StatWall.test.ts.

## Pre-existing Failures

- None observed in scope (suite 1224 green; the earlier StatWall flake
  was task-caused and fixed during OCR).
