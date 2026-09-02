# QA Review: canUseItemGrade exact-grade contract

- Date: 2026-09-01
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `game/src/core/equipment/canUseItem.ts`, `game/src/core/equipment/canUseItem.test.ts`

## Scope and Risk Map

The risk mapper routes both task-owned paths to `inventory-equipment`, reports no unmapped paths, and does not request a deep audit. The mapper names player stats/combat loadout and economy/persisted ownership as inferred downstream risk domains; current-code inspection bounds this task to a pure lookup/equality contract with no state mutation, persistence, UI, or combat integration yet. Those integrations belong to Tasks 16-17 and are not inferred as passing here. Existing Task 1-2 dirty paths were excluded.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
|---|---|---|---|---|---|---|---|
| `INV-GATE-1` | Realm/grade mapping in `ProfessionGrade.ts` | Check an item grade against each player realm | Determinism: every one of the 10 exact mappings is accepted | Reorder/value mutation across all mappings | Boolean result for every literal mapping | Vitest unit | High: future equip gate authority |
| `INV-GATE-2` | Pure `canUseItemGrade` helper | Check adjacent and extreme mismatches | Boundedness: both lower and higher item grades are rejected | Boundary/value mutation | `false` for adjacent and Cửu↔Tiên cases | Vitest unit | High: prevents two-way gate bypass |
| `INV-GATE-3` | Pure helper with unmapped realm input | Resolve an unknown realm | Recoverability: missing mapping fails closed without mutation or throw | Missing value | `false` | Current-code inspection | Low: caller normally supplies a valid realm |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
|---|---|---|
| `changed-risk-map.mjs game/src/core/equipment/canUseItem.ts game/src/core/equipment/canUseItem.test.ts` | PASS | `inventory-equipment`; `deepAuditCandidate: false`; no unmapped paths |
| `npm.cmd run test -- src/core/equipment/canUseItem.test.ts` | PASS | 1 file, 2 tests; all 10 exact mappings plus adjacent/extreme mismatches covered |
| Current-code inspection of `canUseItemGrade` | PASS WITH SCOPE LIMIT | Strict equality against `getProfessionGradeForRealm`; unknown realm resolves false; no stateful consumer is wired in this task |

## Findings

No confirmed, suspected, or coverage-gap defect was identified inside this pure contract.

## New or Changed QA Tests

No additional QA-only test was needed; the task-owned TDD test provides the lowest conclusive oracle for the exact-grade contract.

## Gaps and Residual Risk

Equip atomicity, reason propagation, UI feedback, breakthrough lifecycle, and save interaction remain unimplemented and unverified here. Tasks 16-17 must test those consumers when they are connected.

## Pre-existing Failures

None observed in the focused command.
