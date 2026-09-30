-- ============================================================================
-- BETA-FINAL B1-E / PR6 - guest -> registered finalize
-- ============================================================================
-- Spec: game/docs/qa/missions/2026-09-29-beta-final-production-readiness.md B1.8
-- Plan: game/docs/superpowers/plans/2026-09-29-beta-final-implementation-plan.md
--       section 10.
--
-- What this migration adds:
--   * public.finalize_guest_upgrade(p_login_id)
--       The ONLY path that flips a profile from account_kind='guest' to
--       'registered' and binds its login id. Registered status is derived
--       from the authoritative auth.users row (the caller's own row only):
--       the anonymous->permanent link (updateUser) must have completed its
--       confirmation server-side, otherwise the verdict is
--       PENDING_CONFIRMATION and the profile stays a guest.
--
-- Invariants:
--   * Client metadata can NEVER elevate account_kind or bind a login - the
--     function reads auth.users itself; user-editable raw_user_meta_data is
--     not consulted.
--   * Idempotent: finalizing an already-registered profile bound to the same
--     login id returns FINALIZED again (an interrupted upgrade replays
--     safely - the EXT-09 pending-confirm flow resumes here).
--   * guest -> registered only: a registered profile bound to a DIFFERENT
--     login is rejected (ALREADY_REGISTERED); nothing demotes or rebinds.
--   * No second profile/character is ever created - the same profile row is
--     updated under the standard caller-profile lock.
--
-- Idempotent: safe to re-run.

create or replace function public.finalize_guest_upgrade(p_login_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_profile record;
  v_auth record;
  v_login text;
begin
  -- Standard account lock (profiles row FOR UPDATE) - the same serialization
  -- every guarded account mutation uses.
  v_user := public._lock_caller_profile();
  v_login := lower(btrim(p_login_id));

  select account_kind, login_id into v_profile
    from public.profiles
    where user_id = v_user;

  if v_profile.account_kind = 'registered' then
    if v_profile.login_id = v_login then
      -- Idempotent replay of an interrupted upgrade.
      return jsonb_build_object('status', 'FINALIZED', 'loginId', v_login);
    end if;
    -- Bound to a different login already: never rebind from the client side.
    return jsonb_build_object('status', 'REJECTED', 'code', 'ALREADY_REGISTERED');
  end if;

  -- Authoritative link state: the anonymous -> permanent conversion is only
  -- real once auth.users itself confirms the bound email. is_anonymous
  -- stays set even after the email confirms, so the confirmation
  -- timestamps alone decide; a never-linked anonymous row has none and
  -- stays pending. Pending-confirm stays a guest (EXT-09).
  select email_confirmed_at, confirmed_at
    into v_auth
    from auth.users
    where id = v_user;

  if coalesce(v_auth.email_confirmed_at, v_auth.confirmed_at) is null then
    return jsonb_build_object('status', 'PENDING_CONFIRMATION');
  end if;

  -- Same shape the profiles constraint enforces; validated here so the
  -- rejection is a typed verdict rather than a constraint exception.
  if v_login is null or v_login !~ '^[a-z0-9_]{4,20}$' then
    return jsonb_build_object('status', 'REJECTED', 'code', 'LOGIN_ID_INVALID');
  end if;

  if exists (select 1 from public.profiles where login_id = v_login and user_id <> v_user) then
    return jsonb_build_object('status', 'REJECTED', 'code', 'LOGIN_ID_TAKEN');
  end if;

  update public.profiles
    set account_kind = 'registered', login_id = v_login
    where user_id = v_user and account_kind = 'guest';

  if not found then
    -- A concurrent finalize won the race; the row is already bound - report
    -- the idempotent outcome (or the conflicting binding, if another login).
    select account_kind, login_id into v_profile
      from public.profiles where user_id = v_user;
    return case when v_profile.account_kind = 'registered' and v_profile.login_id = v_login
      then jsonb_build_object('status', 'FINALIZED', 'loginId', v_login)
      else jsonb_build_object('status', 'REJECTED', 'code', 'ALREADY_REGISTERED')
    end;
  end if;

  return jsonb_build_object('status', 'FINALIZED', 'loginId', v_login);
end;
$$;

comment on function public.finalize_guest_upgrade(text) is
  'B1.8 guest -> registered finalize: derives registered status from the auth.users confirmation timestamps, binds the normalized login id under the caller-profile lock. Idempotent and resumable; client metadata never elevates account_kind.';

revoke all on function public.finalize_guest_upgrade(text) from public, anon, service_role;
grant execute on function public.finalize_guest_upgrade(text) to authenticated;
