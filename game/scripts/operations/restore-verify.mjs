#!/usr/bin/env node
// BETA-FINAL B9 (PR14) - restore-drill acceptance probe (read-only).
//
//   node scripts/operations/restore-verify.mjs --target <ref> [--expect <manifest.json>] [--json]
//
// Verifies a restored/isolated project carries more than row counts: Auth
// identities, profiles, characters, save rows with valid revisions and
// receipt linkage, owner-FK integrity, the exact RPC grant surface, and
// migration-ledger compatibility. Every check prints [ok]/[FAIL]; any FAIL
// exits nonzero. See docs/operations/beta/backup-restore.md for the drill.
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_ENV_FILE,
  loadOpsEnv,
  migrationFiles,
  parseArgs,
  pgClient,
  report,
  validateTarget,
} from './lib.mjs'

// count(*) checks - presence is evidence, payload contents are never read.
// Keys match backup-export.mjs COUNTED_RELATIONS so --expect <manifest>
// compares row counts without a key mapping.
export const COUNT_CHECKS = [
  ['authUsers', `select count(*)::int as n from auth.users`],
  ['authIdentities', `select count(*)::int as n from auth.identities`],
  ['profiles', `select count(*)::int as n from public.profiles`],
  ['accountSessions', `select count(*)::int as n from public.account_sessions`],
  ['activeSessions', `select count(*)::int as n from public.account_sessions where revoked_at is null`],
  ['characters', `select count(*)::int as n from public.characters`],
  ['characterSaves', `select count(*)::int as n from public.character_saves`],
  ['saveMutationReceipts', `select count(*)::int as n from public.save_mutation_receipts`],
  ['timeCheckpoints', `select count(*)::int as n from public.time_checkpoints`],
]

// Zero-expected integrity checks: each must return 0 or the restore is bad.
export const INTEGRITY_CHECKS = [
  [
    'save owner matches character owner',
    `select count(*)::int as n from public.character_saves s
       join public.characters c on c.id = s.character_id
      where s.user_id <> c.user_id`,
  ],
  [
    'non-object save payloads',
    `select count(*)::int as n from public.character_saves
      where jsonb_typeof(payload) is distinct from 'object'`,
  ],
  [
    'payload.version disagrees with schema_version',
    `select count(*)::int as n from public.character_saves
      where coalesce(payload->>'version', '') <> schema_version::text`,
  ],
  [
    'null or negative save_revision',
    `select count(*)::int as n from public.character_saves
      where save_revision is null or save_revision < 0`,
  ],
  [
    'receipts pointing at missing characters',
    `select count(*)::int as n from public.save_mutation_receipts r
      where not exists (select 1 from public.characters c where c.id = r.character_id)`,
  ],
  [
    'saves whose last_mutation_id has no receipt',
    `select count(*)::int as n from public.character_saves s
      where s.last_mutation_id is not null
        and not exists (select 1 from public.save_mutation_receipts r
          where r.mutation_id = s.last_mutation_id and r.character_id = s.character_id)`,
  ],
  [
    'characters without a profile for their owner',
    `select count(*)::int as n from public.characters c
      where not exists (select 1 from public.profiles p where p.user_id = c.user_id)`,
  ],
  [
    'auth users without any identity row',
    `select count(*)::int as n from auth.users u
      where not exists (select 1 from auth.identities i where i.user_id = u.id)`,
  ],
]

export const GRANT_SQL = `select
  has_function_privilege('authenticated', 'public.claim_active_session(text,integer,text)', 'execute') as claim,
  has_function_privilege('authenticated', 'public.create_character(uuid,uuid,text,text[],text)', 'execute') as create,
  has_function_privilege('authenticated', 'public.load_game_state(uuid)', 'execute') as load,
  has_function_privilege('authenticated', 'public.write_character_save(uuid,bigint,integer,jsonb,text,uuid,jsonb)', 'execute') as write,
  has_function_privilege('authenticated', 'public.heartbeat_session(uuid)', 'execute') as heartbeat,
  has_function_privilege('authenticated', 'public.revoke_current_session(uuid)', 'execute') as revoke,
  has_function_privilege('authenticated', 'public.beta_contract_phase()', 'execute') as phase,
  has_function_privilege('authenticated', 'public.get_backend_status()', 'execute') as status,
  has_function_privilege('anon', 'public.get_backend_status()', 'execute') as anon_status,
  has_function_privilege('authenticated', 'public._lock_caller_profile()', 'execute') as helper_exposed,
  has_function_privilege('authenticated', 'public._assert_session_protocol(uuid)', 'execute') as helper_exposed2,
  has_table_privilege('authenticated', 'public.character_saves', 'select,insert,update,delete') as saves_open,
  has_table_privilege('authenticated', 'public.backend_config', 'select,insert,update,delete') as config_open`

export const PHASE_SQL = `select public.beta_contract_phase() as phase`
export const FK_SQL = `select convalidated from pg_constraint
  where conname = 'character_saves_owner_is_character_owner'`

