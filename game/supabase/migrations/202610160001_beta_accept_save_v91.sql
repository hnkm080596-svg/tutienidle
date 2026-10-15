-- 202610160001: admit current client save schema version (v91) alongside v87.
--
-- Client CURRENT_SAVE_VERSION in src/services/save/saveVersion.ts is 91,
-- while 202609300001_beta_authority_prepare.sql seeded backend_config
-- acceptedSaveSchemaVersions with [87]. Without 91 in the accepted set,
-- _check_save_payload and get_backend_status reject live v91 client saves
-- with SAVE_SCHEMA_UNSUPPORTED. Keep 87 in the array so existing contract
-- integration fixtures continue to pass.

insert into public.backend_config(key, value, updated_at)
values ('acceptedSaveSchemaVersions', '[87, 91]'::jsonb, now())
on conflict (key) do update
  set value = '[87, 91]'::jsonb,
      updated_at = now();
