#!/usr/bin/env node
// BETA-FINAL B9 (PR14) - save inventory/compatibility report (read-only).
//
//   node scripts/operations/save-inventory.mjs --target <project-ref> [--details] [--json]
//
// Summarizes public.save_inventory_compatibility: per-class counts, and with
// --details the metadata of every non-'ready' row (never the save payload -
// evidence carries ids, classes, revisions and byte counts only). Use before
// cutover, before a restore drill acceptance, and for quota/triage.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_ENV_FILE,
  loadOpsEnv,
  parseArgs,
  pgClient,
  validateTarget,
} from './lib.mjs'

export const CLASS_COUNTS_SQL = `select compatibility, count(*)::int as n
  from public.save_inventory_compatibility group by compatibility order by compatibility`

// Metadata only: payload_bytes is a length, not the payload.
export const DETAILS_SQL = `select character_id, user_id, character_name, character_deleted,
    schema_version, save_revision, compatibility, payload_bytes, receipt_count,
    updated_at, progression_cutoff_at, last_client_build_id
  from public.save_inventory_compatibility
  where compatibility <> 'ready' or character_deleted
  order by compatibility, character_id`

export async function collectInventory(query, { details = false } = {}) {
  const counts = (await query(CLASS_COUNTS_SQL)).rows
  const out = { classes: Object.fromEntries(counts.map((r) => [r.compatibility, r.n])) }
  if (details) {
    out.nonReady = (await query(DETAILS_SQL)).rows
  }
  return out
}

export function main(argv, { query } = {}) {
  return (async () => {
    const args = parseArgs(argv, { booleans: ['json', 'details', 'dry-run', 'yes-i-mean-it'] })
    const env = loadOpsEnv({ envFile: args['env'] || DEFAULT_ENV_FILE })
    const target = validateTarget({ target: args.target, env, mutating: false })
    if (target.prodLooking) {
      console.error(
        `[inventory] warning: target '${target.ref}' has label '${target.label ?? 'unset'}' - ` +
          'prod-looking target; read-only probe continuing.',
      )
    }
    let pg = null
    const run = query ?? (await pgClient(env.dbUrl).then((c) => {
      pg = c
      return (sql, params) => c.query(sql, params)
    }))
    try {
      const inv = await collectInventory(run, { details: !!args.details })
      if (args.json) {
        console.log(JSON.stringify({ target: target.ref, ...inv }, null, 2))
      } else {
        console.log(`[inventory] target=${target.ref} label=${target.label ?? 'unset'}`)
        for (const [cls, n] of Object.entries(inv.classes)) {
          console.log(`  ${cls}: ${n}`)
        }
        if (inv.nonReady) {
          console.log(`  non-ready rows: ${inv.nonReady.length}`)
          for (const row of inv.nonReady) {
            console.log(
              `    ${row.compatibility} character=${row.character_id} rev=${row.save_revision} ` +
                `schema=${row.schema_version} bytes=${row.payload_bytes} receipts=${row.receipt_count}`,
            )
          }
        }
      }
    } finally {
      if (pg) await pg.end()
    }
  })()
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(`[inventory] FAIL: ${e.message}`)
    process.exit(1)
  })
}
