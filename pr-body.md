## Summary

M-QA-INTERNAL: adopts the Internal Fixed-Point QA Protocol as the project's sole QA decision law, replacing the external ChatGPT-Web/C2C verdict step with an in-repo, agent-run convergence predicate. Infrastructure only — no gameplay, economy, architecture-owner, release, or save-policy changes.

**Files → purpose**
- `game/docs/qa/protocol/` — canonical protocol docs (README = decision law; taxonomy, ledger schema, learning, qualification, agent instructions); promoted verbatim from the design pack `docs/qa/2026-09-23-unified-fixed-point/` (kept as provenance).
- `game/scripts/qa/{state,validate,decision,cli}.mjs` + `ledger.schema.json` (verbatim extract of 03) — the protocol runner: CAS event journal + lease locking, 4-part state manifest (product/contract/attack-model/environment), transitive stale invalidation, finding lifecycle, coverage matrix, message correlation, MC1–MC13 semantic checks, C1–C8 terminal predicate. Sole entry: `npm run qa:internal`.
- `game/scripts/qa/tests/` — 40 node:test cases (QF-01..32 orchestrator suite + boundary regressions).
- `game/docs/qa/corpus/index.json` — 25 golden-bug entries (GB-01..20 + splits), seeded PENDING from historical audit + C2C records.
- `game/docs/qa/learning/history/lessons.jsonl` — 14 CAPTURED lesson seeds; promotion blocked until qualification.
- `game/docs/qa/runs/adoption-2026-09-23/` — the real adoption-run ledger: request, attack model, environment, pinned manifest (productStateId `29794eb4`), evidence, reviews, report.
- Governance: `AGENTS.md`, `AstraDoctrine.md`, `PROJECT_CONTEXT.md`, `.opencode/agent/{build,general}.md`, skills, `architecture-worker-workflow.md` — added the QA-authority clause + marked C2C/ChatGPT-Web verdicts non-binding (history kept; PR #1 untouched).

**Authority map**
- Before: terminal verdict delegated to external ChatGPT-Web review via C2C transport (PR #1 tooling); internal gates produced evidence, not verdicts.
- After: `qa:internal decide` evaluates C1–C8 over a hash-pinned ledger; external review output is admissible only as non-binding `EXTERNAL_REVIEW` evidence. One decision authority.

**Capability preservation** — all detectors kept: P3 verify, P4 adversarial-qa packs, P5 sequential review, P13/P14, P18 OCR, G0–G5. Merge decision ownership only changed.

**Qualification** — `PROTOCOL_ADOPTION_QUALIFIED` ✓ (37 orchestrator tests + 3 regressions green on the pinned suite; corpus ≥20 with ≥5 root classes; 2 independent sentinel-reviewer records).

**Golden-bug** — all 25 corpus entries status PENDING (execution is the first real-run task, not an adoption blocker).

**Learning proof** — lessons.jsonl seeded CAPTURED; PROMOTED requires original-bug kill + legal controls + sibling hunt + independent qualification (MC13 enforced).

**Isolation proof** — sentinel test passed: two fresh Devin child sessions reviewed the sealed ledger independently, `priorFindingsVisible=false`, each found all 3 planted defects including the withheld sentinel (`reviews/sentinel-*.md`).

**Adoption-run outcome** — `QA_UNVERIFIED` (honest: census/clean-rounds not populated for the adoption run itself; report lists exact unmet clauses). This PR never claims game-level `QA_FIXED_POINT_REACHED`.

**Gaps**
- Golden-bug execution + first real-run census/clean rounds remain (next QA run).
- 2 pre-existing test failures in `npm run verify` (`magick` binary absent in env — files identical to master; P12 env limitation).
- CI on master reports unrelated infra state; this branch adds no new pipeline steps.
