# Project Agent Rules

Root: `game/`. Stack: Vue 3, TypeScript, Vite, Vitest, Pinia, Phaser.

**This file = rules (how to work). `game/docs/roadmap.md` = current architecture state** (which system owns what right now, which R-mission is done/in-progress/parked). Read the relevant roadmap phase before touching combat, save/restore, inventory, production, or quest code — do not assume an architecture rule below describes what's *currently* implemented; roadmap.md does. Don't duplicate roadmap content here.

4 parts:

1. **Protection Rules (P1-P17)** — hard rules, do not bypass. Critical ones are mirrored into `.opencode/agent/<name>.md`.
2. **Architecture Constitution (A1-A12)** — project-wide laws. New code follows them; fix existing violations only within your authorized scope.
3. **Effectiveness Guidelines (E1-E17)** — workflow guidance, skip with a stated reason.
4. **Opencode Agent Wiring** — how Part 1 is mirrored into agent prompts.

"The agent" = whichever coding agent is active. Deleted `TASK.md`/stale worklogs/obsolete plans are not current requirements. Use `AstraDoctrine.md` for the reasoning workflow — findings are evidence of defects, not authorization for an unrelated rewrite.

**Project intent:** headlessly testable game, stable primitives, one authority per rule/state. Repair the smallest coherent responsibility and migrate its real consumers. Don't optimize for file/line count or a green suite alone. Preserve gameplay intent — don't silently redesign it.

---

# Part 1 — Protection Rules (Enforced)

