# Internal Fixed-Point QA Protocol

Status: CANONICAL — installed by mission M-QA-INTERNAL (adoption 2026-09-23). **This document is the sole QA decision law for this repository.** Every QA gate, review skill, detector and workflow listed below produces evidence INTO this protocol; none of them emits a competing verdict.

Owner: the primary coding agent as QA coordinator. Companion canon in this directory: `defect-taxonomy.md` (severity/classification/root-class/attack families), `ledger-schema.md` (record shapes + machine checks), `learning.md` (lesson history vs. promoted policy), `agent-instructions.md` (coordinator/reviewer operating instructions + message protocol), `qualification.md` (golden-bug benchmark + adversarial qualification + ruling rules). The executable runner is `game/scripts/qa/` via `npm run qa:internal`. Design rationale and audits: `game/docs/qa/2026-09-23-unified-fixed-point/` (historical).

## Installed layout

```
game/docs/qa/protocol/     canonical protocol documents (this directory)
game/docs/qa/learning/     history/lessons.jsonl (append-only) + policies/<hash>.json + active-policy.json
game/docs/qa/corpus/       corpus/index.json + cases/ (golden bugs, learned defects, cloud findings)
game/docs/qa/runs/<runId>/ ledger.json, journal.jsonl, manifest.json, evidence/, reviews/, report.md
game/scripts/qa/           cli.mjs, state.mjs, validate.mjs, decision.mjs, ledger.schema.json, tests/
```

## Authority map (installed)

| Producer | Role under this protocol |
|---|---|
| P3 verification (`npm run verify`, type-check, vitest) | Op B deterministic evidence |
| P18 OCR (`ocr` delegation) | Op: deterministic diff/rule-selection sub-operation, host-agent reasoning |
| P13/P14 runtime + Playwright | Op F/G real runtime evidence |
| P4 `tutienidle-adversarial-qa` skill + domain packs | Op A/D attack generation and execution |
| P5 sequential multi-pass review | Sequential review cycle (section 11) |
| G0-G5 worker gates, Q1-Q12 evidence | Census/intake/reconciliation inputs |
| Internal reviewers (Devin child sessions) | Op L Clean A/B independent review — sealed findings, access-isolated |
| Mutation/fuzz/property campaigns | Ops I/J/K |
| **This protocol + `qa:internal` runner** | sole decision authority — emits the run outcome |

Non-binding for verdicts (historical only): C2C conversation tooling, ChatGPT-Web external review, `SPEC → ChatGPT review until pass` pipeline references in `game/docs/p7/`, and external reviewer instructions elsewhere in the repo. Their findings remain as `HISTORICAL` evidence and corpus labels; no ChatGPT-Web call may be required or executed by any live instruction.

## 1. One workflow, one decision authority

The primary agent owns implementation, investigation, causal analysis, repairs, regression protection, evidence collection and final QA decision. All review work happens inside the agent harness. No mandatory ChatGPT Web, C2C conversation, external review service, login, quota or DOM transport remains.

Internal reviewers are bounded reasoning workers under that coordinator, not a second external approval system. They never merge, deploy, waive defects, rewrite requirements or certify the whole mission from a partial assignment. The primary agent must independently reason about their claims and the resulting aggregate state.

One entry point, one run manifest, one finding ledger, one attack-coverage matrix, one invalidation graph, one convergence predicate. Unit tests, runtime exercise, static reasoning, generated sequences and fresh reviewers remain distinct evidence producers. Combining their verdicts into a single checkbox would weaken the system.

Priority order is fixed: detection power, correctness, attack coverage, reasoning independence/diversity, root-cause removal, regression resistance, convergence confidence, then speed/simplicity/cost. No efficiency change may silently narrow an oracle or required surface.

The approval object is a **materialized aggregate repository state** and its declared complete attack model, including unchanged consumers. A diff is an entry point for impact discovery. It is never the approval object.

## 2. Outcomes and non-negotiable limits

Only the coordinator may emit:

