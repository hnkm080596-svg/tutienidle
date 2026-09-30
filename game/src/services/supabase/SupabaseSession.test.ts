import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearDurableGuestCredential,
  clearSupabaseSession,
  readSupabaseSession,
  resolveSupabaseSession,
  restoreDurableGuestSession,
  storeSupabaseSession,
  type GuestCredentialBridge,
  type GuestCredentialRecord,
} from './SupabaseSession'

const config = { url: 'https://example.supabase.co', anonKey: 'anon' }

class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  get length() { return this.store.size }
  clear(): void { this.store.clear() }
  getItem(key: string): string | null { return this.store.get(key) ?? null }
  setItem(key: string, value: string): void { this.store.set(key, value) }
  removeItem(key: string): void { this.store.delete(key) }
  key(index: number): string | null { return Array.from(this.store.keys())[index] ?? null }
}

beforeEach(() => {
  vi.stubGlobal('sessionStorage', new MemoryStorage())
})

describe('resolveSupabaseSession - refresh-aware accessor (spec F8)', () => {
  it('returns the stored session when expiry is comfortably ahead', async () => {
    storeSupabaseSession({
      accessToken: 'tok-live', refreshToken: 'rt', sessionId: 's1',
      userId: 'u1', mode: 'login', expiresAtMs: Date.now() + 3_600_000,
    })
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const session = await resolveSupabaseSession(config)

    expect(session?.accessToken).toBe('tok-live')
    expect(fetchSpy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('refreshes an expired token via GoTrue and persists the new session', async () => {
    storeSupabaseSession({
      accessToken: 'old', refreshToken: 'rt', sessionId: 's1',
      userId: 'u1', mode: 'login', expiresAtMs: Date.now() - 1000,
    })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      access_token: 'new', refresh_token: 'rt2', expires_in: 3600, user: { id: 'u1' },
    }), { status: 200 })))

    const session = await resolveSupabaseSession(config)

    expect(session?.accessToken).toBe('new')
    expect(readSupabaseSession()?.accessToken).toBe('new')
    expect(readSupabaseSession()?.refreshToken).toBe('rt2')
    vi.unstubAllGlobals()
  })

  it('refreshes when the session predates expiry tracking (missing expiresAtMs)', async () => {
    storeSupabaseSession({ accessToken: 'old', refreshToken: 'rt', sessionId: 's1' })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      access_token: 'new', refresh_token: 'rt2', expires_in: 3600, user: { id: 'u1' },
    }), { status: 200 })))

    const session = await resolveSupabaseSession(config)

    expect(session?.accessToken).toBe('new')
    vi.unstubAllGlobals()
  })

  it('refresh failure clears the session and returns null - never a silent stall', async () => {
    storeSupabaseSession({
      accessToken: 'old', refreshToken: 'rt', sessionId: 's1',
      expiresAtMs: Date.now() - 1000,
    })
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"invalid"}', { status: 400 })))

    const session = await resolveSupabaseSession(config)

    expect(session).toBeNull()
    expect(readSupabaseSession()).toBeNull()
    vi.unstubAllGlobals()
  })

  it('no stored session -> null, no fetch', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    expect(await resolveSupabaseSession(config)).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})

