interface StoredSupabaseSession {
  accessToken: string
  refreshToken: string
  sessionId: string
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
      ? { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken, sessionId: parsed.sessionId }
      : null
  } catch {
    return null
  }
}

export function clearSupabaseSession(): void {
  sessionStorage.removeItem(SESSION_KEY)
}
