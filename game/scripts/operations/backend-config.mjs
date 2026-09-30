#!/usr/bin/env node
// BETA-FINAL B9 (PR14) - backend_config operator levers (show | set).
//
//   node scripts/operations/backend-config.mjs --target <ref> show
//   node scripts/operations/backend-config.mjs --target <ref> set <key> '<json>' \
//        [--dry-run] --yes-i-mean-it
//
// Editable keys are the documented operator levers only (EDITABLE_KEYS).
// 'contractPhase' is migration-owned and is refused: no operator command may
// flip it by hand. 'set' upserts one key inside a transaction and re-reads it
// so the printed value is the committed one.
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

const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/

// Per-key shape validation so a mistyped lever cannot park the backend in an
// unparseable state. Keep in sync with docs/operations/beta/health-and-quota.md.
export const EDITABLE_KEYS = {
  maintenance(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return 'maintenance must be an object like {"enabled":true,"message":"..."}'
    }
    if (typeof value.enabled !== 'boolean') return 'maintenance.enabled must be a boolean'
    if (value.message !== undefined && typeof value.message !== 'string') {
      return 'maintenance.message must be a string when present'
    }
    return null
  },
  minClientVersion(value) {
    if (value === null) return null // clears the floor
    if (typeof value !== 'string' || !SEMVER_RE.test(value)) {
      return 'minClientVersion must be a semver string or null'
    }
    return null
  },
  supportedClientVersions(value) {
    if (!Array.isArray(value) || !value.every((v) => typeof v === 'string' && SEMVER_RE.test(v))) {
      return 'supportedClientVersions must be an array of semver strings'
    }
    return null
  },
  acceptedSaveSchemaVersions(value) {
    if (!Array.isArray(value) || !value.every((v) => Number.isSafeInteger(v) && v > 0)) {
      return 'acceptedSaveSchemaVersions must be an array of positive integers'
    }
    return null
  },
  supportedProtocolVersions(value) {
    if (!Array.isArray(value) || !value.every((v) => Number.isSafeInteger(v) && v > 0)) {
      return 'supportedProtocolVersions must be an array of positive integers'
    }
    return null
  },
  limits(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return 'limits must be an object (see migration 202609300001 for the field set)'
    }
    return null
  },
}

const MIGRATION_OWNED_KEYS = new Set(['contractPhase'])

export function validateConfigValue(key, jsonText) {
  if (MIGRATION_OWNED_KEYS.has(key)) {
    throw new OpsError(`'${key}' is migration-owned - apply/undo it through migrations, never by hand`)
  }
  const validator = EDITABLE_KEYS[key]
  if (!validator) {
    throw new OpsError(
      `unknown lever '${key}' - editable keys: ${Object.keys(EDITABLE_KEYS).join(', ')}`,
    )
  }
  let value
  try {
    value = JSON.parse(jsonText)
  } catch (e) {
    throw new OpsError(`value is not valid JSON: ${e.message}`)
  }
  const problem = validator(value)
  if (problem) throw new OpsError(problem)
  return value
}

export const SHOW_SQL = `select key, value, updated_at from public.backend_config order by key`
export const SET_SQL = `insert into public.backend_config(key, value, updated_at)
  values ($1, $2::jsonb, now())
  on conflict (key) do update set value = excluded.value, updated_at = now()
  returning key, value`

export function main(argv, { query } = {}) {
  return (async () => {
    const args = parseArgs(argv, { booleans: ['json', 'dry-run', 'yes-i-mean-it'] })
    const [command, key, jsonText] = args._
    if (command !== 'show' && command !== 'set') {
      throw new OpsError("usage: backend-config.mjs --target <ref> show | set <key> '<json>' [--dry-run] [--yes-i-mean-it]")
    }
    const env = loadOpsEnv({ envFile: args['env'] || DEFAULT_ENV_FILE })
    const value = command === 'set' ? validateConfigValue(key, jsonText) : null
    const target = validateTarget({
      target: args.target,
      env,
      mutating: command === 'set' && !args['dry-run'],
      yesIMeanIt: args['yes-i-mean-it'],
    })
    if (target.prodLooking) {
      console.error(
        `[config] warning: target '${target.ref}' has label '${target.label ?? 'unset'}' - ` +
          'prod-looking target.',
      )
    }
    let pg = null
    const run = query ?? (await pgClient(env.dbUrl).then((c) => {
      pg = c
      return (sql, params) => c.query(sql, params)
    }))
    try {
      if (command === 'show') {
        const rows = (await run(SHOW_SQL)).rows
        if (args.json) {
          console.log(JSON.stringify({ target: target.ref, config: rows }, null, 2))
        } else {
          console.log(`[config] target=${target.ref}`)
          for (const r of rows) console.log(`  ${r.key} = ${JSON.stringify(r.value)}`)
        }
        return
      }
      // set
      if (args['dry-run']) {
        const current = (await run(`select value from public.backend_config where key = $1`, [key])).rows[0]
        console.log(`[config] DRY-RUN target=${target.ref}`)
        console.log(`  current ${key} = ${JSON.stringify(current?.value ?? null)}`)
        console.log(`  would upsert ${key} = ${JSON.stringify(value)}`)
        console.log('  rerun without --dry-run and with --yes-i-mean-it to apply')
        return
      }
      await run('begin')
      try {
        const written = (await run(SET_SQL, [key, JSON.stringify(value)])).rows[0]
        const verify = (await run(`select value from public.backend_config where key = $1`, [key])).rows[0]
        await run('commit')
        console.log(`[config] ${key} = ${JSON.stringify(verify?.value)} (committed on ${target.ref})`)
        if (JSON.stringify(verify?.value) !== JSON.stringify(written?.value)) {
          throw new OpsError('post-commit read-back mismatch')
        }
      } catch (e) {
        await run('rollback')
        throw e
      }
    } finally {
      if (pg) await pg.end()
    }
  })()
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(`[config] FAIL: ${e instanceof OpsError ? e.message : e}`)
    process.exit(1)
  })
}
