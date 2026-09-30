-- ============================================================================
-- BETA-FINAL B1-A / PR2 - prepare: guarded transactional authority surface
-- ============================================================================
-- Spec: game/docs/qa/missions/2026-09-29-beta-final-production-readiness.md B1.3
-- Plan: game/docs/superpowers/plans/2026-09-29-beta-final-implementation-plan.md
--       section 6.
--
-- What this migration adds:
--   * public.backend_config            - operator-edited contract/compatibility
--                                        configuration (single source for the
--                                        protocol window, accepted save schema
--                                        versions, maintenance lever, bounds).
--   * public.time_checkpoints          - server-issued time anchors bound to
--                                        owner/character/issuing session with a
--                                        bounded lease; saves present one plus
--                                        a client-measured monotonic offset so
--                                        progression cutoffs never come from a
--                                        client wall clock.
--   * public.save_mutation_receipts    - durable idempotent-commit receipts,
--                                        unique per (owner, mutation_id), bound
--                                        to a server-computed canonical request
--                                        fingerprint digest.
--   * character_saves columns          - progression_cutoff_at (separate from
--                                        transport updated_at), last_mutation_id,
--                                        last_client_build_id (correlation only).
--   * account_sessions columns         - protocol_version + build_id recorded at
--                                        claim time.
--   * save<->character ownership       - composite FK keeps a save's user_id
--                                        equal to its character's owner; cannot
--                                        drift for new writes.
--   * Guarded RPC set (spec B1.3)      - claim_active_session(device, protocol,
--                                        build), create_character (metadata only,
--                                        no save row), load_game_state,
--                                        write_character_save (CAS + receipts),
--                                        heartbeat_session, revoke_current_session,
--                                        get_backend_status, beta_contract_phase,
--                                        save_inventory_compatibility view.
--
-- Locking contract (same account lock in every session/save/provisioning
-- operation): profiles row FOR UPDATE -> account_sessions -> talent_roll ->
-- character -> {save_mutation_receipts, character_saves} (the write path reads
-- its own receipt row before taking the save lock so an identical retry can
-- return without a revision bump; everything is already serialized by the
-- profile row lock, so the order within that final pair cannot interleave).
-- The lock is acquired
-- inside public._lock_caller_profile(), which every guarded entry point calls
-- first (assert_active_session delegates to it, so the legacy RPCs that call
-- assert_active_session first thing acquire the same lock before any other).
-- All locks are held to transaction commit; a failure rolls back with no
-- partial write.
--
-- Compatibility window ("dual surface"): the legacy one-arg
-- claim_active_session(text) and seven-arg create_character(...) overloads and
-- the direct character_saves table policies are intentionally KEPT here so a
-- deployed client continues to work while the new surface is verified.
-- 202609300002_beta_authority_cutover.sql removes them.
--
-- Session protocol enforcement: the new claim overload records the admitted
-- protocol_version on account_sessions; every NEW guarded operation
-- (_assert_session_protocol) rejects sessions that carry no admitted/supported
-- protocol, so a session minted by the legacy overload cannot reach the new
-- write/load/heartbeat path even during the dual-surface window.

create table if not exists public.backend_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table public.backend_config is
  'BETA contract knobs. contractPhase prepare|cutover; protocolVersion current; supportedProtocolVersions / acceptedSaveSchemaVersions are the admission sets; maintenance.enabled denies NEW session claims while leaving reads; limits bounds payload bytes, device/build field lengths, checkpoint lease and receipt retention. Edited by operators via direct SQL only.';

insert into public.backend_config(key, value) values
  ('contractPhase', '"prepare"'::jsonb),
  ('protocolVersion', '1'::jsonb),
  ('supportedProtocolVersions', '[1]'::jsonb),
  ('acceptedSaveSchemaVersions', '[87]'::jsonb),
  ('maintenance', '{"enabled": false}'::jsonb),
  ('limits', '{
     "maxSavePayloadBytes": 4194304,
     "maxDeviceLabelChars": 160,
     "maxBuildIdChars": 64,
     "checkpointLeaseSeconds": 604800,
     "receiptRetentionDays": 7,
     "elapsedGraceMs": 300000,
     "maxElapsedMonotonicMs": 691200000
   }'::jsonb)
on conflict (key) do nothing;

-- --------------------------------------------------------------------------
-- session / save column additions
-- --------------------------------------------------------------------------

alter table public.account_sessions
  add column if not exists protocol_version integer,
  add column if not exists build_id text;

alter table public.character_saves
  add column if not exists progression_cutoff_at timestamptz,
  add column if not exists last_mutation_id uuid,
  add column if not exists last_client_build_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'account_sessions_protocol_version_bounds'
      and conrelid = 'public.account_sessions'::regclass
  ) then
    alter table public.account_sessions
      add constraint account_sessions_protocol_version_bounds
      check (protocol_version is null or protocol_version between 1 and 1000000);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'account_sessions_build_id_bounds'
      and conrelid = 'public.account_sessions'::regclass
  ) then
    alter table public.account_sessions
      add constraint account_sessions_build_id_bounds
      check (build_id is null or char_length(build_id) between 1 and 64);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'character_saves_build_id_bounds'
      and conrelid = 'public.character_saves'::regclass
  ) then
    alter table public.character_saves
      add constraint character_saves_build_id_bounds
      check (last_client_build_id is null or char_length(last_client_build_id) between 1 and 64);
  end if;
