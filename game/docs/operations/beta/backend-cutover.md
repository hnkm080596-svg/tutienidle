# Beta backend authority cutover runbook

Scope: the B1-A transactional backend on Supabase — session admission, save
compare-and-swap (CAS), mutation receipts, time checkpoints, and the inventory
view that classifies historical save rows. Two versioned migrations implement
it:

| migration | purpose |
| --- | --- |
| `202609300001_beta_authority_prepare.sql` | additive: `backend_config`, `time_checkpoints`, `save_mutation_receipts`, new columns + bounds checks on `account_sessions`/`character_saves`, owner==character-owner composite FK (`NOT VALID`), guarded RPC set, `save_inventory_compatibility` view |
| `202609300002_beta_authority_cutover.sql` | subtractive: drops direct `character_saves` RLS policies, the retired `claim_active_session(text)` and `create_character(...,jsonb,integer)` overloads, all table/view grants; flips `contractPhase` to `cutover` |

Contract phase is observable: `select public.beta_contract_phase()` returns
`legacy` | `prepare` | `cutover` (driven by `backend_config.contractPhase`).

## Phases

### `legacy` — pre-contract surface
- Clients write `character_saves` directly through `saves_own_*` RLS policies.
- `claim_active_session(text)` (one arg), `create_character(uuid,uuid,text,text[],text,jsonb,integer)` (seven args, fabricates a `{}` save row).
- No receipts, no checkpoints, no revision CAS.

### `prepare` — dual window (both surfaces live)
- New guarded RPCs coexist with the legacy overloads and direct-write policies.
- Historical rows appear in `save_inventory_compatibility` for classification.
- The composite FK already blocks **new** cross-owner save writes; pre-existing
  drift stays visible via the view until remediated.

### `cutover` — authority only
- `character_saves`, `save_mutation_receipts`, `time_checkpoints`,
  `backend_config`, `save_inventory_compatibility`: no table/view grants for
  `public`, `anon`, `authenticated`, `service_role`.
- Public surface is exactly: `claim_active_session(text,integer,text)`,
  `create_character(uuid,uuid,text,text[],text)`, `load_game_state(uuid)`,
  `write_character_save(uuid,bigint,integer,jsonb,text,uuid,jsonb)`,
  `heartbeat_session(uuid)`, `revoke_current_session(uuid)`,
  `get_backend_status()` — all `authenticated` only.
- Internal helpers (`_lock_caller_profile`, `_assert_session_locked`,
  `_assert_session_protocol`, `_issue_checkpoint`, `_classify_save_row`,
  `_check_save_payload`) are revoked from every API role and pinned
  `search_path`.

## Client / schema compatibility matrix

| client era | schema `legacy` | schema `prepare` | schema `cutover` |
| --- | --- | --- | --- |
| Legacy client (direct table writes, 1-arg claim, 7-arg create) | works | works (dual window) | **broken**: table grants + overloads gone — direct writes denied, old RPC signatures 404 |
| Contract client (versioned claim, metadata create, CAS write) | n/a (functions absent) | works | works (target state) |
| Contract client, old `protocol_version` | — | `SESSION_PROTOCOL_OUTDATED` on guarded ops until re-claim; `revoke_current_session` always reachable | same |
| Any client, wrong/absent session | — | `28000` raised (`session revoked` / `AUTH_REQUIRED`) | same |
| Any client, `{}`/invalid save payload | persisted unchecked | rejected (`SAVE_EMPTY`/`SAVE_*` codes) | rejected |

`load_game_state` contract statuses: `NO_CHARACTER`, `UNINITIALIZED`,
`INCOMPATIBLE`, `SAVE_READY`, `CHARACTER_DELETED`. `INCOMPATIBLE` and
`UNINITIALIZED` both accept a recovery write at `expectedRevision =
currentRevision` — bytes of unknown rows are never destroyed by the write path
itself; classification happens in the view, not on write.

## Save inventory classification (`save_inventory_compatibility`)

| class | meaning | recovery write? |
| --- | --- | --- |
| `uninitialized` | character without a save row | yes, expected rev 0 |
| `invalid-payload` | non-object payload | yes, at current revision |
| `empty-payload` | legacy fabricated `{}` row | yes, at current revision |
| `owner-mismatch` | `user_id` != character owner (pre-FK drift) | repair per-row first |
| `incompatible-schema` | `schema_version` not in `acceptedSaveSchemaVersions` | yes, at current revision |
| `version-mismatch` | `payload.version` != `schema_version` | yes, at current revision |
| `invalid-shape` | missing `player` object | yes, at current revision |
| `ready` | canonical | normal CAS |

## Phase permission queries (operator runbook)

