# Quick Review Workflow

Use this bounded post-change review to find conclusive evidence without turning a focused change into a broad audit. It never authorizes production-code, configuration, dependency, asset, snapshot, secret, live-service, or Git-history edits. A confirmed defect may receive a failing reproduction test only within the QA write allowlist: `game/src/**/*.test.ts`, `game/tests/e2e/**/*.spec.ts`, `game/tests/e2e/helpers.ts`, and `game/docs/qa/**`.

## Sequence

1. Establish the exact user request and task-owned diff. Exclude unrelated dirty files from review inputs and record the exclusions.
2. Run [`changed-risk-map.mjs`](../scripts/changed-risk-map.mjs) using only task-owned repository-relative paths.
3. If the mapper returns `unmappedPaths`, inspect every item in current code before proceeding. For each task-owned path, manually route or document the relevant domain packs and one-hop consumers in the report; if material risk cannot be bounded from code inspection, escalate to deep audit. Record any non-task-owned exclusion instead of reviewing it.
4. Inspect the changed subsystem and its mapper-listed or manually routed one-hop consumers in current code; use code, not the mapper, to decide materiality.
5. Load [the reasoning method](qa-reasoning-method.md), each matching [domain pack](domains/), and matching entries from `game/docs/qa/learned-defects.md`. Load [test/evidence rules](test-authoring-and-evidence.md) and [reporting rules](reporting-and-learning.md) before classifying findings.
6. Create a small invariant ledger, select attack operators for the changed transitions, and rank the hypotheses.
7. Run the lowest conclusive focused checks for the highest-ranked hypotheses.
8. Add a failing reproduction test when it can prove the issue, fail for the intended reason, and stay inside the QA write allowlist. It is optional only when direct runtime evidence already confirms the defect or when no such test can be written inside the allowlist. Do not edit production code to make a test pass.
9. Apply the evidence gate, classify evidence, and write the quick report using the reporting rules.
10. Escalate to deep audit rather than issuing a quick verdict when scope is materially cross-system or reaches a critical state boundary.

For any UI/UX oracle, load `ui-ux-pro-max` before deciding the expected interaction or presentation result.

## Mandatory Deep Escalation

Escalate when any condition is true:

- Save/cloud consistency or recovery behavior materially changes.
- Clock/offline accrual or time ownership materially changes.
- Any materially broad or high-impact economy/progression risk is present, including a transaction that crosses persistence or combat boundaries.
- Any material Vue/Pinia/Phaser ownership or lifecycle risk is present.
- A task-owned `unmappedPaths` item has material risk that manual code inspection cannot confidently route and bound.
- The mapper returns `deepAuditCandidate: true` and code inspection cannot confidently bound the risk.
- The quick review cannot produce a reliable oracle for a high-impact hypothesis.

These rules do not make every trivial mapped path a deep audit: code inspection determines materiality, breadth, and impact. They do require escalation despite a local oracle when a material economy/progression or Vue/Pinia/Phaser ownership or lifecycle risk is present. The mapper is advisory; a reviewer who does not escalate a `deepAuditCandidate` must document why the risk is confidently bounded in the report.

## Evidence Gate

Apply this gate before classifying a hypothesis or issuing a verdict. `Confirmed` requires either a failing reproduction test that fails for the intended reason or direct runtime evidence. A static concern without either is `Suspected`; missing observability or control is a `Coverage gap`. Existing green tests alone neither confirm that a defect is absent nor justify an unqualified safe result.

## Focused Combat Example

For a task-owned change to `game/src/core/battle/BattleSystem.ts`, map the path, load `combat-and-tribulation`, and inspect its one-hop reward/progression consumers when the changed transition can settle combat. Add ledger rows for deterministic tick ordering, simultaneous terminal states, and reward exactly-once behavior. Run the smallest focused battle or integration test that makes the selected oracle observable. If the changed transition crosses into loot persistence or cannot prove its reward oracle without broader owners, escalate; do not repair the production path.

