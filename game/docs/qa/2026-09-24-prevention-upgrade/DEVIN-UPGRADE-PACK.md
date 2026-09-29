# Devin upgrade pack: prevent mistakes before implementation

Design date: 2026-09-24. Status: proposed upgrade; not an installed or performance-certified implementation.

## Hướng dẫn gửi cho Devin

Bạn hãy nâng cấp **hệ thống QA nội bộ đang hoạt động trong project** để bài học giúp agent làm đúng ngay từ đầu, đồng thời giữ nguyên sức phát hiện lỗi của QA hiện tại. Đây là một pack độc lập cho lần nâng cấp: đọc toàn bộ nội dung dưới đây rồi audit bản đang cài, không cần người dùng đính kèm lại pack cũ.

Mục tiêu là một vòng làm việc thống nhất:

**Hiểu nhiệm vụ -> lấy bài học phù hợp -> xác định cách làm đúng -> kiểm chứng chỗ dễ sai nhất -> triển khai -> QA hiện có -> học cả cách xây dựng lẫn cách phát hiện.**

Giới hạn cứng: **tối đa 5 agent hoạt động đồng thời, tính cả agent chính và mọi agent con của mọi nhiệm vụ dùng chung giới hạn đó**. Không giữ một agent chỉ để theo dõi hoặc đợi reviewer. Không mặc định một agent đã nhắn xong hoặc đang pause là đã trả slot; phải kiểm chứng bằng capability thực tế của môi trường.

Người dùng đã có QA hoạt động tốt. Hãy nâng cấp tăng dần, không cài lại từ đầu, không thay gameplay, không bỏ test/review, không mở lại phụ thuộc ChatGPT Web. Chỉ triển khai instruction, protocol, schema, routing, công cụ QA và qualification cần thiết. Không commit/push/merge/deploy khi chưa được cho phép trong phiên hiện tại.

Thực hiện các milestone ở section 13. Các tên file và interface bên dưới là **đề xuất đích**, không khẳng định chúng đã tồn tại trên cloud. Đối chiếu và dùng cấu trúc canonical hiện có; không dựng hệ thống thứ hai chỉ vì tên khác.

## 1. Problem and design choice

The previous design consumes lessons mainly by selecting regression pins and adversarial attacks. This helps find the same class sooner, but the implementer can still choose the wrong owner, API, state model or migration order and discover it only after writing most of the change.

Upgrade the same learning system to produce two connected outputs:

1. **Construction guidance:** what to use, how to sequence the work, what must remain true, what to prove first, and when that advice does not apply.
2. **Detection protection:** executable guards, regression pins, attack operators, independent review and final evidence.

One lesson lineage, one policy publisher, one task record, one final QA authority. Guidance is not a second verdict system and is never proof that the resulting code is correct.

Options considered:

| Option | Benefit | Cost / reason for choice |
|---|---|---|
| Put every past lesson into every prompt | Easy initial setup | Stale advice, overload and contradictions; no reliable proof of consumption. Reject as the operating model. |
| Add independent reviewers before every coding step | Earlier objections | Repeated setup and waiting; scarce slots consumed even for established patterns. Use only for material uncertainty and existing required reviews. |
| Retrieve applicable guidance, validate a construction brief, prove uncertain seams early, retain final QA | Prevents repeat decisions and exposes wrong assumptions before expensive migration | Chosen. Reuse the existing G0/G1 task card, current contract review and unified ledger; qualify routing and enforcement. |

An agent may use a different implementation from a suggested recipe if it satisfies the current contract and explains its evidence. A recipe cannot overrule the user, current architecture, real production capability or authorized scope.

## 2. Non-negotiable preservation contract

Audit the installed protocol and map every current obligation to its continuing owner before editing it. Preserve:

- Current user scope, protection rules, authority boundaries and project-specific architecture workflow.
- Exact aggregate candidate identity; separate product, contract, attack-model and environment identity; stale-result rejection and transitive invalidation.
- Deterministic verification, OCR delegation where required, real runtime/wiring/visual evidence, test-oracle review, property/fuzz/mutation obligations and historical defect replay.
- Chronological resulting-state review responsibilities. Three parallel opinions on one snapshot do not replace sequential passes; a meaningful final-pass fix still needs review of its resulting state.
- Fresh internal independent falsification, Clean A / novel attacks / fresh Clean B where required, closure/sibling proof and the complete terminal predicate.
- Every currently blocking actionable finding, required gap and exception rule. Scheduling or prevention does not lower severity, suppress Low correctness issues, or turn missing evidence into success.
- QA production-write boundaries: findings cause an explicit repair transition; reviewers do not silently repair while reviewing.
- Qualification of learning, legal controls, history retention, and prohibition on automatic policy weakening.

If the deployed system is different from the earlier proposal, document the actual mapping. Preserve its useful protections and resolve material conflicts under current user/project authority. If no working baseline can be found, report that fact and scope the adoption separately; do not fabricate a successful baseline.

Only unnecessary duplicate transport, duplicated bookkeeping and redundant execution with valid reusable evidence may be removed. Preventive readiness, installation qualification and game QA completion are three different claims.

## 3. A prevention brief inside the existing task card

At task intake, and before the first substantial production change, the primary agent extends its existing G0/G1 task card with a **construction brief**. Do not create another independent plan or ask a new agent to repeat the same repository survey.

Generate the brief from current requirements, roadmap/rulings, actual source/callers/tests, pending PR dependencies and applicable promoted lessons. Retrieval can begin from the task description, but applicability is decided after inspecting the real owner/consumer chain. Do not use an embedding similarity score as authority.

Required sections:

| Field | Required answer |
|---|---|
| Outcome and scope | Observable success and failure; authorized responsibility; non-goals; explicit unresolved product decisions. |
| Current base and dependencies | Actual materialized source identity; target branch; dependent PR IDs and head identities; integration order and external changes that would invalidate the plan. |
| Rule/state owner | Current owner path and symbol; permitted writer; important readers; reset/save/restore and async cleanup. |
| Reuse route | Actual primitive/API and complete production entry -> owner -> consumer chain. Verify signatures and semantics in the current checkout. |
| Intended delta | Which contract is preserved or intentionally changed, why authorized, and which real consumers must migrate together. |
| Matched lessons | Exact lesson revisions; triggering semantic operation/invariant; guidance to follow; protection to run; exclusions rejected with evidence. |
| Construction steps | Ordered runnable slices; what is reused; required context/identity/units; failure/retry/inverse behavior; where effects commit. |
| First decisive proof | Smallest meaningful proof of the highest-cost uncertain assumption through a real production seam; decisive state/receipt/event oracle; required stage `BEFORE_WRITE` or `BEFORE_PROPAGATION`. |
| Stop / replan triggers | Missing owner/capability; contradictory requirements; stale dependency; unknown meaningful failure semantics; unexpected scope/ownership change. |
| Verification route | Existing required gates, early checks, applicable lessons and coverage links. Planned evidence is visibly PLANNED. |

