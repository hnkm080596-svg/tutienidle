# EV-QUALIFY-PARSE — incident reference

Source incident: run pu30-live-2026-09-27, evidence EV-QUALIFY-PARSE, finding F-PU30-04.
Observed live: `qa:internal qualify` printed "orchestrator tests: 0 passed, 0 failed"
then emitted PROTOCOL_ADOPTION_QUALIFIED while `node --test scripts/qa/tests/`
reported 48 passing tests — a vacuous counted verdict (QAI-08).
