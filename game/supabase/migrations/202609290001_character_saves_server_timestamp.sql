-- INFRA-01 follow-up: character_saves.updated_at must be server-owned.
-- The login sync previously read a timestamp written by whichever client
-- pushed last (client `new Date()`), so two machines' wall clocks were
-- compared directly and a fast clock could resurrect an older save. The
-- reconcile path now orders on save_revision (clock-free shared
-- sequence), but updated_at still feeds the same-revision tie-break and
-- external observability — make it always Postgres now(), ignoring any
-- client-supplied value.
create or replace function public.character_saves_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists character_saves_touch_updated_at on public.character_saves;
create trigger character_saves_touch_updated_at
before insert or update on public.character_saves
for each row execute function public.character_saves_touch_updated_at();
