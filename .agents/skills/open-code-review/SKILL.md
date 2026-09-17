---
name: open-code-review
description: Run the P18 Open Code Review gate over a task diff using the `ocr` CLI in Delegation Mode (no OCR LLM provider or API key — the agent performs the review reasoning). Use after P3 verification on any non-trivial code change, when asked to "run OCR", and when reviewing a branch/commit diff against project rules.
---

# Open Code Review — Delegation Mode Protocol

`ocr` (Alibaba OpenCodeReview, pinned `1.11.9`, `npm i -g @alibaba-group/open-code-review@1.11.9`) is a deterministic front-end for review: it selects which diff files are reviewable and resolves which review rules apply. In **Delegation Mode the host agent is the reviewer** — OCR never calls an LLM, needs no provider config or API key, and consumes no external quota.

Gate semantics (when OCR runs, what "clean" means, finding handling, severity mapping) live in `AGENTS.md` **P18** — this skill is only the execution protocol. A clean OCR pass never substitutes for tests, P13/P14, P4, or the P5 sequential review.

## Step 1 — Select the diff scope (inside the implementation worktree)

```bash
# Uncommitted work (staged + unstaged + untracked) — the common task case
ocr delegate preview -f json

# Committed branch work — merge-base mode, use the real task boundary
ocr delegate preview -f json --from <base> --to <head>

# Single commit vs its parent
ocr delegate preview -f json -c <commit>
```

- Run from the implementation worktree root, or pass `--repo <worktree-path>`. Reviewing a different worktree/branch than the implementation invalidates the pass.
- `-f json` yields `reviewable_files[].path` plus excluded files with reasons — use the JSON, don't scrape the text list.
- Pass `-b "<one-line task intent>"` when there is no commit message to infer background from (workspace mode).
- **Never** run `ocr scan` per-task — it is reserved for explicit audit/scouting missions.

## Step 2 — Resolve the rules for the selected files

```bash
ocr delegate rule <path1> <path2> ...   # all reviewable paths from step 1
```

Rule resolution chain: `--rule` flag > `<repo>/.opencodereview/rule.json` > `~/.opencodereview/rule.json` > built-in system rules. This repo's `.opencodereview/rule.json` holds the project defect checks (domain authority, Vue/Pinia, Phaser scenes, registries, tests) merged over the built-ins via `merge_system_rule: true`. Spot-check coverage with `ocr rules check <path>` when a file's resolved rule looks wrong. A worktree whose branch predates the config commit falls back to built-in rules — merge/rebase the config commit or pass `--rule <path-to-rule.json>` explicitly.

## Step 3 — Perform the review yourself

For every reviewable file, read its diff (`git diff <base>...<head> -- <path>`, `git show <commit> -- <path>`, or working-tree diff for workspace mode) and evaluate it against the resolved rules plus surrounding context. OCR's value is the deterministic selection + rule focus; the defect reasoning is yours — this is not a license to skim.

Report each finding as: `path:line` · severity (Critical/High/Medium/Low/Nit per the P5 ladder) · defect + evidence · suggested fix.

## Step 4 — The gate loop (per P18)

Validate every Medium-or-higher finding against the real implementation → reject false positives only with recorded evidence → fix confirmed defects → re-run the affected P3 verification → re-run steps 1-3 on the resulting diff. Repeat until ONE clean pass (0 unresolved confirmed Medium+) on the latest code state. One clean pass after the most recent meaningful change suffices — don't spam identical reruns.

## Environment notes

- Verify the binary with `ocr --version`; upgrade intentionally to a version at least 7 days old, never via `latest`.
- `ocr review` / `ocr scan` (OCR-managed LLM mode) run only where the user has explicitly configured a provider (`ocr config provider`); Delegation Mode is this repo's default.
- Missing/broken `ocr` = environment limitation: investigate, then record the explicit gap like a P14 tooling blocker — never silently skip the gate.
