# Balance Note — 2026-10-15: Ruling R1 Default Standing Position (Row 5) & Mortal Floors 8–9 Scale Tuning

## Context & Root Cause
Commit `f831335f3` changed `DEFAULT_PLAYER_STANDING_POSITION` in `game/src/core/battle/grid/BattlefieldRegions.ts:62-66` from `{ col: 2, row: 2 }` to `{ col: 2, row: 5 }` (matching the boss row).

Under `TurnBattleSystem.selectTarget`, same-row targets are prioritized over other rows. Standing at row 5 therefore prioritizes the row-5 boss over row-2/row-8 adds during `mortal_dong_8..10`, which increased incoming add pressure on fresh unequipped Mortal characters at floors 8–9.

## Ruling R1 Decisions (2026-10-15)
1. **Keep `DEFAULT_PLAYER_STANDING_POSITION` at `{ col: 2, row: 5 }`.**
2. **Adjust `MORTAL_CHAPTER.floorStatScales` for Mortal floors 8–9 in `game/src/data/stage/Stages.ts`**:
   - Before: `[1.0, 1.0, 1.3, 1.55, 1.85, 2.15, 2.45, 2.7, 3.0, 3.6]`
   - After:  `[1.0, 1.0, 1.3, 1.55, 1.85, 2.15, 2.45, 2.6, 2.85, 3.6]`
   - Validated across the canonical `EarlyGameSession` seed (`424242`) and a 20-seed deterministic sweep (`100001..100020`): 21/21 seeds clear `mortal_dong_8..10` and reach `qi_refining` within the canonical attempt budget, while preserving the Mortal chapter stat-wall progression (`2.45 < 2.6 < 2.85 < 3.6`).
3. **Update `BalanceMatrix.test.ts` `*/multi_enemy` per-seed fingerprints**:
   - All 24 single-enemy cells (`single_target`, `durable_target`, `burst_pressure`, `attrition` across all 6 recipes) remain byte-identical.
   - Only the 6 stage-backed `*/multi_enemy` cells changed fingerprints because stage battles read `defaultPartyFormation()` (row 5).
   - Every balance gate (`dominance`, `strengths`, `stalemates`, `deadlocks`, `secondaryDominance`) continues to pass unchanged.
