# Task 1.2 — external-review call-site inventory (adoption run, master-based)

Every location on `devin/1790167292-internal-qa` that references ChatGPT Web / C2C / external review, and its disposition.

## Live mandate sites (edited in Task 2)

| Location | Before | After |
|---|---|---|
| `AGENTS.md` | P-rules + workflow; no explicit external mandate, but P5 "external review" steps implied C2C in practice | "Internal QA authority" block inserted; P4/P5 route verdicts to protocol ledger; explicit "no ChatGPT Web/C2C/external reviewer is a completion criterion" |
| `.opencode/agent/build.md` + `general.md` | mirrored P-rules | same QA-authority section mirrored (sync rule honored) |
| `AstraDoctrine.md` | reasoning workflow | §1 reads protocol as project QA law |
| `PROJECT_CONTEXT.md` | "Codex/Claude Code review" line, stale npm.cmd/CLAUDE.MD refs | rewritten: protocol = QA law; merge authority = human |
| `game/docs/p7/decisions.md` D13 | "SPEC → ChatGPT review until pass → PLAN → … → external review until pass" ([C2C] NOTICE) | non-binding disposition banner added |
| `game/docs/p7/mission-graph.md` | pipeline edges through external review | non-binding disposition banner added |
| `.agents/skills/tutienidle-adversarial-qa/SKILL.md` + `references/reporting-and-learning.md` | verdict labels implied final authority | protocol adapter: Confirmed→REAL_DEFECT mapping; quick/deep = breadth routing; verdict labels are per-op evidence, not run verdicts |
| `.agents/skills/{requesting-code-review,subagent-driven-development,receiving-code-review}/SKILL.md` | external feedback guidance | adapter notes: external feedback is evidence to validate, never a binding verdict |

## Historical records (non-binding, preserved)

| Location | Disposition |
|---|---|
| `game/docs/p7/missions/*.md` (~24 files: specs, plans, notes) | Completed-mission records containing live-shaped C2C language ("external review PASS", "ChatGPT review until pass"). Covered by governing-doc banners above; files unchanged to preserve history. |
| `.c2c/` mailbox + PR #1 tooling | Historical C2C transport; marked non-binding; findings are offline benchmark labels only. No deletion. |
| `game/docs/qa/2026-09-23-mf-talent-deep.md`, body-perfection addenda, etc. | Historical QA reports that cite external review; retained as corpus sources (GB-13..20), not as live requirements. |

## Sweep statement

`grep -rniE "chatgpt|c2c|external.?review"` over `AGENTS.md`, `AstraDoctrine.md`, `PROJECT_CONTEXT.md`, `.opencode/`, `.agents/skills/`, `game/docs/p7/decisions.md`, `game/docs/p7/mission-graph.md` returns only non-binding language or historical records after the Task 2 edits. No live instruction mandates an external verdict.
