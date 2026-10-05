-- Beta remote character reset (wave-4 W4-AUT-1).
--
-- A row client validators reject lands on SaveIncompatibleScreen, whose
-- reset was a local-cache clear only - the remote row reloaded and
-- wedged the account (no remote delete existed; create_character folded
-- to CHARACTER_EXISTS). reset_character soft-deletes the caller's
-- character: the deleted_at tombstone unblocks fresh creation and the
-- corrupt save becomes unreachable, so the recovery surface's promise
-- is real. Returns DELETED / NO_CHARACTER.

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
  v_session := public._assert_session_locked(p_session_id);
  select * into v_character
    from public.characters
    where user_id = v_session.user_id and deleted_at is null
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

revoke all on function public.reset_character(uuid) from public, anon, authenticated, service_role;
grant execute on function public.reset_character(uuid) to authenticated;
