-- 202610170001: admit current client save schema version (v92) alongside v87 for beta 0.0.0.1 cutover.
--
-- Client CURRENT_SAVE_VERSION in src/services/save/saveVersion.ts is 92.
-- Keep 87 in the array so existing contract integration fixtures continue to pass,
-- while dropping 91 so pre-cutover test saves are rejected cleanly.

insert into public.backend_config(key, value, updated_at)
values ('acceptedSaveSchemaVersions', '[87, 92]'::jsonb, now())
on conflict (key) do update
  set value = '[87, 92]'::jsonb,
      updated_at = now();