**P1. Worktree boundary.** Edits/scripts/tests only inside your given worktree. Deleting files *inside* it needs no extra authorization (it's a sandbox). Anything *outside* it (other branches, main checkout, sibling worktrees) needs explicit user authorization — treat it like a commit decision.

**P2. Worktree required** for multi-file features, risky changes, plans, architecture changes, delegated work. Create via `using-git-worktrees` → `.agent-worktrees/<kebab-task-name>`. Small focused changes can skip it. **Exception:** editing `*.md` (including this file, `game/docs/**`) never needs a worktree — just note reason/time/file in the summary.

**P3. Verification — 2 modes only, no in-between:**
- `quick` (default): `npm run type-check` + `npx vitest run <relevant scope>`
- `full`: `npm run type-check` + `npm run build` + `npx vitest run` — use when touching `vite.config.ts`, `tsconfig.json`, `vitest.config.ts`, `package.json`/lock, deps, asset/build pipeline, Pinia root state, router, Phaser scene infra, major architecture, milestone/release readiness, or when asked.

Stop on first failure, fix, rerun same mode. Don't re-verify unchanged code. Fix task-caused failures before declaring done.

**P4. Adversarial QA gate.** After a feature/fix, run `tutienidle-adversarial-qa` (quick) before claiming done. Deep mode: when asked, before milestone/release, or when quick QA surfaces broad risk (save/cloud, time/offline, economy/progression, Vue/Pinia/Phaser lifecycle). QA-pass writes are restricted to `**/*.test.ts`, `tests/e2e/**`, `docs/qa/**` — no production edits during QA. A defect needs deterministic repro / failing test / runtime evidence. Verdicts: `PASS WITH EVIDENCE` (done) / `FAIL WITH REASON` (done only if the reason is legitimate) / `PASS WITH GAPS` / `BLOCKED` (not done).

**P5. Code review hard block.** Before declaring a non-trivial change (≥5 changed production lines, any new production file, any touched file beyond rename/comment) complete, run `code-review` — after E3 simplification. Order: implement → simplify → verify → review → done. Ignore findings <80 confidence; resolve ≥80 unless the user explicitly waives them.

**P6. Multi-agent coordination.** `git status` before editing (including before delegating) — stop and notify the user if someone else's uncommitted work overlaps. Delegated agents report: worktree path, branch, files changed, verification evidence, remaining limitations. Coordinator owns aggregate diff reasoning + final verification. Use Subagent-Driven Development where Agent/Task-style dispatch exists; otherwise Inline Execution/`executing-plans` — capability decides, not habit.

**P7. No commit/push/deploy without explicit authorization.** The user alone authorizes commit, merge, integrate, push, deploy. Always-ask-first commands: `git reset --hard`, `git clean -fd[x]`, `git push -f`/`--force`, `git branch -D`, `git stash drop`/`clear`, `git checkout .`/`-- <path>`, `git restore .`/`--staged .`. Normal inspection/non-destructive git is fine. File deletion → P1.

**P8. No `any` unless genuinely necessary.** Prefer specific type → generic constraint → `unknown` + guard → `any` only as last resort. Any introduced `any` must be flagged in the summary.

**P9. Architecture/dependency changes need architectural scope.** Don't silently change folder layout, module boundaries, public store/service APIs, Phaser scene topology, dependencies, or state ownership on an unrelated task. Allowed when explicitly requested, required to restore the authorized boundary, or part of an approved migration. A root-cause fix may span several files if they're one coherent responsibility — unrelated cleanup stays out of scope.

**P10. Scope follows responsibility, not the first symptom.** If a bug in A is really owned by B, fixing B and migrating A is in scope. Flow: symptom → violated invariant → authoritative owner → repair smallest coherent chain → migrate affected consumer → stop. Report unrelated problems as Notes/Suggestions, don't chase them.

**P11. No secrets exposure.** Never read/log/print/commit `APIKey`, `.env*`, `.mcp.json`, or credential/token/key files — treat as opaque.

**P12. Fix verification failures your task caused.** Distinguish task-caused regression vs. pre-existing failure vs. coverage gap vs. environment limitation; only the first blocks completion.

**P13. Runtime wiring verification.** *Why:* a past refactor extracted lifecycle logic but left `GameManager.update()` unwired — thousands of green unit tests, zero runtime progression. The unit suite proves engine logic, not wiring. For wiring-critical changes (`App.vue`, `useAppLifecycle.ts`, boot/mount, timers, `GameManager.update()` driving paths, Phaser scene lifecycle, Vue↔Phaser bridges, runtime registration): quick verification isn't enough — run the relevant Playwright E2E and actually drive the behavior. A boot-only smoke test doesn't prove progression. Don't delete/weaken wiring guard tests. "Nothing happens, no error" → suspect missing wiring before blaming lower-level logic.

**P14. Visual/runtime verification via Playwright.** Type-check/Vitest/jsdom can't see Phaser rendering, animation, sprite/VFX, CSS hover/drag/transitions/z-index, responsive layout, native drag/drop. When correctness depends on these, load `playwright-cli` and check in a real browser:
1. `npm run dev`, read the actual printed port (don't assume one).
2. Prefer MS Edge. No global binary → `npx playwright cli <command>`.
3. Navigate to the actual affected flow, screenshot, visually inspect — "no console error" alone isn't evidence.
4. Native HTML5 drag/drop may need real `DragEvent`/`DataTransfer` dispatched via browser evaluation (Playwright's drag helper may not fire Vue handlers).
5. Don't dispatch an interaction and read Vue DOM state in the same evaluation call — Vue may update next microtask. Dispatch, then inspect separately.
6. Check console output, close the session, clean up scratch artifacts (`.playwright-cli/`, ad-hoc screenshots/snapshots/`.png`/`.yml`) unless intentional test artifacts.
State exactly what was visually confirmed. P14 supplements P13/P4/P3, doesn't replace them.
*Isolated-worktree exception:* browser launch is unreliable inside `.claude/worktrees/**` / `.agent-worktrees/**`. Don't burn time retrying there — finish everything else, report `DONE_WITH_CONCERNS`, state P14 is deferred, and do the live-browser check from an authorized main/preview checkout during branch finishing. Deferral is fine; silent omission is not.

**P15. Code comments: English, plain ASCII only** (`.ts`/`.vue`/`.js`/similar) — prevents Windows mojibake. Vietnamese stays fine in localized UI, docs, user-facing responses, content data. Don't mass-translate unrelated comments.

**P16. Vietnamese UI text goes through the i18n gateway** (`useI18n({ useScope: 'local' })`, `t('...')`) — not hardcoded in templates/scripts for buttons, titles, errors, toasts, nav, labels. Comments → P15. Not a mandate to migrate all historical Vietnamese; `data/**` content stays as-is. Migrating nearby hardcoded strings in a file you're already substantially touching is encouraged when low-risk.

**P17. Runtime / presentation / logic separation.** Clock owns timing; presentation owns rendering/animation/VFX/playback; gameplay systems own authoritative rules (damage/effects resolve in the gameplay authority). Presentation may acknowledge playback completion, never determine outcomes or silently change gameplay state on failure. Gameplay must not touch Phaser internals. Cross-system coordination = typed calls/commands/events/acks/read-only queries, never direct private-state mutation. Visual arrival/animation/mounting must not award resources, spend costs, or activate progression — an ack-based protocol may *pace* actions but isn't the authority for the outcome. Mixed timing+presentation+business-logic in one function/class = architectural defect, not style.
*Combat contract:* before touching `game/src/core/battle/turn/**`, GameManager battle-tick integration, or `CombatScene.ts` — check `game/docs/roadmap.md`'s combat-chain phases (R1-R6) and current QA reports in `game/docs/qa/` for the maintained state-machine/presentation-timing contract; there is no single reference doc to reconstruct from. An intentional contract change updates its maintained reference (roadmap/QA doc) in the same coherent change.

---

# Part 2 — Architecture Constitution

Project-wide laws, deliberately terse. Detailed/current architecture lives in `game/docs/roadmap.md` and `game/docs/qa/**`, not here.

**A1. Build from stable primitives.** `primitive → reusable mechanism → domain system → orchestrator → presentation`, not feature-local patches. Before another local exception, ask if a lower-level primitive is missing. Primitive-first ≠ abstraction-first: a primitive must represent a real, stable concept and remove real complexity.

**A2. One rule, one owner.** Every semantic rule (damage formula, HP/MP/Ward mutation, buff lifecycle, inventory mutation, equipment calc, realm progression, animation playback, ...) has exactly one authoritative owner — never reimplemented elsewhere. An authoritative operation owns its whole outcome contract (damage variants must preserve vitals/survival/death/event rules); callers consume the resolved result, not infer it themselves. Required execution context comes from production callers — don't hide missing sources/policies behind a silent default.

**A3. One mutable state, one authority.** For important state, be able to answer: who owns/writes/reads/resets/persists it? Others request changes through the owner's API, never mutate internals directly. Gameplay *queries* must not activate/claim/reset/advance authoritative state — lifecycle commands run independent of screen visibility. Paid/random preview results are domain-owned, bound to the operation/item/session, accepted by identity at most once; presentation gets a display copy, commit validates current eligibility (never trusts caller-invented outcomes). Save snapshots are detached values; restore needs explicit identity, replacement/reset, and repeat-application semantics (no duplicate inventory, no repeat rewards) — a partial fingerprint doesn't prove a payload is unchanged. Async work needs an explicit lifecycle owner, cleanup, and stale-result policy; overlapping sessions need identity/generation checks, not a shared boolean; derived copies need an explicit refresh contract or should be read live from their owner.

**A4. No long-arm systems.** A system doesn't do another system's job just because it can reach the data (damage engine applying a cultivation buff, CombatScene editing HP directly, UI computing equipment formulas, skill code mutating target health, crafting touching inventory internals, save logic deciding progression, a "generic" manager absorbing every subsystem's rules). Repair the ownership boundary, don't add another bypass.

**A5. Orchestrators coordinate, don't absorb domain rules.** Managers sequence — `validate → call owner A → call owner B → publish/return` — they don't reimplement formulas or reach into another system's internals. Large orchestrators are fine when the size is coordination, not accumulated domain logic. Extracting a helper that still reaches into the original object's private state hasn't transferred ownership — move state+lifecycle+rule together behind a narrow contract.

**A6. Dependencies point toward foundations.** `foundation → domain primitives → mechanisms → domain systems → orchestration → presentation`; lower layers never depend on higher ones. Core gameplay stays independent of Vue/Phaser where practical, headlessly testable. Shared contracts/constants live below their consumers — check transitive/runtime cycles too, not just direct imports (a type-only import doesn't justify putting a domain contract under presentation).

**A7. Presentation is not gameplay authority.** Vue/Phaser render, animate, collect input, issue commands, acknowledge completion — never calculate/determine authoritative outcomes, and presentation failure must not silently change gameplay state. Visual arrival/animation/UI mounting must not award resources, spend costs, activate progression, or originate gameplay events; a runtime-owned ack protocol may pace actions with explicit stale/duplicate handling, but the ack is never the authority for the outcome.

**A8. Generic mechanisms don't accumulate content special cases.** Skills/buffs/items/talents/enemies/stages/recipes/formations compose reusable engine capabilities — generic systems shouldn't grow `if skillId === ...` / `if buffId === ...` / `if itemId === ...` unless that identity genuinely belongs there. A stable category of variation gets the smallest appropriate mechanism (effect/trigger/condition/policy/resolver) — not one abstraction per content item. Adapters/converters must preserve targeting, effect scope/order, conditions, execution policy — reject/report unsupported content explicitly, never silently downgrade to a default attack or drop effects; verify authored content against real execution capability.

**A9. Shared rule, single implementation.** The same formula/rule is never copied between runtime/preview, UI/engine, old/new systems, buff/damage code, equipment UI/logic, crafting preview/execution, online/offline allocation, or eligibility/cost/preview variants — all consume the one authoritative owner (share the rule, keep genuinely different clocks/time-units separate). Distinguish raw/base, resolved, and effective stats in contracts; apply derivation/modifiers exactly once with recomputable provenance. Failed exchanges preserve all balances; acquisition receipts distinguish requested/delivered/overflow and callers must handle them — never report a full grant from a partial delivery. Use the smallest operation that enforces this; don't build a universal transaction framework without demonstrated need.

**A10. UI composes canonical primitives.** `tokens → layout primitives → interaction primitives → game UI primitives → domain components → feature panels`. Example primitive names (Surface/Grid/Stack/Button/Tooltip/Modal/ProgressBar/Slot/ItemIcon/StatRow/CostDisplay/SkillNode/EquipmentSlot) are illustrative, not mandatory. No universal mega-components; don't duplicate an existing primitive because a local version is faster. Canonical interaction primitives own keyboard/a11y semantics. Vue+Phaser sharing a layout must use the same measured projection, not independently copied dimensions. Asset resolution/preload enumeration derives from one canonical catalog; validate externally-derived asset paths before filesystem operations.

**A11. Fix root causes, not symptoms.** Ask: what invariant broke, who should own it, why did this workaround become necessary, is a primitive missing, is ownership duplicated, is dependency direction wrong? Prefer the smallest *coherent architectural* change, not the smallest textual patch — but root-cause reasoning isn't license for unrelated cleanup.

**A12. Characterize before migration; don't overengineer.** `identify intended behavior → inspect production consumers → add characterization coverage if needed → migrate one coherent path → verify → remove old authority only after migration`. Don't delete code just because it looks legacy — prove its consumer status first. Don't build abstractions for hypothetical needs — every abstraction pays rent. Characterize real production inputs/consumers (substitute test entities don't establish parity) through actual factories/composition roots. Migrate in runnable vertical slices; search for duplicate authorities and check callers/preview/persistence/reset/error-paths/downstream-events before retiring the old path; classify adapters as live/transitional/unused with evidence (casts and no-op bridges can hide an incomplete migration). For client/storage/server boundaries, verify schema *and* capability contract together — never infer an implemented cloud/backend capability from an interface/config alone.

---

# Part 3 — Effectiveness Guidelines

Apply when the task matches the trigger; skip with a stated reason.

**E1. UI/UX skill.** Any task designing/building/reviewing/materially changing UI/UX (pages, components, design systems, styling, layout, responsive, a11y, interactions, animation, typography, hierarchy) → load `ui-ux-pro-max` (`.agents/skills/ui-ux-pro-max/SKILL.md`) before decisions, follow Vue-specific guidance. Skip only for entirely non-visual work; report if unavailable.

**E2. Stack reference skills.** Editing `.vue` under `game/src/**` → load `vue-best-practices` (+ `vue-pinia-best-practices` if Pinia's involved). Code importing Phaser/`new Phaser.*` → load `phaser-core` (+ `phaser-arcade-physics` for Arcade Physics). General `vue` skill may supplement. Skip only for trivial formatting/comment/typo work.

**E3. Simplify before review.** After ~5+ changed production lines or any new production file, run `code-simplifier` before P5: implement → simplify → verify → review → done. Simplification must preserve behavior — skip and report a candidate that wouldn't. Re-simplify+re-review if a P5 fix adds substantial new code. User may explicitly waive.

**E4. Game system skills.** `balance-check` for economy/progression/difficulty/reward/skill-tree/cultivation-curve changes. `improve-game` for new gameplay features/flow redesign. `game-qa` for player-reported bugs/regressions. `tutienidle-skill-design` for skill/content work touching `data/skill`, `data/progression`, `SkillEffect`, `Skill`, `ProgressionNode`, ailments, reactions, element-skill behavior.

**E5. Performance skill.** Before shipping runtime-heavy work (FPS, save size, large scenes, heavy animation, long sessions) → load `performance`. A review pass, not a substitute for verification.

**E6. E2E skills.** Writing E2E under `game/tests/e2e/**` → `playwright-best-practices`. Interactive browser checks → `playwright-cli` + P14's workflow. Vitest stays default for unit/integration.

**E7. Planning & idea preservation.** Preserve the user's original intent — don't silently remove/replace/split/redesign requested ideas. Add implementation detail/dependencies/state-flow/tests/risks/architecture implications without changing product intent; review connected systems (architecture, state ownership, persistence, lifecycle, UI, tests, cross-system effects); put proposed *product* changes in a separate Notes/Suggestions section; ask only when ambiguity materially changes product intent and can't be resolved from repo evidence. For substantial system work, work through: requirement, current evidence, authoritative owner, existing primitives, missing primitives/mechanisms, state owner, affected dependency chain, migration boundary, verification strategy, explicitly out of scope. For long architectural missions, keep a concise ledger (current vs. target authority, migrated consumers, verification status, retained debt) — audit before a broad refactor, build foundations first, migrate one complete path at a time.

**E8. Development phase.** Old dev-save backward compatibility is NOT required unless explicitly requested; breaking it for correct current schema/architecture is acceptable. Don't spend effort on save migrations by default.

**E9. UI layout: flexible/fit-to-container.** Grid slots/cards/rows/pagination derive from the actual container — adapt to resize without overflow, broken composition, unjustified dead space, or hardcoded column counts tied to a dev screen. Prefer CSS auto-fill/minmax, `ResizeObserver`, `contentRect` measurement, and existing owners (`usePanelPagination`, `useBagGridLayout`) when they fit. Measure, don't assume.

**E10. Focused changes over patchwork or rewrite.** "Small" means the smallest coherent architectural responsibility, not the fewest changed lines. Don't patch only the nearest file when the invariant belongs to another owner: identify invariant → identify owner → repair smallest required primitive → migrate affected consumer → verify → stop. Don't continue into unrelated cleanup.

**E11. Summary format.** State: what changed, relevant files/systems, behavior affected, verification evidence, QA verdict (if applicable), code-review verdict (if applicable), P13/P14 evidence (if applicable), remaining limitations, known retained debt, Notes/Suggestions.

**E12. Worktree workflow.** `using-git-worktrees` when P2 requires one; `finishing-a-development-branch` when closing/integrating an authorized branch. P7 still governs commit/merge/integration authority.

**E13. Verification meta-skill.** Load `verification-before-completion` before applying P3/P4/P5 gates — supplements, doesn't replace, project rules. Make repeated architectural failures executable (types/validators/integration tests/dependency checks) within scope; verify effective configuration, not just a lint rule's presence. A green suite alone isn't semantic parity — exercise the violated invariant with production inputs/wiring, keep existing guards until equivalent coverage exists. Docs-only changes need consistency/reference/mirror checks, not production test runs.

**E14. Code-review workflow.** `requesting-code-review` when the user explicitly asks for review; `receiving-code-review` when responding to feedback. Complements P5.

**E15. Systematic debugging.** Investigating a bug/exception/unexpected behavior → load `systematic-debugging`: reproduce → identify violated invariant → isolate owner → diagnose root cause → regression evidence where practical → repair correct layer → verify. Don't jump to a speculative patch because the cause "looks obvious."

**E16. Test-driven development.** Writing new tests or fixing a bug → load `test-driven-development`: red → green → refactor, where practical. Existing tests may serve as characterization coverage; for structural migration, capture intended behavior before moving responsibility.

**E17. Debug report format.** When the user asks for debugging, the report-back (before or alongside implementing a fix) must state: where the bug lives (file/function), why it happens (root cause, not symptom — per E15), and when it was introduced (which change/assumption triggered it, if determinable). Then offer at least 2 distinct ways to fix it, and at least 1 explicitly marked as the long-term option (may cost more effort now, better for the project going forward) vs. the other(s) as shorter-term/local. Don't silently apply a fix without surfacing the alternatives first, unless the user has pre-authorized "just fix it."

---

# Part 4 — Opencode Agent Wiring

Opencode per-agent system prompts (`.opencode/agent/<name>.md`) outrank repo instruction files like this one — so critical Protection Rules are mirrored there. `AGENTS.md` stays the human-readable source of truth.

- `.opencode/agent/build.md` — primary code-editing agent. Mirrors all applicable P1-P17.
- `.opencode/agent/plan.md` — planning/spec agent. Mirrors P1, P2, P6, P7, P8, P9, P10, P11; must also follow Part 2 when proposing architecture.
- `.opencode/agent/general.md` — fallback implementation agent. Same Protection surface as `build.md` when it can modify production code.
- `.opencode/agent/explore.md` — read-only research agent. Mirrors the subset relevant to safe research: worktree boundaries, Git safety, scope, secrets.

Don't mirror the whole Architecture Constitution into every agent prompt by default — Part 2 stays repo-level guidance. If evidence shows a specific architecture rule is repeatedly violated for lack of prompt priority, mirror only that subset.

**Sync rule:** Part 1 is the Protection source of truth. Update every affected `.opencode/agent/*.md` mirror in the same change whenever a Protection Rule changes — drift between Part 1 and a higher-priority agent prompt is a project defect. Agent-specific prompts may be stricter than this file; they must not weaken it.

**Restart required** after editing `AGENTS.md` or `.opencode/agent/*.md` — agent configuration loads at startup, don't assume hot-reload.
