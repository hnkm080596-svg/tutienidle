# Project Agent Rules

- The application root is `game/`.
- The stack is Vue 3, TypeScript, Vite, Vitest, Pinia, and Phaser.

This document is the human-readable spec for all project rules. Two categories:

- **Part 1 — Protection Rules** (P1–P17): hard rules the agent must NOT bypass. Also baked into `.opencode/agent/<name>.md` system prompts so the agent "lives in" them.
- **Part 2 — Effectiveness Guidelines** (E1–E16): suggestions the agent reads and applies when relevant. May skip with reason.
- **Part 3 — Opencode Agent Wiring**: technical note about how Part 1 is replicated into the four agent files.

When a rule below says "the agent", it means whichever opencode agent is currently active (`build`, `plan`, `general`, `explore`).

---

## Part 1 — Protection Rules (Enforced)

### P1. Worktree Boundary + Safe Deletion

- Operate strictly inside the worktree you were given. All file edits, scripts, and tests must run inside it.
- File or directory deletion (`rm`, `Remove-Item`, editor delete, or any indirect form) is allowed **inside the worktree** without further authorization — the worktree is a sandbox, deletion there is not dangerous.
- For any action **outside the worktree** (other branches, the main checkout, sibling worktrees), you must obtain explicit user authorization first.
- The Iron Rule's "no destructive action without explicit user auth" still applies to actions that leave the worktree boundary. Treat crossing the worktree boundary the same as committing: the user decides.

### P2. Worktree MUST (except docs)

- Multi-file features, risky changes, implementation plans, architectural changes, and delegated work MUST be done in a dedicated worktree.
- Create the worktree via the `using-git-worktrees` skill. Project convention: path `<repo-root>/.agent-worktrees/<task-name>` (kebab-case from the user request), branch auto-prefixed by the skill (`feat/`, `fix/`, `chore/`).
- Small focused changes (single small file, 1-line typo, comment-only) may be performed in the current worktree, but if the user has explicitly asked for isolation, follow the request.
- **Exception — documentation edits:** editing `*.md` files (including this `AGENTS.md` and `game/docs/**`) is allowed without a worktree. For any doc edit made without a worktree, note clearly in the summary: **reason**, **time** (date or turn), and **line(s) changed**. Example: "Edited AGENTS.md L5 at 2026-09-04 to fix P3 wording — 1 line."
- Never create a worktree via raw `git worktree add` directly. Always go through the `using-git-worktrees` skill so placement, branch, and cleanup are consistent.

### P3. Smart Verification (2 modes: `quick` or `full`)

- Verification is binary. Do not invent intermediate modes.
- **`quick`** = `npm.cmd run type-check` + `npx.cmd vitest run` (focused on changed files / modules). Default for normal code changes.
- **`full`** = `npm.cmd run type-check` + `npm.cmd run build` + `npx.cmd vitest run` (no filter, full suite).
- Use **`full`** when the change touches:
  - Config files: `vite.config.ts`, `tsconfig.json`, `vitest.config.ts`, `package.json`, `package-lock.json`
  - Dependencies (added/removed/upgraded)
  - Asset pipeline: `assets/`, `public/`, Vite plugins, build scripts
  - Shared / broad code: Pinia root store, router, Phaser scene manager
  - Pre-milestone or pre-release verification
  - The user explicitly asks for full verification
- Otherwise, use **`quick`**.
- Stop on the first failure. Fix, then rerun the same mode. Do not let all steps run and then collect a failure list at the end.
- Do not repeat a successful verification unless the code or environment has materially changed.
- Failures introduced by the task must be fixed before declaring complete (see P12).

### P4. Adversarial QA Gate (FAIL with reason is acceptable)

