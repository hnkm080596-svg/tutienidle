// BETA-FINAL B9 (PR14) - operator script tests.
// Run: node --test scripts/operations/operations.test.mjs
// Covers target validation (prod-looking refusal), lever validation, dry-run
// non-mutation, retention floors, export policy and restore acceptance logic.
// All database access is injected - these tests never touch a real project.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  OpsError,
  isProdLooking,
  parseArgs,
  refFromUrl,
  validateTarget,
} from './lib.mjs'
import {
  EDITABLE_KEYS,
  SET_SQL,
  validateConfigValue,
  main as configMain,
} from './backend-config.mjs'
import { scopeFromArgs, scopeSql, main as revokeMain } from './revoke-sessions.mjs'
import {
  CHECKPOINT_PRUNE_SQL,
  resolveRetentionDays,
  main as pruneMain,
} from './prune-jobs.mjs'
import {
  assertExportPolicy,
  artifactBaseName,
  collectCounts,
  preflight as backupPreflight,
} from './backup-export.mjs'
import {
  compareCounts,
  verifyRestore,
} from './restore-verify.mjs'
import { diffLedger } from './migration-ledger.mjs'
import { collectStatus, STATUS_QUERIES } from './backend-status.mjs'
import { collectInventory } from './save-inventory.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const STAGING_ENV = {
  supabaseUrl: 'https://stagingref.supabase.co',
  dbUrl: 'postgresql://postgres.stagingref:x@pooler.supabase.com:6543/postgres',
  targetLabel: 'staging',
}
const PROD_ENV = {
  supabaseUrl: 'https://prodref.supabase.co',
  dbUrl: 'postgresql://postgres.prodref:x@pooler.supabase.com:6543/postgres',
  targetLabel: 'production',
}
const UNLABELED_ENV = {
  supabaseUrl: 'https://mysteryref.supabase.co',
  dbUrl: 'postgresql://postgres.mysteryref:x@pooler.supabase.com:6543/postgres',
  targetLabel: null,
}

// query fake: returns canned rows keyed by substring match.
function fakeQuery(matchers) {
  const calls = []
  const fn = async (sql, params) => {
    calls.push({ sql, params })
    for (const [substr, result] of matchers) {
      if (sql.includes(substr)) return result
    }
    throw new Error(`unexpected query: ${sql.slice(0, 80)}`)
  }
  fn.calls = calls
  return fn
}

describe('parseArgs', () => {
  it('parses flags, values, equals-form and positionals', () => {
    const a = parseArgs(['--target', 'abc', '--dry-run', '--days=14', 'set', 'maintenance'], {
      booleans: ['dry-run'],
    })
    assert.equal(a.target, 'abc')
    assert.equal(a['dry-run'], true)
    assert.equal(a.days, '14')
    assert.deepEqual(a._, ['set', 'maintenance'])
  })
})

describe('refFromUrl', () => {
  it('extracts the ref from a *.supabase.co url', () => {
    assert.equal(refFromUrl('https://abcdefghijklmnop.supabase.co'), 'abcdefghijklmnop')
    assert.equal(refFromUrl('https://abcdefghijklmnop.supabase.co/'), 'abcdefghijklmnop')
  })
  it('rejects non-supabase hosts and junk', () => {
    assert.equal(refFromUrl('https://example.com'), null)
    assert.equal(refFromUrl('not-a-url'), null)
    assert.equal(refFromUrl(''), null)
  })
})

describe('validateTarget', () => {
  it('requires --target to name the env-resolved ref', () => {
    assert.throws(
      () => validateTarget({ target: undefined, env: STAGING_ENV, mutating: false }),
      /requires? .*--target|--target .* required/i,
    )
    assert.throws(
      () => validateTarget({ target: 'otherref', env: STAGING_ENV, mutating: false }),
      /target mismatch/i,
    )
  })
  it('refuses mutating ops on prod-looking targets even with --yes-i-mean-it', () => {
    assert.throws(
      () => validateTarget({ target: 'prodref', env: PROD_ENV, mutating: true, yesIMeanIt: true }),
      /prod-looking/,
    )
    assert.throws(
      () => validateTarget({ target: 'mysteryref', env: UNLABELED_ENV, mutating: true, yesIMeanIt: true }),
      /prod-looking/,
    )
  })
  it('refuses mutating ops without --yes-i-mean-it', () => {
    assert.throws(
      () => validateTarget({ target: 'stagingref', env: STAGING_ENV, mutating: true }),
      /--yes-i-mean-it/,
    )
  })
  it('admits labeled non-prod targets with the flag, and read-only probes without it', () => {
    const t = validateTarget({ target: 'stagingref', env: STAGING_ENV, mutating: true, yesIMeanIt: true })
    assert.equal(t.ref, 'stagingref')
    assert.equal(t.prodLooking, false)
    const ro = validateTarget({ target: 'prodref', env: PROD_ENV, mutating: false })
    assert.equal(ro.prodLooking, true)
  })
  it('refuses when SUPABASE_URL is not a supabase.co host', () => {
    assert.throws(
      () => validateTarget({ target: 'x', env: { supabaseUrl: 'https://db.internal', targetLabel: 'staging' }, mutating: false }),
      /cannot parse/,
    )
  })
  it('classifies labels', () => {
    assert.equal(isProdLooking('production'), true)
    assert.equal(isProdLooking(null), true)
    assert.equal(isProdLooking('beta'), false)
    assert.equal(isProdLooking('restore'), false)
  })
})

