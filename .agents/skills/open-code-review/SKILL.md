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

Build a checklist containing **every** `reviewable_files` entry before starting. For each file, read its diff (`git diff <base>...<head> -- <path>`, `git show <commit> -- <path>`, or working-tree diff for workspace mode) and evaluate it against the resolved rules plus surrounding context. OCR's value is the deterministic selection + rule focus; the defect reasoning is yours — this is not a license to skim.

- **Untracked/new files:** workspace preview includes them, but `git diff` returns empty for an untracked file — read the complete file content instead. An empty diff is never evidence that nothing needs review.
- **Coverage accounting — no file disappears silently.** Every checklist entry ends the pass as `reviewed` or `skipped` + a concrete reason (e.g. "generated file", "binary asset"). The pass report must state:

  ```
  previewed_files: N
  reviewed_files: N
  skipped_files: N (+ per-file reason)
  coverage_rate: %
  ```

  `coverage_rate < 100%` invalidates the pass unless every skipped file carries an explicit, valid reason. "Reviewed 14 of 27, looks good" is a failed pass.

Report each finding as: `path:line` · severity (Critical/High/Medium/Low/Nit per the P5 ladder) · defect + evidence · suggested fix.

## Step 4 — The gate loop (per P18)

Validate every Medium-or-higher finding against the real implementation → reject false positives only with recorded evidence → fix confirmed defects → re-run the affected P3 verification → re-run steps 1-3 on the resulting diff (with fresh coverage accounting). Repeat until ONE clean pass (0 unresolved confirmed Medium+) on the latest code state. One clean pass after the most recent meaningful change suffices — don't spam identical reruns.

## Environment notes

- Verify the binary with `ocr --version`; upgrade intentionally to a version at least 7 days old, never via `latest`.
- `ocr review` / `ocr scan` (OCR-managed LLM mode) run only where the user has explicitly configured a provider (`ocr config provider`); Delegation Mode is this repo's default. The published OCR precision/recall benchmarks describe Alibaba's review engine in managed mode — they do not transfer to Delegation Mode, where the host agent is the reviewer.
- Missing/broken `ocr` = environment limitation: investigate, record the concrete evidence — and the task is NOT completion-ready unless the user explicitly waives P18 (same standard as a P14 tooling blocker). Never silently skip the gate.
