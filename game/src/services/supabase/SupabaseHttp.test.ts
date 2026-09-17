import { describe, expect, it, vi } from 'vitest'
import { requestSupabase } from './SupabaseHttp'

const config = { url: 'https://example.supabase.co', anonKey: 'anon' }

describe('requestSupabase — timeout (audit T3-24)', () => {
  it('arms a 10s AbortSignal.timeout and merges the caller signal', async () => {
    // NOTE: vitest fake timers do NOT drive AbortSignal.timeout — do not
    // try to advance timers into a real abort. Spy the factory instead.
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout')
    let captured: RequestInit | undefined
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      captured = init
      return new Response('{}', { status: 200 })
    }))

    await requestSupabase(config, '/rest/v1/x')
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
    const pending = requestSupabase(config, '/rest/v1/x', { signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    vi.unstubAllGlobals()
  })
})
