---
name: tutienidle-adversarial-qa
description: Adversarially review TutienIdle game changes for unanticipated state, timing, persistence, progression, lifecycle, and cross-system defects. Use after implementing a feature or bug fix, for game QA/review requests, and before milestone or release readiness; do not use it to repair production code.
---

# TutienIdle Adversarial QA

Create evidence-backed QA findings without repairing production code. Default to **quick** mode. Use **deep** mode for an explicit `deep` request, milestone or release readiness, or mandatory escalation from quick review.

## Shared contract

1. Establish the exact request and task-owned repository-relative paths before using [`changed-risk-map.mjs`](scripts/changed-risk-map.mjs); never feed unrelated dirty paths into the mapper. Inspect current code as primary evidence.
2. Always read the [project system map](references/project-system-map.md) and [QA reasoning method](references/qa-reasoning-method.md).
3. For any UI/UX judgment, load `ui-ux-pro-max` before setting the oracle.

## Route by mode

- **Quick:** Read the [quick workflow](references/quick-review.md), only the matching [domain packs](references/domains/), [test and evidence rules](references/test-authoring-and-evidence.md), [reporting rules](references/reporting-and-learning.md), and matching entries in the [learned-defect ledger](../../../game/docs/qa/learned-defects.md).
- **Deep:** Read the [deep workflow](references/deep-audit.md), every [domain pack](references/domains/), [test and evidence rules](references/test-authoring-and-evidence.md), [reporting rules](references/reporting-and-learning.md), and the full [learned-defect ledger](../../../game/docs/qa/learned-defects.md).

Quick/deep selects attack breadth and routing only — neither mode weakens completion semantics, and neither produces the run verdict. Follow mandatory escalation in the quick workflow instead of issuing a quick verdict when it applies.

## Protocol adapter (installed 2026-09-23)

This skill is an evidence producer (Ops A/D) inside the Internal Fixed-Point QA Protocol (`game/docs/qa/protocol/README.md`) — the sole QA decision law. Its per-operation labels map onto the unified model:

- `Confirmed` → ledger `REAL_DEFECT` with the recorded evidence kind (failing repro = EXECUTED_*, direct runtime observation = EXECUTED_RUNTIME). `Suspected` → `COVERAGE_GAP`/`INFERRED`-kind hypothesis, never silently dropped. `Coverage gap` → `COVERAGE_GAP`.
- `PASS WITH EVIDENCE` / `PASS WITH GAPS` / `FAIL` / `BLOCKED` are per-operation evidence labels recorded in the ledger, NOT run verdicts. The run outcome (`QA_FIXED_POINT_REACHED` / `QA_FINDINGS_OPEN` / `QA_UNVERIFIED` / `QA_BLOCKED_SCOPE` / `QA_ACCEPTED_WITH_EXCEPTIONS`) is emitted only by the coordinator through the protocol's terminal predicate — never by this skill alone.
- A discovered issue transitions to REPAIR under the protocol (writer lease, sibling hunt, pin) — it is never fixed invisibly inside QA.

## Hard QA write boundary

During a QA run, write only:

- `game/src/**/*.test.ts`
- `game/tests/e2e/**/*.spec.ts`
- `game/tests/e2e/helpers.ts`
- `game/docs/qa/**`

Never edit production code, configuration, dependencies, assets, snapshots, or secrets; delete, weaken, skip, or broadly rewrite existing tests; change requirements or expected behavior to match an implementation; update snapshots without independent evidence that the new result is intended; read or expose `.env`, API keys, credentials, or other local secrets; touch production services, real accounts, or real user data; stage, commit, merge, push, deploy, use destructive Git operations, or otherwise mutate Git state/history. Do not change production code to make a reproduction pass. Stop after creating QA evidence and hand production repair to the development workflow.

## Evidence and outcome

Treat a defect as `Confirmed` only with an intended failing reproduction test or direct runtime evidence; an explicit SOURCE_PROOF static proof may establish a `REAL_DEFECT` under the protocol when the violation is directly provable — label the evidence kind honestly, never claim runtime confirmation from source. Otherwise classify it as `Suspected` or `Coverage gap`; existing green tests alone do not prove safety.

Use only `PASS WITH EVIDENCE`, `PASS WITH GAPS`, `FAIL`, or `BLOCKED`—never bare `PASS`. Write each report to `game/docs/qa/YYYY-MM-DD-<scope>-<mode>.md` using the [reporting rules](references/reporting-and-learning.md).