describe('resolveSupabaseSession - B1-D/R8 single-flight + transient retention', () => {
  it('concurrent resolves share ONE GoTrue refresh request (rotating refresh token)', async () => {
    storeSupabaseSession({
      accessToken: 'old', refreshToken: 'rt', sessionId: 's1',
      expiresAtMs: Date.now() - 1000,
    })
    let calls = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls++
      await new Promise((resolve) => setTimeout(resolve, 5))
      return new Response(JSON.stringify({
        access_token: 'new', refresh_token: 'rt2', expires_in: 3600,
      }), { status: 200 })
    }))

    const [a, b, c] = await Promise.all([
      resolveSupabaseSession(config),
      resolveSupabaseSession(config),
      resolveSupabaseSession(config),
    ])

    expect(calls).toBe(1)
    expect(a?.accessToken).toBe('new')
    expect(b?.accessToken).toBe('new')
    expect(c?.accessToken).toBe('new')
    vi.unstubAllGlobals()
  })

  it('a transient refresh failure (5xx) returns null but RETAINS the credential', async () => {
    storeSupabaseSession({
      accessToken: 'old', refreshToken: 'rt', sessionId: 's1',
      expiresAtMs: Date.now() - 1000,
    })
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"upstream"}', { status: 500 })))

    const session = await resolveSupabaseSession(config)

    expect(session).toBeNull()
    // R8: transient refresh errors NEVER delete the credential - the
    // stored refresh token survives for the next reconnect attempt.
    expect(readSupabaseSession()?.refreshToken).toBe('rt')
    vi.unstubAllGlobals()
  })

  it('a transport failure (fetch rejection) retains the credential too', async () => {
    storeSupabaseSession({
      accessToken: 'old', refreshToken: 'rt', sessionId: 's1',
      expiresAtMs: Date.now() - 1000,
    })
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('fetch failed')
    }))

    expect(await resolveSupabaseSession(config)).toBeNull()
    expect(readSupabaseSession()?.refreshToken).toBe('rt')
    vi.unstubAllGlobals()
  })

  it('a refresh resolving after sign-out cannot resurrect the old binding (generation guard)', async () => {
    storeSupabaseSession({
      accessToken: 'old', refreshToken: 'rt', sessionId: 's1',
      expiresAtMs: Date.now() - 1000,
    })
    let releaseFetch: (response: Response) => void = () => undefined
    vi.stubGlobal('fetch', vi.fn(async () => new Promise<Response>((resolve) => {
      releaseFetch = resolve
    })))

    const pending = resolveSupabaseSession(config)
    // Sign-out lands mid-refresh: the binding changed underneath it.
    const { clearSupabaseSession } = await import('./SupabaseSession')
    clearSupabaseSession()
    releaseFetch(new Response(JSON.stringify({
      access_token: 'new', refresh_token: 'rt2', expires_in: 3600,
    }), { status: 200 }))

    expect(await pending).toBeNull()
    // Storage stays empty - the in-flight write was fenced by generation.
    expect(readSupabaseSession()).toBeNull()
    vi.unstubAllGlobals()
  })
})