Each critical instruction states **DO + WHY + WHERE + PROOF + LIMIT**. For example: route grants through the currently verified acquisition owner; consumers use its delivered receipt because full capacity can yield zero delivery; test the real producer with a full bag and assert balances plus event counts; do not infer whether partial delivery is legal without the product contract.

Keep the rendered brief short enough to use: show applicable actions and critical unknowns first; link the complete evidence and applicability records. Compact presentation does not permit dropping a mandatory obligation. A task with no matching history still derives current invariants and receives baseline guards.

### Readiness outcomes

- `IMPLEMENTATION_READY`: owner/contract/caller route established; required guidance applied or explicitly resolved; meaningful unknowns affecting the next slice resolved; existing pre-implementation contract-review obligations satisfied.
- `DISCOVERY_REQUIRED`: bounded research, characterization or prototype needed before the affected production slice. Name the question and decisive evidence, then continue useful independent work.
- `SCOPE_DECISION_REQUIRED`: unresolved choice changes product intent or authorization. Ask only for that decision, with concrete alternatives and evidence.

These are task-stage results, never replacements for QA terminal outcomes. `IMPLEMENTATION_READY` is necessary for an applicable production slice, not sufficient for completion.

Separate prerequisites from results that require new code. `BEFORE_WRITE` evidence resolves the scope, owner, contract or production capability needed to authorize the next bounded slice. A `BEFORE_PROPAGATION` proof may be planned when that minimal slice is admitted; execute it after the slice exists and before copying/migrating the pattern to further consumers. Never require a not-yet-implemented feature to pass before permitting its first authorized implementation. Readiness records the admitted slice and which later slices remain blocked.

An isolated probe, characterization test or read-only investigation may run during discovery. An experimental implementation must be contained, identified as non-deliverable, and cannot silently become the production candidate. Do not use the phrase "prototype" to bypass scope or write boundaries.

### Avoid readiness churn

The brief binds to the planning baseline plus declared expected changes, current policy and semantic dependencies. Normal authorized edits are expected to change the tree; they do not demand rewriting the entire plan after every line.

At a responsibility boundary, meaningful fix, resume, new dependency or ownership/contract deviation, validate the brief's affected claims against the current state. Invalidate the affected plan items when a premise changes. Missing dependency metadata means broad revalidation. A missing material premise cannot be waived merely because it was originally marked ready.

Final QA uses the actual resulting candidate and its required final verification, not the planning baseline. Retain the historical readiness evidence and record whether the final change followed or validly revised each binding constraint.

## 4. Guidance with provenance, not a new source of truth

Use the existing lesson identity/version and policy mechanism. A lesson can have a qualified detection facet while its construction facet remains unqualified. Do not invent a recipe to fill a required field, and do not disable a working detector because construction guidance is unfinished.

An unqualified candidate may inform bounded discovery as an explicitly untrusted hypothesis. It cannot be an automatically applied recipe, a binding rule or evidence of readiness. An agent may independently establish a valid route from current source/contracts without waiting for a reusable recipe to be invented and promoted. Qualification of unchanged applicable guidance is reusable; do not repeat independent lesson promotion for every task that consumes it.

| Knowledge kind | Authority and allowed use |
|---|---|
| Invariant / contract constraint | Binding only when grounded in current authorized product/architecture rules or validated semantics; cite the authority. A remembered pattern cannot create new product law. |
| Construction recipe | Conditional route through verified owners/APIs with preconditions, ordered steps, failure/inverse paths and counterexamples. A justified alternative is allowed. |
| Verified example | Pinned source/test reference and why it is relevant. Revalidate the owner/API; never copy an old implementation blindly. |
| Hazard | Proven failure mechanism and trigger, linked to its positive alternative when known. A warning alone may be useful but is not qualified constructive guidance. |
| Discovery question | Material unknown plus a cheap discriminating experiment. This is not a production requirement or a proven defect. |

Every guidance record needs:

1. Applicability by operation, invariant, owner/consumer relationship and dependencies, including explicit negative applicability.
2. Current authority references and source fingerprints, not just a natural-language explanation or last-updated date.
3. Positive construction steps and rationale; existing primitive/API; required context, identity, units and complete outcome obligations.
4. Failure/retry/inverse/reset/persistence consequences when relevant.
5. Smallest decisive proof and existing detection links.
6. Status, independent qualification evidence, known limits and invalidation dependencies.

Dates are for maintenance; content/contract/dependency drift determines validity. A new commit hash alone does not invalidate all guidance if its complete relevant dependency identity is unchanged. Missing dependency knowledge prevents narrow reuse.

Use the most reliable prevention mechanism that fits the authorized task:

1. A sound domain model/type/API that rejects invalid inputs or centralizes the complete outcome.
2. A reusable production primitive with verified semantics and real consumers.
3. A cheap executable guard at the actual seam.
4. A current, qualified recipe with a decisive first proof.
5. A contextual warning or discovery question when stronger guidance is not yet justified.

Types cannot prove runtime atomicity, authority or event cardinality alone. The hierarchy is a selection aid, not permission for broad refactors or a universal transaction framework. Record promising out-of-scope structural improvements for an authorized task.

## 5. Before broad implementation: resolve the expensive uncertainty

For each coherent slice, identify the assumption whose failure would invalidate the most downstream work. Test that seam before replicating a pattern across files.

Examples:

| Task shape | Guidance before coding | Early proof |
|---|---|---|
| Save/restore | Use the current live owner and replacement/failure contract; validate before mutation where required. | Restore into a genuinely different live state; inspect owner state, repeated application and invalid-payload non-mutation. |
| Runtime registration/tick | Trace the actual application driver and lifecycle owner; ensure exactly the intended registration and cleanup. | Drive advancement through the real entry path; assert invocation/event count, restart and disposal. A boot smoke is insufficient. |
| Reward/inventory | Use the current acquisition authority and its requested/delivered/overflow contract. | Full/partial capacity through the actual producer; assert balances, receipt and downstream event count. |
| Content adapter | Preserve targeting, order, conditions, scaling and required context; reject unsupported capabilities explicitly. | One authored production item/skill through actual compilation and execution, with an outcome sensitive to the preserved field. |
| Ownership/progression | Map forward and inverse dependencies before adding another availability check. | Learn/grant then revoke/reset/restore; assert absence of orphaned state through actual owner APIs. |
| Async/session/UI | Domain owns state and session identity; presentation observes and acknowledges within its contract. | Late result after reset; duplicate completion; affected behavior before first panel mount; browser evidence when required. |
| Multi-PR integration | Validate dependency heads and shared owner contracts on the intended combined candidate. | Exercise the cross-PR caller/owner seam early; a pass on either PR alone cannot certify the composition. |

These examples are candidate patterns derived from the previous audit, not confirmation of current symbols or current product behavior. Devin must resolve the real paths and contracts before making them binding.

A simple, well-understood edit can reuse a meaningful current characterization test rather than inventing a new test or a separate prototype. Prioritize early checks by consequence, uncertainty, reachability and rework avoided; this ordering never removes mandatory final checks.

Once the seam holds, migrate a runnable vertical slice, including actual consumers and failure/inverse paths. Review the first instance before mechanical propagation. Batch repairs belonging to the same coherent cause, then run the applicable verification; do not generate a whole new review cycle for every changed line.

If a claim cannot be resolved cheaply, label the uncertainty and choose the smallest next experiment. Do not respond to uncertainty by writing the entire feature speculatively.

## 6. Learning must explain why construction went wrong

Extend the current incident loop with **origin analysis**, while retaining detector-escape analysis:

```text
incident or qualified successful pattern
 -> preserve source, behavior and evidence
 -> identify violated invariant and defect class (if any)
 -> analyze construction decision AND detector escape
 -> propose guidance facet + detection facet as applicable
 -> challenge on legal controls, counterexamples and unseen variants
 -> independently qualify each facet
 -> publish qualified facets in the existing versioned policy
 -> next applicable task receives actionable guidance before implementation
 -> observe consumption, early corrections, recurrence and later escapes
```

Classify construction origin separately:

- `NOT_RETRIEVED`: relevant guidance existed but was not routed.
- `STALE_OR_WRONG`: advice referred to an obsolete contract/owner or was incorrect.
- `AMBIGUOUS`: guidance named a concern without an actionable route or oracle.
- `NOT_APPLIED`: appropriate guidance was available but the plan/code bypassed it; investigate enforceability and usability instead of appending another warning.
- `MISSING_CAPABILITY`: a real production primitive/API could not safely represent the required operation.
- `CONTRACT_UNRESOLVED`: implementation proceeded while intended behavior was unsettled.
- `NOVEL_CLASS`: the relevant failure mechanism was not in the model.
- `UNKNOWN`: evidence does not establish the origin; do not fabricate causality.

Map the repair to the cause: fix retrieval, retire stale advice, improve the construction route, strengthen a seam guard, propose an authorized owner/API repair, or resolve the contract. An extra paragraph saying "be careful" is not a completed prevention improvement.

### Qualification for constructive guidance

Before a guidance facet becomes `QUALIFIED`:

1. Resolve its authority and API/consumer capability in the actual repository; clearly separate intended rule, observed implementation and inference.
2. Show how the construction route avoids the known causal mistake. For an incident-derived rule, use the original or a faithful representative wrong plan/implementation, not a toy unrelated error.
3. Demonstrate the valid nearby route remains allowed, including at least one counterexample to over-broad applicability where relevant.
4. Challenge transfer on a held-out sibling scenario not used to write the recipe; keep challenge inputs and outcomes sealed until the first attempt is recorded.
5. Have a fresh internal verifier check oracle, provenance, applicability and scope. The author cannot be sole approver. This can be a bounded assignment batched with compatible learning work, not a permanent agent.
6. Run an isolated pre-publication qualification trial through the actual routing/brief/action path using the pinned candidate overlay described below. Do not equate "loaded text" with applied guidance.
7. Run the previously accepted QA-policy checks plus candidate checks. A new rule never grants itself weaker acceptance criteria.

**Pre-publication trial:** inject a pinned, explicitly `CANDIDATE` guidance facet into an isolated qualification task with a candidate-policy override. The ordinary active policy is unchanged. Exercise the real retrieval, brief, simulated readiness checks and bounded trial actions; record the override and candidate identity on every result. Trial readiness is namespaced to this non-deliverable qualification task and cannot authorize ordinary production dispatch, completion or publication by itself. Independent controls and review still decide whether the facet qualifies. This is the only candidate override path; normal task intake cannot use it implicitly.

**Post-publication adoption proof:** after independent qualification and atomic publication, start a fresh ordinary task without any override. Confirm it consumes the active promoted revision through normal intake, then records its actual use. This proves rollout and is required for upgrade/adoption qualification; it is not a circular prerequisite for initial facet qualification. A routing failure opens an adoption incident and blocks the affected rollout claim, preserving valid baseline detection while the responsible path is repaired.

Store pre-publication trial evidence and post-publication adoption evidence separately. A trial cannot be relabeled as ordinary next-task consumption. Keep held-out challenge inputs and first outcomes separate from both recipe-authoring and task-brief materials.

For a successful-pattern lesson with no demonstrated defect, retain positive construction and control evidence but mark causal prevention `NOT_ESTABLISHED`. It may be qualified as a verified route; it cannot be promoted into new binding product law or advertised as a proven prevented bug.

Detection promotion retains its original kill/control/sibling/independent requirements. Publication can promote only the qualified facet; record pending work on the other facet without misrepresenting whole-lesson status. A necessary missing protection remains a QA gap under the existing contract.

### Prevention evidence has levels

| Observation | Allowed claim |
|---|---|
| Brief included a relevant rule | Guidance delivered. |
| Agent selected the supported owner/API before coding | Guidance applied; counterfactual bug prevention not yet proven. |
| Preflight rejected a demonstrably defective proposed plan and the corrected plan passed its oracle | Observed early correction. Record reason and evidence before the correction. |
| Early seam proof found a defect before propagation | Early detection; record actual downstream scope avoided, do not invent saved hours. |
| Held-out comparative tasks produce fewer construction errors at unchanged QA obligations | Evidence of improvement for that evaluated sample; report sample, uncertainty and escapes. |

