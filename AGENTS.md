# Project Agent Rules

- The application root is `game/`.
- The stack is Vue 3, TypeScript, Vite, Vitest, Pinia, and Phaser.

This document is the human-readable source of truth for project agent rules.

Four categories:

- **Part 1 — Protection Rules (P1-P17):** hard rules the agent must NOT bypass. Critical rules are mirrored into `.opencode/agent/<name>.md` system prompts.
- **Part 2 — Architecture Constitution (A1-A12):** project-wide architecture laws. New code must follow them; existing violations should be fixed when they are inside the authorized architectural responsibility.
- **Part 3 — Effectiveness Guidelines (E1-E16):** workflow guidance the agent reads and applies when relevant. May skip with reason.
- **Part 4 — Opencode Agent Wiring:** how Part 1 is replicated into the built-in Opencode agent prompts.

When a rule says "the agent", it means whichever coding agent is currently active.

Deleted `TASK.md` files, stale worklogs, historical implementation notes, and explicitly obsolete plans are not current requirements.

Project intent: build a headlessly testable game from stable primitives and composable mechanisms, with one authority per rule and state. Repair the smallest coherent responsibility and migrate its real consumers; do not optimize for file count, line count, or a green suite alone. Preserve gameplay intent rather than silently redesigning it.

Use `AstraDoctrine.md` for the reasoning workflow. Findings are evidence of defects, not new product requirements or authorization for an unrelated rewrite.

---

# Part 1 — Protection Rules (Enforced)

### P1. Worktree Boundary + Safe Deletion

- Operate strictly inside the worktree you were given. All file edits, scripts, and tests must run inside it.
- File or directory deletion (`rm`, `Remove-Item`, editor delete, or any indirect form) is allowed **inside the worktree** without further authorization — the worktree is a sandbox, deletion there is not dangerous.
- For any action **outside the worktree** (other branches, the main checkout, sibling worktrees), obtain explicit user authorization first.
- Treat crossing the worktree boundary the same as committing: the user decides.

### P2. Worktree MUST (except docs)

- Multi-file features, risky changes, implementation plans, architectural changes, and delegated work MUST be done in a dedicated worktree.
- Create the worktree via the `using-git-worktrees` skill.
- Project convention: `<repo-root>/.agent-worktrees/<task-name>`, using a kebab-case task name and the branch prefix produced by the skill.
- Small focused changes may remain in the current worktree when isolation is unnecessary.
- **Documentation exception:** editing `*.md` files, including this `AGENTS.md` and `game/docs/**`, is allowed without a worktree.
- For a documentation edit without a worktree, record in the summary: reason, time/date or turn, and file/section changed.
- Never manually substitute raw `git worktree add` for the project workflow.

### P3. Smart Verification (2 modes: `quick` or `full`)

Verification is binary. Do not invent intermediate modes.

**`quick`**

```text
npm.cmd run type-check
npx.cmd vitest run <relevant scope>
```

Default for normal focused code changes.

**`full`**

```text
npm.cmd run type-check
npm.cmd run build
npx.cmd vitest run
```

Use `full` when the change touches:

- `vite.config.ts`
- `tsconfig.json`
- `vitest.config.ts`
- `package.json`
- `package-lock.json`
- dependencies
- asset/build pipelines
- broad shared infrastructure
- Pinia root state
- router/application infrastructure
- Phaser scene infrastructure
- major architecture
- milestone/release readiness
- or when explicitly requested.

Otherwise use `quick`.

- Stop on the first failure.
- Fix it, then rerun the same mode.
- Do not repeat successful verification unless code or environment materially changed.
- Failures introduced by the task must be fixed before declaring complete.

### P4. Adversarial QA Gate

After implementing a feature or bug fix, run `tutienidle-adversarial-qa` in quick mode before claiming completion.

Use deep mode:

- when explicitly requested;
- before milestone/release readiness;
- when quick QA uncovers materially broad risk such as save/cloud, time/offline, economy/progression, or Vue/Pinia/Phaser lifecycle.

