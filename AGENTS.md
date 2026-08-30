# Project Agent Rules

- The application root is `game/`.
- The stack is Vue 3, TypeScript, Vite, Vitest, Pinia, and Phaser.
- Do not use `any` unless it is genuinely necessary.
- Do not change architecture or add dependencies unless the task requires it.
- Do not edit files outside the task scope.
- Prefer focused changes to rewrites.
- Never read or expose local secrets such as `APIKey` or `.env` files.
- Do not commit, push, deploy, or perform destructive Git operations. The user makes the final commit decision.
- Run verification proportionate to the affected behavior and risk before declaring completion.
- Fix verification failures caused by the implementation.
- Summaries must state what changed, what was verified, and any remaining limitations.

## UI/UX Skill Requirement

- For every task that designs, builds, reviews, or changes UI/UX, use the `ui-ux-pro-max` skill before making design or implementation decisions.
- This requirement includes pages, components, design systems, styling, layout, responsive behavior, accessibility, interactions, animation, typography, color, charts, and any change to how the interface looks, feels, moves, or is used.
- Read `.agents/skills/ui-ux-pro-max/SKILL.md` and follow its workflow, using the smallest relevant search mode and the detected project stack. For this project, use the Vue stack guidance when stack-specific guidance is needed.
- Skip this skill only for work that is entirely non-visual and does not affect how users interact with the application.
- If the skill is unavailable, report the limitation instead of silently substituting an unverified UI/UX workflow.

## Worktree and Multi-Agent Coordination

- Before changing files, check for overlapping uncommitted changes and preserve unrelated user work.
- Use a dedicated worktree for multi-file features, risky changes, implementation plans, or delegated work. Small focused changes may be performed in the current worktree.
- Delegated workers must report their worktree, branch, changed files, verification results, and remaining limitations.
- The coordinator reviews the final diff and verification evidence. Request another review only when evidence is missing, findings remain unresolved, or the change is high-risk.
- Do not commit, merge, integrate, push, or deploy unless the user explicitly requests it.

## Verification

- Run focused tests covering changed behavior.
- Run `npm.cmd run type-check` when TypeScript or Vue code changes.
- Run `npm.cmd run build` for production-affecting code, configuration, dependencies, asset-pipeline, or integration changes.
- Run the full test suite for broad, shared, or high-risk changes.
- Do not repeat a successful verification command unless relevant code or environment state has changed.
- Fix failures introduced by the task before declaring completion.

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
