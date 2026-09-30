// B1-C durable journal + acked envelope units (PR4).
// Acceptance seeds asserted here (plan section 8):
//   journal.read(otherBinding) -> no record
//   journal.clearMatching(binding, olderMutationId) -> false
// Isolation by environment/project/user/character + byte-hash
// validation are envelope-level invariants.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setSaveAccountId, resolveAckedSaveKey, resolvePendingSaveKey } from '../save/saveKeys'
import {
  buildPendingSaveRecord,
  fnv1a64Hex,
  PendingSaveJournal,
  type PendingSaveRecord,
} from './PendingSaveJournal'
import {
  buildAckedSaveEnvelope,
  AckedSaveCache,
  parseAckedSaveEnvelope,
  readAnyAckedSaveEnvelope,
} from './AckedSaveCache'

class MemoryStorage implements Storage {
  private data = new Map<string, string>()
  get length() { return this.data.size }
  clear() { this.data.clear() }
  getItem(key: string) { return this.data.get(key) ?? null }
  key(index: number) { return [...this.data.keys()][index] ?? null }
  removeItem(key: string) { this.data.delete(key) }
  setItem(key: string, value: string) { this.data.set(key, value) }
}

const ENV = 'staging:example'
const BINDING = { environmentId: ENV, userId: 'u1', characterId: 'char-1' }

function record(overrides: Partial<PendingSaveRecord> = {}): PendingSaveRecord {
  return buildPendingSaveRecord({
    environmentId: ENV,
    userId: 'u1',
    characterId: 'char-1',
    mutationId: 'mut-1',
    baseRevision: 5,
    timeCheckpoint: { checkpointId: 'chk-1', elapsedMonotonicMs: 1200 },
    schemaVersion: 7,
    buildId: 'build-x',
    createdAtUtc: '2026-09-30T00:00:00Z',
    rawPayload: '{"version":7}',
    ...overrides,
  })
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  vi.stubGlobal('sessionStorage', new MemoryStorage())
  setSaveAccountId('u1')
})

describe('PendingSaveJournal - identity-bound envelope', () => {
  it('put/read roundtrip for the exact binding', () => {
    const journal = new PendingSaveJournal(ENV)
    const rec = record()
    expect(journal.put(rec)).toEqual({ status: 'ok' })
    const read = journal.read(BINDING)
    expect(read.status).toBe('pending')
    if (read.status === 'pending') expect(read.record).toEqual(rec)
  })

  it('journal.read(otherBinding) returns no record (acceptance seed)', () => {
    const journal = new PendingSaveJournal(ENV)
    journal.put(record())
    // Different character, different user, different environment.
    for (const other of [
      { ...BINDING, characterId: 'char-9' },
      { ...BINDING, userId: 'u2' },
      { ...BINDING, environmentId: 'production:example' },
    ]) {
      expect(journal.read(other).status).not.toBe('pending')
    }
    // Other environment is simply absent; same-env identity drift is a
    // quarantinable mismatch, not a silently ignored record.
    expect(journal.read({ ...BINDING, environmentId: 'production:example' }).status).toBe('none')
    expect(journal.read({ ...BINDING, characterId: 'char-9' }).status).toBe('mismatch')
    expect(journal.read({ ...BINDING, userId: 'u2' }).status).toBe('mismatch')
    expect(journal.readForUser('u2').status).toBe('mismatch')
  })

  it('journal.clearMatching(binding, olderMutationId) returns false (acceptance seed)', () => {
    const journal = new PendingSaveJournal(ENV)
    journal.put(record({ mutationId: 'mut-new' }))
    const cleared = journal.clearMatching(BINDING, 'mut-old')
    expect(cleared).toEqual({ status: 'ok', cleared: false })
    expect(journal.read(BINDING).status).toBe('pending')
  })

  it('clearMatching drops exactly the matching record', () => {
    const journal = new PendingSaveJournal(ENV)
    journal.put(record())
    expect(journal.clearMatching(BINDING, 'mut-1')).toEqual({ status: 'ok', cleared: true })
    expect(journal.read(BINDING).status).toBe('none')
  })

  it('byte-hash tampering reads as corrupt, never as a record', () => {
    const journal = new PendingSaveJournal(ENV)
    journal.put(record())
    const raw = localStorage.getItem(resolvePendingSaveKey(ENV))!
    localStorage.setItem(resolvePendingSaveKey(ENV), raw.replace('mut-1', 'mut-9'))
    expect(journal.read(BINDING).status).toBe('corrupt')
  })

  it('different environments occupy different slots under one account', () => {
    const a = new PendingSaveJournal('staging:example')
    const b = new PendingSaveJournal('production:example')
    a.put(record())
    expect(b.read({ ...BINDING, environmentId: 'production:example' }).status).toBe('none')
    b.put(record({ environmentId: 'production:example' }))
    expect(a.read(BINDING).status).toBe('pending')
  })

  it('account switch namespaces the slot (second account sees nothing)', () => {
    const journal = new PendingSaveJournal(ENV)
    journal.put(record())
    setSaveAccountId('u2')
    expect(journal.read({ ...BINDING, userId: 'u2' }).status).toBe('none')
  })

  it('put rejects a record whose environmentId differs from the journal', () => {
    const journal = new PendingSaveJournal(ENV)
    expect(journal.put(record({ environmentId: 'other:env' })).status).toBe('error')
  })

  it('quota failure on put reports a typed error, never throws', () => {
    const storage = new MemoryStorage()
    storage.setItem = () => {
      throw new DOMException('quota', 'QuotaExceededError')
    }
    const journal = new PendingSaveJournal(ENV, { storage })
    const result = journal.put(record())
    expect(result.status).toBe('error')
    if (result.status === 'error') expect(result.reason).toBe('quota')
  })

  it('quarantine parks raw bytes in a bounded list for export', () => {
    const journal = new PendingSaveJournal(ENV, { nowIso: () => '2026-09-30T01:00:00Z' })
    journal.quarantine('{"corrupt":true}', 'journal-envelope-corrupt')
    journal.quarantine('{"mismatch":true}', 'journal-identity-mismatch')
    const entries = journal.readQuarantine()
    expect(entries).toHaveLength(2)
    expect(entries[0]!).toMatchObject({ reason: 'journal-envelope-corrupt', raw: '{"corrupt":true}' })
    expect(entries[1]!.reason).toBe('journal-identity-mismatch')
  })

  it('frozen timeCheckpoint survives put/read byte-identically', () => {
    const journal = new PendingSaveJournal(ENV)
    const rec = record({ timeCheckpoint: { checkpointId: 'chk-frozen', elapsedMonotonicMs: 4242 } })
    journal.put(rec)
    const read = journal.read(BINDING)
    if (read.status !== 'pending') throw new Error('expected pending')
    expect(read.record.timeCheckpoint).toEqual({ checkpointId: 'chk-frozen', elapsedMonotonicMs: 4242 })
  })
})

