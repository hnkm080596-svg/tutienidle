# QA Review: beta-final PR7 (B1-F cutover + contract-matrix specs)

- Date: 2026-09-30
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths:
  `game/tests/integration/supabase/cutover.spec.ts` (new),
  `game/tests/integration/supabase/journal-harness.ts` (new),
  `game/tests/integration/supabase/authority.spec.ts`,
  `game/tests/integration/supabase/fixture.ts`,
  `game/tests/integration/supabase/guest-upgrade.spec.ts`,
  `game/docs/operations/beta/backend-cutover.md`,
  `game/src/services/cloudSave/BOUNDS.md`,
  `game/docs/qa/runs/beta-final-b1/cell-inventory.md`

## Scope and Risk Map

Mapper: domain `save-and-cloud`, `deepAuditCandidate: true` (the BOUNDS.md
path sits inside `src/services/cloudSave/`). Deep escalation declined with
recorded reasoning: the diff changes zero production code — the save/cloud
critical boundary is documented and spec'd, not modified. Material risk is
confidently bounded to three classes: (a) spec cells that cannot observe
what they claim (silent-pass / trivially-true assertions), (b) docs that
misstate the operator contract, (c) extraction drift between authority.spec
and the shared harness. One-hop consumers (boot/recovery surfaces) are
unaffected: no runtime behavior changed.

Attack surface for a spec-only diff is the specs themselves: do they prove
the matrix cells claim? Per QA-2026-09-13-001 (real call signature law) the
cells drive the real RPC surface and real client modules, not restated
production logic.

## Invariant Ledger

