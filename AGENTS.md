# Project Agent Rules

- The application root is `game/`.
- The stack is Vue 3, TypeScript, Vite, Vitest, Pinia, and Phaser.
- Do not use `any` unless it is genuinely necessary.
- Do not change architecture or add dependencies unless the task requires it.
- Do not edit files outside the task scope.
- Prefer focused changes to rewrites.
- Never read or expose local secrets such as `APIKey` or `.env` files.
- Do not push, deploy, or perform destructive Git operations.
- Run relevant tests, `npm.cmd run type-check`, and `npm.cmd run build` before declaring completion.
- Fix verification failures caused by the implementation.
- Summaries must state what changed, what was verified, and any remaining limitations.

## Direct Assignment and Worktree Isolation

- Work only on tasks assigned directly by the user. Do not delegate work or create sub-agents.
- Before changing any project file, create a dedicated Git branch and linked worktree for the task from the current committed state of the primary branch.
- Make all task edits, dependency setup, tests, builds, and task commits inside that dedicated worktree. Never implement changes directly in the primary worktree.
- Keep each task isolated in its own worktree and branch. Do not reuse a worktree or branch from another task.
- Before merging, run all relevant tests, `npm.cmd run type-check`, and `npm.cmd run build` in the task worktree. Fix failures caused by the task and rerun the failed checks.
- Commit the task changes on the task branch only after verification passes.
- Merge the task branch into the primary project branch only after every required check passes.
- Before merging, verify that the primary worktree is clean and still on the expected primary branch. If it is dirty, has moved, or the merge would conflict, stop and report the issue to the user; do not overwrite, stash, discard, or resolve unrelated changes automatically.
- If verification does not pass, do not merge. Report the failures and leave the task branch and worktree available for follow-up.

## Development Phase

- This project is currently in a development build. Save-migration correctness does NOT need to be maintained or verified — it is fine to break compatibility with old saves during this phase. Do not spend effort on save migrations.
## Rule: Planning & Idea Preservation

**Trigger:** When the user requests a plan.

**Mandatory Principles:**

1. **Absolutely respect the writer's original ideas.**
   - Do not arbitrarily omit any ideas.
   - Do not split original ideas into separate parts that lose the original continuity.
   - Do not replace, modify, or "improve" original ideas without prior consent.

2. **Research and expand with control.**
   - Proactively research related issues, context, and technical requirements surrounding the idea.
   - Add technical details, implementation steps, risks, and necessary resources **without altering the essence of the original idea**.

3. **The plan must be detailed and stay true to the original idea.**
   - Every original idea must appear fully in the plan.
   - If new sections are needed (e.g., architecture, technology, timeline), ensure they **serve** the original idea, not replace it.

4. **Clearly note any proposed changes.**
   - If the original idea is found to have issues (infeasibility, conflicts, etc.), state them clearly in a separate "Notes / Suggestions" section, with reasons and alternative approaches.
   - Do not silently modify the original idea in the plan.

5. **Confirm before finalizing the plan (if necessary).**
   - Before delivering the final plan, if there is any ambiguity about the idea, ask clarifying questions instead of guessing.
