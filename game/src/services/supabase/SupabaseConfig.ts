export interface SupabaseConfig {
  url: string
  anonKey: string
}

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

  return url && anonKey ? { url: url.replace(/\/$/, ''), anonKey } : null
}
