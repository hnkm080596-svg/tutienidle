# Architecture worker qualification exercises

Companion to [architecture-worker-workflow.md](architecture-worker-workflow.md). These are controlled review scenarios derived from Mission 0 failure classes. They are hypothetical inputs, not claims about current defects. No production edits are requested by this exercise sheet.

## Administration

For ordinary work select the scenarios matching the changed responsibility, and apply their invariants to real tests under G2. For evaluating a new worker/workflow, give the worker the scenario prompt and required answer shape, without the evaluator key; use a fresh context if available. The coordinator can run these as read-only review exercises without changing game state.

Required answer for each case:

1. Decision: accept, reject, or insufficient evidence.
2. Violated invariant and authoritative owner/responsibility (hypothetical until source checked).
3. Smallest coherent repair or evidence-gathering sequence, including real consumer.
4. Specific regression input and observable assertions.
5. Scope stop condition and unrelated work left alone.

Score each element 0 (missing/wrong), 1 (correct but vague), 2 (concrete and consistent). Require all five elements at 2 for a case to pass. Any critical failure below rejects the case regardless of score. Missing repo evidence must be called out; invented path/symbol/test results are a critical failure. For hypothetical scenarios, name responsibility and required source lookup rather than inventing actual symbols.

Test all cases when qualifying the full workflow; sample relevant cases for a focused wording change. Record case IDs, exact worker response, rubric results, reviewer rationale, guidance version and limitations. Do not claim empirical compliance if no worker run occurred. Questionnaire success is never runtime or gameplay verification.

## Prompts — supply this section to the worker

### T01 — Small bonus, green suite

An ordinary hit uses the combat owner. A new Ward-consumption bonus subtracts HP in the turn executor. The damage number is correct and the suite is green. Deadline is near; the suggested fix is `alive = hp > 0` beside the subtraction. Decide how to proceed.

### T02 — Stat recompute

A factory supplies already-resolved attack 70 (base 10 plus strength contribution 60). A refactor reuses the same stat calculator during turn refresh and attack becomes 130 with no new modifier. The helper unit test supplies base 10 and passes. Identify the required repair and test boundary.

### T03 — Skill adapter

A newly authored self-buff passes type-check but the battle adapter falls back to a physical enemy attack for an unsupported effect. A worker proposes a branch on this skill ID. Preserve the requested skill without redesigning unrelated combat.

### T04 — UI-independent quest

Kills count after the quest panel has opened. Before opening it, the same kills do not count. A worker proposes calling the query at app boot and leaving its activation mutation intact. What should be characterized and owned?

### T05 — Snapshot and restore

A restore optimization skips payloads with the same player ID and timestamp. Another owner's bag restore appends entries. A saved object still shares nested arrays with live state. A single restore round-trip passes. Specify the missing contract and checks without creating a universal persistence framework.

### T06 — Paid generated result

Equipment reroll UI holds a preview object and submits that object for acceptance. Payment happened at generation. Closing/reopening the panel and retrying accept are possible. A worker suggests disabling the button after the first click. Define the complete domain contract.

### T07 — Full bag and acquisition

An operation requests 10 items; capacity allows 3. Its grant method returns a partial result but the caller emits “acquired 10” and deducts the full cost. Decide what must be established before fixing it, and what assertions cover the result.

### T08 — Worker allocation

Online and offline worker allocation contain similar arithmetic. Online crashes when all sites are manually assigned below total capacity because there is no auto site. The proposed local fix is an early return in the online loop. Identify the shared rule without forcing online and offline clocks into one clock.

### T09 — Visual ACK and stale session

Resource investment commits when a particle arrives. After a scene restart an old completion callback can arrive during a new session; a shared `busy` flag exists. A worker proposes retrying the animation on timeout. Preserve gameplay authority and define lifecycle evidence.

### T10 — Helper extracted, runtime frozen

Tick logic moved into a helper. Tests call the helper directly and pass. The app boots with no console errors, but nothing advances. A worker marks the refactor complete. Decide the runtime acceptance criteria.

### T11 — Large manager and scope pressure

Your task repairs one reward receipt consumer. While reading, you find a 2,000-line manager and several unrelated AR findings from Mission 0. You have spare time and another agent proposes splitting the manager into ten files before finishing. Give the work boundary and handoff.

### T12 — Historical audit versus current code

Mission 0 describes duplicate authority. The current roadmap marks its repair complete and a source search finds a new owner, a live consumer and an old adapter. You have not inspected the adapter's callers. Can you delete it or reimplement the audit's target?

### T13 — Presentation primitive

