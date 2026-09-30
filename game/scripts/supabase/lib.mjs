// Shared plumbing for the BETA B1-A supabase contract harness.
// Plain ESM so both run-contract.mjs (infra orchestration) and the playwright
// fixture can use it without a TS transform.
import { readFileSync, readdirSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { Client } from 'pg'

export const GAME_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
export const MIGRATIONS_DIR = join(GAME_ROOT, 'supabase', 'migrations')
export const AUTH_STUB_SQL = join(GAME_ROOT, 'scripts', 'supabase', 'auth-stub.sql')
export const ENV_FILE = join(GAME_ROOT, '.env.supabase.contract')

// The beta authority surface starts here; everything earlier is "legacy".
export const PREPARE_VERSION = '202609300001'
export const CUTOVER_VERSION = '202609300002'

export function loadEnv() {
  if (existsSync(ENV_FILE)) {
    process.loadEnvFile(ENV_FILE)
  }
  const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_DB_URL']
  const missing = required.filter((k) => !process.env[k])
  if (missing.length) {
    throw new Error(
      `[contract] missing ${missing.join(', ')} - create ${ENV_FILE} from ` +
        'scripts/supabase/contract.env.example or export the variables. ' +
        'Infrastructure absence fails nonzero; the suite never skips.',
    )
  }
  return {
    supabaseUrl: process.env.SUPABASE_URL.replace(/\/+$/, ''),
    anonKey: process.env.SUPABASE_ANON_KEY,
    dbUrl: process.env.SUPABASE_DB_URL,
    freshDbName: process.env.SUPABASE_FRESH_DB_NAME || 'contract_fresh',
  }
}

export function dbClient(url) {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  return client.connect().then(() => client)
}

export function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ file: f, version: f.slice(0, 12), sql: readFileSync(join(MIGRATIONS_DIR, f), 'utf8') }))
}

async function ledgerRows(pg) {
  await pg.query('create schema if not exists supabase_migrations')
  await pg.query(
    `create table if not exists supabase_migrations.schema_migrations(
       version text primary key,
       name text,
       inserted_at timestamptz not null default now())`,
  )
  const r = await pg.query('select version from supabase_migrations.schema_migrations')
  return new Set(r.rows.map((row) => row.version))
}

// Apply pending migrations in filename order inside the project ledger, exactly
// like `supabase db push` records them. Returns {applied:[], skipped:[]}.
export async function applyPending(pg, files, upto = null) {
  const applied = await ledgerRows(pg)
  const out = { applied: [], skipped: [] }
  for (const m of files) {
    if (upto && m.version > upto) continue
    if (applied.has(m.version)) {
      out.skipped.push(m.file)
      continue
    }
    await pg.query('begin')
    try {
      await pg.query(m.sql)
      await pg.query(
        'insert into supabase_migrations.schema_migrations(version, name) values ($1, $2)',
        [m.version, m.file.replace(/\.sql$/, '').slice(13)],
      )
      await pg.query('commit')
      out.applied.push(m.file)
    } catch (e) {
      await pg.query('rollback')
      throw new Error(`migration ${m.file} failed: ${e.message}`)
    }
  }
  return out
}

// Recreate a scratch database on the same server for the fresh-install path.
// The scratch database is destroyed and recreated each run; refuse reserved
// names so a misconfigured env can never target the project database.
const SCRATCH_DB_DENYLIST = new Set(['postgres', 'template0', 'template1'])

export async function resetScratchDb(env, pg) {
  const name = env.freshDbName
  if (!/^[a-z_][a-z0-9_]*$/.test(name) || SCRATCH_DB_DENYLIST.has(name)) {
    throw new Error(`unsafe scratch db name ${name}`)
  }
  await pg.query(`drop database if exists ${name} with (force)`)
  await pg.query(`create database ${name}`)
  const url = new URL(env.dbUrl)
  url.pathname = `/${name}`
  return url.toString()
}

