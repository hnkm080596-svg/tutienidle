-- AUT-AUTH-1 (fixpoint 2026-10-05): write_character_save's talent check
-- required the payload's selectedTalentIds to be set-equal to
-- characters.selected_talent_ids - the creation-time column (cardinality 1,
-- characters_one_talent) no RPC ever updates. But breakthrough entitlements
-- legitimately push pool picks onto player.selectedTalentIds (client
-- validator allows creation pick + realmIndex, saveShapeValidation.ts
-- F-TAL-1), so every authenticated save after the first 'new' talent was
-- rejected with 'selectedTalentIds mismatch' - silently, forever.
--
-- The mirror now binds identity the same way the client does: the
-- provisioned creation pick must REMAIN INSIDE the payload list, no
-- duplicate ids, and cardinality <= 1 + realmIndex (REALMS order mirrored
-- from src/data/realms/realm.ts). Deeper gameplay checks (pool-realm
-- gating, parked ids, great-dao witness) stay client-side per the
-- function's shape-mirror contract.
--
-- AUT-DRIFT-1: create_talent_roll gains the client's flat 15% pham_cot
-- offer injection (rollCharacterCreationTalents' PHAM_COT_OFFER_CHANCE) -
-- previously server rolls offered it only by weight (~2%) while guest
-- rolls hit ~16%, an ~8x drift between auth and mock paths.

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
  v_realm_index integer;
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
  -- Talent identity + earnability ceiling (mirrors client F-TAL-1):
  -- the provisioned creation pick must stay inside the payload list;
  -- breakthrough entitlements legitimately grow it, bounded by
  -- creation pick count + realmIndex(player.realmId). Duplicate ids
  -- are unreachable for real writers (one id per slot).
  if not (v_character_talents <@ coalesce(v_payload_talents, array[]::text[])) then
    return jsonb_build_object('code', 'SAVE_INVALID', 'detail', 'selectedTalentIds missing creation pick');
  end if;
  v_realm_index := case coalesce(p_payload->'player'->>'realmId', '')
    when 'mortal' then 0
    when 'qi_refining' then 1
    when 'foundation_establishment' then 2
    when 'golden_core' then 3
    when 'nascent_soul' then 4
    when 'soul_transformation' then 5
    when 'void_refinement' then 6
    when 'body_integration' then 7
    when 'mahayana' then 8
    when 'tribulation' then 9
    else -1 end;
  if cardinality(v_payload_talents) > 1 + greatest(v_realm_index, 0) then
    return jsonb_build_object('code', 'SAVE_INVALID', 'detail', 'selectedTalentIds exceeds pick ceiling');
  end if;
  if cardinality(v_payload_talents) <> (
    select count(distinct val) from unnest(v_payload_talents) as u(val)
  ) then
    return jsonb_build_object('code', 'SAVE_INVALID', 'detail', 'selectedTalentIds duplicate id');
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

create or replace function public.create_talent_roll(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare roll_id uuid; rolled_ids text[];
begin
  perform public.assert_active_session(p_session_id);
  update public.talent_rolls set consumed_at = now() where user_id = auth.uid() and consumed_at is null;
  -- Beta offer pool: enabled AND beta-admitted - the allow-list mirrors
  -- core/betaScope.ts::BETA_CREATION_TALENT_IDS.
  select array_agg(id) into rolled_ids from (
    select id from public.talents
    where enabled and id = any(array[
      'kiem_quang','pha_giap','tat_phong','trong_kich','hap_linh',
      'thach_giap','vo_anh','can_than','ho_the','thu_phat','bat_tu_the',
      'ho_tich_bat_phat','loi_kiep','van_dao','hai_na','ngo_dao',
      'hoa_hau_thong_than','bach_luyen_thanh_khi','pham_cot'
    ])
    order by -ln(greatest(random(), 0.000001)) / weight limit 9
  ) weighted;
  if cardinality(rolled_ids) <> 9 then raise exception 'not enough enabled talents'; end if;
  -- Flat Easter-egg offer, mirroring client PHAM_COT_OFFER_CHANCE = 0.15:
  -- weight-draw alone surfaces pham_cot ~2% of rolls; the client replaces a
  -- random slot at 15% so the Dai-Dao seed is findable. Auth rolls must
  -- share the same distribution (AUT-DRIFT-1).
  if not ('pham_cot' = any(rolled_ids)) and random() < 0.15 then
    rolled_ids[1 + floor(random() * cardinality(rolled_ids))] := 'pham_cot';
  end if;
  insert into public.talent_rolls(user_id, talent_ids) values (auth.uid(), rolled_ids) returning id into roll_id;
  return jsonb_build_object(
    'rollId', roll_id,
    'talents', (select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'description', t.description, 'rarity', t.rarity, 'weight', t.weight, 'tags', t.tags)) from public.talents t where t.id = any(rolled_ids))
  );
end;
$$;
