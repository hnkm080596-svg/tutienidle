-- BETA-CREATION forward migration (sealed-review F2).
-- 202608240001_online_auth_character.sql was edited in place — databases that
-- already applied that version never re-run it, so on those databases the
-- v81 overload is still callable, the mortal_basic_skill_id column does not
-- exist, and the new client body resolves to no function. This forward
-- migration converges already-migrated DBs to the fresh-apply shape.

-- Column (bookkeeping mirror of the pick; the client save payload is
-- authoritative). NOT NULL on fresh apply; existing rows get the 'tram'
-- default then the default is dropped so new inserts must supply a value.
alter table public.characters
  add column if not exists mortal_basic_skill_id text;

update public.characters set mortal_basic_skill_id = 'tram'
  where mortal_basic_skill_id is null;

alter table public.characters
  alter column mortal_basic_skill_id set not null;

-- Kill the v81 attribute-distribution overload for real (identity-args form).
drop function if exists public.create_character(uuid,uuid,text,text[],jsonb,jsonb,integer);

create or replace function public.create_character(
  p_session_id uuid,
  p_roll_id uuid,
  p_name text,
  p_talent_ids text[],
  p_mortal_basic_skill_id text,
  p_initial_save jsonb,
  p_schema_version integer
) returns uuid language plpgsql security definer set search_path = public as $$
declare roll_row public.talent_rolls; character_id uuid;
begin
  perform public.assert_active_session(p_session_id);
  select * into roll_row from public.talent_rolls where id = p_roll_id and user_id = auth.uid() for update;
  if not found or roll_row.consumed_at is not null or roll_row.expires_at <= now() then raise exception 'invalid talent roll'; end if;
  -- Client contract: CHARACTER_CREATION_TALENT_COUNT = 1 — one pick from the rolled nine.
  if cardinality(p_talent_ids) <> 1 or cardinality(array(select distinct unnest(p_talent_ids))) <> 1 or not p_talent_ids <@ roll_row.talent_ids then raise exception 'invalid talent selection'; end if;
  if char_length(trim(p_name)) not between 2 and 20 or not public.is_character_name_available(p_session_id, p_name) then raise exception 'character name unavailable'; end if;
  -- No attribute distribution: base stats are the fixed 1/1/1/1/1 default and
  -- the mortal pick must be one of the three precursor ids (tram = Huy Kiem /
  -- linh_bao = Linh Bao / huy_quyen = Huy Quyen), matching
  -- core/skill/MortalPrecursors.ts.
  if p_mortal_basic_skill_id not in ('tram','linh_bao','huy_quyen') then raise exception 'invalid mortal basic skill'; end if;

  insert into public.characters(user_id, name, normalized_name, selected_talent_ids, base_attributes, mortal_basic_skill_id)
  values (auth.uid(), trim(p_name), lower(trim(p_name)), p_talent_ids,
          '{"strength":1,"dexterity":1,"intelligence":1,"attunement":1,"vitality":1}'::jsonb,
          p_mortal_basic_skill_id) returning id into character_id;
  insert into public.character_saves(character_id, user_id, schema_version, payload)
  values (character_id, auth.uid(), p_schema_version, p_initial_save);
  update public.talent_rolls set consumed_at = now() where id = p_roll_id;
  return character_id;
end;
$$;

revoke all on function public.create_character(uuid,uuid,text,text[],text,jsonb,integer) from public;
grant execute on function public.create_character(uuid,uuid,text,text[],text,jsonb,integer) to authenticated;
