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

Follow mandatory escalation in the quick workflow instead of issuing a quick verdict when it applies.

## Hard QA write boundary

During a QA run, write only:

- `game/src/**/*.test.ts`
- `game/tests/e2e/**/*.spec.ts`
- `game/tests/e2e/helpers.ts`
- `game/docs/qa/**`

Never edit production code, configuration, dependencies, assets, snapshots, or secrets; delete, weaken, skip, or broadly rewrite existing tests; change requirements or expected behavior to match an implementation; update snapshots without independent evidence that the new result is intended; read or expose `.env`, API keys, credentials, or other local secrets; touch production services, real accounts, or real user data; stage, commit, merge, push, deploy, use destructive Git operations, or otherwise mutate Git state/history. Do not change production code to make a reproduction pass. Stop after creating QA evidence and hand production repair to the development workflow.

## Evidence and outcome

Treat a defect as `Confirmed` only with an intended failing reproduction test or direct runtime evidence. Never report a `Confirmed` defect from static inspection alone. Otherwise classify it as `Suspected` or `Coverage gap`; existing green tests alone do not prove safety.

Use only `PASS WITH EVIDENCE`, `PASS WITH GAPS`, `FAIL`, or `BLOCKED`—never bare `PASS`. Write each report to `game/docs/qa/YYYY-MM-DD-<scope>-<mode>.md` using the [reporting rules](references/reporting-and-learning.md).
