# Architecture preservation workflow

Maintained workflow, introduced 2026-09-12. Applies to workers, coordinators and reviewers. This is the operational checklist for AGENTS.md A1-A12 and AstraDoctrine.md; it does not grant additional implementation scope.

## 1. Purpose and sources

Preserve one owner per rule/state while delivering the requested behavior. A worker finishes one coherent responsibility and its real consumers, then stops. Finding more defects does not authorize repairing them.

Read sources in this order:

1. Current user request and authorized scope; root `AGENTS.md` and applicable agent instructions.
2. Relevant phase/status in `game/docs/roadmap.md`, including later maintained updates to that system; relevant current `game/docs/qa/` reports.
3. `AstraDoctrine.md` for reasoning and migration discipline.
4. Current production owner, factories/composition root, actual consumers and relevant tests.
5. `game/docs/architecture/mission-0-architecture-audit-2026-09-08.md` only for historical failure examples and AR identifiers.

Mission 0 is an audit at a historical commit, not proof that a defect still exists or that its recommended target is implemented. Roadmap status also needs current source evidence. Record discrepancies; do not silently choose a convenient historical contract. If ambiguity changes product intent, ask the user; continue independent work. Deleted plans are not requirements.

Paths in this workflow and its templates are repository-relative unless explicitly described otherwise. Resolve them inside the assigned worktree.

## 2. Trigger and proportionality

| Task | Required workflow |
|---|---|
| Feature, fix, non-trivial production edit | G0-G5; core questions Q1-Q12; triggered domain modules |
| Architecture migration | Above plus authority/consumer ledger and duplicate-authority search |
| Read-only audit or plan | G0-G1, evidence and applicable questions; implementation/test gates recorded as planned, never passed |
| Pure Markdown, comments, formatting, typo | G0 scope and reference consistency; G2-G4 production gates N/A with reason |
| Worker resumes after compaction/handoff | Re-read task card, ledger, current diff and unresolved evidence; resume next incomplete gate |

Use the same task card in the existing plan or task QA report. Do not create a second plan or copy the entire questionnaire into every report. Record question IDs with short evidence answers; use tables for mappings. Explanations should identify decisions and evidence, not narrate every search.

This workflow is a review contract, not an installed CI check. Behavioral invariants require executable tests in the affected production path. Passing a questionnaire alone cannot certify architecture or runtime correctness.

## 3. G0 — Lock the responsibility before editing

Run `git status --short` and check the actual assigned checkout/branch. Follow P1/P2/P6 for isolation and overlap. Read enough current source to fill this card before production edits or dispatch:

```text
TASK CARD
Task / user request:
Assigned absolute worktree / branch:
Requested observable behavior:
Single responsibility / invariant:
Current owner (path + symbol):
Target owner (path + symbol; same owner is valid):
Existing primitive/mechanism to reuse:
Missing capability (or none), real caller that needs it:
Production chain: entry -> orchestrator -> owner -> downstream consumer
State: writer / readers / reset / persistence / async cleanup
Expected files and why each is in this responsibility:
Explicit non-goals:
Applicable roadmap phase and current source evidence:
Tests and gates selected, including runtime triggers:
Stop condition:
Unresolved material assumptions:
```

Each expected file needs a reason such as owns rule, calls owner, shares contract, persists affected state, tests invariant or documents changed contract. A file list is a forecast, not a reason to patch the wrong layer. A required additional consumer in the same responsibility can be added with evidence. A separate feature, ownership migration or product decision requires existing authorization or a user decision.

**G0 rejects:** “improve architecture”, “clean up GameManager”, “split this large file”, “fix all AR findings” without a concrete authorized behavior and responsibility. Narrow the worker assignment to a coherent slice of the user's goal; do not discard remaining authorized work from the coordinator's plan.

## 4. G1 — Architecture questions with evidence

For each answer use `Q-ID: decision — path:symbol / test / inspected command result`. A statement such as “follows A2” earns no credit. Planned tests are labeled PLANNED. N/A must name the absent trigger and supporting scope evidence. Unknown stays unresolved; do not convert it to N/A.

