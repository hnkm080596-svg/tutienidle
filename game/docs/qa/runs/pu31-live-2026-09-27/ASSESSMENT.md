# PU-31 Live Assessment — 2026-09-27

Run: `pu31-live-2026-09-27` | Branch: `qa-scripts-repair` | Outcome: **QA_UNVERIFIED**

## Goal

PU-31 demonstrates post-publication adoption: a qualified lesson's policy is
published, then an ordinary task routes through `prepare` and actually consumes
it. This is the last unproven link of the prevention-upgrade mechanism.

## What was demonstrated (real evidence)

1. **L-022 built from a real defect** (F-PU30-04): INVARIANT — counted oracles
   must pin the reporter and fail closed on a zero/unparsed denominator.
2. **Independent qualification**: verifier `verifier-explore-7d3a9` (isolated
   context) → QUALIFY_WITH_LIMITS; 3 errors corrected (wrong evidence id,
   master-only path, missing regression test); sealed review REV-L022-B.
3. **Atomic publication**: `learning/policies/aa1b335b….json` +
   `active-policy.json` index.
4. **Ordinary task consumed it**: `prepare --task` → routing `APPLY` → brief
   with policy hash → `preflight` READY_TO_DECLARE → consumption record linked
   to brief/policy/task/action/outcome/evidence.
5. **Staleness cycle exercised live**: source-drift on `cli.mjs` correctly
   flipped routing to STALE; pin refresh restored APPLY.

## Findings discovered and closed inside the run

- **F-PU31-01** (Medium, closed): `record` write path committed schema-invalid
  records; id-less malformed records became permanently uncorrectable and
  bricked `decide`. Fix: (collection,index)-attributed structural validation
  before `commitLedger`. Two independent closure passes (first NEEDS_FIX on
  the id-keyed attribution hole → fixed → second CLOSED).
- **F-PU31-02** (Medium, closed): schema-valid record with an id colliding in
  another MC1 namespace bricked `decide` with no recovery. Fix: shared
  `ledgerIdTaken` over `ID_COLLECTIONS` (all 15 namespaces + run.id +
  requestIds), applied at record push, message id/requestId, and
  `admitAssignment` (reverse direction). Pass-3 review CLOSED after the
  `assignments` hole and reverse direction were both fixed.
- Lessons captured: L-023 (write-path schema gate), L-024 (namespace
  uniqueness boundary ≠ routing table).

## Remaining unmet gates (honest)

- C4 final-gate evidence, C5 sequential reviews, C6 clean pair A/B, C8 terminal
  check — not scoped by this run; the run targeted mechanism adoption, not
  fixed point.
- `PREVENTION_UPGRADE_QUALIFIED` still requires the full gate set on a run
  that declares it.

## Verification

- `node --test scripts/qa/tests/*.test.mjs`: 59/59 pass.
- `qa:internal qualify`: 57 passed, 0 failed (nested-spawn test self-skips).
- `validate`: clean. `decide`: QA_UNVERIFIED (C3 satisfied — no open findings).
