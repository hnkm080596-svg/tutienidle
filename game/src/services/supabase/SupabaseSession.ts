export type SupabaseSessionMode = 'guest' | 'login' | 'register'

export interface StoredSupabaseSession {
  accessToken: string
  refreshToken: string
  sessionId: string
  /** auth.users uuid — remote character/save rows key on it. Optional: sessions stored before Mission F lack it. */
  userId?: string
  /** Auth mode at login time; guest sessions keep their uuid but still map to the shared guest save slot. */
  mode?: SupabaseSessionMode
  /** Access-token deadline (ms) for proactive refresh. */
  expiresAtMs?: number
}

const SESSION_KEY = 'tien-hiep-idle-auth-session'

export function storeSupabaseSession(session: StoredSupabaseSession): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function readSupabaseSession(): StoredSupabaseSession | null {
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<StoredSupabaseSession>
    return parsed.accessToken && parsed.refreshToken && parsed.sessionId
      ? {
          accessToken: parsed.accessToken,
          refreshToken: parsed.refreshToken,
          sessionId: parsed.sessionId,
          userId: parsed.userId,
          mode: parsed.mode,
          expiresAtMs: parsed.expiresAtMs,
        }
      : null
  } catch {
    return null
  }
}

export function clearSupabaseSession(): void {
  sessionStorage.removeItem(SESSION_KEY)
}
