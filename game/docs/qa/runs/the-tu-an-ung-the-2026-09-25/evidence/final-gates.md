# EV-TTA-FINAL-GATES — final gates on head 2b83ac2d (product pin 071984c2)

- `npm run type-check` (vue-tsc --build): exit 0, clean.
- `npx vitest run src/core/battle/turn src/core/battle/runtime src/core/the-tu`: 90 files / 813 tests, ALL PASS.
- CLN12 pending fixes verified in-tree:
  - F-TTA-CLN12-COR-2: troFollowUp.test.ts:332 '(outcome evaded)' + :353 premium trong_phan_kich pin present.
  - F-TTA-CLN12-AUT-1: comments reference resolvePhanWindow (TBS:2505, TurnSkillPlanRuntime:519), no stale resolveTakenWindow.
