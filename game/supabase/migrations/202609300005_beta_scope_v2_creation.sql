-- BETA SCOPE LOCK v2 (phase-2) - character creation contract, server side.
--
-- Client authority: core/betaScope.ts
--   BETA_MORTAL_STARTER_SKILL_ID ('linh_bao') - the starter pick is no
--   longer a creation choice; the domain admission point
--   (setMortalBasicSkill) fails closed on anything else, and this RPC
--   mirrors it so the server never provisions a non-beta starter.
--   BETA_CREATION_TALENT_IDS - the 18 talent ids the creation offer may
--   emit (the 19-entry catalog minus 'pham_cot', the hidden/perfection
--   lineage feeder). The roll draws only from ids on that list.
--
-- public.talents carried the retired v3 catalog; it is reseeded with the
-- v4 catalog (data/talent/Talents.ts) so the roll emits ids the client
-- actually knows. Out-of-scope rows stay seeded but enabled=false -
-- 'pham_cot' plus the parked entries (the weight>0 check cannot hold a
-- zero weight, so parked rows keep a nominal 1 and never roll).
--
-- create_character keeps its signature (the client always sends the
-- constant); write_character_save's payload-vs-row cross-check is left
-- untouched - a save built by the client always carries 'linh_bao'.

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
      'hoa_hau_thong_than','bach_luyen_thanh_khi'
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