describe('backend-config levers', () => {
  it('refuses contractPhase - it is migration-owned', () => {
    assert.throws(() => validateConfigValue('contractPhase', '"prepare"'), /migration-owned/)
  })
  it('refuses unknown keys', () => {
    assert.throws(() => validateConfigValue('evilKey', '{}'), /unknown lever/)
  })
  it('validates each lever shape', () => {
    assert.deepEqual(validateConfigValue('maintenance', '{"enabled":true,"message":"works"}'), {
      enabled: true,
      message: 'works',
    })
    assert.throws(() => validateConfigValue('maintenance', '{"enabled":"yes"}'), /boolean/)
    assert.equal(validateConfigValue('minClientVersion', '"0.1.0-beta.1"'), '0.1.0-beta.1')
    assert.equal(validateConfigValue('minClientVersion', 'null'), null)
    assert.throws(() => validateConfigValue('minClientVersion', '"latest"'), /semver/)
    assert.deepEqual(validateConfigValue('acceptedSaveSchemaVersions', '[87,88]'), [87, 88])
    assert.throws(() => validateConfigValue('acceptedSaveSchemaVersions', '["87"]'), /positive integers/)
    assert.throws(() => validateConfigValue('maintenance', '{bad json'), /not valid JSON/)
  })
  it('dry-run never issues the upsert', async () => {
    const query = fakeQuery([['select value from public.backend_config', { rows: [{ value: { enabled: false } }] }]])
    const origErr = console.error
    const origLog = console.log
    console.error = () => {}
    console.log = () => {}
    try {
      // Load env must succeed inside main(); env comes from process.env here.
      process.env.SUPABASE_URL = STAGING_ENV.supabaseUrl
      process.env.SUPABASE_DB_URL = STAGING_ENV.dbUrl
      process.env.SUPABASE_TARGET_LABEL = 'staging'
      await configMain(['--env', '/nonexistent', '--target', 'stagingref', 'set', 'maintenance', '{"enabled":true}', '--dry-run'], { query })
    } finally {
      console.error = origErr
      console.log = origLog
    }
    assert.ok(!query.calls.some((c) => c.sql === SET_SQL), 'dry-run must not upsert')
    assert.ok(!query.calls.some((c) => c.sql.trim() === 'begin'))
  })
})

describe('revoke-sessions', () => {
  it('requires exactly one of --user/--all and validates the uuid', () => {
    assert.throws(() => scopeFromArgs({}), /exactly one/)
    assert.throws(() => scopeFromArgs({ all: true, user: 'u' }), /exactly one/)
    assert.throws(() => scopeFromArgs({ user: 'not-a-uuid' }), /uuid/)
    assert.deepEqual(scopeFromArgs({ all: true }), { kind: 'all' })
    assert.equal(
      scopeFromArgs({ user: '11111111-2222-3333-4444-555555555555' }).kind,
      'user',
    )
  })
  it('builds identical WHERE for count and update', () => {
    const all = scopeSql({ kind: 'all' })
    assert.ok(all.countSql.includes('revoked_at is null'))
    assert.ok(all.updateSql.includes('revoked_at is null'))
    assert.deepEqual(all.params, [])
    const user = scopeSql({ kind: 'user', userId: 'u-1' })
    assert.ok(user.countSql.includes('user_id = $1'))
    assert.deepEqual(user.params, ['u-1'])
  })
  it('dry-run counts but never updates', async () => {
    const query = fakeQuery([['count(*)', { rows: [{ n: 3 }] }]])
    const origLog = console.log
    const origErr = console.error
    console.log = () => {}
    console.error = () => {}
    try {
      process.env.SUPABASE_URL = STAGING_ENV.supabaseUrl
      process.env.SUPABASE_DB_URL = STAGING_ENV.dbUrl
      process.env.SUPABASE_TARGET_LABEL = 'staging'
      await revokeMain(
        ['--env', '/nonexistent', '--target', 'stagingref', '--all', '--dry-run'],
        { query },
      )
    } finally {
      console.log = origLog
      console.error = origErr
    }
    assert.equal(query.calls.length, 1)
    assert.ok(query.calls[0].sql.includes('count(*)'))
  })
})

