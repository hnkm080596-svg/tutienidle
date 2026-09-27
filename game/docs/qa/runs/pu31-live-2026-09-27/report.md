# QA run pu31-live-2026-09-27

- phase: DECIDE
- outcome: QA_UNVERIFIED
- state: product=84cd999ee56a contract=5061ae8f4ff0 attack=5964c10cb844 env=ac0d008c3b8a
- base/head: 68621987 -> b7aaa4d6

## Findings

- **F-PU31-01** Medium/REAL_DEFECT — CLOSED — record path commits schema-invalid records; validation is post-hoc only
- **F-PU31-02** Medium/REAL_DEFECT — CLOSED — cross-collection duplicate id commits schema-clean then bricks decide (no delete/rename path)

## Coverage

- cells: 0 total; 

## Chronology


## Convergence

- OK C1-identity: all final evidence binds the declared state
- OK C2-census-coverage: census + coverage complete
- OK C3-no-open: none open
- UNMET C4-final-gates: no final evidence recorded
- UNMET C5-sequential: sequential CORRECTNESS→AUTHORITY→INTEGRATION reviews missing
- UNMET C6-clean-pair: Clean A missing/not CLEAN; Clean B missing/not CLEAN
- OK C7-mutation-corpus: mutation + corpus satisfied
- UNMET C8-terminal-check: no sealed independent TERMINAL_CHECK on the final state
- OK C9-readiness: readiness not required for this run (v1 or opt-out)
