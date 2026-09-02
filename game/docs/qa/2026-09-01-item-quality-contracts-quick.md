# QA Review: ItemQuality contracts and balance tables

- Date: 2026-09-01
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `game/src/core/item/ItemQuality.ts`, `game/src/core/item/ItemQuality.test.ts`, `game/src/core/equipment/ItemQualityBalance.ts`, `game/src/core/equipment/ItemQualityBalance.test.ts`

## Scope and Risk Map

The review covers the new five-value item-quality contract, name-segment composition, and static quality balance tables. The changed-risk mapper routes all four task-owned paths to `inventory-equipment`, with inferred downstream risk domains of player stats/combat loadout and economy costs/persisted ownership. These are mapper-derived domains, not existing runtime connections. There are no unmapped paths and no deep-audit candidate. Current code inspection shows these contracts are not yet connected to drop, save, or runtime mutation flows; those boundaries belong to later tasks. Non-task-owned dirty paths were excluded: none were present in the task worktree.

The matching inventory/equipment domain pack was applied. No matching quality/grade/item entry was present in `game/docs/qa/learned-defects.md`.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `INV-IQ-1` | `ItemQuality.ts` constants | Resolve every quality in ascending order and compose a display name | Determinism and boundedness: exactly five ordered values map to the intended `Chất` label and shared rank color | Reorder/index inspection | Ordered values, exact labels, `--rank-color-N`, and tone | Vitest unit | Medium: local contract, high observability |
| `INV-IQ-2` | `ItemQualityBalance.ts` drop table | Sum all quality weights | Conservation/boundedness: drop distribution totals exactly 100 within epsilon | Value mutation review | Numeric sum | Vitest unit | High: future loot weighting depends on it |
| `INV-IQ-3` | `ItemQualityBalance.ts` progression tables | Read forge uses, affix tiers, implicit multipliers by quality | Monotonicity: each progression advances in the specified order and starts at its defined baseline | Reorder/boundary review | Exact ordered arrays | Vitest unit | High: future progression/stat consumers depend on it |
| `INV-IQ-4` | `ItemQualityBalance.ts` affix pools | Unlock pools at each quality | Monotonicity: a higher quality includes every lower-quality pool and only adds access | Reorder/repeat review | Exact cumulative pool arrays and `arrayContaining` checks | Vitest unit | High: future affix selection depends on it |
| `INV-IQ-5` | `ItemQualityBalance.ts` substat/essence ranges | Read ranges for each quality | Boundedness and monotonicity: substat minima/maxima and essence ranges remain valid and increase as specified | Zero/boundary/value mutation review | Exact minima/maxima plus `min < max` | Vitest unit | Medium: future roll/dissolve consumers depend on it |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `node .agents/skills/tutienidle-adversarial-qa/scripts/changed-risk-map.mjs <four task paths>` | PASS | `inventory-equipment`; no unmapped paths; `deepAuditCandidate: false` |
| `npx.cmd vitest run src/core/item/ItemQuality.test.ts src/core/equipment/ItemQualityBalance.test.ts` | PASS | 2 files, 10 tests passed |
| `npm.cmd run type-check` | PASS | `vue-tsc --build` completed successfully |
| `npm.cmd run build` | PASS | Production Vite build completed; existing chunk-size warning only |
| Current-code inspection of inferred downstream risk domains | PASS WITH SCOPE LIMIT | No runtime/drop/save consumer exists yet in this task; later integration work needs its own boundary tests |

## Findings

No confirmed, suspected, or coverage-gap defect was identified within this task's local contract scope.

## New or Changed QA Tests

No additional QA-only tests were needed. The task-owned unit tests provide conclusive observability for all five ledger invariants at the lowest useful test layer.

## Gaps and Residual Risk

Drop selection, item schema/restore, affix rolling, stat application, and essence economy integration are not implemented by these task-owned paths and were not inferred as passing. The follow-up tasks must verify those cross-system handoffs against these contracts. This is bounded future integration risk, not an unresolved defect in the current contract layer.

## Pre-existing Failures

None observed in the focused verification commands.
