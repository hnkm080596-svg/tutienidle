import { describe, expect, it, vi } from 'vitest'
import { buildSupabaseHeaders, requestSupabase } from './SupabaseHttp'
import {
  getSupabaseConfig,
  isForbiddenSupabaseServerKey,
  isSupabasePublishableKey,
} from './SupabaseConfig'

const legacyConfig = {
  url: 'https://example.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.sig',
}
const publishableConfig = {
  url: 'https://example.supabase.co',
  anonKey: 'sb_publishable_test_key_12345',
}

describe('requestSupabase - timeout (audit T3-24)', () => {
  it('arms a 10s AbortSignal.timeout and merges the caller signal', async () => {
    // NOTE: vitest fake timers do NOT drive AbortSignal.timeout - do not
    // try to advance timers into a real abort. Spy the factory instead.
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout')
    let captured: RequestInit | undefined
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      captured = init
      return new Response('{}', { status: 200 })
    }))

    await requestSupabase(legacyConfig, '/rest/v1/x')
    expect(timeoutSpy).toHaveBeenCalledWith(10_000)
    expect(captured?.signal).toBeInstanceOf(AbortSignal)

    timeoutSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it('a caller abort still rejects the request through the merged signal', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')))
      }),
    ))
    const controller = new AbortController()
    const pending = requestSupabase(legacyConfig, '/rest/v1/x', { signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    vi.unstubAllGlobals()
  })
})

describe('requestSupabase & buildSupabaseHeaders - publishable key vs legacy anon key', () => {
  it('unauthenticated request with publishable key sends apikey and omits Authorization', async () => {
    let capturedHeaders: Record<string, string> | undefined
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      capturedHeaders = init.headers as Record<string, string>
      return new Response('{}', { status: 200 })
    }))

    await requestSupabase(publishableConfig, '/auth/v1/signup', { method: 'POST', body: '{}' })

    expect(capturedHeaders).toEqual({
      apikey: 'sb_publishable_test_key_12345',
      'Content-Type': 'application/json',
    })
    expect(capturedHeaders?.Authorization).toBeUndefined()
    vi.unstubAllGlobals()
  })

  it('authenticated request with publishable key sends both apikey and Bearer user access token', async () => {
    let capturedHeaders: Record<string, string> | undefined
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      capturedHeaders = init.headers as Record<string, string>
      return new Response('{}', { status: 200 })
    }))

    await requestSupabase(
      publishableConfig,
      '/rest/v1/rpc/claim_active_session',
      { method: 'POST', body: '{}' },
      'user-jwt-access-token',
    )

    expect(capturedHeaders).toEqual({
      apikey: 'sb_publishable_test_key_12345',
      Authorization: 'Bearer user-jwt-access-token',
      'Content-Type': 'application/json',
    })
    vi.unstubAllGlobals()
  })

  it('unauthenticated request with legacy anon JWT sends both apikey and Authorization: Bearer <anon_jwt>', async () => {
    let capturedHeaders: Record<string, string> | undefined
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      capturedHeaders = init.headers as Record<string, string>
      return new Response('{}', { status: 200 })
    }))

    await requestSupabase(legacyConfig, '/auth/v1/token?grant_type=password', { method: 'POST', body: '{}' })

    expect(capturedHeaders).toEqual({
      apikey: legacyConfig.anonKey,
      Authorization: `Bearer ${legacyConfig.anonKey}`,
      'Content-Type': 'application/json',
    })
    vi.unstubAllGlobals()
  })

  it('authenticated request with legacy anon JWT sends apikey and Authorization: Bearer <user_access_token>', async () => {
    let capturedHeaders: Record<string, string> | undefined
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      capturedHeaders = init.headers as Record<string, string>
      return new Response('{}', { status: 200 })
    }))

    await requestSupabase(
      legacyConfig,
      '/rest/v1/rpc/load_game_state',
      { method: 'POST', body: '{}' },
      'user-jwt-access-token',
    )

    expect(capturedHeaders).toEqual({
      apikey: legacyConfig.anonKey,
      Authorization: 'Bearer user-jwt-access-token',
      'Content-Type': 'application/json',
    })
    vi.unstubAllGlobals()
  })

  it('empty or whitespace accessToken with publishable key does not fabricate Authorization header', () => {
    const headersEmpty = buildSupabaseHeaders(publishableConfig, '')
    const headersWhitespace = buildSupabaseHeaders(publishableConfig, '   ')
    expect(headersEmpty.Authorization).toBeUndefined()
    expect(headersWhitespace.Authorization).toBeUndefined()
    expect(headersEmpty.apikey).toBe(publishableConfig.anonKey)
  })
})

describe('getSupabaseConfig - publishable key priority and server secret rejection', () => {
  it('recognizes sb_publishable_ keys and rejects sb_secret_ / service_role keys', () => {
    expect(isSupabasePublishableKey('sb_publishable_abc123')).toBe(true)
    expect(isSupabasePublishableKey(legacyConfig.anonKey)).toBe(false)
    expect(isForbiddenSupabaseServerKey('sb_secret_live_123')).toBe(true)
    const serviceRoleJwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
      btoa(JSON.stringify({ role: 'service_role' })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') +
      '.sig'
    expect(isForbiddenSupabaseServerKey(serviceRoleJwt)).toBe(true)
    expect(isForbiddenSupabaseServerKey('sb_publishable_abc123')).toBe(false)
    expect(isForbiddenSupabaseServerKey(legacyConfig.anonKey)).toBe(false)
  })

  it('supports VITE_SUPABASE_ANON_KEY with sb_publishable_... and prioritizes VITE_SUPABASE_PUBLISHABLE_KEY when both exist', () => {
    const fromAnon = getSupabaseConfig({
      VITE_SUPABASE_URL: 'https://project.supabase.co/',
      VITE_SUPABASE_ANON_KEY: 'sb_publishable_from_anon_var',
    })
    expect(fromAnon).toEqual({
      url: 'https://project.supabase.co',
      anonKey: 'sb_publishable_from_anon_var',
    })

    const fromPublishable = getSupabaseConfig({
      VITE_SUPABASE_URL: 'https://project.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'legacy_anon_key',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_priority_key',
    })
    expect(fromPublishable).toEqual({
      url: 'https://project.supabase.co',
      anonKey: 'sb_publishable_priority_key',
    })
  })

  it('returns null when given a secret or service_role key', () => {
    expect(
      getSupabaseConfig({
        VITE_SUPABASE_URL: 'https://project.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'sb_secret_never_in_frontend',
      }),
    ).toBeNull()
  })
})
