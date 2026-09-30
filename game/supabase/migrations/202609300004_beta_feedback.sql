-- ============================================================================
-- BETA-FINAL B7 / PR13 - feedback intake: private table + guarded submit RPC
-- ============================================================================
--
-- One write path: public.submit_feedback(session_id, idempotency_key, report).
-- The report row lives in public.feedback_reports, a table with RLS enabled,
-- zero policies and zero API grants - clients cannot read or write it
-- directly; only the definer RPC lands rows, so there is no public read and
-- no unrestricted insert.
--
-- Identity attribution is server-derived everywhere it can be spoofed:
--   * owner_user_id / session_id come from the validated session row, never
--     from the request body;
--   * build_id is the value the session recorded at claim time (a client can
--     claim any build once, but cannot make one report pretend to come from
--     another admitted build or session);
--   * environment is the operator-stamped backend_config 'environment' value
--     ('unknown' until the operator sets it per project; a mismatch against a
--     configured value rejects the report as a spoof or wrong-project build);
--   * save_schema_version / save_revision / character_id are read from the
--     live characters/character_saves rows, not trusted from the client.
-- The client's own BuildIdentity copy is persisted as unverified metadata in
-- client_build after consistency checks, so support can diff claim vs server
-- attribution without trusting either silently.
--
-- Idempotency mirrors the save receipt contract: (owner_user_id,
-- idempotency_key) is unique and carries a server-computed request_digest
-- over the canonical JSONB fingerprint of the approved fields. An identical
-- retry returns the original report id (alreadyAccepted=true) and is never
-- charged against the rate window; the same key with a different body
-- rejects.
--
-- Limits live in backend_config.feedbackLimits. EXT-06 (privacy/retention
-- policy) is still unresolved: these are conservative measured interim
-- bounds - a maximal attached report (2000-char description, 2000-char
-- steps, 50 redacted diagnostic events at ~350-500B each) serializes near
-- 40KB, so the byte ceiling is 64KB with per-field caps well under it.
-- Retention is stamped per row (retain_until) for a later prune job; bump the
-- numbers here and in src/shared/feedback/FeedbackDraft.ts together when
-- EXT-06 lands.
--
-- 'environment' is a per-project operator value: the migration seeds
-- 'unknown' (absent = unprovisioned, honest) and the operator sets
-- 'staging'/'beta'/'production' once per project at provisioning. With
-- 'unknown' the server stamps 'unknown' and skips the claim-consistency
-- check; once set, a mismatched client claim rejects.
-- ============================================================================

insert into public.backend_config(key, value) values
  ('feedbackLimits', '{
     "maxReportsPerHour": 3,
     "maxReportsPerDay": 10,
     "maxDescriptionChars": 2000,
     "maxStepsChars": 2000,
     "maxContactChars": 200,
     "maxRouteChars": 200,
     "maxContextKeys": 12,
     "maxContextValueChars": 64,
     "maxDiagnosticsEvents": 50,
     "maxDiagnosticsBytes": 32768,
     "maxDiagnosticEventBytes": 4096,
     "maxDiagnosticDetailKeys": 16,
     "maxDiagnosticDetailValueChars": 256,
     "maxClientBuildFieldChars": 128,
     "maxReportBytes": 49152,
     "retentionDays": 90
   }'::jsonb),
  ('environment', '"unknown"'::jsonb)
on conflict (key) do nothing;

-- --------------------------------------------------------------------------
-- feedback_reports: intake table (RLS on, no policies, no grants below)
-- --------------------------------------------------------------------------

create table if not exists public.feedback_reports (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.account_sessions(id) on delete cascade,
  idempotency_key uuid not null,
  request_digest text not null,
  category text not null,
  description text not null,
  steps text,
  contact text,
  route text,
  context jsonb not null default '{}'::jsonb,
  diagnostics jsonb not null default '[]'::jsonb,
  client_build jsonb not null,
  build_id text not null,
  environment text not null,
  character_id uuid,
  save_schema_version integer,
  save_revision bigint,
  retain_until timestamptz not null,
  created_at timestamptz not null default now(),
  unique (owner_user_id, idempotency_key)
);

