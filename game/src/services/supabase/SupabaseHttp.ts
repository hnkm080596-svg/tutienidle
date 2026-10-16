import { isSupabasePublishableKey, type SupabaseConfig } from './SupabaseConfig'

export class SupabaseHttpError extends Error {
  constructor(readonly status: number, readonly payload: unknown) {
    super(`Supabase request failed with status ${status}`)
  }
}

// Audit T3-24 - no request may hang forever: every Supabase call carries
// a 10s deadline, merged with any caller-provided signal.
export const SUPABASE_REQUEST_TIMEOUT_MS = 10_000

export function buildSupabaseHeaders(
  config: SupabaseConfig,
  accessToken?: string,
  extraHeaders?: HeadersInit,
): Record<string, string> {
  const apiKey = config.anonKey.trim()
  const trimmedToken = accessToken?.trim()
  const headers: Record<string, string> = {
    apikey: apiKey,
    'Content-Type': 'application/json',
  }

  if (trimmedToken) {
    headers.Authorization = `Bearer ${trimmedToken}`
  } else if (!isSupabasePublishableKey(apiKey)) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  if (extraHeaders) {
    if (extraHeaders instanceof Headers) {
      extraHeaders.forEach((value, key) => {
        headers[key] = value
      })
    } else if (Array.isArray(extraHeaders)) {
      for (const [key, value] of extraHeaders) {
        headers[key] = value
      }
    } else {
      Object.assign(headers, extraHeaders)
    }
  }

  return headers
}

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
    headers: buildSupabaseHeaders(config, accessToken, init.headers),
  })

  const text = await response.text()
  const payload: unknown = text ? JSON.parse(text) : null
  if (!response.ok) throw new SupabaseHttpError(response.status, payload)
  return payload as T
}
