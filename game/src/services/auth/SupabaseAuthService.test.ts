// B1.7/B1.8/B1.9 - guest resume (refresh + claim take-back), same-uuid
// upgrade with the EXT-09 pending-confirm state machine, resumable
// finalize, and the honestly-reported logout legs. Fetch is stubbed per
// path so each spec asserts call ORDER (revoke before signout) and the
// stored-session mutation surface.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseAuthService } from './SupabaseAuthService'
import {
  readSupabaseSession,
  storeSupabaseSession,
  type GuestCredentialBridge,
  type GuestCredentialRecord,
} from '../supabase/SupabaseSession'

const CONFIG = { url: 'https://example.supabase.co', anonKey: 'anon' }
const BUILD = {
  buildId: 'test-build',
  appVersion: '0.0.0',
  releaseChannel: 'development' as const,
  saveSchemaVersion: 1,
}

class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  get length() { return this.store.size }
  clear(): void { this.store.clear() }
  getItem(key: string): string | null { return this.store.get(key) ?? null }
  key(index: number): string | null { return Array.from(this.store.keys())[index] ?? null }
  removeItem(key: string): void { this.store.delete(key) }
  setItem(key: string, value: string): void { this.store.set(key, value) }
}

interface CallRecord { url: string; body: unknown }
const calls: CallRecord[] = []
let savedDurable: GuestCredentialRecord[] = []
let durableClears = 0

function respond(url: string, init?: RequestInit): Promise<Response> {
  calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null })
  if (url.includes('/auth/v1/token?grant_type=refresh_token')) {
    return Promise.resolve(new Response(JSON.stringify({
      access_token: 'tok-fresh', refresh_token: 'rt-fresh', expires_in: 3600,
      user: { id: 'u-guest' },
    }), { status: 200 }))
  }
  if (url.includes('/rest/v1/rpc/claim_active_session')) {
    return Promise.resolve(new Response(JSON.stringify({
      status: 'ADMITTED', sessionId: 'gs-new', protocolVersion: 1,
    }), { status: 200 }))
  }
  if (url.includes('/rest/v1/rpc/finalize_guest_upgrade')) {
    return Promise.resolve(new Response(JSON.stringify({ status: 'PENDING_CONFIRMATION' }), { status: 200 }))
  }
  if (url.includes('/rest/v1/rpc/revoke_current_session')) {
    return Promise.resolve(new Response(JSON.stringify({ status: 'REVOKED' }), { status: 200 }))
  }
  if (url.includes('/auth/v1/logout')) {
    return Promise.resolve(new Response('{}', { status: 200 }))
  }
  return Promise.resolve(new Response('{"error":"unstubbed"}', { status: 500 }))
}

const BRIDGE: GuestCredentialBridge = {
  async load() { return { ok: true, value: null } },
  async save(record) { savedDurable.push(record); return { ok: true, value: null } },
  async clear() { durableClears++; return { ok: true, value: null } },
}

const service = new SupabaseAuthService(CONFIG, BUILD)

function storedGuest(over: Partial<Parameters<typeof storeSupabaseSession>[0]> = {}) {
  storeSupabaseSession({
    accessToken: 'tok-old',
    refreshToken: 'rt-old',
    sessionId: 'gs-old',
    userId: 'u-guest',
    mode: 'guest',
    expiresAtMs: Date.now() - 1000,
    ...over,
  })
}

beforeEach(() => {
  calls.length = 0
  savedDurable = []
  durableClears = 0
  vi.stubGlobal('sessionStorage', new MemoryStorage())
  vi.stubGlobal('electronAPI', { guestCredentials: BRIDGE })
  vi.stubGlobal('fetch', vi.fn(respond))
})