- After implementing a feature or bug fix, run the `tutienidle-adversarial-qa` skill in quick mode before claiming completion.
- Use deep mode when the user invokes `$tutienidle-adversarial-qa deep`, or before milestone / release readiness claims.
- During a QA run, the skill may write **only** to: `game/src/**/*.test.ts`, `game/tests/e2e/**/*.spec.ts`, `game/tests/e2e/helpers.ts`, `game/docs/qa/**`. Production code under `game/src/**` (non-test) MUST NOT be modified during a QA run. If the QA pass uncovers a production bug, exit QA, fix in development workflow, then re-run QA.
- Treat a defect as confirmed only when a failing reproduction test or direct runtime evidence proves it. Otherwise report it as suspected or as a coverage gap.
- If quick mode identifies materially broad risk (save/cloud, time/offline, economy/progression, Vue/Pinia/Phaser lifecycle), escalate to deep mode rather than issuing a quick pass verdict.
- **Verdict rules (overriding the skill's defaults where this project is concerned):**
  - `PASS WITH EVIDENCE` — the task may be declared done.
  - `FAIL WITH REASON` — the task may be declared done **if** the reason is legitimate (example: "system is in development, requires later phases to complete"; "out of task scope, requires new authorization"; "blocked on external dependency, requires user input"). The reason must be specific, not generic.
  - `PASS WITH GAPS` and `BLOCKED` — non-completion. Report unresolved findings, return to development workflow, re-run QA.
- When the verdict is below `PASS WITH EVIDENCE` and is not a legitimate `FAIL WITH REASON`, do not present the work as done.

### P5. Code-Review Hard-Block

- Before declaring a non-trivial change complete, run the `code-review` skill (from `anthropics/knowledge-work-plugins`) over the diff.
- The diff under review must already be simplified: the E3 code-simplifier pass is a prerequisite for P5, and P5 reviews the post-simplify code. Do not run P5 on un-simplified code, and do not simplify after P5 on the same code (that would invalidate the review); if a post-review change is non-trivial, re-run E3 on it and re-review per the E3 fix clause.
- Non-trivial = roughly 5+ lines of production code changed OR any new file OR any touched file that is not a pure rename / comment / whitespace.
- The skill scores each issue 0–100 for confidence. Filter out anything below 80 (treat as false positive).
- Issues at or above 80 confidence MUST be fixed before declaring done. The task is not done while any such issue is open, unless the user explicitly accepts it.
- Skip this rule for 1-line typo fixes, comment-only edits, and pure formatting.

### P6. Multi-Agent Coordination

- Before editing files (including via a subagent), run `git status` to check for overlapping uncommitted changes. If overlap exists with work you did not author, stop and notify the user before proceeding.
- When dispatching a subagent (via the `task` tool, or any parallel delegation), require the subagent to report back in this exact format:
  - **Worktree path** (absolute)
  - **Branch**
  - **Files changed** (list)
  - **Verification evidence** (which verification mode ran, pass/fail summary)
  - **Remaining limitations** (anything not done, anything needing follow-up)
- The coordinator (the agent that delegated) must aggregate the subagent reports and the diff, and re-verify before declaring done.
- Only request another review pass when evidence is missing, findings are unresolved, or the change is high-risk. Do not loop reviews for low-signal issues.
- Subagents and coordinators MUST NOT commit, merge, integrate, push, or deploy — see P7.
- **Project convention (overrides the skill's own default recommendation), refined 2026-09-07:** which execution mode to use depends on whether the current session can dispatch subagents.
  - **Claude Code sessions** (has the `Agent`/`Task` tool, i.e. can actually delegate): prefer **Subagent-Driven Development** (`subagent-driven-development` skill) when executing an implementation plan — dispatch a fresh implementer subagent per task, with task review between tasks.
  - **Opencode agents** (`.opencode/agent/*.md` — no subagent-dispatch tool available to them): always use **Inline Execution** (`executing-plans` skill) — execute the plan's tasks directly in the current session, with checkpoints for review. They cannot use SDD because they have nothing to dispatch to.
  - When in doubt about which kind of session you are, check whether an `Agent`/`Task`-style tool is actually available to you — its presence, not habit, decides.

### P7. No Commit / Push / Deploy + Specific Destructive Git List

- The user is the final authority for commit, merge, integrate, push, and deploy. Never perform any of these without explicit user authorization in the current turn.
- The following destructive Git commands always require explicit user authorization, **even inside a worktree** (they can still lose uncommitted work and history):
  - `git reset --hard`
  - `git clean -fd` / `git clean -fdx`
  - `git push --force` / `git push -f`
  - `git branch -D` (uppercase force-delete)
  - `git stash drop` / `git stash clear`
  - `git checkout .` / `git checkout -- <path>` (silent overwrite of working tree)
  - `git restore .` / `git restore --staged .` without per-file confirmation
- Normal Git operations are allowed inside a worktree: `git status`, `git log`, `git diff`, `git branch` (list), `git worktree *`, `git add`, `git commit` (only when user authorized, see above), `git checkout <existing-branch>`, `git switch`.
- File deletion (`rm`, `Remove-Item`) is governed by P1, not by this rule.

### P8. No `any` Unless Genuinely Necessary

- Do not use TypeScript `any` unless the type is genuinely untyped (e.g., untyped third-party API, dynamic JSON, JSON-schema-driven parsing) and a typed alternative is not reasonably available.
- Prefer `unknown` + a type guard, or a proper interface. Each `any` introduced is a debt item; if you add one, mention it in the summary.

### P9. No Architecture or Dependency Change Without Task Requirement

- Do not change architecture (folder layout, module boundaries, public API surface of stores/services, Phaser scene topology) or add / remove / upgrade dependencies unless the task explicitly requires it.
- If you believe a change is needed, surface it in the summary as a "Note / Suggestion" rather than silently making it.

### P10. No Edit Outside Task Scope

- Edit only files that are required to complete the current task. Touching unrelated files is a scope violation.
- If a file outside scope appears to need a change, stop and ask the user, or include it as a `Note / Suggestion` in the summary.

### P11. No Secrets Exposure

- Never read, log, print, or commit the contents of `APIKey`, `.env`, `.env.*`, `.mcp.json`, or any file containing Bearer tokens, credentials, or other secrets.
- These files are listed in `.gitignore` and exist locally. Treat them as opaque identifiers, not as readable content.
- If a task appears to require reading a secret, stop and ask the user to provide the value through a safe channel.

### P12. Fix Verification Failures Caused by the Implementation

- If verification (any mode in P3) fails and the failure was introduced or worsened by the current task, the agent must fix it before declaring complete.
- Pre-existing failures in unrelated code are not the agent's responsibility to fix; report them as suspected or coverage gaps instead.

### P13. Runtime Wiring Verification (a green suite does not mean the game runs)

**Why this rule exists.** On 2026-09-05 a refactor extracted boot logic into `useAppLifecycle.ts` and left `startTickLoop()` defined in `App.vue` but never called. Since `App.vue`'s `tick()` is the only non-test caller of `GameManager.update()`, the entire simulation froze in the browser — combat, cultivation, idle progression, production — with **zero console errors**. It shipped to master with **2651 unit tests green**, because every unit test calls `gameManager.update()` directly and bypasses `App.vue`. The refactor even added tests for the extracted helper in isolation, proving it worked while nothing called it. ESLint could not catch it either: in `<script setup>`, top-level functions are auto-exposed to the template, so an orphaned function stays lint-clean.

- **The unit suite proves engine logic, not that the app is wired to it.** Never present "tests pass" as evidence the game works when the change touches the wiring between app shell and engine.
- A change is **wiring-critical** when it touches any of: `App.vue`, `game/src/composables/useAppLifecycle.ts`, boot / mount / lifecycle sequencing, timers or intervals driving `GameManager.update()`, Phaser scene creation or teardown, or the Vue↔Phaser bridge.
- For a wiring-critical change, P3's `quick` mode is **not sufficient**. Additionally run runtime verification: the Playwright e2e suite (`game/tests/e2e/`), and where feasible actually drive the app to the affected behaviour and confirm it progresses. A boot smoke test alone does not count — assert that the simulation *advanced*.
- **Extracting code into a composable, helper, or module is not complete until every previous call site is re-wired.** Testing the extracted unit in isolation is not evidence of that. Verify the caller, not just the callee.
- The repo carries guard tests for this class of failure (app-shell orphaned-function and composable-consumer checks, plus an e2e spec that plays a battle to resolution). **Do not delete, skip, or weaken them to make a change pass.** If one fails, it is telling you something is unwired — fix the wiring.
- If a symptom is "nothing happens, no error", suspect an uncalled function before suspecting broken logic. Silence is the signature of this bug class.

### P14. Visual/Runtime Verification via Playwright (things `tsc`/Vitest cannot see)

**Why this rule exists.** `npm.cmd run type-check` and Vitest (jsdom) prove logic and DOM structure — they cannot see actual pixel rendering, Phaser canvas draw output, whether an animation frame is actually advancing, CSS visual states (hover, drag-over, transition), z-index/overlap, or whether a native HTML5 drag-and-drop handler actually fires in a real browser. A change can pass P3 `full` with 100% green tests and still be visibly broken, invisible, or unusable — the test suite was structurally never looking at the thing that broke.

- **Trigger:** the change affects any of — Phaser scene rendering (sprites, VFX, canvas layout, animation state), CSS visual state driven by user interaction (hover, drag-over, `:class` bindings, transitions, responsive layout), drag-and-drop or other native browser interaction, or any UI element whose correctness can only be confirmed by looking at the rendered page.
- For a triggering change, P3 alone is **not sufficient**. Load the `playwright-cli` skill and drive the actual feature in a real browser before declaring done:
  1. Start the dev server (`npm.cmd run dev`, run in background) and read its printed Local URL from stdout — do not assume a fixed port.
  2. `playwright-cli open <url> --browser=msedge` — project convention (no bundled Chromium assumed available).
  3. Navigate to the actual affected screen/panel, take a `snapshot`/`screenshot`, and visually confirm the expected rendered state — not just "no console error".
  4. **Drag-and-drop / native HTML5 DnD:** `dragTo()` and other native Playwright drag actions do **not** reliably fire this codebase's Vue `@dragstart`/`@dragover`/`@drop` handlers. Use `run-code` to dispatch real `DragEvent`/`DataTransfer` objects via `page.evaluate()` instead.
  5. After dispatching events, do **not** read the resulting DOM in the same `run-code` call — Vue's reactive DOM update is scheduled on the next microtask, so a synchronous read right after `dispatchEvent()` sees stale state. Dispatch in one call, then query the DOM in a separate, later call.
  6. Run `playwright-cli console` and confirm no unexpected errors.
  7. `playwright-cli close` when done, and delete any scratch files it created (`.playwright-cli/`, ad-hoc screenshots/snapshots, stray `*.yml`/`*.png` at the repo root) before finishing — these are not test artifacts and must never be committed.
- A screenshot or snapshot showing the expected visual result is the evidence for this rule, the same way a passing test is evidence for P3. State what was visually confirmed in the summary (E11).
- This is a real-browser spot-check for **this task's** change, not a substitute for the Playwright e2e suite (P13) or the QA skill (P4) — those are separate gates with separate evidence requirements. Do this in addition, not instead.

### P15. Code Comments in English Only (mojibake prevention)

**Why this rule exists.** This is a Windows environment where Vietnamese-diacritic comments have repeatedly been corrupted into mojibake (UTF-8 misread as Latin-1/CP1252, then re-saved) by find-and-replace tools and other non-UTF-8-safe writes — confirmed regressions in `CombatScene.ts` (347 instances, pre-existing) and `combat-grid-view.ts` (27 instances introduced by a single refactor commit). Restricting new comments to plain ASCII English removes the failure mode entirely: ASCII has no multi-byte encoding to corrupt.

- All **new or edited code comments** (in `.ts`, `.vue`, `.js`, and similar source files) must be written in **English**, plain ASCII only — no Vietnamese diacritics.
- This applies to comments only, not to: user-facing strings/i18n content, commit messages, chat/summary responses to the user, or documentation files (`.md`) — those may stay Vietnamese as the project already does.
- Do not do a drive-by translation pass over unrelated existing Vietnamese comments in a file you are touching for another reason — stay in scope (P10). Translate only the comments adjacent to lines you are actually changing, when practical.
- If a file has pre-existing mojibake near code you are editing and it is cheap to restore (e.g., recoverable from git history), fixing it is encouraged but not required — call it out in the summary either way.

### P16. Vietnamese Text Confined to the i18n Gateway

**Why this rule exists.** The only place Vietnamese should ever appear in this codebase is user-facing UI/UX content, and even that must go through the project's i18n gateway (`vue-i18n`, `useI18n()` + locale resource files) rather than as hardcoded string literals — so translation, search, and mojibake-safety all have one throat to choke.

- Do not add new hardcoded Vietnamese string literals directly in `.vue` templates/`<script>` blocks or `.ts` files (button labels, panel titles, error/toast text, etc.). Add a key to the relevant i18n locale resource and reference it via `t('...')`, following the existing `useI18n({ useScope: 'local' })` pattern used elsewhere (e.g. `BagGrid.vue`).
- Code comments are governed by P15 (English only) — not by this rule.
- **Scope discipline:** this rule governs new code you write or files you substantially touch. It is not a mandate to retrofit the large pre-existing backlog of hardcoded Vietnamese content strings (item/skill/zone names, data files, etc.) — that is a separate, explicitly-scoped migration effort, not a drive-by (P10). If a task's own file already has hardcoded Vietnamese strings you are adding alongside, migrating that file's strings to i18n in the same change is encouraged.
- Data-driven Vietnamese content authored in `data/**` (naming systems, lore, descriptions) is a pre-existing, accepted convention distinct from UI chrome strings — this rule targets new UI chrome text, not a mandate to i18n-wrap existing content data unless a task specifically calls for it.

### P17. Runtime/Presentation/Logic Separation (single-responsibility systems, no cross-talk)

**Why this rule exists.** A 2026-09-07 combat-system audit found gauge advancement, Phaser animation selection, and turn-resolution gating all interleaved in the same tick handler (`GameManager.updateBattleFixedStep`), with presentation-ack state (`pendingReadyActor`/`presentationActive`/`playbackToken`) stored as loose fields on a large god-class. This made a single bug (a turn declared with no living target) hard to trace because timing, animation choice, and business rules were not separable. The user's standing project convention is "mỗi hệ thống làm việc độc lập, không trao đổi trực tiếp" (each system does its own job, no direct cross-talk) specifically so systems stay independently easy to fix and adjust — combat had drifted from this.

- A **runtime/clock** component's only job is timing: advancing a gauge/counter, selecting the current animation/VFX state, and signaling ticks. It must never embed business/gating logic (targeting rules, spawn/wave conditions, victory conditions, damage math) — those branches belong in a dedicated logic system that the runtime calls into or reads from, never the reverse.
- **Presentation (Phaser)** owns animation/VFX playback and reports completion back via explicit acknowledgment — it does not decide game-logic outcomes, and game logic does not reach into Phaser internals.
- **Damage/effect resolution** stays in its own system (e.g. the existing damage/impact engine) — a runtime or presentation layer never computes damage inline.
- Coordination between these systems happens through explicit interfaces/events only (an ack call, an emitted event, a read-only state query) — never by one system directly mutating another's private state.
- When auditing or extending a system and you find timing, presentation, and business logic mixed in one function/class, treat that as a defect to flag (or fix, if in scope) under this rule — not a style nitpick.

---

## Part 2 — Effectiveness Guidelines (Read & Apply When Relevant)

The agent reads these rules and applies them when the task matches the trigger. Skipping is allowed with a reason stated in the summary.

### E1. UI/UX Skill Requirement

- For every task that designs, builds, reviews, or changes UI/UX, use the `ui-ux-pro-max` skill before making design or implementation decisions.
- This includes pages, components, design systems, styling, layout, responsive behavior, accessibility, interactions, animation, typography, color, charts, and any change to how the interface looks, feels, moves, or is used.
- Read `.agents/skills/ui-ux-pro-max/SKILL.md` and follow its workflow, using the smallest relevant search mode and the detected project stack. For this project, use the Vue stack guidance when stack-specific guidance is needed.
- Skip this skill only for work that is entirely non-visual and does not affect how users interact with the application.
- If the skill is unavailable, report the limitation instead of silently substituting an unverified UI/UX workflow.

### E2. Stack Reference Skills (read-before-write)

- Edit or create `.vue` files in `game/src/**` → load the `vue-best-practices` skill (and `vue-pinia-best-practices` if touching a Pinia store).
- Edit or create files in `game/src/**` that import Phaser or instantiate `new Phaser.*` → load the `phaser-core` skill (and `phaser-arcade-physics` if using Arcade physics bodies, colliders, or velocity).
- The `vue` skill (from `antfu/skills`) is a general Vue reference; load it alongside `vue-best-practices` for project-style guidance.
- Skip for 1-line typo fixes, comment-only edits, or pure formatting changes.

### E3. Code-Simplifier (mandatory, before P5 review)

- After writing or substantially editing production code (≥5 lines of production-code change, or a new file), the `code-simplifier` skill is MANDATORY — it must run on the session diff **before** the P5 code-review gate, so the reviewer sees the final, simplified form of the code.
- Pipeline order: implement → simplify → verify (P3 quick) → code-review (P5) → done.
- Simplification is refactor only — behavior must not change. If a candidate simplification would change behavior, skip that item and list it in the summary so the P5 reviewer knows what was left as-is.
- Fixes arising from P5 findings are considered already-simplified if they reuse existing patterns; if a fix adds ≥5 new lines of production code, run a local simplify pass on the fix and re-review only that fix.
- The user may still say "skip simplify" for a given turn. Honor that and note it in the summary.

### E4. Game System Skills

- Changing economy / progression / difficulty / reward / skill tree / cultivation curve → load `balance-check`.
- Adding a new gameplay feature or redesigning an existing flow → load `improve-game`.
- Fixing a player-reported bug, or running regression / bug-hunt on existing code → load `game-qa`.
- **Designing or implementing a combat skill (kỹ năng, chiêu thức, passive), a SkillEffect, a ProgressionNode, an ailment or reaction, or any element-skill change → load `tutienidle-skill-design`.** This is project-specific and must be triggered for any change to combat data files in `game/src/data/skill` or `game/src/data/progression`, or to the SkillEffect / Skill / ProgressionNode type definitions.

### E5. Performance Skill

- Before shipping a feature that affects runtime (FPS, save size, large scenes, heavy animation, long sessions) → load the `performance` skill (from `addyosmani/web-quality-skills`).
- This is not a verification gate; it is a review pass to catch obvious runtime cliffs before they ship.

### E6. E2E Testing Skills

- Writing e2e tests in `game/tests/e2e/**` → load the `playwright-best-practices` skill.
- Running browser-based UI checks inside a session → load the `playwright-cli` skill. **See P14 for when this is mandatory, not optional, and for this project's specific gotchas (drag-and-drop simulation, Vue microtask timing, browser choice).**
- Vitest remains the default for unit and integration tests; Playwright is for end-to-end browser behavior.

### E7. Planning & Idea Preservation

**Trigger:** when the user requests a specification or plan.

**Mandatory principles:**

1. **Absolutely respect the writer's original ideas.** Do not omit, split, replace, or "improve" ideas without prior consent.
2. **Research and expand with control.** Proactively research related context, add technical detail, implementation steps, risks, and resources — without altering the essence of the original idea.
3. **Review all systems related to the task while writing the specification.** Trace architecture, data flow, state ownership, dependencies, integrations, persistence, lifecycle, UI interactions, tests, and cross-system effects. Use system-wide context to produce a coherent spec while preserving the writer's intent. Explicitly identify affected systems, assumptions, constraints, risks, and integration points.
4. **Detailed and stay true.** Every original idea must appear fully in the spec. New sections serve the original idea, never replace it.
5. **Clearly note proposed changes.** If the original idea has issues (infeasibility, conflicts, etc.), put them in a separate "Notes / Suggestions" section with reasons and alternatives. Do not silently modify the original idea.
6. **Confirm before finalizing** if the idea is ambiguous. Ask clarifying questions instead of guessing.

### E8. Development Phase

- The project is in a development build. Save-migration correctness does NOT need to be maintained or verified — breaking compatibility with old saves is acceptable in this phase. Do not spend effort on save migrations.

### E9. UI Layout Rule: Flexible / Fit-to-Container

- Grid slots, cards, items per row / page must be FLEXIBLE based on the actual container — fit the card or panel that contains them.
- On window resize, the layout must self-adapt: no breakage, no overflow, no dead whitespace, no hard-coded column counts or pixel widths from the dev screen.
- The project's standard pattern: CSS `auto-fill / minmax` for columns + `ResizeObserver` measuring `contentRect` (see `usePanelPagination` columnWidth, `useBagGridLayout`). Measure, do not assume.
- Forbidden: fixed `px` width for the main region, hard-coded column counts, paginating across the wrong layout type (vertical list vs multi-column grid).

### E10. Focused Changes Over Rewrites

- Prefer small, targeted edits to large rewrites. Rewrites are higher risk and harder to review.

### E11. Summary Format

- Every task summary must state:
  - What changed (files, sections, behavior).
  - What was verified (which verification mode from P3, results; QA verdict from P4 if applicable; code-review verdict from P5 if applicable).
  - Any remaining limitations, follow-ups, or Notes / Suggestions.

### E12. Worktree Workflow

- When P2 triggers a worktree, load the `using-git-worktrees` skill to follow the project's create-isolated-workspace workflow (detection, placement, branch, setup, baseline).
- When closing a worktree (merge done, branch cleanup, release), load the `finishing-a-development-branch` skill to follow the project's wrap-up workflow.

### E13. Verification Meta-Skill

- Before applying any verification gate (P3, P4, or P5), load the `verification-before-completion` superpowers skill for the cross-cutting checklist (evidence collection, claim qualification, common gaps).
- The meta-skill does not replace P3 / P4 / P5; it is the umbrella that frames them.

### E14. Code-Review Workflow

- When the user explicitly requests a review of a change, load the `requesting-code-review` superpowers skill to structure the request.
- When responding to feedback from a reviewer (human or AI), load the `receiving-code-review` superpowers skill to evaluate and act on each item.
- These complement P5 (which is about proactively running the `code-review` skill before declaring done).

### E15. Systematic Debugging

- When a bug, exception, or unexpected behavior appears, load the `systematic-debugging` superpowers skill before guessing at a fix.
- Reproduce first, isolate, then diagnose. The skill's order is intentional; do not skip to a fix because the cause seems obvious.

### E16. Test-Driven Development

- When writing new tests or fixing a bug, load the `test-driven-development` superpowers skill and follow its red-green-refactor cycle.
- Prefer to express the intended behavior as a failing test before writing the production code. Existing tests that already cover the area may be reused.

---

## Part 3 — Opencode Agent Wiring

Opencode supports per-agent system prompts via `.opencode/agent/<name>.md` files. The file body becomes the agent's prompt, which is higher priority than `AGENTS.md` (treated as instructions). To make the Protection Rules reliably trigger, the rules in Part 1 are also embedded into the four built-in agent prompts.

### Agent files

- `.opencode/agent/build.md` — primary agent that edits code. Embeds all 16 Protection rules.
- `.opencode/agent/plan.md` — primary agent for spec / planning without edits. Embeds P1, P2, P6, P7, P8, P9, P10, P11. Does not need P3 / P4 / P5 / P12 / P13 / P14 / P15 / P16 because it does not ship code.
- `.opencode/agent/general.md` — primary fallback agent with the same Protection surface as `build.md`.
- `.opencode/agent/explore.md` — primary read-only research agent. Embeds P1, P2, P6, P7, P8, P10. Does not need P3 / P4 / P5 / P9 / P12 / P13 / P14 / P15 / P16.

### Sync rule

- Part 1 is the source of truth for humans. The four agent files mirror Part 1 into each agent's system prompt.
- When Part 1 changes, update the relevant agent files in the same change. Drift between Part 1 and the agent prompts is a bug.

### Restart

- After creating or editing any agent file or `AGENTS.md`, the user must quit and restart opencode. Config is loaded once on startup and is not hot-reloaded.