```sql
-- current phase
select public.beta_contract_phase();

-- dual window still open? (prepare => non-zero)
select count(*) from pg_policies
 where schemaname='public' and tablename='character_saves';

-- retired overloads present? (cutover => both null)
select to_regprocedure('public.claim_active_session(text)') is not null as legacy_claim,
       to_regprocedure('public.create_character(uuid,uuid,text,text[],text,jsonb,integer)') is not null as legacy_create;

-- table/view grants closed? (cutover => all false)
select has_table_privilege('authenticated', 'public.character_saves', 'select') as saves,
       has_table_privilege('authenticated', 'public.save_mutation_receipts', 'select') as receipts,
       has_table_privilege('authenticated', 'public.time_checkpoints', 'select') as checkpoints,
       has_table_privilege('authenticated', 'public.backend_config', 'select') as config,
       has_table_privilege('authenticated', 'public.save_inventory_compatibility', 'select') as view_;

-- RPC surface: exact grant check (cutover => all true)
select has_function_privilege('authenticated', 'public.claim_active_session(text,integer,text)', 'execute') as claim,
       has_function_privilege('authenticated', 'public.load_game_state(uuid)', 'execute') as load,
       has_function_privilege('authenticated', 'public.write_character_save(uuid,bigint,integer,jsonb,text,uuid,jsonb)', 'execute') as write,
       has_function_privilege('authenticated', 'public.heartbeat_session(uuid)', 'execute') as hb,
       has_function_privilege('authenticated', 'public.revoke_current_session(uuid)', 'execute') as revoke,
       has_function_privilege('authenticated', 'public.get_backend_status()', 'execute') as status,
       has_function_privilege('authenticated', 'public.create_character(uuid,uuid,text,text[],text)', 'execute') as create,
       has_function_privilege('anon', 'public.load_game_state(uuid)', 'execute') = false as anon_denied;

-- every definer function pins search_path (=> 0)
select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prosecdef
   and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path%';
```

## Operator procedures

- **Receipt pruning** is an operator job, never client-triggered. Rows older
  than `backend_config.limits.receiptRetentionDays` (7-day minimum) may be
  deleted via direct postgres only:
  ```sql
  delete from public.save_mutation_receipts
   where created_at < now() - make_interval(days => 7);
  ```
  Expired/aged receipts never relax CAS — receipt identity is per
  `(owner_user_id, mutation_id)`, and the digest check replays the original
  fingerprint before any row mutation.
- **Checkpoint pruning** is likewise operator-only. `load_game_state` and
  `heartbeat_session` issue a row per call; expired rows are dead weight:
  ```sql
  delete from public.time_checkpoints
   where lease_expires_at < now() - interval '1 day';
  ```
  Run both prunes on the same daily operator cadence (a cron against the
  direct connection, or Supabase scheduled job if enabled).
- **Session recovery** for a stuck client: `revoke_current_session` works for
  every session row the caller owns regardless of protocol vintage.
- **Maintenance lever**: `backend_config.maintenance = {"enabled":true}` blocks
  new claims (`MAINTENANCE_MODE`) while admitted sessions keep working.
- **Inventory triage**: rows classified `owner-mismatch` need manual repair
  (reassign `user_id` to the character owner or archive); everything else is
  recoverable by the client at its current revision.
- **Operator scripts** (`game/scripts/operations/`, added by the B9 ops
  track) wrap the procedures above behind the shared target-safety
  contract: `--target <ref>` must equal the `SUPABASE_URL` ref,
  `SUPABASE_TARGET_LABEL` must be a non-prod label, mutating commands
  need `--yes-i-mean-it`, and every mutation has `--dry-run`:
  - `backend-status.mjs` runs the phase permission queries in one probe
    (phase, config, ledger summary, grant surface, sessions, save
    classes);
  - `migration-ledger.mjs` diffs `supabase_migrations.schema_migrations`
    against the repo files incl. sha256;
  - `save-inventory.mjs` reports the classification table (metadata
    only - it never selects `payload`);
  - `backend-config.mjs` is the lever for `maintenance`,
    `minClientVersion`, `supportedClientVersions`,
    `acceptedSaveSchemaVersions`, `supportedProtocolVersions`, `limits`;
    `contractPhase` is refused (migration-owned);
  - `revoke-sessions.mjs` implements session recovery/lockdown
    (`--user <uuid>` or `--all`, count-then-update);
  - `prune-jobs.mjs` runs the receipt/checkpoint prunes above with the
    `receiptRetentionDays` floor read live from `backend_config.limits`;
  - `backup-export.mjs`/`restore-verify.mjs` implement the backup and
    restore-drill acceptance in `backup-restore.md`.
  The raw SQL above remains the reference for what each script does
  internally; run the scripts, not ad-hoc SQL, on staging/beta targets.
- **Talent catalog**: the server `talents` table is seeded from the canonical
  authored catalog (`src/data/talent/Talents.ts` CHARACTER_CREATION_TALENTS) —
  the SQL-seeded ids in the legacy migration are drifted leftovers. The
  contract runner upserts every canonical id `enabled=true` and disables
  non-canonical ids on each run; do not edit `talents` by hand.
- **Migrations apply through the direct postgres connection** (operator), each
  in its own transaction, ledgered into `supabase_migrations.schema_migrations`
  by the contract runner (`scripts/supabase/run-contract.mjs`). Apply order is
  strictly versioned; never apply `cutover` while legacy clients must keep
  working.
- **Verification**: `npm run test:supabase` from `game/` — see
  `scripts/supabase/contract.env.example` for the env contract. The runner is
  idempotent: it applies only un-ledgered migrations, re-seeds the canonical
  talent catalog, proves the fresh-install catalog equals the
  historical-upgrade catalog, then runs the full authority suite.
