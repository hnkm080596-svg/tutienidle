# REV-L022 / REV-L022-B — independent lesson qualification

Verifier: verifier-explore-7d3a9 (subagent-explore-6c007f1d), fresh context, read-only.
Verdict: QUALIFY_WITH_LIMITS
1 PASS — defect real on 68621987 (no --test-reporter); fix present in worktree (tap pin + zero-guard)
2 FAIL->fixed — incidentEvidenceIds corrected to EV-QUALIFY-PARSE; refs made portable; pins match manifest
3 PASS — evidence docs exist and reference the defect
4 PASS — CONFIRMED origin justified; INVARIANT correct kind; no overclaim
5 FAIL->fixed — regression test for the counted-oracle contract added (cli.test.mjs)
Residual: sha recompute delegated to coordinator; performed during pin refresh.