describe('resumeStoredSession - B1.7/B1.8 explicit take-back', () => {
  it('refresh -> claim -> store: the durable guest re-enters with a FRESH game session', async () => {
    storedGuest()

    const result = await service.resumeStoredSession()

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.session.mode).toBe('guest')
    expect(result.session.userId).toBe('u-guest')
    // The revoked game session is never reused - claim mints a new one.
    expect(result.session.sessionId).toBe('gs-new')
    expect(readSupabaseSession()?.sessionId).toBe('gs-new')
    expect(readSupabaseSession()?.accessToken).toBe('tok-fresh')
    expect(calls.map((c) => c.url).join('|')).toContain('grant_type=refresh_token')
    expect(calls.map((c) => c.url).join('|')).toContain('claim_active_session')
  })

  it('no stored session -> no_stored_session, no fetch', async () => {
    const result = await service.resumeStoredSession()

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('no_stored_session')
    expect(calls).toHaveLength(0)
  })

  it('a pending upgrade replays finalize on entry - resumable finalization', async () => {
    storedGuest({ pendingUpgrade: { loginId: 'dao_huu_1' } })

    const result = await service.resumeStoredSession()

    expect(calls.map((c) => c.url).join('|')).toContain('finalize_guest_upgrade')
    // PENDING_CONFIRMATION leaves the guest session live with its marker.
    expect(readSupabaseSession()?.pendingUpgrade?.loginId).toBe('dao_huu_1')
    expect(result.ok).toBe(true)
  })

  it('terminal refresh rejection -> invalid_credentials and the credential is gone', async () => {
    storedGuest()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"invalid_grant"}', { status: 400 })))

    const result = await service.resumeStoredSession()

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('invalid_credentials')
    expect(readSupabaseSession()).toBeNull()
  })

  it('transient refresh failure -> server_unavailable, credential + marker RETAINED', async () => {
    storedGuest({ pendingUpgrade: { loginId: 'keepme' } })
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"upstream"}', { status: 500 })))

    const result = await service.resumeStoredSession()

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('server_unavailable')
    expect(readSupabaseSession()?.refreshToken).toBe('rt-old')
    expect(readSupabaseSession()?.pendingUpgrade?.loginId).toBe('keepme')
  })
})

describe('upgradeGuest - EXT-09 same-uuid link', () => {
  it('rejects non-guest sessions and malformed input before any call', async () => {
    storedGuest({ mode: 'login' })
    const result = await service.upgradeGuest({ loginId: 'valid_id' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('not_guest')
    expect(calls).toHaveLength(0)

    storedGuest()
    const badId = await service.upgradeGuest({ loginId: 'UP!!' })
    expect(badId.ok).toBe(false)
    if (badId.ok) return
    expect(badId.code).toBe('invalid_id')
  })

  it('PUT /auth/v1/user binds the EMAIL ONLY - a combined {email,password} PUT 400s on real GoTrue', async () => {
    storedGuest()
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url)
      if (u.includes('/auth/v1/user')) {
        calls.push({ url: u, body: init?.body ? JSON.parse(String(init.body)) : null })
        return new Response(JSON.stringify({ id: 'u-guest' }), { status: 200 })
      }
      return respond(u, init)
    }))

    const result = await service.upgradeGuest({ loginId: 'Dao_Huu_1' })

    const update = calls.find((c) => c.url.includes('/auth/v1/user'))
    expect(update?.body).toMatchObject({
      email: 'dao_huu_1@accounts.tien-hiep-idle.invalid',
    })
    // The password is bound post-finalize by completeUpgrade - never sent
    // or persisted during the link step.
    expect((update?.body as Record<string, unknown>)?.password).toBeUndefined()
    // Same-uuid contract held; pending marker persisted; finalize ran.
    expect(readSupabaseSession()?.pendingUpgrade?.loginId).toBe('dao_huu_1')
    expect(result).toEqual({ ok: true, status: 'pending-confirm' })
  })

  it('a non-duplicate 400 (email_address_invalid) is NOT id_taken', async () => {
    storedGuest()
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url)
      if (u.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ code: 400, error_code: 'email_address_invalid', msg: 'Email address "" is invalid' }), { status: 400 })
      }
      return respond(u, init)
    }))

    const result = await service.upgradeGuest({ loginId: 'dao_huu_1' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('server_unavailable')
    expect(result.code).not.toBe('id_taken')
  })

  it('429 (GoTrue email send rate limit) surfaces rate_limited and keeps the marker', async () => {
    storedGuest({ pendingUpgrade: { loginId: 'keepme' } })
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url)
      if (u.includes('/auth/v1/token') || u.includes('grant_type=refresh_token')) return respond(u, init)
      if (u.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ error_code: 'over_request_rate_limit' }), { status: 429 })
      }
      return respond(u, init)
    }))

    const result = await service.upgradeGuest({ loginId: 'dao_huu_1' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('rate_limited')
    expect(readSupabaseSession()?.pendingUpgrade?.loginId).toBe('keepme')
  })

  it('a different user.id in the link response is a contract violation - never adopted', async () => {
    storedGuest()
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url)
      if (u.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'u-OTHER' }), { status: 200 })
      }
      return respond(u, init)
    }))

    const result = await service.upgradeGuest({ loginId: 'dao_huu_1' })

    expect(result.ok).toBe(false)
    // No pending marker - a foreign-uuid response binds nothing.
    expect(readSupabaseSession()?.pendingUpgrade).toBeUndefined()
  })

  it('a 400 whose payload carries email_exists also maps to id_taken', async () => {
    storedGuest()
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url)
      if (u.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ error_code: 'email_exists', msg: 'User already registered' }), { status: 400 })
      }
      return respond(u, init)
    }))

    const result = await service.upgradeGuest({ loginId: 'taken_id' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('id_taken')
  })

  it('GoTrue 422 email_exists on the link call maps to id_taken, not server_unavailable', async () => {
    storedGuest()
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url)
      if (u.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ error_code: 'email_exists' }), { status: 422 })
      }
      return respond(u, init)
    }))

    const result = await service.upgradeGuest({ loginId: 'taken_id' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('id_taken')
    // A failed link never records a pending marker.
    expect(readSupabaseSession()?.pendingUpgrade).toBeUndefined()
  })
})