During QA, writes are restricted to:

```text
game/src/**/*.test.ts
game/tests/e2e/**/*.spec.ts
game/tests/e2e/helpers.ts
game/docs/qa/**
```

Production code must not be modified during a QA-only pass.

If QA proves a production defect:

```text
exit QA
→ return to development workflow
→ fix
→ verify
→ rerun QA
```

A defect is confirmed only by:

- deterministic reproduction;
- failing test;
- or direct runtime evidence.

Verdicts:

- `PASS WITH EVIDENCE` — may declare complete.
- `FAIL WITH REASON` — may still represent completion only when the reason is legitimate and specific.
- `PASS WITH GAPS` — not complete.
- `BLOCKED` — not complete.

### P5. Code-Review Hard Block

Before declaring a non-trivial production change complete, run the `code-review` skill from `anthropics/knowledge-work-plugins`.

The reviewed diff must already have received the E3 simplification pass.

Preferred order:

```text
implement
→ simplify
→ verify
→ code review
→ final evidence
```

Non-trivial means approximately:

- five or more changed lines of production behavior;
- any new production file;
- any touched production file beyond pure rename/comment/formatting.

Ignore findings below confidence 80.

Findings at confidence 80 or above must be resolved unless explicitly accepted by the user.

### P6. Multi-Agent Coordination

Before editing, including before delegated editing:

```text
git status
```

Check for overlapping uncommitted changes.

If overlapping work exists that the current agent did not author, stop and notify the user.

Delegated agents must report:

- **Worktree path**
- **Branch**
- **Files changed**
- **Verification evidence**
- **Remaining limitations**

The coordinator remains responsible for aggregate diff reasoning and final verification.

Subagents and coordinators must obey P7.

Execution mode depends on actual capability:

- Claude Code sessions with Agent/Task-style delegation: prefer Subagent-Driven Development when appropriate.
- Opencode agents without subagent dispatch: use Inline Execution / `executing-plans`.
- Tool availability, not habit, determines execution mode.

### P7. No Commit / Push / Deploy + Destructive Git Protection

The user is the final authority for:

- commit
- merge
- integrate
- push
- deploy.

Never perform them without explicit current authorization.

The following destructive commands always require explicit authorization:

```text
git reset --hard
git clean -fd
git clean -fdx
git push --force
git push -f
git branch -D
git stash drop
git stash clear
git checkout .
git checkout -- <path>
git restore .
git restore --staged .
```

Normal inspection and non-destructive Git operations remain allowed.

File deletion is governed by P1.

### P8. No `any` Unless Genuinely Necessary

Do not introduce TypeScript `any` when a sound type can reasonably be expressed.

Prefer:

```text
specific type
→ generic constraint
→ unknown + validation/type guard
→ any only when genuinely unavoidable
```

Any introduced `any` is technical debt and must be mentioned in the summary.

### P9. Architecture or Dependency Changes Require Architectural Scope

Do not silently change:

- folder layout;
- module boundaries;
- public store/service APIs;
- Phaser scene topology;
- dependencies;
- authoritative state ownership;

during an unrelated task.

Architecture work is allowed when:

- explicitly requested;
- required to correctly restore the authorized system boundary;
- or part of an approved migration.

A root-cause fix may legitimately cross several files or modules when they form one coherent architectural responsibility.

Unrelated architectural cleanup remains out of scope.

### P10. Scope Follows Responsibility, Not the First Symptom

Edit only what is required to complete the current task.

However, scope is **not** defined solely by the file where a bug or feature first appears.

If a symptom exists in A because the authoritative rule belongs in B, correctly repairing B and migrating A to use it is still in scope.

Preferred:

```text
symptom
→ identify violated invariant
→ identify authoritative owner
→ repair smallest coherent dependency chain
→ migrate affected consumer
→ stop
```

Do not expand from that responsibility into unrelated cleanup.

