create extension if not exists pgcrypto;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  login_id text unique,
  account_kind text not null check (account_kind in ('guest', 'registered')),
  created_at timestamptz not null default now(),
  constraint profiles_login_id_shape check (login_id is null or login_id ~ '^[a-z0-9_]{4,20}$'),
  constraint profiles_registered_has_login check (account_kind = 'guest' or login_id is not null)
);

create table public.account_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_label text not null default 'unknown',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index account_sessions_one_active_per_user on public.account_sessions(user_id) where revoked_at is null;

create table public.talents (
  id text primary key,
  name text not null,
  description text not null,
  rarity text not null check (rarity in ('pham', 'linh', 'dia', 'thien', 'di')),
  weight integer not null check (weight > 0),
  tags text[] not null default '{}',
  enabled boolean not null default true
);

create table public.talent_rolls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  talent_ids text[] not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  consumed_at timestamptz,
  constraint talent_roll_has_nine check (cardinality(talent_ids) = 9)
);

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  selected_talent_ids text[] not null,
  base_attributes jsonb not null,
  realm_id text not null default 'pham_nhan',
  realm_level integer not null default 1,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  permanent_delete_after timestamptz,
  constraint characters_three_talents check (cardinality(selected_talent_ids) = 3),
  constraint characters_name_length check (char_length(name) between 2 and 20)
);
-- Tên tiếp tục được giữ chỗ khi soft-delete; scheduled permanent deletion
-- xóa row sau bảy ngày và khi đó unique slot mới được giải phóng.
create unique index characters_reserved_name_unique on public.characters(normalized_name);