| Outcome | Exact meaning |
|---|---|
| `QA_FIXED_POINT_REACHED` | The final-state predicate in section 12 is true for the declared repository snapshot and attack-model version |
| `QA_FINDINGS_OPEN` | At least one actionable defect remains unresolved |
| `QA_UNVERIFIED` | Required evidence, coverage, independent context, or repository access is missing |
| `QA_BLOCKED_SCOPE` | A discovered actionable defect requires a product decision or repair authority outside the authorized mission |
| `QA_ACCEPTED_WITH_EXCEPTIONS` | Human explicitly accepted listed unresolved defects/gaps; this is never an unqualified fixed point |

`SPEC_READY`, `PLAN_READY`, `LOCAL_GATES_COMPLETE`, `REVIEW_COMPLETE` and `CANDIDATE_CLEAN` are intermediate states, not mission completion. A tool's exit 0 or a reviewer's DONE means neither approval nor no defects.

Severity is Critical/High/Medium/Low/Nit and controls priority. Classification is REAL_DEFECT / SPEC_DEFECT / TEST_DEFECT / COVERAGE_GAP / DOCUMENTATION_DEFECT / FALSE_POSITIVE / NON_ACTIONABLE. All actionable correctness, specification, test and material evidence defects must close, including Low. Pure preferences are not manufactured into defects. A disputed defect remains pending adjudication, never silently downgraded.

This protocol offers empirical falsification confidence, not mathematical proof that all possible bugs are absent. A budget/time limit can pause a run or leave it unverified; it cannot satisfy convergence.

## 3. Scope, authority and safety

At intake record the user outcome, authorized repairs, non-goals, all applicable project laws, maintained product rulings and source locations. Source demonstrates actual behavior; it does not override intended behavior by being implemented. Historical reports supply hypotheses, not current requirements. Resolve contradictory authoritative requirements before dependent changes.

Reading/searching expands repository-wide whenever a rule or defect class requires it. Production writes remain within the authorized coherent responsibility and assigned checkout. An unrelated confirmed sibling remains visible and blocks a repository-wide fixed-point claim until repaired under authorization or explicitly excepted. Discovery is not blanket rewrite authority.

No commit, merge, integration into a shared branch, push or deploy is implied by QA approval. Preserve unrelated work. QA observers can create approved reproduction tests/evidence, but production repair belongs to the REPAIR phase with a named writer lease. Existing secrets rules remain unchanged; do not read credentials to create manifests or evidence.

Standalone VMs/clones can supply isolation equivalent to a worktree if current project rules explicitly recognize it; otherwise comply with P2. Runtime must be served from the exact implementation candidate before integration. Never borrow a main-checkout server to make a branch appear verified.

## 4. Snapshot identity and aggregate construction

Record these separately:

1. `productStateId`: SHA-256 of a canonical file manifest of the full reviewable tree, including production, tests, authored data, build/QA scripts, lockfiles and governing instructions/specs. Paths are normalized repository-relative, sorted; each entry records kind, mode and raw-byte content hash. Track deletions against the base. Include task-owned untracked code. A symlink records its target and must not traverse outside the checkout.
2. `contractId` and `attackModelId`: hashes of selected authoritative rulings/invariants and the complete attack manifest. Any changed rule or weakened oracle invalidates clean candidacy even if product files are unchanged.
3. `environmentId`: tool versions, dependency-lock hash/install provenance, OS, browser/channel, allowlisted build/runtime profiles, locale/viewport matrix, RNG/clock policies and server-to-candidate identity. Individual seeds, generated traces, actual allocated ports and per-case inputs belong to execution evidence, not this stable environment profile. Different planned profiles have separate coverage cells. No arbitrary environment dump.
4. `evidenceRevision`: append-only run-record sequence; evidence cannot change productStateId merely because a log is added.

Explicitly exclude only `.git`, caches/dependencies/build outputs and dedicated generated evidence/runtime mailboxes from the product manifest. Governing policy, tests, golden cases and source-like files may never hide under an excluded evidence path. Record excluded-path inventory and reasons; unexpected executable/source material there is an integrity failure. Credentials remain opaque/excluded; if a required oracle needs unavailable credentials, record the capability gap instead of reading them.

A clean Git SHA alone is insufficient for dirty work, staged-only review, worktree-local data or runtime overrides. Never run tests on the working tree then label them proof for a different staged index. Either materialize the staged tree in isolation or review/test the full candidate and declare it as such.

