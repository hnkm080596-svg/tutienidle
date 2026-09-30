# B1-F cell inventory — compatibility matrix + adversarial cells

Every cell is an executable spec: `npx playwright test --config
playwright.supabase.config.ts` from `game/` with `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, `SUPABASE_DB_URL` sourced (env contract:
`scripts/supabase/contract.env.example`). Attack principals are ordinary
`authenticated` JWTs; the operator pg connection only seeds/asserts.

Two run states are honest, never conflated:

- **executed** — the spec ran to an assertion on a live project.
- **env-gated** — authored + collected (verified via
  `npx playwright test --config playwright.supabase.config.ts --list`), but
  not executed in this worktree: no staging credentials were provisioned to
  the PR7 worker. The coordinator staging run owns execution.
- **phase-skipped** — a matrix cell whose phase the target project already
  passed reports a visible `test.skip(condition, reason)` (staging sits at
  `cutover`; the legacy/prepare cells re-execute against any project still
  in that phase).

## Matrix cells (`tests/integration/supabase/cutover.spec.ts`)

| cell | spec name | staging status |
| --- | --- | --- |
| legacy x legacy client | `matrix [legacy x legacy client]` | phase-skip on cutover (proven at first apply by the runner's legacy probes); env-gated |
| prepare x legacy client | `matrix [prepare x legacy client]` | phase-skip on cutover; env-gated |
| prepare x contract client | `matrix [prepare x contract client]` | phase-skip on cutover; env-gated |
| cutover x legacy client (server denial) | `matrix [cutover x legacy client]` | executes on staging; env-gated for coordinator |
| cutover x contract client (eligible) | `matrix [cutover x contract client]` | executes on staging; env-gated for coordinator |
| retained legacy JWT/session x cutover | `matrix [retained legacy JWT/session x cutover]` | executes on staging; env-gated for coordinator |

## Two-device + adversarial cells (`cutover.spec.ts`)

| cell | spec name | staging status |
| --- | --- | --- |
| claim order A-then-B | `two-device [claim A then B]` | env-gated for coordinator |
| claim order B-then-A | `two-device [claim B then A]` | env-gated for coordinator |
| concurrent CAS one-wins | `two-device [same-revision race]` | env-gated for coordinator |
| foreign session theft | `two-device [foreign session theft]` | env-gated for coordinator |
| forged RPC inputs | `forged: malformed and forged write/claim inputs` | env-gated for coordinator |
| journal crash: pending record replays once | `crash replay [journal written, transport never reached]` | env-gated for coordinator |
| journal crash: post-ACK/pre-clear drains | `crash replay [ACK received, journal clear never ran]` | env-gated for coordinator |
| journal crash: no record, no replay | `crash replay [no journal record]` | env-gated for coordinator |
| token refresh mid-flight | `auth: token refresh mid-flight` | env-gated for coordinator |
| clock skew bounded + first-save/no-tick | `clock: skewed client timestamps` | env-gated for coordinator |
| guest restart + upgrade finalize replay | `guest: restart keeps the same account` | env-gated for coordinator |

## Existing authority cells re-verified by the same run

All 24 cells in `tests/integration/supabase/authority.spec.ts` (sessions,
locks, receipts, payload, checkpoints, load lifecycle, legacy-session guards,
direct-write attacks, journal/coordinator) run unchanged in the same suite —
the PR7 refactor extracted their shared journal machinery into
`journal-harness.ts` only; `guest-upgrade.spec.ts` (3 cells) likewise.

## Coordinator execution command

```sh
cd game
# write .env.supabase.contract from the staging credential store (gitignored)
npm run test:supabase          # migration-ledgered end-to-end run
# or targeted:
set -a && source .env.supabase.contract && set +a
npx playwright test --config playwright.supabase.config.ts cutover.spec.ts
```

Expected on staging (`phase = cutover`): every cutover/two-device/forged/
crash/auth/clock/guest cell executes; the three legacy/prepare cells report
their recorded `test.skip` reasons.
