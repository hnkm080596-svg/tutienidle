// Shared plumbing for the BETA-FINAL B9 (PR14) operator scripts.
// Plain ESM; every ops script imports from here so argument parsing, target
// validation, env loading and the postgres client behave identically.
//
// Target-safety contract (see docs/operations/beta/README.md):
//   * --target <project-ref> is required on every invocation and must equal
//     the ref embedded in SUPABASE_URL (guards wrong-env-file mistakes);
//   * a target is "prod-looking" when SUPABASE_TARGET_LABEL is missing or not
//     one of NON_PROD_LABELS. Mutating commands refuse it outright;
//   * mutating commands additionally require --yes-i-mean-it;
//   * --dry-run never mutates: it prints the statement/target it would run.
// Read-only commands proceed on a prod-looking target with a warning - a
// backup/status probe against the Beta project is legitimate work.
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'

export const GAME_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
export const MIGRATIONS_DIR = join(GAME_ROOT, 'supabase', 'migrations')
export const DEFAULT_ENV_FILE = join(GAME_ROOT, '.env.supabase.contract')

export const NON_PROD_LABELS = new Set(['development', 'staging', 'beta', 'restore', 'disposable'])
export const PROJECT_REF_RE = /^[a-z0-9]{8,40}$/

export class OpsError extends Error {
  constructor(message) {
    super(message)
    this.name = 'OpsError'
  }
}

// --- argv ------------------------------------------------------------------

// Minimal flag parser: --flag, --key value and --key=value forms; positionals
// collect under '_'. Boolean flags are declared per-script so a stray
// "--dry-run false" never silently flips a safety gate.
export function parseArgs(argv, { booleans = [] } = {}) {
  const bools = new Set(booleans)
  const args = { _: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const tok = argv[i]
    if (!tok.startsWith('--')) {
      args._.push(tok)
      continue
    }
    const eq = tok.indexOf('=')
    const key = tok.slice(2, eq === -1 ? undefined : eq)
    if (bools.has(key)) {
      args[key] = eq === -1 ? true : tok.slice(eq + 1) === 'true'
      continue
    }
    args[key] = eq === -1 ? argv[++i] : tok.slice(eq + 1)
    if (args[key] === undefined) {
      throw new OpsError(`--${key} requires a value`)
    }
  }
  return args
}

// --- env -------------------------------------------------------------------

// The env file is optional when the variables already exist in the process
// environment. Format is scripts/supabase/contract.env.example plus the
// optional SUPABASE_TARGET_LABEL line documented in docs/operations/beta/.
export function loadOpsEnv({ envFile = DEFAULT_ENV_FILE, env = process.env } = {}) {
  if (envFile && existsSync(envFile)) {
    process.loadEnvFile(envFile)
  }
  const required = ['SUPABASE_URL', 'SUPABASE_DB_URL']
  const missing = required.filter((k) => !env[k])
  if (missing.length) {
    throw new OpsError(
      `missing ${missing.join(', ')} - create ${envFile} from ` +
        'scripts/supabase/contract.env.example or export the variables. ' +
        'Infrastructure absence fails nonzero; the command never skips.',
    )
  }
  return {
    supabaseUrl: env.SUPABASE_URL.replace(/\/+$/, ''),
    dbUrl: env.SUPABASE_DB_URL,
    anonKey: env.SUPABASE_ANON_KEY || null,
    targetLabel: (env.SUPABASE_TARGET_LABEL || '').trim().toLowerCase() || null,
  }
}

// 'https://<ref>.supabase.co' -> '<ref>'; null for any other host so a
// custom-domain endpoint can never be confused with a project ref.
export function refFromUrl(url) {
  const m = /^https?:\/\/([a-z0-9-]+)\.supabase\.co(?::\d+)?(?:\/|$)/.exec(url || '')
  return m ? m[1] : null
}

export function isProdLooking(label) {
  return !NON_PROD_LABELS.has(label)
}

// Validates the operator's stated target against the resolved environment.
// Throws OpsError on any refusal; returns { ref, label, prodLooking }.
export function validateTarget({ target, env, mutating, yesIMeanIt }) {
  const ref = refFromUrl(env.supabaseUrl)
  if (!ref) {
    throw new OpsError(
      `cannot parse a *.supabase.co project ref from SUPABASE_URL (${env.supabaseUrl}) - ` +
        'refusing to guess the target',
    )
  }
  if (!target) {
    throw new OpsError(`--target ${ref} is required - name the project ref you intend to operate on`)
  }
  if (target !== ref) {
    throw new OpsError(
      `target mismatch: --target says '${target}' but the env file resolves to '${ref}'. ` +
        'Check that SUPABASE_URL points at the project you meant.',
    )
  }
  const prodLooking = isProdLooking(env.targetLabel)
  if (mutating) {
    if (prodLooking) {
      throw new OpsError(
        `refusing prod-looking target '${ref}' (SUPABASE_TARGET_LABEL=${env.targetLabel ?? 'unset'}): ` +
          'mutating operator commands run only against a target labeled ' +
          [...NON_PROD_LABELS].join('/') +
          ' in the env file. Re-label only when you have verified the project is the intended one.',
      )
    }
    if (!yesIMeanIt) {
      throw new OpsError(`mutating command on '${ref}' requires --yes-i-mean-it (or use --dry-run first)`)
    }
  }
  return { ref, label: env.targetLabel, prodLooking }
}

// --- postgres --------------------------------------------------------------

export async function pgClient(dbUrl) {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  await client.connect()
  return client
}

// --- repo facts ------------------------------------------------------------

export function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({
      file: f,
      version: f.slice(0, 12),
      sha256: sha256File(join(MIGRATIONS_DIR, f)),
    }))
}

export function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

// --- output ----------------------------------------------------------------

export function report(ok, name, detail) {
  console.log(`  [${ok ? 'ok' : 'FAIL'}] ${name}${detail ? ` - ${detail}` : ''}`)
  return ok
}
