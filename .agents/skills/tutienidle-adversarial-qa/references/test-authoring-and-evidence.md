# Test Authoring and Evidence Rules

## Choose the Lowest Conclusive Test Layer

Select the first layer in this order that can observe the target invariant conclusively:

1. Vitest unit/domain for isolated rules.
2. Vitest integration for store/service/persistence/subsystem boundaries.
3. Playwright for browser lifecycle, input, reload, navigation, render integration, and multi-tab behavior.
4. Interactive browser evidence when automation lacks an observable oracle.

Do not skip to a broader layer merely because it is familiar. Escalate only when the lower layer cannot observe the relevant state transition, side effect, persisted result, or user-visible outcome.

## Reproduction and Regression Tests

Every reproduction test for a defect must fail for the intended reason before a production fix. Assert observable behavior rather than an implementation detail wherever an observable state transition, saved result, emitted event, or rendered interaction is available. Use real project objects when practical; mock only external boundaries. Fix the seed and clock for deterministic behavior. Once it documents the defect, it must remain as a regression test.

The QA workflow may add a reproduction test only inside its write allowlist and never changes production code to make it pass. If a defect requires a production hook to make an oracle observable or controllable, classify it as `Coverage gap`, record the missing control or observation, and propose the smallest production hook that would enable the check. Do not author that production hook as part of QA.

## Finding Status

- `Confirmed`: A failing reproduction test fails for the intended reason, or direct runtime evidence demonstrates the defect.
- `Suspected`: A static concern is plausible but lacks either an intended failing reproduction test or direct runtime evidence.
- `Coverage gap`: Required observability or control is missing, including a required production hook; record a minimal hook proposal and do not make the production change.

Existing green tests alone do not prove a defect absent and do not convert a concern into `Confirmed`.

## Severity

- `Critical`: Save loss/corruption, exploitable duplication, inability to boot, or progression lock.
- `High`: Incorrect material rewards/costs, combat/progression corruption, or major cross-system failure.
- `Medium`: Localized functional failure with a practical workaround.
- `Low`: Cosmetic or minor UX problem without material state impact.

## Evidence Labels and Failures

For a surprising failure, rerun the same check once. If the two outcomes differ, label the evidence `Flaky` and retain both executions in the report. A failure that passes on this single rerun is `Flaky`; it is not confirmed by that inconsistent evidence alone.

When required tooling or an execution environment is unavailable, label that evidence `Not verified` and state the unavailable command or observation and its limitation. Record pre-existing failures separately from task-owned findings; do not use them as evidence that the audited change caused a failure.

