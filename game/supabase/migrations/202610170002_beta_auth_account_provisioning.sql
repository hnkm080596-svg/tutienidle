-- 202610170002: authoritative account provisioning fallback for hosted GoTrue.
--
-- Hosted Supabase GoTrue rejects synthetic RFC-2606 `.invalid` addresses on
-- `/auth/v1/signup` (`400 email_address_invalid`),withholds `access_token` when
-- `mailer_autoconfirm` is off, and rejects empty guest signups (`422
-- anonymous_provider_disabled`) when the anonymous provider toggle is disabled.
-- Meanwhile, `/auth/v1/token?grant_type=password` natively issues genuine
-- GoTrue JWT + refresh_token sessions for any confirmed `auth.users` row
-- (the same mechanism proven by `tests/integration/supabase/fixture.ts`).
--
-- `public.provision_game_account` provisions the `auth.users` + `auth.identities`
-- record atomically (triggering `on_auth_user_created` -> `public.profiles`)
-- so the client can immediately sign in through `/auth/v1/token?grant_type=password`.

create or replace function public.provision_game_account(
  p_mode text,
  p_login_id text default null,
  p_password text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := gen_random_uuid();
  v_login text;
  v_email text;
  v_password text;
begin
  if p_mode = 'guest' then
    v_email := 'guest_' || replace(v_user_id::text, '-', '') || '@accounts.tien-hiep-idle.invalid';
    v_password := coalesce(nullif(btrim(p_password), ''), encode(extensions.gen_random_bytes(24), 'hex'));

    insert into auth.users(
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, confirmation_token, recovery_token,
      email_change, email_change_token_new,
      is_anonymous, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) values (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_email,
      extensions.crypt(v_password, extensions.gen_salt('bf')),
      now(), '', '', '', '',
      false,
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"account_kind":"guest"}'::jsonb,
      now(),
      now()
    );

    insert into auth.identities(
      id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      v_user_id,
      v_user_id::text,
      'email',
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
      now(),
      now(),
      now()
    );

    return jsonb_build_object(
      'status', 'CREATED',
      'userId', v_user_id,
      'email', v_email,
      'password', v_password
    );
  elsif p_mode = 'register' then
    v_login := lower(btrim(coalesce(p_login_id, '')));
    if v_login !~ '^[a-z0-9_]{4,20}$' then
      return jsonb_build_object('status', 'REJECTED', 'code', 'INVALID_ID');
    end if;
    if p_password is null or char_length(p_password) < 6 then
      return jsonb_build_object('status', 'REJECTED', 'code', 'WEAK_PASSWORD');
    end if;

    v_email := v_login || '@accounts.tien-hiep-idle.invalid';

    if exists (select 1 from public.profiles where login_id = v_login)
       or exists (select 1 from auth.users where lower(email) = v_email) then
      return jsonb_build_object('status', 'REJECTED', 'code', 'ID_TAKEN');
    end if;

    begin
      insert into auth.users(
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, confirmation_token, recovery_token,
        email_change, email_change_token_new,
        is_anonymous, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      ) values (
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        v_email,
        extensions.crypt(p_password, extensions.gen_salt('bf')),
        now(), '', '', '', '',
        false,
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('account_kind', 'registered', 'login_id', v_login),
        now(),
        now()
      );

      insert into auth.identities(
        id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(),
        v_user_id,
        v_user_id::text,
        'email',
        jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
        now(),
        now(),
        now()
      );
    exception
      when unique_violation then
        return jsonb_build_object('status', 'REJECTED', 'code', 'ID_TAKEN');
    end;

    return jsonb_build_object(
      'status', 'CREATED',
      'userId', v_user_id,
      'email', v_email,
      'loginId', v_login
    );
  else
    return jsonb_build_object('status', 'REJECTED', 'code', 'INVALID_MODE');
  end if;
end;
$$;

revoke all on function public.provision_game_account(text, text, text) from public, service_role;
grant execute on function public.provision_game_account(text, text, text) to anon, authenticated;