describe('AckedSaveCache - single identity-bound envelope', () => {
  function envelope(overrides = {}) {
    return buildAckedSaveEnvelope({
      environmentId: ENV,
      userId: 'u1',
      characterId: 'char-1',
      revision: 6,
      rawPayload: '{"version":7,"player":{}}',
      ackedAtUtc: '2026-09-30T00:00:00Z',
      ...overrides,
    })
  }

  it('put/read roundtrip carries payload+revision+identity together', () => {
    const cache = new AckedSaveCache(ENV)
    const env = envelope()
    expect(cache.put(env)).toEqual({ status: 'ok' })
    const read = cache.read(BINDING)
    expect(read.status).toBe('ok')
    if (read.status === 'ok') {
      expect(read.envelope.revision).toBe(6)
      expect(read.envelope.rawPayload).toBe(env.rawPayload)
    }
  })

  it('byte-hash tamper is a corrupt envelope, not a stale truth', () => {
    const cache = new AckedSaveCache(ENV)
    cache.put(envelope())
    const raw = localStorage.getItem(resolveAckedSaveKey(ENV))!
    localStorage.setItem(resolveAckedSaveKey(ENV), raw.replace('"revision":6', '"revision":60'))
    expect(cache.read(BINDING).status).toBe('corrupt')
  })

  it('read(binding) isolates by user/character; env mismatch by construction', () => {
    const cache = new AckedSaveCache(ENV)
    cache.put(envelope())
    expect(cache.read({ ...BINDING, userId: 'u2' }).status).toBe('none')
    expect(cache.read({ ...BINDING, characterId: 'char-9' }).status).toBe('none')
    const otherEnv = new AckedSaveCache('production:example')
    expect(otherEnv.read({ ...BINDING, environmentId: 'production:example' }).status).toBe('none')
  })

  it('readAnyAckedSaveEnvelope picks the newest valid envelope across envs', () => {
    const a = new AckedSaveCache('staging:example')
    const b = new AckedSaveCache('production:example')
    a.put(envelope({ ackedAtUtc: '2026-09-30T00:00:00Z', revision: 6 }))
    b.put(envelope({
      environmentId: 'production:example', ackedAtUtc: '2026-09-30T02:00:00Z', revision: 9,
    }))
    const newest = readAnyAckedSaveEnvelope('u1')
    expect(newest?.environmentId).toBe('production:example')
    expect(newest?.revision).toBe(9)
  })

  it('readAnyAckedSaveEnvelope skips foreign accounts and corrupt entries', () => {
    const a = new AckedSaveCache('staging:example')
    a.put(envelope())
    const u1Key = resolveAckedSaveKey('staging:example')
    setSaveAccountId('u2')
    expect(readAnyAckedSaveEnvelope('u2')).toBeNull()
    expect(readAnyAckedSaveEnvelope('u1')).not.toBeNull()
    localStorage.setItem(u1Key, '{"broken"')
    expect(readAnyAckedSaveEnvelope('u1')).toBeNull()
  })
})

describe('fnv1a64Hex', () => {
  it('is deterministic, order-sensitive, and 16-hex wide', () => {
    const a = fnv1a64Hex('abc')
    expect(a).toBe(fnv1a64Hex('abc'))
    expect(a).not.toBe(fnv1a64Hex('acb'))
    expect(a).toMatch(/^[0-9a-f]{16}$/)
  })
})
