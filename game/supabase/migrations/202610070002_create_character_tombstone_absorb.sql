-- W6-COR-1: characters.user_id carries a NOT NULL UNIQUE constraint that
-- was never dropped, so one account holds at most one characters row -
-- live OR tombstone. The wave-5 predicates migration filtered deleted_at
-- out of the create_character existence checks so a tombstoned account
-- passed both gates and then crashed on the unique constraint at INSERT
-- (unique_violation -> opaque 4xx -> "server refused the request").
--
-- Fix: absorb the tombstone inside create_character before inserting -
-- the same hard-delete rationale reset_character already applies
-- (202610070001): a row with deleted_at is dead weight the single-row
-- invariant cannot keep. A live row still short-circuits CHARACTER_EXISTS
-- earlier, so this delete only ever touches tombstones.

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
  -- user_id is UNIQUE over ALL rows including tombstones: absorb any
  -- tombstoned row here so the insert below cannot hit unique_violation.
  -- Cascades drop its orphaned saves/checkpoints/receipts.
  delete from public.characters
    where user_id = v_session.user_id and deleted_at is not null;
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
