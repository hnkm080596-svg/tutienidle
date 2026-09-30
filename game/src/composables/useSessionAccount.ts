/**
 * B1.9 logout orchestration + B1.8 guest-account actions.
 *
 * The return-to-auth teardown is App-owned (stop sim, authority stopAll,
 * coordinator reset, route back to the auth card) and bound once at
 * startup - the same owner-binding convention as bindOnlineAuthority, so
 * deep UI surfaces (settings panel, auth card) can request a logout
 * without prop drilling through the overlay tree.
 *
 * Order per spec B1.9:
 *   1. flush through the authority's ONE save queue (saveable state);
 *   2. a failed/blocked flush stops logout unless the caller passes
 *      acknowledgeUnsynced - the explicit 'logout with unsynced
 *      progress' acknowledgement;
 *   3. revoke the active game session + GoTrue signout (authService.logout,
 *      which honestly reports unconfirmed remote effects);
 *   4. clear credential/session AND the explicit account binding;
 *   5. return to auth via the bound teardown.
 * No pending journal migrates across accounts: journal/acked keys are
 * identity-namespaced, so clearing the binding is the whole migration
 * fence.
 */
import { resolveOnlineAuthority } from './useOnlineAuthority'
import { authService } from '@/services/auth/AuthServiceFactory'
import { setSaveAccountId } from '@/services/save/saveKeys'
import type { FlushResult } from '@/shared/session/FlushResult'
import type { AuthLogoutOutcome } from '@/services/auth/AuthService'

let boundTeardown: (() => void) | null = null

/** App registers its return-to-auth teardown at startup. */
export function bindSessionTeardown(teardown: () => void): void {
  boundTeardown = teardown
}

export function unbindSessionTeardown(teardown: () => void): void {
  if (boundTeardown === teardown) boundTeardown = null
}

export type SessionLogoutResult =
  | { status: 'done'; outcome: AuthLogoutOutcome }
  | { status: 'flush-blocked'; flush: FlushResult }

export async function requestSessionLogout(options: { acknowledgeUnsynced?: boolean } = {}): Promise<SessionLogoutResult> {
  // Leg 1 - flush IF the state is saveable. A 'blocked' flush means the
  // authority already refuses writes (terminal/signed-out), so logout
  // proceeds straight to revoke; only an attempted-and-lost 'failed'
  // flush requires the explicit unsynced acknowledgement.
  const authority = resolveOnlineAuthority()
  if (authority) {
    const flush = await authority.flush(crypto.randomUUID())
    if (flush.status === 'failed' && !options.acknowledgeUnsynced) {
      return { status: 'flush-blocked', flush }
    }
  }

  // Legs 2-4 - revoke game session, sign out, clear credential/session.
  const outcome = await authService.logout()
  setSaveAccountId(null)
  boundTeardown?.()
  return { status: 'done', outcome }
}
