export interface SupabaseConfig {
  url: string
  anonKey: string
}

export interface SupabaseEnv {
  readonly [key: string]: unknown
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_ANON_KEY?: string
  VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

export function isSupabasePublishableKey(key: string): boolean {
  return key.trim().startsWith('sb_publishable_')
}

function decodeJwtRole(token: string): string | null {
  const parts = token.split('.')
  if (parts.length !== 3 || !parts[1]) return null
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const json = atob(padded)
    const parsed: unknown = JSON.parse(json)
    if (typeof parsed === 'object' && parsed !== null && 'role' in parsed) {
      const role = (parsed as { role?: unknown }).role
      return typeof role === 'string' ? role : null
    }
    return null
  } catch {
    return null
  }
}

/** Rejects Supabase server-only credentials (sb_secret_..., personal access tokens, or service_role JWTs) so they can never be used in the frontend. */
export function isForbiddenSupabaseServerKey(key: string): boolean {
  const trimmed = key.trim()
  if (/^(?:sb_secret_|sbp_)/i.test(trimmed)) return true
  return decodeJwtRole(trimmed) === 'service_role'
}

export function getSupabaseConfig(env: SupabaseEnv = import.meta.env): SupabaseConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim()
  const rawKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || env.VITE_SUPABASE_ANON_KEY?.trim()

  if (!url || !rawKey || isForbiddenSupabaseServerKey(rawKey)) {
    return null
  }

  return { url: url.replace(/\/+$/, ''), anonKey: rawKey }
}