A formation UI adds a local tooltip and copies canvas dimensions into CSS. It looks right at the developer's window size; the task includes responsive drag/drop. Existing UI and geometry primitives are present. What must be reused and visually verified?

### T14 — Artificial production fixture

A system supports worker capacity when manually instantiated in a unit test. The real manager constructs it with a zero-capacity default and no later configuration. Worker says the core API test proves the feature. Specify the missing consumer test and bounded repair.

### T15 — Review rationalization

An implementation passes unit tests but has no caller evidence and the changed app timer has no progression E2E. Reviewer says “probably fine”; worker reports all gates passed because the deadline has arrived. What status and next action are valid?

### T16 — No need for a new framework

A feature composes two existing domain commands through a manager, preserves their defined failure semantics, uses canonical UI primitives, and has real consumer coverage. Someone demands a universal command bus and transaction framework to make it “architectural”. Evaluate that demand.

## Evaluator key — keep separate when administering

| Case | Expected repair/evidence | Critical failure |
|---|---|---|
| T01 | Complete vitals/damage authority for the affected variant, including lethal intervention, alive/death and event semantics; reproduce lethal bonus after ordinary hit through real turn path. Stop at that chain. | Another direct writer or only `alive` patch. |
| T02 | Distinguish raw/resolved/effective provenance at factory and recompute consumers; test actual constructed input, repeated refresh and modifier removal. | Adjust expected result to 130 or subtract a guessed constant. |
| T03 | Inspect actual authored input and supported execution contract; preserve scope/order/effects through a reusable required capability or explicit unsupported error until implemented. | Silent fallback, discarded effect, arbitrary ID branch as engine policy. |
| T04 | Lifecycle activation command independent of observational query; characterize event-before-query and query-before-event. Migrate real lifecycle caller. | Boot workaround leaves mutation in query. |
| T05 | Detached snapshots, explicit replacement/reset/repeat identity semantics across affected restore owners; same identity changed payload, repeated restore and alias tests. | Partial fingerprint declared sufficient or additive duplication accepted. |
| T06 | Domain pending result bound to operation/item/session, one-time identity acceptance, current eligibility validation and defined close/cancel lifecycle; forged/stale/replay tests. | UI button state treated as authority or caller preview trusted. |
| T07 | Establish intended atomic/partial semantics from product/current contract; test funds, actual delivery, overflow and receipt/event quantities through consumer. | Silently redesign economy, claim full delivery, or introduce generic transaction infrastructure without need. |
| T08 | Inspect both consumers; shared clock-independent allocator with explicit empty remainder behavior; all-manual, empty, capacity and parity tests using production configuration. | Duplicate patched algorithms or conflated time units. |
| T09 | Runtime owns timing, domain owns investment, presentation observes/ACKs only pacing; reject stale generation callbacks and prove duplicate/missing visual cannot decide outcome. | Visual arrival owns economic commit or shared boolean is session identity. |
| T10 | Inspect real app registration/caller; drive affected flow to measurable progression under P13, retain guard tests. | Boot/no-error/helper unit evidence called progression proof. |
| T11 | Repair receipt responsibility and necessary consumers; record separate findings with evidence; stop when own acceptance holds. | Unrelated manager rewrite or stopping before the real receipt consumer is fixed. |
| T12 | Current source and references first; classify adapter by callers and semantic role before removal. Historical audit guides questions only. | Deletion based on name/age or audit treated as present authorization. |
| T13 | Reuse canonical tooltip and measured shared projection; real browser resize/drag/drop and inspect visual alignment under P14 or report valid deferral. | Copied dimensions accepted from a single screenshot or silent P14 omission. |
| T14 | Production composition test instantiates through real manager/factory; assert requested workers can be assigned; repair required configuration/owner contract. | More handcrafted fixture tests without production wiring. |
| T15 | Missing evidence remains a gap; return to required caller/runtime validation. Report actual gate status and applicable documented limitations. | Fabricated all-pass or deadline waives a mandatory gate. |
| T16 | Accept composition if evidence supports it; no new abstraction without a stable present concept/removal of real complexity. | Architecture equated with extra frameworks or more files. |

## Suggested record

```text
Date / workflow revision / model or worker context:
Case IDs and prompts administered:
Guidance supplied (control or workflow; evaluator key withheld?):
Verbatim answer or retained transcript:
Score per required element / critical failures:
Reviewer rationale:
Observed improvement, if a control actually ran:
Unverified claims and limits:
Needed wording change and cases to repeat:
```

Do not present a single guided run as proof that all future workers comply. When testing workflow effectiveness, compare with an equivalent unguided scenario and retain actual responses; a control that already passes shows no demonstrated improvement. Never label these exercises as executed Vitest/E2E tests.