comment on table public.feedback_reports is
  'B7 beta feedback intake. One row per (owner, idempotency key); identity/build/env/save attribution columns are server-derived, client_build is the unverified client-reported copy. retain_until feeds the operator prune job. Direct read/write is closed: RLS enabled, no policies, no grants.';

create index if not exists feedback_reports_owner_window
  on public.feedback_reports (owner_user_id, created_at);
create index if not exists feedback_reports_retain_until
  on public.feedback_reports (retain_until);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'feedback_reports_category_check'
      and conrelid = 'public.feedback_reports'::regclass
  ) then
    alter table public.feedback_reports
      add constraint feedback_reports_category_check
      check (category in ('bug', 'balance', 'performance', 'ui', 'feature-request', 'other'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'feedback_reports_digest_shape'
      and conrelid = 'public.feedback_reports'::regclass
  ) then
    alter table public.feedback_reports
      add constraint feedback_reports_digest_shape
      check (request_digest ~ '^[0-9a-f]{64}$');
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'feedback_reports_description_nonempty'
      and conrelid = 'public.feedback_reports'::regclass
  ) then
    alter table public.feedback_reports
      add constraint feedback_reports_description_nonempty
      check (char_length(trim(description)) between 1 and 10000);
  end if;
end;
$$;

alter table public.feedback_reports enable row level security;

-- --------------------------------------------------------------------------
-- _check_feedback_report: transport/contract validation, fail-cheap helper.
-- Returns NULL when the report is well formed, else a {code, detail} object.
-- Runs before any row lock so a malformed blast costs a config read only.
-- --------------------------------------------------------------------------