If another independent system appears problematic, report it as a Note / Suggestion.

### P11. No Secrets Exposure

Never read, log, print, or commit contents of:

```text
APIKey
.env
.env.*
.mcp.json
```

or files containing credentials, bearer tokens, private keys, or similar secrets.

Treat them as opaque configuration boundaries.

### P12. Fix Verification Failures Caused by the Implementation

If verification fails because the current task introduced or worsened the failure, fix it before declaring complete.

Distinguish clearly between:

- task-caused regression;
- pre-existing failure;
- coverage gap;
- environment limitation.

### P13. Runtime Wiring Verification

**Why this rule exists:** a previous refactor extracted application lifecycle logic while leaving the actual `GameManager.update()` driving path unwired. Thousands of unit tests remained green while runtime progression completely stopped.

The unit suite proves engine logic, not application wiring.

A change is wiring-critical when it touches areas such as:

```text
App.vue
game/src/composables/useAppLifecycle.ts
boot/mount lifecycle
simulation timers
GameManager.update() driving paths
Phaser scene lifecycle
Vue ↔ Phaser bridges
runtime registration
```

For wiring-critical changes:

- P3 quick verification is insufficient;
- run the relevant Playwright E2E suite;
- where feasible, drive the actual behavior and verify that simulation advances.

A boot-only smoke test does not prove runtime progression.

An extracted helper/composable/system is not complete until all production consumers are correctly rewired.

Do not delete, skip, or weaken guard tests intended to detect orphaned runtime wiring.

If runtime behavior is "nothing happens and no error", investigate missing invocation/wiring before assuming lower-level logic is broken.

### P14. Visual/Runtime Verification via Playwright

Type-checking and Vitest/jsdom cannot verify:

- Phaser canvas rendering;
- actual animation advancement;
- sprite/VFX visibility;
- CSS hover/drag-over states;
- transitions;
- z-index/overlap;
- responsive rendering;
- native browser drag/drop;
- other real-render behavior.

Trigger P14 when correctness materially depends on these behaviors.

For triggering changes, load `playwright-cli` and inspect the actual feature in a real browser.

#### Project procedure

1. Start the development server:

```text
npm.cmd run dev
```

Read the Local URL printed by Vite. Do not assume a fixed port.

2. Prefer MS Edge.

The global `playwright-cli` binary is not assumed to exist.

If unavailable, use:

```text
npx playwright cli <command>
```

Every `playwright-cli <x>` instruction maps to `npx playwright cli <x>` when needed.

3. Navigate to the actual affected screen or gameplay flow.

4. Capture a snapshot/screenshot and visually inspect the result.

"No console error" alone is not sufficient evidence.

5. For native HTML5 drag/drop, ordinary Playwright drag helpers may not fire this project's Vue handlers reliably.

When necessary, dispatch real `DragEvent` / `DataTransfer` objects through browser evaluation.

6. Do not dispatch an interaction and synchronously read the resulting Vue DOM state in the same evaluation call.

Vue updates may occur on the next microtask.

Dispatch first; inspect in a later operation.

7. Inspect browser console output.

8. Close the browser session.

9. Remove scratch browser artifacts such as:

```text
.playwright-cli/
ad-hoc screenshots
ad-hoc snapshots
stray *.png
stray *.yml
```

unless they are intentional test artifacts.

State exactly what was visually confirmed in the final summary.

P14 supplements rather than replaces P13, P4, or P3.

#### Isolated-worktree exception

Playwright browser launch/attachment has been observed to be unreliable inside isolated sandbox worktrees such as:

```text
.claude/worktrees/**
.agent-worktrees/**
```

Do not repeatedly burn time retrying browser automation in that environment.

Instead:

1. complete all permitted implementation and non-browser verification in the worktree;
2. report `DONE_WITH_CONCERNS`;
3. explicitly state that P14 live-browser verification is deferred because the isolated worktree cannot reliably perform it;
4. perform the browser verification from an authorized main/preview checkout during branch finishing/integration before treating the change as fully verified.

