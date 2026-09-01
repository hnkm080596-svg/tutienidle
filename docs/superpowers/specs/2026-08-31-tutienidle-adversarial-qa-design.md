# TutienIdle Adversarial QA Skill Design

Date: 2026-08-31  
Status: Approved design, pending implementation plan  
Target project: `game/` (Vue 3, TypeScript, Vite, Vitest, Pinia, Phaser, Playwright)

## 1. Purpose

Create one project-native Codex skill named `tutienidle-adversarial-qa` whose primary job is to discover defects the developer did not anticipate. It must reason adversarially about game state, timing, persistence, progression, cross-system interactions, and runtime lifecycle instead of merely checking acceptance criteria or replaying happy paths.

This skill is intentionally specialized for TutienIdle. It is not designed as a reusable generic game-QA package.

The skill may inspect production code and create regression or reproduction tests, but it must never repair production code. This separation ensures that QA evidence remains independent from the implementation being reviewed.

## 2. Design Sources

The design synthesizes ideas from these upstream repositories:

- [`AleksandrGarnov/qa_skill`](https://github.com/AleksandrGarnov/qa_skill): adversarial QA reasoning, blast-radius analysis, exploratory heuristics, evidence gates, and learned-defect backfill.
- [`tinh2/skills-hub-registry/qa/game-qa`](https://github.com/tinh2/skills-hub-registry/tree/main/qa/game-qa): game-specific defect taxonomy and static analysis of state, timing, save, and input edge cases.
- [`PlayableIntelligence/game-creator/skills/game-qa`](https://github.com/PlayableIntelligence/game-creator/tree/main/skills/game-qa): deterministic browser execution, Playwright flows, and observable game-state hooks.

These repositories are design references only. The finished skill must not depend on them at runtime. Any copied material must preserve the attribution and license notices required by its upstream license; normal implementation should paraphrase and adapt ideas to this project's systems.

## 3. Invocation Model

The skill has two modes.

### 3.1 Quick review

Quick review runs after each completed feature or bug fix, before the agent claims completion. It is routed by a project rule added to `AGENTS.md` and may also be invoked explicitly.

Quick review:

1. Reads the requirement, current diff, and affected tests.
2. Identifies the directly changed subsystem and its one-hop consumers.
3. Loads the core reasoning method, matching domain packs, and relevant learned defects.
4. Generates adversarial hypotheses using boundaries, repetition, reordering, timing, stale state, interruption, and failure paths.
5. Runs focused verification at the lowest useful test layer.
6. Creates a failing reproduction test when a defect can be demonstrated safely.
7. Escalates to deep audit when risk is broad or cannot be bounded confidently.

Automatic escalation occurs when a change crosses multiple systems or materially affects save/cloud, clocks/offline progress, economy/progression, Phaser/Vue lifecycle, or shared state synchronization.

### 3.2 Deep audit

Deep audit runs when explicitly requested with `$tutienidle-adversarial-qa deep`, and before a milestone or release. It should preferably run in a fresh QA session to reduce implementation-context bias.

Deep audit:

1. Builds a current system map from code; documentation is secondary evidence, and documentation drift is reported separately.
2. Loads all project domain packs.
3. Creates an invariant ledger for the audited scope.
4. Explores state transitions, action sequences, alternate ordering, timing boundaries, time manipulation, reload/interruption, two-tab behavior, persistence corruption, low-frame-rate behavior, soak behavior, and cross-system flows.
5. Runs the full proportionate verification set: Vitest, type-check, build, Playwright, and interactive browser inspection where applicable.
6. Adds failing reproduction tests for confirmed defects.
7. Reports evidence, coverage gaps, tool limitations, and residual risk.

A green existing test suite is not sufficient grounds for a safe verdict.

## 4. Skill Layout

The implementation will live under version control at:

```text
.agents/skills/tutienidle-adversarial-qa/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── references/
│   ├── project-system-map.md
│   ├── qa-reasoning-method.md
│   ├── quick-review.md
│   ├── deep-audit.md
│   ├── test-authoring-and-evidence.md
│   ├── reporting-and-learning.md
│   └── domains/
│       ├── economy-and-progression.md
│       ├── time-and-offline.md
│       ├── save-and-cloud.md
│       ├── pinia-phaser-sync.md
│       ├── combat-and-tribulation.md
│       ├── inventory-equipment.md
│       └── ui-input-lifecycle.md
└── scripts/
    └── changed-risk-map.mjs
```

`SKILL.md` remains a concise router and permission contract. Detailed reasoning, workflows, reporting templates, and domain knowledge live in references and are loaded only when relevant. The deterministic `changed-risk-map.mjs` helper maps changed paths to likely domain packs and one-hop risk areas without adding dependencies. If implementation proves that this mapping is clearer and equally reliable as declarative instructions, the helper may be omitted rather than retained without value.

The reporting template and learned-defect schema are kept in `references/reporting-and-learning.md`; no standalone README or duplicate documentation is added to the skill package.

## 5. Reasoning Model

Every scenario is analyzed as:

```text
State → Action → Transition → Side effect → Persisted result
```

The skill identifies which invariant should remain true across that chain, then attacks the transition and its boundaries.

### 5.1 Core invariants

- Conservation: currencies, items, rewards, and costs neither duplicate nor disappear without a defined source or sink.
- Exactly-once: rewards, purchases, claims, deaths, and persistence side effects happen once.
- Atomicity: multi-part operations fully succeed or leave no partial mutation.
- Boundedness: values remain within meaningful limits and cannot become negative, `NaN`, `Infinity`, or unreasonably large.
- Monotonicity: progress that must only advance cannot regress through ordering, reload, or stale state.
- Idempotency: safe retries do not duplicate effects.
- Synchronization: Pinia, Phaser, UI, persisted state, and cloud state agree at observable boundaries.
- Recoverability: invalid or interrupted state fails safely and provides a valid recovery path.
- Lifecycle: listeners, timers, scenes, overlays, and controls are installed and removed exactly when intended.
- Determinism: fixed seed and fixed time produce reproducible outcomes where the design requires it.

### 5.2 Attack operators

For every important action, the skill considers:

- Change values: zero, negative, missing, huge, `NaN`, and `Infinity` inputs where reachable.
- Repeat: double-click, repeated calls, retries, repeated mount/unmount, duplicate messages.
- Reorder: perform valid actions in an unusual sequence.
- Hit timing boundaries: just before, at, and just after cooldown, reset, autosave, combat tick, or offline thresholds.
- Interrupt: reload, route change, pause, hidden tab, scene change, or closure mid-operation.
- Add concurrency: two tabs, overlapping saves, simultaneous requests, or multiple timers.
- Use stale state: cached UI, old store snapshots, delayed callbacks, or out-of-date cloud data.
- Degrade the environment: timer throttling, storage failure, network failure, missing asset, low FPS.
- Chain systems: exercise actions whose side effects cross progression, economy, combat, inventory, UI, and persistence.

## 6. Project Domain Packs

Each pack converts project knowledge into high-risk invariants, likely transitions, attack recipes, useful test seams, and known blind spots.

### Economy and progression

Focuses on reward/cost conservation, unlock boundaries, duplicate claims, prestige/reset-like flows, resource caps, transaction atomicity, and progression consistency after reload.

### Time and offline

Focuses on clock ownership, wall-clock versus simulation time, offline duration boundaries, cooldowns, timer throttling, clock rollback/forward, accumulated precision error, and duplicate offline rewards.

### Save and cloud

Focuses on current save shape, serialization round trips, partial/corrupt data, write interruption, autosave overlap, local/cloud conflict, recovery, and two-tab races.

Because this project is in development, backward migration from old save formats is explicitly out of scope. The pack tests only the current save shape, current-state corruption/recovery, and cloud conflict behavior.

### Pinia and Phaser synchronization

Focuses on ownership of mutable state, update ordering, stale subscriptions, scene recreation, duplicate event delivery, UI/game disagreement, and cleanup across mount, unmount, and scene transitions.

### Combat and tribulation

Focuses on tick ordering, death/victory simultaneity, damage bounds, reward exactly-once behavior, pause/resume, deterministic randomness, low-FPS behavior, and progression transitions triggered by combat outcomes.

### Inventory and equipment

Focuses on capacity limits, stacking, ownership, equip/unequip atomicity, consumed or removed equipped items, duplicate IDs, stat recalculation, and persistence consistency.

### UI, input, and lifecycle

Focuses on repeated input, disabled/loading states, overlays, focus/keyboard/pointer behavior, responsive interaction, accessibility-relevant state, listener cleanup, route changes, and visual state matching domain state.

Any UI/UX review or test-design decision must also follow the project's `ui-ux-pro-max` requirement.

## 7. Permissions and Safety Boundary

### 7.1 Allowed

The QA skill may:

- Read project code, tests, and documentation, excluding secrets.
- Inspect diffs and Git metadata without modifying Git history.
- Run Vitest, type-check, build, Playwright, and browser-based checks.
- Write only to:
  - `game/src/**/*.test.ts`
  - `game/tests/e2e/**/*.spec.ts`
  - `game/tests/e2e/helpers.ts`
  - `game/docs/qa/**`

### 7.2 Forbidden

The QA skill must not:

- Modify production code, configuration, dependencies, or assets.
- Delete, weaken, skip, or broadly rewrite existing tests to make verification pass.
- Change requirements or expected behavior to match an implementation.
- Update snapshots without independent evidence that the new result is intended.
- Read or expose `.env`, API keys, credentials, or other local secrets.
- Touch production services, real accounts, or real user data.
- Commit, merge, push, deploy, or use destructive Git operations.
- Report a confirmed defect based only on static suspicion.

If confirmation requires a new production test hook, the skill reports a coverage gap and proposes the smallest useful hook. It does not implement that hook.

## 8. Test Authoring Policy

The skill uses the lowest layer that conclusively proves the behavior:

- Vitest unit/domain test for isolated rules and invariants.
- Vitest integration test for Pinia, service, persistence, or subsystem interactions.
- Playwright E2E test for browser lifecycle, input, navigation, rendering integration, reload, or multi-tab behavior.
- Interactive browser evidence when automation cannot yet make the behavior observable.

A new reproduction test must:

- Fail for the intended reason before any production fix.
- Assert observable behavior rather than implementation trivia.
- Exercise real project objects where practical; mock only external boundaries.
- Fix random seeds and clocks when nondeterminism is involved.
- Remain useful as a regression test after the implementation is repaired.

The QA skill writes the failing test but leaves production repair to the development workflow.

## 9. Evidence Contract

Every finding contains:

- ID
- Severity
- Status
- Violated or threatened invariant
- Preconditions
- Reproduction steps
- Expected result
- Actual result
- Evidence
- Test file, if created
- Owning subsystem
- Likely blast radius

### 9.1 Status

- Confirmed: supported by a failing reproduction test or direct runtime evidence.
- Suspected: credible reasoning or observation exists, but confirmation is incomplete.
- Coverage gap: the behavior cannot currently be observed or controlled reliably enough to verify.

### 9.2 Severity

- Critical: save loss/corruption, exploitable duplication, inability to boot, or progression lock.
- High: incorrect material rewards/costs, combat/progression corruption, or major cross-system failure.
- Medium: localized functional failure with a practical workaround.
- Low: cosmetic or minor UX problem without material state impact.

### 9.3 Flakiness and blocked verification

A surprising automated failure is rerun once to distinguish a stable reproduction from an unstable signal. An inconsistent result is marked `Flaky`, with both runs recorded; it is not silently retried until green.

Unavailable tools or environments produce `Not verified` evidence and a `BLOCKED` or gap-aware verdict. Pre-existing failures are separated from failures caused or discovered by the audited change.

## 10. Reporting and Verdicts

Reports are written to:

```text
game/docs/qa/YYYY-MM-DD-<scope>-<mode>.md
```

Allowed final verdicts are:

- `PASS WITH EVIDENCE`
- `PASS WITH GAPS`
- `FAIL`
- `BLOCKED`

The skill never emits an unqualified `PASS`. Reports summarize the scope, risk map, verification commands and results, confirmed/suspected findings, new tests, coverage gaps, residual risk, and limitations.

## 11. Learned-Defect Loop

Confirmed defects are recorded in:

```text
game/docs/qa/learned-defects.md
```

Each entry includes:

- Component
- Trigger pattern
- Missed invariant
- Why prior QA missed it
- Regression test
- Domain-pack weighting recommendation

Quick review loads entries matching the changed subsystem. Deep audit loads the full file. The QA skill may recommend promoting a recurring pattern into a domain pack, but it cannot edit its own domain instructions during a review. Promotion is a separate, deliberate skill-maintenance task.

## 12. Project Integration

`AGENTS.md` will receive narrowly scoped routing rules:

- After implementing a feature or bug fix, invoke `tutienidle-adversarial-qa` in quick mode before completion claims.
- Invoke deep mode when the user requests it and before milestone/release readiness claims.
- Preserve the QA-only write boundary and independent evidence statuses.

`agents/openai.yaml` will expose a concise project-specific description and default prompt. Automatic invocation remains enabled for relevant development completion and QA-review requests, while unrelated tasks should not trigger the skill.

## 13. Implementation Validation

Before the skill is considered ready:

1. Validate skill structure and frontmatter with the skill-creator validation tooling.
2. Check all referenced files and relative paths resolve correctly.
3. Test `changed-risk-map.mjs` with representative path fixtures if the helper is retained.
4. Run scenario-based skill checks for:
   - a small isolated domain change in quick mode;
   - a save/time cross-system change that must escalate;
   - a deep audit request;
   - a suspected issue without runtime evidence;
   - a reproducible defect requiring a new failing test;
   - a defect needing a production hook, which must become a coverage gap;
   - an unrelated non-development request, which must not trigger the skill.
5. Verify the skill never writes outside its allowlist during those scenarios.
6. Review generated findings for evidence quality, not merely schema compliance.

The implementation plan must preserve the separation between QA test authoring and production repair and must not add dependencies or change application architecture.

## 14. Non-goals

- A general-purpose QA framework for other repositories.
- Autonomous production-code repair.
- Backward save-migration compatibility during the current development phase.
- Replacement of existing Vitest or Playwright suites.
- Production monitoring, deployment validation, or live-data testing.
- A claim that exhaustive testing can eliminate all game defects.

## 15. Completion Criteria

The design is successfully implemented when:

- The skill package is valid and discoverable.
- Quick and deep modes route to the correct project knowledge and verification depth.
- QA writes only tests and QA reports, never production fixes.
- Findings distinguish confirmed defects, suspicions, and coverage gaps with reproducible evidence.
- Cross-system and unanticipated-risk reasoning is explicit through invariants and attack operators.
- Learned defects influence future reviews without self-modifying the skill during an audit.
- Project routing reliably invokes quick review after implementation and deep review at release boundaries.