end $$;

-- A save's user_id must equal its character's user_id. characters.id is the
-- primary key, so (id, user_id) is a valid unique target for the composite FK.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'characters_id_user_unique' and conrelid = 'public.characters'::regclass
  ) then
    alter table public.characters
      add constraint characters_id_user_unique unique (id, user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'character_saves_owner_is_character_owner'
      and conrelid = 'public.character_saves'::regclass
  ) then
    -- NOT VALID: pre-existing direct-write rows that paired a caller's user_id
    -- with a foreign character_id must not block this migration; they are
    -- surfaced as 'owner-mismatch' rows by save_inventory_compatibility and the
    -- cutover runbook has the cleanup + VALIDATE query. New writes are enforced
    -- immediately regardless of validation state.
    alter table public.character_saves
      add constraint character_saves_owner_is_character_owner
      foreign key (character_id, user_id)
      references public.characters (id, user_id) on delete cascade not valid;
  end if;
end $$;

-- --------------------------------------------------------------------------
-- server-issued time checkpoints
-- --------------------------------------------------------------------------

create table if not exists public.time_checkpoints (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  issued_by_session_id uuid not null references public.account_sessions(id) on delete cascade,
  anchor_at timestamptz not null default now(),
  lease_expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists time_checkpoints_owner_character
  on public.time_checkpoints (owner_user_id, character_id);
create index if not exists time_checkpoints_lease_prune
  on public.time_checkpoints (lease_expires_at);

alter table public.time_checkpoints enable row level security; -- no policies: definer-only

-- --------------------------------------------------------------------------
-- durable mutation receipts
-- --------------------------------------------------------------------------

create table if not exists public.save_mutation_receipts (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  mutation_id uuid not null,
  character_id uuid not null references public.characters(id) on delete cascade,
  session_id uuid not null references public.account_sessions(id) on delete cascade,
  expected_revision bigint not null,
  committed_revision bigint not null,
  schema_version integer not null,
  build_id text not null,
  checkpoint_id uuid references public.time_checkpoints(id) on delete set null,
  elapsed_monotonic_ms bigint,
  -- sha256 over the canonical JSONB request fingerprint (identity, expected
  -- revision, schema, build, checkpoint, payload). jsonb serialization is the
  -- canonical form; the client byte hash is a journal-integrity device and is
  -- never compared with this digest.
  request_digest text not null,
  created_at timestamptz not null default now(),
  primary key (owner_user_id, mutation_id)
);

create index if not exists save_mutation_receipts_prune
  on public.save_mutation_receipts (created_at);
create index if not exists save_mutation_receipts_character
  on public.save_mutation_receipts (character_id);

alter table public.save_mutation_receipts enable row level security; -- no policies: definer-only

-- --------------------------------------------------------------------------
-- internal helpers (never granted to api roles)
-- --------------------------------------------------------------------------

-- Acquire the shared per-user serialization lock: the caller's profiles row
-- FOR UPDATE. Rejects unauthenticated callers and callers without a profile.
create or replace function public._lock_caller_profile()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_locked uuid;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  select user_id into v_locked
    from public.profiles
    where user_id = v_user
    for update;
  if v_locked is null then
    raise exception 'PROFILE_MISSING' using errcode = '28000';
  end if;
  return v_user;
end;
$$;

-- Under the caller lock: validate + lock the active session row (lock order
-- profile -> session) and bump last_seen_at. No protocol gate here; the new
-- guarded operations call _assert_session_protocol instead.
create or replace function public._assert_session_locked(p_session_id uuid)
returns public.account_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.account_sessions;
begin
  perform public._lock_caller_profile();
  select * into v_session
    from public.account_sessions
    where id = p_session_id and user_id = auth.uid() and revoked_at is null
    for update;
  if not found then
    raise exception 'session revoked' using errcode = '28000';
  end if;
  update public.account_sessions set last_seen_at = now() where id = v_session.id;
  return v_session;
end;
$$;

-- Same as _assert_session_locked plus the admitted-protocol gate used by every
-- new guarded operation: a session must have been claimed through the
-- versioned overload carrying a protocol_version in supportedProtocolVersions.
create or replace function public._assert_session_protocol(p_session_id uuid)
returns public.account_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.account_sessions;
  v_supported jsonb;
begin
  v_session := public._assert_session_locked(p_session_id);
  select value into v_supported
    from public.backend_config where key = 'supportedProtocolVersions';
  if v_session.protocol_version is null
     or v_supported is null
     or not (v_supported @> to_jsonb(v_session.protocol_version)) then
    raise exception 'SESSION_PROTOCOL_OUTDATED' using errcode = '28000';
  end if;
  return v_session;
end;
$$;

-- Issue a fresh server time checkpoint bound to owner/character/issuing
-- session. The lease bounds how long the checkpoint can anchor a save's
-- progression cutoff (default 7 days so a pending retry after a crash keeps
-- its T0 cutoff); the operator prune job removes expired rows together with
-- receipts past the retention floor.
create or replace function public._issue_checkpoint(
  p_owner uuid,
  p_character uuid,
  p_session uuid
)
returns public.time_checkpoints
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.time_checkpoints;
  v_lease_seconds integer;
begin
  select coalesce((value->>'checkpointLeaseSeconds')::integer, 604800)
    into v_lease_seconds
    from public.backend_config where key = 'limits';
  insert into public.time_checkpoints(owner_user_id, character_id, issued_by_session_id, anchor_at, lease_expires_at)
  values (p_owner, p_character, p_session, now(), now() + make_interval(secs => coalesce(v_lease_seconds, 604800)))
  returning * into v_row;
  return v_row;
end;
$$;

-- Compatibility classification of one character's save row. Shared by
-- load_game_state and the save_inventory_compatibility operator view so the
-- client-facing state and the inventory report can never drift apart.
create or replace function public._classify_save_row(
  p_save public.character_saves,
  p_character public.characters
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_accepted jsonb;
begin
  if p_save.character_id is null then
    return 'uninitialized';
  end if;
  if jsonb_typeof(p_save.payload) is distinct from 'object' then
    return 'invalid-payload';
  end if;
  if p_save.payload = '{}'::jsonb then
    return 'empty-payload';
  end if;
  if p_save.user_id <> p_character.user_id then
    return 'owner-mismatch';
  end if;
  select value into v_accepted
    from public.backend_config where key = 'acceptedSaveSchemaVersions';
  if v_accepted is null or not (v_accepted @> to_jsonb(p_save.schema_version)) then
    return 'incompatible-schema';
  end if;
  if coalesce(p_save.payload->>'version', '') <> p_save.schema_version::text then
    return 'version-mismatch';
  end if;
  if jsonb_typeof(p_save.payload->'player') is distinct from 'object' then
    return 'invalid-shape';
  end if;
  return 'ready';
end;
$$;

-- Server-side save contract. Returns NULL when the payload passes, else a
-- jsonb {code, detail} rejection. Mirrors the client's required top-level
-- shape (saveShapeValidation.ts) without duplicating deep gameplay checks:
-- the client still runs full registry preflight before upload.
create or replace function public._check_save_payload(
  p_schema_version integer,
  p_payload jsonb,
  p_character public.characters
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limits jsonb;
  v_max_bytes bigint;
  v_accepted jsonb;
  v_required_arrays constant text[] := array[
    'techniques', 'skills', 'materials', 'equipment', 'pills',
    'talismans', 'formations', 'buildings', 'equipmentSlots'
  ];
  v_key text;
  v_payload_talents text[];
  v_character_talents text[];
begin
  if p_payload is null or jsonb_typeof(p_payload) is distinct from 'object' then
    return jsonb_build_object('code', 'SAVE_INVALID', 'detail', 'payload is not an object');
  end if;
  if p_payload = '{}'::jsonb then
    return jsonb_build_object('code', 'SAVE_INVALID', 'detail', 'empty payload');
  end if;
  select value into v_limits from public.backend_config where key = 'limits';
  v_max_bytes := coalesce((v_limits->>'maxSavePayloadBytes')::bigint, 4194304);
  if octet_length(convert_to(p_payload::text, 'UTF8')) > v_max_bytes then
    return jsonb_build_object('code', 'SAVE_TOO_LARGE', 'limitBytes', v_max_bytes);
  end if;
  select value into v_accepted from public.backend_config where key = 'acceptedSaveSchemaVersions';
  if p_schema_version is null or v_accepted is null
     or not (v_accepted @> to_jsonb(p_schema_version)) then
    return jsonb_build_object('code', 'SAVE_SCHEMA_UNSUPPORTED', 'detail', 'schema_version not accepted');
  end if;
  if coalesce(p_payload->>'version', '') <> p_schema_version::text then
    return jsonb_build_object('code', 'SAVE_INVALID', 'detail', 'payload.version mismatches schema_version');
  end if;
  if jsonb_typeof(p_payload->'player') is distinct from 'object' then
    return jsonb_build_object('code', 'SAVE_INVALID', 'detail', 'player object required');
  end if;
  foreach v_key in array v_required_arrays loop
    if jsonb_typeof(p_payload -> v_key) is distinct from 'array' then
      return jsonb_build_object('code', 'SAVE_INVALID', 'detail', v_key || ' array required');
    end if;
  end loop;
  -- Immutable character/talent/starter identity: the stored payload must keep
  -- the provisioned identity so a save cannot be replayed under a different
  -- character.
  if coalesce(p_payload->'player'->>'name', '') <> p_character.name then
    return jsonb_build_object('code', 'SAVE_INVALID', 'detail', 'player.name mismatch');
  end if;
  if jsonb_typeof(p_payload->'player'->'selectedTalentIds') is distinct from 'array' then
    return jsonb_build_object('code', 'SAVE_INVALID', 'detail', 'selectedTalentIds array required');
  end if;
  select array_agg(val order by val) into v_payload_talents
    from jsonb_array_elements_text(p_payload->'player'->'selectedTalentIds') as e(val);
  select array_agg(val order by val) into v_character_talents
    from unnest(p_character.selected_talent_ids) as u(val);
  if v_payload_talents is distinct from v_character_talents then
    return jsonb_build_object('code', 'SAVE_INVALID', 'detail', 'selectedTalentIds mismatch');
  end if;
  -- mortalBasicSkillId is mortal-scoped on the client (absent after initiation);
  -- when present it must equal the provisioned starter pick.
  if p_payload->'player' ? 'mortalBasicSkillId'
     and coalesce(p_payload->'player'->>'mortalBasicSkillId', '') <> p_character.mortal_basic_skill_id then
    return jsonb_build_object('code', 'SAVE_INVALID', 'detail', 'mortalBasicSkillId mismatch');
  end if;
  return null;
end;
$$;

-- --------------------------------------------------------------------------
-- assert_active_session now owns the shared lock acquisition for every caller
-- --------------------------------------------------------------------------

create or replace function public.assert_active_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._assert_session_locked(p_session_id);
end;
$$;

-- --------------------------------------------------------------------------
-- claim: legacy overload re-locked + versioned admission overload
-- --------------------------------------------------------------------------

-- Legacy signature kept for the dual-surface window. Re-defined so claims take
-- the shared profile lock: concurrent claims now serialize deterministically
-- instead of racing the one-active-session partial unique index.
create or replace function public.claim_active_session(p_device_label text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_session_id uuid;
begin
  perform public._lock_caller_profile();
  update public.account_sessions set revoked_at = now()
    where user_id = auth.uid() and revoked_at is null;
  insert into public.account_sessions(user_id, device_label)
  values (auth.uid(), left(coalesce(p_device_label, 'unknown'), 160))
  returning id into new_session_id;
  return new_session_id;
end;
$$;

-- Versioned admission (spec B1.3): admits only supported protocol versions and
-- records protocol + build on the session; every guarded operation validates
-- that recorded protocol. This is compatibility enforcement, not attestation
-- that an unmodified signed client issued the request.
create or replace function public.claim_active_session(
  p_device_label text,
  p_protocol_version integer,
  p_build_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_session_id uuid;
  v_supported jsonb;
  v_limits jsonb;
  v_maintenance jsonb;
  v_max_device integer;
  v_max_build integer;
begin
  v_user := public._lock_caller_profile();
  select value into v_supported
    from public.backend_config where key = 'supportedProtocolVersions';
  select value into v_limits
    from public.backend_config where key = 'limits';
  select value into v_maintenance
    from public.backend_config where key = 'maintenance';
  v_max_device := coalesce((v_limits->>'maxDeviceLabelChars')::integer, 160);
  v_max_build := coalesce((v_limits->>'maxBuildIdChars')::integer, 64);
  if coalesce((v_maintenance->>'enabled')::boolean, false) then
    return jsonb_build_object('status', 'REJECTED', 'code', 'MAINTENANCE_MODE');
  end if;
  if p_protocol_version is null or v_supported is null
     or not (v_supported @> to_jsonb(p_protocol_version)) then
    return jsonb_build_object(
      'status', 'REJECTED', 'code', 'PROTOCOL_UNSUPPORTED',
      'supportedProtocolVersions', coalesce(v_supported, '[]'::jsonb));
  end if;
  if p_build_id is null or char_length(p_build_id) not between 1 and v_max_build then
    return jsonb_build_object('status', 'REJECTED', 'code', 'BUILD_ID_INVALID');
  end if;
  if p_device_label is not null and char_length(p_device_label) > v_max_device then
    return jsonb_build_object('status', 'REJECTED', 'code', 'DEVICE_LABEL_INVALID');
  end if;
  update public.account_sessions set revoked_at = now()
    where user_id = v_user and revoked_at is null;
  insert into public.account_sessions(user_id, device_label, protocol_version, build_id)
  values (v_user, left(coalesce(p_device_label, 'unknown'), v_max_device), p_protocol_version, p_build_id)
  returning id into v_session_id;
  return jsonb_build_object(
    'status', 'ADMITTED',
    'sessionId', v_session_id,
    'protocolVersion', p_protocol_version,
    'serverTimeUtc', now());
end;
$$;

-- --------------------------------------------------------------------------
-- create_character: metadata-only provisioning overload (no save row)
-- --------------------------------------------------------------------------

-- New signature WITHOUT p_initial_save/p_schema_version: the server never
-- persists a fabricated save at creation; the client builds the canonical
-- starter snapshot and commits it through write_character_save revision 0->1.
-- Returns the full provisioned metadata so the client can rebuild identical
-- starter state after a crash (CHARACTER_UNINITIALIZED) without rerolling.
create or replace function public.create_character(
  p_session_id uuid,
  p_roll_id uuid,
  p_name text,
  p_talent_ids text[],
  p_mortal_basic_skill_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.account_sessions;
  v_roll public.talent_rolls;
  v_character public.characters;
begin
  v_session := public._assert_session_protocol(p_session_id);
  if exists (select 1 from public.characters where user_id = v_session.user_id) then
    return jsonb_build_object('status', 'REJECTED', 'code', 'CHARACTER_EXISTS');
  end if;
  select * into v_roll from public.talent_rolls
    where id = p_roll_id and user_id = v_session.user_id
    for update; -- lock order: profile -> session -> talent_roll -> character
  if not found or v_roll.consumed_at is not null or v_roll.expires_at <= now() then
    return jsonb_build_object('status', 'REJECTED', 'code', 'INVALID_TALENT_ROLL');
  end if;
  if p_talent_ids is null
     or cardinality(p_talent_ids) <> 1
     or cardinality(array(select distinct unnest(p_talent_ids))) <> 1
     or not p_talent_ids <@ v_roll.talent_ids then
    return jsonb_build_object('status', 'REJECTED', 'code', 'INVALID_TALENT_SELECTION');
  end if;
  if p_name is null or char_length(trim(p_name)) not between 2 and 20
     or exists (select 1 from public.characters where normalized_name = lower(trim(p_name))) then
    return jsonb_build_object('status', 'REJECTED', 'code', 'CHARACTER_NAME_UNAVAILABLE');
  end if;
  -- mortal pick must be one of the three precursor ids, mirroring
  -- core/skill/MortalPrecursors.ts (same drift contract as the legacy RPC).
  if p_mortal_basic_skill_id is null
     or p_mortal_basic_skill_id not in ('tram', 'linh_bao', 'huy_quyen') then
    return jsonb_build_object('status', 'REJECTED', 'code', 'INVALID_MORTAL_SKILL');
  end if;
  insert into public.characters(user_id, name, normalized_name, selected_talent_ids, base_attributes, mortal_basic_skill_id)
  values (v_session.user_id, trim(p_name), lower(trim(p_name)), p_talent_ids,
          '{"strength":1,"dexterity":1,"intelligence":1,"attunement":1,"vitality":1}'::jsonb,
          p_mortal_basic_skill_id)
  returning * into v_character;
  update public.talent_rolls set consumed_at = now() where id = v_roll.id;
  return jsonb_build_object(
    'status', 'CREATED',
    'character', jsonb_build_object(
      'id', v_character.id,
      'name', v_character.name,
      'selectedTalentIds', v_character.selected_talent_ids,
      'baseAttributes', v_character.base_attributes,
      'mortalBasicSkillId', v_character.mortal_basic_skill_id,
      'realmId', v_character.realm_id,
      'realmLevel', v_character.realm_level,
      'createdAt', v_character.created_at),
    'serverTimeUtc', now());
end;
$$;

-- --------------------------------------------------------------------------
-- load_game_state: session-guarded boot read
-- --------------------------------------------------------------------------

create or replace function public.load_game_state(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.account_sessions;
  v_character public.characters;
  v_save public.character_saves;
  v_checkpoint public.time_checkpoints;
  v_class text;
  v_character_meta jsonb;
begin
  v_session := public._assert_session_protocol(p_session_id);
  select * into v_character from public.characters
    where user_id = v_session.user_id
    for update; -- lock order: profile -> session -> character -> save
  if not found then
    return jsonb_build_object('status', 'NO_CHARACTER', 'serverTimeUtc', now());
  end if;
  v_character_meta := jsonb_build_object(
    'id', v_character.id,
    'name', v_character.name,
    'selectedTalentIds', v_character.selected_talent_ids,
    'baseAttributes', v_character.base_attributes,
    'mortalBasicSkillId', v_character.mortal_basic_skill_id,
    'realmId', v_character.realm_id,
    'realmLevel', v_character.realm_level,
    'createdAt', v_character.created_at);
  if v_character.deleted_at is not null then
    return jsonb_build_object(
      'status', 'CHARACTER_DELETED',
      'character', v_character_meta || jsonb_build_object('deletedAt', v_character.deleted_at),
      'serverTimeUtc', now());
  end if;
  select * into v_save from public.character_saves
    where character_id = v_character.id
    for update;
  v_checkpoint := public._issue_checkpoint(v_session.user_id, v_character.id, p_session_id);
  if not found then
    return jsonb_build_object(
      'status', 'CHARACTER_UNINITIALIZED',
      'character', v_character_meta,
      'serverCheckpoint', jsonb_build_object(
        'checkpointId', v_checkpoint.id,
        'anchorAt', v_checkpoint.anchor_at,
        'leaseExpiresAt', v_checkpoint.lease_expires_at),
      'serverTimeUtc', now());
  end if;
  v_class := public._classify_save_row(v_save, v_character);
  if v_class <> 'ready' then
    return jsonb_build_object(
      'status', 'INCOMPATIBLE',
      'reason', v_class,
      'character', v_character_meta,
      'save', jsonb_build_object(
        'schemaVersion', v_save.schema_version,
        'saveRevision', v_save.save_revision,
        'payload', v_save.payload,
        'updatedAt', v_save.updated_at,
        'progressionCutoffAt', v_save.progression_cutoff_at,
        'lastClientBuildId', v_save.last_client_build_id,
        'lastMutationId', v_save.last_mutation_id),
      'serverCheckpoint', jsonb_build_object(
        'checkpointId', v_checkpoint.id,
        'anchorAt', v_checkpoint.anchor_at,
        'leaseExpiresAt', v_checkpoint.lease_expires_at),
      'serverTimeUtc', now());
  end if;
  return jsonb_build_object(
    'status', 'SAVE_READY',
    'character', v_character_meta,
    'save', jsonb_build_object(
      'schemaVersion', v_save.schema_version,
      'saveRevision', v_save.save_revision,
      'payload', v_save.payload,
      'updatedAt', v_save.updated_at,
      'progressionCutoffAt', v_save.progression_cutoff_at,
      'lastClientBuildId', v_save.last_client_build_id,
      'lastMutationId', v_save.last_mutation_id),
    'serverCheckpoint', jsonb_build_object(
      'checkpointId', v_checkpoint.id,
      'anchorAt', v_checkpoint.anchor_at,
      'leaseExpiresAt', v_checkpoint.lease_expires_at),
    'serverTimeUtc', now());
end;
$$;

-- --------------------------------------------------------------------------
-- write_character_save: session-guarded CAS + durable receipts
-- --------------------------------------------------------------------------

create or replace function public.write_character_save(
  p_session_id uuid,
  p_expected_revision bigint,
  p_schema_version integer,
  p_payload jsonb,
  p_build_id text,
  p_mutation_id uuid,
  p_time_checkpoint jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.account_sessions;
  v_user uuid;
  v_character public.characters;
  v_save public.character_saves;
  v_checkpoint public.time_checkpoints;
  v_checkpoint_id uuid;
  v_elapsed bigint;
  v_server_elapsed_ms double precision;
  v_cutoff timestamptz;
  v_fingerprint jsonb;
  v_digest text;
  v_receipt public.save_mutation_receipts;
  v_bad jsonb;
  v_limits jsonb;
  v_new_revision bigint;
  v_elapsed_grace bigint;
begin
  -- Transport field bounds first: fail cheap before touching any row.
  select value into v_limits from public.backend_config where key = 'limits';
  if p_session_id is null or p_mutation_id is null then
    return jsonb_build_object('status', 'REJECTED', 'code', 'SAVE_INVALID', 'detail', 'session and mutation ids required');
  end if;
  if p_expected_revision is null
     or p_expected_revision < 0
     or p_expected_revision > 9007199254740991 then -- js safe-integer ceiling
    return jsonb_build_object('status', 'REJECTED', 'code', 'SAVE_INVALID', 'detail', 'expected_revision out of range');
  end if;
  if p_build_id is null
     or char_length(p_build_id) not between 1 and coalesce((v_limits->>'maxBuildIdChars')::integer, 64) then
    return jsonb_build_object('status', 'REJECTED', 'code', 'SAVE_INVALID', 'detail', 'build_id bounds violated');
  end if;
  if p_time_checkpoint is null or jsonb_typeof(p_time_checkpoint) is distinct from 'object' then
    return jsonb_build_object('status', 'REJECTED', 'code', 'CHECKPOINT_REQUIRED', 'detail', 'time checkpoint object required');
  end if;

  v_session := public._assert_session_protocol(p_session_id);
  v_user := v_session.user_id;

  -- Resolve the owned character under the lock (a revoked session never reaches
  -- receipt lookup, and a deleted character cannot commit, even on an identical
  -- retry).
  select * into v_character from public.characters
    where user_id = v_user
    for update;
  if not found then
    return jsonb_build_object('status', 'REJECTED', 'code', 'NO_CHARACTER');
  end if;
  if v_character.deleted_at is not null then
    return jsonb_build_object('status', 'REJECTED', 'code', 'CHARACTER_DELETED');
  end if;

  -- Canonical request fingerprint: character identity, expected revision,
  -- schema, build id, checkpoint and payload, digested server-side over the
  -- JSONB serialization (never the client's byte hash).
  v_fingerprint := jsonb_build_object(
    'characterId', v_character.id,
    'expectedRevision', p_expected_revision,
    'schemaVersion', p_schema_version,
    'buildId', p_build_id,
    'mutationId', p_mutation_id,
    'timeCheckpoint', p_time_checkpoint,
    'payload', p_payload);
  v_digest := encode(extensions.digest(v_fingerprint::text, 'sha256'), 'hex');

  -- Receipt lookup happens INSIDE the session/character locks: an identical
  -- retry returns the prior receipt without a revision increment; reuse with a
  -- different fingerprint is rejected outright.
  select * into v_receipt from public.save_mutation_receipts
    where owner_user_id = v_user and mutation_id = p_mutation_id
    for update;
  if found then
    if v_receipt.request_digest = v_digest then
      select * into v_save from public.character_saves
        where character_id = v_character.id;
      return jsonb_build_object(
        'status', 'COMMITTED',
        'alreadyCommitted', true,
        'committedRevision', v_receipt.committed_revision,
        'currentRevision', coalesce(v_save.save_revision, 0),
        'progressionCutoffAt', v_save.progression_cutoff_at,
        'receipt', jsonb_build_object(
          'mutationId', v_receipt.mutation_id,
          'expectedRevision', v_receipt.expected_revision,
          'schemaVersion', v_receipt.schema_version,
          'buildId', v_receipt.build_id,
          'checkpointId', v_receipt.checkpoint_id,
          'elapsedMonotonicMs', v_receipt.elapsed_monotonic_ms,
          'requestDigest', v_receipt.request_digest,
          'createdAt', v_receipt.created_at),
        'serverTimeUtc', now());
    end if;
    return jsonb_build_object('status', 'REJECTED', 'code', 'MUTATION_ID_REUSED');
  end if;

  -- CAS: the save row lock serializes writers of this character. Revision 1
  -- only when the row is absent and expected is 0; updates only when the
  -- expected revision equals the committed one.
  select * into v_save from public.character_saves
    where character_id = v_character.id
    for update;
  if not found then
    if p_expected_revision <> 0 then
      return jsonb_build_object('status', 'CONFLICT', 'code', 'SAVE_CONFLICT', 'currentRevision', null);
    end if;
  elsif p_expected_revision <> v_save.save_revision then
    return jsonb_build_object(
      'status', 'CONFLICT', 'code', 'SAVE_CONFLICT',
      'currentRevision', v_save.save_revision);
  end if;

  v_bad := public._check_save_payload(p_schema_version, p_payload, v_character);
  if v_bad is not null then
    return jsonb_build_object('status', 'REJECTED') || v_bad;
  end if;

  -- Progression watermark: the checkpoint must be a live server-issued row
  -- bound to this owner+character; the client offset is a monotonic duration
  -- measured since the checkpoint was received, bounded by the server-side
  -- elapsed time (plus a small grace for transport), never a wall clock.
  begin
    v_checkpoint_id := (p_time_checkpoint->>'checkpointId')::uuid;
  exception when invalid_text_representation then
    return jsonb_build_object('status', 'REJECTED', 'code', 'CHECKPOINT_INVALID', 'detail', 'checkpointId is not a uuid');
  end;
  if v_checkpoint_id is null then
    return jsonb_build_object('status', 'REJECTED', 'code', 'CHECKPOINT_INVALID', 'detail', 'checkpointId required');
  end if;
  begin
    v_elapsed := (p_time_checkpoint->>'elapsedMonotonicMs')::bigint;
  exception when invalid_text_representation or numeric_value_out_of_range then
    return jsonb_build_object('status', 'REJECTED', 'code', 'CHECKPOINT_INVALID', 'detail', 'elapsedMonotonicMs is not an integer');
  end;
  select * into v_checkpoint from public.time_checkpoints
    where id = v_checkpoint_id;
  if not found
     or v_checkpoint.owner_user_id <> v_user
     or v_checkpoint.character_id <> v_character.id
     or v_checkpoint.lease_expires_at <= now() then
    return jsonb_build_object('status', 'REJECTED', 'code', 'CHECKPOINT_INVALID');
  end if;
  v_elapsed_grace := coalesce((v_limits->>'elapsedGraceMs')::bigint, 300000);
  v_server_elapsed_ms := extract(epoch from (now() - v_checkpoint.anchor_at)) * 1000;
  if v_elapsed is null or v_elapsed < 0
     or v_elapsed > v_server_elapsed_ms + v_elapsed_grace
     or v_elapsed > coalesce((v_limits->>'maxElapsedMonotonicMs')::bigint, 691200000) then
    return jsonb_build_object('status', 'REJECTED', 'code', 'CHECKPOINT_OFFSET_OUT_OF_BOUNDS');
  end if;
  v_cutoff := v_checkpoint.anchor_at + make_interval(secs => v_elapsed::double precision / 1000.0);
  if v_save.progression_cutoff_at is not null and v_cutoff < v_save.progression_cutoff_at then
    return jsonb_build_object('status', 'REJECTED', 'code', 'CUTOFF_REGRESSION');
  end if;

  if v_save.character_id is null then
    insert into public.character_saves(
      character_id, user_id, schema_version, save_revision, payload,
      progression_cutoff_at, last_mutation_id, last_client_build_id)
    values (v_character.id, v_user, p_schema_version, 1, p_payload,
            v_cutoff, p_mutation_id, p_build_id);
    v_new_revision := 1;
  else
    update public.character_saves set
      schema_version = p_schema_version,
      save_revision = v_save.save_revision + 1,
      payload = p_payload,
      progression_cutoff_at = v_cutoff,
      last_mutation_id = p_mutation_id,
      last_client_build_id = p_build_id
      where character_id = v_character.id;
    v_new_revision := v_save.save_revision + 1;
  end if;

  insert into public.save_mutation_receipts(
    owner_user_id, mutation_id, character_id, session_id,
    expected_revision, committed_revision, schema_version, build_id,
    checkpoint_id, elapsed_monotonic_ms, request_digest)
  values (v_user, p_mutation_id, v_character.id, p_session_id,
          p_expected_revision, v_new_revision, p_schema_version, p_build_id,
          v_checkpoint_id, v_elapsed, v_digest);

  return jsonb_build_object(
    'status', 'COMMITTED',
    'alreadyCommitted', false,
    'committedRevision', v_new_revision,
    'currentRevision', v_new_revision,
    'progressionCutoffAt', v_cutoff,
    'receipt', jsonb_build_object(
      'mutationId', p_mutation_id,
      'expectedRevision', p_expected_revision,
      'schemaVersion', p_schema_version,
      'buildId', p_build_id,
      'checkpointId', v_checkpoint_id,
      'elapsedMonotonicMs', v_elapsed,
      'requestDigest', v_digest),
    'serverTimeUtc', now());
end;
$$;

-- --------------------------------------------------------------------------
-- heartbeat / revoke / status
-- --------------------------------------------------------------------------

-- Validates the admitted session, returns server time plus a fresh bounded
-- time checkpoint for the account's live character (null checkpoint while the
-- account has no character yet). Successful saves count as health evidence too;
-- this RPC exists so a session can renew its lease without writing a save.
create or replace function public.heartbeat_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.account_sessions;
  v_character_id uuid;
  v_checkpoint public.time_checkpoints;
begin
  v_session := public._assert_session_protocol(p_session_id);
  select id into v_character_id from public.characters
    where user_id = v_session.user_id and deleted_at is null
    for update; -- lock order: profile -> session -> character
  if v_character_id is null then
    return jsonb_build_object(
      'status', 'OK',
      'serverTimeUtc', now(),
      'checkpoint', null);
  end if;
  v_checkpoint := public._issue_checkpoint(v_session.user_id, v_character_id, p_session_id);
  return jsonb_build_object(
    'status', 'OK',
    'serverTimeUtc', now(),
    'checkpoint', jsonb_build_object(
      'checkpointId', v_checkpoint.id,
      'anchorAt', v_checkpoint.anchor_at,
      'leaseExpiresAt', v_checkpoint.lease_expires_at));
end;
$$;

-- Explicit, idempotent logout semantics. Protocol-agnostic by design: a session
-- that predates versioned admission must still be revocable.
create or replace function public.revoke_current_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  v_user := public._lock_caller_profile();
  update public.account_sessions set revoked_at = now()
    where id = p_session_id and user_id = v_user and revoked_at is null;
  return jsonb_build_object('status', 'REVOKED', 'serverTimeUtc', now());
end;
$$;

-- Contract phase: 'prepare' while the dual surface is live, 'cutover' after
-- 202609300002 removes the legacy overloads/policies.
create or replace function public.beta_contract_phase()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phase text;
begin
  select value #>> '{}' into v_phase from public.backend_config where key = 'contractPhase';
  return coalesce(v_phase, 'unknown');
end;
$$;

-- Observational only (spec B1.3): the boot/B6 compatibility projection. Never
-- carries private state and is granted to authenticated only - unauthenticated
-- callers get nothing.
create or replace function public.get_backend_status()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cfg jsonb;
begin
  select jsonb_object_agg(key, value) into v_cfg from public.backend_config;
  return jsonb_build_object(
    'status', 'OK',
    'contractPhase', coalesce(v_cfg->'contractPhase', 'null'::jsonb),
    'protocolVersion', coalesce(v_cfg->'protocolVersion', 'null'::jsonb),
    'supportedProtocolVersions', coalesce(v_cfg->'supportedProtocolVersions', '[]'::jsonb),
    'acceptedSaveSchemaVersions', coalesce(v_cfg->'acceptedSaveSchemaVersions', '[]'::jsonb),
    'maintenance', coalesce(v_cfg->'maintenance', '{"enabled": false}'::jsonb),
    'minClientVersion', coalesce(v_cfg->'minClientVersion', 'null'::jsonb),
    'supportedClientVersions', coalesce(v_cfg->'supportedClientVersions', '[]'::jsonb),
    'serverTimeUtc', now());
end;
$$;

-- --------------------------------------------------------------------------
-- operator inventory/compatibility view (direct-SQL only, no api grants)
-- --------------------------------------------------------------------------

create or replace view public.save_inventory_compatibility as
select
  c.id as character_id,
  c.user_id,
  c.name as character_name,
  (c.deleted_at is not null) as character_deleted,
  c.created_at as character_created_at,
  s.schema_version,
  s.save_revision,
  s.updated_at,
  s.progression_cutoff_at,
  s.last_mutation_id,
  s.last_client_build_id,
  public._classify_save_row(s, c) as compatibility,
  coalesce(octet_length(s.payload::text), 0) as payload_bytes,
  (select count(*) from public.save_mutation_receipts r where r.character_id = c.id) as receipt_count
from public.characters c
left join public.character_saves s on s.character_id = c.id;

comment on view public.save_inventory_compatibility is
  'BETA cutover inventory: one row per character with its save classification (ready/uninitialized/empty-payload/incompatible-schema/version-mismatch/invalid-payload/invalid-shape/owner-mismatch). Operator/direct-SQL only - granted to no api role.';

-- --------------------------------------------------------------------------
-- grants: api roles see only the callable surface
-- --------------------------------------------------------------------------

-- New tables/view: deny every api role. All access is definer-side.
revoke all on public.backend_config from public, anon, authenticated, service_role;
revoke all on public.time_checkpoints from public, anon, authenticated, service_role;
revoke all on public.save_mutation_receipts from public, anon, authenticated, service_role;
revoke all on public.save_inventory_compatibility from public, anon, authenticated, service_role;

-- Internal helpers: callable only inside the definer functions.
revoke all on function public._lock_caller_profile() from public, anon, authenticated, service_role;
revoke all on function public._assert_session_locked(uuid) from public, anon, authenticated, service_role;
revoke all on function public._assert_session_protocol(uuid) from public, anon, authenticated, service_role;
revoke all on function public._issue_checkpoint(uuid, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public._classify_save_row(public.character_saves, public.characters) from public, anon, authenticated, service_role;
revoke all on function public._check_save_payload(integer, jsonb, public.characters) from public, anon, authenticated, service_role;

-- New public RPCs: authenticated only.
revoke all on function public.claim_active_session(text, integer, text) from public, anon, service_role;
revoke all on function public.create_character(uuid, uuid, text, text[], text) from public, anon, service_role;
revoke all on function public.load_game_state(uuid) from public, anon, service_role;
revoke all on function public.write_character_save(uuid, bigint, integer, jsonb, text, uuid, jsonb) from public, anon, service_role;
revoke all on function public.heartbeat_session(uuid) from public, anon, service_role;
revoke all on function public.revoke_current_session(uuid) from public, anon, service_role;
revoke all on function public.beta_contract_phase() from public, anon, service_role;
revoke all on function public.get_backend_status() from public, anon, service_role;

grant execute on function public.claim_active_session(text, integer, text) to authenticated;
grant execute on function public.create_character(uuid, uuid, text, text[], text) to authenticated;
grant execute on function public.load_game_state(uuid) to authenticated;
grant execute on function public.write_character_save(uuid, bigint, integer, jsonb, text, uuid, jsonb) to authenticated;
grant execute on function public.heartbeat_session(uuid) to authenticated;
grant execute on function public.revoke_current_session(uuid) to authenticated;
grant execute on function public.beta_contract_phase() to authenticated;
grant execute on function public.get_backend_status() to authenticated;
