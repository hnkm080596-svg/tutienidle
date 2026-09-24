# Project Agent Rules

Root: `game/`. Stack: Vue 3, TypeScript, Vite, Vitest, Pinia, Phaser.

**This file = rules (how to work). `game/docs/roadmap.md` = current architecture state** (which system owns what right now, which R-mission is done/in-progress/parked). Read the relevant roadmap phase before touching combat, save/restore, inventory, production, or quest code — do not assume an architecture rule below describes what's *currently* implemented; roadmap.md does. Don't duplicate roadmap content here.

QA authority + 4 parts:

- **Internal QA authority** — one decision law (`game/docs/qa/protocol/README.md`); all gates below feed it.
1. **Protection Rules (P1-P18)** — hard rules, do not bypass. Critical ones are mirrored into `.opencode/agent/<name>.md`.
2. **Architecture Constitution (A1-A13)** — project-wide laws. New code follows them; fix existing violations only within your authorized scope.
3. **Effectiveness Guidelines (E1-E17)** — workflow guidance, skip with a stated reason.
4. **Opencode Agent Wiring** — how Part 1 is mirrored into agent prompts.

"The agent" = whichever coding agent is active. Deleted `TASK.md`/stale worklogs/obsolete plans are not current requirements. Use `AstraDoctrine.md` for the reasoning workflow — findings are evidence of defects, not authorization for an unrelated rewrite.

**Project intent:** headlessly testable game, stable primitives, one authority per rule/state. Repair the smallest coherent responsibility and migrate its real consumers. Don't optimize for file/line count or a green suite alone. Preserve gameplay intent — don't silently redesign it.

**Architecture worker workflow (required):** Before planning, dispatching, or making non-trivial production changes, use [architecture-worker-workflow.md](game/docs/architecture/architecture-worker-workflow.md). Complete G0/G1 before production edits; carry the task card, Q1-Q12 evidence and triggered domain checks through G2-G5. Read-only planning/research and docs-only work use its proportional scope rules. Workers must return the G5 evidence report; coordinators check the aggregate diff against it. Use [architecture-worker-exercises.md](game/docs/architecture/architecture-worker-exercises.md) for workflow qualification, not as a substitute for production tests. This operationalizes A1-A12/E7/E13; it does not change P1-P18, authorize unrelated repairs, or turn the historical Mission 0 audit into current requirements.

---

## Internal QA authority

The primary agent owns QA completion through `game/docs/qa/protocol/README.md`.
Read that protocol at the start of nontrivial feature/fix, integration, release or QA-system work, together with its taxonomy, schemas and learning policy. Current user instructions and protection rules still control scope and destructive/external actions.

Use one internal fixed-point loop over the CURRENT AGGREGATE REPOSITORY STATE. The task diff discovers impact; it is not the object of approval. Preserve deterministic tests/build, OCR delegation, actual runtime/visual checks, architecture/consumer census, adversarial attacks, sequential resulting-state reviews and fresh internal falsification. Their evidence feeds one ledger and one coordinator decision.

No ChatGPT Web, C2C external verdict, browser login, external reviewer or third-party review bot is required for completion. Useful findings from any source remain evidence to validate. Transport availability is never an approval criterion.

Every fix triggers root-cause/class analysis, repository-wide sibling search, regression protection, impacted re-verification, evidence invalidation and renewed aggregate attacks. All actionable defects, including Low, block unqualified fixed-point completion. Never treat an arbitrary number of passes, green test count, budget expiry or DONE message as convergence.

The primary agent performs its own full reasoning and may dispatch isolated internal reviewers. Same-context role switching is self-review, not independent review. If native isolated contexts are unavailable, continue useful internal checks and explicitly report the missing independence evidence; do not route back to ChatGPT Web or forge independence.

Every meaningful failure must enter `game/docs/qa/protocol/learning.md`: incident -> root class + detector escape reason -> pin/attack proposal -> independent qualification -> automatic promotion -> use in later runs. Product rules and required detection strength cannot be relaxed automatically. Governing learning policy is versioned separately from incident logs.

Only the protocol's terminal predicate permits QA_FIXED_POINT_REACHED. Required unavailable evidence is QA_UNVERIFIED; known unresolved defects are QA_FINDINGS_OPEN; out-of-authority repairs are QA_BLOCKED_SCOPE; human-accepted deviations are QA_ACCEPTED_WITH_EXCEPTIONS. None of those outcomes authorize commit/merge/push/deploy.

