#!/usr/bin/env node
// BETA-FINAL B9 (PR14) - backend health/contract probe (read-only).
//
//   node scripts/operations/backend-status.mjs --target <project-ref> [--json]
//
// Prints the operator-facing status of the B1-A contract surface on the
// target project: contract phase, backend_config levers, applied migration
// ledger, the API grant surface, direct-save policy count and session
// counts. The canary checklist in docs/operations/beta/health-and-quota.md
// maps each field to its expected value.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_ENV_FILE,
  OpsError,
  loadOpsEnv,
  parseArgs,
  pgClient,
  validateTarget,
} from './lib.mjs'

// One row per check; each query returns at most a few rows and never selects
// save payloads or credentials.
export const STATUS_QUERIES = [
  {
    name: 'contractPhase',
    sql: `select public.beta_contract_phase() as phase`,
    rows: (r) => r.rows[0]?.phase ?? 'unknown',
  },
  {
    name: 'serverTimeUtc',
    sql: `select now() as server_time`,
    rows: (r) => r.rows[0]?.server_time?.toISOString?.() ?? r.rows[0]?.server_time,
  },
  {
    name: 'backend_config',
    sql: `select key, value from public.backend_config order by key`,
    rows: (r) => Object.fromEntries(r.rows.map((x) => [x.key, x.value])),
  },
  {
    name: 'migrations',
    sql: `select version, name, inserted_at from supabase_migrations.schema_migrations order by version`,
    rows: (r) => r.rows.map((x) => `${x.version}_${x.name}`),
  },
  {
    name: 'rpc_surface',
    sql: `select
      has_function_privilege('authenticated', 'public.claim_active_session(text,integer,text)', 'execute') as claim,
      has_function_privilege('authenticated', 'public.create_character(uuid,uuid,text,text[],text)', 'execute') as create,
      has_function_privilege('authenticated', 'public.load_game_state(uuid)', 'execute') as load,
      has_function_privilege('authenticated', 'public.write_character_save(uuid,bigint,integer,jsonb,text,uuid,jsonb)', 'execute') as write,
      has_function_privilege('authenticated', 'public.heartbeat_session(uuid)', 'execute') as heartbeat,
      has_function_privilege('authenticated', 'public.revoke_current_session(uuid)', 'execute') as revoke,
      has_function_privilege('authenticated', 'public.beta_contract_phase()', 'execute') as phase,
      has_function_privilege('authenticated', 'public.get_backend_status()', 'execute') as status,
      has_function_privilege('anon', 'public.get_backend_status()', 'execute') as anon_status,
      has_function_privilege('authenticated', 'public._lock_caller_profile()', 'execute') as helper_exposed`,
    rows: (r) => r.rows[0],
  },
  {
    name: 'table_access',
    sql: `select
      has_table_privilege('authenticated', 'public.character_saves', 'select') as saves_select,
      has_table_privilege('authenticated', 'public.save_mutation_receipts', 'select') as receipts_select,
      has_table_privilege('authenticated', 'public.time_checkpoints', 'select') as checkpoints_select,
      has_table_privilege('authenticated', 'public.backend_config', 'select') as config_select,
      (select count(*)::int from pg_policies where schemaname='public' and tablename='character_saves') as direct_save_policies`,
    rows: (r) => r.rows[0],
  },
  {
    name: 'sessions',
    sql: `select count(*)::int as total,
          count(*) filter (where revoked_at is null)::int as active
        from public.account_sessions`,
    rows: (r) => r.rows[0],
  },
  {
    name: 'save_classes',
    sql: `select compatibility, count(*)::int as n
          from public.save_inventory_compatibility group by compatibility order by compatibility`,
    rows: (r) => Object.fromEntries(r.rows.map((x) => [x.compatibility, x.n])),
    optional: true, // view only exists after the prepare migration
  },
]

export async function collectStatus(query) {
  const out = {}
  for (const q of STATUS_QUERIES) {
    try {
      out[q.name] = q.rows(await query(q.sql))
    } catch (e) {
      if (!q.optional) throw e
      out[q.name] = `unavailable (${e.message})`
    }
  }
  return out
}

export function main(argv, { query } = {}) {
  return (async () => {
    const args = parseArgs(argv, { booleans: ['json', 'dry-run', 'yes-i-mean-it'] })
    const env = loadOpsEnv({ envFile: args['env'] || DEFAULT_ENV_FILE })
    const target = validateTarget({ target: args.target, env, mutating: false })
    if (target.prodLooking) {
      console.error(
        `[status] warning: target '${target.ref}' has label '${target.label ?? 'unset'}' - ` +
          'prod-looking target; read-only probe continuing.',
      )
    }
    let pg = null
    const run = query ?? (await pgClient(env.dbUrl).then((c) => {
      pg = c
      return (sql, params) => c.query(sql, params)
    }))
    try {
      const status = await collectStatus(run)
      if (args.json) {
        console.log(JSON.stringify({ target: target.ref, label: target.label, ...status }, null, 2))
      } else {
        console.log(`[status] target=${target.ref} label=${target.label ?? 'unset'}`)
        for (const [k, v] of Object.entries(status)) {
          console.log(`${k}: ${typeof v === 'object' && v !== null ? JSON.stringify(v) : v}`)
        }
      }
    } finally {
      if (pg) await pg.end()
    }
  })()
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(`[status] FAIL: ${e instanceof OpsError ? e.message : e}`)
    process.exit(1)
  })
}