describe('finalizeUpgrade - resumable server verdict', () => {
  it('FINALIZED keeps the guest session + marker - the flip waits for completeUpgrade', async () => {
    storedGuest({ pendingUpgrade: { loginId: 'dao_huu_1' } })
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url)
      if (u.includes('finalize_guest_upgrade')) {
        calls.push({ url: u, body: init?.body ? JSON.parse(String(init.body)) : null })
        return new Response(JSON.stringify({ status: 'FINALIZED', loginId: 'dao_huu_1' }), { status: 200 })
      }
      return respond(u, init)
    }))

    const result = await service.finalizeUpgrade()

    expect(result).toEqual({ ok: true, status: 'finalized' })
    const stored = readSupabaseSession()
    // Lockout-safe: still a guest with the durable credential alive until
    // the password step lands the registered flip.
    expect(stored?.mode).toBe('guest')
    expect(stored?.pendingUpgrade?.loginId).toBe('dao_huu_1')
    expect(durableClears).toBe(0)
  })

  it('PENDING_CONFIRMATION keeps the guest session + marker for the next entry', async () => {
    storedGuest({ pendingUpgrade: { loginId: 'dao_huu_1' } })

    const result = await service.finalizeUpgrade()

    expect(result).toEqual({ ok: true, status: 'pending-confirm' })
    expect(readSupabaseSession()?.mode).toBe('guest')
    expect(readSupabaseSession()?.pendingUpgrade?.loginId).toBe('dao_huu_1')
  })

  it('LOGIN_ID_TAKEN clears the dead-end marker but keeps the live guest session', async () => {
    storedGuest({ pendingUpgrade: { loginId: 'dao_huu_1' } })
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url)
      if (u.includes('finalize_guest_upgrade')) {
        return new Response(JSON.stringify({ status: 'REJECTED', code: 'LOGIN_ID_TAKEN' }), { status: 200 })
      }
      return respond(u, init)
    }))

    const result = await service.finalizeUpgrade()

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('id_taken')
    expect(readSupabaseSession()?.pendingUpgrade).toBeUndefined()
    expect(readSupabaseSession()?.mode).toBe('guest')
  })

  it('duplicate finalize on a converged session is idempotent', async () => {
    storedGuest({ mode: 'login' })

    const result = await service.finalizeUpgrade()

    expect(result).toEqual({ ok: true, status: 'finalized' })
    expect(calls).toHaveLength(0)
  })
})