Prevention upgrade (ledger schema v2): lessons may additionally carry a `guidance` facet — binding construction guidance issued BEFORE implementation. Intake runs `qa:internal prepare` (deterministic lesson routing + construction brief draft) and `preflight` (readiness verdict); a run with `requiredReadiness` cannot reach fixed point while its brief obligation is unmet (clause C9). Agent dispatch follows the just-in-time 5-slot law (`agent-instructions.md` §G): assignment records in the ledger are the reservation authority — no standing watchers, a result message is not a release, timeout is not a release. Guidance facets qualify only with an independent verifier and publish atomically into `learning/policies/`; no self-approval, no torn publication, no fabricated prevention claims (`EFFICIENCY_NOT_YET_ESTABLISHED` until a comparative pilot exists).

P3/P13/P14/P18 remain technical evidence requirements. P4 operators and P5 chronological responsibilities are scheduled inside this protocol, not separate competing approval systems. Generic skill round caps/minor deferral rules cannot override this completion contract. Quick checks are repair-loop operations, never a shortcut to aggregate completion.

---

# Part 1 — Protection Rules (Enforced)

**P1. Worktree boundary.** Edits/scripts/tests only inside your given worktree. Deleting files *inside* it needs no extra authorization (it's a sandbox). Anything *outside* it (other branches, main checkout, sibling worktrees) needs explicit user authorization — treat it like a commit decision.

**P2. Worktree required** for multi-file features, risky changes, plans, architecture changes, delegated work. Create via `using-git-worktrees` → `.agent-worktrees/<kebab-task-name>`. Small focused changes can skip it. **Exception:** editing `*.md` (including this file, `game/docs/**`) never needs a worktree — just note reason/time/file in the summary.

**P3. Verification — 2 modes only, no in-between:**
- `quick` (default): `npm run type-check` + `npx vitest run <relevant scope>`
- `full`: `npm run type-check` + `npm run build` + `npx vitest run` — use when touching `vite.config.ts`, `tsconfig.json`, `vitest.config.ts`, `package.json`/lock, deps, asset/build pipeline, Pinia root state, router, Phaser scene infra, major architecture, milestone/release readiness, or when asked. The canonical evidence command is `npm run verify` (= type-check + build + full vitest). Agents reporting verification run it from `game/`. Vue tracks the 3.6 prerelease line deliberately (vapor packages); it is pinned to an exact version, not the rc dist-tag — bump it intentionally, never via a tag.

Stop on first failure, fix, rerun same mode. Don't re-verify unchanged code. Fix task-caused failures before declaring done. P3 is one gate in the P5 completion sequence — a green P3 alone is never completion.

**P4. Adversarial QA gate.** After a feature/fix, run `tutienidle-adversarial-qa` (quick) before claiming done — positioned after P3 verification, the P18 OCR gate, and any triggered P13/P14 runtime checks, before the P5 sequential review passes. Deep mode: when asked, before milestone/release, or when quick QA surfaces broad risk (save/cloud, time/offline, economy/progression, Vue/Pinia/Phaser lifecycle). QA-pass writes are restricted to `**/*.test.ts`, `tests/e2e/**`, `docs/qa/**` — no production edits during QA. A defect needs deterministic repro / failing test / runtime evidence. Verdicts: `PASS WITH EVIDENCE` (QA gate passed — the P5 sequential review still runs) / `FAIL WITH REASON` (QA satisfied only if the reason is legitimate) / `PASS WITH GAPS` / `BLOCKED` (not done). A QA-driven production fix is a normal implementation change: reverify and feed it through the P5 loop like any other fix.

**Decision authority:** the P4 verdict labels are evidence inputs to the Internal Fixed-Point QA Protocol ledger — the protocol (not this gate alone) owns completion. See the Internal QA authority section.

**P5. Post-task gate — Sequential Multi-Pass Review.** A non-trivial change (≥5 changed production lines, any new production file, any touched file beyond rename/comment/whitespace) is NOT complete merely because tests are green, OCR is clean, or one review pass succeeded. Completion sequence:

`implement → simplify (E3) → verify (P3) → OCR gate (P18) → runtime/browser verification when triggered (P13/P14, inside the implementation worktree) → adversarial QA (P4) → sequential review passes (≥3) → done`

Review is **sequential and temporal** — each pass reviews the code state produced by the previous pass's fixes, never the pre-fix state. Three passes is the minimum, not the maximum. A single review executed once against one snapshot "from three perspectives" does NOT satisfy this gate — that is the interpretation this rule replaces. The `code-review` skill may feed a pass; it is not the gate by itself.

- **Pass 1 — Local Correctness / Regression.** Reviews the post-OCR implementation state: task requirements and acceptance criteria; changed behavior; incorrect conditions; invalid state transitions; null/undefined handling; calculation errors; async and race issues; lifecycle bugs; cleanup failures; listener leaks; stale state; broken error paths; edge cases; lifecycle/reset/restore behavior where relevant; incomplete migrations; stale fallbacks; obvious regression risk; whether the fix addresses the root cause rather than only the visible symptom; missing meaningful regression tests. Actively search for evidence that the implementation is wrong. Then: list findings → validate → fix confirmed Medium-or-higher → re-run affected verification → only then start Pass 2.
- **Pass 2 — Architecture / Authority / Ownership.** A fresh review of the code produced by Pass 1 fixes — not Pass 1 findings renamed in architecture terms. Ownership boundaries; the Architecture Constitution (A-rules); dependency direction; authoritative state/rule ownership; duplicated sources of truth; direct state mutation outside owning systems; domain API bypass; API and contract consistency; hidden coupling; compatibility paths; cross-system side effects; Vue/Pinia/Phaser boundaries; scene-transition authority; lifecycle ownership; inappropriate responsibility placement; unnecessary duplication and complexity; maintainability; performance and security risks where relevant; whether a simpler coherent implementation exists. For architecture migrations, check the change against invariants established by earlier missions (earlier authority/ownership decisions still bind), not in isolation. Green tests are not evidence that architecture is correct. Then: findings → validate → fix → reverify → only then start Pass 3.
- **Pass 3 — Adversarial Integration.** A fresh adversarial review of the newest code after Pass 2 fixes — assume the implementation may still be wrong and actively try to break its assumptions. Inspect beyond modified files where necessary: callers; consumers; event chains; upstream invariants; downstream behavior; hidden coupling; compatibility with previous missions; repeated execution; re-entry; duplicate initialization; unexpected call ordering; cleanup after failure; retry behavior; runtime edge cases; cross-feature regressions; integration boundaries; stale assumptions; adequacy of unit/integration/E2E coverage; whether tests assert behavior rather than implementation details; missing coverage capable of hiding a real regression; failures that can occur only in the assembled application. For UI, interaction, Phaser, lifecycle, scene-transition, or browser-sensitive work this pass must use real runtime/Playwright evidence (P13/P14), not source inspection alone. Then: findings → validate → fix → reverify.

**Severity.** Every finding gets an explicit severity: **Critical / High / Medium / Low / Nit**. A **Medium** is a meaningful correctness or regression risk, an incomplete migration, a broken or ambiguous contract, an architecture violation with real consequences, meaningful missing coverage, or a user/runtime flow that can behave incorrectly. A finding judged invalid may be rejected only with a recorded reason — never silently dropped, never downgraded to escape the gate. Low-confidence or speculative findings may be classified Low/Nit or rejected, with the reason recorded. Pre-existing unrelated problems are not blockers: record them separately as pre-existing/out-of-scope findings with evidence.

**Completion condition.** Sequential review is complete only when ALL are true: at least 3 sequential passes were actually performed; Pass 2 reviewed code produced after Pass 1 fixes; Pass 3 reviewed code produced after Pass 2 fixes; every confirmed Critical/High/Medium finding within the changed or reasonably affected surface was fixed; the directly affected verification was re-run after each fix (broader verification when the fix changes shared behavior or widens the affected surface; P13/P14 runtime checks when it touches browser/runtime behavior); and the final pass over the resulting code state ended with zero unresolved confirmed Medium-or-higher. Low/Nit findings need not be fixed, but every intentionally deferred one stays visible in the final report with finding, location/surface, severity, and why it is safe to defer — minor findings never silently disappear between passes.

**A Medium+ fix on the last scheduled pass forces another pass.** If Pass 3 — or whatever would otherwise be the final pass — confirms a Medium-or-higher finding and code changes, the resulting state has not yet been independently reviewed: fix, reverify, then run another review pass over the new affected code state. The same rule applies recursively to Pass 4, 5, ... A fix invalidates previous review evidence for the surface it changes — do not merely recheck the fixed line, review the resulting state. The user may explicitly waive a specific finding — record the waiver.

**Evidence — chronological, one block per pass.** The final report must demonstrate that passes happened in order:

```
Sequential Review Pass 1
  Reviewed state: <post-OCR implementation state>
  Findings: ...
  Fixes: ...
  Verification: ...

Sequential Review Pass 2
  Reviewed state after Pass 1 fixes: YES
  Findings: ...
  Fixes: ...
  Verification: ...

Sequential Review Pass 3
  Reviewed state after Pass 2 fixes: YES
  Findings: ...
  Fixes: ...
  Verification: ...
```

Add Pass 4+ blocks whenever a pass produced Medium-or-higher fixes. A report of the form "reviewed from three perspectives: correctness / architecture / integration" proves one combined single-snapshot review — it fails this gate.

**Decision authority:** the ≥3 sequential passes are the protocol's minimum review cycle over resulting states; their evidence and findings feed the shared ledger, and completion is judged by the protocol's terminal predicate — not by pass count alone. All actionable findings (including Low) must close or be explicitly excepted before an unqualified fixed-point claim.

**P6. Multi-agent coordination.** `git status` before editing (including before delegating) — stop and notify the user if someone else's uncommitted work overlaps. Delegated agents report: worktree path, branch, files changed, verification evidence, remaining limitations. Coordinator owns aggregate diff reasoning + final verification, including the P5 sequential review over the aggregate diff. Use Subagent-Driven Development where Agent/Task-style dispatch exists; otherwise Inline Execution/`executing-plans` — capability decides, not habit.

**P7. No commit/push/deploy without explicit authorization.** The user alone authorizes commit, merge, integrate, push, deploy. Always-ask-first commands: `git reset --hard`, `git clean -fd[x]`, `git push -f`/`--force`, `git branch -D`, `git stash drop`/`clear`, `git checkout .`/`-- <path>`, `git restore .`/`--staged .`. Normal inspection/non-destructive git is fine. File deletion → P1.

**P8. No `any` unless genuinely necessary.** Prefer specific type → generic constraint → `unknown` + guard → `any` only as last resort. Any introduced `any` must be flagged in the summary.

**P9. Architecture/dependency changes need architectural scope.** Don't silently change folder layout, module boundaries, public store/service APIs, Phaser scene topology, dependencies, or state ownership on an unrelated task. Allowed when explicitly requested, required to restore the authorized boundary, or part of an approved migration. A root-cause fix may span several files if they're one coherent responsibility — unrelated cleanup stays out of scope.

**P10. Scope follows responsibility, not the first symptom.** If a bug in A is really owned by B, fixing B and migrating A is in scope. Flow: symptom → violated invariant → authoritative owner → repair smallest coherent chain → migrate affected consumer → stop. Report unrelated problems as Notes/Suggestions, don't chase them.

**P11. No secrets exposure.** Never read/log/print/commit `APIKey`, `.env*`, `.mcp.json`, or credential/token/key files — treat as opaque.

**P12. Fix verification failures your task caused.** Distinguish task-caused regression vs. pre-existing failure vs. coverage gap vs. environment limitation; only the first blocks completion.

**P13. Runtime wiring verification.** *Why:* a past refactor extracted lifecycle logic but left `GameManager.update()` unwired — thousands of green unit tests, zero runtime progression. The unit suite proves engine logic, not wiring. For wiring-critical changes (`App.vue`, `useAppLifecycle.ts`, boot/mount, timers, `GameManager.update()` driving paths, Phaser scene lifecycle, Vue↔Phaser bridges, runtime registration): quick verification isn't enough — run the relevant Playwright E2E from inside the implementation worktree and actually drive the behavior. A boot-only smoke test doesn't prove progression. Don't delete/weaken wiring guard tests. "Nothing happens, no error" → suspect missing wiring before blaming lower-level logic.

**P14. Visual/runtime verification via Playwright.** Type-check/Vitest/jsdom can't see Phaser rendering, animation, sprite/VFX, CSS hover/drag/transitions/z-index, responsive layout, native drag/drop. When correctness depends on these, load `playwright-cli` and check in a real browser:
1. `npm run dev`, read the actual printed port (don't assume one).
2. Prefer MS Edge. No global binary → `npx playwright cli <command>`.
3. Navigate to the actual affected flow, screenshot, visually inspect — "no console error" alone isn't evidence.
4. Native HTML5 drag/drop may need real `DragEvent`/`DataTransfer` dispatched via browser evaluation (Playwright's drag helper may not fire Vue handlers).
5. Don't dispatch an interaction and read Vue DOM state in the same evaluation call — Vue may update next microtask. Dispatch, then inspect separately.
6. Check console output, close the session, clean up scratch artifacts (`.playwright-cli/`, ad-hoc screenshots/snapshots/`.png`/`.yml`) unless intentional test artifacts.
State exactly what was visually confirmed. P14 supplements P13/P4/P3, doesn't replace them.
*Worktree rule (no exception):* when P13/P14 triggers, it MUST run against the implementation worktree BEFORE the branch is merge-ready — the worktree is the primary pre-merge runtime validation environment. Start the dev server from that worktree, use the actual port it prints (never assume one, never reuse another worktree's server; with simultaneous worktrees use isolated/free ports and worktree-local runtime state). Browser binaries/caches may live outside the Git checkout per existing convention, but the source under test, the serving dev server, and the captured evidence must all come from this worktree's current code. Never merge or temporarily integrate into `master` just to make Playwright possible.
*Playwright exposes a bug:* reproduce it in the implementation worktree, fix it in the same task worktree, rerun the failing scenario plus the relevant broader browser/E2E coverage, and feed the changed implementation through the P5 loop (a Medium-or-higher bug/fix re-enters the pipeline: affected P3 verification + P18 OCR on the new diff, then the sequential passes review the resulting state).
*Environment/tooling failure:* investigate first, distinguish project failure from environment failure, capture concrete evidence, report it as an explicit blocker/gap. "Run it later on master" is not a fallback — a branch that required Playwright is not merge-ready merely because Playwright could not run.
*Post-merge master validation* remains allowed as supplementary consolidated/release confidence — it never replaces pre-merge worktree verification and is never the feature's first real browser exercise.

**P15. Code comments: English, plain ASCII only** (`.ts`/`.vue`/`.js`/similar) — prevents Windows mojibake. Vietnamese stays fine in localized UI, docs, user-facing responses, content data. Don't mass-translate unrelated comments.

**P16. Vietnamese UI text goes through the i18n gateway** (`useI18n()`, `t('...')`) — not hardcoded in templates/scripts for buttons, titles, errors, toasts, nav, labels. `useScope: 'local'` is reserved for components that define their own `messages` — messageless local scope emits missing-key warnings on every `t()` (guarded by `tests/architecture/i18nKeyParity.test.ts`). Comments → P15. Not a mandate to migrate all historical Vietnamese; `data/**` content stays as-is. Migrating nearby hardcoded strings in a file you're already substantially touching is encouraged when low-risk.

**P17. Runtime / presentation / logic separation.** Clock owns timing; presentation owns rendering/animation/VFX/playback; gameplay systems own authoritative rules (damage/effects resolve in the gameplay authority). Presentation may acknowledge playback completion, never determine outcomes or silently change gameplay state on failure. Gameplay must not touch Phaser internals. Cross-system coordination = typed calls/commands/events/acks/read-only queries, never direct private-state mutation. Visual arrival/animation/mounting must not award resources, spend costs, or activate progression — an ack-based protocol may *pace* actions but isn't the authority for the outcome. Mixed timing+presentation+business-logic in one function/class = architectural defect, not style.
*Combat contract:* before touching `game/src/core/battle/turn/**`, GameManager battle-tick integration, or `CombatScene.ts` — check `game/docs/roadmap.md`'s combat-chain phases (R1-R6) and current QA reports in `game/docs/qa/` for the maintained state-machine/presentation-timing contract; there is no single reference doc to reconstruct from. An intentional contract change updates its maintained reference (roadmap/QA doc) in the same coherent change.

**P18. Open Code Review (OCR) gate.** After P3 verification and before the remaining gates, the task diff passes through Alibaba OpenCodeReview (`ocr` CLI) — deterministic file/rule selection with host-agent defect review. OCR is a specialized defect detector: it never replaces tests, P13/P14 runtime checks, P4 QA, or the P5 sequential review, and a clean OCR pass proves none of those things.

- **Scope = the task diff, inside the implementation worktree.** Uncommitted work: workspace mode (`ocr delegate preview`). Committed branch work: merge-base mode with the correct task boundary (`ocr delegate preview --from <base> --to <head>`). Reviewing master's diff while implementing in a worktree — or any scope mismatch — invalidates the pass. `ocr scan` (whole-file/repo) is reserved for explicit audit/scouting missions, never per-task. Files preview lists as untracked/new have no git diff — read their complete content; an empty `git diff` is never evidence that nothing needs review.
- **Execution mode = Delegation Mode** (`.agents/skills/open-code-review/SKILL.md` has the protocol). `ocr delegate preview` selects the reviewable files; `ocr delegate rule <paths>` resolves the applicable rules (built-in + `.opencodereview/rule.json`); the agent reviews the selected diff against those rules with its own model — no OCR LLM provider or API key required, and OCR consumes no external quota in this mode. In Delegation Mode the defect reasoning is the host agent's, not Alibaba's review engine — the published OCR precision/recall benchmarks do not transfer here. `ocr review` / `ocr scan` run only where the user has explicitly configured an OCR provider.
- **Coverage accounting — every previewed file is accounted for.** Before starting, checklist every `reviewable_files` entry; each ends up `reviewed` or `skipped` with a concrete reason — a file may never silently disappear. The pass reports `previewed_files / reviewed_files / skipped_files / coverage_rate`. `coverage_rate < 100%` invalidates the pass unless every skipped file carries an explicit, valid skip reason.
- **Loop:** run OCR → inspect every meaningful Medium-or-higher finding against the actual implementation and enough surrounding context → reject false positives only with recorded evidence → fix confirmed defects → re-run the directly affected P3 verification → run OCR on the resulting diff — repeat until ONE clean pass (0 unresolved confirmed Medium-or-higher) on the latest code state. One clean pass after the most recent meaningful code change suffices; do not spam identical clean runs. A production fix from a later gate re-enters OCR on the new diff before the P5 passes resume.
- **Severity** maps onto the P5 ladder (Critical/High/Medium gate the task; Low/Nit deferral and documentation follow P5 policy).
- **Repo rules:** `.opencodereview/rule.json` — concise, defect-oriented, path-scoped. It is not a style/lint engine and not a copy of this file; the full architecture-reasoning responsibility stays with Sequential Pass 2.
- **Unavailable/failing binary:** treat as an environment limitation — investigate and distinguish environment from project failure — but when P18 applies, an unavailable `ocr` means the task is NOT completion-ready unless the user explicitly waives P18 (same standard as a P14 tooling blocker). Never silently skip.
- **A clean OCR pass means only** that OCR has no unresolved confirmed Medium-or-higher findings for the reviewed code state. It does NOT prove all bugs are gone, architecture is correct, integration is correct, runtime behavior is correct, or that tests/Playwright/QA/sequential review can be skipped. Execution continues through the rest of the completion sequence.

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

**A13. Cultivation Path Isolation.** Cultivation paths are registered modules under the Cultivation Path Framework (`core/player/CultivationPathKit.ts` catalog). `CultivationPathSystem` is the sole authority for active path, active way, and ritual offer/choice; `NodeSystem` remains sole authority for node investment; in-way branch state stays with its existing owners (`phapTu` element/route, mutex root nodes, skill specialization). Each path declares **ways** — path-owned branches with their own kit, node subtree, and mechanic slice — all chosen at the Initiation Ritual (way offer gates are ritual-time evaluations, never persisted). Core systems MUST NOT branch on concrete path or way identity; contributions flow through typed contracts (domain-gated stat modifiers, way-declared skill grants, battle-build providers). Concrete paths and ways MUST NOT depend on one another. P1 capability contract: downstream systems query declared capabilities via hasPathCapability / hasStaticPathCapability / resolvePathCapabilities and canonical branch reads (getActiveElement / getActiveRoute / getKiemTuPreset) in CultivationPathSystem — never infer path identity from owned skills, slice presence, node ownership, or UI state. Conditional capabilities (e.g. phap_tu.reaction_aura, phap_tu.empowered_ult) are module-owned predicates on the way definition evaluated with injected deps (learned-skill membership arrives via PathCapabilityDeps.hasSkill — SkillManager stays the owner). Persisted module slices (player.phapTu, player.kiemTu) are validated by the module-owned validatePersistedState hook iterated generically at the save boundary; direct slice field reads outside module dirs, core/player, and the documented allowlist are slice inference and fail the guard. Guards: `tests/architecture/cultivationPathIsolation.test.ts` + `src/core/player/CultivationPathContract.test.ts`.

---

# Part 3 — Effectiveness Guidelines

Apply when the task matches the trigger; skip with a stated reason.

**E1. UI/UX skill.** Any task designing/building/reviewing/materially changing UI/UX (pages, components, design systems, styling, layout, responsive, a11y, interactions, animation, typography, hierarchy) → load `ui-ux-pro-max` (`.agents/skills/ui-ux-pro-max/SKILL.md`) before decisions, follow Vue-specific guidance. Skip only for entirely non-visual work; report if unavailable.

**E2. Stack reference skills.** Editing `.vue` under `game/src/**` → load `vue-best-practices` (+ `vue-pinia-best-practices` if Pinia's involved). Code importing Phaser/`new Phaser.*` → load `phaser-core` (+ `phaser-arcade-physics` for Arcade Physics). General `vue` skill may supplement. Skip only for trivial formatting/comment/typo work.

**E3. Simplify before review.** After ~5+ changed production lines or any new production file, run `code-simplifier` before the review gates. Full sequence: implement → simplify → verify (P3) → OCR gate (P18) → triggered runtime/browser checks (P13/P14 in-worktree) → adversarial QA (P4) → sequential review passes ≥3 (P5) → done. Simplification must preserve behavior — skip and report a candidate that wouldn't. Re-simplify before the next pass if a review fix adds substantial new code. User may explicitly waive.

**E4. Game system skills.** `balance-check` for economy/progression/difficulty/reward/skill-tree/cultivation-curve changes. `improve-game` for new gameplay features/flow redesign. `game-qa` for player-reported bugs/regressions. `tutienidle-skill-design` for skill/content work touching `data/skill`, `data/progression`, `SkillEffect`, `Skill`, `ProgressionNode`, ailments, reactions, element-skill behavior.

**E5. Performance skill.** Before shipping runtime-heavy work (FPS, save size, large scenes, heavy animation, long sessions) → load `performance`. A review pass, not a substitute for verification.

**E6. E2E skills.** Writing E2E under `game/tests/e2e/**` → `playwright-best-practices`. Interactive browser checks → `playwright-cli` + P14's workflow. Vitest stays default for unit/integration.

**E7. Planning & idea preservation.** Preserve the user's original intent — don't silently remove/replace/split/redesign requested ideas. Add implementation detail/dependencies/state-flow/tests/risks/architecture implications without changing product intent; review connected systems (architecture, state ownership, persistence, lifecycle, UI, tests, cross-system effects); put proposed *product* changes in a separate Notes/Suggestions section; ask only when ambiguity materially changes product intent and can't be resolved from repo evidence. For substantial system work, work through: requirement, current evidence, authoritative owner, existing primitives, missing primitives/mechanisms, state owner, affected dependency chain, migration boundary, verification strategy, explicitly out of scope. For long architectural missions, keep a concise ledger (current vs. target authority, migrated consumers, verification status, retained debt) — audit before a broad refactor, build foundations first, migrate one complete path at a time.

**E8. Development phase.** Old dev-save backward compatibility is NOT required unless explicitly requested; breaking it for correct current schema/architecture is acceptable. Don't spend effort on save migrations by default.

**E9. UI layout: flexible/fit-to-container.** Grid slots/cards/rows/pagination derive from the actual container — adapt to resize without overflow, broken composition, unjustified dead space, or hardcoded column counts tied to a dev screen. Prefer CSS auto-fill/minmax, `ResizeObserver`, `contentRect` measurement, and existing owners (`usePanelPagination`, `useBagGridLayout`) when they fit. Measure, don't assume.

**E10. Focused changes over patchwork or rewrite.** "Small" means the smallest coherent architectural responsibility, not the fewest changed lines. Don't patch only the nearest file when the invariant belongs to another owner: identify invariant → identify owner → repair smallest required primitive → migrate affected consumer → verify → stop. Don't continue into unrelated cleanup.

**E11. Summary format.** State: what changed, relevant files/systems, behavior affected, verification evidence (P3 mode, commands, results), OCR result (P18 — clean-pass + coverage evidence, or the recorded environment gap with the user's explicit P18 waiver), P13/P14 runtime/browser evidence (if triggered — from the implementation worktree, or the explicit environment blocker), QA verdict (P4, if applicable), P5 sequential-review result (per-pass chronological evidence blocks as P5 requires, findings by severity, deferred Low/Nit findings with deferral reasons, any user waivers), remaining limitations, known retained debt, Notes/Suggestions.

**E12. Worktree workflow.** `using-git-worktrees` when P2 requires one; `finishing-a-development-branch` when closing/integrating an authorized branch. P7 still governs commit/merge/integration authority.

**E13. Verification meta-skill.** Load `verification-before-completion` before applying P3/P4/P5/P18 gates — supplements, doesn't replace, project rules. Make repeated architectural failures executable (types/validators/integration tests/dependency checks) within scope; verify effective configuration, not just a lint rule's presence. A green suite alone isn't semantic parity — exercise the violated invariant with production inputs/wiring, keep existing guards until equivalent coverage exists. Docs-only changes need consistency/reference/mirror checks, not production test runs.

**E14. Code-review workflow.** `requesting-code-review` when the user explicitly asks for review; `receiving-code-review` when responding to feedback. Complements P5.

**E15. Systematic debugging.** Investigating a bug/exception/unexpected behavior → load `systematic-debugging`: reproduce → identify violated invariant → isolate owner → diagnose root cause → regression evidence where practical → repair correct layer → verify. Don't jump to a speculative patch because the cause "looks obvious."

**E16. Test-driven development.** Writing new tests or fixing a bug → load `test-driven-development`: red → green → refactor, where practical. Existing tests may serve as characterization coverage; for structural migration, capture intended behavior before moving responsibility.

**E17. Debug report format.** When the user asks for debugging, the report-back (before or alongside implementing a fix) must state: where the bug lives (file/function), why it happens (root cause, not symptom — per E15), and when it was introduced (which change/assumption triggered it, if determinable). Then offer at least 2 distinct ways to fix it, and at least 1 explicitly marked as the long-term option (may cost more effort now, better for the project going forward) vs. the other(s) as shorter-term/local. Don't silently apply a fix without surfacing the alternatives first, unless the user has pre-authorized "just fix it."

---

# Part 4 — Opencode Agent Wiring

Opencode per-agent system prompts (`.opencode/agent/<name>.md`) outrank repo instruction files like this one — so critical Protection Rules are mirrored there. `AGENTS.md` stays the human-readable source of truth.

- `.opencode/agent/build.md` — primary code-editing agent. Mirrors all applicable P1-P18.
- `.opencode/agent/plan.md` — planning/spec agent. Mirrors P1, P2, P6, P7, P8, P9, P10, P11; must also follow Part 2 when proposing architecture.
- `.opencode/agent/general.md` — fallback implementation agent. Same Protection surface as `build.md` when it can modify production code.
- `.opencode/agent/explore.md` — read-only research agent. Mirrors the subset relevant to safe research: worktree boundaries, Git safety, scope, secrets.

Don't mirror the whole Architecture Constitution into every agent prompt by default — Part 2 stays repo-level guidance. If evidence shows a specific architecture rule is repeatedly violated for lack of prompt priority, mirror only that subset.

**Sync rule:** Part 1 is the Protection source of truth. Update every affected `.opencode/agent/*.md` mirror in the same change whenever a Protection Rule changes — drift between Part 1 and a higher-priority agent prompt is a project defect. Agent-specific prompts may be stricter than this file; they must not weaken it.

**Restart required** after editing `AGENTS.md` or `.opencode/agent/*.md` — agent configuration loads at startup, don't assume hot-reload.