Deferral is allowed.

Silent omission is not.

### P15. Code Comments in English Only

All new or modified source-code comments in `.ts`, `.vue`, `.js`, and similar source files must use English plain ASCII.

This prevents Windows encoding/mojibake regressions.

This does not prohibit Vietnamese in:

- localized UI;
- documentation;
- user-facing responses;
- appropriate content data.

Do not perform unrelated mass comment translation.

### P16. Vietnamese Text Confined to the i18n Gateway

New Vietnamese UI chrome must not be hardcoded directly into Vue templates, Vue scripts, or TypeScript presentation code.

Use the project's `vue-i18n` gateway and established patterns such as:

```text
useI18n({ useScope: 'local' })
t('...')
```

This applies to UI chrome such as:

- buttons;
- panel titles;
- errors;
- toasts;
- navigation;
- labels.

Code comments are governed by P15.

This rule is not a mandate to migrate all historical Vietnamese content.

Data-driven Vietnamese content under areas such as `data/**` remains an accepted separate convention unless an explicit localization migration changes that policy.

When a substantially touched UI file contains nearby hardcoded UI chrome, migrating the immediately relevant strings is encouraged when coherent and low-risk.

### P17. Runtime / Presentation / Logic Separation

Each subsystem must do its own job.

A runtime/clock system owns timing.

Presentation owns rendering, animation, VFX, and visual playback.

Gameplay systems own authoritative rules.

Damage/effect resolution belongs to the relevant gameplay authority.

Presentation may acknowledge playback completion, but must not determine gameplay outcomes.

Gameplay must not manipulate Phaser internals.

Coordination must happen through explicit contracts such as:

- typed calls;
- commands;
- events;
- acknowledgments;
- read-only state queries.

One system must not directly mutate another system's private state.

When timing, presentation, and business logic become mixed in the same function or class, treat it as an architectural defect rather than a style preference.

#### Combat contract and maintained references

Before modifying `game/src/core/battle/turn/**`, GameManager battle-tick integration, or `CombatScene.ts`, establish the current state-machine and presentation-timing contract from maintained documentation, production consumers, and tests.

The previously required `docs/superpowers/specs/2026-09-07-turn-based-combat-reference.md` is absent as of 2026-09-08. Do not claim to have read it or reconstruct requirements from deleted plans. Until a maintained replacement exists, record the relevant contract and evidence in the task's design/QA documentation before changing that behavior. Distinguish intended behavior from observed defects; ask only when unresolved ambiguity changes product intent.

An intentional contract change must update its maintained reference in the same coherent change. Verify that required reference paths exist; do not treat a missing document as either permission to invent behavior or a reason to abandon otherwise authorized work.

---

# Part 2 — Architecture Constitution

These rules apply project-wide.

They are deliberately short.

Detailed architecture should live in maintained architecture/domain documentation, not be expanded indefinitely inside `AGENTS.md`.

### A1. Build From Stable Primitives

Prefer:

```text
primitive
→ reusable mechanism
→ domain system
→ orchestrator
→ presentation
```

over feature-local patches.

Before adding another local exception, ask whether a stable lower-level building block is missing.

Primitive-first does **not** mean abstraction-first.

A primitive must represent a real, stable concept and remove actual complexity.

### A2. One Rule, One Owner

Every semantic rule must have one authoritative owner.

Examples:

```text
damage formula        → damage authority
HP/MP/Ward mutation   → vitals authority
buff lifecycle        → buff authority
inventory mutation    → inventory authority
equipment calculation → equipment/stat authority
realm progression     → progression authority
animation playback    → presentation authority
```

Do not independently implement the same semantic rule in multiple places.

An authoritative operation owns its complete outcome contract. Damage variants (including bonus, periodic, and true damage) must preserve the applicable vitals, survival/death, and event rules. Callers consume the resolved hit/effect result rather than independently inferring whether it landed, crit, or killed.

