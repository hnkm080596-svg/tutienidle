-- 202610070001: tombstone-aware character predicates + reset protocol gate.
--
-- W5-COR-3: the 'deleted' -> creation route rested on a false premise -
-- create_character's exists-check, the name-availability probe, and the
-- characters_reserved_name_unique index all counted tombstones, so an
-- account with a soft-deleted row could never re-create (CHARACTER_EXISTS
-- on every submit -> reload loop). Additionally every authority lookup
-- resolves "the" character by user_id with no deleted_at filter, so a
-- live row coexisting with a tombstone could pick the tombstone.
--
-- Fixes:
--   1. create_character: exists/name checks count only live rows
--      (deleted_at is null) - CHARACTER_EXISTS fires only while a live
--      character exists, and a tombstone's name is reusable.
--   2. characters_reserved_name_unique becomes a partial unique index
--      (live rows only) matching those predicates.
--   3. is_character_name_available: same live-only predicate so the
--      pre-submit probe agrees with create_character.
--   4. load_game_state / write_character_save: live-row-first ordering -
--      a live row wins over a coexisting tombstone; a tombstone-only
--      account still surfaces CHARACTER_DELETED.
--   5. reset_character: _assert_session_locked -> _assert_session_protocol
--      for symmetry with every other boundary RPC (a stale-protocol
--      session can no longer delete its own character).
--
-- Function bodies are verbatim from the newest defining migrations
-- (load/write: 202609300001; create: 202610060001; name probe: 202608240001;
-- reset: 202610060002) with only the marked predicate changes.

-- The unique index over normalized_name must match the new predicates:
-- only live names are reserved.
drop index if exists public.characters_reserved_name_unique;
create unique index characters_reserved_name_unique
  on public.characters(normalized_name) where deleted_at is null;

create or replace function public.is_character_name_available(p_session_id uuid, p_name text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_active_session(p_session_id);
  return not exists (
    select 1 from public.characters
     where normalized_name = lower(trim(p_name)) and deleted_at is null
  );
end;
$$;


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
  -- Live-row-first: a soft-deleted tombstone may coexist with a fresh
  -- character (create_character only counts live rows); take the live
  -- row so load/write act on it, falling back to the tombstone so a
  -- delete-only account still reports CHARACTER_DELETED.
  select * into v_character from public.characters
    where user_id = v_session.user_id
    order by (deleted_at is null) desc, created_at desc
    limit 1
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
  -- Live-row-first ordering (see load_game_state): commit against the
  -- live character when a tombstone coexists; a delete-only account
  -- still resolves the tombstone and is rejected CHARACTER_DELETED.
  select * into v_character from public.characters
    where user_id = v_user
    order by (deleted_at is null) desc, created_at desc
    limit 1
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
  -- Only a live character blocks creation: reset_character hard-deletes
  -- and the 7-day reservation design may leave a tombstone; neither
  -- should produce a CHARACTER_EXISTS wedge on re-creation.
  if exists (select 1 from public.characters where user_id = v_session.user_id and deleted_at is null) then
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
     or not p_talent_ids <@ (v_roll.talent_ids)[1:3] then
    return jsonb_build_object('status', 'REJECTED', 'code', 'INVALID_TALENT_SELECTION');
  end if;
  -- AUT-2: charset mirror - the client only produces letters, digits,
  -- space, underscore and hyphen (isValidCharacterName), so other
  -- characters are always a crafted request.
  -- Format failures are a distinct code from a taken name: folding them
  -- into CHARACTER_NAME_UNAVAILABLE showed "name already taken" for a
  -- name nobody owned.
  if p_name is null or char_length(trim(p_name)) not between 2 and 20
     or trim(p_name) !~ '^[[:alnum:] _-]+$' then
    return jsonb_build_object('status', 'REJECTED', 'code', 'CHARACTER_NAME_INVALID');
  end if;
  if exists (select 1 from public.characters where normalized_name = lower(trim(p_name)) and deleted_at is null) then
    return jsonb_build_object('status', 'REJECTED', 'code', 'CHARACTER_NAME_UNAVAILABLE');
  end if;
  -- Beta scope: the mortal starter is fixed - 'linh_bao' is the only
  -- legal pick, mirroring core/betaScope.ts::BETA_MORTAL_STARTER_SKILL_ID.
  if p_mortal_basic_skill_id is null
     or p_mortal_basic_skill_id <> 'linh_bao' then
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


create or replace function public.reset_character(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.account_sessions;
  v_character public.characters;
begin
  v_session := public._assert_session_protocol(p_session_id);
  -- Same canonical ordering as load/write: a live row wins over a
  -- tombstone; with only a tombstone the reset still removes it instead of
  -- reporting NO_CHARACTER while a dead row lingers.
  select * into v_character
    from public.characters
    where user_id = v_session.user_id
    order by (deleted_at is null) desc, created_at desc
    limit 1
    for update;
  if not found then
    return jsonb_build_object('status', 'NO_CHARACTER', 'serverTimeUtc', now());
  end if;
  -- Hard delete: every other authority function resolves "the" character by
  -- user_id without a deleted_at filter, so keeping a tombstone beside a
  -- fresh row would wedge them again. Saves/checkpoints/receipts cascade.
  delete from public.characters where id = v_character.id;
  return jsonb_build_object(
    'status', 'DELETED',
    'characterId', v_character.id,
    'serverTimeUtc', now());
end;
$$;

