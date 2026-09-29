import type { SupabaseConfig } from './SupabaseConfig'
import { requestSupabase, SupabaseHttpError } from './SupabaseHttp'

export type SupabaseSessionMode = 'guest' | 'login' | 'register'

export interface StoredSupabaseSession {
  accessToken: string
  refreshToken: string
  sessionId: string
  /** auth.users uuid - remote character/save rows key on it. Optional: sessions stored before Mission F lack it. */
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

const REFRESH_SKEW_MS = 30_000

interface GoTrueRefreshResponse {
  access_token: string
  refresh_token: string
  expires_in?: number
}

/**
 * Stored session with a live access token. Refreshes via GoTrue when the
 * token is expired (or was stored before expiry tracking existed); on
 * refresh failure the caller treats the user as signed out for THIS call
 * - never a silent stall (spec F8).
 */
export async function resolveSupabaseSession(config: SupabaseConfig): Promise<StoredSupabaseSession | null> {
  const session = readSupabaseSession()
  if (!session) return null
  if (session.expiresAtMs !== undefined && session.expiresAtMs - REFRESH_SKEW_MS > Date.now()) {
    return session
  }

  // F-BX-75 single-flight: GoTrue rotates refresh_token on every POST, so
  // two parallel refreshes send the second one with the dead token - its
  // invalid_grant would wipe the session the first call just stored.
  refreshInFlight ??= refreshSupabaseSession(config, session).finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

let refreshInFlight: Promise<StoredSupabaseSession | null> | null = null

async function refreshSupabaseSession(
  config: SupabaseConfig,
  session: StoredSupabaseSession,
): Promise<StoredSupabaseSession | null> {
  try {
    const auth = await requestSupabase<GoTrueRefreshResponse>(config, '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    })
    const next: StoredSupabaseSession = {
      ...session,
      accessToken: auth.access_token,
      refreshToken: auth.refresh_token,
      expiresAtMs: auth.expires_in ? Date.now() + auth.expires_in * 1000 : undefined,
    }
    storeSupabaseSession(next)
    return next
  } catch (error) {
    // F-BX-70: only an auth rejection destroys the stored session - the
    // credential is provably dead (GoTrue answers invalid_grant as 400,
    // a revoked/disabled user as 401). Transient failures (network, 5xx,
    // 429) keep the refresh token so the next resolve can retry.
    if (error instanceof SupabaseHttpError && (error.status === 400 || error.status === 401)) {
      clearSupabaseSession()
    }
    return null
  }
}
