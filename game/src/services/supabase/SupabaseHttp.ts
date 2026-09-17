import type { SupabaseConfig } from './SupabaseConfig'

export class SupabaseHttpError extends Error {
  constructor(readonly status: number, readonly payload: unknown) {
    super(`Supabase request failed with status ${status}`)
  }
}

// Audit T3-24 — no request may hang forever: every Supabase call carries
// a 10s deadline, merged with any caller-provided signal.
export const SUPABASE_REQUEST_TIMEOUT_MS = 10_000

export async function requestSupabase<T>(
  config: SupabaseConfig,
  path: string,
  init: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const timeoutSignal = AbortSignal.timeout(SUPABASE_REQUEST_TIMEOUT_MS)
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal

  const response = await fetch(`${config.url}${path}`, {
    ...init,
    signal,
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${accessToken ?? config.anonKey}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })

  const text = await response.text()
  const payload: unknown = text ? JSON.parse(text) : null
  if (!response.ok) throw new SupabaseHttpError(response.status, payload)
  return payload as T
}
