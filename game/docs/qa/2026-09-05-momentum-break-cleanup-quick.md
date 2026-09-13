# QA Review: MomentumBreak dead-code cleanup

- Date: 2026-09-05
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Worktree: `E:/tutienidle/.agent-worktrees/roadmap-independent-cleanup`
- Branch: `chore/roadmap-independent-cleanup`
- Task-owned paths: `game/src/core/battle/turn/MomentumBreak.ts` (deleted), `MomentumBreak.test.ts` (deleted), `MomentumBreak.adversarial.test.ts` (deleted), and `TurnQueue.ts` (comment only).

## Scope and Risk Map

The risk mapper routes all four paths to combat-and-tribulation, with no unmapped paths and `deepAuditCandidate: false`. The retired module has no production consumers or side effects. Its two deleted tests exclusively exercise the retired mechanic. `TurnQueue` executable code is unchanged; its direct consumers are `TurnBattleSystem` and `TurnOrderPreview`.

No live combat, reward, persistence, or scene lifecycle transition changes. Deep escalation is not warranted for this isolated deletion. The active `feat/turn-defect-fixes` and `worktree-gp123` work is excluded; no fixes or integration from either branch are part of this report. No matching MomentumBreak/turn-queue entry was found in the learned-defect ledger.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-MB-1 | Source dependency graph | Delete abandoned module | No live caller loses its dependency | Interruption/removal | No remaining module/symbol references; type-check succeeds | Static + compiler | High: missing imports could block boot |
| INV-MB-2 | TurnQueue | Resolve empty, dead, zero/negative-speed actors | Queue remains bounded and preserves selection behavior | Value mutation | Existing queue tests return null or correct actor | Unit | Medium: queue must not stall |
| INV-MB-3 | Turn battle/preview | Resolve turns and preview order after deletion | Existing turn resolution and preview remain unchanged | Reorder | TurnBattleSystem and TurnOrderPreview tests pass | Unit/domain | Medium: combat order remains intact |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| Baseline `npm.cmd run type-check` + focused MomentumBreak, TurnQueue, termGlossary tests | PASS | 4 files, 15 tests before deletion |
| Post-change `npm.cmd run type-check` | PASS | No missing import/type errors |
| `npx.cmd vitest run src/core/battle/turn/TurnQueue.test.ts src/core/battle/turn/TurnBattleSystem.test.ts src/core/battle/turn/TurnBattleSystem.charge.test.ts src/core/i18n/termGlossary.test.ts` | PASS | 3 matched files, 70 tests; `TurnBattleSystem.charge.test.ts` did not match a file and is not claimed as coverage |
| `npx.cmd vitest run src/core/battle/turn/TurnQueue.adversarial.test.ts src/core/battle/turn/TurnOrderPreview.test.ts` | PASS | 2 files, 5 tests; zero/negative speed and preview checks |
| Search `game/src` for MomentumBreak and retired exported symbols | PASS | No retired module/symbol consumers remain |
| `git diff --check` | PASS | Only line-ending normalization warning from Git |

## Findings

No confirmed defect or unresolved material hypothesis in this deletion-only scope.

## New or Changed QA Tests

None. Existing live queue/adversarial/preview tests are retained. Tests of the retired mechanic were deleted in development workflow, before QA began.

## Gaps and Residual Risk

No build, full-suite, browser, or active-worktree integration claim. P3 mode is quick. This report establishes the safety of dead-code removal, not general combat readiness. No new mechanic or runtime fix was introduced, so no new red/green reproduction test is applicable.

Final coordination check: `feat/turn-defect-fixes` was merged into master at `b4d7ce9` and its branch/worktree removed during this session. `git diff --name-only HEAD..master` shows no overlapping code paths with this cleanup; `game/docs/roadmap.md` is shared documentation and requires preserving both updates at integration. Tests here ran on this worktree's `aef0b8a` base, not the newer master. No integration was performed.

## Post-simplify Code Review

- Verdict: Approve for the task-owned cleanup; no unresolved findings at confidence >=80.
- Removed functions have no side effects at module load and no surviving source consumers. Deleted tests exclusively cover the retired mechanic; live queue and preview coverage remains.
- Final comment wording describes only the bounded queue guard, without assuming that current CC mechanics set speed to zero.
- No security boundary, dependency, public store/service API, gameplay balance, or executable queue code changed. Simplifier pass required no runtime refactor.

## Pre-existing Failures

None encountered in the focused baseline or post-change checks. Broader playback/E2E issues recorded in the roadmap were not retested or changed.
