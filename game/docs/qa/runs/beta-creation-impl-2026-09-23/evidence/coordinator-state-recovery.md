# Coordinator state-recovery chronology — impl run continuation

## Context
Run resumed by coordinator-devin-4df500e190cc4b9d837f408a5ed53852 after the prior
coordinator VM died mid-flight (lease coordinator-59983 recovered per
acquireLease documented recovery). Re-snapshot on final head 2d5349a6 produced
state be27c4e5…(N1). Evidence batches were journaled against N1.

## Detected inconsistency
`validate --state` reported MC3 drift: recomputed productStateId e90f7078… vs
recorded N1. Manifest diff showed:
1. ADDED entries under test-results/ — Playwright run artifacts from the
   coordinator e2e gate (test outputs, not product changes).
2. CHANGED src/core/skill/MortalPrecursors.ts — the M-IMPL-4 seed mutation had
   been applied in-place and its restore raced the snapshot, so the manifest
   captured the transiently-mutated file.

## Correction
- Removed test-results/; confirmed the only content delta was the mutation
  artifact — the true final tree equals impl head content.
- Re-snapshot -> N2 (productStateId d3b0cb32…; contractId/environmentId unchanged).
- Invalidation correctly marked all N1-bound evidence/coverage/reviews STALE;
  all coordinator records were re-issued under N2 in one consolidated batch
  (event trail in events/ + journal.jsonl).
- Message history (Round-B ASSIGN/SEALED on the OLD pre-repair state, CANCELs on
  N1) preserved as history; CANCEL payload files retained.

## Lesson entry
Recorded under L-IMPL-RB-* series — process note: mutation audits must not
overlap the snapshot window; restore verification (manifest-diff zero deltas)
is required before snapshot seal.