For multiple PRs, record an ordered dependency DAG with base/head SHAs. Materialize the intended combined candidate in authorized isolation. Verify each reviewed child head is actually included and record conflict resolutions as new changes. Independent child passes do not compose into aggregate approval. Refresh live PR metadata before construction, then freeze the candidate; do not chase a moving branch during a clean round. A later base update, merge, rebase or conflict resolution creates a new candidate.

## 5. Compile contract and census before approval

The invariant ledger records stable IDs, owner, legal writers/readers, projections/caches, valid/forbidden states, pre/postconditions, transitions, failure atomicity, inverses, save/restore/migration policy, lifecycle and observable consequences. Link every rule to an authoritative source and one falsifiable oracle.

For `A permits B`, attack `B without A`. For `A owns B`, remove/reset A and inspect B. For rejection, compare all affected owner states, receipts, events, queues, identities and persistence effects before/after; normalize only explicitly irrelevant volatile values. A boolean false is not an atomicity oracle.

Census each concept repository-wide: writers, readers, validators, serialization/deserialization, reconciliation/migrations, UI/simulation/runtime consumers, reset/revoke, grants/rewards, event producers/consumers, registries/config, fixtures/debug helpers/tests. Classify each occurrence CANONICAL / LEGAL_WRITER / PROJECTION / CACHE / COMPATIBILITY / MIGRATION / LEGACY / TEST_ONLY / DEAD / SUSPICIOUS. Record search roots, terms/symbols, inaccessible paths and follow-up call graph. A name search alone is not proof of absence; aliases, wrappers, event strings and data-driven consumers require tracing.

Cross-link invariant -> owner/census -> attacks -> evidence -> findings -> regression pins. No materially affected out-of-diff consumer can disappear because the implementation was local.

## 6. Evidence-producing operations

All operations report into the same ledgers. They cannot define competing completion policies.

| Op | Required evidence surface | Trigger / minimum contract |
|---|---|---|
| A | Adversarial contract/plan review | Every behavioral mission: illegal/reverse transitions, exact numbers/units, authorable states, deferred content, failure semantics; review intended behavior before implementation narrative |
| B | Deterministic verification | P3 quick/full for each implementation state; final aggregate always full. Retain architecture/catalog tests, build, meaningful configured lint and asset/bundle checks as classified in the manifest |
| C | Structural/authority review | Repository-wide owner/consumer census for changed concepts; transitive dependencies, duplicate rules/state, live legacy path and query purity |
| D | Semantic adversarial review | Boundaries, repeats, inverses, partial failure, reordering, stale eligibility, cross-system effects; present concrete counterexamples |
| E | Persistence attack | Persisted/restore/reconciliation dependency closure: valid nonempty round trip, malformed/current, stale/repeated identity, failed restore non-mutation, explicit old-version policy |
| F | Real runtime wiring | Production factories/registrations/call signatures, actual clock progression, exactly-once settlement, restart/disposal; headless manager and browser driving paths as applicable |
| G | UI/Phaser/E2E | Reachable actions, enabled/commit parity, save-reload projection, keyboard/focus, clipping/resize, canvas animation/ACK, reduced motion, real console/network failures |
| H | Test/oracle quality | Every new material pin and relevant old coverage: intended failure reason, reachable fixtures, independent expected values, post-action owner assertions, no SUT mock or bug-encoding snapshot |
| I | Property/state-machine | High-risk stateful owners and cross-owner sequences; seeded valid/invalid actions, invariants after each action, shrinking and replay |
| J | Targeted fuzz | Persisted data, registry IDs, numeric/enum/metadata boundaries, adapters and event ordering where applicable; classify schema-invalid versus semantically invalid separately |
| K | Targeted invariant mutation | Historical/high-risk invariants; demonstrate important violations are killed by the claimed oracle; invalid/equivalent mutants do not count |
| L | Fresh internal red-team | Clean A and Clean B aggregate reviews with actual isolated context, different attack lenses, full scope access and explicit coverage |

P18 OCR remains a deterministic diff/rule-selection sub-operation before later semantic review, using the primary/internal host agent's reasoning. It is not a separate external intelligence dependency. Missing mandatory OCR is a tooling gap under current rules; ChatGPT Web is never the fallback. Optical inspection of screenshots and Alibaba OCR are different things.

