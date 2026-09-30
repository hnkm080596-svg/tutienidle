# Beta environment inventory

Single source of truth for what the beta backend is made of. Every field
is either a verifiable fact in this repo or an explicitly labeled
**EXTERNAL BLOCKER** - unknown values are never filled in with guesses.

Legend:
- `FACT` - verifiable in this repo (commit-visible).
- `UNSEALED` - needs a live read against the project; the `SEAL:` command
  produces it.
- `EXTERNAL` - requires a human/third-party decision or credential the
  repo cannot contain (see plan section 20 EXT queue). The owner column
  says who unblocks it.

## 1. Projects

| env | ref (non-secret) | label | purpose | owner |
| --- | --- | --- | --- | --- |
| developer-local | per-dev | `development` | individual contract runs | each dev |
| staging/beta | `EXTERNAL` (EXT-01: coordinator publishes the ref in ops channel; never commit the URL+key together) | `staging` or `beta` | the closed-beta project players will hit | `EXTERNAL` backend owner (EXT-01) |
| restore-drill | `EXTERNAL` (EXT-01/EXT-07: an isolated project for restore drills) | `restore` | isolated project used ONLY for restore verification; torn down or re-isolated after each drill | `EXTERNAL` backend owner |
| disposable | any | `disposable` | throwaway scratch projects | each dev |

`SUPABASE_TARGET_LABEL` in the env file pins the label. The ops scripts
refuse to mutate anything whose label is unset or not in
`{development, staging, beta, restore, disposable}`.

## 2. Credentials map (what exists, never the values)

| name | where it lives | grants | rotation owner |
| --- | --- | --- | --- |
| `SUPABASE_URL` | `game/.env.supabase.contract` (gitignored), CI secret | project identity, non-secret | n/a |
| `SUPABASE_ANON_KEY` | same + app env `VITE_SUPABASE_ANON_KEY` | `anon` API role; safe to ship in the client | `EXTERNAL` (EXT-09 credential upgrade) |
| `SUPABASE_DB_URL` | `game/.env.supabase.contract` only | direct postgres (postgres role) - full DDL+DML | `EXTERNAL` (EXT-01) |
| `SUPABASE_FRESH_DB_NAME` | env file | scratch db name for fresh-install runs (default `contract_fresh`) | n/a |
| `SUPABASE_TARGET_LABEL` | env file | safety label used by `scripts/operations/lib.mjs` | operator |
| service-role key | `EXTERNAL` (must NOT be in the repo, the client bundle, or CI artifacts; EXT-01 owner decides where it lives) | bypasses RLS entirely | `EXTERNAL` |
| `BACKUP_PASSPHRASE_FILE` | operator machine only (path to a file containing the AES-256 passphrase) | encrypts `backup-export` artifacts | `EXTERNAL` (EXT-07) |

If any credential value is ever found in the repo, CI logs, client
bundles, or an evidence bundle: treat as a leaked-key incident
(`incident-response.md`, scenario 3).

## 3. Schema inventory

Migration files (path `game/supabase/migrations/`), ledgered by the
contract runner into `supabase_migrations.schema_migrations`. sha256 of
the file contents as committed:

| version_file | sha256 |
| --- | --- |
| `202608240001_online_auth_character.sql` | `294ccfcbcbaf286a8d200e8f5c25b43a540870d4c84fc50067f99e83a7551e8a` |
| `202609240001_beta_creation_character_pick.sql` | `e657c8507fba49b5ec4d5bf0f7e57763dacb985482b5de228484f0df22861df9` |
| `202609290001_character_saves_server_timestamp.sql` | `6e255c0b34eb90531eeac9c9edc8198c6c43761e232af2aaf8cffbe0178f41ad` |
| `202609300001_beta_authority_prepare.sql` | `891f1cd98c34aa27d39c3e0c0bfed384a5acc06624f1f98a6ab149f7230e2259` |
| `202609300002_beta_authority_cutover.sql` | `3091c784a767a7dfb545b3766b370f3092670250d9adc9c8494cdfc7a96bc4e2` |

Recompute locally: `sha256sum supabase/migrations/*.sql`. Verify the
target has applied exactly these:
`SEAL: node scripts/operations/migration-ledger.mjs --target <ref>`

Live-project applied state: `UNSEALED` (requires EXT-01).

## 4. Client <-> schema contract

