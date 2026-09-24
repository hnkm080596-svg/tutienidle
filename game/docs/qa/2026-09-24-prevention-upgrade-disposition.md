# Prevention upgrade — M1 audit disposition map

Date: 2026-09-24. Scope: upgrade pack `pasted-1790254894382.txt` ("prevent mistakes before implementation") applied to the **installed** internal QA system on `beta/rc`. This document is the Milestone-1 deliverable: existing mechanism -> retained owner -> precise extension -> proof required. It records actual deployed structure and honest capability limits — it is not a qualification result.

## 1. What is actually installed (baseline)

| Layer | Deployed artifact | Role |
|---|---|---|
| Decision law | `game/docs/qa/protocol/README.md` | Sole QA authority: outcomes, snapshot identity, census, ops A-L, finding lifecycle, Clean A/B, terminal predicate, invalidation |
| Taxonomy | `game/docs/qa/protocol/defect-taxonomy.md` | Attack families incl. QAI-* orchestrator classes |
| Ledger | `game/docs/qa/protocol/ledger-schema.md` + `game/scripts/qa/ledger.schema.json` | schemaVersion **1**; record sets: run, invariants, census, findings, evidence, coverage, attacks, reviews, cycles, mutations, corpus, lessons, messages, events; hash-chained event journal; CAS coordinator lease |
| Learning | `game/docs/qa/protocol/learning.md` | incident -> root class + escape -> pin/attack -> independent qualification -> promotion -> consumption; stores: `learning/history/lessons.jsonl` (14 CAPTURED records, none promoted), `learning/policies/<hash>.json` + `active-policy.json` (absent — first promotion creates them) |
| Agent instructions | `game/docs/qa/protocol/agent-instructions.md` + mirrored block in `AGENTS.md` | Primary operating instruction, reviewer instruction, role cards, message protocol, **section G just-in-time 5-slot policy (installed 2026-09-24)** |
| Qualification | `game/docs/qa/protocol/qualification.md` | GB-01..GB-20 golden corpus + QF-01..QF-32 orchestrator attack suite |
| Task intake | `game/docs/architecture/architecture-worker-workflow.md` | G0 task card + Q1-Q12 evidence questions -> G2-G5 gates |
| Runner | `game/scripts/qa/` `cli.mjs` / `state.mjs` / `validate.mjs` / `decision.mjs` + `tests/` | `qa:internal` init/snapshot/record/validate/decide/render/qualify |
| Corpus | `game/docs/qa/corpus/index.json` + `learned-defects.md` | Historical replay cases |

Every obligation above maps to the preservation contract (pack sec.2) and is retained unchanged. The upgrade is additive: it adds construction-side outputs; no detector, coverage cell, or terminal conjunct is weakened or removed.

## 2. Extension map

| Pack section | Existing mechanism -> extension -> proof required |
|---|---|
| 3 Construction brief + readiness | G0/G1 task card (workflow doc section 3) -> add "construction brief" block *by reference* (required fields per pack table) + readiness outcomes `IMPLEMENTATION_READY`/`DISCOVERY_REQUIRED`/`SCOPE_DECISION_REQUIRED` + `BEFORE_WRITE`/`BEFORE_PROPAGATION` proof-stage separation -> PU-07 wrong-owner preflight rejection; brief emitted by `qa:internal prepare` |
| 4 Guidance kinds | `lessons` record + `learning.md` -> add optional `guidance` facet (kind, authorityRefs, sourceDependencies, applicability, exclusions, ownerRoute, preconditions, steps, failureAndInverse, firstProof, detectorRefs, originAnalysis, status, qualificationEvidence, adoptionEvidence, causalPrevention, policyRef, supersedes, limits) -> facet schema validation; detection facet stays independent — a detector may be QUALIFIED while its guidance facet is not |
| 5 Early seam proof | brief `firstProof` field + G3 ordering -> task-shape table recorded as candidate patterns, never as binding current symbols -> one real executed first-proof evidence record |
| 6 Origin analysis + qualification | learning.md incident loop -> add `originAnalysis` (NOT_RETRIEVED/STALE_OR_WRONG/AMBIGUOUS/NOT_APPLIED/MISSING_CAPABILITY/CONTRACT_UNRESOLVED/NOVEL_CLASS/UNKNOWN), candidate-overlay trial path, post-publication adoption proof, prevention evidence levels -> qualification.trial events; adoptionEvidence separate |
| 7 Retrieval/freshness | `qa:internal` -> new `prepare` command: deterministic index over lessons.jsonl (id, domain/operation tags, invariant refs, applicability/exclusions) producing routing record `APPLY`/`NOT_APPLICABLE`/`STALE`/`NEEDS_DISCOVERY`; complete fallback scan if index absent -> deterministic tests for routing + staleness |
| 8 Five-slot scheduling | agent-instructions section G -> extend to named assignment states (QUEUED/READY/RESERVED/RUNNING/RESULT_RECEIVED/RELEASE_PENDING/FINISHED/BLOCKED/CANCELLED) + `assignments` ledger records + `qa:internal schedule` capacity admission; section G rules preserved verbatim -> PU-14..20 mechanical tests where deterministic |
| 9 Efficiency boundaries | workflow doc + agent-instructions -> reuse/boundary table -> no code |
| 10 Schema/migration | ledger.schema.json -> **schemaVersion 2**: `guidance` on lesson, `briefs`, `assignments`, `consumptions` record sets; old v1 ledgers remain valid under v1 reader; lessons keep CAPTURED with guidance absent -> migration tests; replay old ledger decisions unchanged |
| 11 Integration | `cli.mjs` -> `prepare`/`preflight`/`checkpoint`/`learn`/`schedule` subcommands; primary instruction block (agent-instructions §B + AGENTS.md mirror) gains the prevention paragraph -> PU-24: ledger/decide rejects completion when required preflight/brief obligation missing |
| 12 Qualification | qualification.md -> PU-01..PU-32 mapping: deterministic cases -> runner tests; agent-behavioral cases -> task trials with EXECUTED/PLANNED labels |