Do not count reading a lesson, adding a test, or one green task as a prevented defect. Learning history stays append-only. Rollback preserves the original incident and still-valid protections.

## 7. Retrieval, freshness and context economy

Use a deterministic index over existing lesson IDs, domain/operation tags, invariant references and the owner/consumer graph first. No vector database or new service is required. Optional semantic search may propose candidates; it cannot silently decide that a binding rule is irrelevant.

Routing sequence:

1. Derive scope/operation from requirements and current production census.
2. Load mandatory global integrity sentinels and all matching binding lessons; retain current baseline global-sentinel semantics, including any required applicability checks.
3. Check authority/source/dependency freshness and exclusions. Contradictions are resolved by current authority, not popularity, age or number of agreeing lessons.
4. Produce a short construction brief and complete machine-readable routing record: `APPLY`, `NOT_APPLICABLE` with proof, `STALE`, or `NEEDS_DISCOVERY`.
5. At the relevant construction step, load the detailed recipe/example and early proof. Keep full mandatory references available; do not flood every worker with the entire corpus.
6. On scope expansion/resume/dependency change, update only the affected routing and brief claims where safe; preserve unchanged validated research.

Detect false-negative routing with synthetic semantic aliases, moved owners, unchanged callers, cross-domain effects and historical escaped classes. A filepath-only lookup is insufficient. If the index is unavailable, use a complete bounded fallback scan of the required policy; if coverage cannot be established, readiness for the affected slice is unresolved.

Cached census/guidance requires all relevant content/contract/dependency hashes and capability identity. A missing cache key, uncertain transitive dependency or unexpected owner change is a miss. Cache hits are historical research reuse, not newly executed tests.

Qualified recipe source, policy and runner changes participate in the existing governing identity rules. Generated task briefs, journals, scheduling events and metric observations are derived run evidence; exclude them from product identity to avoid self-invalidating every write. Hash them and bind them to their real input identity. A substantive ruling discovered in a brief must first update the authorized canonical contract; it cannot become a hidden requirement stored only in an excluded artifact.

Do not publish governing policy during frozen Clean A/B. Accumulate proposals, and when a material change is needed leave candidacy, qualify/publish, update identity and restart the affected convergence evidence. Benign usage logs do not require a new policy epoch.

## 8. Five-slot scheduling without a waiting agent

This section defines a portable contract. Qualify actual lifecycle, queue and isolation capabilities on the target environment; do not assume a particular product API or that suspension frees a slot.

### Capacity and leases

- `maxActiveAgents = 5` across the actual shared concurrency scope. The primary agent counts whenever the platform counts it as active. Nested agents count too.
- Maintain one atomic capacity reservation authority, using the existing coordinator/journal or supported harness admission control. Every launch requires a capacity reservation. Multiple tasks cannot each assume they own five slots.
- `observedActive + reservedNotYetActive <= 5`. An unknown termination state keeps its reservation occupied until actual release is established. Count unmanaged active sessions if they share the limit; when they cannot be enumerated/reserved safely, do not claim a global guarantee or launch speculative extra workers.
- Workers may not spawn unbudgeted children. Only the shared admission mechanism may admit a child, preserving the global limit.
- A queue record consumes no model slot. A watcher or polling agent does.
- Agents return an immutable result and finish their assignment. A result message alone is not proof of termination/slot release. Use supported completion/stop semantics and verify release.
- On crash/timeout, revoke or expire **authority to act**, then confirm actual lifecycle state before reassigning capacity or a write lease. Lease expiry alone cannot stop a still-running process or release its slot.

### Dispatch only ready work

Use assignment states `QUEUED`, `READY`, `RESERVED`, `RUNNING`, `RESULT_RECEIVED`, `RELEASE_PENDING`, `FINISHED`, `BLOCKED`, `CANCELLED`, with transition timestamps and dependency IDs. These are scheduling metadata, not QA verdicts.

Dispatch requires sealed inputs, resolved dependencies, available capacity and an explicit read/write boundary. If a worker needs additional context, persist a checkpoint/result, end or genuinely suspend the work through verified lifecycle capability, and keep the dependency in the queue. A changed context bundle creates a new linked assignment; never mutate an old request tuple in place.

No dedicated coordinator model sits idle waiting for all children. The existing primary agent may do useful work on the critical path while reviewers work: prepare lawful upcoming slices, analyze independent evidence, validate tool readiness or reconcile already sealed work. It must not modify the frozen candidate or expose earlier findings to blind peers.

If no useful independent work remains, checkpoint and yield/finish using a supported continuation mechanism. A scheduler/CI callback can resume the primary without an LLM watcher **only if that capability is actually available and qualified**. Otherwise retain the honest primary-plus-workers limit and report residual idle time; prompt wording cannot guarantee zero occupied waiting slots.

### Example wave, with an active primary

| Slot | Early construction wave | Independent review wave on an immutable candidate |
|---|---|---|
| 1 | Primary integrates task card, resolves scope, owns implementation | Primary works on ready independent obligations or a qualified checkpoint/yield |
| 2 | Bounded owner/consumer investigation if needed | Eligible reviewer for the current temporal phase |
| 3 | Tool/environment readiness probe if useful | Read-only evidence producer with independent inputs |
| 4 | Required contract challenge or high-uncertainty plan review | Compatible independent assignment, or left unused |
| 5 | Ready independent work, or left unused | Compatible independent assignment, or left unused |

This is a capacity example, not a demand for five running agents. Prefer fewer agents when tasks share state, setup is expensive, test runners contend for CPU/memory, or the critical path is sequential.

P5 phases that consume the preceding phase's repaired state remain sequential. Clean B uses fresh uncontaminated contexts distinct from A; one context can cover compatible responsibilities within a phase, but cannot be relabeled to satisfy an independent obligation. Required contract, closure, learning and terminal verification independence also remains intact.

Blind reviewer bundles contain neutral current requirements, source, permitted tests and governing invariant/attack policy. Do not add the implementer's construction brief, decision rationale, current findings or example answers to the blind bundle. Existing source/tests naturally carry information; attest actual exposure and retain held-out challenges. Mechanical access isolation is stronger than merely asking the reviewer not to read the plan.

