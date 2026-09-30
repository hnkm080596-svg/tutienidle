# Beta backend authority cutover runbook

Scope: the B1-A transactional backend on Supabase — session admission, save
compare-and-swap (CAS), mutation receipts, time checkpoints, and the inventory
view that classifies historical save rows. Three versioned migrations implement
it:

| migration | purpose |
| --- | --- |
| `202609300001_beta_authority_prepare.sql` | additive: `backend_config`, `time_checkpoints`, `save_mutation_receipts`, new columns + bounds checks on `account_sessions`/`character_saves`, owner==character-owner composite FK (`NOT VALID`), guarded RPC set, `save_inventory_compatibility` view |
| `202609300002_beta_authority_cutover.sql` | subtractive: drops direct `character_saves` RLS policies, the retired `claim_active_session(text)` and `create_character(...,jsonb,integer)` overloads, all table/view grants; flips `contractPhase` to `cutover` |
| `202609300003_beta_guest_finalize.sql` | additive: `finalize_guest_upgrade` RPC (idempotent guest -> registered upgrade finalize; EXT-09 confirmation law) |

Contract phase is observable: `select public.beta_contract_phase()` returns
`legacy` | `prepare` | `cutover` (driven by `backend_config.contractPhase`).

**Evidence rule for every step:** record query text and tabular output (or the
spec name + verdict) into the run evidence dir `docs/qa/runs/beta-final-b1/`.
Never record connection strings, keys, JWTs, or project URLs beyond the
project ref slug — evidence files are committed.

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
  `finalize_guest_upgrade(text)`, `get_backend_status()` — all `authenticated`
  only.
- Internal helpers (`_lock_caller_profile`, `_assert_session_locked`,
  `_assert_session_protocol`, `_issue_checkpoint`, `_classify_save_row`,
  `_check_save_payload`) are revoked from every API role and pinned
  `search_path`.

## Client / schema compatibility matrix

Every cell is an executable spec in
`tests/integration/supabase/cutover.spec.ts` (matrix cells) and
`authority.spec.ts` (in-depth contract cells). Cells whose phase the target
project has already passed report a visible `test.skip` with the recorded
reason — they re-execute against any project still in that phase.

| client era | schema `legacy` | schema `prepare` | schema `cutover` |
| --- | --- | --- | --- |
| Legacy client (direct table writes, 1-arg claim, 7-arg create) | works — cell `matrix [legacy x legacy client]` | works (dual window) — cell `matrix [prepare x legacy client]` | **broken**: table grants + overloads gone — cell `matrix [cutover x legacy client]` |
| Contract client (versioned claim, metadata create, CAS write) | n/a (functions absent) | works — cell `matrix [prepare x contract client]` | works (target state) — cell `matrix [cutover x contract client]` |
| Contract client, old `protocol_version` | — | `SESSION_PROTOCOL_OUTDATED` on guarded ops until re-claim; `revoke_current_session` always reachable | same — cell `matrix [retained legacy JWT/session x cutover]` |
| Any client, wrong/absent session | — | `28000` raised (`session revoked` / `AUTH_REQUIRED`) | same — authority.spec `locks`/`attacks` cells |
| Any client, `{}`/invalid save payload | persisted unchecked | rejected (`SAVE_EMPTY`/`SAVE_*` codes) | rejected — `forged:` + `payload:` cells |

`load_game_state` contract statuses: `NO_CHARACTER`, `UNINITIALIZED`,
`INCOMPATIBLE`, `SAVE_READY`, `CHARACTER_DELETED`. `INCOMPATIBLE` and
`UNINITIALIZED` both accept a recovery write at `expectedRevision =
currentRevision` — bytes of unknown rows are never destroyed by the write path
itself; classification happens in the view, not on write.

## Cutover procedure (ordered)

The ordered procedure for taking a project from `legacy`/`prepare` to sealed
`cutover`. Staging has already executed steps 0-6 (migrations 202609300001-3
applied); the beta project executes the full list under deployment authority.

### Step 0 — Preconditions

- Operator holds the direct postgres connection (migration role) AND a
  throwaway `authenticated` JWT pair for canary probes. These live in the
  operator's credential store — never in evidence files, specs, or docs.
- `npm run test:supabase` passes on staging in `cutover` phase (env contract:
  `scripts/supabase/contract.env.example`).
