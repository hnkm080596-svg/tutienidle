# QA Review: GameManager Task 9 restoration

- Date: 2026-09-02
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths: `game/src/core/game/GameManager.ts`

## Scope and Risk Map

The requested action restored only `GameManager.ts` from the saved Task 9 artifact `.superpowers/sdd/2026-09-01-item-grade-quality-rework/task-9-fix4-working-tree.diff`. The path-level mapper classified `GameManager.ts` as a broad hotspot spanning combat, economy/progression, Pinia/Phaser, and time/offline, with a deep-audit candidate. Manual diff inspection bounded the restored hunks to equipment Wash/Refine facade signatures and costs, unified dissolve-preview rewards, and registry-reference preflight during save restore. No combat loop, clock/offline, scene lifecycle, or Pinia ownership code was restored by this action.

Deep escalation was not required for this recovery operation because it introduced no new Task 9 semantics: an exact reverse-patch check proves the previously reviewed artifact is present, and focused transaction/boot regressions exercise the restored boundaries. Incomplete Task 10 edits in `EquipmentSystem.ts` and `ItemRoll.test.ts` were explicitly excluded.

One-hop consumers inspected or exercised were `EquipmentSystem`, equipment/material bags, the Refine/Wash action facade, and the save boot/restore handoff.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-GM9-1 | Saved Task 9 artifact / `GameManager.ts` | Restore the accidentally reverted file | Determinism: restored GM equals the recorded Task 9 patch | Artifact replacement/reversion | `git apply --reverse --check` succeeds for only `GameManager.ts` | Repository check | High: prevents mixed old/new APIs |
| INV-GM9-2 | Equipment and material owners via `GameManager` | Preview/commit Refine or execute Wash | Atomicity/conservation: rejected or accepted transactions preserve the Task 9 debit and mutation contract | Missing/stale preview and transaction boundary cases in focused suites | Transaction tests observe result, item state, and costs | Vitest integration | High: paid equipment actions |
| INV-GM9-3 | Save owners and runtime registries | Boot/restore current equipment data | Recoverability: unknown registry references fail before restore-owner mutation | Unknown template/affix during boot restore | Boot-restore regression observes controlled rejection and owner state | Vitest integration | High: persistent player state |
| INV-GM9-4 | Worktree compiler boundary | Compile restored GM against current dirty worktree | Synchronization: remaining diagnostics must be attributable to excluded incomplete Task 10 edits | Cross-task API skew | Diagnostic locations and missing Task 9 exports/methods | Type check | Medium: worktree cannot globally compile yet |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `git apply --reverse --check --include=game/src/core/game/GameManager.ts .../task-9-fix4-working-tree.diff` | Passed, exit 0 | Exact Task 9 GM patch is present |
| `npm.cmd run test -- src/core/game/GameManager.refineTransaction.test.ts src/core/game/GameManager.washTransaction.test.ts src/services/save/SaveSystem.bootRestore.test.ts` | Passed: 3 files, 7 tests | Covers restored Refine, Wash, and save boot boundaries |
| `npm.cmd run type-check` | Failed: 8 diagnostics | All diagnostics correspond to excluded, incomplete Task 10 API changes in `EquipmentSystem.ts`/`ItemRoll.test.ts`; one is surfaced at the Task 9 GM call to the Task 9 `getMaxEnhanceLevel` contract |

## Findings

No confirmed defect was found in the restored Task 9 `GameManager.ts`.

## New or Changed QA Tests

None. Existing focused regressions supplied conclusive oracles for the recovery scope.

## Gaps and Residual Risk

The complete worktree cannot pass type-check until the partial Task 10 edits are either completed or rolled back. This prevents a global green compiler verdict, but does not contradict restoration fidelity or the focused Task 9 regression results.

## Pre-existing Failures

`npm.cmd run type-check` reports eight diagnostics caused by the excluded partial Task 10 state: a two-argument call mismatch in `EquipmentSystem.ts`, removal of `getMaxEnhanceLevel`, removal of two scale exports, and four old two-argument `calculateEquipmentScale` test calls.
