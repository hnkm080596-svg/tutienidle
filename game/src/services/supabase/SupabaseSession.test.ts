import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
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