Prioritize a ready job that unblocks the most dependent work, closes a material uncertainty or resolves an active failure. Record wait age and prevent starvation; a stream of cheap tasks cannot postpone required review indefinitely. Enforce one writer per overlapping responsibility and separate mutable test state, ports, saves and mutation workspaces.

## 9. Other efficiency improvements and their boundaries

| Improvement | Use it when | Boundary preserving confidence |
|---|---|---|
| Reuse the G0/G1 audit for planning and review context | Current evidence already answers the question | Revalidate only changed premises; independent reviewer still derives its own conclusions from neutral evidence. |
| Existing primitive/recipe before new abstraction | A verified owner fulfills the full contract | Do not force a mismatching abstraction or copy stale code. |
| Early expensive-assumption proof | A wrong seam would invalidate a large migration | A seam test does not replace actual final application/runtime proof. |
| Cheap decisive checks before broad expensive runs | Wrong types, missing context, deterministic invariant can fail fast | Required gate order and final full verification remain; do not rename a partial run as final QA. |
| Reuse immutable environment setup | Same verified toolchain and isolation requirements | Fresh task state, browser/server identity and seeds as required; no dirty shared saves or cross-worktree server reuse. |
| Dependency-aware evidence reuse in repair loops | Complete unchanged dependency identity and protocol permission | Invalidate transitively; current final full verification and clean-round obligations cannot be cached away. |
| Batch coherent root-cause repairs | Same invariant/owner and bounded affected consumers | No unrelated repairs hidden in a large batch; resulting state still reverified and reviewed. |
| Combine compatible read-only lenses | One fresh reviewer can fully cover both without conflicts | Do not combine separate temporal phases or independent A/B into one context; coverage remains explicit. |
| Qualified templates / scaffolds | Stable repeated construction with known variability | Generated code is untrusted implementation; explicit parameters, failure paths and meaningful tests remain. |
| Deduplicate incident and report bookkeeping | Same causal record is reported by several detectors | Preserve distinct symptoms/consumers and evidence; never collapse sibling defects solely by similar wording. |
| Refresh PR dependency graph before dispatch | Cloud has stacked/unmerged work | No integration approval from separately green PRs; conflict resolution makes a new candidate. |

Avoid the false economy of skipping the first seam proof, launching all five agents against the same mutable files, or making every failure trigger a whole new global rule. Fix the responsible mechanism at the narrowest sound level; escalate recurrence using the existing learning contract.

Budget exhaustion stops with an incomplete outcome and checkpoint. It never lowers coverage or synthesizes a pass. Track cost to improve scheduling and guidance, not to redefine correctness after results are known.

## 10. Minimal data contracts and migration

Extend the existing canonical ledger/schema; do not create a competing lesson database or a second task state machine. The tables below are required logical fields. Map names onto existing fields when semantics already match. Add an explicit new schema revision with validation and migration tests; never silently loosen `additionalProperties` or infer evidence during migration.

### Guidance facet attached to a versioned lesson

| Field | Contract |
|---|---|
| `lessonRef`, `guidanceRevision`, `kind` | Exact lesson ID@version; monotone facet revision; one knowledge kind from section 4. |
| `authorityRefs`, `sourceDependencies` | Nonempty authority/provenance for qualified constraints/recipes; path/symbol/content or contract hash; current dependency graph evidence. |
| `applicability`, `exclusions` | Semantic triggers and negative cases; not filenames alone. |
| `ownerRoute`, `preconditions`, `steps`, `failureAndInverse` | Positive route, ordered actions and meaningful obligations; explicit N/A reasons where a field does not apply. |
| `firstProof`, `detectorRefs` | Decisive oracle/entry/fixture, `BEFORE_WRITE` or `BEFORE_PROPAGATION` stage, admitted slice, and existing regression/attack references; distinguish planned from executed. |
| `originAnalysis` | Origin category, incident or successful-pattern evidence, and uncertainty. |
| `status` | `CANDIDATE`, `QUALIFIED`, `STALE`, `REJECTED`, `SUPERSEDED`, `ROLLED_BACK`; detection facet status remains distinct. |
| `qualificationEvidence`, `qualifiedBy` | References for authority, negative/positive controls, transfer challenge, independent reviewer and candidate-overlay trial. No self-approval. |
| `adoptionEvidence` | Separate post-publication ordinary-task routing/use references, initially empty; required for rollout qualification, not a prerequisite of initial facet qualification. |
| `causalPrevention` | `NOT_ESTABLISHED`, `EARLY_CORRECTION_OBSERVED`, or `COMPARATIVE_EVIDENCE`; exact supporting evidence required for stronger claims. |
| `policyRef`, `supersedes`, `limits` | Active publication identity, prior facet reference or null, and known applicability/capability bounds. |

### Construction brief record

Required fields: task/run ID; brief revision; planning baseline; governing policy hash; requirement/invariant/owner references; PR/dependency identities; source-dependency hashes; expected change set; applied/rejected/stale lesson routing; ordered slices; first-proof obligations; unresolved assumptions; current readiness; preflight evidence; independent contract-review references when required; reasoned deviations; consumed-by worker/request IDs; checkpoint history; final conformance references.

Each brief revision is immutable. A new revision records what changed and which prior assumptions/evidence it invalidates. `IMPLEMENTATION_READY` cannot have unresolved material assumptions affecting the authorized next slice, stale required guidance with no current resolution, or missing required preflight evidence.

`preflight` validates structure, source/policy/dependency identity, references and required evidence. Agents/reviewers establish semantic owner/contract truth; a script cannot honestly infer architectural correctness from field presence.

### Scheduling and consumption events

Required scheduling fields: global capacity scope; assignment/request and parent IDs; input state/bundle hash; dependencies; required capabilities; write surface; readiness; reservation/fencing token; observed runtime/context ID; lifecycle timestamps; release evidence; result reference; timeout/recovery state.

Extend the existing message protocol without changing its immutable request tuple, distinct message IDs, terminal-result idempotency or stale-result rejection. Queue delivery is not exactly-once execution: state-bound reconciliation and fenced write authority handle retries. Crash recovery must not double-spawn, double-write or accept a late old worker result.

Consumption events identify lesson/brief/policy revision, task state, action taken, observed early correction or proof, verification result and later escape links. These are evidence, never edits to the governing recipe.

### Legacy migration and identity

Preserve every historical lesson/evidence ID. Existing promoted detection lessons keep their original status and evidence; initialize guidance as absent/unqualified with `causalPrevention = NOT_ESTABLISHED`. Do not invent positive steps, reviewers, routing consumption or prevented defects.

