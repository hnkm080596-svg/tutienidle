# B1-F launch-admission record (PR7)

The release admission block stays in place
(`src/services/backend/backendMode.ts`: `admission: runtime === 'release' ?
'blocked' : 'admitted'`). This file records the exact artifacts the lift
criteria bind to — it changes nothing by itself.

## Client code SHA (last code-touching commit)

```
bff7b94b0a8fda25a4d1b1846b6b177ab567027f
```

Branch `beta-final/pr7-cutover` tip at record time. Evidence-only commits
may follow this SHA on the same branch without changing the client surface;
the binding SHA for a lift decision is the final sealed RC commit produced
at PR15, which must descend from this line.

## Backend migration hashes (sha256 of the applied files)

```
891f1cd98c34aa27d39c3e0c0bfed384a5acc06624f1f98a6ab149f7230e2259  supabase/migrations/202609300001_beta_authority_prepare.sql
3091c784a767a7dfb545b3766b370f3092670250d9adc9c8494cdfc7a96bc4e2  supabase/migrations/202609300002_beta_authority_cutover.sql
98256cef43745c6c2e2a917593ce153eeacf7fab4391e3b94bde18271e048c07  supabase/migrations/202609300003_beta_guest_finalize.sql
```

These are the hashes of the migration *files* in this checkout — the same
three versions ledgered into `supabase_migrations.schema_migrations` on the
staging project. Any edit to a migration file changes its hash and must
re-run the full contract suite before it can bind to a lift decision.

## Gate-lift criteria (all must hold, in order)

| # | criterion | state at PR7 |
| --- | --- | --- |
| 1 | Staging contract suite green at `cutover` phase — every executable cell in `cell-inventory.md` executed, not skipped | coordinator staging run pending (env-gated: no creds in the PR7 worktree) |
| 2 | Beta project cutover sealed — runbook `docs/operations/beta/backend-cutover.md` steps 0-8 executed under deployment authority, step-5 checklist green | **UNSEALED** — no beta DB deployment authority provisioned |
| 3 | EXT-05 device-level two-device proof — two real installed builds on the beta project exercising claim steal + CAS | pending (requires shipped binaries) |
| 4 | Signed release candidate at PR15 | pending |

Only when all four hold does `admission: 'blocked'` get lifted — and only
by the sealing PR, never in this one.

## Evidence integrity

- No credentials, connection strings, project URLs, or JWTs appear in this
  evidence dir or anywhere in the diff.
- Staging rehearsal state at record time: migrations 001-003 applied,
  `beta_contract_phase() = 'cutover'`; beta project untouched.
- The compatibility matrix + adversarial cells that constitute criterion 1
  are inventory'd in `cell-inventory.md` with per-cell gating status.