- Staging rehearsal evidence is filed under `docs/qa/runs/beta-final-b1/`.

### Step 1 — Inventory (read-only, before any change)

Record all of the following as the pre-cutover baseline:

```sql
-- 1a. applied migration ledger (the runner writes here on every apply)
select version, name, inserted_at from supabase_migrations.schema_migrations
 order by version;

-- 1b. live sessions by protocol vintage: which clients are still fielded?
--     protocol_version null => minted by the retired 1-arg overload (old client)
select coalesce(protocol_version::text, 'null') as protocol,
       coalesce(build_id, 'unknown') as build, count(*)
  from public.account_sessions where revoked_at is null
 group by 1, 2 order by 1;

-- 1c. save inventory classification (post-prepare only; on legacy, run after
--     step 4a). Every non-ready class needs an owner decision or is covered
--     by the at-revision recovery write path.
select class, count(*) from public.save_inventory_compatibility group by 1;

-- 1d. pending-write surface: rows touched in the last freeze window matter
--     for step 3's drain check.
select count(*) filter (where updated_at > now() - interval '1 hour') as hot,
       count(*) as total
  from public.character_saves;
```

Output interpretation: any `owner-mismatch` rows from 1c are repaired per-row
(reassign `user_id` to the character owner, or archive) before proceeding —
the composite FK turns them into permanent write failures under cutover.
`null`/`99` protocol rows in 1b are the old-client population that step 7's
install policy covers.

### Step 2 — Preflight backup + restore route

- Supabase project backup: confirm the scheduled physical backup / PITR window
  covers the cutover timestamp. On the paid-tier route: `supabase db dump`
  (logical) is the portable fallback; record only the dump's table inventory
  and row counts in evidence, never the dump file itself.
- Restore rehearsal (staging did this once before first apply): restore the
  dump into a scratch project, run step 1's queries against it, diff the
  inventories. A restore that has never been rehearsed is not a restore route.
- Record: backup timestamp, backup type, restore-rehearsal verdict, and the
  target restore RTO (one operator command, minutes-class).

### Step 3 — Freeze writes

The write path requires an active admitted session, so a complete freeze is
two levers — both operator-level, both reversible:

```sql
-- 3a. stop NEW admissions (all subsequent claim_active_session calls
--     return MAINTENANCE_MODE; admitted sessions keep working)
update public.backend_config
   set value = jsonb_set(value, '{enabled}', 'true')
 where key = 'maintenance';

-- 3b. drain: revoke every live session so no admitted session remains to
--     write. revoke_current_session stays reachable for clients.
update public.account_sessions set revoked_at = now()
 where revoked_at is null;
```

Verify the freeze: `select count(*) from account_sessions where revoked_at is
null` => 0, and a canary `claim_active_session` returns `MAINTENANCE_MODE`.
Any client mid-write at revoke time gets `28000 session revoked` — its pending
journal keeps the mutation and replays it after the freeze lifts (that replay
contract is what the `crash replay` cells prove).

### Step 4 — Apply order (strictly versioned, one transaction each)

1. `202609300001_beta_authority_prepare.sql` — additive; safe with live
   legacy traffic. After it lands the project is in `prepare` (dual window).
2. Re-run step 1c — classify inventory now that the view exists; remediate
   `owner-mismatch` rows.
3. `202609300002_beta_authority_cutover.sql` — subtractive. **Never apply
   while legacy clients must keep working** — this is the point of no
   soft-compatibility. Steps 3a/3b must already be holding.
4. `202609300003_beta_guest_finalize.sql` — additive; independent of 2 but
   lands in the same window for beta-final.
5. Ledger each apply into `supabase_migrations.schema_migrations` (the
   contract runner does this automatically; a manual apply inserts the
   version row itself).

### Step 5 — Post-apply verification checklist

Run the full permission block below (all from "Phase permission queries") and
require every expected value:

- `beta_contract_phase()` = `cutover`
- `pg_policies` on `character_saves` = 0 rows
- retired overloads absent (`to_regprocedure` both null)
- table/view grants closed (all `has_table_privilege` false)
- RPC grant surface exactly the admitted set (all `has_function_privilege`
  true, anon denied)
- every definer function pins `search_path` (count = 0)
- composite FK present: `select conname, convalidated from pg_constraint where
  conname = 'character_saves_owner_is_character_owner'` — `NOT VALID` is
  expected until `validate constraint` runs in a low-traffic window
