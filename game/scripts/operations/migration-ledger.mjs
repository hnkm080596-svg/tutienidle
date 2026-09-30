#!/usr/bin/env node
// BETA-FINAL B9 (PR14) - migration inventory + ledger diff (read-only).
//
//   node scripts/operations/migration-ledger.mjs --target <project-ref> [--json]
//
// Prints every repo migration file with its sha256 hash and whether the
// target project's supabase_migrations.schema_migrations ledger recorded it,
// plus ledger rows that have no repo file. environments.md records the
// authoritative hash table; this command is how operators prove a target is
// at the expected migration level before/after applies and restores.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_ENV_FILE,
  loadOpsEnv,
  migrationFiles,
  parseArgs,
  pgClient,
  validateTarget,
} from './lib.mjs'

// Combines repo migration files with the applied ledger rows into one
// ordered view. `applied` rows carry {version, name, inserted_at}.
export function diffLedger(repoFiles, appliedRows) {
  const applied = new Map(appliedRows.map((r) => [r.version, r]))
  const repoVersions = new Set(repoFiles.map((f) => f.version))
  const rows = repoFiles.map((f) => ({
    version: f.version,
    file: f.file,
    sha256: f.sha256,
    appliedAt: applied.get(f.version)?.inserted_at ?? null,
    state: applied.has(f.version) ? 'applied' : 'pending',
  }))
  const extra = appliedRows
    .filter((r) => !repoVersions.has(r.version))
    .map((r) => ({ version: r.version, name: r.name, appliedAt: r.inserted_at, state: 'extra-in-target' }))
  return { rows, extra }
}

export async function collectLedger(query, repoFiles) {
  let applied
  try {
    const r = await query(
      `select version, name, inserted_at from supabase_migrations.schema_migrations order by version`,
    )
    applied = r.rows
  } catch (e) {
    if (/schema_migrations|does not exist/i.test(e.message)) {
      applied = []
    } else {
      throw e
    }
  }
  return diffLedger(repoFiles, applied)
}

export function main(argv, { query, repoFiles } = {}) {
  return (async () => {
    const args = parseArgs(argv, { booleans: ['json', 'dry-run', 'yes-i-mean-it'] })
    const env = loadOpsEnv({ envFile: args['env'] || DEFAULT_ENV_FILE })
    const target = validateTarget({ target: args.target, env, mutating: false })
    if (target.prodLooking) {
      console.error(
        `[ledger] warning: target '${target.ref}' has label '${target.label ?? 'unset'}' - ` +
          'prod-looking target; read-only probe continuing.',
      )
    }
    let pg = null
    const run = query ?? (await pgClient(env.dbUrl).then((c) => {
      pg = c
      return (sql, params) => c.query(sql, params)
    }))
    try {
      const { rows, extra } = await collectLedger(run, repoFiles ?? migrationFiles())
      if (args.json) {
        console.log(JSON.stringify({ target: target.ref, rows, extra }, null, 2))
      } else {
        console.log(`[ledger] target=${target.ref} label=${target.label ?? 'unset'}`)
        for (const r of rows) {
          console.log(`  ${r.state === 'applied' ? '[applied]' : '[pending]'} ${r.file}  sha256=${r.sha256.slice(0, 16)}...`)
        }
        for (const r of extra) {
          console.log(`  [extra-in-target] ${r.version}_${r.name} (no repo file)`)
        }
        const pending = rows.filter((r) => r.state === 'pending').length
        console.log(`[ledger] ${rows.length - pending} applied, ${pending} pending, ${extra.length} extra`)
      }
    } finally {
      if (pg) await pg.end()
    }
  })()
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(`[ledger] FAIL: ${e.message}`)
    process.exit(1)
  })
}