Every invariant/surface cell is REQUIRED / NOT_APPLICABLE, with reason and reviewer acceptance. A required unexecuted cell is MISSING, never NOT_APPLICABLE. Planned tests, old green logs and a reviewer saying 'looks good' are not completed cells. Empty content registries may justify production negative evidence plus fixture-injected positive contract evidence; label both and invalidate applicability when content is authored.

## 7. Runtime and deterministic gate details

Commands run from `game/`; record exact arguments, cwd, state identity, timestamps, exit status, actual counts including skips/expected-fail, and retained log hashes.

- Repair loop: `npm run type-check` plus relevant `npx vitest run ...`; trigger full mode under P3. Stop on first failure, classify causality, repair task-caused failures and rerun. Do not conceal failure by aggregating pass counts.
- Final aggregate: `npm run verify`; `npm run test:e2e` for this browser game with full required suite; meaningful lint, bundle/asset scripts and required simulation/property/fuzz suites from the manifest. `npm run lab` is explicitly separate: promote stable relevant lab assertions into gating tests or run designated lab cases; scratch experiments are not automatically gates.
- Baseline task-independent failures are recorded without blaming the change. Required final aggregate evidence still cannot be green while a test is failing or unavailable. Use a separately prepared baseline checkout for causality; no destructive stash/reset dance.
- Provision known requirements such as ImageMagick when needed. An unavailable asset executable is an environment failure, not a passing asset test. Missing browser capability is QA_UNVERIFIED.
- A real browser must use the actual printed URL and proven candidate source. Inspect observable progression, persistence and canvas/interaction, not only boot/console silence. Capture trace/screenshot plus domain outcome separately.
- Existing scaled-deadline E2E runs retain their purpose for contention. Add required normal production timing attacks for lifecycle/time invariants. State which timing/config each result covers. Do not normalize away a genuine timeout defect.
- Flakes: preserve first failure, seed/trace and rerun diagnosis. Retry-green alone cannot resolve an invariant failure. Narrow a nondeterministic failure or record it unverified; never silently quarantine it.

## 8. Finding lifecycle and bug-class hunt

Lifecycle: OBSERVED -> TRIAGED -> PROVEN -> REPAIR_AUTHORIZED -> FIXED_PENDING_PROOF -> PINNED -> SIBLINGS_RESOLVED -> CLOSED. Alternative terminals: REJECTED_WITH_PROOF, DUPLICATE_LINKED, HUMAN_EXCEPTION. A coverage gap can be proven by a missing required observable/oracle rather than a game failure.

Evidence modes remain distinct: EXECUTED_RUNTIME, EXECUTED_INTEGRATION, EXECUTED_PROPERTY, SOURCE_PROOF, EXECUTED_MUTATION, EXECUTED_UNIT_STRUCTURAL, HISTORICAL, INFERRED, SPEC_DRIFT. Label reachability: production-reachable / supported-boundary / fixture-injected / hypothetical / unknown. A valid direct static proof can establish a defect; do not require a costly runtime reenactment to acknowledge it. Suspected reachability remains uncertainty, not fact. A report cannot claim runtime confirmation from source.

For every proven defect:

1. Record minimal counterexample, intended versus actual behavior, violated invariant and exact snapshot/location.
2. Trace the lowest authoritative owner capable of enforcing the full outcome. State root cause and root defect class independently of the failing line.
3. Search semantic siblings across the entire repository: same rule, alternate entry, analogous mutator, old/new field, save/reset/revoke, preview/commit, simulation/runtime and all production catalogs.
4. Record each search and every hit/disposition. An empty search with one literal symbol does not close the hunt. A reviewer challenges the search vocabulary and boundary.
5. Repair the coherent cause and all authorized affected consumers. If siblings require separate product scope, link blockers instead of silently ignoring or repairing them.
6. Add the strongest useful regression pin; prove it fails on the original bug or representative equivalent mutation for the intended reason.
7. Reverify impacted gates, invalidate downstream evidence, independently challenge closure, then re-audit the new aggregate.

Closure requires all eight conditions: original defect resolved, root cause justified, root class assigned, sibling hunt complete, actionable siblings closed/explicitly excepted, pin or justified alternative evidence, affected deterministic gates green, and fresh current-state closure review. Mutually linked siblings close atomically as a reviewed closure group once every member meets the local conditions and every outgoing dependency is closed; no circular individual-close prerequisite is allowed. Human exceptions are not clean closure for fixed-point purposes.