- bounds checks present on `account_sessions` (device_label/build_id length)
  and `character_saves` (schema/revision bounds)

Then the executable checklist:

```sh
# full contract suite against the cutover project
set -a && source .env.supabase.contract && set +a
npx playwright test --config playwright.supabase.config.ts
```

Expected: every `matrix [cutover x *]`, `two-device`, `forged`, `crash replay`,
`auth:`, `clock:`, `guest:` cell executes (not skipped); the `legacy`/`prepare`
cells report their recorded skips.

### Step 6 — Versioned claim check (canary admission)

While maintenance still blocks normal claims, prove the admitted path with
the operator canary account:

```sql
-- canary bypass: temporarily drop maintenance for the probe only
update public.backend_config
   set value = jsonb_set(value, '{enabled}', 'false')
 where key = 'maintenance';
```

```sh
# canary claim + load + write + heartbeat + revoke via the spec's own RPC
# helpers, or equivalently the playwright suite on a fresh account
```

Re-enable maintenance immediately after the canary passes. Record the canary
session's claim response (`status: ADMITTED`, protocol echo) — not its tokens.

### Step 7 — Tester-install replacement policy (binding)

- An old (pre-contract) binary **keeps its local fallback**: when the server
  denies its writes it degrades to local-only play, exactly as it did
  pre-contract. Nothing on the server can corrupt that local state — the
  denied paths mutate zero server bytes (proven by the `matrix [cutover x
  legacy client]` cell).
- The replacement rule: testers install the contract build as a **fresh
  install identity**. First boot under the contract build performs an
  authoritative `load_game_state`; recovery of historical rows happens only
  through the documented at-revision write path.
- **Explicit policy — never auto-ingest:** no client path may upload a
  pre-cutover *local* payload as a new mutation. The old binary's later local
  progress (earned while its remote writes were denied) is stranded local
  state by design; a contract build must not pick it up and push it as a
  catch-up save. Ingestion of stranded local progress is a manual,
  per-account operator decision, never client code.
- Rollout consequence: tester communication must set the expectation that
  progress made on a denied old build does not carry forward.

### Step 8 — Read-only health / canary before admitting play

Before lifting maintenance for the tester population:

1. `get_backend_status()` => `status: OK`, `contractPhase: cutover`.
2. Read-only probes only: `load_game_state` on the canary session returns a
   contract status; no write RPCs fire in this step.
3. `select class, count(*) from save_inventory_compatibility` — `ready` share
   matches the step-1c baseline modulo known remediations.
4. Receipt surface is write-once: `select count(*) from
   save_mutation_receipts` is non-decreasing across the window.
5. Canary cell verdict from step 6 is green.

Only then lift: `jsonb_set(value,'{enabled}','false')` on `maintenance`, and
new claims admit on the versioned path.

### Step 9 — Rollback path

The cutover migration is subtractive; there is no `down` file. Two honest
routes, in order of preference:

1. **Point-in-time restore** to before step 4.3 (the rehearsed route from
   step 2). This is the only complete rollback — it restores grants, policies,
   overloads, and `contractPhase` together. Writes committed between cutover
   and restore are lost unless replayed from receipts:
   `save_mutation_receipts` + the journal records give the replay list.
2. **Forward repair to `prepare`** when a partial retro-compat window is
   needed without losing cutover writes: a repair migration that re-grants the
   table policies, re-creates the two retired overloads (delegating to the
   versioned implementations), and sets `contractPhase = 'prepare'`. Receipts
   and checkpoints written under cutover are preserved. This path needs its
   own review — it re-opens the dual window deliberately, it is not a routine
   switch.

Never "rollback" by only flipping `contractPhase` back — the grants and
overloads it reports are already gone; the phase flag is observational, not
the mechanism.

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
       has_function_privilege('authenticated', 'public.finalize_guest_upgrade(text)', 'execute') as finalize,
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
  new claims (`MAINTENANCE_MODE`) while admitted sessions keep working —
  combine with the session drain in step 3b for a complete write freeze.
- **Inventory triage**: rows classified `owner-mismatch` need manual repair
  (reassign `user_id` to the character owner or archive); everything else is
  recoverable by the client at its current revision.
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
