// B1-C (PR4) - resume affordance over the acked envelope mirror: with no
// local slot (remote mode stores bytes ONLY in the acked envelope), the
// stored session or envelope still yields a resumable candidate; corrupt
// or foreign-account envelopes are skipped.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hasResumeCandidate, readResumeCandidate } from './resumeSession'
import { AckedSaveCache, buildAckedSaveEnvelope } from '../services/cloudSave/AckedSaveCache'
import { resolveAckedSaveKey, setSaveAccountId } from '../services/save/saveKeys'

class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  get length() { return this.store.size }
  clear(): void { this.store.clear() }
  getItem(key: string): string | null { return this.store.get(key) ?? null }
  key(index: number): string | null { return [...this.store.keys()][index] ?? null }
  removeItem(key: string): void { this.store.delete(key) }
  setItem(key: string, value: string): void { this.store.set(key, value) }
}

const ENV = 'beta:example'

function ackedPayloadBytes(name: string): string {
  return JSON.stringify({ version: 87, player: { name } })
}

function putAcked(environmentId: string, rawPayload: string, ackedAtUtc = '2026-09-30T00:00:00Z'): void {
  const cache = new AckedSaveCache(environmentId)
  const put = cache.put(
    buildAckedSaveEnvelope({
      environmentId,
      userId: 'u1',
      characterId: 'char-1',
      revision: 5,
      rawPayload,
      ackedAtUtc,
    }),
  )
  expect(put.status).toBe('ok')
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  vi.stubGlobal('sessionStorage', new MemoryStorage())
  setSaveAccountId('u1')
})

describe('resumeSession - B1-C acked-envelope fallback', () => {
  it('no local save but a valid acked envelope -> resumable candidate with the character name', async () => {
    putAcked(ENV, ackedPayloadBytes('Vo Danh'))

    expect(await hasResumeCandidate()).toBe(true)
    const candidate = await readResumeCandidate()
    expect(candidate?.name).toBe('Vo Danh')
    expect(candidate?.session.mode).toBe('guest')
  })

  it('a corrupt acked envelope is skipped - no candidate, no throw', async () => {
    localStorage.setItem(resolveAckedSaveKey(ENV), '{"format":1,"tampered":true}')

    expect(await hasResumeCandidate()).toBe(false)
    expect(await readResumeCandidate()).toBeNull()
  })

  it('envelopes under another account stay invisible to this account', async () => {
    setSaveAccountId('u-other')
    putAcked(ENV, ackedPayloadBytes('Foreign'))
    setSaveAccountId('u1')

    expect(await hasResumeCandidate()).toBe(false)
    expect(await readResumeCandidate()).toBeNull()
  })
})
