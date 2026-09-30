#!/usr/bin/env node
// BETA-FINAL B9 (PR14) - receipt + checkpoint pruning (mutating).
//
//   node scripts/operations/prune-jobs.mjs --target <ref> [--days <n>] [--dry-run] --yes-i-mean-it
//
// Implements the daily operator jobs from docs/operations/beta/backend-cutover.md:
//   * save_mutation_receipts older than the retention floor are deleted -
//     floor = max(--days, backend_config.limits.receiptRetentionDays, 7);
//     expired/aged receipts never relax CAS.
//   * time_checkpoints whose lease expired more than a day ago are deleted -
//     load_game_state and heartbeat_session issue one row per call.
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

export const RECEIPT_RETENTION_FLOOR_DAYS = 7
export const CHECKPOINT_PRUNE_SQL = `delete from public.time_checkpoints
  where lease_expires_at < now() - interval '1 day'`
export const CHECKPOINT_COUNT_SQL = `select count(*)::int as n from public.time_checkpoints
  where lease_expires_at < now() - interval '1 day'`

// Retention days must satisfy both the hard floor and the configured
// backend_config limit; a smaller --days never loosens either.
export function resolveRetentionDays(requested, configured) {
  const floor = Math.max(RECEIPT_RETENTION_FLOOR_DAYS, configured ?? 0)
  const days = requested ?? floor
  if (!Number.isSafeInteger(days) || days < floor) {
    throw new OpsError(
      `receipt retention ${requested}d is below the floor ${floor}d ` +
        `(7-day minimum and backend_config.limits.receiptRetentionDays)`,
    )
  }
  return days
}

export function receiptSql(days) {
  return {
    countSql: `select count(*)::int as n from public.save_mutation_receipts
      where created_at < now() - make_interval(days => $1)`,
    deleteSql: `delete from public.save_mutation_receipts
      where created_at < now() - make_interval(days => $1)`,
    params: [days],
  }
}

export function main(argv, { query } = {}) {
  return (async () => {
    const args = parseArgs(argv, { booleans: ['json', 'dry-run', 'yes-i-mean-it'] })
    const env = loadOpsEnv({ envFile: args['env'] || DEFAULT_ENV_FILE })
    const target = validateTarget({
      target: args.target,
      env,
      mutating: !args['dry-run'],
      yesIMeanIt: args['yes-i-mean-it'],
    })
    const requestedDays = args.days === undefined ? null : Number.parseInt(args.days, 10)
    let pg = null
    const run = query ?? (await pgClient(env.dbUrl).then((c) => {
      pg = c
      return (sql, p) => c.query(sql, p)
    }))
    try {
      const configured = (
        await run(`select (value->>'receiptRetentionDays')::int as d from public.backend_config where key='limits'`)
      ).rows[0]?.d
      const days = resolveRetentionDays(requestedDays, configured)

      const receipt = receiptSql(days)
      const receiptCandidates = (await run(receipt.countSql, receipt.params)).rows[0].n
      const checkpointCandidates = (await run(CHECKPOINT_COUNT_SQL)).rows[0].n

      if (args['dry-run']) {
        console.log(`[prune] DRY-RUN target=${target.ref} receiptRetentionDays=${days}`)
        console.log(`  ${receiptCandidates} receipt(s) older than ${days}d would be deleted`)
        console.log(`  ${checkpointCandidates} expired checkpoint(s) would be deleted`)
        console.log('  rerun without --dry-run and with --yes-i-mean-it to apply')
        return
      }
      const receipts = (await run(receipt.deleteSql, receipt.params)).rowCount ?? 0
      const checkpoints = (await run(CHECKPOINT_PRUNE_SQL)).rowCount ?? 0
      console.log(`[prune] deleted ${receipts} receipt(s) + ${checkpoints} checkpoint(s) on ${target.ref}`)
    } finally {
      if (pg) await pg.end()
    }
  })()
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(`[prune] FAIL: ${e instanceof OpsError ? e.message : e}`)
    process.exit(1)
  })
}
