# Design validation and handoff evidence

Date: 2026-09-23. This validates the **proposal documents**, not a running QA implementation or the game.

## Changes made in this task

Created only the new Markdown bundle under `game/docs/qa/2026-09-23-unified-fixed-point/`, plus its assembled Markdown handoff. No existing production, QA infrastructure, instruction, dependency or test file was changed. Existing dirty files remained outside the task's write scope. No commit, push, merge, deployment or external message was performed.

P2 Markdown-only exception applies; workspace is `E:/tutienidle` on `master`. G0/G1 evidence and Q1-Q12 are in the audit document. Production G2-G4/P3/P4/P5/P13/P14/P18 execution is not applicable to this documentation-only task. Planned qualification commands are clearly distinguished from executed document checks.

## Sequential adversarial design reviews

An internal reviewer agent received the proposal files and a bounded read-only request, without the primary agent's conversation history. Later passes continued that reviewer context. These are sequential design reviews, **not** independent clean A/B rounds or executed production P5 evidence.

### Design Review 1

Reviewed state: initial 00–03 documents, then 04 learning as a separately identified extension. No edits by reviewer.

Findings:

- High: novel-attack model expansion could invalidate Clean A endlessly. Fixed by separating frozen attack envelopes from generated inputs and defining replacement-epoch challenge handling.
- High: fresh seeds for B conflicted with identical environment identity. Fixed by recording concrete seeds in execution evidence and hashing RNG/environment policy separately.
- Medium: mutually linked siblings could never individually close. Fixed by atomic closure groups with local conditions and closed outgoing dependencies.
- Medium: `actionable=false` could hide a proven real defect. Fixed by deriving actionability from evidence-backed classification/disposition; a human exception does not erase actionability.
- Medium: appending a learning incident could mutate frozen policy identity. Fixed by separating append-only history from immutable promoted policy/index.

Verification: primary agent checked each counterexample against the design, amended contracts/schema semantics and added corresponding qualification cases. No gameplay reproduction was relevant to these protocol contradictions.

### Design Review 2

Reviewed state after Review 1 fixes: YES. Reviewed updated 01/03/04 and new 05–08 adoption/handoff contracts.

All five prior findings were confirmed addressed. One new Medium: request-level payload deduplication rejected valid `ACK -> FINDING -> SEALED_RESULT` messages. Fixed by separate assignment identity, message identity and terminal-result identity. Context changes require linked new assignments; same-message payload conflicts and conflicting terminal results are rejected. QF-05 now also requires the valid multi-message sequence to pass.

Primary self-review additionally changed inline novel-attack definitions in reviews into references to one canonical attack registry, preventing duplicate editable authorities. Adoption now explicitly remains ADOPTING until capability qualification, while current internal gates remain enforced.

### Design Review 3

Reviewed state after Review 2 fixes: YES. Reviewer checked resulting contracts across message lifecycle, attack registry, novel-input/model boundaries, learning/policy identity and adoption.

Result: zero unresolved established Medium-or-higher findings in that reviewed design state. Reviewer explicitly did not claim a blind fresh-context pass or executed system qualification.

### Final identity clarification

Primary review added an explicit non-self-referential policy serialization rule: immutable payload excludes its own computed hash and journal metadata; filename/index/external records carry the resulting hash. This prevents an implementer placing lesson.policyVersion recursively inside the bytes it hashes. A fourth internal consistency review checked that resulting identity contract against snapshot/schema/promotion rules and found no concrete issue. No new code or game-test claim follows from that result.

## Executed document/schema checks

