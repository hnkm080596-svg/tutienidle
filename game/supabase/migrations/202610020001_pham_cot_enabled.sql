-- pham_cot restore - the beta "hidden breakthrough lock" over-reached:
-- it locked the hidden Dai Dao conversion path AND hid the easter-egg
-- talent itself. pham_cot is a normal rollable creation talent (-75%
-- cultivation speed); only its hidden conversion path stays locked
-- (canProgressHiddenBody via hiddenContent), not the talent.
--
-- (a) re-enable the seeded row (202609300005 seeded it enabled=false);
-- (b) re-admit the id to the server-side roll allow-list, mirroring
-- core/betaScope.ts::BETA_CREATION_TALENT_IDS.

update public.talents set enabled = true where id = 'pham_cot';

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
      'hoa_hau_thong_than','bach_luyen_thanh_khi',
      'pham_cot'
    ])
    order by -ln(greatest(random(), 0.000001)) / weight limit 9
  ) weighted;
  if cardinality(rolled_ids) <> 9 then raise exception 'not enough enabled talents'; end if;
  insert into public.talent_rolls(user_id, talent_ids) values (auth.uid(), rolled_ids) returning id into roll_id;
  return jsonb_build_object(
    'rollId', roll_id,
    'talents', (select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'description', t.description, 'rarity', t.rarity, 'weight', t.weight, 'tags', t.tags)) from public.talents t where t.id = any(rolled_ids))
  );
end;
$$;
