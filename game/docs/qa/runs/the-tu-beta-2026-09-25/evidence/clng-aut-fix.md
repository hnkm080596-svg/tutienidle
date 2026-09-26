# EV-TT-CLNG-FIX — cleanG AUT fixes @996dbffd

Reviewer af8bbe62 (AUT lens, cleanG on c80530ad) reported FINDINGS:

1. Medium — P15 em-dash sweep left Vietnamese comment token -> asciiComments guard FAILS.
   Fix: useTurnBattleInfo.ts docblock rewritten plain ASCII ("Same stateVersion pattern as useTurnCombatManual").
   Verify: `npx vitest run tests/architecture/asciiComments.test.ts` PASS; scoped 606/606 green.
2. Low — diff-introduced dead imports/vars after inBattle refactor.
   Fix: removed unused isBattleInProgress import (GameManagerProgressionOps.ts:34);
   removed unused gameManager/stateVersion consts (CharacterPanel.vue); stateVersion -> bumpState-only destructure (NativeCoreDetail.vue).
   Verify: `npx eslint` on touched files = 0 errors (remaining warnings pre-existing).
3. Low — missing-HP scalar formula duplicated legacy vs plan lanes -> REJECTED_WITH_PROOF
   (pre-existing at merge-base; adapter declares intentional dual-lane parity).

npm run type-check: clean.
