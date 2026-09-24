# Coordinator handoff — run state at stand-down (2026-09-24 ~02:50Z)

## Decision taken
User adjudicated Clean-A findings to PATH A (repair on impl branch). Coordinator
parent repaired all 7 on `devin/1790189100-beta-creation`: head moved
2d5349a6 -> 1beffdda. Repairs reported: F-INT-01 routing via saveIssue.report,
F-INT-02/F-INT-03, F-A-CORRECTNESS-1, F-A-AUTHORITY-1/2/3. Coordinator-side local
evidence reported by parent: type-check clean, 60 scoped tests green.

## Run-journal consequences (next coordinator must execute)
- Frozen state N2 (d3b0cb32) binds head 2d5349a6 — SUPERSEDED. Next step is a
  fresh `snapshot` on head 1beffdda -> new state N3; all N2-bound
  evidence/coverage/reviews invalidate to STALE (expected, not an error).
- Findings F-A-*: repairs claimed landed -> per protocol each gets
  REPAIR_AUTHORIZED -> FIXED_PENDING_PROOF -> proof evidence on N3 ->
  PINNED -> SIBLINGS_RESOLVED -> CLOSED with closureEvidenceIds; the C4 gates
  (type-check/build/vitest/pins/e2e/mutations) must be re-run on N3.
- Clean-B trio + TERMINAL_CHECK were CANCELED pre-seal on user order
  (MSG-CANCEL-CB-*/MSG-CANCEL-TERMINAL); no B seals exist. A NEW clean pair on
  N3 (two rounds, disjoint contexts, priorFindingsVisible=false,
  accessLimitations=[]) + a TERMINAL_CHECK on N3 are required for C6/C8.
- Reviewer seal quirks to carry forward: accessLimitations must be [] unless a
  surface was unreadable (execution gaps -> coverageNotes); message records
  need runId; finding locations must be repo-relative paths WITHOUT the
  'game/' prefix and without ':NN' suffixes (lines go in symbolOrSection);
  cleanRoundA/B may only point at CLEAN-outcome cycles (FINDINGS cycles stay
  ordinary cycles).
- SWE-2 free-tier cap = 5 concurrent sessions; terminated sessions stop
  counting only after the platform releases them (terminate early when done).

## Open items at stand-down
- 7 PROVEN findings awaiting proof on the repaired head (see Finding table).
- No independent review exists on head 1beffdda — all closure evidence must be
  regenerated on N3.
