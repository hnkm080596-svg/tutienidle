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

/** Epoch counter on the stored credential: every store/clear bumps it, so
 *  an async refresh that resolves after a sign-out or a re-sign cannot
 *  resurrect the credential it refreshed for the OLD binding. */
let sessionGeneration = 0

export function storeSupabaseSession(session: StoredSupabaseSession): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  sessionGeneration++
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
  sessionGeneration++
}

const REFRESH_SKEW_MS = 30_000

interface GoTrueRefreshResponse {
  access_token: string
  refresh_token: string
  expires_in?: number
}

/** B1-D (R8): single-flight refresh - concurrent resolve calls share ONE
 *  GoTrue refresh request instead of racing the rotating refresh token
 *  (the second caller would otherwise race an already-rotated token). */
let inflightRefresh: Promise<StoredSupabaseSession | null> | null = null

/** A 4xx from GoTrue's refresh endpoint is the ONLY proof a refresh token
 *  is dead (invalid_grant / expired). 5xx, timeouts and transport errors
 *  are transient - the stored credential is RETAINED and the caller sees
 *  'no session' so the authority controller can retry through the
 *  reconnect pipeline instead of destroying the auth identity. */
function isTerminalRefreshRejection(error: unknown): boolean {
  return error instanceof SupabaseHttpError && error.status >= 400 && error.status < 500
}

async function performRefresh(
  config: SupabaseConfig,
  session: StoredSupabaseSession,
): Promise<StoredSupabaseSession | null> {
  const generation = sessionGeneration

  try {
    const auth = await requestSupabase<GoTrueRefreshResponse>(config, '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    })

    if (generation !== sessionGeneration) {
      // The credential binding changed while the refresh was in flight
      // (sign-out or a newer session stored) - adopt whatever is stored
      // now; writing `next` would resurrect the stale binding.
      return readSupabaseSession()
    }

    const next: StoredSupabaseSession = {
      ...session,
      accessToken: auth.access_token,
      // GoTrue rotates refresh tokens; keep the stored one as a defensive
      // fallback when a response omits it.
      refreshToken: auth.refresh_token ?? session.refreshToken,
      expiresAtMs: auth.expires_in ? Date.now() + auth.expires_in * 1000 : undefined,
    }
    storeSupabaseSession(next)
    return next
  } catch (error: unknown) {
    if (isTerminalRefreshRejection(error)) {
      clearSupabaseSession()
    }
    // Transient failure retains the credential (R8): a network blip must
    // not destroy the auth identity; the caller treats the user as
    // 'no session resolved' and the reconnect pipeline retries later.
    return null
  }
}

/**
 * Stored session with a live access token. Refreshes via GoTrue when the
 * token is expired (or was stored before expiry tracking existed):
 * single-flight so concurrent callers share one refresh, and only a
 * proven terminal rejection clears the credential - transient failures
 * retain it (B1-D/R8).
 */
export async function resolveSupabaseSession(config: SupabaseConfig): Promise<StoredSupabaseSession | null> {
  const session = readSupabaseSession()
  if (!session) return null
  if (session.expiresAtMs !== undefined && session.expiresAtMs - REFRESH_SKEW_MS > Date.now()) {
    return session
  }

  inflightRefresh ??= performRefresh(config, session).finally(() => {
    inflightRefresh = null
  })
  return inflightRefresh
}