describe('prune-jobs retention', () => {
  it('enforces the max of 7-day floor, configured limit and request', () => {
    assert.equal(resolveRetentionDays(null, null), 7)
    assert.equal(resolveRetentionDays(null, 14), 14)
    assert.equal(resolveRetentionDays(30, 7), 30)
    assert.throws(() => resolveRetentionDays(3, null), /floor/)
    assert.throws(() => resolveRetentionDays(10, 21), /floor/)
  })
  it('dry-run reports candidates without deleting', async () => {
    const query = fakeQuery([
      ['receiptRetentionDays', { rows: [{ d: 7 }] }],
      ['count(*)', { rows: [{ n: 5 }] }],
    ])
    const origLog = console.log
    const origErr = console.error
    console.log = () => {}
    console.error = () => {}
    try {
      await pruneMain(
        ['--env', '/nonexistent', '--target', 'stagingref', '--dry-run'],
        { query },
      )
    } finally {
      console.log = origLog
      console.error = origErr
    }
    assert.ok(!query.calls.some((c) => c.sql === CHECKPOINT_PRUNE_SQL || c.sql.trimStart().startsWith('delete')))
  })
})

describe('backup-export policy', () => {
  it('refuses plaintext exports outside development/disposable', () => {
    assert.throws(() => assertExportPolicy('beta'), /encrypted only/)
    assert.throws(() => assertExportPolicy('production'), /encrypted only/)
    assert.throws(() => assertExportPolicy(null), /encrypted only/)
    assert.equal(assertExportPolicy('development'), undefined)
    assert.equal(assertExportPolicy('disposable'), undefined)
  })
  it('names artifacts deterministically', () => {
    const name = artifactBaseName('refabc', new Date('2026-09-30T01:02:03.456Z'))
    assert.match(name, /^beta-backup-refabc-20260930T010203Z$/)
  })
  it('preflight reports missing binaries and passphrase file', () => {
    const execFail = () => {
      throw new Error('not found')
    }
    const problems = backupPreflight({
      exec: execFail,
      outDir: '/tmp/backup-export-test',
      encrypt: true,
      passFile: '/definitely/missing',
    })
    assert.ok(problems.some((p) => p.includes('pg_dump')))
    assert.ok(problems.some((p) => p.includes('openssl')))
    assert.ok(problems.some((p) => p.includes('BACKUP_PASSPHRASE_FILE')))
  })
  it('collectCounts never reads payloads, only counts', async () => {
    const query = fakeQuery([['count(*)', { rows: [{ n: 4 }] }]])
    const counts = await collectCounts(query)
    assert.equal(counts.characters, 4)
    assert.ok(query.calls.every((c) => c.sql.includes('count(*)')))
  })
})

describe('restore-verify acceptance', () => {
  const goodGrantRow = {
    claim: true, create: true, load: true, write: true,
    heartbeat: true, revoke: true, phase: true, status: true,
    anon_status: false, helper_exposed: false, helper_exposed2: false,
    saves_open: false, config_open: false,
  }
  // verifyRestore issues a fixed sequence: phase, 9 counts, 8 integrity
  // zero-checks, grants, FK. Return results by call order.
  const COUNT_KEYS = [
    'authUsers', 'authIdentities', 'profiles', 'accountSessions', 'activeSessions',
    'characters', 'characterSaves', 'saveMutationReceipts', 'timeCheckpoints',
  ]
  const INTEGRITY_KEYS = [
    'ownerMismatch', 'nonObject', 'versionDrift', 'badRevision',
    'orphanReceipts', 'missingReceipt', 'noProfile', 'noIdentity',
  ]
  function restoreQuery(over = {}) {
    const counts = {
      authUsers: 10, authIdentities: 10, profiles: 10, accountSessions: 12,
      activeSessions: 2, characters: 9, characterSaves: 9,
      saveMutationReceipts: 20, timeCheckpoints: 30,
      ...(over.counts ?? {}),
    }
    const integrity = over.integrity ?? {}
    const results = [
      { rows: [{ phase: over.phase ?? 'cutover' }] },
      ...COUNT_KEYS.map((k) => ({ rows: [{ n: counts[k] }] })),
      ...INTEGRITY_KEYS.map((k) => ({ rows: [{ n: integrity[k] ?? 0 }] })),
      { rows: [over.grants ?? goodGrantRow] },
      { rows: [over.fk ?? { convalidated: true }] },
    ]
    let i = 0
    const fn = async (sql) => {
      if (i >= results.length) throw new Error(`extra query: ${sql.slice(0, 60)}`)
      return results[i++]
    }
    return fn
  }
  it('passes when every check is clean', async () => {
    const { problems } = await verifyRestore(restoreQuery())
    assert.deepEqual(problems, [])
  })
  it('flags a leaked grant surface and integrity violations', async () => {
    const { problems } = await verifyRestore(
      restoreQuery({
        grants: { ...goodGrantRow, anon_status: true, helper_exposed: true, saves_open: true },
        integrity: { missingReceipt: 2, ownerMismatch: 1 },
      }),
    )
    assert.ok(problems.some((p) => p.includes('anon')))
    assert.ok(problems.some((p) => p.includes('helper')))
    assert.ok(problems.some((p) => p.includes('character_saves table privileges')))
    assert.ok(problems.some((p) => p.includes('last_mutation_id')))
    assert.ok(problems.some((p) => p.includes('owner matches character owner')))
  })
  it('flags phase mismatch, unvalidated FK and expected-count drift', async () => {
    const { problems } = await verifyRestore(
      restoreQuery({ phase: 'prepare', fk: { convalidated: false } }),
      { expectCounts: { characters: 42 } },
    )
    assert.ok(problems.some((p) => p.includes("contractPhase is 'prepare'")))
    assert.ok(problems.some((p) => p.includes('NOT validated')))
    assert.ok(problems.some((p) => p.includes('characters')))
  })
  it('compareCounts reports per-key drift', () => {
    assert.deepEqual(compareCounts({ a: 1, b: 2 }, { a: 1, b: 3 }), ['b: expected 2, got 3'])
  })
})