Replay old ledger decisions unchanged with the old schema/semantics; do not retroactively claim old tasks met new readiness obligations. New runs use the upgraded schema and record governing revision. Resume old active runs through an explicit checkpoint/migration decision: preserve valid evidence, evaluate new preflight obligations before further affected production work, and invalidate exactly as required by policy/state changes.

Governing policy payloads contain qualified definitions and detector references, excluding their own computed policy hash, journal/run usage and generated brief outputs. Keep the current no-self-hash publication scheme. Publish detection/guidance facet status coherently; readers must never see a half-written policy/index pair. Archive and rollback pointers preserve history and still-valid baseline detection protections.

## 11. Repository integration and operating instruction

Prefer these logical homes, adapting to verified current layout:

- Existing canonical learning protocol: add origin analysis, guidance facets, qualification and next-task use.
- Existing primary-agent instructions: add construction-brief generation and current-source preflight; reference the canonical text.
- Existing architecture-worker task card/G0/G1: add the brief fields by reference, not another questionnaire or approval report.
- Existing runner/schema: add readiness, routing, freshness, consumption and capacity validation.
- Existing tests/qualification corpus: add section 12 scenarios and comparative construction tasks.
- Existing learning policy store: publish qualified facets with existing IDs; keep usage history separate.

Suggested command contracts, only if equivalents do not already exist:

| Operation | Inputs -> result |
|---|---|
| `qa:internal prepare` | Task/run, current policy, scope/census -> routing record and construction brief draft; unresolved facts explicit. |
| `qa:internal preflight` | Exact brief and current source/dependency identity -> readiness plus unmet prerequisites; no production edit on a failed required readiness check. |
| `qa:internal checkpoint` | Current state, brief and observed scope/contract deltas -> valid next slice or affected replan requirements. |
| `qa:internal learn` | Incident/pattern and candidate facets -> qualified publication or explicit pending/rejected state under existing promotion authority. |
| `qa:internal schedule` | Ready dependency graph and global capacity observations -> bounded admission decisions or blocked queue; no required model watcher. |

Implement a small runner extension using existing dependencies. If the harness already owns capacity/lifecycle, use its supported authority instead of duplicating it in a custom daemon. Do not add a database, model provider, background polling LLM or vector service for these contracts.

Instruction to install in the primary agent entrypoint:

```text
Before a nontrivial production slice, load current project law and the unified
QA policy. Reuse G0/G1 research to derive the real owner/caller/consumer chain.
Retrieve applicable qualified guidance and build the task's construction brief:
what to use, why, where, first decisive proof, and applicability limits.

Do not implement while a material owner, product contract, required context or
dependency premise for that slice remains unresolved. Use bounded discovery to
resolve it; ask the user only for decisions outside existing authorization.
Complete existing pre-implementation contract review. Apply conditional recipes
only where current source supports them, and record justified alternatives.

Prove the highest-cost uncertain production seam before broad propagation.
Implement coherent runnable slices. At meaningful boundary changes or resume,
revalidate affected brief premises and required protections. Tests and probes
must observe actual authoritative outcomes, not only helper calls or fixtures.

Keep all current QA obligations and independence. Guidance is an input to work,
never approval evidence. Blind reviewers receive neutral laws/source/attack
policy, not the implementer's plan, rationale or current finding history.

After an incident, explain both why construction went wrong and why detection
missed it. Improve the responsible routing, recipe, primitive or guard within
scope. Independently qualify learning; publish only validated facets. Record
actual use and early corrections; never invent saved time or prevented defects.

Use a globally bounded ready-work queue: at most five active agents including
this primary and all children. No standing watcher. Return/checkpoint completed
assignments and verify actual slot release before reuse. Preserve sequential
reviews, fresh independent contexts and one writer per overlapping surface.

Only the existing complete final QA predicate can certify the resulting
candidate. Readiness, guidance use, a clean early proof or exhausted budget
cannot certify completion or authorize commit, push, merge or deployment.
```

A prompt is advisory unless the actual work path consumes it. Wire `prepare/preflight` into the supported task-start/write-dispatch path and final conformance into the ledger decision. Demonstrate that a failing required preflight cannot silently dispatch an authorized production writer through the adopted path. If the platform cannot enforce direct-edit interception, state that limitation: enforce admission/evidence in the available workflow, reject unverifiable completion, and do not advertise universal write prevention.

## 12. Qualification and useful measurements

Keep existing QA-system qualification and golden-bug obligations. Add the following independently inspectable cases; implement deterministic tests for mechanical guarantees and agent/task trials for reasoning/use claims.