| constant | value | source |
| --- | --- | --- |
| `CURRENT_SAVE_VERSION` | `87` | `src/services/save/saveVersion.ts` |
| `CLIENT_PROTOCOL_VERSION` | `1` | `src/services/session/BackendStatus.ts` |
| accepted save schemas | `backend_config.acceptedSaveSchemaVersions = [87]` (migration-seeded) | `202609300001_beta_authority_prepare.sql` |
| protocol versions | `protocolVersion = 1`, `supportedProtocolVersions = [1]` | same |
| `maxSavePayloadBytes` | `4194304` (4 MiB) | `backend_config.limits` |
| `maxDeviceLabelChars` / `maxBuildIdChars` | `160` / `64` | same |
| `checkpointLeaseSeconds` | `604800` (7d) | same |
| `receiptRetentionDays` | `7` (floor enforced by `prune-jobs.mjs`) | same |
| `elapsedGraceMs` / `maxElapsedMonotonicMs` | `300000` / `691200000` | same |

Public RPC surface post-cutover (granted to `authenticated` only; `anon`
and `public` have no execute anywhere - `restore-verify.mjs` asserts this):

`claim_active_session(text,integer,text)`, `create_character(uuid,uuid,text,text[],text)`,
`load_game_state(uuid)`, `write_character_save(uuid,bigint,integer,jsonb,text,uuid,jsonb)`,
`heartbeat_session(uuid)`, `revoke_current_session(uuid)`,
`beta_contract_phase()`, `get_backend_status()`.

Internal helpers revoked from all API roles: `_lock_caller_profile`,
`_assert_session_locked`, `_assert_session_protocol`, `_issue_checkpoint`,
`_classify_save_row`, `_check_save_payload`.

Server reject codes the client must surface (taxonomy in
`src/services/session/BackendStatus.ts`): AUTH_REQUIRED, PROFILE_MISSING,
session revoked (`28000`), SESSION_PROTOCOL_OUTDATED, MAINTENANCE_MODE,
PROTOCOL_UNSUPPORTED, BUILD_ID_INVALID, DEVICE_LABEL_INVALID,
CHARACTER_EXISTS, INVALID_TALENT_ROLL, INVALID_TALENT_SELECTION,
CHARACTER_NAME_UNAVAILABLE, INVALID_MORTAL_SKILL, NO_CHARACTER,
CHARACTER_DELETED, SAVE_INVALID, SAVE_TOO_LARGE, SAVE_SCHEMA_UNSUPPORTED,
SAVE_CONFLICT, MUTATION_ID_REUSED, CHECKPOINT_REQUIRED,
CHECKPOINT_INVALID, CHECKPOINT_OFFSET_OUT_OF_BOUNDS, CUTOFF_REGRESSION.

## 5. Provider plan quotas

`EXTERNAL` (EXT-01): the Supabase plan tier, database size limit,
connection limits, egress budget, and the alerting thresholds the
coordinator sets in the Supabase dashboard cannot be read from the repo.
Until sealed, the health doc treats quota breach detection as manual.

What the repo CAN assert (used by `health-and-quota.md`):

| measure | source | expectation |
| --- | --- | --- |
| `pg_database_size(oid)` vs plan | `UNSEALED` SEAL: see `health-and-quota.md` canary | below plan ceiling |
| `save_mutation_receipts` growth/day | `UNSEALED` SEAL: `save-inventory.mjs` + `backend-status.mjs` | prune keeps < retention+margin |
| `time_checkpoints` expired share | `UNSEALED` | prune daily |
| active sessions / claim rate | `UNSEALED` | within plan conn limits |

## 6. Backups & retention

| item | state | owner |
| --- | --- | --- |
| Supabase managed backups (PITR/daily) | `EXTERNAL` (EXT-07): plan-dependent; coordinator records what the plan actually provides | EXT-07 backup operator |
| operator-encrypted export (`backup-export.mjs`) | procedure written, `UNSEALED` until first authorized run | EXT-07 |
| restore target | the isolated `restore` project above | EXT-01/EXT-07 |
| evidence archive location | `EXTERNAL` (EXT-07): where sealed bundles are stored immutably | EXT-07 |

## 7. Alerts & escalation

| alert | source of truth | state |
| --- | --- | --- |
| quota/size alarms | Supabase dashboard | `EXTERNAL` (EXT-01 owner configures; thresholds recorded here once set) |
| migration applied-state drift | `migration-ledger.mjs` in canary | scripted (see health doc) |
| contract phase != cutover | `backend-status.mjs` | scripted |
| daily prune ran | `prune-jobs.mjs --dry-run` output in canary log | scripted, scheduling `EXTERNAL` (EXT-01) |

Named owners: **all owner cells marked `EXTERNAL` are unfilled on
purpose** - assigning them is EXT-01/EXT-07 coordinator work. Do not
substitute GitHub usernames here; the coordinator fills real names in the
sealed copy.
