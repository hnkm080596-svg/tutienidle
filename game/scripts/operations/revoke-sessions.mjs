#!/usr/bin/env node
// BETA-FINAL B9 (PR14) - session freeze/revoke (mutating).
//
//   node scripts/operations/revoke-sessions.mjs --target <ref> --user <uuid> [--dry-run] --yes-i-mean-it
//   node scripts/operations/revoke-sessions.mjs --target <ref> --all        [--dry-run] --yes-i-mean-it
//
// Sets revoked_at on every still-active account_sessions row for one user or
// the whole fleet. Used by the restore drill (freeze writes before any real
// recovery) and incident response (leaked credential, bad release). Revoked
// clients fail their next guarded RPC with 'session revoked' (28000) and must
// re-claim through claim_active_session - this command is the fleet-level
// counterpart of the client-facing revoke_current_session RPC.
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function scopeFromArgs(args) {
  const all = !!args.all
  const user = args.user
  if (all === !!user) {
    throw new OpsError('pass exactly one of --user <uuid> or --all')
  }
  if (user && !UUID_RE.test(user)) {
    throw new OpsError(`--user must be a uuid, got '${user}'`)
  }
  return all ? { kind: 'all' } : { kind: 'user', userId: user }
}

// COUNT + UPDATE share the same WHERE so dry-run and apply can never drift.
export function scopeSql(scope) {
  const where = scope.kind === 'all'
    ? 'revoked_at is null'
    : 'revoked_at is null and user_id = $1'
  const params = scope.kind === 'all' ? [] : [scope.userId]
  return {
    countSql: `select count(*)::int as n from public.account_sessions where ${where}`,
    updateSql: `update public.account_sessions set revoked_at = now() where ${where} returning id`,
    params,
  }
}

export function main(argv, { query } = {}) {
  return (async () => {
    const args = parseArgs(argv, { booleans: ['json', 'dry-run', 'yes-i-mean-it', 'all'] })
    const scope = scopeFromArgs(args)
    const env = loadOpsEnv({ envFile: args['env'] || DEFAULT_ENV_FILE })
    const target = validateTarget({
      target: args.target,
      env,
      mutating: !args['dry-run'],
      yesIMeanIt: args['yes-i-mean-it'],
    })
    const { countSql, updateSql, params } = scopeSql(scope)
    let pg = null
    const run = query ?? (await pgClient(env.dbUrl).then((c) => {
      pg = c
      return (sql, p) => c.query(sql, p)
    }))
    try {
      const candidates = (await run(countSql, params)).rows[0].n
      if (args['dry-run']) {
        console.log(`[revoke] DRY-RUN target=${target.ref} scope=${scope.kind}`)
        console.log(`  ${candidates} active session(s) would be revoked`)
        console.log('  rerun without --dry-run and with --yes-i-mean-it to apply')
        return
      }
      const revoked = (await run(updateSql, params)).rows.length
      console.log(`[revoke] revoked ${revoked} session(s) on ${target.ref} (scope=${scope.kind})`)
      console.log('[revoke] affected clients fail their next guarded RPC and must re-claim')
    } finally {
      if (pg) await pg.end()
    }
  })()
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(`[revoke] FAIL: ${e instanceof OpsError ? e.message : e}`)
    process.exit(1)
  })
}
