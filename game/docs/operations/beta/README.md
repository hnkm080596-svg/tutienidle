# Beta operations (B9)

Operator documentation for the Windows Closed Beta backend: the B1-A
transactional Supabase surface, the releases that ride on it, and the
backup/recovery posture that makes the beta supportable.

Beta is only shippable if an operator can answer, without guessing:

- which project am I pointed at, and is it the right one
- is the backend healthy right now, and what is it allowed to do
- can I restore last night's backup into a clean project and prove it
- what do I do when a bad release escapes

## Documents

| doc | use when |
| --- | --- |
| `environments.md` | the environment inventory: refs, migration hashes, contracts, quotas, owners, alerts |
| `health-and-quota.md` | daily canary + the maintenance / client-floor / quota-control rehearsal |
| `backup-restore.md` | exporting an encrypted authorized backup + the restore drill into an isolated project; RPO/RTO |
| `incident-response.md` | tabletop runbooks for failed migration, quota exhaustion, leaked key, cert expiry, broken updater, triage |
| `compatibility-and-rollback.md` | the bad-release exercise: freeze update feed, compat checks, roll-forward-or-reinstall, no auto-downgrade |
| `evidence-template.md` | the immutable evidence bundle every drill and release must produce |
| `backend-cutover.md` | the cutover runbook this directory extends (phase semantics, permission queries, operator procedures) |
| `../asset-cdn.md` | the asset CDN runbook (B5) |

Related documents planned on other tracks (referenced but not forked here):

- `docs/operations/release.md` (PR8) - release channel/promotion procedure
- `docs/operations/signing.md` (PR9) - signing service operation
- `docs/operations/windows-install.md` (PR10) - Windows install/update verification

If those files are not present, treat the corresponding procedures as
owned by their tracks; this directory must not duplicate them.

## Operator scripts

`game/scripts/operations/` holds one script per concrete operator command.
All of them share the same safety contract (see `lib.mjs`):

1. `--target <ref>` is required and must equal the project ref embedded in
   `SUPABASE_URL` (e.g. `https://<ref>.supabase.co`). A mismatch aborts -
   this catches pointing a script at the wrong env file.
2. `SUPABASE_TARGET_LABEL` (in the env file or the process environment)
   labels the project: `development`, `staging`, `beta`, `restore`,
   `disposable`. Anything else - including an unset label - is
   **prod-looking**.
3. Mutating commands refuse prod-looking targets outright and always
   require `--yes-i-mean-it`. Read-only probes warn and continue.
4. Every mutating command supports `--dry-run`: it runs the same
   validation and reports what *would* change, issuing no writes.
5. Env comes from `game/.env.supabase.contract` (gitignored; see
   `scripts/supabase/contract.env.example`) or `--env <file>`.

| script | mutating? | purpose |
| --- | --- | --- |
| `backend-status.mjs` | no | one-shot health probe: phase, config, ledger, grant surface, sessions, save classes |
| `migration-ledger.mjs` | no | diff `supabase_migrations.schema_migrations` vs repo migration files + sha256 |
| `save-inventory.mjs` | no | `save_inventory_compatibility` class counts + non-ready row metadata (never payloads) |
| `backend-config.mjs` | yes (`set`) | show/set the `backend_config` levers: `maintenance`, `minClientVersion`, `supportedClientVersions`, `acceptedSaveSchemaVersions`, `supportedProtocolVersions`, `limits`. `contractPhase` is refused - migration-owned |
| `revoke-sessions.mjs` | yes | revoke sessions by `--user <uuid>` or `--all` (recovery/lockdown) |
| `prune-jobs.mjs` | yes | delete expired `time_checkpoints` + aged `save_mutation_receipts` with the retention floor |
| `backup-export.mjs` | yes (writes artifacts) | `pg_dump` + sha256 + optional `openssl` AES-256 encryption + manifest |
| `restore-verify.mjs` | no | restore-drill acceptance probe: counts, integrity checks, grant surface, FK, ledger |

Tests: `node --test scripts/operations/operations.test.mjs` (unit-level,
no live project needed; every DB call is injected).

## Sealed vs unsealed evidence

Docs here distinguish two evidence states:

- **SEALED** - produced by a real run against the staging/beta project and
  archived per `evidence-template.md`.
- **UNSEALED** - the procedure and the exact seal command are written, but
  no run has happened yet. An UNSEALED item is an open readiness gate,
  never a simulated one. Nothing below is faked; until EXT-01 (Supabase
  envs/access) and EXT-07 (backup operator/storage) close, every
  live-project item stays UNSEALED.

To seal, an operator with `.env.supabase.contract` filled in runs the
commands marked `SEAL:` in each doc, then archives the outputs.

Current status: **all live-project evidence UNSEALED** (no Supabase
credentials in the authoring session).