// B1.8 - the durable guest seam: guest sessions write through to the
// OS-protected store behind the preload bridge; registered sessions stay
// session-scoped; restore hydrates WITHOUT trusting the credential as a
// live token (empty accessToken, no expiresAtMs -> first resolve always
// refreshes).
describe('durable guest credential seam (B1.8)', () => {
  let saved: GuestCredentialRecord[]
  let clears: number
  let loadResult: unknown = { ok: true as const, value: null }

  const bridge: GuestCredentialBridge = {
    async load() { return loadResult as never },
    async save(record) { saved.push(record); return { ok: true as const, value: null } },
    async clear() { clears++; return { ok: true as const, value: null } },
  }

  beforeEach(() => {
    saved = []
    clears = 0
    loadResult = { ok: true, value: null }
    vi.stubGlobal('electronAPI', { guestCredentials: bridge })
  })

  it('guest store writes the durable record; pendingUpgrade carried', async () => {
    storeSupabaseSession({
      accessToken: 't', refreshToken: 'rt', sessionId: 's1', userId: 'u1',
      mode: 'guest', pendingUpgrade: { loginId: 'dao_huu_1' },
    })

    await vi.waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0]).toEqual({
      refreshToken: 'rt', sessionId: 's1', userId: 'u1',
      pendingUpgradeLoginId: 'dao_huu_1',
    })
    vi.unstubAllGlobals()
  })

  it('registered sessions stay session-scoped - NO durable write', async () => {
    storeSupabaseSession({
      accessToken: 't', refreshToken: 'rt', sessionId: 's1',
      userId: 'u1', mode: 'login',
    })
    await Promise.resolve()

    expect(saved).toHaveLength(0)
    vi.unstubAllGlobals()
  })

  it('a rotated refresh persists to durable BEFORE the old record retires (write-through)', async () => {
    storeSupabaseSession({ accessToken: 't', refreshToken: 'rt-1', sessionId: 's1', userId: 'u1', mode: 'guest' })
    storeSupabaseSession({ accessToken: 't2', refreshToken: 'rt-2', sessionId: 's1', userId: 'u1', mode: 'guest' })

    await vi.waitFor(() => expect(saved).toHaveLength(2))
    expect(saved[1]?.refreshToken).toBe('rt-2')
    vi.unstubAllGlobals()
  })

  it('restore hydrates a guest session carrying NO usable token - first resolve refreshes', async () => {
    loadResult = {
      ok: true,
      value: { refreshToken: 'rt-durable', sessionId: 'gs-9', userId: 'u1', pendingUpgradeLoginId: 'dao_huu_1' },
    }

    const status = await restoreDurableGuestSession()

    expect(status).toBe('restored')
    const stored = readSupabaseSession()
    expect(stored?.mode).toBe('guest')
    expect(stored?.refreshToken).toBe('rt-durable')
    expect(stored?.userId).toBe('u1')
    expect(stored?.pendingUpgrade?.loginId).toBe('dao_huu_1')
    // The credential is never trusted as a live token.
    expect(stored?.accessToken).toBe('')
    expect(stored?.expiresAtMs).toBeUndefined()
    vi.unstubAllGlobals()
  })

  it('restore is absent without a bridge (browser build stays session-scoped)', async () => {
    vi.stubGlobal('electronAPI', undefined)

    expect(await restoreDurableGuestSession()).toBe('absent')
    vi.unstubAllGlobals()
  })

  it('a corrupted durable record -> corrupted, nothing hydrated, no signup invented', async () => {
    loadResult = { ok: false, code: 'corrupted' }

    expect(await restoreDurableGuestSession()).toBe('corrupted')
    expect(readSupabaseSession()).toBeNull()
    vi.unstubAllGlobals()
  })

  it('a live stored session wins over the durable record', async () => {
    storeSupabaseSession({ accessToken: 't', refreshToken: 'rt', sessionId: 's1', mode: 'login', userId: 'u-registered' })
    loadResult = { ok: true, value: { refreshToken: 'rt-guest', sessionId: 'gs-1' } }
    const loadSpy = vi.spyOn(bridge, 'load')

    expect(await restoreDurableGuestSession()).toBe('restored')
    expect(readSupabaseSession()?.userId).toBe('u-registered')
    expect(loadSpy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('clearSupabaseSession retires the durable record for guests only', async () => {
    storeSupabaseSession({ accessToken: 't', refreshToken: 'rt', sessionId: 's1', mode: 'login' })
    clearSupabaseSession()
    await Promise.resolve()
    expect(clears).toBe(0)

    storeSupabaseSession({ accessToken: 't', refreshToken: 'rt', sessionId: 's1', mode: 'guest' })
    clearSupabaseSession()
    await vi.waitFor(() => expect(clears).toBe(1))
    vi.unstubAllGlobals()
  })

  it('explicit clearDurableGuestCredential reaches the bridge without touching the slot', async () => {
    storeSupabaseSession({ accessToken: 't', refreshToken: 'rt', sessionId: 's1', mode: 'login' })
    clearDurableGuestCredential()
    await vi.waitFor(() => expect(clears).toBe(1))
    expect(readSupabaseSession()?.sessionId).toBe('s1')
    vi.unstubAllGlobals()
  })

  // LAST in this describe: a failed durable op latches the seam off for
  // the rest of the module instance (a dead safeStorage is not hammered).
  it('a durable failure latches the seam - later ops skip the dead store', async () => {
    let saves = 0
    const deadBridge: GuestCredentialBridge = {
      async load() { return { ok: true, value: null } },
      async save() { saves++; return { ok: false as const, code: 'unavailable' as const } },
      async clear() { return { ok: true as const, value: null } },
    }
    vi.stubGlobal('electronAPI', { guestCredentials: deadBridge })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    storeSupabaseSession({ accessToken: 't', refreshToken: 'rt', sessionId: 's1', mode: 'guest' })
    await vi.waitFor(() => expect(saves).toBe(1))
    storeSupabaseSession({ accessToken: 't', refreshToken: 'rt2', sessionId: 's1', mode: 'guest' })
    await Promise.resolve()
    await Promise.resolve()
    expect(saves).toBe(1)
    vi.unstubAllGlobals()
  })
})