| ID | Scenario | Required observable |
|---|---|---|
| PU-01 | Familiar domain with a valid promoted recipe | Fresh ordinary task without candidate override identifies current owner/API and actionable first proof before production writing; records actual use as post-publication adoption evidence. |
| PU-02 | No matching lesson / novel feature | Derives invariants and bounded discovery; no fabricated recipe or exemption from QA. |
| PU-03 | Owner/API renamed; consumer unchanged | Semantic routing still finds the class; stale path is rejected or revalidated using current evidence. |
| PU-04 | Legal near-neighbor excluded from a recipe | Guidance permits the valid alternative and retains actual bug detection. |
| PU-05 | Conflicting old lesson and current authorized rule | Current authority wins with recorded resolution; no silent downgrade or stale recipe enforcement. |
| PU-06 | Index unavailable or mandatory lesson outside prompt-size budget | Complete fallback or unresolved readiness; no silent top-k omission. |
| PU-07 | Wrong-owner proposed plan | Preflight's required semantic evidence rejects it before broad implementation; field presence alone fails. |
| PU-08 | Handcrafted fixture masks a production caller omission | First seam proof uses actual construction/caller and exposes the omission. |
| PU-09 | Guard catches wrong plan but rejects a legal route | Promotion blocked until applicability/oracle corrected; original failing case remains caught. |
| PU-10 | Successful prior change without causal comparison | Stored as validated route/use evidence, not a proved prevented defect or new product law. |
| PU-11 | Detection-qualified legacy lesson, no construction evidence | Detector remains active; guidance unqualified; old IDs/evidence preserved. |
| PU-12 | Ordinary expected edit vs unexpected owner/contract change | Normal slice progresses; changed premise invalidates affected brief and coverage before dependent work. |
| PU-13 | Compaction/resume with changed policy or dependent PR head | Reload actual brief/policy/state, reject stale assumptions and evidence. |
| PU-14 | Five active agents, a sixth request including nested dispatch | Global atomic admission queues the sixth without creating it; concurrent reservation attempts cannot over-admit. |
| PU-15 | Result arrives but worker remains active | Slot remains occupied until verified lifecycle release. |
| PU-16 | Timeout/expired lease but old worker still executing | No capacity reuse based on expiry alone; fenced writes and late-result rejection hold. |
| PU-17 | NEED_CONTEXT, new input bundle, duplicate messages | Checkpoint/release verified; new linked request for new bundle; no duplicate approval, write or spawn. |
| PU-18 | Other tasks/unmanaged sessions share the five-slot limit | Account for actual occupancy or avoid speculative launch; do not claim global enforcement without control. |
| PU-19 | Sequential pass or Clean B proposed in a contaminated context | Ineligible context rejected; useful self-review cannot count as independent coverage. |
| PU-20 | Coordinator has no useful work and suspend does not release a slot | No invented release; use supported continuation or honestly retain occupancy and queue. |
| PU-21 | Two independent PRs change a shared semantic owner | Recompute aggregate plan/census and integration evidence; separately green PRs insufficient. |
| PU-22 | Guidance/policy publication attempted during frozen clean rounds | Exit candidacy and rebind as required; usage-log append alone does not reset product identity. |
| PU-23 | Root-cause fix or guide changes required tests | Correct affected invalidation, re-verification and fresh review; no cache-based final pass. |
| PU-24 | Prepare/preflight omitted, required proof missing, or completion forged | Supported dispatch/ledger enforcement rejects the transition; limitations of direct-edit enforcement are reported. |
| PU-25 | Mutation of a former detector or excluded required surface | Preservation check fails; apparent speedup cannot authorize cutover. |
| PU-26 | Metrics show faster tasks but more escaped or postponed failures | No quality-preserving efficiency claim; include failures, stopped tasks and delayed review in analysis. |
| PU-27 | Guidance and journal hashes refer recursively to generated briefs | Reject cyclic identity design; benign usage logging leaves governing identity stable. |
| PU-28 | Crash during policy publication or schema upgrade | Recover one complete valid version, retain history/detectors, reject torn publication and unqualified facets. |
| PU-29 | Candidate recipe leaks the held-out answer to an evaluator/reviewer | Disqualify that trial/independence claim; preserve useful findings without counting them as blind evidence. |
| PU-30 | Missing lifecycle or fresh-context capability | Useful work continues within verified capability; required missing evidence remains incomplete, never externally routed or invented. |
| PU-31 | New guidance is ready for qualification but not published | Isolated candidate-overlay trial exercises real routing/action path without altering active policy; can qualify independently of later ordinary-task use; cannot authorize production or impersonate adoption evidence. |
| PU-32 | First meaningful feature proof needs the first implementation slice | Pre-write prerequisites admit only the bounded slice; planned propagation proof cannot block its own construction or be skipped before broad migration. |

### Construction-effectiveness evaluation

Detection replay alone does not answer this upgrade's question. Evaluate tasks starting from requirements and a pre-implementation checkout, including held-out sibling variants of restore, inverse ownership, real caller context, event cardinality, partial delivery and PR interaction. Recover real historical tasks where possible; label representative reconstructions as such.

Compare baseline guidance with upgraded guidance using matched task specifications, starting states, tool access, model settings and **identical final QA obligations**. Use fresh contexts; keep holdouts out of recipes, demonstrations and reviewer answers. Record known exposure and carryover; do not claim a randomized causal experiment if it was only a sequential pilot.

Report all attempted tasks, including blocked/timeouts/failures. Separate feature complexity and risk groups; do not compare easy guided edits with hard baseline migrations. Post-change review and later escape observation use the same protocol and a declared follow-up window; absence of later exposure is unknown, not zero defects.

Metrics:

- **First-pass acceptance:** initial formal QA candidates that satisfy the unchanged required completion predicate without a subsequent implementation/contract/oracle repair, divided by eligible initial candidates reaching formal QA. Pin that first candidate at the same predeclared boundary in both groups; discovery and intentional red-before-fix tests are separate. Report excluded/not-reached tasks and pre-submission rework separately so abandonment or relabeling repair as preparation cannot inflate the result.
- **Early corrections:** proven defective plan/construction choices corrected before propagation, with recorded pre-correction evidence; distinguish them from suggestions and ordinary planning.
- **Rework:** active agent time and changed responsibility units after a confirmed implementation defect; separate initial implementation, useful QA and tool/environment recovery.
- **End-to-end elapsed time:** task intake to valid final outcome, including queue/wait/setup/review; report incomplete tasks rather than dropping them.
- **Total active agent minutes:** sum actual counted-active intervals for every participating agent; parallelism does not make this cost disappear. Also report occupied-but-idle time where observable.
- **Escapes and detection preservation:** misses, severity, root class, known exposure, later reopened outcomes, old golden-family coverage and false positives.
- **Guidance quality:** applicability precision/recall on labeled scenarios, stale-guidance rejection, actual use, justified deviations, prompt/context cost and recipe-specific benefit or harm.

Show counts and distributions, not only averages or a single blended score. Set the pilot sample, stopping rules and success criteria before examining outcomes. Small samples support only bounded pilot conclusions. Do not promise a percentage time saving before measurement.

Installation can reach `PREVENTION_UPGRADE_QUALIFIED` only after all applicable mechanical, semantic-routing, independence, migration, preservation and required constructive-guidance qualification cases produce their expected accepted/rejected transitions with valid evidence, post-publication ordinary-task use is demonstrated, and no required qualification gap or lost baseline protection remains. A partial rollout must name unqualified capabilities and keep their claims/admission disabled; it cannot use this unqualified whole-upgrade label. This label is not proof of an average productivity gain. Report `EFFICIENCY_NOT_YET_ESTABLISHED` until a suitable comparative sample exists. Game completion still requires its actual QA terminal predicate.

## 13. Incremental Devin implementation plan

Use current project worktree/isolation and approval rules. Do not perform unrelated gameplay repair while upgrading QA.

### Milestone 1 — Audit the deployed workflow once

Read actual AGENTS/architecture workflow, protocol, lesson/schema stores, runner, entrypoints and current cloud PR state. Identify how tasks start, how writers are admitted, how isolated reviewers run, what counts as an active slot and how completion releases it. Probe lifecycle harmlessly within known capacity; do not start five agents merely to discover the cap.

