# QA Review: EnhanceCurve

- Date: 2026-09-01
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `game/src/core/equipment/EnhanceCurve.ts`, `game/src/core/equipment/EnhanceCurve.test.ts`

## Scope and Risk Map

This review covers the new pure slot-enhancement success-rate curve and its two exported constants. The changed-risk mapper routes the files to `inventory-equipment`, with one-hop consumers listed as future economy costs/persisted ownership and player stats/combat loadout; no current runtime consumer imports `EnhanceCurve`. The mapper returned `deepAuditCandidate: false` and no unmapped paths, so no deep escalation is required for this isolated contract. Existing dirty Task 1 files (`ItemQuality*`, `ItemQualityBalance*`, and its QA report) were explicitly excluded.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `INV-ENHANCE-1` | `enhanceSuccessRate` pure function | Evaluate valid enhancement levels | Deterministic curve matches the authoritative formula and integer rounding | Representative levels 1, 5, 10, 20, 40, 60, 80, 100, 1000 | Exact formula-derived percentage | Unit | High: future slot progression depends on it |
| `INV-ENHANCE-2` | `enhanceSuccessRate` pure function | Evaluate below-minimum levels | Below level 1 returns the documented 100% rate | Zero and negative levels | Returned percentage | Unit | Medium: guards invalid caller state |
| `INV-ENHANCE-3` | `enhanceSuccessRate` pure function | Evaluate boundary and large values | Rate remains an integer in the inclusive range 1..100 | Negative, zero, normal, cap, and huge finite levels | Range and integer assertions | Unit | High: prevents invalid probability/economy values |
| `INV-ENHANCE-4` | Exported contract constants | Read pity threshold and max slot level | Constants remain 10 and 100 | Direct contract check | Export values | Unit | High: callers use these progression boundaries |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `node .../changed-risk-map.mjs game/src/core/equipment/EnhanceCurve.ts game/src/core/equipment/EnhanceCurve.test.ts` | PASS | Domains: `inventory-equipment`; `deepAuditCandidate: false`; no unmapped paths |
| `npm.cmd run test -- src/core/equipment/EnhanceCurve.test.ts` | PASS | 1 test file passed; 5 tests passed |
| `npm.cmd run type-check` | PASS | `vue-tsc --build` completed successfully |
| `npm.cmd run build` | PASS with warning | Vite production build completed; existing chunk-size and plugin-timing warnings only |

## Findings

No confirmed, suspected, or coverage-gap defects were found within this isolated pure-function scope.

## New or Changed QA Tests

`game/src/core/equipment/EnhanceCurve.test.ts` is the task-owned unit contract. It proves exact formula-derived results, documented below-one behavior, integer/range boundedness, and both constants at the lowest conclusive test layer.

## Gaps and Residual Risk

No runtime slot-enhancement action, pity state transition, material cost, save serialization, or combat-stat consumer exists in this task, so those future integration paths are not verified here. They should receive integration coverage when wired to this curve. Non-finite `NaN` input is outside the documented numeric contract and is not asserted.

## Pre-existing Failures

None observed in the commands run for this review. The build emitted existing-size/performance warnings, but completed successfully.