| ID | Question to answer before implementation | Required evidence / rejection condition |
|---|---|---|
| Q1 | What observable behavior must hold, including failure? | Input, expected state/outcome/events; reject implementation-shaped acceptance such as “helper exists”. |
| Q2 | Which one owner completes the entire rule? | Path/symbol and obligations (validation, mutation, consequences); reject helper that only does arithmetic while callers reconstruct outcomes. |
| Q3 | Who writes, reads, resets and persists important state? | State lifecycle map; reject a second mutable cache without refresh/reset contract. |
| Q4 | What exact real production chain reaches the owner? | Factory/registration and callers; test-only direct calls are insufficient. |
| Q5 | Which stable primitive already exists? | Search terms, relevant hits and reuse decision; new abstraction needs a present consumer and removed complexity. |
| Q6 | Do dependencies point toward foundations, transitively? | Imports and shared contract location; reject domain importing presentation, including a runtime cycle through a barrel. |
| Q7 | Are timing, gameplay and presentation separate? | Clock advance, domain commit and visual ACK responsibilities; reject visual completion awarding resources or determining damage. |
| Q8 | Does every production consumer preserve semantics? | Target/scope/order, required context, units, provenance and error contract; reject silent defaults, dropped effects or casts hiding unsupported input. |
| Q9 | Are queries observational and previews derived from the owner? | Query/preview call paths; reject activation, rewards, RNG consumption or resets hidden in a read. An explicit paid generation command is distinct from a query. |
| Q10 | What happens on duplicate, stale, failed and interrupted execution? | Identity, validation, cleanup, balances and event counts; reject shared booleans as session identity or success on partial failure. |
| Q11 | What old/alternate path remains and why? | Consumer inventory and classification live/transitional/unused; reject “legacy” as evidence of non-use. |
| Q12 | What proves the change stays within scope and is finished? | Each file mapped to invariant, verification commands, stop condition and separate debt; reject unrelated cleanup or hypothetical extensibility. |

For a migration maintain this small ledger throughout work:

| Rule/state | Current authority | Target authority | Real consumers | Migrated/evidence | Retained path and reason | Remaining task work |
|---|---|---|---|---|---|---|

Do not mark a rule migrated when only the new owner is tested. Inspect consumers, preview, persistence, reset, errors and downstream events. An unused adapter may be removed only after proving consumer status; a live transition needs a named purpose and retirement condition. A ledger is a record, not permission to retain a task-caused violation.

## 5. Domain modules — select by affected responsibility

Answer every row of each triggered module. These are invariant prompts, not assertions that specific historical implementations are still present.

### C — Combat, vitals, stats, effects and content

- **C1:** Do hit, bonus damage, DoT, reflection, healing and Ward changes use the appropriate complete authority? Test vitals, alive/death, lethal intervention and event count together for the touched variants. A correct damage number alone is insufficient.
- **C2:** Are raw/base, resolved and effective stats distinguishable? Recompute identical input twice without accumulating derivation. Apply/remove/reapply a relevant modifier and assert correct effective stats, including values actually read by queue/gauge.
- **C3:** Does the real authored skill pass through the production compiler/adapter/executor with self/ally/enemy targeting, ordered effects, conditions and execution policy preserved? Unsupported content must produce an explicit rejection, not a default physical attack.
- **C4:** Does every effect receive required source, target, battle context and source-stat policy from production callers? Test a source-sensitive case; a fixture that supplies context omitted in production is invalid evidence.
- **C5:** Are buff duration/turn/real-time units explicit, with shared semantic rules applied once? Preserve different clocks; test stack/refresh/expiry only where touched.
- **C6:** Are content variations expressed through supported mechanisms? Identify any introduced ID branch and prove that identity belongs to that owner; convenience is insufficient.
- **C7:** Is the maintained declaration/impact/completion contract preserved? Exercise duplicate, stale, out-of-order or missing ACK as applicable using the runtime's actual protocol, without inventing new pacing behavior.

### S — Save, session, asynchronous work and lifecycle

- **S1:** Is a snapshot detached from mutable live state? Mutate live data after snapshot and verify the snapshot stays unchanged, and vice versa where relevant.
- **S2:** Does restore define replacement/reset and repeated-application behavior? Restore twice; restore a changed payload with the same identity; assert no duplicate bags/rewards and no silently stale state.
- **S3:** Is validation before authoritative mutation, and does a failed restore preserve the defined session outcome? Verify the actual schema and adapter capability; an interface named cloud is not cloud support.
- **S4:** Can old async results write into a new session? Resolve the old result after reset/new session/disposal; verify identity-based rejection and cleanup.
- **S5:** Are timers, listeners, pending operations and scene resources owned and disposed? Exercise restart/remount and assert no double advancement or stale callback.
- **S6:** Are current-schema requirements sufficient? Do not introduce dev-save backward migrations unless requested. State any intentional current schema change.

### E — Inventory, production, economy and generated operations