create or replace function public._check_feedback_report(p_report jsonb, p_limits jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category text;
  v_context jsonb;
  v_context_key text;
  v_context_value jsonb;
  v_context_keys integer;
  v_diagnostics jsonb;
  v_event jsonb;
  v_event_keys text[];
  v_event_details jsonb;
  v_detail_key text;
  v_detail_value jsonb;
  v_detail_keys integer;
  v_build jsonb;
  v_build_key text;
  v_build_value jsonb;
  v_required_build text[] := array['productName','appVersion','buildId','gitSha','saveSchemaVersion','backendEnvironment','releaseChannel','builtAtUtc'];
  v_allowed_event text[] := array['source','severity','category','code','message','route','correlationId','revision','details','stack','reportId','seq','atUtc'];
begin
  if p_report is null or jsonb_typeof(p_report) is distinct from 'object' then
    return jsonb_build_object('code', 'FEEDBACK_INVALID', 'detail', 'report object required');
  end if;

  if octet_length(p_report::text) > coalesce((p_limits->>'maxReportBytes')::integer, 49152) then
    return jsonb_build_object('code', 'FEEDBACK_TOO_LARGE', 'detail', 'report exceeds byte ceiling');
  end if;

  v_category := p_report->>'category';
  if v_category is null
     or v_category not in ('bug', 'balance', 'performance', 'ui', 'feature-request', 'other') then
    return jsonb_build_object('code', 'FEEDBACK_INVALID', 'detail', 'unknown category');
  end if;

  if p_report->'description' is null
     or jsonb_typeof(p_report->'description') is distinct from 'string'
     or char_length(trim(p_report->>'description')) = 0
     or char_length(p_report->>'description') > coalesce((p_limits->>'maxDescriptionChars')::integer, 2000) then
    return jsonb_build_object('code', 'FEEDBACK_INVALID', 'detail', 'description bounds violated');
  end if;

  if p_report->'steps' is not null
     and (jsonb_typeof(p_report->'steps') is distinct from 'string'
          or char_length(p_report->>'steps') > coalesce((p_limits->>'maxStepsChars')::integer, 2000)) then
    return jsonb_build_object('code', 'FEEDBACK_INVALID', 'detail', 'steps bounds violated');
  end if;

  if p_report->'contact' is not null
     and (jsonb_typeof(p_report->'contact') is distinct from 'string'
          or char_length(p_report->>'contact') > coalesce((p_limits->>'maxContactChars')::integer, 200)) then
    return jsonb_build_object('code', 'FEEDBACK_INVALID', 'detail', 'contact bounds violated');
  end if;

  if p_report->'route' is not null
     and (jsonb_typeof(p_report->'route') is distinct from 'string'
          or char_length(p_report->>'route') > coalesce((p_limits->>'maxRouteChars')::integer, 200)) then
    return jsonb_build_object('code', 'FEEDBACK_INVALID', 'detail', 'route bounds violated');
  end if;

  -- coarse gameplay context: a flat object of scalars only - key/value
  -- bounds mirror the diagnostic details contract (no nested blobs, no
  -- arrays, no raw save surface).
  v_context := p_report->'context';
  if v_context is not null then
    if jsonb_typeof(v_context) is distinct from 'object' then
      return jsonb_build_object('code', 'FEEDBACK_INVALID', 'detail', 'context must be an object');
    end if;
    select count(*) into v_context_keys from jsonb_object_keys(v_context);
    if v_context_keys > coalesce((p_limits->>'maxContextKeys')::integer, 12) then
      return jsonb_build_object('code', 'FEEDBACK_INVALID', 'detail', 'context has too many keys');
    end if;
    for v_context_key, v_context_value in
      select key, value from jsonb_each(v_context)
    loop
      if v_context_key !~ '^[A-Za-z0-9_.:-]{1,64}$' then
        return jsonb_build_object('code', 'FEEDBACK_INVALID', 'detail', 'context key charset violated');
      end if;
      if jsonb_typeof(v_context_value) not in ('string', 'number', 'boolean', 'null') then
        return jsonb_build_object('code', 'FEEDBACK_INVALID', 'detail', 'context values must be scalars');
      end if;
      if jsonb_typeof(v_context_value) = 'string'
         and char_length(v_context_value #>> '{}') > coalesce((p_limits->>'maxContextValueChars')::integer, 64) then
        return jsonb_build_object('code', 'FEEDBACK_INVALID', 'detail', 'context value too long');
      end if;
    end loop;
  end if;

  -- diagnostics: opt-in array of the client's already-validated, already-
  -- redacted diagnostic events. The server re-bounds structurally - array
  -- cardinality, per-event key allowlist identical to
  -- src/shared/diagnostics/DiagnosticEvent.ts INPUT_KEYS, per-event and
  -- total byte caps - it does not trust the client redaction claim blindly
  -- (oversized or foreign-keyed events reject rather than being stored).
  v_diagnostics := p_report->'diagnostics';
  if v_diagnostics is not null then
    if jsonb_typeof(v_diagnostics) is distinct from 'array' then
      return jsonb_build_object('code', 'FEEDBACK_INVALID', 'detail', 'diagnostics must be an array');
    end if;
    if jsonb_array_length(v_diagnostics) > coalesce((p_limits->>'maxDiagnosticsEvents')::integer, 50) then
      return jsonb_build_object('code', 'FEEDBACK_TOO_LARGE', 'detail', 'too many diagnostic events');
    end if;
    if octet_length(v_diagnostics::text) > coalesce((p_limits->>'maxDiagnosticsBytes')::integer, 32768) then
      return jsonb_build_object('code', 'FEEDBACK_TOO_LARGE', 'detail', 'diagnostics exceed byte ceiling');
    end if;
    for v_event in select value from jsonb_array_elements(v_diagnostics)
    loop
      if jsonb_typeof(v_event) is distinct from 'object' then
        return jsonb_build_object('code', 'FEEDBACK_INVALID', 'detail', 'diagnostic event must be an object');
      end if;
      select array_agg(key) into v_event_keys from jsonb_object_keys(v_event);
      if not (v_event_keys <@ v_allowed_event) then
        return jsonb_build_object('code', 'FEEDBACK_INVALID', 'detail', 'diagnostic event carries a foreign key');
      end if;
      if octet_length(v_event::text) > coalesce((p_limits->>'maxDiagnosticEventBytes')::integer, 4096) then
        return jsonb_build_object('code', 'FEEDBACK_TOO_LARGE', 'detail', 'diagnostic event exceeds byte cap');
      end if;
      -- details: bounded scalars only, mirroring the client's
      -- DIAGNOSTIC_DETAIL_KEYS contract (maxDetailKeys 16,
      -- maxDetailValueLength 256). An unbounded nested object would give a
      -- hostile client up to 4KB/event of arbitrary JSON storage inside an
      -- otherwise approved field.
      v_event_details := v_event->'details';
      if v_event_details is not null then
        if jsonb_typeof(v_event_details) is distinct from 'object' then
          return jsonb_build_object('code', 'FEEDBACK_INVALID', 'detail', 'diagnostic details must be an object');
        end if;
        select count(*) into v_detail_keys from jsonb_object_keys(v_event_details);
        if v_detail_keys > coalesce((p_limits->>'maxDiagnosticDetailKeys')::integer, 16) then
          return jsonb_build_object('code', 'FEEDBACK_INVALID', 'detail', 'diagnostic details have too many keys');
        end if;
        for v_detail_key, v_detail_value in
          select key, value from jsonb_each(v_event_details)
        loop
          if v_detail_key !~ '^[A-Za-z0-9_.:-]{1,64}$' then
            return jsonb_build_object('code', 'FEEDBACK_INVALID', 'detail', 'diagnostic detail key charset violated');
          end if;
          if jsonb_typeof(v_detail_value) not in ('string', 'number', 'boolean', 'null') then
            return jsonb_build_object('code', 'FEEDBACK_INVALID', 'detail', 'diagnostic detail values must be scalars');
          end if;
          if jsonb_typeof(v_detail_value) = 'string'
             and char_length(v_detail_value #>> '{}') > coalesce((p_limits->>'maxDiagnosticDetailValueChars')::integer, 256) then
            return jsonb_build_object('code', 'FEEDBACK_INVALID', 'detail', 'diagnostic detail value too long');
          end if;
        end loop;
      end if;
    end loop;
  end if;

  -- clientBuild: required object carrying the client's claimed
  -- BuildIdentity. All eight fields are required here so a partial build
  -- object cannot sneak past attribution checks; each is a bounded scalar.
  v_build := p_report->'clientBuild';
  if v_build is null or jsonb_typeof(v_build) is distinct from 'object' then
    return jsonb_build_object('code', 'FEEDBACK_INVALID', 'detail', 'clientBuild object required');
  end if;
  for v_build_key, v_build_value in select key, value from jsonb_each(v_build)
  loop
    if not (v_build_key = any(v_required_build)) then
      return jsonb_build_object('code', 'FEEDBACK_INVALID', 'detail', 'clientBuild carries a foreign key');
    end if;
    if jsonb_typeof(v_build_value) not in ('string', 'number') then
      return jsonb_build_object('code', 'FEEDBACK_INVALID', 'detail', 'clientBuild values must be scalars');
    end if;
    if jsonb_typeof(v_build_value) = 'string'
       and char_length(v_build_value #>> '{}') > coalesce((p_limits->>'maxClientBuildFieldChars')::integer, 128) then
      return jsonb_build_object('code', 'FEEDBACK_INVALID', 'detail', 'clientBuild field too long');
    end if;
  end loop;
  foreach v_build_key in array v_required_build
  loop
    if not (v_build ? v_build_key) then
      return jsonb_build_object('code', 'FEEDBACK_INVALID', 'detail', 'clientBuild missing ' || v_build_key);
    end if;
  end loop;
  if jsonb_typeof(v_build->'saveSchemaVersion') is distinct from 'number' then
    return jsonb_build_object('code', 'FEEDBACK_INVALID', 'detail', 'clientBuild.saveSchemaVersion must be a number');
  end if;

  return null;
end;
$$;

-- --------------------------------------------------------------------------
-- submit_feedback: the single intake path
-- --------------------------------------------------------------------------

create or replace function public.submit_feedback(
  p_session_id uuid,
  p_idempotency_key uuid,
  p_report jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.account_sessions;
  v_user uuid;
  v_limits jsonb;
  v_bad jsonb;
  v_claimed_build jsonb;
  v_environment text;
  v_fingerprint jsonb;
  v_digest text;
  v_existing public.feedback_reports;
  v_hour integer;
  v_day integer;
  v_oldest_hour timestamptz;
  v_oldest_day timestamptz;
  v_retry_seconds integer;
  v_character public.characters;
  v_character_id uuid;
  v_save_schema integer;
  v_save_revision bigint;
  v_report_id uuid;
  v_retention_days integer;
  v_now timestamptz := now();
begin
  if p_session_id is null or p_idempotency_key is null then
    return jsonb_build_object('status', 'REJECTED', 'code', 'FEEDBACK_INVALID', 'detail', 'session and idempotency key required');
  end if;

  select value into v_limits from public.backend_config where key = 'feedbackLimits';
  v_bad := public._check_feedback_report(p_report, v_limits);
  if v_bad is not null then
    return jsonb_build_object('status', 'REJECTED') || v_bad;
  end if;

  -- Session gate: locks the caller profile then the session row and enforces
  -- ownership + active + admitted protocol. Revoked/foreign/expired sessions
  -- raise 28000 before any report row is touched.
  v_session := public._assert_session_protocol(p_session_id);
  v_user := v_session.user_id;

  -- Server-derived attribution. The client's claimed buildId must equal the
  -- one the session recorded at claim (spoof or wrong-session -> reject);
  -- the claimed environment must equal the operator-stamped environment once
  -- it is provisioned ('unknown' accepts any claim and stamps 'unknown').
  v_claimed_build := p_report->'clientBuild';
  if coalesce(v_claimed_build->>'buildId', '') <> coalesce(v_session.build_id, '') then
    return jsonb_build_object('status', 'REJECTED', 'code', 'FEEDBACK_BUILD_MISMATCH');
  end if;
  select coalesce(value #>> '{}', 'unknown') into v_environment
    from public.backend_config where key = 'environment';
  v_environment := coalesce(v_environment, 'unknown');
  if v_environment <> 'unknown'
     and coalesce(v_claimed_build->>'backendEnvironment', '') <> v_environment then
    return jsonb_build_object(
      'status', 'REJECTED',
      'code', 'FEEDBACK_ENV_MISMATCH',
      'serverEnvironment', v_environment);
  end if;

  -- Canonical request fingerprint over the approved client fields. JSONB
  -- serialization canonicalizes key order, so an identical retry digests
  -- identically; the idempotency key itself is inside the fingerprint like
  -- the save receipt contract.
  v_fingerprint := jsonb_build_object(
    'idempotencyKey', p_idempotency_key,
    'category', p_report->>'category',
    'description', p_report->>'description',
    'steps', p_report->>'steps',
    'contact', p_report->>'contact',
    'route', p_report->>'route',
    'context', coalesce(p_report->'context', '{}'::jsonb),
    'diagnostics', coalesce(p_report->'diagnostics', '[]'::jsonb),
    'clientBuild', v_claimed_build);
  v_digest := encode(extensions.digest(v_fingerprint::text, 'sha256'), 'hex');

  -- Owner-scoped dedupe inside the profile/session locks: identical retry
  -- returns the original report id without charging the rate window; key
  -- reuse with a different body rejects.
  select * into v_existing from public.feedback_reports
    where owner_user_id = v_user and idempotency_key = p_idempotency_key
    for update;
  if found then
    if v_existing.request_digest = v_digest then
      return jsonb_build_object(
        'status', 'ACCEPTED',
        'reportId', v_existing.id,
        'alreadyAccepted', true,
        'serverTimeUtc', now());
    end if;
    return jsonb_build_object('status', 'REJECTED', 'code', 'FEEDBACK_IDEMPOTENCY_REUSED');
  end if;

  -- Rate window: per-owner rolling hour/day counts over already-accepted
  -- reports. Dedupe above runs first, so a resubmitted key never counts
  -- twice.
  select
    count(*) filter (where created_at > v_now - interval '1 hour'),
    count(*) filter (where created_at > v_now - interval '24 hours'),
    min(created_at) filter (where created_at > v_now - interval '1 hour'),
    min(created_at) filter (where created_at > v_now - interval '24 hours')
    into v_hour, v_day, v_oldest_hour, v_oldest_day
    from public.feedback_reports
    where owner_user_id = v_user;
  if v_day >= coalesce((v_limits->>'maxReportsPerDay')::integer, 10) then
    v_retry_seconds := greatest(
      60,
      coalesce(extract(epoch from (v_oldest_day + interval '24 hours' - v_now))::integer, 86400));
    return jsonb_build_object(
      'status', 'RATE_LIMITED',
      'code', 'FEEDBACK_RATE_LIMITED',
      'retryAfterSeconds', v_retry_seconds);
  end if;
  if v_hour >= coalesce((v_limits->>'maxReportsPerHour')::integer, 3) then
    v_retry_seconds := greatest(
      60,
      coalesce(extract(epoch from (v_oldest_hour + interval '1 hour' - v_now))::integer, 3600));
    return jsonb_build_object(
      'status', 'RATE_LIMITED',
      'code', 'FEEDBACK_RATE_LIMITED',
      'retryAfterSeconds', v_retry_seconds);
  end if;

  -- Live save attribution: the caller's current character/save row (plain
  -- reads - we never mutate them; the profile lock already serializes this
  -- owner's submissions). Absent character or save row stores NULLs.
  select * into v_character from public.characters
    where user_id = v_user and deleted_at is null;
  if found then
    v_character_id := v_character.id;
    select schema_version, save_revision into v_save_schema, v_save_revision
      from public.character_saves where character_id = v_character.id;
  end if;

  v_retention_days := coalesce((v_limits->>'retentionDays')::integer, 90);

  insert into public.feedback_reports(
    owner_user_id, session_id, idempotency_key, request_digest,
    category, description, steps, contact, route, context, diagnostics,
    client_build, build_id, environment, character_id,
    save_schema_version, save_revision, retain_until)
  values (
    v_user, p_session_id, p_idempotency_key, v_digest,
    p_report->>'category',
    p_report->>'description',
    nullif(trim(coalesce(p_report->>'steps', '')), ''),
    nullif(trim(coalesce(p_report->>'contact', '')), ''),
    nullif(trim(coalesce(p_report->>'route', '')), ''),
    coalesce(p_report->'context', '{}'::jsonb),
    coalesce(p_report->'diagnostics', '[]'::jsonb),
    v_claimed_build,
    coalesce(v_session.build_id, ''),
    v_environment,
    v_character_id,
    v_save_schema,
    v_save_revision,
    v_now + make_interval(days => v_retention_days))
  returning id into v_report_id;

  return jsonb_build_object(
    'status', 'ACCEPTED',
    'reportId', v_report_id,
    'alreadyAccepted', false,
    'serverTimeUtc', now());
end;
$$;

-- --------------------------------------------------------------------------
-- Grants: table fully closed; RPC execute for authenticated players only.
-- --------------------------------------------------------------------------

revoke all on public.feedback_reports from public, anon, authenticated, service_role;

revoke all on function public._check_feedback_report(jsonb, jsonb) from public, anon, authenticated, service_role;

revoke all on function public.submit_feedback(uuid, uuid, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.submit_feedback(uuid, uuid, jsonb) to authenticated;
