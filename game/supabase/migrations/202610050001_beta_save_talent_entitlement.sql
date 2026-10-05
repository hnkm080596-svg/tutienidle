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
--
-- W2 (fixpoint 2026-10-05): the mirror was missing the rest of F-TAL-1 -
-- the pham_cot conversion tolerance (the great_dao breakthrough swaps
-- the creation pick for pham_nhan_chi_cot, so a witnessed save may drop
-- it), the parked-talent ban, the great-dao witness requirement, the
-- creation-catalog cap, and the pool-realm gate. It also returns the
-- rolled talents in draw order like the client's slicing contract
-- (create_character commits the first three) - jsonb_agg without ORDER
-- BY served them in arbitrary table order, and create_character now
-- binds the pick to that first-three offer slice (the UI offers only
-- positions 1-3; accepting any of the nine leaked the injected
-- pham_cot at ~15% per auth roll vs ~5% guest).

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
  if not ('pham_cot' = any(rolled_ids)) and random() < 0.15
     and exists (select 1 from public.talents where id = 'pham_cot' and enabled) then
    rolled_ids[1 + floor(random() * cardinality(rolled_ids))] := 'pham_cot';
  end if;
  insert into public.talent_rolls(user_id, talent_ids) values (auth.uid(), rolled_ids) returning id into roll_id;
  return jsonb_build_object(
    'rollId', roll_id,
    'talents', (select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'description', t.description, 'rarity', t.rarity, 'weight', t.weight, 'tags', t.tags) order by array_position(rolled_ids, t.id)) from public.talents t where t.id = any(rolled_ids))
  );
end;
$$;

-- W2: create_character binds the pick to the offered slice - the client
-- only ever presents talents[0..2] of the roll response, so the server
-- must accept only the first three entries of talent_ids. Accepting
-- all nine let a crafted client claim the injected pham_cot even when
-- it landed outside the offer (~15% per auth roll vs ~5% guest, and a
-- guaranteed claim whenever it was visible in the response).
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
  if p_name is null or char_length(trim(p_name)) not between 2 and 20
     or exists (select 1 from public.characters where normalized_name = lower(trim(p_name))) then
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