| invariant | check | result |
| --- | --- | --- |
| Every matrix cell is executable (not doc-only) | `playwright --list` collects 44 tests | holds |
| No cell silently passes | phase gating via `test.skip(cond, reason)` — visible skip; zero `if(phase)return` | holds |
| Server facts asserted match migration source | check order, codes, bounds re-verified against `202609300001-3` SQL | holds (1 spec defect found + fixed) |
| Attack principals are ordinary JWTs | pg client only seeds/asserts rows + `sqlAsUser` for legacy-path probes | holds |
| No secrets/connection strings committed | grep diff for `supabase.co` literals, URIs, JWT material | clean |
| ASCII-only code comments | `grep -P '[^\x00-\x7F]'` on new .ts files | clean |
| Harness extraction preserves semantics | authority.spec diff = verbatim move, signatures parameterized | holds |
| Launch admission gate untouched | `backendMode.ts`, `roadmap.md` not in diff | holds |
| Env-gated cells honestly reported | cell-inventory labels every cell env-gated vs phase-skipped | holds |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx tsc -b tsconfig.tests.json` | clean, exit 0 | full test-project type-check |
| `npx playwright test --config playwright.supabase.config.ts --list` | 44 tests collected | collection parse, no env needed |
| `npx vitest run src/services/cloudSave src/services/backend src/services/save tests/unit/services` | 610 passed | scoped P3 |
| `npm run verify` | 1 flake / then green (see pre-existing) | full P3 |
| `ocr delegate preview/rule` + manual review | 5/5 files reviewed, coverage 100% | 1 Medium spec defect found and fixed |
| Migration SQL re-read (check order, bounds, codes) | assertions match source | `_assert_session_protocol` 28000, `CHECKPOINT_OFFSET_OUT_OF_BOUNDS` on `elapsed<0`, `maxBuildIdChars=64`, safe-int ceiling 2^53-1, receipt digest-before-CAS |
| Supabase credentials for live execution | NOT PROVISIONED to this worker | all live cells env-gated for coordinator |

## Findings

### QA-2026-09-30-1: negative elapsed formula would reject at runtime (fixed in-diff)
- Severity: Medium (spec defect — the cells would have failed for the wrong reason on staging)
- Status: Confirmed → fixed; evidence = migration SQL `v_elapsed < 0` →
  `CHECKPOINT_OFFSET_OUT_OF_BOUNDS` (write_character_save bounds block)
- Invariant: asserted behavior must be reachable under the real contract
- Actual defect (pre-fix): two cells derived
  `elapsed = prevCutoff - freshAnchor + 1_000`; when the fresh anchor postdates
  the previous cutoff by >1s the offset goes negative and the write rejects
  before exercising the intended path
- Fix: replaced with a bounded constant offset (`60_000`, always inside
  `elapsedGraceMs` and past prior cutoff since every anchor is fresher than
  its predecessor's cutoff)
- Test file: `tests/integration/supabase/cutover.spec.ts`
- Owner subsystem: test-only (no production surface)

### QA-2026-09-30-2: staging execution unavailable in this worktree
- Severity: n/a — environment, not a defect
- Status: Coverage gap (declared): no `SUPABASE_STAGING_*` env present
  (verified `env | grep -i supabase` empty); `.env.supabase.contract` cannot
  be written here
- Evidence kind: `Not verified` for live execution; the coordinator staging
  run owns it (`npm run test:supabase` or targeted playwright command in
  `cell-inventory.md`)
- Why not blocking this verdict: every cell compiles, collects, and its
  asserted contract facts were re-verified against migration source; the
  24 authority cells it extends were green on the same staging project at
  PR2-PR6

### QA-2026-09-30-3: clock cell depends on VM-vs-server clock alignment
- Severity: Low
- Status: Suspected residual — the skewed-commit claim derives
  `elapsed = localNow - anchor + 60_000`; if the runner's clock leads the
  Supabase server by >240s the write legitimately rejects and the cell
  flakes for environmental, not contract, reasons
- Bounded by the 300s grace; a healthy runner skew is seconds
- No fix taken: tightening further would weaken the skew assertion itself

### QA-2026-09-30-4: token-refresh reuse path is two-sided
- Severity: Low
- Status: Coverage gap, honest — GoTrue returns either a fresh same-user
  pair (200) or rejects a spent refresh token (>=400); both are asserted.
  The cell cannot distinguish "rotation allowed by policy" from
  "reuse-detection off" without a second user's token — recorded, not hidden

## New or Changed QA Tests

- `cutover.spec.ts` — 16 cells: 6 matrix (3 phase-skipped on staging,
  3 cutover-executing), 4 two-device, 1 forged, 3 crash-replay, 1 refresh,
  1 clock, 1 guest. Each asserts observable server state (rows, receipts,
  revisions, response codes), not implementation details.
- `journal-harness.ts` — shared real-module harness (service + journal +
  cache over one Storage) consumed by authority.spec and cutover.spec.
- `authority.spec.ts` — extraction only; zero assertions weakened (diff
  reviewed line-by-line).
- `guest-upgrade.spec.ts` — local `setEmailConfirmed` deduplicated into the
  shared `confirmEmailIdentity` fixture helper (identical SQL).
- `fixture.ts` — added `confirmEmailIdentity` (EXT-09 post-confirm state)
  and `signupAnonymousWithRefresh` (refresh-pair signup).

## Gaps and Residual Risk

- Live execution gap as recorded (QA-2026-09-30-2): the staging run may
  surface assertion details migration-source reading cannot — e.g. PostgREST
  error shapes for `rest()` denials already accept `>=400`-or-empty-200 to
  stay robust.
- `sqlAsUser`-driven legacy cells assume the retired overloads accept the
  runner's proven arg order; they re-execute only on a legacy/prepare
  project where that surface still exists.
- The runbook's step-6 canary describes the probe but cannot ship a canned
  command — it needs the operator's credential store by design (evidence
  rule forbids committing it).

## Pre-existing Failures

- `src/services/character/initializeCharacter.test.ts` flaked once in the
  full verify (`lastSavedAt` 1ms boundary race — 1790737341712 vs
  ...713 in recorded mock calls). Re-run of the same file: 5/5 green.
  Untouched by this diff; pre-existing timing flake, `Flaky` evidence
  label, not a task finding.
