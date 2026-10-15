import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules() })

function storage(value: string | null = null) {
  const values = new Map<string, string>()
  if (value !== null) values.set('tutienidle-test-sandbox-v1', value)
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, next: string) => { values.set(key, next) },
  }
}

describe('test sandbox isolation', () => {
  it('uses a separate save slot even when a real account is bound', async () => {
    vi.stubGlobal('localStorage', storage('1'))
    vi.stubEnv('DEV', true)
    const sandbox = await import('./testSandbox')
    const keys = await import('../save/saveKeys')
    keys.setSaveAccountId('real-account')
    expect(sandbox.testSandboxActive).toBe(true)
    expect(keys.resolveSaveKey()).toBe(`tien-hiep-idle-save:${sandbox.TEST_SANDBOX_ACCOUNT_ID}`)
    expect(keys.accountIdForSession({ mode: 'login', userId: 'real-account' })).toBe(sandbox.TEST_SANDBOX_ACCOUNT_ID)
  })

  it('does not grant master save tolerance to the sandbox', async () => {
    vi.stubGlobal('localStorage', storage('1'))
    vi.stubEnv('DEV', true)
    const master = await import('../master/masterAccess')
    master.recordSessionLoginId('admin')
    expect(master.useMasterAccess().isMaster.value).toBe(true)
    expect(master.isMasterSession()).toBe(false)
    const { masterToleratedSaveResult } = await import('../../composables/useOnlineAuthority')
    const failed = { status: 'conflict' as const, currentRevision: 9 }
    expect(masterToleratedSaveResult(failed)).toEqual(failed)
  })

  it('ignores remembered sandbox mode in release builds', async () => {
    vi.stubGlobal('localStorage', storage('1'))
    vi.stubEnv('DEV', false)
    const sandbox = await import('./testSandbox')
    expect(sandbox.testSandboxActive).toBe(false)
    expect(() => sandbox.setTestSandboxMode(true)).toThrow()
  })

  it('selects only local services even when the development backend requests supabase', async () => {
    vi.stubGlobal('localStorage', storage('1'))
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_BACKEND_MODE', 'supabase')
    const { backendBundle, backendComposition, backendFatal } = await import('../backend/backendBundle')
    expect(backendComposition).toMatchObject({ status: 'ready', mode: 'mock', config: null })
    expect(backendBundle.cloudSaveCoordinator.capability).toBe('local-only')
    expect(backendFatal).toBe(null)
  })

  it('keeps the running mode unchanged when storage refuses a switch', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => '1',
      setItem: () => { throw new Error('Storage unavailable') },
    })
    vi.stubEnv('DEV', true)
    const sandbox = await import('./testSandbox')
    expect(() => sandbox.setTestSandboxMode(false)).toThrow('Storage unavailable')
    expect(sandbox.testSandboxActive).toBe(true)
  })

  it('writes the next startup mode without changing the running session', async () => {
    const store = storage()
    vi.stubGlobal('localStorage', store)
    vi.stubEnv('DEV', true)
    const sandbox = await import('./testSandbox')
    sandbox.setTestSandboxMode(true)
    expect(store.getItem('tutienidle-test-sandbox-v1')).toBe('1')
    expect(sandbox.testSandboxActive).toBe(false)
    sandbox.setTestSandboxMode(false)
    expect(store.getItem('tutienidle-test-sandbox-v1')).toBe('0')
  })
})