Required execution context must be supplied by production callers. Do not hide missing sources, policies, or collaborators behind a default that silently changes gameplay.

### A3. One Mutable State, One Authority

For important mutable state, the project must be able to answer:

```text
Who owns it?
Who may write it?
Who may read it?
Who resets it?
Who persists it?
```

Other systems request changes through the owner's explicit API.

They do not directly mutate another domain's internals.

Gameplay queries must not activate, claim, reset, or advance authoritative state. Lifecycle commands run independently of screen visibility.

Paid or random preview results remain domain-owned, bound to the relevant operation/item/session, and accepted by identity at most once. Presentation receives a display copy; commit validates current eligibility and cannot accept caller-invented outcomes.

Save snapshots must be detached values. Restore must have explicit identity, replacement/reset, and repeat-application semantics; it must not duplicate inventory or emit new-acquisition rewards. A partial fingerprint is not proof that a payload is unchanged.

Async work must have an explicit lifecycle owner, cleanup, and stale-result policy. Where sessions or operations can overlap, validate their identity/generation; a shared boolean is not sufficient. Derived copies need an explicit refresh/invalidation contract or should be read from their owner.

### A4. No Long-Arm Systems

A system must not perform another system's responsibility merely because it has access to the data.

Examples of violations:

```text
Damage engine applies a cultivation-specific buff.
CombatScene edits authoritative HP.
UI calculates authoritative equipment formulas.
Skill code manually mutates target health.
Crafting manipulates inventory internals.
Save logic decides gameplay progression.
Generic manager contains detailed rules for every subsystem.
```

Repair the ownership boundary rather than adding another bypass.

### A5. Orchestrators Coordinate; They Do Not Absorb Domain Rules

Managers/coordinators may know several systems.

Their job is sequencing:

```text
validate
→ call owner A
→ call owner B
→ publish/return result
```

They should not reproduce formulas or directly manipulate another system's internals.

Large orchestrators are acceptable when their size comes from coordination rather than accumulated domain logic.

Extracting a helper is not transferring ownership if it still reaches into the original object's private state. Move the state, lifecycle, and rule together behind a narrow contract.

### A6. Dependencies Point Toward Foundations

Preferred conceptual direction:

```text
foundation
→ domain primitives
→ mechanisms
→ domain systems
→ orchestration
→ presentation
```

Lower layers must not depend on higher layers.

Core gameplay should remain independent of Vue and Phaser where practical and should be headlessly testable.

Shared contracts and constants belong below their consumers. Check transitive dependencies and runtime cycles as well as direct imports; type-only imports do not justify putting a domain contract under presentation.

### A7. Presentation Is Not Gameplay Authority

Vue and Phaser may:

- render;
- animate;
- collect input;
- issue commands;
- acknowledge presentation completion.

They must not calculate or determine authoritative gameplay outcomes.

Presentation failure must not silently change gameplay state.

Visual arrival, animation completion, and UI mounting must not award resources, spend costs, activate progression, or originate authoritative gameplay events. A runtime-owned protocol may use acknowledgments to pace actions and request domain-owned transitions, with explicit stale/duplicate handling and fallback when presentation is unavailable. The acknowledgment is not the authority for the outcome.

### A8. Generic Mechanisms Must Not Accumulate Content Special Cases

Skills, buffs, items, talents, enemies, stages, recipes, formations, and similar content should normally compose reusable engine capabilities.

Generic systems should not accumulate arbitrary checks such as:

```text
if skillId === ...
if buffId === ...
if itemId === ...
```

unless that identity genuinely belongs to the system.

When special behavior reveals a stable category of variation, introduce the smallest appropriate mechanism, effect, trigger, condition, policy, or resolver.

Do not create one abstraction per content item.

Adapters and content converters must preserve supported semantics: targeting, effect scope/order, conditions, and execution policy. Reject or explicitly report unsupported content; never silently replace it with a default attack or discard effects. Verify authored content against the actual execution capabilities.

