# QA run ui-fix-wave1-2026-09-28

- phase: DECIDE
- outcome: QA_UNVERIFIED
- state: product=2b52e8712061 contract=42e4f2876e38 attack=a1c5bd8b31cf env=7dbf357f7d8b
- base/head: 0f1d84d1 -> 32483797

## Findings

- **F-UIW1-01** Medium/REAL_DEFECT — CLOSED — Vendor sell preview mislabels spirit-stone grant
- **F-UIW1-02** Medium/REAL_DEFECT — CLOSED — Four divergent local copies of the paper-on-dark token remap
- **F-UIW1-03** Low/REAL_DEFECT — CLOSED — stageLockReason misses the cross-zone gate
- **F-UIW1-04** Low/REAL_DEFECT — CLOSED — Pending exit-confirm survives battle end
- **F-UIW1-05** Nit/REAL_DEFECT — CLOSED — Turn-order HP can render current > max
- **F-UIW1-06** Nit/REAL_DEFECT — CLOSED — Tab inside a useDialogFocus card still bubbles to DongFuCommandWheel
- **F-UIW1-07** Nit/REAL_DEFECT — CLOSED — Dead .sys-modal CSS selectors
- **F-UIW1-08** Nit/REAL_DEFECT — CLOSED — requestCombatExit public API has zero production call-sites
- **F-UIW1-09** Low/REAL_DEFECT — CLOSED — previewSellGrant skips the sole-recipe-ingredient guard
- **F-UIW1-10** Low/REAL_DEFECT — CLOSED — Exit-confirm open-gate swallows intro/countdown clicks
- **F-UIW1-11** Low/REAL_DEFECT — CLOSED — RealmPanel keeps a divergent paper->sys token remap
- **F-UIW1-12** Low/REAL_DEFECT — CLOSED — stageLockReason mirror of isStageUnlocked unpinned
- **F-UIW1-13** Nit/REAL_DEFECT — CLOSED — Granted stone id re-derived 3x in one flow
- **F-UIW1-14** Nit/REAL_DEFECT — CLOSED — .ink-drawer and .paper-on-dark enumerate the identical token map
- **F-UIW1-15** Low/REAL_DEFECT — CLOSED — previewSellGrant gate parity vs sellMaterial underdocumented
- **F-UIW1-16** Nit/REAL_DEFECT — CLOSED — Technique-tooltip icon wells lost deliberate cream medallion
- **F-UIW1-17** Nit/REAL_DEFECT — CLOSED — Confirm-modal grant figure stale across mid-confirm breakthrough
- **F-UIW1-18** Nit/REAL_DEFECT — CLOSED — Dead hpPercent() helper in TurnOrderStrip

## Coverage

- cells: 0 total; 

## Chronology

- cycle CYC-UIW1-1: FINDINGS; reviews REV-UIW1-COR-1,REV-UIW1-AUT-1,REV-UIW1-INT-1
- cycle CYC-UIW1-2: FINDINGS; reviews REV-UIW1-COR-2,REV-UIW1-AUT-2,REV-UIW1-INT-2

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
