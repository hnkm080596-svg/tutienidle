export interface SupabaseConfig {
  url: string
  anonKey: string
}

export interface SupabaseEnv {
  readonly [key: string]: unknown
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_ANON_KEY?: string
}

export function getSupabaseConfig(env: SupabaseEnv = import.meta.env): SupabaseConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim()
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim()

  return url && anonKey ? { url: url.replace(/\/$/, ''), anonKey } : null
}