Deliver one disposition map: existing mechanism -> retained owner -> precise extension -> proof required. Reuse this research for the plan and subsequent implementation. Record unsupported capabilities honestly. Preserve existing detector baselines and historical records.

Acceptance: current authority and capability map, scoped change list, safe migration/rollback approach and no unresolved material premise for the first slice.

### Milestone 2 — Add guidance and construction brief

Extend canonical lesson/schema/instructions and the existing G0/G1 artifact. Implement applicability/freshness checks and `prepare/preflight/checkpoint` equivalents. Seed a small set of high-value guidance candidates from already evidenced incidents; qualify them individually. Start with retrieval and plain structured files; add no unnecessary service.

Wire the supported task-start/dispatch path. Demonstrate a correct brief, a wrong-owner plan rejection and a stale-rule rejection. Required preflight failures must block the affected production dispatch/completion through that path. Report any broader enforcement limits.

Acceptance: PU-01..13, PU-24, PU-31..32, relevant identity/migration cases and current baseline guards pass for the implemented surface. Candidate-overlay trials and post-publication ordinary-task use are distinct. No production task is certified by an unqualified replacement gate.

### Milestone 3 — Qualify the five-slot queue

Use the existing scheduler when possible; otherwise add the smallest supported atomic admission/journal extension. Implement global capacity accounting, readiness/dependency dispatch, lifecycle-confirmed release, recovery and fencing. Keep temporal review and blindness contracts intact. No permanent monitoring agent.

First test races/retries/crashes deterministically with fake lifecycle events. Then verify supported real lifecycle/continuation/context capabilities with a minimal bounded live probe. Fake scheduling tests alone cannot prove the cloud actually releases a slot or provides fresh context.

Acceptance: PU-14..20 and PU-30 with explicit supported/unsupported capabilities. Never claim a guaranteed zero-idle coordinator when lifecycle prevents it. Missing independent-review capability retains the existing incomplete result.

### Milestone 4 — Close the learning feedback path

Record construction-origin and detector-escape analysis separately. Qualify and publish guidance/detection facets without self-approval or torn policy state. Demonstrate a new task consumes the qualified route, a legal alternative remains allowed, a false positive cannot become law, and a recurrence fixes the responsible routing/guard instead of accumulating reminders.

Acceptance: original-bug and valid-control protections retained; held-out transfer and next-task use observed; no fabricated prevention statistics; publication/migration/recovery cases pass.

### Milestone 5 — Preserve QA and evaluate benefit

Run the installed protocol's required checks on the aggregate infrastructure change, including applicable deterministic/build/full verification, OCR, runtime changes, adversarial and sequential independent review. Include all section 12 cases that apply; unsupported material capability is a qualification gap, not N/A for convenience. Replay old QA qualification/golden obligations according to the current contract.

Perform the predeclared comparative construction pilot or explicitly report that productivity remains unmeasured. Roll out qualified facets incrementally; retain valid baseline detection throughout. Reload task entrypoints and prove a fresh task actually follows the new intake and consumes the current policy.

Acceptance: evidence-backed installation status separate from performance and game QA status. Do not claim success from document creation or a green script alone.

## 14. Devin handoff report

Return one concise report backed by the existing ledger:

1. Exact branch/worktree/candidate, installed baseline and governing upgrade revision.
2. Changed files and responsibility; retained capability mapping; no lost detector or weakened terminal condition.
3. One real construction brief, wrong-plan/stale-guidance rejection, first seam proof and next-task consumption evidence.
4. Qualified guidance/detection facets; provenance, legal controls, independent challenge, pending facets and rollback behavior.
5. Capacity/lifecycle evidence including primary/nested/shared-task accounting, release verification, crash recovery and actual independence.
6. Required verification and PU case results, with `EXECUTED`, `SOURCE`, `INFERRED`, `PLANNED` and `UNVERIFIED` distinguished.
7. Comparative metrics if measured, including failures and limits; otherwise `EFFICIENCY_NOT_YET_ESTABLISHED`.
8. Installation qualification, outstanding gaps and explicit final outcome. No implied commit, integration or deployment authorization.

The intended improvement is fewer wrong construction decisions and earlier correction of expensive assumptions, while retaining the current QA system as an independent check of the resulting implementation. The mechanism and its efficiency must be demonstrated on the actual cloud environment.

## Handoff design validation — not installed-capability evidence

This appendix records preparation of this handoff on 2026-09-24. It is not a qualification result for the deployed workflow.

- Scope: one new Markdown handoff, using the prior design's protocol, learning and agent instructions plus the current local architecture-worker rules. The existing cloud implementation, current remote PR heads and platform lifecycle APIs were not inspected in this upgrade-design session; Milestone 1 requires that verification.
- Review 1: a separate reviewer context read the entire draft and relevant baseline contracts. It found one Medium circular dependency between qualification and next-task use. The draft required ordinary consumption before a recipe could become eligible for ordinary consumption.
- Correction: an explicitly isolated pre-publication candidate trial now qualifies the facet; fresh ordinary-task consumption after publication proves adoption. Source/schema guidance and PU-01/PU-31 distinguish the two. Readiness also distinguishes pre-write prerequisites from a first-slice proof required before propagation.
- Review 2: the same reviewer inspected the resulting changed sections and dependencies, reporting no unresolved actionable finding there. This was a sequential resulting-state design review, not two fresh blind Clean A/B reviews and not production approval.
- Reviewed protocol-body SHA-256 before this appendix: `3ab246cb05304ccd2e199debd6e0041416f8f99caad1bb4b34ff02e1740e17f4`.
- Executed document checks: ordered sections 1–14; unique consecutive PU-01..PU-32 definitions; balanced code fences; consistent table columns; no replacement characters, unresolved placeholder markers or local-machine path dependency; explicit trial/adoption and proof-stage separation. These mechanical checks do not prove semantic correctness.
- Not executed: implementation tests, PU scenarios, golden-bug replay, actual fresh-task routing, real capacity/lifecycle tests, game tests/browser checks or comparative efficiency trials. All such obligations in this pack remain planned for Devin.
- Isolation: Markdown-only addition under the project documentation exception; no production, active agent rules, existing QA pack, dependency or unrelated working-tree edits. No commit, push, merge or deployment performed.
