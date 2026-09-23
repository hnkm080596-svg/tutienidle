# Golden-bug benchmark and adversarial qualification

Intended installed path: `game/docs/qa/protocol/qualification.md`.
Status: CANONICAL — installed by the internal fixed-point QA protocol adoption. Sole QA authority: `README.md` in this directory.
Benchmark execution results live in `game/docs/qa/runs/<runId>/` and the adoption qualification report — this file holds the benchmark design and ruling rules.

## Historical seed corpus

Every case below is a replay candidate, not a current bug assertion. Recover an original broken revision using the cited history where possible; otherwise construct a faithful isolated representative mutation and label it. Do not invent an original commit SHA or historical severity. Store missing originals as null and PENDING_RECOVERY.

| Case | Historical evidence / original severity when known | Minimal counterexample and required invariant | Historical detector / proposed internal protection |
|---|---|---|---|
| GB-01 Nonempty equipment save | learned-defects QA-2026-09-01-001; severity to recover | Save actual current equipment instance then reload; current snapshot accepted and restored | Existing save-reload E2E caught validator's obsolete fixture shape / production nonempty round trip + fixture audit + field-shape mutant |
| GB-02 Import payload identity | QA-2026-09-01-002; severity to recover | Import -> intervening autosave/pagehide or marker-write failure -> reload; payload side channel cannot attach to wrong save | Save tests / identity/interruption state-machine + storage failure schedule |
| GB-03 Reward at full bag | QA-2026-09-01-006; severity to recover | Dissolve item while reward stack at capacity through manual and auto paths; preserve source unless complete accepted delivery | Production GameManager dissolve pin / source/sink conservation at cap-1/cap/cap+1 + partial-delivery mutations |
| GB-04 Paid preview replay | QA-2026-09-01-008; severity to recover | Commit without valid preview, alter payload, retry or replace source item | Preview/commit tests / generated identity/replay actions plus forged-result mutation |
| GB-05 Omitted animation token | QA-2026-09-08-RR5; severity to recover | Pending playback accepts omitted token; phase must not advance | CombatAnimationRuntime reaudit / omit/empty/stale/duplicate ACK across all phases |
| GB-06 Domain update missing | QA-2026-09-08-RR6; severity to recover | Real GameManager update, eligible player+essence, never mount panel; expected investment occurs | Real manager reaudit / paired headless actual update and App runtime progression |
| GB-07 Duplicate invocation | QA-2026-09-09-RR7; severity to recover | One update attempts same side effect twice while idempotent final value hides it | Invocation-cardinality regression / double-call mutant and event count |
| GB-08 Lost optional skill scaling | QA-2026-09-09-RR8; severity to recover | Real authored attribute/mana/intent scaling crosses converter into active combat executor | Live multiplier/converter tests / full authored-field census and downstream outcome mutation |
| GB-09 Conditional drop loses gate | QA-2026-09-12-009; severity to recover | Move conditional rare drop into ungated pool; mortal/ordinary enemy acquires forbidden item | Real drop gating QA / source-condition preservation plus actual production drop resolution |
| GB-10 Unreachable perfect clear | QA-2026-09-12-011; severity to recover | Best possible one-shot run on real floor shapes still exceeds authored action-count threshold | Production feasibility test / best-case reachability and action-vs-round unit challenge |
| GB-11 Duplicate companion payout | QA-2026-09-12-012; severity to recover | Persist duplicate combatant on two slots; per-kill reward must pay entity once | BattleLootSystem companion EXP / malformed assignment + entity cardinality invariant |
| GB-12 Production signature omits route | QA-2026-09-13-001; severity to recover | Actual App invocation excludes optional presentation dependency; domain settles but route remains tribulation | Production-signature reproduction / actual composition-root + real browser settlement |
| GB-13 Inherited payload scaling omitted | local C2C mqi05impl-r1 HIGH-1 | Higher owner Core changes actual reactive/extra damage; setting owner ID alone is insufficient | External static trace despite 347 focused tests green / internal content-consumer census + coefficient outcome pin |
| GB-14 Orphan Core restored | same report HIGH-2 | Current save has owned Core with no skill/way/grant source; inverse membership rejects it | External static proof / internal bidirectional ownership property and restore pin |
| GB-15 Tested tree differs from reviewed | same report MEDIUM-1 | Starter preflight fix exists unstaged, absent staged; working-tree tests cannot certify index | External staged comparison / candidate manifest, isolated materialization and validator rejection |
| GB-16 Malformed Body slice | M-QI-07 notes external L1, Low | Present bodyProgression missing required refinement slice; defined aggregate validation error and no mutation | External review after three passes / malformed cross-field generator and original-bug pin; Low remains actionable |
| GB-17 Input asserted instead of owner | [cloud body-core r27](https://github.com/hnkm080596-svg/tutienidle/blob/f9fc4ee4dc42e10a8d6765459607b00ec6fd00be/.c2c/mailbox/inbox-bodycore-impl-r27.md), Medium | Restore test checks `save.player.physiqueGrade`, leaving live restoration unconstrained | External test-quality review / wrong-live-owner mutant must fail while input remains identical |
| GB-18 Talent dual outcome/forged offer | [Talent QA round 42](https://github.com/hnkm080596-svg/tutienidle/blob/f9fc4ee4dc42e10a8d6765459607b00ec6fd00be/game/docs/qa/2026-09-23-mf-talent-deep.md), two High and one Medium | Great-Dao path produces generic entitlement plus evolution; forged offer bypasses pool; latent unowned level bypasses level-1 grant | External review after initial internal pass / exact settlement-count, grant legality and inverse level ownership |
| GB-19 Mixed legal/dead offer set | same Talent report round 47, Medium | One legal member allows a persisted set with foreign/zero-weight members; UI paints unresolvable choices | Later external re-review / every-member predicate, decision-time check, UI-domain parity and malformed save generator |
| GB-20 Zero delivery/probe/restore funnel | [Body Perfection QA r76 addendum](https://github.com/hnkm080596-svg/tutienidle/blob/66d1aca8de21cd2ef2e7cfec8116865cec1478da/game/docs/qa/2026-09-23-m-f-body-perfection-quick.md), three Medium + Low | Zero delivery dispatches subscribers; probe throws instead of fail-closed; restore replays discovery; unknown realm contract | External review / all-producer delivery census, throw injection, restore-exclusion and unknown-ID cases |

GB-18 and GB-20 are families: split each distinct historical defect into its own executable case before qualification. Recover severities from original reports instead of guessing. The schema allows corpus severity to remain unknown during recovery; unknown metadata cannot be presented as measured triage.

This is an initial set, not an exhaustive import. During adoption enumerate every row in learned-defects.md and every meaningful finding in mission QA/C2C/PR records available on the chosen cloud tree. Account for each as executable case, linked duplicate, unsupported historical state requiring reconstruction, or non-defect with evidence. No historically meaningful capability may disappear because it was outside this initial table.

## Benchmark procedure: internal-only

1. Freeze the existing internal workflow revision and new workflow proposal revision; inventory historical evidence separately. No ChatGPT Web session is needed or requested.
2. Curator prepares isolated bug-present fixtures/revisions and corrected/legal nearest-neighbor controls. Check that each bug-present fixture actually violates the intended invariant and is not merely uncompilable. The coordinator knows fixture identities; blind detector agents do not know expected bug labels.
3. Run old internal procedure against that corpus to establish a measured baseline if practical. Recorded historical old misses remain HISTORICAL, not measured false negatives for a new replay.
4. Run new internal procedure with full intended access, fresh contexts and frozen policy. Evaluate detection, correct causal explanation, reproduction/pin, sibling-class search and invalidation behavior, not just keywords in an answer.
5. Compare per-case results: detected correctly / missed / false positive / invalid fixture / blocked. A pass requires the new system to detect every valid historically meaningful case in the declared corpus, retain old useful detections and accept valid controls.
6. Train on exposed examples, then evaluate a sealed holdout selected by an internal curator from unseen history or independently constructed compositions. The 20 cases printed here are **not** a blind holdout. Record when holdout labels are revealed; do not reuse the exposed set as 'independent' qualification.
7. If a new rule is tuned after seeing a holdout miss, that case becomes training. Preserve it as a regression and obtain additional unseen challenges before claiming holdout success.
8. Feed each actual miss/false positive into the learning protocol; requalify detector changes and preserve raw baseline/new results.

No numeric improvement, mutation score or reviewer independence was measured in this architecture task. The deliverable is the benchmark, expected detection mapping and adoption acceptance criteria.

## Orchestrator attack suite

These are mandatory tests of the QA system itself. Use synthetic immutable test fixtures for hashes/records, not game production mutation. The implementation must include both rejecting examples and the valid nearest-neighbor acceptance case.

| Test | Counterexample | Required result |
|---|---|---|
| QF-01 Wrong tree | Green evidence for staged tree A, current working tree B | STALE; cannot populate current coverage |
| QF-02 Hidden untracked source | Untracked production file omitted from manifest | Snapshot/coverage invalid |
| QF-03 Same round, wrong request | Result matches round number but wrong request/state/bundle | STALE_RESULT or integrity error; no phase advance |
| QF-04 Duplicate result | Identical immutable response delivered twice | One accepted result, no duplicate finding/approval |
| QF-05 ID payload collision | Same message ID with changed payload, or conflicting second terminal result on one request | Reject collision; valid ACK -> FINDING -> SEALED_RESULT with distinct message IDs must pass |
| QF-06 Exit-zero FINDINGS | Valid tool/result envelope contains unresolved defect | Findings open; never success from transport exit |
| QF-07 Required tool absent | OCR/browser/ImageMagick missing | Required surface MISSING; QA_UNVERIFIED |
| QF-08 Dirty after clean | One relevant source/test/contract file changes after B | Both clean rounds stale; final decision rejects |
| QF-09 Low correctness defect | PROVEN Low real bug remains | QA_FINDINGS_OPEN; severity cannot waive |
| QF-10 False actionability | High REAL_DEFECT marked actionable=false | Semantic validation rejects |
| QF-11 Cyclic siblings | Two mutually linked repaired/pinned defects | Individual premature close rejects; validated group closes atomically |
| QF-12 Wrong scope | Child PRs green, aggregate conflict-resolution changes behavior | New aggregate gates/reviews required |
| QF-13 Fake independence | Same context relabeled roles, or B sees A's findings | Self-review/contaminated only; independent requirement missing |
| QF-14 Incomplete material | Reviewer receives hunks but not required caller | Incomplete review, exact NEED_CONTEXT request |
| QF-15 Weak owner assertion | Test checks saved input; restoring live owner is disabled | Semantic mutation survives -> TEST_DEFECT, no pin approval |
| QF-16 Invalid mutation kill | Mutant fails compilation rather than target invariant | INVALID, not KILLED_EXPECTED |
| QF-17 Surviving critical mutant | Remove critical gate, existing suite still green | Coverage gap and convergence reset |
| QF-18 Reviewer timeout | No sealed result before timeout/budget | Pending/UNVERIFIED, never implicit clean |
| QF-19 Environment conflation | Scaled-deadline run offered as normal-timing proof | Coverage mismatch; require intended profile |
| QF-20 Fresh seeds | A/B use same generator/environment policy, different recorded seeds | Both valid, seeds retained as evidence inputs |
| QF-21 Novelty epoch | Novel cases inside frozen envelope versus new oracle/family | Inputs preserve epoch; changed model restarts pair without forcing endless model revisions |
| QF-22 Learning poisoning | Unverified report proposes banning valid behavior | Cannot promote; legal controls and independent challenge fail |
| QF-23 Lesson routing | Applicable promoted restore lesson absent from next run | Required coverage incomplete |
| QF-24 Incident versus policy | Append unpromoted journal record; then promote changed detector | Journal append keeps product hash; promotion changes policy/candidate identity and invalidates |
| QF-25 Destructive policy drift | Candidate rule skips old gate or changes product outcome | Automatic promotion denied; explicit human authority required |
| QF-26 Crash/restart | Crash between result receipt and decision journal append | Replay yields same current phase once; verify state before resume |
| QF-27 Concurrent coordinator | Two processes append same sequence or claim writer lease | One wins; other must reconcile/retry, never split authority |
| QF-28 False-positive learning | Broad suppression proposed after one legitimate exception | Actual bug must still be caught; only evidence-backed applicability refinement allowed |
| QF-29 Missing coverage cell | Delete row to improve denominator | Required matrix reconstructed from invariants; deletion is MISSING |
| QF-30 Final-suite failure | Clean A/B but final required full verification fails | No fixed point; diagnose, learn, repair/reverify |
| QF-31 Run-specific report lie | Forged counts or artifact hash / changed assertion after evidence | Reject altered provenance; actual assertions/output reviewed |
| QF-32 No external review service | No ChatGPT Web access/login, no external-review network calls, no C2C inbox; native agent harness and local runtime remain available | Internal workflow still completes synthetic valid qualification scenario |

## Successful qualification means

Structural validation, semantic transitions, state invalidation, internal reviewer isolation, learning promotion/routing and golden detection work in the actual Devin environment. It does not imply the game itself has reached an aggregate fixed point. Report `PROTOCOL_ADOPTION_QUALIFIED` only for this installation/qualification objective, and separately report the actual game's QA status without inventing a pass.
