import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearSupabaseLoginMarker,
  clearSupabaseSession,
  readSupabaseLoginMarker,
  readSupabaseSession,
  resolveSupabaseSession,
  storeSupabaseSession,
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
  vi.stubGlobal('localStorage', new MemoryStorage())
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

  it('F-BX-70: transient refresh failure (5xx) keeps the session so a later resolve can retry', async () => {
    storeSupabaseSession({
      accessToken: 'old', refreshToken: 'rt', sessionId: 's1',
      expiresAtMs: Date.now() - 1000,
    })
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"upstream"}', { status: 500 })))

    const session = await resolveSupabaseSession(config)

    expect(session).toBeNull()
    // The refresh token is still valid - the failure was transient. The
    // stored session must survive so the next resolve retries the POST.
    expect(readSupabaseSession()?.refreshToken).toBe('rt')
    vi.unstubAllGlobals()
  })

  it('F-BX-70: transient refresh failure (network throw) keeps the stored session', async () => {
    storeSupabaseSession({
      accessToken: 'old', refreshToken: 'rt', sessionId: 's1',
      expiresAtMs: Date.now() - 1000,
    })
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('dns timeout') }))

    const session = await resolveSupabaseSession(config)

    expect(session).toBeNull()
    expect(readSupabaseSession()?.refreshToken).toBe('rt')
    vi.unstubAllGlobals()
  })

  it('F-BX-70: rate-limited refresh (429) keeps the stored session', async () => {
    storeSupabaseSession({
      accessToken: 'old', refreshToken: 'rt', sessionId: 's1',
      expiresAtMs: Date.now() - 1000,
    })
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"rate limit"}', { status: 429 })))

    const session = await resolveSupabaseSession(config)

    expect(session).toBeNull()
    expect(readSupabaseSession()?.refreshToken).toBe('rt')
    vi.unstubAllGlobals()
  })

  it('F-BX-75: parallel resolves share one refresh - the loser cannot wipe the rotated session', async () => {
    storeSupabaseSession({
      accessToken: 'old', refreshToken: 'rt', sessionId: 's1',
      expiresAtMs: Date.now() - 1000,
    })
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({
      access_token: 'new', refresh_token: 'rt2', expires_in: 3600, user: { id: 'u1' },
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)

    const [a, b] = await Promise.all([
      resolveSupabaseSession(config),
      resolveSupabaseSession(config),
    ])

    // GoTrue rotates refresh_token on each POST: a second parallel POST
    // would carry the dead 'rt' and get invalid_grant, which the catch
    // then wrote as a full clear - destroying the session the winner
    // just stored. Single-flight means exactly one POST.
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(a?.accessToken).toBe('new')
    expect(b?.accessToken).toBe('new')
    expect(readSupabaseSession()?.accessToken).toBe('new')
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

describe('F-BX-71 - durable mirror survives restart; marker tracks the login', () => {
  const session = {
    accessToken: 'tok', refreshToken: 'rt', sessionId: 's1',
    userId: 'u1', mode: 'login' as const, expiresAtMs: Date.now() + 3_600_000,
  }

  it('full restart (sessionStorage wiped) recovers the session from localStorage and re-primes the tab copy', () => {
    storeSupabaseSession(session)
    // A restart is a fresh sessionStorage over the same localStorage.
    vi.stubGlobal('sessionStorage', new MemoryStorage())

    const restored = readSupabaseSession()
    expect(restored?.accessToken).toBe('tok')
    expect(restored?.userId).toBe('u1')
    // Re-primed: a second read needs no durable fallback to find it.
    expect(sessionStorage.getItem('tien-hiep-idle-auth-session')).not.toBeNull()
  })

  it('sessionStorage copy wins over a diverging durable mirror (this tab owns its session)', () => {
    storeSupabaseSession(session)
    localStorage.setItem('tien-hiep-idle-auth-session', JSON.stringify({ ...session, accessToken: 'other-tab' }))
    expect(readSupabaseSession()?.accessToken).toBe('tok')
  })

  it('clearSupabaseSession removes BOTH copies - the wipe is real', () => {
    storeSupabaseSession(session)
    clearSupabaseSession()
    expect(readSupabaseSession()).toBeNull()
    expect(localStorage.getItem('tien-hiep-idle-auth-session')).toBeNull()
  })

  it('a refresh-400 wipe keeps the login marker - that IS the expired-login case', async () => {
    storeSupabaseSession({ ...session, expiresAtMs: Date.now() - 1000 })
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"invalid_grant"}', { status: 400 })))

    expect(await resolveSupabaseSession(config)).toBeNull()
    expect(readSupabaseSession()).toBeNull()
    expect(readSupabaseLoginMarker()).toBe('u1')
    vi.unstubAllGlobals()
  })

  it('guest sessions never write the marker; explicit marker clear = deliberate sign-out', () => {
    storeSupabaseSession({ accessToken: 'g', refreshToken: 'g', sessionId: 'g', userId: 'ug', mode: 'guest' })
    expect(readSupabaseLoginMarker()).toBeNull()

    storeSupabaseSession(session)
    expect(readSupabaseLoginMarker()).toBe('u1')
    clearSupabaseSession()
    clearSupabaseLoginMarker()
    expect(readSupabaseLoginMarker()).toBeNull()
  })
})
