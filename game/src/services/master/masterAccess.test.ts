// Master gate semantics (owner ruling 2026-10-10): the key comes from
// VITE_MASTER_GATE_KEY (never committed to the repo), an unset key keeps
// the gate closed for everyone, and a correct key flags the session
// master - which masterToleratedSaveResult then uses to keep refused
// saves from wedging the test session.
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The gate key is captured at module init - stub the env BEFORE each
// dynamic import so the module under test sees the configured value.
async function freshGate(key?: string) {
  vi.resetModules()
  vi.unstubAllEnvs()
  if (key !== undefined) {
    vi.stubEnv('VITE_MASTER_GATE_KEY', key)
  }
  const master = await import('./masterAccess')
  const authority = await import('../../composables/useOnlineAuthority')
  return { master, authority }
}

describe('master gate (VITE_MASTER_GATE_KEY)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('fails closed when no key is configured - nothing admits', async () => {
    const { master } = await freshGate()
    expect(master.unlockMasterGate('anything')).toBe(false)
    expect(master.unlockMasterGate('')).toBe(false)
    expect(master.isMasterSession()).toBe(false)
  })

  it('admits only the configured key and flags the session master', async () => {
    const { master } = await freshGate('gate-key-123')
    expect(master.unlockMasterGate('wrong')).toBe(false)
    expect(master.isMasterSession()).toBe(false)
    expect(master.unlockMasterGate('gate-key-123')).toBe(true)
    expect(master.isMasterSession()).toBe(true)
  })

  it('master session also admits via the allowlisted loginId', async () => {
    const { master } = await freshGate()
    master.recordSessionLoginId('admin')
    expect(master.isMasterSession()).toBe(true)
    master.recordSessionLoginId('someone-else')
    expect(master.isMasterSession()).toBe(false)
  })

  it('locks out both gate key and admin loginId in production unless VITE_ALLOW_PROD_MASTER is set', async () => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_MASTER_GATE_KEY', 'gate-key-123')
    const masterProdLocked = await import('./masterAccess')
    expect(masterProdLocked.unlockMasterGate('gate-key-123')).toBe(false)
    masterProdLocked.recordSessionLoginId('admin')
    expect(masterProdLocked.isMasterSession()).toBe(false)

    vi.resetModules()
    vi.stubEnv('VITE_ALLOW_PROD_MASTER', 'true')
    const masterProdOptIn = await import('./masterAccess')
    expect(masterProdOptIn.unlockMasterGate('gate-key-123')).toBe(true)
    expect(masterProdOptIn.isMasterSession()).toBe(true)
  })
})

describe('masterToleratedSaveResult', () => {
  it('passes every result through untouched for a normal session', async () => {
    const { authority } = await freshGate()
    expect(
      authority.masterToleratedSaveResult({ status: 'unavailable', message: 'x', retryable: false, code: 'SAVE_INVALID' }),
    ).toEqual({ status: 'unavailable', message: 'x', retryable: false, code: 'SAVE_INVALID' })
    expect(authority.masterToleratedSaveResult({ status: 'ok', revision: 7 })).toEqual({
      status: 'ok',
      revision: 7,
    })
  })

  it('maps refused writes to ok for a master session - keeps the conflict revision', async () => {
    const { master, authority } = await freshGate('gate-key-123')
    master.unlockMasterGate('gate-key-123')
    expect(
      authority.masterToleratedSaveResult({ status: 'unavailable', message: 'x', retryable: false, code: 'SAVE_INVALID' }),
    ).toEqual({ status: 'ok', revision: 0 })
    expect(
      authority.masterToleratedSaveResult({ status: 'conflict', currentRevision: 42 }),
    ).toEqual({ status: 'ok', revision: 42 })
    expect(authority.masterToleratedSaveResult({ status: 'ok', revision: 3 })).toEqual({
      status: 'ok',
      revision: 3,
    })
  })
})