## 3. Honest capability limits on this environment (recorded, not waived)

| Pack assumption | Actual capability | Consequence |
|---|---|---|
| "one atomic capacity reservation authority" | No platform admission API exists. The coordinator ledger (`assignments` records + journal) is the reservation authority **by discipline**: every child spawn goes through the primary agent and must first record a reservation. A worker cannot mechanically be prevented from spawning — in practice only the coordinator spawns. | PU-14/PU-18 enforced at the coordinator admission point; cannot claim platform-global enforcement for unmanaged sessions. |
| "verify actual slot release" | `devin_session_interact get` returns live status; `terminate` + re-get establishes release. A result message alone is never treated as release. | `RELEASE_PENDING` -> `FINISHED` requires a verified terminal status observation. |
| "suspend does not release a slot" | suspend preserves the context; resume continues the SAME context. | suspended agent keeps its reservation AND is contaminated for Clean-B purposes (documented). |
| "scheduler/CI callback to resume the primary" | `notify_on_response=true` on child create/message delivers a settle notification that interrupts the primary — this is the qualified continuation mechanism. No poll-watcher needed. | Primary retains its slot but does useful coordinator work until a settle event arrives. |
| "direct-edit interception" | No hook can mechanically block a production write. | `prepare/preflight` is enforced via workflow admission + the ledger/decide path rejecting completion when required preflight evidence is absent (PU-24). Report as limitation, not universal write prevention. |
| "fresh reviewer contexts" | Child Devin sessions = fresh contexts (proven). Round-B blindness holds only for NEW sessions. | Contaminated/resumed contexts never count as independent — unchanged from current protocol. |

## 4. Migration approach

- `schemaVersion` bumps 1 -> 2; v1 ledgers remain replayable under their own schema (validator keeps both). New runs write v2. Existing `lessons.jsonl` records untouched — guidance facet initialized absent (`causalPrevention: NOT_ESTABLISHED`). No retroactive claim that old tasks met readiness obligations.
- Governing learning policy payloads keep the existing no-self-hash scheme; new fields excluded from product identity the same way usage/brief outputs are (run evidence bound to input hashes).
- First high-value guidance candidates seeded from already-evidenced incidents this session (sparse JSON array → PER-03; side-effect validator registration → RUN-02; replacement-completeness → I-RESTORE-ATOMIC; boundary contract at every seam → CON-*; finished-reader/bodyCompleted coherence → STA-02; ritual refuse during battle → TRN-01). Each facet is individually qualified before publication — never bulk-promoted.

## 5. Change list (this upgrade's writes)

Docs/protocol: `ledger-schema.md` (v2 record defs + migration section), `learning.md` (guidance facet, origin analysis, qualification/adoption path), `agent-instructions.md` (§B prevention paragraph + §G assignment-state extension), `architecture-worker-workflow.md` (construction-brief block in G0 + readiness outcomes), `README.md` (one-line pointer to prevention machinery), `qualification.md` (PU mapping section), `AGENTS.md` (mirror paragraph). Runner: `ledger.schema.json` v2 + `cli.mjs`/`state.mjs`/`validate.mjs`/`decision.mjs` extensions + tests. Seeds: `learning/history/guidance-seeds.jsonl` + first policy publication when qualified.
