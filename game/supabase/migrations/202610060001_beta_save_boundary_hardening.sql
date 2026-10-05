-- Beta save-boundary hardening (wave-4 follow-up).
-- 1) _check_save_payload: player.nodeLevels is consumed by jsonb_each /
--    field navigation below; a non-object value raised inside the set
--    function and escaped the SAVE_INVALID contract as a generic error,
--    which the journal mapped to retry-same instead of quarantine. Guard
--    the type before the checks that read it.
-- 2) create_character: name-format rejection previously shared the
--    CHARACTER_NAME_UNAVAILABLE code with a taken name, so a malformed
--    (or client-valid-but-non-mirrorable) name displayed "already
--    taken". Format failures now return CHARACTER_NAME_INVALID so the
--    client can show an honest message.

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
  -- Mirrors CHARACTER_CREATION_TALENTS / PARKED_TALENT_IDS /
  -- TALENT_POOL_REALM_BY_ID from src/data/talent.
  v_creation_catalog constant text[] := array[
    'kiem_quang','pha_giap','tat_phong','trong_kich','hap_linh',
    'thach_giap','vo_anh','can_than','ho_the','thu_phat','bat_tu_the',
    'ho_tich_bat_phat','loi_kiep','van_dao','hai_na','ngo_dao',
    'hoa_hau_thong_than','bach_luyen_thanh_khi','pham_cot'
  ];
  v_parked_talents constant text[] := array['tran_tam','phu_van'];
  v_pool_min_realm constant jsonb := '{
    "lk_linh_mach":1,"lk_dung_nap":1,"lk_tam_tue":1,"lk_ngo_tinh":1,"lk_bac_hai":1,
    "tc_dia_can":2,"tc_thien_co":2,"tc_kim_lan":2,"tc_truc_hon":2,"tc_linh_giac":2,"tc_huyet_nhuc":2,
    "kd_thanh_dan":3,"kd_linh_dan":3
  }'::jsonb;
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
    -- Conversion tolerance: the pham_cot creation pick may leave the
    -- list only when the great_dao witness recorded the hidden
    -- breakthrough that swapped it for the reward talent
    -- (pham_nhan_chi_cot's own validity is checked per-id below).
    if not (
      'pham_cot' = any(v_character_talents)
      and v_character_talents <@ (coalesce(v_payload_talents, array[]::text[]) || array['pham_cot'])
      and coalesce(p_payload->'player'->>'highestFoundationAchieved', '') = 'great_dao'
    ) then
      return jsonb_build_object('code', 'SAVE_INVALID', 'detail', 'selectedTalentIds missing creation pick');
    end if;
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
  -- Locked-content rules (F-TAL-1 per-id checks): parked talents carry
  -- weight 0 - no writer grants one; great-dao rewards mint only from
  -- the pham_cot conversion and need its witness record; the
  -- creation-catalog ids are capped at the creation pick count.
  if exists (
    select 1 from unnest(v_payload_talents) as t(id)
    where t.id = any(v_parked_talents)
  ) then
    return jsonb_build_object('code', 'SAVE_INVALID', 'detail', 'selectedTalentIds carries parked talent');
  end if;
  if 'pham_nhan_chi_cot' = any(v_payload_talents)
     and coalesce(p_payload->'player'->>'highestFoundationAchieved', '') <> 'great_dao' then
    return jsonb_build_object('code', 'SAVE_INVALID', 'detail', 'selectedTalentIds great-dao reward without witness');
  end if;
  if (
    select count(*) from unnest(v_payload_talents) as t(id)
    where t.id = any(v_creation_catalog)
  ) > 1 then
    return jsonb_build_object('code', 'SAVE_INVALID', 'detail', 'selectedTalentIds exceeds creation pick count');
  end if;
  -- Pool-realm gate (F-A10-1): a pool pick is minted by a victory into
  -- its realm - holding one below that realm is fabricated. Unknown
  -- realmId skips the gate like the client (talentRealmIndex < 0).
  if v_realm_index >= 0 and exists (
    select 1
    from unnest(v_payload_talents) as t(id)
    cross join lateral (
      select (v_pool_min_realm ->> t.id)::integer as min_idx
    ) as r
    where r.min_idx is not null and r.min_idx > v_realm_index
  ) then
    return jsonb_build_object('code', 'SAVE_INVALID', 'detail', 'selectedTalentIds pool talent above realm');
  end if;
  -- mortalBasicSkillId is mortal-scoped on the client (absent after initiation);
  -- when present it must equal the provisioned starter pick.
  if p_payload->'player' ? 'mortalBasicSkillId'
     and coalesce(p_payload->'player'->>'mortalBasicSkillId', '') <> p_character.mortal_basic_skill_id then
    return jsonb_build_object('code', 'SAVE_INVALID', 'detail', 'mortalBasicSkillId mismatch');
  end if;
  -- W3 boundary mirror (fixpoint AUT-1/COR-2): every payload class the
  -- client load seams reject must be rejected here too, or a row the
  -- server marks 'ready' wedges on its next client read.

  -- COR-2: talent ids must be jsonb strings - the text-cast above
  -- silently coerces 5 -> '5', so a non-string entry would pass the
  -- subset/ceiling checks while the client's typeof gate rejects it.
  if exists (
    select 1
    from jsonb_array_elements(p_payload->'player'->'selectedTalentIds') as e(val)
    where jsonb_typeof(e.val) <> 'string'
  ) then
    return jsonb_build_object('code', 'SAVE_INVALID', 'detail', 'selectedTalentIds non-string entry');
  end if;

  -- Realm witness mirror (client saveShapeValidation): an unknown
  -- realmId is rejected outright, any realm beyond the release ceiling
  -- 'foundation_establishment' is unproducible, and a qi_refining+
  -- claim requires its initiation receipts (non-empty techniques,
  -- breakthroughGrade >= 1) plus the foundation victory record at
  -- foundation_establishment.
  if v_realm_index < 0 then
    return jsonb_build_object('code', 'SAVE_INVALID', 'detail', 'unknown realmId');
  end if;
  if v_realm_index > 2 then
    return jsonb_build_object('code', 'SAVE_INVALID', 'detail', 'realmId beyond release ceiling');
  end if;
  if v_realm_index >= 1 then
    if jsonb_array_length(p_payload->'techniques') < 1 then
      return jsonb_build_object('code', 'SAVE_INVALID', 'detail', 'realm >= qi_refining with empty techniques');
    end if;
    if jsonb_typeof(p_payload->'player'->'breakthroughGrade') is distinct from 'number'
       or (p_payload->'player'->>'breakthroughGrade')::numeric < 1 then
      return jsonb_build_object('code', 'SAVE_INVALID', 'detail', 'realm >= qi_refining with breakthroughGrade < 1');
    end if;
  end if;
  if v_realm_index >= 2
     and coalesce(p_payload->'player'->>'highestFoundationAchieved', '') = '' then
    return jsonb_build_object('code', 'SAVE_INVALID', 'detail', 'realm >= foundation_establishment without victory record');
  end if;

  -- Atomic-pair mortal gate: cultivationPath/cultivationWay only exist
  -- post-initiation, so a mortal save carrying either is fabricated.
  if v_realm_index = 0
     and (p_payload->'player' ? 'cultivationPath' or p_payload->'player' ? 'cultivationWay') then
    return jsonb_build_object('code', 'SAVE_INVALID', 'detail', 'cultivation pair on mortal save');
  end if;

  -- nodeLevels feeds the lateral set-functions below; a present
  -- non-object (null/scalar/array) value raised inside jsonb_each and
  -- escaped the SAVE_INVALID contract. An absent key stays legal (no
  -- nodes bought yet).
  if p_payload->'player' ? 'nodeLevels'
     and jsonb_typeof(p_payload->'player'->'nodeLevels') is distinct from 'object' then
    return jsonb_build_object('code', 'SAVE_INVALID', 'detail', 'player.nodeLevels must be an object');
  end if;

  -- Beta element boundary (F-SCOPE-1 + kit coherence mirror): a
  -- committed spell/spell_pathway save must carry 'fire' - the only
  -- beta element - and the fire basic the commit granted atomically;
  -- the four non-beta element roots, or the fire root without the
  -- committed pair, are unproducible claims.
  if coalesce(p_payload->'player'->>'cultivationPath', '') = 'spell'
     and coalesce(p_payload->'player'->>'cultivationWay', '') = 'spell_pathway'
     and v_realm_index >= 1 then
    if coalesce(p_payload->'player'->'spellPath'->>'element', '') <> 'fire' then
      return jsonb_build_object('code', 'SAVE_INVALID', 'detail', 'committed spell_pathway element outside beta scope');
    end if;
    if not exists (
      select 1
      from jsonb_array_elements(p_payload->'skills') as s(v)
      where jsonb_typeof(s.v) = 'object' and s.v->>'id' = 'hoa_cau_thuat'
    ) then
      return jsonb_build_object('code', 'SAVE_INVALID', 'detail', 'committed fire element missing kit basic');
    end if;
  end if;
  if exists (
    select 1
    from jsonb_each(coalesce(p_payload->'player'->'nodeLevels', '{}'::jsonb)) as n(k, v)
    where jsonb_typeof(n.v) = 'number'
      and (n.v #>> '{}')::numeric >= 1
      and n.k = any(array['thuy_linh_ngo','moc_linh_ngo','kim_linh_ngo','tho_linh_ngo'])
  ) then
    return jsonb_build_object('code', 'SAVE_INVALID', 'detail', 'non-beta element root claim');
  end if;
  if jsonb_typeof(p_payload->'player'->'nodeLevels'->'hoa_linh_ngo') = 'number'
     and (p_payload->'player'->'nodeLevels'->>'hoa_linh_ngo')::numeric >= 1
     and not (
       coalesce(p_payload->'player'->>'cultivationPath', '') = 'spell'
       and coalesce(p_payload->'player'->>'cultivationWay', '') = 'spell_pathway'
       and v_realm_index >= 1
       and coalesce(p_payload->'player'->'spellPath'->>'element', '') = 'fire'
     ) then
    return jsonb_build_object('code', 'SAVE_INVALID', 'detail', 'fire root claim without committed element');
  end if;

  -- pendingTalentEntitlement.realmId must be a real realm id when the
  -- record is present (client shape emits on catalog misses).
  if jsonb_typeof(p_payload->'player'->'pendingTalentEntitlement') = 'object'
     and jsonb_typeof(p_payload->'player'->'pendingTalentEntitlement'->'realmId') = 'string'
     and not (p_payload->'player'->'pendingTalentEntitlement'->>'realmId' = any(
       array['mortal','qi_refining','foundation_establishment','golden_core','nascent_soul',
             'soul_transformation','void_refinement','body_integration','mahayana','tribulation']
     )) then
    return jsonb_build_object('code', 'SAVE_INVALID', 'detail', 'pendingTalentEntitlement.realmId unknown');
  end if;
  return null;
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
  if exists (select 1 from public.characters where normalized_name = lower(trim(p_name))) then
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
