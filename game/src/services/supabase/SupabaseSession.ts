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
  /** EXT-09 pending-confirm upgrade: the login id the anonymous account
   *  linked, awaiting the authoritative finalize_guest_upgrade verdict.
   *  Finalization is resumable - a crash between link and finalize
   *  replays this field on the next entry. */
  pendingUpgrade?: { loginId: string }
}

const SESSION_KEY = 'tien-hiep-idle-auth-session'

/** B1.8 durable guest identity: the OS-protected record the main process
 *  owns behind Electron safeStorage (see main-process/GuestCredentialStore).
 *  The renderer sees ONLY this operations surface through the preload
 *  bridge - never a filesystem path or raw bytes. Browser builds expose no
 *  bridge: guest identity stays session-scoped there, unchanged. */
export interface GuestCredentialRecord {
  refreshToken: string
  sessionId: string
  userId?: string
  pendingUpgradeLoginId?: string
}

export type GuestCredentialResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: 'unavailable' | 'corrupted' | 'invalid' }

export interface GuestCredentialBridge {
  load(): Promise<GuestCredentialResult<GuestCredentialRecord | null>>
  save(record: GuestCredentialRecord): Promise<GuestCredentialResult<null>>
  clear(): Promise<GuestCredentialResult<null>>
}

interface ElectronLikeWindow {
  electronAPI?: { guestCredentials?: GuestCredentialBridge }
}

function resolveGuestCredentialBridge(): GuestCredentialBridge | undefined {
  const api = (globalThis as { window?: ElectronLikeWindow }).window?.electronAPI
    ?? (globalThis as ElectronLikeWindow).electronAPI
  const bridge = api?.guestCredentials
  return bridge &&
    typeof bridge.load === 'function' &&
    typeof bridge.save === 'function' &&
    typeof bridge.clear === 'function'
    ? bridge
    : undefined
}

/** Serialized durable operations: ordering is the correctness contract -
 *  a later store/clear always wins over an earlier queued write. A failed
 *  op never wedges the chain; 'unavailable' latches the seam off so a dead
 *  safeStorage is not hammered for the rest of the process. */
let durableChain: Promise<void> = Promise.resolve()
let durableSeamDown = false

function enqueueDurable(op: (bridge: GuestCredentialBridge) => Promise<GuestCredentialResult<null>>): void {
  const bridge = resolveGuestCredentialBridge()
  if (!bridge || durableSeamDown) return
  durableChain = durableChain.then(async () => {
    try {
      const result = await op(bridge)
      if (!result.ok) {
        // Recovery error - NEVER a plaintext fallback, NEVER a silent new
        // anonymous signup. The caller surfaces 'unavailable'; we only log.
        durableSeamDown = true
        console.error('[session] durable guest credential store unavailable:', result.code)
      }
    } catch (error) {
      console.error('[session] durable guest credential operation failed', error)
    }
  })
}

/** Drop the durable guest record without touching the live session (upgrade
 *  finalize: the account converts to session-scoped registered persistence,
 *  the conservative Closed-Beta default). Queued after any in-flight durable
 *  op so ordering semantics hold. */
export function clearDurableGuestCredential(): void {
  enqueueDurable(bridge => bridge.clear())
}

/** Epoch counter on the stored credential: every store/clear bumps it, so
 *  an async refresh that resolves after a sign-out or a re-sign cannot
 *  resurrect the credential it refreshed for the OLD binding. */
let sessionGeneration = 0

function writeSessionSlot(session: StoredSupabaseSession): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  sessionGeneration++
}

export function storeSupabaseSession(session: StoredSupabaseSession): void {
  writeSessionSlot(session)
  // Guest sessions are the ONLY durable identity (B1.8): the protected
  // record is replaced atomically so the newest rotated credential is
  // persisted BEFORE the old one is retired. Registered sessions stay
  // session-scoped (no remember-me without a product ruling).
  if (session.mode === 'guest') {
    enqueueDurable(bridge =>
      bridge.save({
        refreshToken: session.refreshToken,
        sessionId: session.sessionId,
        userId: session.userId,
        pendingUpgradeLoginId: session.pendingUpgrade?.loginId,
      }),
    )
  }
}

export function readSupabaseSession(): StoredSupabaseSession | null {
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<StoredSupabaseSession>
    // accessToken may be '' - a durable-restored guest waits on its first
    // refresh before any call may use it (see restoreDurableGuestSession).
    return typeof parsed.accessToken === 'string' && parsed.refreshToken && parsed.sessionId
      ? {
          accessToken: parsed.accessToken,
          refreshToken: parsed.refreshToken,
          sessionId: parsed.sessionId,
          userId: parsed.userId,
          mode: parsed.mode,
          expiresAtMs: parsed.expiresAtMs,
          pendingUpgrade:
            typeof parsed.pendingUpgrade?.loginId === 'string'
              ? { loginId: parsed.pendingUpgrade.loginId }
              : undefined,
        }
      : null
  } catch {
    return null
  }
}

export function clearSupabaseSession(): void {
  // Snapshot before removeItem: only a GUEST binding owns the durable
  // record - a registered sign-out must never touch it (the durable seam
  // belongs to guest persistence alone).
  const removed = readSupabaseSession()
  sessionStorage.removeItem(SESSION_KEY)
  sessionGeneration++
  if (removed?.mode === 'guest') {
    enqueueDurable(bridge => bridge.clear())
  }
}

export type DurableRestoreStatus = 'restored' | 'absent' | 'unavailable' | 'corrupted'

/** B1.8 process-restart resume: hydrate sessionStorage from the
 *  OS-protected durable record. The hydrated session carries NO access
 *  token and NO expiresAtMs, so the first resolve always proves liveness
 *  through the persisted refresh credential - the durable record is never
 *  trusted as an authenticated token on its own.
 *  'corrupted'/'unavailable' are recovery errors: never a plaintext
 *  fallback, never an implicit new anonymous signup. */
export async function restoreDurableGuestSession(): Promise<DurableRestoreStatus> {
  if (readSupabaseSession()) return 'restored'

  const bridge = resolveGuestCredentialBridge()
  if (!bridge) return 'absent'

  let result: GuestCredentialResult<GuestCredentialRecord | null>
  try {
    result = await bridge.load()
  } catch {
    return 'unavailable'
  }
  if (!result.ok) return result.code === 'corrupted' ? 'corrupted' : 'unavailable'
  if (!result.value?.refreshToken || !result.value.sessionId) return 'absent'

  writeSessionSlot({
    accessToken: '',
    refreshToken: result.value.refreshToken,
    sessionId: result.value.sessionId,
    userId: result.value.userId,
    mode: 'guest',
    pendingUpgrade: result.value.pendingUpgradeLoginId
      ? { loginId: result.value.pendingUpgradeLoginId }
      : undefined,
  })
  return 'restored'
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