// Seed the server talent catalog from the canonical authored data
// (src/data/talent/Talents.ts CHARACTER_CREATION_TALENTS). The expression is
// extracted by bracket-matching the array literal and transpiled with the
// repo's own typescript devDependency, so the harness never maintains a second
// copy of the catalog. Non-canonical enabled rows are disabled: a server roll
// must never hand out an id the client catalog cannot resolve.
export async function seedCanonicalTalents(pg) {
  const ts = (await import('typescript')).default
  const src = readFileSync(join(GAME_ROOT, 'src', 'data', 'talent', 'Talents.ts'), 'utf8')
  const marker = 'CHARACTER_CREATION_TALENTS'
  const mIdx = src.indexOf(marker)
  if (mIdx < 0) throw new Error('canonical catalog marker not found in Talents.ts')
  // the declaration is `export const X: TalentDefinition[] = [` - the array
  // literal starts at the first '[' AFTER the '=', not the type's [].
  const eqIdx = src.indexOf('=', mIdx)
  const open = src.indexOf('[', eqIdx)
  // bracket-match respecting strings and comments
  let depth = 0
  let i = open
  let quote = null
  for (; i < src.length; i += 1) {
    const ch = src[i]
    if (quote) {
      if (ch === '\\') i += 1
      else if (ch === quote) quote = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue }
    if (ch === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i += 1; continue }
    if (ch === '/' && src[i + 1] === '*') { while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i += 1; i += 1; continue }
    if (ch === '[') depth += 1
    if (ch === ']') { depth -= 1; if (depth === 0) break }
  }
  const literal = src.slice(open, i + 1)
  const transpiled = ts.transpileModule(`const x = ${literal}; module.exports = x`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  // Load the repo's own authored module from a temp file via createRequire -
  // no eval/Function constructor.
  const tmp = mkdtempSync(join(tmpdir(), 'talent-catalog-'))
  const cjs = join(tmp, 'catalog.cjs')
  writeFileSync(cjs, transpiled)
  const req = createRequire(import.meta.url)
  const talents = req(cjs)
  if (!Array.isArray(talents) || talents.length < 9) {
    throw new Error(`canonical catalog extraction produced ${talents?.length ?? 'no'} talents`)
  }
  const ids = talents.map((t) => t.id)
  for (const t of talents) {
    await pg.query(
      `insert into public.talents(id, name, description, rarity, weight, tags, enabled)
       values ($1, $2, $3, $4, $5, $6, true)
       on conflict (id) do update set
         name = excluded.name, description = excluded.description,
         rarity = excluded.rarity, weight = excluded.weight,
         tags = excluded.tags, enabled = true`,
      [t.id, t.name, t.description, t.rarity, t.weight, t.tags],
    )
  }
  const disabled = await pg.query(
    `update public.talents set enabled = false where enabled and not (id = any($1::text[])) returning id`,
    [ids],
  )
  return { seeded: talents.length, disabled: disabled.rows.map((r) => r.id) }
}

// Catalog shape snapshot for the fresh-install-vs-historical-upgrade
// equivalence check. Deliberately excludes role grants (default privileges
// differ between a real Supabase database and a bare scratch database); api-role
// reachability is verified separately by the functional probes.
export async function catalogSnapshot(pg) {
  const tables = await pg.query(
    `select t.table_name, c.relrowsecurity as rls
       from information_schema.tables t
       join pg_class c on c.relname = t.table_name
       join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
      where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
      order by 1`,
  )
  const columns = await pg.query(
    `select table_name, column_name, data_type, is_nullable, column_default
       from information_schema.columns where table_schema='public'
      order by table_name, ordinal_position`,
  )
  const constraints = await pg.query(
    `select conrelid::regclass::text as table_name, conname, contype, convalidated,
            pg_get_constraintdef(oid) as def
       from pg_constraint where connamespace = 'public'::regnamespace
      order by 1, 2`,
  )
  const views = await pg.query(
    `select table_name from information_schema.views where table_schema='public' order by 1`,
  )
  const indexes = await pg.query(
    `select tablename, indexname, indexdef from pg_indexes
      where schemaname='public' order by 1, 2`,
  )
  const policies = await pg.query(
    `select schemaname, tablename, policyname, permissive, cmd, qual, with_check
       from pg_policies where schemaname='public' order by 1, 2, 3`,
  )
  const functions = await pg.query(
    `select p.proname, pg_get_function_identity_arguments(p.oid) as args,
            p.prosecdef as definer, p.proconfig
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
      order by 1, 2`,
  )
  return { tables, columns, constraints, views, indexes, policies, functions }
}

export function assertCatalogEqual(label, a, b) {
  const diffs = []
  for (const key of ['tables', 'columns', 'constraints', 'views', 'indexes', 'policies', 'functions']) {
    const sa = JSON.stringify(a[key].rows)
    const sb = JSON.stringify(b[key].rows)
    if (sa !== sb) {
      diffs.push(`${key}: project=${a[key].rows.length} fresh=${b[key].rows.length}`)
      const setA = new Set(a[key].rows.map((r) => JSON.stringify(r)))
      for (const row of b[key].rows) {
        const j = JSON.stringify(row)
        if (!setA.has(j)) diffs.push(`  fresh-only ${key}: ${j}`)
      }
      const setB = new Set(b[key].rows.map((r) => JSON.stringify(r)))
      for (const row of a[key].rows) {
        const j = JSON.stringify(row)
        if (!setB.has(j)) diffs.push(`  project-only ${key}: ${j}`)
      }
    }
  }
  if (diffs.length) {
    throw new Error(`catalog divergence after ${label}:\n${diffs.slice(0, 40).join('\n')}`)
  }
}
