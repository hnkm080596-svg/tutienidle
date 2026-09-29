# PU-30 live execution assessment — pu30-live-2026-09-27

Run outcome (coordinator-emitted): **QA_BLOCKED_SCOPE** — see `report.md`.

## What PU-30 required vs what was demonstrated live

| Requirement (qualification.md PU-30) | Result | Evidence |
|---|---|---|
| `qa:internal schedule` admission under capacity 5 (1 coordinator + ≤4 workers) | EXECUTED | 4 workers RESERVED; 5th READY assignment QUEUED at 5/5 incl. externalOccupied=1 — EV-LIVE-ADMIT, journal |
| Queued/blocked work holds no slot | EXECUTED | ASG-WAIT QUEUED, ASG-BLOCKED BLOCKED while 4 workers held slots — EV-QUEUE-NOSLOT |
| Result message is NOT slot release | EXECUTED | ASG-R3, ASG-R6, ASG-R7 → RESULT_RECEIVED still counted active — EV-NEEDCTX-REL |
| Timeout is NOT slot release | EXECUTED | ASG-FORGED timeout → RELEASE_PENDING, slot retained — ledger history |
| Only verified lifecycle frees slot | EXECUTED | terminated/cancelled observations → FINISHED for all 8 assignments; run drained to 0 active |
| Just-in-time re-dispatch after release | EXECUTED | ASG-R5 QUEUED→RESERVED only after ASG-R3 verified release |
| NEED_CONTEXT ends reviewer turn, needs new dispatch | EXECUTED | reviewer 49db4b21 returned NEED_CONTEXT on missing `slot-scheduling-law.md`; slot released; no silent continuation |
| Real isolated concurrent workers under five-slot law | EXECUTED | 6 subagent dispatches total (first wave of 4 cancelled by user; final wave of 2 completed and sealed) |
| Independent sealed review evidence | EXECUTED | REV-A (ca27c584, slot law lens) + REV-B (f6a1d784, message/ledger lens), both SEALED, fresh isolated contexts, disclosed exposure |

## Sealed reviewer yield

REV-A: 10 findings (R6-01..10) — incl. externalOccupied fail-open, re-admission demotion as unverified release, absent transition legality (resurrection), unbounded capacityLimit, missing CAS.
REV-B: 8 findings (F-MSGLED-1..8) — incl. stale-terminal poisoning, lease bypass by omission, unconditional replace-in-place on terminal records, decide skipping MC1-MC14.
Independent corroboration: R6-02 dup F-PU30-02; F-MSGLED-1 dup F-PU30-01; F-MSGLED-3/4 sibling-extend F-PU30-02/03.

Total: 26 findings (24 actionable REAL_DEFECT/SPEC_DEFECT/COVERAGE_GAP in `scripts/qa`, all out of this run's repair scope → QA_BLOCKED_SCOPE), 2 duplicates linked, 4 CAPTURED lessons.

## Verdict on PU-30

**The mechanism evidence is now real, not just unit-tested.** Live admission/queue/release/timeout/NEED_CONTEXT/lease/message-integrity semantics were exercised end-to-end with real concurrent isolated agents, plus 2 killed mutants and 2 sealed independent reviews that found 18 additional genuine defects.

PU-30's *scheduling* facet is satisfied as mechanism evidence. However the run produced 23 open actionable findings in `scripts/qa` — the honest reading is that the mechanism works as specified but the implementation has real integrity holes (fail-open inputs, missing transition guards, bypass paths, non-persisted flags).

PREVENTION_UPGRADE_QUALIFIED remains withheld (PU-31 pending; and arguably these findings should be repaired + a clean re-run before qualification is claimed).

Do not infer `QA_FIXED_POINT_REACHED` for the game from this run — it exercised QA mechanism evidence only.

## Follow-ups

1. scripts/qa repair mission for F-PU30-01..05, 07..24 (needs scope authorization — all currently TRIAGED).
2. After repairs, re-run PU-30-style scheduling to close findings under PINNED lifecycle.
3. PU-31: real task consuming a published policy — still unexecuted.
