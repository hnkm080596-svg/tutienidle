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

## Iron Rule: Deletion Requires Explicit Authorization

- Never delete any file or directory, by any method, unless the user has explicitly authorized that specific deletion in advance.
- This prohibition includes direct deletion and indirect deletion through shell commands, editors, patches, scripts, Git operations, cleanup tools, automation, or any command with deletion as a side effect.
- Treat deletion exactly like committing: the user retains the final decision and must grant explicit authorization before the deletion is performed.
- If completing a task appears to require deletion, stop and ask the user for authorization. Do not work around this rule by replacing, emptying, truncating, or moving the target so that it is effectively deleted.

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

## UI Layout Rule: Flexible / Fit-to-Container

- Kích thước và số lượng phần tử hiển thị (grid slots, cards, items per row/page) phải FLEXIBLE theo container thật — fit với card/panel chứa nó.
- Khi window resize, layout phải tự thích ứng: không vỡ, không tràn, không để khoảng trắng chết, không hardcode số cột/px dựa trên màn hình dev.
- Pattern chuẩn của project: CSS `auto-fill/minmax` cho columns + ResizeObserver đo thật (`usePanelPagination` columnWidth, `useBagGridLayout`) — đo từ `contentRect`, không giả định.
- Cấm: fixed px width cho vùng chính, số cột hardcode, pagination đếm sai loại layout (list dọc vs grid đa cột).

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

**Trigger:** When the user requests a specification or plan.

**Mandatory Principles:**

1. **Absolutely respect the writer's original ideas.**
   - Do not arbitrarily omit any ideas.
   - Do not split original ideas into separate parts that lose the original continuity.
   - Do not replace, modify, or "improve" original ideas without prior consent.

2. **Research and expand with control.**
   - Proactively research related issues, context, and technical requirements surrounding the idea.
   - Add technical details, implementation steps, risks, and necessary resources **without altering the essence of the original idea**.

3. **Review all systems related to the task while writing the specification.**
   - During specification, inspect and account for every system related to the task in addition to the user's original ideas.
   - Trace relevant architecture, data flows, state ownership, dependencies, integrations, persistence, lifecycle, UI interactions, tests, and cross-system effects as applicable.
   - Use this system-wide context to produce the most coherent and technically sound specification, while preserving the essence and continuity of the user's original ideas.
   - Explicitly identify affected systems, assumptions, constraints, risks, and integration points in the specification. Do not infer system behavior from filenames or isolated code snippets when the relevant implementation can be inspected.
   - Derive the implementation plan from the completed specification and reuse its system analysis instead of repeating the same investigation.
   - Revisit and update the specification before planning only when the specification is missing, incomplete, outdated, or the task scope has changed.

4. **The specification or plan must be detailed and stay true to the original idea.**
   - Every original idea must appear fully in the specification or plan.
   - If new sections are needed (e.g., architecture, technology, timeline), ensure they **serve** the original idea, not replace it.

5. **Clearly note any proposed changes.**
   - If the original idea is found to have issues (infeasibility, conflicts, etc.), state them clearly in a separate "Notes / Suggestions" section, with reasons and alternative approaches.
   - Do not silently modify the original idea in the specification or plan.

6. **Confirm before finalizing the specification or plan (if necessary).**
   - Before delivering the final specification or plan, if there is any ambiguity about the idea, ask clarifying questions instead of guessing.

## TutienIdle Adversarial QA

- After implementing a feature or bug fix, use the `tutienidle-adversarial-qa` skill in quick mode before claiming completion.
- Use deep mode when the user invokes `$tutienidle-adversarial-qa deep` and before milestone or release readiness claims.
- During a QA run, the skill may write only `game/src/**/*.test.ts`, `game/tests/e2e/**/*.spec.ts`, `game/tests/e2e/helpers.ts`, and `game/docs/qa/**`; it must not modify production code.
- Treat a defect as confirmed only when a failing reproduction test or direct runtime evidence proves it. Otherwise report it as suspected or as a coverage gap.
- If quick mode identifies materially broad save/cloud, time/offline, economy/progression, or Vue/Pinia/Phaser lifecycle risk, escalate to deep mode rather than issuing a quick pass verdict.
- The allowed QA verdicts are: `PASS WITH EVIDENCE`, `PASS WITH GAPS`, `FAIL`, and `BLOCKED`.
- A feature or bug-fix task may be declared done only with a `PASS WITH EVIDENCE` verdict. `PASS WITH GAPS`, `FAIL`, and `BLOCKED` are non-completion states and must never be presented as done.
- When the verdict is below `PASS WITH EVIDENCE`, report the unresolved findings or evidence gaps, return to the development workflow for in-scope remediation, and rerun QA. If completion requires new authorization, user input, or work outside the task scope, stop and request it explicitly instead of lowering the completion standard.
