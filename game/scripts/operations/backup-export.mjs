#!/usr/bin/env node
// BETA-FINAL B9 (PR14) - encrypted backup export (read-only on the database,
// writes artifacts to --out).
//
//   node scripts/operations/backup-export.mjs --target <ref> --out <dir> --encrypt [--dry-run]
//
// pg_dump custom format + sha256 manifest + openssl aes-256-cbc encryption.
// The passphrase comes from BACKUP_PASSPHRASE_FILE (path to a local file) -
// never a CLI argument, env value echo, or repo file. Plaintext dumps are
// refused outside development/disposable labels: Beta policy retains
// encrypted exports only (docs/operations/beta/backup-restore.md).
import path from 'node:path'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_ENV_FILE,
  OpsError,
  loadOpsEnv,
  parseArgs,
  pgClient,
  sha256File,
  validateTarget,
} from './lib.mjs'

// Tables whose presence+count lands in the manifest as restore-acceptance
// provenance. Payload contents are never read.
export const COUNTED_RELATIONS = [
  ['auth.users', 'authUsers'],
  ['auth.identities', 'authIdentities'],
  ['public.profiles', 'profiles'],
  ['public.account_sessions', 'accountSessions'],
  ['public.characters', 'characters'],
  ['public.character_saves', 'characterSaves'],
  ['public.save_mutation_receipts', 'saveMutationReceipts'],
  ['public.time_checkpoints', 'timeCheckpoints'],
]

const PLAINTEXT_OK_LABELS = new Set(['development', 'disposable'])

export function artifactBaseName(ref, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  return `beta-backup-${ref}-${stamp}`
}

// Encryption is mandatory for every retained export except throwaway
// development/disposable targets. The label is the evidence of intent.
export function assertExportPolicy(label) {
  if (!PLAINTEXT_OK_LABELS.has(label)) {
    throw new OpsError(
      `plaintext export refused on target label '${label ?? 'unset'}': Beta backups are ` +
        'retained encrypted only - rerun with --encrypt and BACKUP_PASSPHRASE_FILE set.',
    )
  }
}

export async function collectCounts(query) {
  const counts = {}
  for (const [relation, key] of COUNTED_RELATIONS) {
    try {
      const r = await query(`select count(*)::int as n from ${relation}`)
      counts[key] = r.rows[0].n
    } catch (e) {
      counts[key] = `unavailable (${e.message})`
    }
  }
  return counts
}

// Dry-run capability check: binaries present, output dir writable, env
// contract satisfied - without producing artifacts.
export function preflight({ exec, outDir, encrypt, passFile }) {
  const problems = []
  try {
    exec('pg_dump', ['--version'])
  } catch {
    problems.push('pg_dump not found on PATH')
  }
  if (encrypt) {
    try {
      exec('openssl', ['version'])
    } catch {
      problems.push('openssl not found on PATH')
    }
    if (!passFile) problems.push('--encrypt requires BACKUP_PASSPHRASE_FILE (path to passphrase file)')
    else if (!fs.existsSync(passFile)) problems.push(`BACKUP_PASSPHRASE_FILE not found: ${passFile}`)
  }
  try {
    fs.mkdirSync(outDir, { recursive: true })
    fs.accessSync(outDir, fs.constants.W_OK)
  } catch {
    problems.push(`--out directory is not writable: ${outDir}`)
  }
  return problems
}

export function main(argv, { query, exec, now } = {}) {
  return (async () => {
    const args = parseArgs(argv, { booleans: ['json', 'dry-run', 'yes-i-mean-it', 'encrypt'] })
    if (!args.out) throw new OpsError('--out <dir> is required')
    const env = loadOpsEnv({ envFile: args['env'] || DEFAULT_ENV_FILE })
    const target = validateTarget({ target: args.target, env, mutating: false })
    const encrypt = !!args.encrypt
    if (!encrypt) assertExportPolicy(target.label)

    const runExec =
      exec ??
      ((cmd, cmdArgs) =>
        execFileSync(cmd, cmdArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))
    const passFile = process.env.BACKUP_PASSPHRASE_FILE || null
    const outDir = path.resolve(args.out)
    const problems = preflight({ exec: runExec, outDir, encrypt, passFile })
    if (problems.length) throw new OpsError(`preflight failed: ${problems.join('; ')}`)

    const base = artifactBaseName(target.ref, now ?? new Date())
    const dumpPath = path.join(outDir, `${base}.dump`)
    const encPath = `${dumpPath}.enc`
    const manifestPath = path.join(outDir, `${base}.manifest.json`)

    let pg = null
    const run = query ?? (await pgClient(env.dbUrl).then((c) => {
      pg = c
      return (sql, p) => c.query(sql, p)
    }))
    try {
      const counts = await collectCounts(run)
      if (args['dry-run']) {
        console.log(`[backup] DRY-RUN target=${target.ref} label=${target.label ?? 'unset'}`)
        console.log(`  would write ${dumpPath}${encrypt ? ` (+ ${encPath})` : ''} + manifest`)
        for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`)
        console.log('  rerun without --dry-run to produce artifacts')
        return
      }

      runExec('pg_dump', ['--format=custom', '--file', dumpPath, env.dbUrl])
      const dumpSha = sha256File(dumpPath)
      let encSha = null
      if (encrypt) {
        runExec('openssl', [
          'enc', '-aes-256-cbc', '-pbkdf2', '-salt',
          '-in', dumpPath, '-out', encPath, '-pass', `file:${passFile}`,
        ])
        encSha = sha256File(encPath)
        fs.unlinkSync(dumpPath) // retain the encrypted artifact only
      }
      const manifest = {
        tool: 'scripts/operations/backup-export.mjs',
        targetRef: target.ref,
        targetLabel: target.label,
        createdAtUtc: (now ?? new Date()).toISOString(),
        pgDumpVersion: runExec('pg_dump', ['--version']).trim(),
        dumpSha256: dumpSha,
        encrypted: encrypt,
        encryptedFile: encrypt ? path.basename(encPath) : null,
        encryptedSha256: encSha,
        rowCounts: counts,
      }
      fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
      console.log(`[backup] ${encrypt ? 'encrypted ' : ''}export complete on ${target.ref}`)
      console.log(`  artifact: ${encrypt ? encPath : dumpPath}`)
      console.log(`  manifest: ${manifestPath}`)
    } finally {
      if (pg) await pg.end()
    }
  })()
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(`[backup] FAIL: ${e instanceof OpsError ? e.message : e}`)
    process.exit(1)
  })
}
