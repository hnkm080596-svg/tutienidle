# QA run phap-tu-reimagine-merge-2026-09-27

- phase: DECIDE
- outcome: QA_UNVERIFIED
- state: product=d467c64edae3 contract=33679340803e attack=d8d32bdb460e env=e3ca14a6b377
- base/head: 68621987 -> 8e25a766

## Findings

- **F-MRG-01** Low/REAL_DEFECT — CLOSED — merged hoIntercept.test.ts dropped the 4 NOVA-1 pin tests (took master verbatim)
- **F-MRG-02** Nit/REAL_DEFECT — CLOSED — dormant consumesAllThe/theBurned lane diverges from master in queued executions
- **F-MRG-03** Low/REAL_DEFECT — CLOSED — ung-the The pool renders as ~100 overlapping pips instead of a fill bar
- **F-MRG-04** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — no repo pin test for the fill lane (ung-the >12-pip HUD path)
- **F-MRG-05** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — updateThe setVisible(true) clobbers group.visible on hide->show transitions

## Coverage

- cells: 0 total; 

## Chronology

- cycle CYCLE-MRG-R1: FINDINGS; reviews REV-MRG-COR-1,REV-MRG-AUT-1,REV-MRG-INT-1

## Convergence

- OK C1-identity: all final evidence binds the declared state
- OK C2-census-coverage: census + coverage complete
- OK C3-no-open: none open
- OK C4-final-gates: final gates green
- OK C5-sequential: sequential phase reviews present
- UNMET C6-clean-pair: Clean A missing/not CLEAN; Clean B missing/not CLEAN
- OK C7-mutation-corpus: mutation + corpus satisfied
- OK C8-terminal-check: independent terminal verifier sealed
- OK C9-readiness: readiness not required for this run (v1 or opt-out)

## Validation failures

- MC9 CYCLE-MRG-R1: AUTHORITY phase does not reference CORRECTNESS review as predecessor
- MC9 CYCLE-MRG-R1: INTEGRATION phase does not reference AUTHORITY review as predecessor