### A9. Shared Rule, Single Implementation

The same semantic formula or rule must not be copied between:

- runtime and preview;
- UI and engine;
- old/new systems;
- buff and damage code;
- equipment UI and equipment logic;
- crafting preview and crafting execution.

Consumers must use the authoritative rule owner.

This includes online/offline allocation and operation-specific eligibility, costs, and previews. Share semantic rules while keeping genuinely different clocks and explicit time units separate.

Distinguish raw/base, resolved, and effective stats in contracts. Apply attribute derivation and modifiers exactly once, preserving the provenance needed for recomputation.

Failed exchanges preserve all involved balances. Acquisition receipts distinguish requested, delivered, and overflow amounts, and callers must handle them. Do not report a full grant from a partial delivery. Use the smallest domain operation that enforces these guarantees; do not introduce a universal transaction framework without demonstrated need.

### A10. UI Must Compose Canonical Primitives

UI should grow from reusable pieces rather than panel-local implementations.

Conceptually:

```text
design tokens
→ layout primitives
→ interaction primitives
→ game UI primitives
→ domain components
→ feature panels/screens
```

Examples may include:

```text
Surface
Grid
Stack
Button
Tooltip
Modal
ProgressBar
Slot
ItemIcon
StatRow
CostDisplay
SkillNode
EquipmentSlot
```

These names are examples, not mandatory abstractions.

Do not create universal mega-components.

Do not duplicate an existing primitive because local implementation is faster.

Canonical interaction primitives own keyboard and accessibility semantics. When Vue and Phaser share a layout, rendering and hit testing must use the same measured projection rather than independently copied dimensions.

Asset resolution and preload enumeration should derive from one canonical catalog. Validate externally derived asset paths against the intended destination before filesystem operations.

### A11. Fix Root Causes, Not Symptoms

Before fixing a non-trivial problem, ask:

```text
What invariant is broken?
Who should own it?
Why did this workaround become necessary?
Is a primitive/mechanism missing?
Is ownership duplicated?
Is dependency direction wrong?
```

Prefer the smallest **coherent architectural change**, not the smallest textual patch.

Do not use root-cause reasoning as permission for unrelated cleanup.

### A12. Characterize Before Migration; Do Not Overengineer

Before structurally moving working behavior:

```text
identify intended behavior
→ inspect production consumers
→ add characterization coverage when needed
→ migrate one coherent path
→ verify
→ remove old authority only after migration
```

Do not delete code merely because it appears legacy.

Prove its consumer status.

Do not introduce abstractions for hypothetical future needs.

Every abstraction must pay rent.

Characterize the real production input and consumer chain before replacing an execution path. Substitute test entities or configuration do not establish migration parity. Cover relevant raw/resolved data, required collaborators, runtime capacities, and authored content through actual factories/composition roots.

Migrate in runnable vertical slices. Search for duplicate authorities and inspect callers, preview, persistence, reset/cleanup, error paths, and downstream events before retiring the old path. Classify adapters as live, transitional, or unused with evidence; casts, no-op bridges, and partial compatibility objects must not conceal an incomplete migration.

For client/storage/server boundaries, verify the current schema and capability contract together. Do not infer an implemented cloud/backend capability from an interface or configuration alone.

---

# Part 3 — Effectiveness Guidelines

The agent reads these guidelines and applies them when the task matches the trigger.

Skipping is allowed with a reason stated in the summary.

### E1. UI/UX Skill Requirement

For every task that designs, builds, reviews, or materially changes UI/UX, use `ui-ux-pro-max` before design or implementation decisions.

This includes:

- pages;
- components;
- design systems;
- styling;
- layout;
- responsive behavior;
- accessibility;
- interactions;
- animation;
- typography;
- visual hierarchy.

Read:

```text
.agents/skills/ui-ux-pro-max/SKILL.md
```

and follow Vue-specific guidance where relevant.

Skip only for entirely non-visual work.

