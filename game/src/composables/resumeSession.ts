// Resume fast-path (ui-audit creation-meta) - detects "reload replays
// intro+auth" waste: a stored session (Supabase) or a local save means the
// player already has a character, so App shortens the intro and the auth
// card offers a one-click continue instead of a forced re-login.
// Presentation-side assembly only: reads the session slot and the resolved
// save key; no writes, no boot-authority changes.
import { readSupabaseLoginMarker, readSupabaseSession } from '@/services/supabase/SupabaseSession'
import { getRawSave } from '@/services/save/SaveSystem'
import type { AuthSession } from '@/services/auth/AuthService'

export interface ResumeCandidate {
  session: AuthSession
  name: string
}

/** True when a stored session or any resolvable save exists - enough to
 *  justify the short intro + continue affordance. */
export function hasResumeCandidate(): boolean {
  try {
    return Boolean(readSupabaseSession()) || Boolean(getRawSave())
  } catch {
    return false
  }
}

/** Session + character name for the continue button, or null when there is
 *  genuinely nothing to resume. Guest saves without a stored session resume
 *  as a fresh guest session (same shape MockAuthService returns). */
export function readResumeCandidate(): ResumeCandidate | null {
  const stored = readSupabaseSession()
  const raw = getRawSave()

  if (!stored && !raw) {
    return null
  }

  const session: AuthSession = stored
    ? { sessionId: stored.sessionId, mode: stored.mode ?? 'guest', userId: stored.userId }
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

  return { session, name }
}

// F-BX-71 - 'session expired' detection: the resume path fabricated a
// guest session and never told the user their login died. The durable
// login marker survives session clears (a provably-dead refresh token
// wipes the session, not the marker) while an explicit logout removes
// it - so 'marker set, session gone' is exactly an expired login.
export function hasExpiredLoginMarker(): boolean {
  try {
    return !readSupabaseSession() && readSupabaseLoginMarker() !== null
  } catch {
    return false
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
