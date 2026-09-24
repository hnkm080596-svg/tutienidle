# Prevention upgrade — handoff report (2026-09-24)

Branch `devin/1790255620-qa-prevention-upgrade`, commit applies pack "Devin upgrade pack: prevent mistakes before implementation" onto the installed QA system. Verification: `node --test scripts/qa/tests/*.test.mjs` = 48/48 pass (incl. 8 new prevention cases); eslint clean on touched files; live `prepare`/`preflight`/`checkpoint` demo against real seeds.

## 1. What shipped

- **Schema v2** (`ledger.schema.json`, `schemaVersion: 2`): new required arrays `briefs`/`assignments`/`consumptions`; `run.briefIds`/`capacityLimit`/`requiredReadiness`; lesson `guidance` facet (null | guidanceFacet); event kinds `MIGRATION`/`SCHEDULE`. Frozen `ledger.schema.v1.json` preserved for replay.
- **`prevention.mjs`**: `routeLessons` (deterministic, no vector DB), `draftBrief`, `preflightBrief`, `checkpointBrief`, `admitAssignment`/`observeAssignment` (5-slot lifecycle-verified), `applyLearningAction` (facet transitions + anti-self-approval), `publishPolicy`/`loadActivePolicy` (atomic, torn-detecting, self-hash-rejecting), `migrateLedgerV1toV2` (explicit, resume-only, honest notes).
- **`cli.mjs`**: new commands `prepare`, `preflight`, `checkpoint`, `learn`, `schedule`, `migrate`; record kinds brief/assignment/consumption.
- **`validate.mjs`**: schema picked by `ledger.schemaVersion`; MC14 checks (brief readiness consistency, assignment chronology + releaseEvidence, consumption/facet ref resolution, QUALIFIED facet evidence requirements).
- **`decision.mjs`**: clause `C9-readiness` — a `requiredReadiness` run cannot reach `QA_FIXED_POINT_REACHED` without briefs that reached `IMPLEMENTATION_READY` and carry `finalConformanceIds` (PU-24).
- **Docs**: `agent-instructions.md` §B steps 5-6 (prepare/preflight/firstProof/checkpoint duties) + §G.1 assignment states; `learning.md` §"Guidance facets" (kinds, lifecycle, origin categories, prevention levels); `ledger-schema.md` MC14 + §"Schema version 2"; `qualification.md` PU-01..32 table; `README.md` upgrade paragraph; `AGENTS.md` mirror paragraph; `architecture-worker-workflow.md` G0 construction-brief block.
- **Seeds**: `learning/history/lessons.jsonl` +6 records L-016..L-021, each a real Beta finding distilled into a `CANDIDATE` guidance facet (sparse-JSON hazard, registration invariant, restore-replacement recipe, cross-seam contract invariant, finished-encoding divergence, battle-phase ritual refusal).

## 2. Preservation contract

Every v1 obligation continues with the same owner; no detector weakened. Snapshot identity (4-hash state), CAS lease + hash-chained journal, deterministic validation, OCR gate, runtime evidence kinds, sequential resulting-state reviews, Clean A/B independence, all blocking findings, production-write boundaries, learning promotion predicate — all unchanged. v1 ledgers validate under the frozen v1 schema (`validateStructure` selects by `ledger.schemaVersion`); migration to v2 is explicit, resume-only, logs all initializations, and never fabricates evidence (`requiredReadiness=false` on migrated runs — no retroactive readiness claims).

## 3. Capability limits (honest, recorded in M1 disposition)

- No platform atomic-admission API → the ledger `schedule` command is the reservation authority by discipline; capacity counts ledger-active + caller-declared external agents (`externalOccupied`).
- No direct edit interception → `prepare`/`preflight` enforce through workflow admission (§B5) + `C9` refusal at decide-time, not by blocking keystrokes.
- Suspend/resume preserves context → a suspended agent keeps its reservation AND is contaminated for Clean-B independence (documented §G.1).
- `notify_on_response` is the qualified continuation mechanism; child sessions are fresh contexts; release requires observed lifecycle state (`devin_session_interact get` → `terminated`/`finished`), not a message.

## 4. PU qualification results

See `protocol/qualification.md` PU table. Summary: 24/32 EXECUTED (test or schema-enforced), 5 SOURCE (implementation/logic inspection), 3 INFERRED (platform-limit reasoning), PU-30 (live 5-slot concurrency) and PU-31 (post-publication ordinary-task adoption) PLANNED. **Label: NOT `PREVENTION_UPGRADE_QUALIFIED` yet** — withheld until PU-30/PU-31 demonstrate. Effectiveness: `EFFICIENCY_NOT_YET_ESTABLISHED` (no comparative pilot exists).

## 5. Live demo performed

`prepare` routed 6 seeds deterministically (4 NEEDS_DISCOVERY — CANDIDATE never auto-applies, 2 NOT_APPLICABLE); `preflight` blocked `IMPLEMENTATION_READY` while routing unresolved, returned `READY_TO_DECLARE` after resolution, then `BLOCKED` on real source-dependency drift; `checkpoint` marked the brief `STALE` with itemized invalidation on baseline drift.

## 6. Seeds

L-016 (sparse-JSON → round-trip pin), L-017 (composition-root registration), L-018 (restore replacement completeness), L-019 (single contract authority across all seams), L-020 (finished-encoding cross-check), L-021 (battle-phase ritual refusal). All `CANDIDATE` — they qualify only through the normal independent-verifier path, no self-approval.

## 7. Remaining (PLANNED)

- PU-30: exercise 5-slot admission under real concurrent agents on the next run.
- PU-31: first ordinary task consumes a published facet → `consumption` record → then label review.
- Comparative pilot for `EARLY_CORRECTION_OBSERVED`/`COMPARATIVE_EVIDENCE` claims.

## 8. How to use

New run: `qa:internal prepare --task <task.json>` → fill the drafted brief (slices, firstProof oracles) → `preflight --brief` → declare readiness in the ledger → work slices honoring firstProof stages → `checkpoint` on drift → `record`/`schedule` for assignments → existing validate/decide/render unchanged. Seeds and future qualified facets route automatically at `prepare`.
