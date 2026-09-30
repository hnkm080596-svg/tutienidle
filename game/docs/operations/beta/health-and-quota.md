# Beta health & quota

Two procedures:

1. the **daily canary** - read-only probes that prove the backend is in
   the expected contract state;
2. the **control rehearsal** - periodic proof that the operator levers
   (`backend_config`) actually steer the live surface, performed on
   staging before beta and after any migration touching the contract.

Everything gated on a live project is **UNSEALED** until EXT-01 closes.
Run every command from `game/` with `.env.supabase.contract` present and
`SUPABASE_TARGET_LABEL` set.

## 1. Daily canary (read-only)

```sh
node scripts/operations/backend-status.mjs  --target <ref>
node scripts/operations/migration-ledger.mjs --target <ref>
node scripts/operations/save-inventory.mjs  --target <ref>
node scripts/operations/prune-jobs.mjs      --target <ref> --dry-run
```

Expected values (the contract the canary asserts):

| field | expected | if wrong |
| --- | --- | --- |
| `contractPhase` | `cutover` | someone flipped `backend_config.contractPhase` by hand or a migration is missing - do NOT re-flip; investigate per `incident-response.md` scenario 1 |
| `backend_config.maintenance.enabled` | `false` unless a declared maintenance window is live | unset it only after confirming who set it (`backend-config.mjs set maintenance '{"enabled":false}'`) |
| `minClientVersion` / `supportedClientVersions` | the values published in the last release note; absent = no floor enforced | compare with the release doc; drift = unplanned config change |
| `migrations` | exactly the 5 files in `environments.md` section 3, in order, `applied` | `pending` = unapplied migration; `extra-in-target` = someone applied SQL outside the repo - stop and escalate |
| `rpc_surface` (all `has_function_privilege`) | every public RPC `true` for `authenticated`; `anon_status` false; `helper_exposed` false | grant drift = contract violation; never re-grant by hand, escalate |
| `table_access` | `saves_select`/`receipts_select`/`checkpoints_select`/`config_select` all false; `direct_save_policies = 0` | a non-zero value means the authority wall reopened - treat as scenario-1 incident |
| `sessions.active` | monotonically plausible vs beta population | a sudden drop to 0 during a window = mass revocation or outage |
| `save_classes` | all rows `ready` or a known-remediation class | new `owner-mismatch`/`incompatible-schema` growth = client/server contract drift |
| `prune-jobs --dry-run` | receipts/checkpoints pruned to expected counts; receipt floor `>= 7` days | if candidates explode, the scheduled prune is not running - check the operator cron |

SEAL: run the four commands above against staging, archive the `--json`
outputs in an evidence bundle (`evidence-template.md`).

Manual quota reads (until dashboard alerts exist - EXT-01):

```sql
select pg_size_pretty(pg_database_size(oid)) as db_size
  from pg_database where datname = current_database();
select count(*) from pg_stat_activity where datname = current_database();
```

`UNSEALED`: plan ceiling numbers (db size, connections, egress) - the
coordinator records them in `environments.md` section 5 once EXT-01
closes. Do not invent thresholds; until then "quota breach" is judged by
Supabase dashboard warnings, not this doc.

## 2. Control rehearsal (staging only)

Purpose: prove that the levers the beta will use in anger actually work,
and that the client sees the advertised surface. The levers are all
`backend_config` keys read by `get_backend_status()` (the client polls
it) plus the guards inside the RPCs.

Prerequisite: staging project, no beta players, a second operator
watching `get_backend_status()` output.

```sql
-- second-operator view of what clients see:
select public.get_backend_status();
```

### 2a. Maintenance mode

```sh
# dry-run first - shows current + would-be value, no write
node scripts/operations/backend-config.mjs --target <ref> set maintenance '{"enabled":true,"message":"rehearsal"}' --dry-run
# apply (mutating: requires label match + flag)
node scripts/operations/backend-config.mjs --target <ref> set maintenance '{"enabled":true,"message":"rehearsal"}' --yes-i-mean-it
```

Expected: new `claim_active_session` calls return `MAINTENANCE_MODE`;
`get_backend_status()` reports `maintenance.enabled=true` and the
message; already-claimed sessions keep heartbeating (the guard is at
claim time). Revert:

```sh
node scripts/operations/backend-config.mjs --target <ref> set maintenance '{"enabled":false}' --yes-i-mean-it
```

Abort criteria: if reverted clients still see maintenance, or claimed
sessions start failing heartbeats, capture `backend-status --json` and
escalate - the lever is not the only gate.

### 2b. Client floor (`minClientVersion` / `supportedClientVersions`)

These keys are read by `get_backend_status()` via `coalesce` - clients
below the floor surface `PROTOCOL_OUTDATED`/`MAINTENANCE`-class failures
by design (see `compatibility-and-rollback.md`).

```sh
node scripts/operations/backend-config.mjs --target <ref> set minClientVersion '"0.0.0-rehearsal"' --dry-run
node scripts/operations/backend-config.mjs --target <ref> set minClientVersion '"0.0.0-rehearsal"' --yes-i-mean-it
node scripts/operations/backend-config.mjs --target <ref> set supportedClientVersions '["0.1.0-beta.0","0.0.0-rehearsal"]' --yes-i-mean-it
```

Expected: `get_backend_status()` reflects both keys; a client reporting
a version below the floor gets the outdated-client surface (the exact
client behavior is the PR2 client contract - verify against the running
build, not this doc). Revert to the release doc's published values.

### 2c. Save-schema / protocol acceptance

`acceptedSaveSchemaVersions` and `supportedProtocolVersions` are real
guards inside `write_character_save` / `_assert_session_protocol` - a
wrong edit bricks writes. Rehearse ONLY the dry-run path; a live change
of these keys outside a migration is a scenario-1 incident, not a
rehearsal item.

```sh
node scripts/operations/backend-config.mjs --target <ref> set acceptedSaveSchemaVersions '[87]' --dry-run
```

### 2d. Session freeze/revoke (recovery posture)

The same lever used during restore/recovery and incident lockdown:

```sh
# count candidates, touch nothing
node scripts/operations/revoke-sessions.mjs --target <ref> --all --dry-run
node scripts/operations/revoke-sessions.mjs --target <ref> --user <uuid> --dry-run
```

A real `--all` revoke is the documented "freeze" in
`backup-restore.md`; rehearse it once on staging with a disposable user
before beta starts (SEAL: record the dry-run + real output in the drill
evidence bundle).

SEAL (whole rehearsal): run 2a + 2b live on staging, capture
`backend-status --json` before/during/after each lever, archive as the
`controls-rehearsal` bundle. Until EXT-01 closes this stays **UNSEALED**.

## 3. Cadence

| check | cadence |
| --- | --- |
| daily canary | every operator day during beta |
| control rehearsal | once before first beta invite; after any migration touching `backend_config` semantics; after any incident that used a lever |
| quota read | daily during beta (dashboard when EXT-01 seals it) |