describe('migration-ledger diff', () => {
  it('marks applied/pending/extra rows', () => {
    const repo = [
      { file: '202608240001_a.sql', version: '202608240001', sha256: 'x' },
      { file: '202609300001_b.sql', version: '202609300001', sha256: 'y' },
    ]
    const applied = [
      { version: '202608240001', name: 'a', inserted_at: 't' },
      { version: '199901010000', name: 'old', inserted_at: 't' },
    ]
    const { rows, extra } = diffLedger(repo, applied)
    assert.equal(rows[0].state, 'applied')
    assert.equal(rows[1].state, 'pending')
    assert.equal(extra[0].version, '199901010000')
  })
})

describe('status/inventory collectors', () => {
  it('collectStatus tolerates an absent inventory view', async () => {
    const query = async (sql) => {
      if (sql.includes('save_inventory_compatibility')) throw new Error('relation does not exist')
      if (sql.includes('beta_contract_phase()')) return { rows: [{ phase: 'cutover' }] }
      if (sql.includes('now()')) return { rows: [{ server_time: new Date('2026-09-30T00:00:00Z') }] }
      if (sql.includes('backend_config')) return { rows: [{ key: 'maintenance', value: { enabled: false } }] }
      if (sql.includes('schema_migrations')) return { rows: [{ version: '202608240001', name: 'a', inserted_at: 't' }] }
      if (sql.includes('has_function_privilege')) return { rows: [{ claim: true }] }
      if (sql.includes('has_table_privilege')) return { rows: [{ saves_select: false }] }
      if (sql.includes('account_sessions')) return { rows: [{ total: 2, active: 1 }] }
      throw new Error(`unexpected: ${sql.slice(0, 60)}`)
    }
    const status = await collectStatus(query)
    assert.equal(status.contractPhase, 'cutover')
    assert.match(status.save_classes, /unavailable/)
    assert.equal(STATUS_QUERIES.length, 8)
  })
  it('collectInventory reports classes and non-ready metadata only', async () => {
    const query = fakeQuery([
      ['group by compatibility', { rows: [{ compatibility: 'ready', n: 8 }, { compatibility: 'empty-payload', n: 1 }] }],
      ["compatibility <> 'ready'", { rows: [{ character_id: 'c1', compatibility: 'empty-payload', payload_bytes: 2 }] }],
    ])
    const inv = await collectInventory(query, { details: true })
    assert.deepEqual(inv.classes, { ready: 8, 'empty-payload': 1 })
    assert.equal(inv.nonReady.length, 1)
    assert.ok(!('payload' in inv.nonReady[0]))
  })
})

describe('cli env gate (spawns)', () => {
  const scripts = [
    'backend-status.mjs',
    'migration-ledger.mjs',
    'save-inventory.mjs',
    'backend-config.mjs',
    'revoke-sessions.mjs',
    'prune-jobs.mjs',
    'backup-export.mjs',
    'restore-verify.mjs',
  ]
  for (const s of scripts) {
    it(`${s} fails nonzero without env`, () => {
      const r = spawnSync(process.execPath, [path.join(HERE, s), '--env', '/nonexistent', '--target', 'x', '--dry-run'], {
        env: { PATH: process.env.PATH },
        encoding: 'utf8',
      })
      assert.notEqual(r.status, 0)
      // Any FAIL/usage/missing-env message counts: arg-shape errors must also
      // exit nonzero before env is loaded.
      assert.match(r.stderr, /FAIL|usage|missing|required/i)
    })
  }
})