- **E1:** Do failure/insufficient funds/full bag preserve the operation's defined balance contract? Test all relevant balances together; select atomic or explicit partial delivery based on intended behavior.
- **E2:** Does acquisition report requested/delivered/overflow, and do reward/event/UI consumers use the correct quantities? A toast is not a receipt.
- **E3:** Are paid/random results owned by the domain and bound to operation/item/session identity? Test forged result, replay, changed eligibility and stale item. Reject caller-invented preview acceptance.
- **E4:** Are preview eligibility/cost/ranges and commit derived from one owner, with commit revalidating current state? Change state between preview and commit.
- **E5:** Do online/offline allocation paths share allocation semantics while keeping explicit time units? Test all-manual, zero auto sites, below-capacity, over-request and empty inputs where supported.
- **E6:** Is the production-configured instance tested, including capacities/registries? Reconstructing a friendlier instance in a test can hide a wiring failure.
- **E7:** Do reward/progression/difficulty changes trigger balance-check? Architecture work must preserve product economics unless change is authorized.

### L — Progression, quests and runtime entry points

- **L1:** Can the system progress without ever opening its panel? Send the actual gameplay event before the first UI query; compare with the query-first path.
- **L2:** Is consequential progression committed by a headless domain command? Opening/closing UI or dropping a visual cannot decide grants, realm changes or resource spending.
- **L3:** Is the owner registered with the real application/runtime? For changed driving paths, run the relevant P13 E2E and assert advancement, not only boot.
- **L4:** Can retries, repeated completion events or reset duplicate rewards/transitions? Assert final state and event/receipt count.

### U — UI, Phaser, assets and presentation

- **U1:** Which canonical UI primitive owns interaction/a11y/layout? Search before adding a local tooltip/modal/slot/grid. Pure UI edits need not load unrelated economy/combat modules.
- **U2:** Do Vue and Phaser use the same measured projection for rendering and hit/drop coordinates? Verify resize and affected interaction in the browser under P14.
- **U3:** Are assets resolved/preloaded from one catalog? Validate externally derived paths before filesystem use; enumerate actual consumers.
- **U4:** Are rendering resources owned through narrow contracts? Moving code to a helper that writes scene internals does not transfer responsibility.
- **U5:** Are localized strings routed through i18n, and code comments plain ASCII English? Check the changed surface, without mass-migrating unrelated content.
- **U6:** Does P14 apply, and precisely what visual behavior was inspected? P14 runs inside the implementation worktree before merge-ready — record exactly what was visually inspected there; a genuine environment failure is reported as an explicit blocker, not a deferral. Do not report screenshots as proof of domain outcomes.

## 6. G2 — Turn invariants into useful tests

Before changing behavior, select the smallest test that would detect the violated invariant. Prefer an existing production factory/composition root over handcrafted entities. Characterize intended behavior, not a known defect. For a new regression demonstrate red before fix where practical; existing characterization can support a structural migration.

Every new architecture regression specifies:

```text
Invariant / Q or module ID:
Production input and entry point:
Setup (real factory/catalog/config when relevant):
Action, including failure/replay/reset sequence:
Expected authoritative state:
Expected return/receipt/events and counts:
Why the old/bypassed path would fail:
Command and observed red/green results (or honest limitation):
```

Use types for semantic input/context constraints, behavior tests for state/outcome contracts, dependency checks for structural imports, and E2E for application wiring. A grep search locates potential writers; it does not prove ownership. A mock verifying `owner.method()` was called does not prove its full outcome. File-size thresholds and snapshots of implementation text are not architecture tests.

Do not add a failing assertion for every historical AR item to an unrelated feature. Add guards for the responsibility actually changed. Do not weaken existing runtime guards to achieve green.

## 7. G3 — Implement one vertical path

1. Repair/reuse the lowest existing owner capable of enforcing the invariant.
2. Introduce a missing primitive only when it represents a stable present concept and removes demonstrated complexity.
3. Migrate the actual caller and affected preview/persistence/error/downstream consumers.
4. Remove a competing authority only after its callers are migrated and relevant characterization passes.
5. Search again for the rule, writes, alternate adapters, registration and semantic defaults.
6. Update the ledger and maintained reference if the contract intentionally changes.

At a scope change, write: `new evidence -> why required for this invariant -> affected owner/consumer -> added files/tests`. Continue authorized coherent work. Put unrelated discoveries in Notes/Suggestions with evidence; do not implement them. If product semantics or a separate migration need a decision, pause only dependent work.

