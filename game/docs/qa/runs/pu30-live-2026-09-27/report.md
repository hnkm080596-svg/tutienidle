# QA run pu30-live-2026-09-27

- phase: DECIDE
- outcome: QA_BLOCKED_SCOPE
- state: product=eaa246f93e70 contract=3be7709c18bf attack=d794cb338d1a env=3cd1c7fc3e83
- base/head: origin/master -> master

## Findings

- **F-PU30-01** Medium/REAL_DEFECT — TRIAGED — Stale flag computed but never persisted on message records
- **F-PU30-02** Medium/REAL_DEFECT — TRIAGED — record --kind assignment mints RESERVED records bypassing admission
- **F-PU30-03** Low/REAL_DEFECT — TRIAGED — Terminal results accepted on requestIds that never had an ASSIGN
- **F-PU30-04** High/REAL_DEFECT — TRIAGED — cmdQualify parses TAP counters but Node 24 emits spec reporter -> vacuous QUALIFIED
- **F-PU30-05** Low/REAL_DEFECT — TRIAGED — Re-admission replaces record wholesale; history dropped unless coordinator resupplies
- **F-PU30-06** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — Coordinator requestId typo on ASG-R5 re-admission (REQ-R5-BYPASS vs bundle REQ-R5-JOURNAL)
- **F-PU30-07** Nit/DOCUMENTATION_DEFECT — TRIAGED — cli.mjs usage string omits prepare/preflight/checkpoint/learn/schedule/migrate
- **F-PU30-08** Medium/REAL_DEFECT — TRIAGED — admitAssignment derives history "from" from caller input, not ledger truth
- **F-PU30-09** High/REAL_DEFECT — TRIAGED — externalOccupied unvalidated: NaN fails open, negatives under-count
- **F-PU30-10** High/REAL_DEFECT — TRIAGED — Re-admission of active assignment demotes it = unverified release channel
- **F-PU30-11** High/REAL_DEFECT — TRIAGED — observeAssignment has no transition legality: QUEUED->FINISHED, FINISHED->RESULT_RECEIVED resurrection
- **F-PU30-12** Medium/REAL_DEFECT — TRIAGED — Verified release is coordinator-asserted: evidence optional, observedRuntimeId/resultRef never written
- **F-PU30-13** Medium/SPEC_DEFECT — TRIAGED — Lifecycle spec incomplete: RUNNING unreachable, CANCELLED/BLOCKED never produced by observe
- **F-PU30-14** Medium/COVERAGE_GAP — TRIAGED — No machine check enforces active-count vs cap or requires FINISHED before outcome
- **F-PU30-15** Medium/REAL_DEFECT — TRIAGED — capacityLimit is request-controlled unbounded integer - hard cap 5 is a suggestion
- **F-PU30-16** Low/REAL_DEFECT — TRIAGED — No CAS on ledger writes: concurrent same-lease commands lose updates
- **F-PU30-17** Nit/REAL_DEFECT — TRIAGED — observeAssignment crashes on history-less record; admitAssignment never checks asg.id
- **F-PU30-18** High/REAL_DEFECT — TRIAGED — Lease guard bypassed by omission; journal append precedes atomic save; expectedSeq dead code
- **F-PU30-19** High/REAL_DEFECT — TRIAGED — record replace-in-place unconditional: CLOSED findings / SEALED reviews silently rewritable
- **F-PU30-20** Medium/REAL_DEFECT — TRIAGED — Message ordering/direction unenforced: SEALED_RESULT on never-assigned requestId, traffic after CANCEL, self-addressed results
- **F-PU30-21** Medium/REAL_DEFECT — TRIAGED — Declared runId silently overwritten; missing state skips staleness yet can occupy terminal
- **F-PU30-22** Medium/REAL_DEFECT — TRIAGED — decide runs structural validation only - MC1-MC14 skipped on decision path
- **F-PU30-23** Low/REAL_DEFECT — TRIAGED — Second SEALED_RESULT with new id + same payloadHash stored -> two terminal records per requestId
- **F-PU30-24** Nit/REAL_DEFECT — TRIAGED — Hardening: no fsync on save; mixed-kind batch events mislabeled; empty batch emits no-op event; --run accepts absolute paths
- **F-PU30-25** Medium/REAL_DEFECT — DUPLICATE_LINKED — reviewer duplicate of F-PU30-02
- **F-PU30-26** Medium/REAL_DEFECT — DUPLICATE_LINKED — reviewer duplicate of F-PU30-01

## Coverage

- cells: 15 total; SATISFIED=15

## Chronology


## Convergence

- OK C1-identity: all final evidence binds the declared state
- UNMET C2-census-coverage: domain docs/qa/protocol uncovered
- UNMET C3-no-open: open F-PU30-01; open F-PU30-02; open F-PU30-03; open F-PU30-04; open F-PU30-05; open F-PU30-07; open F-PU30-08; open F-PU30-09; open F-PU30-10; open F-PU30-11; open F-PU30-12; open F-PU30-13; open F-PU30-14; open F-PU30-15; open F-PU30-16; open F-PU30-17; open F-PU30-18; open F-PU30-19; open F-PU30-20; open F-PU30-21; open F-PU30-22; open F-PU30-23; open F-PU30-24
- UNMET C4-final-gates: no final evidence recorded
- UNMET C5-sequential: sequential CORRECTNESS→AUTHORITY→INTEGRATION reviews missing
- UNMET C6-clean-pair: Clean A missing/not CLEAN; Clean B missing/not CLEAN
- OK C7-mutation-corpus: mutation + corpus satisfied
- UNMET C8-terminal-check: no sealed independent TERMINAL_CHECK on the final state
- OK C9-readiness: readiness not required for this run (v1 or opt-out)

## Validation failures

- MC12 F-PU30-01: actionable finding still TRIAGED
- MC12 F-PU30-02: actionable finding still TRIAGED
- MC12 F-PU30-03: actionable finding still TRIAGED
- MC12 F-PU30-04: actionable finding still TRIAGED
- MC12 F-PU30-05: actionable finding still TRIAGED
- MC12 F-PU30-07: actionable finding still TRIAGED
- MC12 F-PU30-08: actionable finding still TRIAGED
- MC12 F-PU30-09: actionable finding still TRIAGED
- MC12 F-PU30-10: actionable finding still TRIAGED
- MC12 F-PU30-11: actionable finding still TRIAGED
- MC12 F-PU30-12: actionable finding still TRIAGED
- MC12 F-PU30-13: actionable finding still TRIAGED
- MC12 F-PU30-14: actionable finding still TRIAGED
- MC12 F-PU30-15: actionable finding still TRIAGED
- MC12 F-PU30-16: actionable finding still TRIAGED
- MC12 F-PU30-17: actionable finding still TRIAGED
- MC12 F-PU30-18: actionable finding still TRIAGED
- MC12 F-PU30-19: actionable finding still TRIAGED
- MC12 F-PU30-20: actionable finding still TRIAGED
- MC12 F-PU30-21: actionable finding still TRIAGED
- MC12 F-PU30-22: actionable finding still TRIAGED
- MC12 F-PU30-23: actionable finding still TRIAGED
- MC12 F-PU30-24: actionable finding still TRIAGED
