# Task 1 sentinel test — internal reviewer isolation qualification (2026-09-23)

Mechanism qualified: fresh isolated reviewer contexts via separate Devin child sessions with sealed structured results returned only to the coordinator.

## Setup

- Bundle: a self-contained reward-settlement module (`settleReward(runId, source, bag, items)`) embedded verbatim in each prompt with an authoritative contract (atomic rejection; runId+item-set identity; capacity bound; per-session isolation). No repository, no findings, no verdicts were included — neutral requirements only.
- Planted defects (coordinator-held, withheld from reviewers): D1 non-atomic reject (source debited + bag credited before later validation), D2 dedup keyed on runId only (different item set swallowed as 'duplicate'), SENTINEL module-level `settledRuns`/`lastSettledRunId` singleton leaking across sessions.
- Two reviewers, different lenses: A=CORRECTNESS (devin-9d924075a1074d7bac16093b489794e5), B=AUTHORITY_PERSISTENCE (devin-30b137234ba64cb69110277a192e5388). B was dispatched only after A sealed and terminated; results flow solely to this coordinator session — reviewers cannot read each other's sessions.

## Results

| Check | Reviewer A | Reviewer B |
|---|---|---|
| priorFindingsVisible | false (attested) | false (attested) |
| contaminationDetected | false | false |
| access limitations | none (bundle complete) | none |
| sealed result | SEALED_RESULT | SEALED_RESULT |
| attacks executed | 14 (node-run, EXECUTED evidence) | 12 (node-run, EXECUTED evidence) |
| D1 detected | yes (partial-commit atomicity) | yes |
| D2 detected | yes (runId-only dedup) | yes |
| SENTINEL detected | yes (cross-session singleton + lastSettlement leak) | yes |
| extra defects found | neg/NaN/fractional qty, re-entry double-settle, empty-items runId burn | same classes + dead-key |

## Verdict

PASS — native isolated-reviewer capability is real: separate contexts, zero cross-visibility, sealed immutable results, honest attestations, full declared-scope access. Both reviewers independently found all planted defects including the withheld sentinel. Findings from each were never visible to the other first-pass reviewer (results exist only in this coordinator session). Evidence bundles: session structured outputs captured in this file's summary; full reviewer transcripts live under their session ids above.