- Parsed the schema's JSON with Python standard library.
- Walked every `$ref` and every required object property: 25 definitions, no unresolved local schema reference or required property absent from its declared properties.
- Used the existing local Ajv 8.20.0 to validate the schema against Draft 2020-12 and compile with strict mode: passed. Date-time format execution was disabled because a format plugin was not installed; the adoption specification explicitly requires real timestamp validation. This is not a full runtime ledger validator.
- Validated a synthetic INTAKE record structurally; four deliberately invalid shapes were rejected: missing state, malformed hash, undeclared property, and invalid outcome value.
- Constructed one minimal structural fixture for each of 13 record collections: all accepted by the compiled schema. These fixtures are intentionally not semantic QA evidence or valid convergence records.
- Checked Markdown fence balance and local file-link targets, including a final pack/reference check after assembly.
- Inspected final Git status/diff boundary; all task writes are new Markdown deliverables. Existing `.gitignore` and untracked local C2C/P7 materials were not edited by this task.

The first Python environment and bundled Python lacked `jsonschema`; no package was installed. Schema metavalidation instead used the already available Ajv dependency. This affected neither repository dependencies nor production code.

## Adversarial questions applied to the resulting proposal

| Attempt to defeat the design | Resulting protection / honest limitation |
|---|---|
| All agents agree on a wrong requirement | Contract attack, neutral fresh derivation, independent oracle/legal controls and held-out bug cases; shared model blind spots remain possible |
| A reviewer reads only the diff | Aggregate census and coverage/access declaration; incomplete material blocks relevant acceptance |
| Tests assert the wrong object or encode the implementation | Test-quality operator, actual post-state owner assertions, original-bug/mutation kill proof |
| Restore bypasses gameplay gates | Bidirectional ownership, cross-field integrity, real restore into fresh owners, continuation and rejection atomicity |
| Last fix silently retains previous green evidence | State/hash dependency invalidation, new clean candidate and final full verification |
| Budget ends or browser/tool is unavailable | Explicit UNVERIFIED, no fixed-point success from timeout or missing capability |
| Two siblings block one another forever | Reviewed atomic closure group, with outgoing-dependency checks |
| Learning teaches an incorrect or overbroad rule | Original bug, nearest-neighbor valid control, sibling evidence and independent qualification before promotion |
| A rule learns to ignore failures | No automatic weakening/suppression/waiver; required preserved capability and human authority for relaxation |
| Adding a journal entry changes the product being certified | Evidence journal excluded, immutable promoted policy included; a real new finding still semantically resets convergence |
| Web chat is unavailable | No ChatGPT Web/C2C call in required execution path; native internal review and local tools own the workflow |
| A CLI validates schema and calls it truth | Explicit distinction between mechanical enforcement and agent evidence/reasoning; independent terminal attestation |
| Three review passes are mistaken for convergence | Full conjunctive clean A/novel/B/mutation/final verification predicate, no fixed maximum rounds |

## Remaining implementation/verification limits

1. Devin native reviewer isolation and sealed access must be measured on its actual harness. Context independence is not guaranteed model diversity; single-context self-review cannot be relabeled independent.
2. Golden-bug replay, holdout performance, actual property/fuzz campaigns and mutation detection have not run. Preservation arguments are qualification obligations, not numerical proof of increased recall.
3. No current game test/build/browser run was attempted; reported historical failures remain historical. This task neither certifies nor rejects current gameplay readiness.
4. Cloud branches may have advanced beyond the recorded snapshots. Devin must refresh and materialize the actual intended aggregate before adoption/testing.
5. Full repository review remains bounded by an explicit attack model and platform/capability access. No finite review proves universal bug absence.

## G5 documentation handoff

Delivered: current QA audit, defect taxonomy, invariant/finding/coverage schemas, internal roles/messages, verification/fixed-point/invalidation protocols, automatic learning, historical benchmark, preservation mapping, file layout, adoption plan and self-contained Devin instruction/pack.

Owner/consumer migration is proposed, not installed. Existing detectors remain authoritative until the adoption transition is performed; the user explicitly removed external QA from the target dependency model. Unresolved task work: no gameplay/QA implementation was authorized or performed in this design task. Remaining adoption work and its acceptance criteria are fully delegated to the Devin instruction rather than described as already completed.
