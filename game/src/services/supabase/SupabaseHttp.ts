import type { SupabaseConfig } from './SupabaseConfig'

export class SupabaseHttpError extends Error {
  constructor(readonly status: number, readonly payload: unknown) {
    super(`Supabase request failed with status ${status}`)
  }
}

export async function requestSupabase<T>(
  config: SupabaseConfig,
  path: string,
  init: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const response = await fetch(`${config.url}${path}`, {
    ...init,
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