describe('completeUpgrade - post-finalize password bind', () => {
  it('PUT {password} then flips to registered, clears marker + durable record', async () => {
    storedGuest({ pendingUpgrade: { loginId: 'dao_huu_1' } })
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url)
      if (u.includes('/auth/v1/user')) {
        calls.push({ url: u, body: init?.body ? JSON.parse(String(init.body)) : null })
        return new Response(JSON.stringify({ id: 'u-guest' }), { status: 200 })
      }
      return respond(u, init)
    }))

    const result = await service.completeUpgrade({ password: 'secret6' })

    expect(result).toEqual({ ok: true, status: 'finalized' })
    const update = calls.find((c) => c.url.includes('/auth/v1/user'))
    expect(update?.body).toEqual({ password: 'secret6' })
    const stored = readSupabaseSession()
    expect(stored?.mode).toBe('login')
    expect(stored?.pendingUpgrade).toBeUndefined()
    await vi.waitFor(() => expect(durableClears).toBe(1))
  })

  it('a failed password PUT keeps the marker and the guest session alive', async () => {
    storedGuest({ pendingUpgrade: { loginId: 'dao_huu_1' } })
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"upstream"}', { status: 500 })))

    const result = await service.completeUpgrade({ password: 'secret6' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('server_unavailable')
    expect(readSupabaseSession()?.mode).toBe('guest')
    expect(readSupabaseSession()?.pendingUpgrade?.loginId).toBe('dao_huu_1')
    expect(durableClears).toBe(0)
  })

  it('rejects weak passwords and missing markers before any call', async () => {
    storedGuest({ pendingUpgrade: { loginId: 'dao_huu_1' } })
    const weak = await service.completeUpgrade({ password: '123' })
    expect(weak.ok).toBe(false)
    if (weak.ok) return
    expect(weak.code).toBe('weak_password')
    expect(calls).toHaveLength(0)

    storeSupabaseSession({
      accessToken: 'tok-old', refreshToken: 'rt-old', sessionId: 'gs-old',
      userId: 'u-guest', mode: 'guest',
    })
    const noMarker = await service.completeUpgrade({ password: 'secret6' })
    expect(noMarker.ok).toBe(false)
    if (noMarker.ok) return
    expect(noMarker.code).toBe('no_stored_session')
    expect(calls).toHaveLength(0)
  })
})

describe('logout - B1.9 ordered legs with honest outcome', () => {
  it('revoke -> signout -> clear, in that order; remote effects confirmed', async () => {
    storedGuest({ expiresAtMs: Date.now() + 3_600_000 })

    const outcome = await service.logout()

    expect(outcome).toEqual({ serverRevoke: 'confirmed', signout: 'confirmed' })
    const urls = calls.map((c) => c.url).join('|')
    expect(urls.indexOf('revoke_current_session')).toBeLessThan(urls.indexOf('/auth/v1/logout'))
    expect(readSupabaseSession()).toBeNull()
    // Guest durable record retires with the local clear.
    await vi.waitFor(() => expect(durableClears).toBe(1))
  })

  it('offline: revoke/signout are honestly unconfirmed/local-only, local clear still lands', async () => {
    storedGuest({ expiresAtMs: Date.now() + 3_600_000 })
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline') }))

    const outcome = await service.logout()

    expect(outcome.serverRevoke).toBe('unconfirmed')
    expect(outcome.signout).toBe('local-only')
    expect(readSupabaseSession()).toBeNull()
  })

  it('nothing stored -> skipped legs, still clears', async () => {
    const outcome = await service.logout()
    expect(outcome).toEqual({ serverRevoke: 'skipped', signout: 'skipped' })
  })

  it('a durable-restored guest (empty access token) refreshes first so revoke still reaches the server', async () => {
    storedGuest({ accessToken: '', expiresAtMs: undefined })

    const outcome = await service.logout()

    expect(calls.map((c) => c.url).join('|')).toContain('grant_type=refresh_token')
    expect(outcome.serverRevoke).toBe('confirmed')
    expect(outcome.signout).toBe('confirmed')
  })
})