If unavailable, report the limitation.

### E2. Stack Reference Skills

Edit/create `.vue` files under `game/src/**`:

- load `vue-best-practices`;
- also load `vue-pinia-best-practices` when Pinia is involved.

Code importing Phaser or instantiating `new Phaser.*`:

- load `phaser-core`;
- also load `phaser-arcade-physics` when using Arcade Physics.

The general `vue` skill may supplement project-specific Vue guidance.

Skip only for trivial formatting/comment/typo work.

### E3. Code-Simplifier Before Review

After substantial production-code edits — approximately five or more changed production lines or any new production file — run `code-simplifier` before P5.

Pipeline:

```text
implement
→ simplify
→ verify
→ code review
→ done
```

Simplification must preserve behavior.

If simplification would alter behavior, skip that candidate and report it.

If a P5 fix introduces substantial new code, simplify and review the material fix again.

The user may explicitly waive simplification for a task.

### E4. Game System Skills

Use `balance-check` when changing:

- economy;
- progression;
- difficulty;
- reward;
- skill tree;
- cultivation curve.

Use `improve-game` for new gameplay features or flow redesign.

Use `game-qa` for player-reported bugs or regression investigations.

For combat skill/content work involving areas such as:

```text
game/src/data/skill
game/src/data/progression
SkillEffect
Skill
ProgressionNode
ailments
reactions
element-skill behavior
```

load `tutienidle-skill-design`.

### E5. Performance Skill

Before shipping runtime-heavy work involving:

- FPS;
- save size;
- large scenes;
- heavy animation;
- long sessions;

load the `performance` skill.

This is a review pass, not a replacement for verification.

### E6. E2E Testing Skills

Writing E2E tests under:

```text
game/tests/e2e/**
```

requires `playwright-best-practices`.

Interactive browser verification requires `playwright-cli` and P14's project-specific workflow.

Vitest remains the default for unit and ordinary integration tests.

### E7. Planning & Idea Preservation

When the user requests a specification or plan:

1. Preserve the user's original intent.
2. Do not silently remove, replace, split, or redesign requested ideas.
3. Research and add implementation detail, dependencies, state flow, tests, risks, and architecture implications without altering product intent.
4. Review connected systems including architecture, state ownership, persistence, lifecycle, UI interaction, tests, and cross-system effects.
5. Put proposed product changes in a separate **Notes / Suggestions** section.
6. When ambiguity materially changes product intent and cannot be resolved from repository evidence, ask for clarification when the execution context allows it.

For substantial system work, identify:

```text
Requirement
Current evidence
Authoritative owner
Existing primitives
Missing primitives/mechanisms
State owner
Affected dependency chain
Migration boundary
Verification strategy
Explicitly out of scope
```

For long architectural missions, keep this as a concise ledger with current versus target authority, migrated consumers, verification status, and retained debt. Audit before a broad refactor; build foundations first and migrate one complete production path at a time.

### E8. Development Phase

The project is currently a development build.

Backward compatibility with old development saves does NOT need to be maintained unless explicitly requested.

Breaking old development-save compatibility is acceptable when required for correct current schema or architecture.

Do not spend effort on save migrations by default.

### E9. UI Layout Rule: Flexible / Fit-to-Container

Grid slots, cards, rows, and pagination must derive from the actual container.

Layouts must adapt to resizing without:

- overflow;
- broken composition;
- unjustified dead space;
- hard-coded column counts tied to the developer screen.

Preferred mechanisms include:

```text
CSS auto-fill / minmax
ResizeObserver
contentRect measurement
```

and existing project mechanisms such as:

```text
usePanelPagination
useBagGridLayout
```

when they are the correct owner.

Measure rather than assume.

### E10. Focused Changes Over Patchwork or Rewrite

Prefer small coherent changes to giant rewrites.

However:

> small means the smallest coherent architectural responsibility, not the fewest changed lines.

Do not patch only the nearest file when the violated invariant clearly belongs to another owner.

