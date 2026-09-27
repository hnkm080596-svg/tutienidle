# QA run enemy-art-wave1-2026-09-28

- phase: DECIDE
- outcome: QA_UNVERIFIED
- state: product=d3e104d1dbd0 contract=cf9466eb0fb9 attack=5fb357dc70fb env=ac0d008c3b8a
- base/head: 686219870ad364786d699fe617a52d32efab0c34 -> 729ae89ce6bec984fedca1c1e25ec8d7e4b30ed6

## Findings

- **F-EAW-01** Medium/REAL_DEFECT — CLOSED — Unity pivot parser read {x,y} but dump uses {m_X,m_Y} - every pivot silently defaulted
- **F-EAW-02** High/REAL_DEFECT — CLOSED — Art floated ~24% above ground: Unity pivot is not a feet anchor for this dump
- **F-EAW-03** High/REAL_DEFECT — CLOSED — Boss art mapped to foundation_dragon_phase* ids which are buff ids not enemy ids
- **F-EAW-04** Medium/TEST_DEFECT — CLOSED — Registry hardcoded avatarSize 512x512 vs real ~150px PNGs
- **F-EAW-05** Low/TEST_DEFECT — CLOSED — Stale test fixtures assumed mortal_wild_boar static after it was intentionally reskinned
- **F-EAW-06** Low/REAL_DEFECT — CLOSED — Reskinned template ids still loaded old PNGs and registered dead catalogue entries
- **F-EAW-07** Low/COVERAGE_GAP — CLOSED — clip() hardcodes sheet-1 - latent break when reserved 4-sheet wugu-demon-king is wired
- **F-EAW-08** Low/NON_ACTIONABLE — HUMAN_EXCEPTION — attackSfxUrl declared but unconsumed - SFX staged per user ruling, design deferred
- **F-EAW-09** Low/COVERAGE_GAP — CLOSED — Atlas-load-failure degradation path (placeholder persistence for reskinned entity) unexercised e2e

## Coverage

- cells: 28 total; SATISFIED=21 MISSING=7

## Chronology


## Convergence

- OK C1-identity: all final evidence binds the declared state
- UNMET C2-census-coverage: coverage COV-INV-RESKIN-RESOLVE-INDEPENDENT_REVIEW=MISSING; coverage COV-INV-ANIMATED-OVERRIDE-INDEPENDENT_REVIEW=MISSING; coverage COV-INV-FEET-ANCHOR-INDEPENDENT_REVIEW=MISSING; coverage COV-INV-LOADER-PARITY-INDEPENDENT_REVIEW=MISSING; coverage COV-INV-DEATH-LIFECYCLE-INDEPENDENT_REVIEW=MISSING; coverage COV-INV-REGISTRY-MANIFEST-PARITY-INDEPENDENT_REVIEW=MISSING; coverage COV-INV-ATTACK-RETURN-INDEPENDENT_REVIEW=MISSING
- UNMET C3-no-open: exception F-EAW-08
- UNMET C4-final-gates: no final evidence recorded
- UNMET C5-sequential: sequential CORRECTNESS→AUTHORITY→INTEGRATION reviews missing
- UNMET C6-clean-pair: Clean A missing/not CLEAN; Clean B missing/not CLEAN
- UNMET C7-mutation-corpus: no killed mutant for I-RESKIN-RESOLVE; no killed mutant for I-ANIMATED-OVERRIDE; no killed mutant for I-DEATH-LIFECYCLE; no killed mutant for I-REGISTRY-MANIFEST-PARITY
- UNMET C8-terminal-check: no sealed independent TERMINAL_CHECK on the final state
- UNMET C9-readiness: requiredReadiness run has no construction brief (PU-24)

## Validation failures

- MC5 F-EAW-01: closure reviewer coordinator is the discovering fixer context
- MC5 F-EAW-02: closure reviewer coordinator is the discovering fixer context
- MC5 F-EAW-03: closure reviewer coordinator is the discovering fixer context
- MC5 F-EAW-04: closure reviewer coordinator is the discovering fixer context
- MC5 F-EAW-05: closure reviewer coordinator is the discovering fixer context
- MC5 F-EAW-06: closure reviewer coordinator is the discovering fixer context
- MC5 F-EAW-07: closure reviewer coordinator is the discovering fixer context
- MC5 F-EAW-09: closure reviewer coordinator is the discovering fixer context
- MC7 COV-INV-RESKIN-RESOLVE-INDEPENDENT_REVIEW: required surface INDEPENDENT_REVIEW is MISSING
- MC7 COV-INV-ANIMATED-OVERRIDE-INDEPENDENT_REVIEW: required surface INDEPENDENT_REVIEW is MISSING
- MC7 COV-INV-FEET-ANCHOR-INDEPENDENT_REVIEW: required surface INDEPENDENT_REVIEW is MISSING
- MC7 COV-INV-LOADER-PARITY-INDEPENDENT_REVIEW: required surface INDEPENDENT_REVIEW is MISSING
- MC7 COV-INV-DEATH-LIFECYCLE-INDEPENDENT_REVIEW: required surface INDEPENDENT_REVIEW is MISSING
- MC7 COV-INV-REGISTRY-MANIFEST-PARITY-INDEPENDENT_REVIEW: required surface INDEPENDENT_REVIEW is MISSING
- MC7 COV-INV-ATTACK-RETURN-INDEPENDENT_REVIEW: required surface INDEPENDENT_REVIEW is MISSING
- MC11 I-RESKIN-RESOLVE: HIGH invariant lacks a KILLED_EXPECTED representative mutation
- MC11 I-ANIMATED-OVERRIDE: HIGH invariant lacks a KILLED_EXPECTED representative mutation
- MC11 I-DEATH-LIFECYCLE: HIGH invariant lacks a KILLED_EXPECTED representative mutation
- MC11 I-REGISTRY-MANIFEST-PARITY: HIGH invariant lacks a KILLED_EXPECTED representative mutation