## 9. Regression pins, generated actions and mutation

Prefer complementary invariant/property assertions and production-seam integration; add exact transition, persistence and focused unit pins where each observes a distinct failure mode. Documentation-only protection is weak for runtime correctness. A mutation killed by an import/type error does not prove a semantic runtime pin.

Thresholds: negative/zero where legal to inject, minimum-1/minimum/minimum+1, cost-1/cost/cost+1, cap-1/cap/cap+1, finite/NaN/Infinity and safe-integer/overflow boundaries at supported input boundaries. Test all relevant balances and event counts, not only return value.

Inverse pairs: grant/revoke, learn/unlearn, equip/unequip, activate/deactivate, unlock/reset, upgrade/respec, create/destroy, acquire/lose, parent/dependent cleanup. Define whether reversal restores the original state, removes a contribution or intentionally retains history; do not assume every product operation is reversible.

Generated stateful campaigns begin with real factories and production catalogs. Use an independently authored abstract model/oracle derived from rulings, never the same SUT helper to compute expected results. Commands carry preconditions, execute through real domain APIs, and assert all applicable global invariants after each transition. Invalid command generation is deliberate and asserts failure atomicity. Save/restore into a fresh owner at intermediate checkpoints; continue actions after restore.

Initial mandatory domains: inventory/reward/capacity; cultivation path/way/node/skill ownership and respec; Body/essence/progression; save/session/async; combat/ACK/settlement; presentation lifecycle. Sequences combine boundaries such as learn -> invest -> reset -> save -> restore -> revoke -> re-learn, and preview -> state change -> commit -> retry -> restore. Include two-owner interactions and three-owner chains when writes cross those owners; maintain actual edge coverage, not just many random actions.

Minimum initial experiment profile for each high-risk state machine: all named deterministic edge sequences, at least 100 recorded seeds of 100 actions, then fresh seeds for Clean B; final profile is increased where coverage remains weak. These counts are a floor, not stopping criteria or proof of exhaustiveness. Reachability, transitions, inverse pairs, input partitions and relevant event schedules must be covered. Record RNG stream and clock controls; a seeded battle does not imply seeded economy. Use existing RNG/manual clocks where practical; a new dependency requires architectural approval under project rules.

Shrink failing sequences while preserving reachability/preconditions and the violated oracle. Persist the original and minimized action trace, seed, generator version and environment. Replaying only a seed after a generator change is insufficient.

Mutation jobs use disposable isolated copies of the candidate. One named mutant per job; never mutate the reviewed candidate in place. Operators include omitted gate/debit/inverse cleanup/reconciliation, duplicate debit/settlement, > versus >=, unknown-ID fail-open, field dropped by adapter, consumer unwired, forged/stale token accepted, cache writable and legacy authority restored. Record KILLED_EXPECTED / SURVIVED / INVALID / EQUIVALENT with evidence. A critical survivor creates a COVERAGE_GAP and resets convergence. Require valid representative mutants for every high-risk invariant/root class; no arbitrary total mutation-percent target substitutes. Verify immutable candidate hash before and after jobs.

## 10. Internal reviewers and independence

The primary agent does the complete self-audit and reconciliation. It dispatches bounded internal reviewers when the harness supports fresh contexts, or schedules fresh agent sessions on the same project snapshot. No external service is required.

Independent means a new context whose first analysis has not seen earlier findings, implementation commentary, previous verdicts or ledgers containing answers. Same model in separate contexts can provide contextual independence; it is not model diversity. Different models are optional, never required for availability. A role switch in the same conversation is useful self-review but does not qualify as independent.

Provide neutral user requirements, current governing laws/rulings, full candidate read access, domain/attack assignments and execution capabilities. Reviewers derive their own invariants/census before seeing coordinator findings. Baseline curated historical classes may be supplied equally in Round A. Round B receives no Round A history, findings or seeded example answers. Findings/evidence files are access-separated, not merely followed by 'do not read'. Reviewer must attest what context was exposed. Contaminated reviewer output remains useful but cannot count for blindness.

