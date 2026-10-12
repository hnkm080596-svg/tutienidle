import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuestCredentialBridge, GuestCredentialRecord, StoredSupabaseSession } from './SupabaseSession'

const config = { url: 'https://qa.invalid', anonKey: 'test-only-public-placeholder' }

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()
  get length() { return this.values.size }
  clear(): void { this.values.clear() }
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  setItem(key: string, value: string): void { this.values.set(key, value) }
  removeItem(key: string): void { this.values.delete(key) }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null }
}

function guest(label: string): StoredSupabaseSession {
  return {
    accessToken: `test-access-${label}`,
    refreshToken: `test-refresh-${label}`,
    sessionId: `test-session-${label}`,
    userId: `test-user-${label}`,
    mode: 'guest',
    expiresAtMs: Date.now() - 1_000,
  }
}

describe('closed beta refresh identity preservation', () => {
  let durable: GuestCredentialRecord | null
  let clears: number

  beforeEach(() => {
    vi.resetModules()
    durable = null
    clears = 0
    const bridge: GuestCredentialBridge = {
      async load() { return { ok: true, value: durable } },
      async save(record) { durable = { ...record }; return { ok: true, value: null } },
      async clear() { durable = null; clears++; return { ok: true, value: null } },
    }
    vi.stubGlobal('sessionStorage', new MemoryStorage())
    vi.stubGlobal('window', { electronAPI: { guestCredentials: bridge } })
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network attempt') }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('control: a current invalid-refresh rejection clears its own guest identity', async () => {
    const sessions = await import('./SupabaseSession')
    sessions.storeSupabaseSession(guest('current'))
    await vi.waitFor(() => expect(durable?.userId).toBe('test-user-current'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ code: 'refresh_token_not_found' }), { status: 400 },
    )))

    expect(await sessions.resolveSupabaseSession(config)).toBeNull()
    await vi.waitFor(() => expect(clears).toBe(1))
    expect(sessions.readSupabaseSession()).toBeNull()
    expect(durable).toBeNull()
  })

  it('control: an upstream 503 retains the guest identity for retry', async () => {
    const sessions = await import('./SupabaseSession')
    sessions.storeSupabaseSession(guest('retry'))
    await vi.waitFor(() => expect(durable?.userId).toBe('test-user-retry'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ code: 'upstream_unavailable' }), { status: 503 },
    )))

    expect(await sessions.resolveSupabaseSession(config)).toBeNull()
    expect(sessions.readSupabaseSession()?.userId).toBe('test-user-retry')
    expect(durable?.userId).toBe('test-user-retry')
    expect(clears).toBe(0)
  })

  it('SEC-SAVE-01: a refresh rate limit must preserve the guest credential for retry', async () => {
    const sessions = await import('./SupabaseSession')
    sessions.storeSupabaseSession(guest('limited'))
    await vi.waitFor(() => expect(durable?.userId).toBe('test-user-limited'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ code: 'over_request_rate_limit' }), { status: 429 },
    )))

    expect(await sessions.resolveSupabaseSession(config)).toBeNull()
    // Let the owned durable queue settle before inspecting both stores.
    await Promise.resolve()
    await Promise.resolve()
    expect.soft(sessions.readSupabaseSession()?.userId).toBe('test-user-limited')
    expect.soft(durable?.userId).toBe('test-user-limited')
    expect(clears).toBe(0)
  })

  it('SEC-SAVE-02: a rejected old refresh must not clear a newer guest login', async () => {
    const sessions = await import('./SupabaseSession')
    sessions.storeSupabaseSession(guest('old'))
    await vi.waitFor(() => expect(durable?.userId).toBe('test-user-old'))
    let respond: (response: Response) => void = () => { throw new Error('Refresh did not start') }
    const fetchSpy = vi.fn(() => new Promise<Response>((resolve) => { respond = resolve }))
    vi.stubGlobal('fetch', fetchSpy)
    const pending = sessions.resolveSupabaseSession(config)
    expect(fetchSpy).toHaveBeenCalledOnce()

    sessions.storeSupabaseSession(guest('new'))
    await vi.waitFor(() => expect(durable?.userId).toBe('test-user-new'))
    respond(new Response(JSON.stringify({ code: 'refresh_token_not_found' }), { status: 400 }))
    await pending
    await Promise.resolve()
    await Promise.resolve()

    expect.soft(sessions.readSupabaseSession()?.userId).toBe('test-user-new')
    expect.soft(durable?.userId).toBe('test-user-new')
    expect(clears).toBe(0)
  })
})
