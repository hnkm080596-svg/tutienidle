// F-BX-73 - GoTrue duplicate-signup contract pins.
//
// GoTrue rejects a duplicate email in TWO shapes that are NOT the 400 the
// old catch mapped: HTTP 422 {error_code: 'user_already_exists'}, and the
// anti-enumeration fake-200 (a stub user payload WITHOUT access_token).
// Both must surface 'id_taken'; the fake-200 must also never proceed to
// claim_active_session with an undefined bearer.
import { describe, expect, it, vi } from 'vitest'
import { SupabaseAuthService } from './SupabaseAuthService'

const config = { url: 'https://example.supabase.co', anonKey: 'anon' }
const credentials = { loginId: 'tester', password: 'secret1' }

function stubFetch(handler: (url: string) => Response): string[] {
  const urls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
    const href = String(url)
    urls.push(href)
    return handler(href)
  }))
  return urls
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status })
}

describe('SupabaseAuthService - register duplicate shapes (F-BX-73)', () => {
  it('422 user_already_exists -> id_taken', async () => {
    stubFetch((url) =>
      url.includes('/auth/v1/signup')
        ? json({ error_code: 'user_already_exists', msg: 'User already registered' }, 422)
        : json({}, 404),
    )

    const result = await new SupabaseAuthService(config).authenticate('register', credentials)

    expect(result).toEqual({ ok: false, code: 'id_taken', message: expect.any(String) })
  })

  it('fake-200 stub user without access_token -> id_taken, no session claim attempted', async () => {
    const urls = stubFetch((url) =>
      url.includes('/auth/v1/signup')
        ? json({ user: { id: 'u-duplicate' } })
        : json('sess-1'),
    )

    const result = await new SupabaseAuthService(config).authenticate('register', credentials)

    expect(result).toEqual({ ok: false, code: 'id_taken', message: expect.any(String) })
    // An undefined access_token must never reach the session-claim RPC.
    expect(urls.some((url) => url.includes('claim_active_session'))).toBe(false)
  })

  it('real 400 still maps to id_taken', async () => {
    stubFetch((url) =>
      url.includes('/auth/v1/signup')
        ? json({ error: 'invalid_request', error_description: 'Signup failed' }, 400)
        : json({}, 404),
    )

    const result = await new SupabaseAuthService(config).authenticate('register', credentials)

    expect(result).toEqual({ ok: false, code: 'id_taken', message: expect.any(String) })
  })

  it('5xx -> server_unavailable (transient failures are not duplicates)', async () => {
    stubFetch((url) =>
      url.includes('/auth/v1/signup')
        ? json({ error: 'upstream' }, 500)
        : json({}, 404),
    )

    const result = await new SupabaseAuthService(config).authenticate('register', credentials)

    expect(result).toEqual({ ok: false, code: 'server_unavailable', message: expect.any(String) })
  })

  it('login: 400 stays invalid_credentials', async () => {
    stubFetch((url) =>
      url.includes('/auth/v1/token')
        ? json({ error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400)
        : json({}, 404),
    )

    const result = await new SupabaseAuthService(config).authenticate('login', credentials)

    expect(result).toEqual({ ok: false, code: 'invalid_credentials', message: expect.any(String) })
  })
})