Contract review, correctness, authority/persistence and runtime/test-quality lenses are mandatory responsibilities, not silos. Each can report outside its lens. Assign disjoint primary coverage where useful and intentional overlap on high-risk invariants. Freeze their snapshot; any repair creates a different reviewed state.

If the harness lacks isolated contexts, the main agent continues all useful internal work and produces QA_UNVERIFIED with `independence_missing`; it does not reactivate ChatGPT Web or claim role-play independence. Devin adoption must qualify native isolated reviewers before advertising full fixed-point capability. A user can explicitly accept a weaker single-context result, labeled QA_ACCEPTED_WITH_EXCEPTIONS.

Reviewer scheduling is governed by the just-in-time slot policy in `agent-instructions.md` section G: sealed reviewers are dispatched only when their frozen inputs are ready, end after `SEALED_RESULT`/`NEED_CONTEXT`, and are required at the decision-critical points (Clean A/B, Critical/High closure verification, lesson qualification). All other review work is the coordinator's own and never counts as independence evidence.

## 11. One executable control loop

The runner `game/scripts/qa/cli.mjs` (`npm run qa:internal`) executes this orchestration contract: `init --request <file>` → `snapshot --run <id>` → `record --run <id> --input <file>` → `validate --run <id>` → `decide --run <id>` → `render --run <id>`; `qualify` runs the orchestrator attack suite + golden-bug benchmark.

```text
INTAKE -> SNAPSHOT -> CONTRACT_AND_CENSUS
  validate scope, access, tool capability, state/contract/attack identities
  independently attack spec; convert accepted rulings to invariant ledger
  establish repository-wide domains/edges and coverage obligations

while true:
  if a proved actionable finding exists:
    triage root cause/class; sibling census
    if repair needs unavailable authorization: QA_BLOCKED_SCOPE
    enter REPAIR with one writer for affected surface
    fix + regression pin; exit REPAIR
    compute new snapshot; invalidate evidence by section 13
    cleanA = cleanB = false

  run required deterministic verification; stop/diagnose failure
  run OCR diff selection/rule review on current task diff
  run required real runtime/visual/persistence operations
  run adversarial attack campaign (P4 operators, tests, property, fuzz)
  reconcile evidence; any actionable finding -> continue

  run sequential review cycle against current aggregate:
    1 correctness/regression and oracle quality
    2 authority/ownership/persistence after phase-1 resolutions
    3 adversarial assembled integration after phase-2 resolutions
    each phase records candidate identity, findings, fixes, evidence
    any fix -> leave review, re-enter REPAIR, invalidate, restart as needed
    a final-phase fix always requires another resulting-state review

  when a full cycle is clean and coverage complete:
    record Clean A (independent first analyses required)
    synthesize novel attacks against unchallenged assumptions/edges
    execute new attacks; add durable pins if needed
    if pins/contracts/product change: new state, restart Clean A
    run Clean B with fresh blind internal reviewers and fresh attempts
    if finding/gap: invalidate candidacy; continue
    run final targeted mutation/coverage audit
    if survivor/missing/invalid coverage: record finding; continue
    run FINAL_FULL_VERIFY on the exact candidate
    if any failure, drift, unavailable gate or actionable finding: continue or QA_UNVERIFIED
    independently check the terminal predicate
    emit QA_FIXED_POINT_REACHED with explicit scope and limits
    stop
```

During adoption retain old P3 -> P18 -> P13/P14 -> P4 -> sequential P5 ordering. In the installed system these are scheduled operations and chronological views of the shared ledger; they do not each create another competing pass/fail authority. The three sequential responsibilities are a minimum review cycle, not a fixed round budget. Detection continues until actual convergence.

## 12. Novel attacks and terminal predicate

After Clean A, a fresh internal attack designer first derives challenges without receiving A's findings. The coordinator then compares proposals against the existing attack log. Novelty means a new falsifiable assumption, action ordering, input partition, consumer/owner edge, failure point, event schedule or oracle, not merely a renamed test or new random seed. Record old assumption, new counterexample and decisive observable.

For every high-risk domain and every touched cross-domain edge, require at least one new meaningful challenge; if none can be generated, a fresh reviewer must document attempted synthesis and justify adequacy. Checklist exhaustion is not evidence. Mutations and previously separate root classes can be composed to generate attacks. Round B reviewers receive the neutral resulting attack specification, never A's finding history or conclusions.