Preferred:

```text
identify invariant
→ identify owner
→ repair smallest required primitive/mechanism
→ migrate affected consumer
→ verify
→ stop
```

Do not continue into unrelated cleanup.

### E11. Summary Format

Every task summary must state:

- what changed;
- relevant files/systems;
- behavior affected;
- verification evidence;
- QA verdict when applicable;
- code-review verdict when applicable;
- P13/P14 evidence when applicable;
- remaining limitations;
- known retained debt;
- Notes / Suggestions.

### E12. Worktree Workflow

When P2 requires a worktree, use `using-git-worktrees`.

When closing/integrating an authorized branch/worktree, use `finishing-a-development-branch`.

P7 still governs commit/merge/integration authority.

### E13. Verification Meta-Skill

Before applying P3, P4, or P5 completion gates, load `verification-before-completion`.

It supplements rather than replaces project-specific verification rules.

Make repeated architectural failures executable through focused types, validators, integration tests, or dependency checks within the authorized scope. Verify effective configuration, not merely the presence of a lint rule or script.

A green aggregate suite is not proof of semantic parity. Exercise the violated invariant with production inputs and wiring; preserve existing guards until equivalent behavioral coverage is demonstrated. Documentation-only changes need consistency, reference, and mirror checks rather than production test runs.

### E14. Code-Review Workflow

When the user explicitly requests review, use `requesting-code-review`.

When responding to review feedback, use `receiving-code-review`.

These complement P5.

### E15. Systematic Debugging

When investigating a bug, exception, or unexpected behavior, load `systematic-debugging`.

Preferred order:

```text
reproduce
→ identify violated invariant
→ isolate owner
→ diagnose root cause
→ create regression evidence where practical
→ repair correct layer
→ verify
```

Do not jump directly to a speculative patch because the cause appears obvious.

### E16. Test-Driven Development

When writing new tests or fixing a bug, load `test-driven-development`.

Prefer:

```text
red
→ green
→ refactor
```

where practical.

Existing tests may serve as characterization coverage.

For structural migration, capture intended behavior before moving responsibility.

---

# Part 4 — Opencode Agent Wiring

Opencode supports per-agent system prompts under:

```text
.opencode/agent/<name>.md
```

The body of those files becomes a higher-priority agent prompt than repository instruction files such as `AGENTS.md`.

Therefore critical Protection Rules are mirrored into the appropriate Opencode agent files.

`AGENTS.md` remains the human-readable source of truth.

### Agent files

- `.opencode/agent/build.md` — primary code-editing agent. Mirrors all applicable **P1-P17** Protection Rules.
- `.opencode/agent/plan.md` — planning/specification agent. Mirrors the Protection Rules relevant to planning/research, including P1, P2, P6, P7, P8, P9, P10, and P11. It must also follow Part 2 when proposing architecture.
- `.opencode/agent/general.md` — fallback implementation agent. Uses the same Protection surface as `build.md` when capable of modifying production code.
- `.opencode/agent/explore.md` — read-only research agent. Mirrors the subset of Protection Rules relevant to safe research, worktree boundaries, Git safety, scope, and secrets.

Do not mirror the entire Architecture Constitution into every agent system prompt by default.

Part 2 remains repository-level architecture guidance.

If repeated evidence shows that a specific architecture rule is frequently violated because repository instructions have insufficient priority, mirror only that critical subset into the relevant agent prompt.

### Sync rule

Part 1 is the Protection source of truth.

Whenever a Protection Rule changes, update every affected `.opencode/agent/*.md` mirror in the same coherent change.

Semantic drift between Part 1 and higher-priority agent prompts is a project defect.

Agent-specific prompts may be stricter than `AGENTS.md`.

They must not weaken it.

### Restart

After editing:

```text
AGENTS.md
.opencode/agent/*.md
```

quit and restart Opencode.

Agent configuration is loaded at startup and must not be assumed to hot-reload.