create table public.character_saves (
  character_id uuid primary key references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  schema_version integer not null,
  save_revision bigint not null default 1,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  requested_kind text := coalesce(new.raw_user_meta_data->>'account_kind', 'guest');
  requested_login text := lower(new.raw_user_meta_data->>'login_id');
begin
  insert into public.profiles(user_id, login_id, account_kind)
  values (new.id, case when requested_kind = 'registered' then requested_login else null end, requested_kind);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();

create or replace function public.claim_active_session(p_device_label text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_session_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  update public.account_sessions set revoked_at = now() where user_id = auth.uid() and revoked_at is null;
  insert into public.account_sessions(user_id, device_label)
  values (auth.uid(), left(coalesce(p_device_label, 'unknown'), 160)) returning id into new_session_id;
  return new_session_id;
end;
$$;

create or replace function public.assert_active_session(p_session_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.account_sessions
    where id = p_session_id and user_id = auth.uid() and revoked_at is null
  ) then
    raise exception 'session revoked' using errcode = '28000';
  end if;
  update public.account_sessions set last_seen_at = now() where id = p_session_id;
end;
$$;

create or replace function public.is_character_name_available(p_session_id uuid, p_name text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_active_session(p_session_id);
  return not exists (
    select 1 from public.characters where normalized_name = lower(trim(p_name))
  );
end;
$$;

create or replace function public.create_talent_roll(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare roll_id uuid; rolled_ids text[];
begin
  perform public.assert_active_session(p_session_id);
  update public.talent_rolls set consumed_at = now() where user_id = auth.uid() and consumed_at is null;
  select array_agg(id) into rolled_ids from (
    select id from public.talents where enabled order by -ln(greatest(random(), 0.000001)) / weight limit 9
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
  p_attributes jsonb,
  p_initial_save jsonb,
  p_schema_version integer
) returns uuid language plpgsql security definer set search_path = public as $$
declare roll_row public.talent_rolls; character_id uuid; attribute_total integer;
begin
  perform public.assert_active_session(p_session_id);
  select * into roll_row from public.talent_rolls where id = p_roll_id and user_id = auth.uid() for update;
  if not found or roll_row.consumed_at is not null or roll_row.expires_at <= now() then raise exception 'invalid talent roll'; end if;
  if cardinality(p_talent_ids) <> 3 or cardinality(array(select distinct unnest(p_talent_ids))) <> 3 or not p_talent_ids <@ roll_row.talent_ids then raise exception 'invalid talent selection'; end if;
  if char_length(trim(p_name)) not between 2 and 20 or not public.is_character_name_available(p_session_id, p_name) then raise exception 'character name unavailable'; end if;
  if exists (select 1 from jsonb_each(p_attributes) where key not in ('strength','dexterity','intelligence','attunement','vitality') or jsonb_typeof(value) <> 'number' or (value::text)::numeric < 0 or trunc((value::text)::numeric) <> (value::text)::numeric) then raise exception 'invalid attributes'; end if;
  if (select count(*) from jsonb_object_keys(p_attributes)) <> 5 then raise exception 'invalid attributes'; end if;
  select sum((value::text)::integer) into attribute_total from jsonb_each(p_attributes);
  if attribute_total <> 5 then raise exception 'invalid attribute total'; end if;

  insert into public.characters(user_id, name, normalized_name, selected_talent_ids, base_attributes)
  values (auth.uid(), trim(p_name), lower(trim(p_name)), p_talent_ids, p_attributes) returning id into character_id;
  insert into public.character_saves(character_id, user_id, schema_version, payload)
  values (character_id, auth.uid(), p_schema_version, p_initial_save);
  update public.talent_rolls set consumed_at = now() where id = p_roll_id;
  return character_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.account_sessions enable row level security;
alter table public.talents enable row level security;
alter table public.talent_rolls enable row level security;
alter table public.characters enable row level security;
alter table public.character_saves enable row level security;

create policy profiles_own_read on public.profiles for select using (user_id = auth.uid());
create policy sessions_own_read on public.account_sessions for select using (user_id = auth.uid());
create policy talents_authenticated_read on public.talents for select to authenticated using (enabled);
create policy rolls_own_read on public.talent_rolls for select using (user_id = auth.uid());
create policy characters_own_read on public.characters for select using (user_id = auth.uid());
create policy saves_own_read on public.character_saves for select using (user_id = auth.uid());

revoke all on function public.claim_active_session(text) from public;
revoke all on function public.assert_active_session(uuid) from public;
revoke all on function public.create_talent_roll(uuid) from public;
revoke all on function public.create_character(uuid,uuid,text,text[],jsonb,jsonb,integer) from public;
grant execute on function public.claim_active_session(text) to authenticated;
grant execute on function public.assert_active_session(uuid) to authenticated;
grant execute on function public.is_character_name_available(uuid,text) to authenticated;
grant execute on function public.create_talent_roll(uuid) to authenticated;
grant execute on function public.create_character(uuid,uuid,text,text[],jsonb,jsonb,integer) to authenticated;

insert into public.talents(id,name,description,rarity,weight,tags) values
('tam_tinh','Tâm Tĩnh Như Thủy','Tốc độ tu luyện tăng 8%.','pham',55,array['cultivation']),
('can_cot_vung','Căn Cốt Vững Vàng','Sinh lực tối đa tăng 10%.','pham',55,array['defense']),
('linh_cam','Linh Cảm','Cảm ngộ nhận được từ chiến đấu tăng 8%.','pham',55,array['resource']),
('kiem_tam','Kiếm Tâm Sơ Hiện','Sát thương kỹ năng tăng 8% khi dùng kiếm.','linh',28,array['combat','skill']),
('ngu_hanh_than','Ngũ Hành Thân','Sức mạnh Ngũ Hành tăng 6%.','linh',28,array['element']),
('duoc_duyen','Dược Duyên','Hiệu quả đan dược tăng 12%.','linh',28,array['crafting']),
('bat_khuat','Bất Khuất','Khi thấp hơn 35% sinh lực, giảm 12% sát thương nhận vào.','dia',12,array['defense']),
('thien_sinh_chien_y','Thiên Sinh Chiến Ý','Sát thương tăng 12%, nhưng phòng ngự giảm 6%.','dia',12,array['combat','risk_reward']),
('linh_mach_cong_huong','Linh Mạch Cộng Hưởng','Hồi mana và tốc độ thi triển tăng 10%.','dia',12,array['resource','skill']),
('dao_phap_tu_nhien','Đạo Pháp Tự Nhiên','Mỗi lần đột phá nhận thêm một điểm thuộc tính.','thien',4,array['cultivation','mechanic']),
('nghich_thien','Nghịch Thiên Cải Mệnh','Sát thương tăng 20%, nhưng lôi kiếp gây thêm 10% sát thương.','thien',4,array['risk_reward','mechanic']),
('vo_cau_dao_the','Vô Cấu Đạo Thể','Không nhận điểm thuộc tính tự do; mọi chỉ số chính tăng theo cảnh giới.','di',1,array['mechanic','risk_reward'])
on conflict (id) do update set name=excluded.name,description=excluded.description,rarity=excluded.rarity,weight=excluded.weight,tags=excluded.tags;
