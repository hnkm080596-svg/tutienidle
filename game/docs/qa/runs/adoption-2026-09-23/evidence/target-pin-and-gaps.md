# Task 1.1 + 1.4 — target revalidation, capability gaps

## Target pin (revalidated 2026-09-23, this session)

- `origin/master` @ `7808caba` — adoption branch `devin/1790167292-internal-qa` bases on it (coordinator ruling).
- Integration branch `p7/truc-co` holds ~100 commits of merged mission PRs atop master; PR #16 (draft p7/truc-co→master) open. Mission code is NOT on master → census/attack docs scope to what master contains; the branch split is recorded here per contract.
- PR #1 (C2C transport tooling) on master is historical — marked non-binding, not deleted.
- `CURRENT_SAVE_VERSION=80` on p7/truc-co (v74 on master); save-policy unchanged by this adoption.
- Audit SHAs in the design pack were confirmed stale; the pin above is the binding state.

## Capability gaps (old model → new model)

| Old external capability | Internal replacement | Status |
|---|---|---|
| Fresh reviewer eyes with no context bleed | Devin child sessions, sealed results, attestation fields | Qualified by sentinel test (reviews/sentinel-isolation-results.md) |
| Independent verdict authority | Terminal predicate C1-C8 + MC1-MC13 machine checks | Implemented in runner |
| Sequential review discipline | CYCLE record + previousPhaseReviewId chain | Implemented |
| Finding→repair→close workflow | finding lifecycle OBSERVED→…→CLOSED with 8-condition gate | Implemented |
| Coverage accounting | coverage matrix per invariant×surface | Implemented |
| Escapes feeding learning | corpus/index.json + learning/history + promotion gate | Implemented, seeded |
| Mutation qualification | mutation records + KILLED_EXPECTED requirement | Implemented |

## Known honest gaps (carried to handoff report)

1. The seeded lessons are CAPTURED (history), not PROMOTED — no promotion campaign has run yet; that is correct, promotion requires kill+controls+sibling-hunt+independent qualification.
2. Golden corpus entries are PENDING — they are loaded for replay but the adoption run does not replay them against mission code absent from master. GB statuses are recorded honestly as PENDING, not measured.
3. Internal reviewer isolation is proven via the sentinel test; on orgs/platforms where child sessions are unavailable, the ledger cannot claim independence and outcomes degrade to QA_UNVERIFIED.
4. `qa:internal qualify` runs the runner's own tests + corpus-shape checks; it is a qualification gate for the runner, not a claim the GAME reached fixed point.