Stop implementation when the task card's coherent outcome is met. Remaining authorized slices belong to the coordinator; “done with my slice” is not “whole request done”.

## 8. G4 — Verification and review

Follow existing P3-P5/P13/P14 gates, not a replacement scoring system. Gate order: simplify → verify → runtime/browser checks → adversarial QA → three-lens review round → fix → reverify → repeat round.

- Simplify with E3 when triggered, preserving behavior.
- Select P3 quick or full by actual triggers; record exact commands, exit results and relevant test counts. Stop at first failure and classify/fix under P12.
- Execute P13/P14 when triggered, inside the implementation worktree (the P14 worktree exception is retired — an environment failure is an explicit blocker with captured evidence, never a deferral to a main checkout). Record what remains unverified.
- After a feature/fix, run P4 adversarial QA in its restricted write scope. If production repair is needed, exit QA, repair in development and repeat affected gates.
- When P5 applies, run a complete three-lens review round over the simplified verified diff: Review A (correctness/regression/requirement fidelity), Review B (architecture/contracts/maintainability), Review C (tests/runtime/user flow — real runtime/Playwright evidence for browser-sensitive work). Every finding carries a severity (Critical/High/Medium/Low/Nit). Zero unresolved Medium-or-higher is the completion threshold; every Medium+ fix re-verifies and triggers a fresh complete round. Deferred Low/Nit findings stay listed with reasons. The user may explicitly waive a finding — record it.
- Docs-only work uses link/reference/mirror/consistency checks under E13; production QA, type-check/build and gameplay tests are N/A.

Review rejects an unsupported pass even when tests are green: missing current owner, helper-only coverage, real caller not migrated, duplicate authority without justified retained purpose, swallowed required context, untested task-critical failure path, unrelated redesign, or an unrecorded runtime gap.

## 9. G5 — Worker handoff and coordinator acceptance

```text
WORKER RESULT
Worktree path / branch:
Task card and responsibility:
Files changed -> purpose:
Behavior before -> after:
Q1-Q12 / triggered modules: PASS with evidence, GAP, or N/A with reason
Owner and actual migrated consumers:
Old/alternate path status:
Verification: exact commands, results, test counts, limitations
QA verdict (P4) / P5 review round (lenses run, findings by severity, rounds completed, unresolved Medium+ = 0):
P13 progression evidence / P14 visual evidence from the implementation worktree (or explicit environment blocker):
Unresolved task work:
Retained debt / Notes-Suggestions:
```

Coordinator reads the aggregate diff and evidence, including interactions between worker slices. A worker's assertion is not independent proof. Reject or return only the concrete unresolved responsibility; do not dispatch an open-ended “improve everything” follow-up.

These architecture questions do not replace P4 verdicts. Preserve the exact P4 verdict and legitimate reason, including its existing completion rules. A known unimplemented requirement cannot be labeled implemented. Keep any runtime gap or environment blocker visible in the final outcome. No commit/merge/integration/push/deploy authorization is implied by acceptance.

## 10. Ready-to-use worker assignment

```text
Read AGENTS.md, AstraDoctrine.md and game/docs/architecture/architecture-worker-workflow.md.
Work only in [absolute assigned worktree] on [branch].
Deliver [observable behavior] by repairing [one responsibility/invariant].
Read [current roadmap phase / maintained contract] and verify against production consumers.
Current suspected owner: [path:symbol]; confirm it before edits.
Expected chain: [entry -> owner -> consumer].
Expected files: [paths with purpose]. Non-goals: [separate systems/product changes].
Fill G0 task card; answer Q1-Q12 and modules [triggered IDs] with source/test evidence.
Add/retain invariant coverage through real production construction and migrate the affected callers.
Run G4 gates as triggered. Do not expand to unrelated findings; report them separately.
Return the G5 result. Stop at [coherent acceptance condition].
```

The coordinator fills every bracket before dispatch. Worker resolves implementation details autonomously inside the authorized responsibility. Missing implementation detail is not automatically a request for user approval.

## 11. Workflow qualification and maintenance

Use [architecture-worker-exercises.md](architecture-worker-exercises.md) to test whether an agent can apply these rules, especially after changing the workflow or delegation template. The exercises include expected evidence and rejection criteria; they are not the per-feature test suite.

When a repeated failure escapes review, add the smallest executable guard at the responsible layer and update the corresponding question/example. Do not accumulate global boilerplate for a single content exception. Keep architecture status in roadmap/QA, historical diagnosis in Mission 0, and workflow here. Changes to entry instructions require an agent restart under AGENTS.md.
