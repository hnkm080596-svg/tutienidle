// Resume fast-path (ui-audit creation-meta) - detects "reload replays
// intro+auth" waste: a stored session (Supabase) or a local save means the
// player already has a character, so App shortens the intro and the auth
// card offers a one-click continue instead of a forced re-login.
// Presentation-side assembly only: reads the session slot and the resolved
// save key; no writes, no boot-authority changes.
import { readSupabaseSession, restoreDurableGuestSession } from '@/services/supabase/SupabaseSession'
import { getRawSave } from '@/services/save/SaveSystem'
import { readAnyAckedSaveEnvelope } from '@/services/cloudSave/AckedSaveCache'
import { resolveSaveAccountId } from '@/services/save/saveKeys'
import type { AuthSession } from '@/services/auth/AuthService'

export interface ResumeCandidate {
  session: AuthSession
  name: string
  /** True when the session came from a stored Supabase credential (vs the
   *  synthetic guest minted for a local-only save). Drives whether
   *  Continue claims through resumeStoredSession. */
  stored: boolean
  /** EXT-09 pending-confirm upgrade marker carried by the stored session. */
  pendingUpgradeLoginId?: string
  /** Set when the durable guest credential exists but could not be read -
   *  a recovery error surface, never silently ignored. */
  durableError?: 'unavailable' | 'corrupted'
}

/** Local save bytes, else the B1-C server-ACKed envelope mirror kept by
 *  remote mode - same resume affordance either way. */
function rawSaveForResume(): string | null {
  try {
    return getRawSave() ?? readAnyAckedSaveEnvelope(resolveSaveAccountId())?.rawPayload ?? null
  } catch {
    return null
  }
}

/** True when a stored session (including the OS-protected durable guest
 *  credential restored across a process restart) or any resolvable save
 *  exists - enough to justify the short intro + continue affordance.
 *  Async because the durable seam lives behind IPC on Electron. */
export async function hasResumeCandidate(): Promise<boolean> {
  try {
    const restore = await restoreDurableGuestSession()
    if (restore === 'restored') return true
    return Boolean(readSupabaseSession()) || Boolean(rawSaveForResume())
  } catch {
    return false
  }
}

/** Session + character name for the continue button, or null when there is
 *  genuinely nothing to resume. Guest saves without a stored session resume
 *  as a fresh guest session (same shape MockAuthService returns).
 *
 *  B1.8: the durable guest credential is hydrated here first (Electron
 *  process restart) - an 'unavailable'/'corrupted' store is surfaced on
 *  the candidate as a recovery error, never a plaintext fallback and
 *  never an implicit new anonymous signup. */
export async function readResumeCandidate(): Promise<ResumeCandidate | null> {
  const restore = await restoreDurableGuestSession()
  const stored = readSupabaseSession()
  const raw = rawSaveForResume()
  const durableError =
    restore === 'unavailable' || restore === 'corrupted' ? restore : undefined

  if (!stored && !raw) {
    return durableError
      ? {
          session: { sessionId: crypto.randomUUID(), mode: 'guest' },
          name: '',
          stored: false,
          durableError,
        }
      : null
  }

  const session: AuthSession = stored
    ? {
        sessionId: stored.sessionId,
        mode: stored.mode ?? 'guest',
        userId: stored.userId,
        loginId: stored.pendingUpgrade?.loginId,
      }
    : { sessionId: crypto.randomUUID(), mode: 'guest' }

  let name = ''

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { player?: { name?: unknown } }
      const candidate = parsed.player?.name
      name = typeof candidate === 'string' ? candidate : ''
    } catch {
      name = ''
    }
  }

  return {
    session,
    name,
    stored: Boolean(stored),
    pendingUpgradeLoginId: stored?.pendingUpgrade?.loginId,
    durableError,
  }
}

// Post-reset continuity (ui-audit creation-meta Low): after a save reset the
// app reloads onto the auth card with no trace of what happened. The flag
// lives in sessionStorage - same-tab reload only, cleared on first read.
const RESET_NOTICE_KEY = 'tien-hiep-idle-reset-notice'

export function markResetNotice(): void {
  try {
    sessionStorage.setItem(RESET_NOTICE_KEY, '1')
  } catch {
    // Storage denied - the notice is best-effort continuity, not state.
  }
}

export function consumeResetNotice(): boolean {
  try {
    const flagged = sessionStorage.getItem(RESET_NOTICE_KEY) === '1'
    sessionStorage.removeItem(RESET_NOTICE_KEY)
    return flagged
  } catch {
    return false
  }
}