The attack model freezes the required families, applicability, generators, oracle rules and challenge envelopes, not an exhaustive list of future input values. Fresh input/action/schedule cases generated inside those envelopes are evidence and do not change attackModelId. Novelty still requires a newly challenged assumption/edge/order/partition, not a seed alone. Thus A -> novel cases -> B is possible on one model.

If synthesis discovers a missing family/oracle/generator, or creates a permanent test, expand the model/tree and restart the clean pair. Preserve the synthesis record, partition its concrete challenges into an A validation set and an unexecuted B challenge set, then freeze the new epoch. After its new A, a fresh reviewer synthesizes/checks the reserved challenges against A's executed-case coverage without seeing findings, executes meaningful new cases and proceeds to B. It need not invent another model revision just to satisfy novelty. Any actual new defect or still-missing model requirement restarts candidacy. All campaign code is internal, immutable and state-bound; generated input/trace artifacts are append-only evidence.

Terminal predicate is a conjunction, never a numeric score:

1. Repository/contract/attack-model identities match every accepted clean/final evidence item; candidate remains unchanged.
2. The whole defined aggregate attack model has a complete domain/owner/consumer census and explicit required/N/A cells; no access gap or silently skipped file/tool.
3. No actionable defect, disputed material finding, required coverage gap, unresolved sibling or human exception remains.
4. All mandatory deterministic/runtime gates are executed and green on the exact final state; baseline/environment failures are not hidden.
5. Sequential resulting-state reviews occurred and all final-phase fixes received a fresh subsequent review.
6. Clean A and Clean B on the same frozen candidate/model are complete, separated by documented novel-attack synthesis/execution, with independent uncontaminated reviewer contexts. If synthesis expands the model, the clean pair restarts as above; it cannot indefinitely claim progress from stale A.
7. High-risk mutation and golden-bug obligations are satisfied; no survivor is dismissed by a percentage.
8. Coordinator has verified evidence integrity and an internal verifier has independently checked the terminal predicate/manifest.

Success sentence: `QA_FIXED_POINT_REACHED for <productStateId>, <contractId>, <attackModelId>, <environmentId>: no actionable defect remained detectable under the complete declared attack model after the recorded independent falsification attempts.` Include untested platform/capability boundaries; never abbreviate this to 'bug-free'.

## 13. Invalidation table

Every result declares input hashes, invariants, consumers, environments and prerequisite evidence. Reverse dependency traversal marks STALE. Missing dependency metadata defaults to broad invalidation.

| Change | Mandatory invalidation and re-entry |
|---|---|
| Canonical state/rule, shared primitive, save schema/restore, registration/timer, dependency/config | All impacted domains plus transitive consumers, contracts/census, deterministic/runtime/property/mutation/QA/reviews; both clean rounds; final full verification |
| Domain behavior/caller/consumer | Dependency closure including preview/save/reset/events; affected gates plus OCR on new diff; clean rounds and final verification |
| UI/layout/text/i18n | Relevant rendered/semantic/locale/a11y/runtime evidence and tests; if labels encode product rules also domain/spec oracles; clean rounds on new tree |
| Tests, fixture, expected output, model/oracle | Test-quality, regression kill proof, corresponding gates/mutations and reviews; clean rounds; never green by editing expected values |
| Product ruling/invariant/attack applicability | Contract review, coverage/census and every dependent oracle; clean rounds even with identical production bytes |
| Base/head/rebase/integration/conflict resolution | New aggregate snapshot; impact recensus, full verification, aggregate review and clean pair |
| Toolchain/browser/runtime flags/environment | Evidence requiring that environment, timing/parity checks and final verification; clean confidence cannot cite the previous environment |
| Append-only evidence receipt, corrected typo in generated log | Preserve product state; revalidate evidence integrity/provenance. A change to a substantive claim reopens its dependent decision |
| New finding or mutated invariant survives | Candidacy false immediately; root-class hunt and closure cycle required |

Targeted reuse is allowed only with complete unchanged dependency identity and reviewer acceptance. Final full verification still runs; caching cannot bypass the final gate. Persist invalidations automatically in the coordinator journal so compaction/resume does not depend on memory.