-- v4 talent catalog seed (mirrors data/talent/Talents.ts). enabled=false
-- rows are out of beta scope: pham_cot (hidden/perfection feeder) and the
-- parked tran_tam/phu_van/pham_nhan_chi_cot (nominal weight 1 - the column
-- check cannot hold 0 - but enabled=false keeps them unrollable).
insert into public.talents(id,name,description,rarity,weight,tags,enabled) values
('kiem_quang','Kiếm Quang','Kiếm tâm sáng như sao chiều. Mỗi đòn chí mạng tích 1 tầng Kiếm Mạch (+1% chí mạng, tối đa 10 tầng); đủ 10 tầng hóa Kiếm Vực 8 giây — mọi đòn đều chí mạng. Ngược lại: ngoài Kiếm Vực không được cộng chí mạng nào khác từ thiên phú.','thien',4,array['combat','skill'],true),
('pha_giap','Phá Giáp','Giáp địch chỉ là lớp vỏ chờ kiếm gọt. Mỗi đòn trúng tích 1 tầng Mổ Tạc (+2% xuyên giáp, tối đa 5 tầng trong trận); hết trận giữ lại một nửa tầng mang sang trận sau — đổi cảnh giới thì vết kiếm cũ tan đi. Ngược lại: chỉ số xuyên không được cộng từ nguồn thiên phú nào khác.','dia',12,array['combat'],true),
('tat_phong','Tật Phong','Gió theo sát từng đường kiếm. Mỗi lần diệt địch +2% tốc đánh, cộng dồn không giới hạn trong trận. Ngược lại: bị trúng MỘT đòn là mất sạch toàn bộ tầng đã tích.','linh',28,array['combat','risk_reward'],true),
('trong_kich','Trọng Kích','Kiếm nặng mạch chậm, trúng là trúng thật. Mỗi chí mạng +2% sát thương chí mạng (tối đa 3 tầng); đủ 3 tầng bùng +30% sát thương cuối trong 8 giây rồi tích lại. Ngược lại: chỉ số này không cộng thêm từ nguồn thiên phú nào khác.','linh',28,array['combat'],true),
('hap_linh','Hấp Linh','Máu địch là thuốc của ngươi. Hút máu hiệu lực gấp 2.5 lần người thường — nhưng chỉ khi sinh lực dưới 50%. Trên ngưỡng đó, huyết mạch im lặng hoàn toàn.','pham',55,array['combat','risk_reward'],true),
('thach_giap','Thạch Giáp','Thân thể như núi đá. Mỗi lần chặn đòn thành công +2% phòng thủ (tối đa 10 tầng); đủ 10 tầng hóa Thạch Nham 5 giây — giảm 50% sát thương nhận vào. Ngược lại: ngoài Thạch Nham, phòng thủ không cộng từ nguồn thiên phú nào khác.','pham',55,array['defense'],true),
('vo_anh','Vô Ảnh','Thân pháp vô ảnh. Mỗi lần né đòn +2% né (tối đa 5 tầng); đủ 5 tầng hóa Sát Na 6 giây — +30% chí mạng, +20% tốc đánh. Ngược lại: chỉ số né không cộng từ nguồn thiên phú nào khác.','linh',28,array['defense','mechanic'],true),
('can_than','Cẩn Thận','Sát tử đường mới lạnh lòng. Khi sinh lực dưới 35%: mọi sát thương nhận vào giảm 10%. Khi an toàn trên ngưỡng: ngược lại dễ chủ quan, nhận thêm 5% sát thương — lưỡi kiếm hai cạnh.','linh',28,array['defense','risk_reward'],true),
('ho_the','Hộ Thể','Khiên này vỡ, khiên khác sinh. Khi Hộ Thuẫn vỡ hẳn: nổ sát thương quanh mình bằng 30% dung lượng khiên đã mất và Hộ Thuẫn hồi nhanh gấp nhiều lần trong 5 giây. Ngược lại: ngoài cữ bùng phát, tốc hồi khiên không đổi.','dia',12,array['defense','mechanic'],true),
('thu_phat','Thứ Phạt','Đòn nào ăn vào, gai đó sắc thêm. Bị đánh +30% gai phản; mỗi lần phản tích 1 tầng Hận Thứ (tối đa 5, mỗi tầng +5% phản). Không bị đánh 3 giây liên tiếp — gai lụi dần từng tầng.','pham',55,array['defense'],true),
('bat_tu_the','Bất Tử Thể','Trời sinh mệnh cứng, một chân đã bước qua cửa tử. Mỗi trận, lần đầu nhận đòn chí mạng sẽ không chết, giữ lại 1 điểm sinh lực, tẩy mọi debuff và hóa Tử Sinh Ngộ 10 giây (+30% sát thương cuối, +20% né chí mạng). Độ Kiếp là nghi lễ thật — thiên phú này không áp dụng.','dia',12,array['defense','mechanic'],true),
('pham_cot','Phàm Cốt','Ngươi sinh ra chính là người bình thường, lớn lên là kẻ bình thường, sau này khả năng vẫn sẽ luôn như vậy ...','di',1,array['mechanic','risk_reward'],false),
('ho_tich_bat_phat','Hậu Tích Bạt Phát','Đại khí tự chứa, một khi bộc phát không gì cản nổi. Trong một cảnh giới: tầng một tu chậm hơn một nửa (−50%), mỗi tiểu tầng sau nhanh thêm 10% — càng sâu càng vượt người thường. Ngược lại: tầng đầu của mọi cảnh giới luôn là khoản nợ thời gian.','linh',28,array['cultivation','risk_reward'],true),
('loi_kiep','Lôi Kiếp','Thiên đạo càng đè, đạo tâm càng cứng. Lôi kiếp của ngươi mạnh gấp đôi người thường — nhưng mỗi lần độ kiếp thành công, toàn thân chỉ số vĩnh viễn tăng thêm một thành (10%). Ngược lại: kiếp mạnh gấp đôi nghĩa là cái chết thật sự gần hơn.','dia',12,array['cultivation','risk_reward'],true),
('van_dao','Vấn Đạo','Hỏi một được mười, ngộ một thấu trăm. Mỗi lần lĩnh ngộ node có 50% khả năng không tốn Cảm Ngộ; Cảm Ngộ nhận từ chiến đấu tăng 100%. Ngược lại: dòng Cảm Ngộ của thiên hạ đã cạn dần — phần căn bản mỗi trận ít hơn trước.','dia',12,array['resource','mechanic'],true),
('hai_na','Hải Nạp','Trăm sông đổ về biển, không một giọt nào mất. 100% tu vi tràn qua cửa ải được dồn vào một vực ngầm, tự rót sang tầng kế tiếp khi đột phá. Ngược lại: không nhanh hơn ai, chỉ là không lãng phí.','pham',55,array['cultivation'],true),
('ngo_dao','Ngộ Đạo','Đạo ở khắp nơi, chẳng riêng gì trong chém giết. Mỗi 2.000 tu vi tích lũy được chuyển hóa thành 1 điểm Cảm Ngộ — kể cả lúc ngươi rời đạo tràng (tu vi ngoại tuyến cũng quy đổi).','linh',28,array['resource','mechanic'],true),
('hoa_hau_thong_than','Hỏa Hầu Thông Thần','Lửa trong lò nghe theo nhịp tim ngươi. Mỗi mẻ đan thành công cho ra gấp đôi số viên (×2); đan ngươi dùng có hiệu quả tăng thêm một nửa (50%). Ngược lại: mỗi mẻ luyện tốn gấp đôi gỗ nhiên liệu và gấp đôi Linh Thạch — lò đôi, giá đôi.','dia',12,array['crafting','mechanic'],true),
('bach_luyen_thanh_khi','Bách Luyện Thành Khí','Người thường tôi trăm lần mới thành — lò của ngươi không biết chữ hỏng. Cường Hóa không bao giờ thất bại (tỉ lệ thành công luôn 100%). Ngược lại: mỗi lần rèn tốn ×3 nguyên liệu và ×3 Linh Thạch so với người thường — chắc chắn thì trả giá đắt.','dia',12,array['crafting','mechanic'],true),
('tran_tam','Trận Tâm','Trận pháp khắc lên trang bị cũng biết đánh trả — Trận socket cấp hiệu ứng on-hit khi chiến đấu. (Chưa mở: đợi Trận nhận trigger.)','linh',1,array['crafting','mechanic'],false),
('phu_van','Phù Văn','Phù hiệu lực 20% không tiêu hao khi kích hoạt. (Chưa mở: đợi Phù có cơ chế uses/proc.)','linh',1,array['crafting','mechanic'],false),
('pham_nhan_chi_cot','Phàm Nhân Chi Cốt','Đại nạn bất tử, phàm thai hữu đạo. Tốc độ tu luyện tăng 75%.','di',1,array['cultivation','mechanic','risk_reward'],false)
on conflict (id) do update set name=excluded.name,description=excluded.description,rarity=excluded.rarity,weight=excluded.weight,tags=excluded.tags,enabled=excluded.enabled;
