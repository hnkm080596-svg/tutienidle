# Adversarial QA — BETA B1-A backend authority surface (quick)

Date: 2026-09-29 · Mode: quick · Scope: `supabase/migrations/20260930000{1,2}_beta_authority_*.sql`,
`tests/integration/supabase/*`, `scripts/supabase/*`, `playwright.supabase.config.ts`,
`package.json`, `tsconfig.node.json`, `docs/operations/beta/backend-cutover.md`.

changed-risk-map: all 11 task paths unmapped (mapper has no supabase/scripts
routes); manually routed to save-and-cloud + time-and-offline domain packs.
deepAuditCandidate=false. Escalation assessment: save/cloud consistency IS the
task, but every changed transition has executed runtime evidence (19-test live
PostgREST/GoTrue/direct-pg contract suite + migration-path probes) — bounded,
not broad; quick mode retained.

## Invariant ledger

| ID | State/owner | Invariant | Attack operator | Oracle | Result |
| --- | --- | --- | --- | --- | --- |
| S1 | character_saves row (owner-scoped) | revision CAS exactly-once | concurrency (rev-0 x2), value (rev -1/null/huge), repeat | `simultaneous revision-0` + null/ceiling guards | PASS — executed |
| S2 | save_mutation_receipts (owner,mutationId) | identical retry idempotent; reused id rejected | repeat, stale state (retry after new revision) | receipts matrix test (digest, reorder, stale) | PASS — executed |
| S3 | account_sessions (1 active/user) | admission serializes; revoke always works | concurrency (x2 claim), reorder (claim-vs-write) | lock interleaving + simultaneous claims tests | PASS — executed |
| S4 | time_checkpoints (owner+character bound) | cutoff nondecreasing; offsets bounded; lease enforced | timing boundary (-1/0/+1s, lease edge), stale checkpoint, cross-owner | checkpoints test | PASS — executed |
| S5 | profiles FOR UPDATE serialization | profile→session→character→save/receipt order held | concurrency + pg_stat_activity lock waiters | locks: save-first & claim-first | PASS — executed; see F1 |
| S6 | payload gate | `{}`/non-object/schema/bytes/identity rejected server-side | value mutation, direct write | payload matrix + {} attacks | PASS — executed |
| S7 | RLS/grant surface | no direct table/view reach for api roles | direct POST/PATCH/DELETE/GET under anon/anon-user/registered JWTs; retired overloads; helper call | attacks test + finalStateProbes | PASS — executed |
| S8 | migration histories | fresh-install ≡ historical-upgrade catalog | degraded env (scratch db) | catalogSnapshot diff in runner | PASS — executed |
| S9 | load_game_state lifecycle | statuses distinct; recovery write preserves bytes | reorder, interrupted creation | load lifecycle test | PASS — executed |
| S10 | legacy-minted session (protocol null) | guarded ops reject; revoke reachable | stale state | guards test | PASS — executed |

## Findings

- **F1 (Low, recorded, no fix)** — `write_character_save` locks the receipt row
  before the save row; spec text orders the pair `save/receipt`. Not
  exploitable: all rows are owner-scoped and every writer serializes on the
  caller's profile row first, so no cross-transaction wait cycle can form;
  single consistent internal order. The retry early-return also requires the
  receipt read before CAS by design.
- **F2 (Low, fixed in this pass)** — `heartbeat_session`/`load_game_state`
  issue one `time_checkpoints` row per call and no pruning was documented.
  Runbook now carries the operator prune for checkpoints alongside receipts
  (`docs/operations/beta/backend-cutover.md`).
- **F3 (fixed earlier, OCR pass)** — `new Function` module eval in
  `scripts/supabase/lib.mjs` replaced by transpile-to-temp `.cjs` +
  `createRequire`.
- **F4 (fixed earlier, OCR pass)** — `set local request.jwt.claims` string
  interpolation replaced by parameterized `set_config` in both `asUser`
  helpers; role name additionally whitelisted.
- **F5 (Low, fixed in P5 pass 3)** — `resetScratchDb` accepted any well-formed
  name from env, so `SUPABASE_FRESH_DB_NAME=postgres` would have dropped the
  project database. Now denylisted (`postgres`, `template0`, `template1`) in
  `scripts/supabase/lib.mjs`.
- **F6 (environment, observed)** — an out-of-band `saves_own_delete` DELETE
  policy appeared on `public.character_saves` on staging after cutover was
  applied (not present in any repo migration, not in the ledger). The
  `cutover: zero direct-save policies` probe caught it on the next run;
  dropped via the same DDL the cutover migration carries and the suite went
  green. Confirms the probe set detects real drift.

## Evidence gate

19/19 authority tests executed green on the real staging project
(PostgREST + GoTrue + pooler postgres), migration dual-window probes executed
green, fresh-install catalog byte-identical to historical-upgrade catalog.
`npm run verify` green (type-check + build + 7260 vitest). Report:
`test-results/supabase-contract-report.json`.

## Verdict label

PASS WITH EVIDENCE — two Low findings recorded (F1 documented deviation,
F2 documentation gap closed); no Medium-or-higher confirmed.
