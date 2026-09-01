# Reporting and Learned-Defect Rules

## Report Destination and Template

Write every QA report to `game/docs/qa/YYYY-MM-DD-<scope>-<mode>.md`. The angle-bracket labels in the path and template below are generated-report schema fields to fill in for each report, not unfinished implementation placeholders or scaffold work.

```markdown
# QA Review: <scope>

- Date: YYYY-MM-DD
- Mode: quick | deep
- Verdict: PASS WITH EVIDENCE | PASS WITH GAPS | FAIL | BLOCKED
- Task-owned paths: explicit list

## Scope and Risk Map
Changed systems, one-hop consumers, escalation decision, and exclusions.

## Invariant Ledger
Completed invariant-ledger table.

## Verification Evidence
| Command or observation | Result | Evidence/limitation |

## Findings
### QA-<date>-<sequence>: <title>
- Severity: Critical | High | Medium | Low
- Status: Confirmed | Suspected | Coverage gap
- Invariant:
- Preconditions:
- Reproduction:
- Expected:
- Actual:
- Evidence:
- Test file: path | none
- Owner subsystem:
- Blast radius:

## New or Changed QA Tests
Paths and why each test proves its target behavior.

## Gaps and Residual Risk
Unverified hypotheses, unavailable tools, flaky evidence, and missing hooks.

## Pre-existing Failures
Failures not caused by the audited task.
```

The report is operational: replace each schema field with the review's actual scope, evidence, finding data, and paths. Keep the complete invariant-ledger table produced by the reasoning method; do not replace it with a prose summary.

## Verdicts and Minimum Evidence

Only `PASS WITH EVIDENCE`, `PASS WITH GAPS`, `FAIL`, and `BLOCKED` are allowed. Bare `PASS` is forbidden.

- `PASS WITH EVIDENCE`: The completed invariant ledger identifies the material hypotheses; conclusive, recorded checks resolve every high-risk hypothesis in scope; no `Confirmed` finding remains; and no unresolved `Coverage gap`, `Flaky`, or `Not verified` evidence materially weakens the conclusion.
- `PASS WITH GAPS`: No `Confirmed` finding remains, and recorded evidence resolves the material high-risk hypotheses, but bounded residual risk remains from `Suspected` findings, non-material `Coverage gap` items, `Flaky` evidence, or `Not verified` tooling. State every gap and why it does not block this limited verdict.
- `FAIL`: At least one `Confirmed` finding has evidence from an intended failing reproduction test or direct runtime observation. Record its severity, invariant, reproduction, evidence, owner subsystem, and blast radius.
- `BLOCKED`: A required high-impact hypothesis cannot receive a sufficiently reliable oracle because a decisive check is unavailable, `Flaky`, `Not verified`, or blocked by missing observability/control. Record the blocking evidence and any minimal hook proposal; do not use `PASS WITH GAPS` to hide a material unresolved risk.

Pre-existing failures are reported in their own section and must not establish a finding against the audited task.

## Learned-Defect Loop

Append a learned-defect row only after a `Confirmed` defect has evidence. Use this exact schema:

```markdown
| ID | Component | Trigger pattern | Missed invariant | Why prior QA missed it | Regression test | Domain-pack weighting recommendation |
```

In quick mode, read and filter ledger entries by the mapped subsystem. In deep mode, read the full ledger. The skill may recommend promoting a repeated pattern or weighting adjustment, but it must not self-edit its domain packs during a QA review. Record the recommendation in the report or ledger row for later human review.

