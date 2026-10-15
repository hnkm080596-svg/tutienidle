# Default party standing position - 2026-10-14

User ruling: put the default main character at the center standing slot of the player-side 3x3 grid. Use the same standing-slot mapping as FormationPlacement; preserve target selection rules.

Root cause: DEFAULT_PARTY_FORMATION retained legacy HERO_LANE_INDEX=4, while regular enemy standing rows are 3/5/7. selectTarget correctly preferred exact same-row living targets, but the default actor had no matching regular-enemy row.

Change: default formation resolves standingSlotPosition(PLAYER_SIDE_REGION, centerSlot, centerSlot), currently row 5 / column 2. GameManagerTurnBattleOps continues to apply the admitted build formation. Configured loadouts and Beta feature gates remain unchanged. Existing active battle participants are not repositioned; new battle construction consumes the corrected default.

Evidence: type-check passed. Five relevant Vitest files, 49 tests passed. Regression verifies the default player chooses a farther enemy in the middle standing row ahead of a nearer enemy in another standing row. Formation mapping and build/placement integration tests passed. Diff whitespace check passed. No full QA, commit or push performed.

Follow-up closure: shared DEFAULT_PLAYER_STANDING_POSITION in BattlefieldRegions drives both default formation and legacy presentation aliases. companionToCombatEntity now requires its admitted GridPosition at construction; CombatBuild passes the formation slot directly. No transient row-4 companion entity remains. Additional tests cover all three companion standing rows and presentation alias parity. Eight focused suites, 68 tests passed; type-check passed. x2 investigation identified that speeding visual ACKs also speeds turn resolution; cadence semantics require an explicit ruling before altering this maintained contract.