export function compareCounts(expected, actual) {
  const diffs = []
  for (const [k, v] of Object.entries(expected)) {
    if (actual[k] !== v) diffs.push(`${k}: expected ${v}, got ${actual[k]}`)
  }
  return diffs
}

// Returns { problems, counts, phase } - problems is the list of failed
// acceptance assertions (empty = restore verified).
export async function verifyRestore(query, { expectPhase = 'cutover', expectCounts = null } = {}) {
  const problems = []
  const counts = {}

  const phase = (await query(PHASE_SQL)).rows[0]?.phase ?? 'unknown'
  if (phase !== expectPhase) {
    problems.push(`contractPhase is '${phase}', expected '${expectPhase}'`)
  }

  for (const [label, sql] of COUNT_CHECKS) {
    try {
      counts[label] = (await query(sql)).rows[0].n
    } catch (e) {
      counts[label] = null
      problems.push(`${label}: query failed (${e.message})`)
    }
  }

  for (const [label, sql] of INTEGRITY_CHECKS) {
    try {
      const n = (await query(sql)).rows[0].n
      if (n !== 0) problems.push(`${label}: ${n} row(s)`)
    } catch (e) {
      problems.push(`${label}: query failed (${e.message})`)
    }
  }

  const g = (await query(GRANT_SQL)).rows[0]
  for (const k of ['claim', 'create', 'load', 'write', 'heartbeat', 'revoke', 'phase', 'status']) {
    if (!g[k]) problems.push(`authenticated missing execute on RPC: ${k}`)
  }
  if (g.anon_status) problems.push('anon can execute get_backend_status')
  if (g.helper_exposed || g.helper_exposed2) problems.push('internal helper exposed to authenticated')
  if (g.saves_open) problems.push('authenticated retains character_saves table privileges')
  if (g.config_open) problems.push('authenticated retains backend_config table privileges')

  const fk = (await query(FK_SQL)).rows[0]
  if (!fk) problems.push('owner composite FK character_saves_owner_is_character_owner missing')
  else if (fk.convalidated !== true) problems.push('owner composite FK exists but is NOT validated')

  if (expectCounts) {
    for (const d of compareCounts(expectCounts, counts)) problems.push(`count drift: ${d}`)
  }

  return { problems, counts, phase }
}

export function main(argv, { query, repoFiles } = {}) {
  return (async () => {
    const args = parseArgs(argv, { booleans: ['json', 'dry-run', 'yes-i-mean-it'] })
    const env = loadOpsEnv({ envFile: args['env'] || DEFAULT_ENV_FILE })
    const target = validateTarget({ target: args.target, env, mutating: false })
    if (target.prodLooking) {
      console.error(
        `[restore-verify] warning: target '${target.ref}' has label '${target.label ?? 'unset'}' - ` +
          'prod-looking target; read-only probe continuing.',
      )
    }
    let expectCounts = null
    if (args.expect) {
      const manifest = JSON.parse(fs.readFileSync(args.expect, 'utf8'))
      expectCounts = manifest.rowCounts ?? manifest.counts ?? null
      if (!expectCounts) throw new Error(`--expect file has no rowCounts/counts: ${args.expect}`)
    }
    const expectPhase = args['expect-phase'] || 'cutover'

    let pg = null
    const run = query ?? (await pgClient(env.dbUrl).then((c) => {
      pg = c
      return (sql, p) => c.query(sql, p)
    }))
    try {
      // Migration compatibility: applied ledger vs repo files.
      let ledgerProblems = []
      try {
        const applied = (await run(
          `select version from supabase_migrations.schema_migrations`,
        )).rows.map((r) => r.version)
        const repo = (repoFiles ?? migrationFiles()).map((f) => f.version)
        const missing = repo.filter((v) => !applied.includes(v))
        const extra = applied.filter((v) => !repo.includes(v))
        if (missing.length) ledgerProblems.push(`migrations not applied: ${missing.join(', ')}`)
        if (extra.length) ledgerProblems.push(`ledger versions without repo files: ${extra.join(', ')}`)
      } catch (e) {
        ledgerProblems.push(`migration ledger unreadable: ${e.message}`)
      }

      const { problems, counts, phase } = await verifyRestore(run, {
        expectPhase,
        expectCounts,
      })
      const all = [...ledgerProblems, ...problems]

      if (args.json) {
        console.log(JSON.stringify({ target: target.ref, phase, counts, problems: all }, null, 2))
      } else {
        console.log(`[restore-verify] target=${target.ref} phase=${phase}`)
        for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`)
        for (const p of all) report(false, p)
      }
      if (all.length) {
        throw new Error(`${all.length} acceptance problem(s)`)
      }
      console.log('[restore-verify] PASS')
    } finally {
      if (pg) await pg.end()
    }
  })()
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(`[restore-verify] FAIL: ${e.message}`)
    process.exit(1)
  })
}
