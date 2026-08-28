# Project Agent Rules

- The application root is `game/`.
- The stack is Vue 3, TypeScript, Vite, Vitest, Pinia, and Phaser.
- Do not use `any` unless it is genuinely necessary.
- Do not change architecture or add dependencies unless the task requires it.
- Do not edit files outside the task scope.
- Prefer focused changes to rewrites.
- Never read or expose local secrets such as `APIKey` or `.env` files.
- Do not commit, push, deploy, or perform destructive Git operations.
- Run relevant tests, `npm.cmd run type-check`, and `npm.cmd run build` before declaring completion.
- Fix verification failures caused by the implementation.
- Summaries must state what changed, what was verified, and any remaining limitations.

## Worktree Isolation and Multi-Agent Coordination

- Before changing any project file, inspect the active Git worktrees and their changed paths. If another active task is changing the same files, stop and report the overlap before proceeding.
- Perform every file-changing task in a dedicated Git branch and linked worktree created from the intended base branch. Never implement changes directly in the primary/local worktree. Read-only inspection may be performed without creating a worktree.
- Keep each task isolated in its own worktree and branch. Reuse a worktree only when continuing the same task.
- The primary agent assigned by the user acts as the coordinator. It owns delegation, waits for worker completion notifications, reviews completed work, and decides whether the work is ready for integration or requires another revision.
- The coordinator may use up to 8 subagents over the lifetime of a task when delegation is useful. It must respect the platform's current concurrency limit and should delegate only independent, clearly scoped work.
- Every worker must notify and wake the coordinator when its assigned work is fully complete. Its report must include the worktree path, branch, changed files, verification performed and results, and any remaining limitations. A worker must not integrate its own work merely because implementation is complete.
- The coordinator must inspect the worker's diff and required verification. It may approve integration, request additional work, or reject the changes.
- When revisions are required, the coordinator must send the follow-up request to the same worker when practical. That worker must perform the revision in the same task worktree, rerun relevant verification, and notify and wake the coordinator again. Repeat this review loop until the coordinator approves or reports a blocker.
- Only the coordinator may grant authority to integrate a task worktree into the primary/local worktree. After receiving that explicit authority, the same worker that implemented the task should perform the integration when practical.
- Before integration, the worker must inspect the target worktree, current branch, changed paths, and potential conflicts. Preserve all unrelated local changes. If the integration would overwrite, conflict with, stash, discard, or otherwise disturb unrelated work, stop and wake the coordinator with a report instead of integrating.
- Integration authority is not commit authority. Neither the coordinator nor workers may create the final commit; after approved changes are integrated and verified in the primary/local worktree, report the result and leave the final commit decision to the user.
- Run all relevant tests, `npm.cmd run type-check`, and `npm.cmd run build` in the task worktree. Fix failures caused by the task and rerun the failed checks. After integration, rerun verification affected by the combined local state before reporting completion.

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
