-- Dev-only auth schema stub for the fresh-install equivalence check.
--
-- Applied ONLY to the bare scratch database (SUPABASE_FRESH_DB_NAME) that
-- proves a fresh install converges to the same catalog shape as the
-- historical-upgrade path. Never run against the real project database, where
-- the GoTrue-managed auth schema already exists (the guards below no-op on any
-- object that already exists).
create schema if not exists auth;

do $$
begin
  if not exists (select 1 from pg_tables where schemaname = 'auth' and tablename = 'users') then
    create table auth.users(
      id uuid primary key,
      instance_id uuid,
      aud text,
      role text,
      email text,
      encrypted_password text,
      email_confirmed_at timestamptz,
      confirmation_token text default '',
      recovery_token text default '',
      email_change text default '',
      email_change_token_new text default '',
      raw_app_meta_data jsonb,
      raw_user_meta_data jsonb,
      is_anonymous boolean default false,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );
  end if;
  if not exists (select 1 from pg_tables where schemaname = 'auth' and tablename = 'identities') then
    create table auth.identities(
      id uuid primary key default gen_random_uuid(),
      user_id uuid references auth.users(id) on delete cascade,
      provider_id text,
      provider text,
      identity_data jsonb,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );
  end if;
end $$;

-- Same lookup semantics as GoTrue's auth.uid(): the 'sub' claim out of
-- request.jwt.claims, so `set local request.jwt.claims` exercises RLS and the
-- guarded RPC surface exactly like a PostgREST caller.
create or replace function auth.uid()
returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid
$$;

create or replace function auth.jwt()
returns jsonb language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  )
$$;

-- pgcrypto lives in the extensions schema on Supabase; the RPC surface calls
-- extensions.digest() for the server-side request fingerprint.
create schema if not exists extensions;
create extension if not exists pgcrypto schema extensions;
