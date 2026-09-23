# Sequential review — adoption diff (P5, ≥3 passes)

```
Sequential Review Pass 1 — Local Correctness (P18 OCR, delegation mode)
  Reviewed state: full adoption diff (origin/master..HEAD), 19 reviewable files, 100% coverage
  Findings:
    - validate.mjs MC8: census.location is a ref object; required-domain check crashed (TypeError) when domain lacked invariant coverage — FIXED (location?.path), regression test added
    - decision.mjs withinScope: prefix "src" also authorized "src-evil/x" (no segment boundary) — FIXED, regression test added
    - validate.mjs sameState: not null-safe; semantic checks could crash on malformed ledgers — FIXED (a&&b guard)
    - validate.mjs MC7: INDEPENDENT_REVIEW SATISFIED with zero reviewers/evidence slipped through — FIXED
  Fixes verified: node --test scripts/qa/tests = 40/40; npx eslint scripts/qa = clean
  Verification: targeted vitest (asciiComments) green; full `npm run verify` run (2 failures = pre-existing env: `magick` binary absent; identical files on master)

Sequential Review Pass 2 — Architecture / Authority
  Reviewed state after Pass 1 fixes: YES
  Findings: none confirmed
    - sole-writer discipline: all mutations via coordinator holding lease.json; append-only journal; atomic ledger save — verified
    - verdict authority: outcomes emitted only by decide(); gates (P3/P18/P4/P13/P14) produce evidence records, never verdicts — verified in cli/validate/decision split
    - .opencode mirrors: AGENTS.md QA-authority block mirrored byte-identical in build.md + general.md (P-rule sync rule) — verified by diff
    - contract identity: contractId = hashFileSet(AGENTS.md, protocol/README, agent-instructions) — checks the governing docs actually read
  Verification: ocr rule resolution over reviewable set; grep sweep — no live external-verdict mandate remains (see evidence/external-review-inventory.md)

Sequential Review Pass 3 — Adversarial Integration
  Reviewed state after Pass 2 fixes: YES (no Pass-2 code changes)
  Findings: none confirmed
    - crash replay: journal.jsonl append-only; orphan payload files tolerated (journal authoritative); seq CAS-guarded — tested (QF-26)
    - concurrent coordinator: lease 'wx' exclusivity — tested (QF-27); second acquireLease throws with holder id
    - tampered event chain / forged artifact hash — rejected by MC2/MC1 — tested (QF-31/31b)
    - stale-state messages do not advance run — tested (QF-03)
    - real-run integration: init→snapshot→decide→render on actual repo emits honest QA_UNVERIFIED with exact unmet clauses — executed
  Verification: 40 node:test cases incl. QF-01..32 orchestrator suite; qualify gate green
```
