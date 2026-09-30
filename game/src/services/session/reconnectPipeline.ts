import type { GameSave } from '../save/SaveSystem'
import type { CloudSaveLoadResult, HeartbeatOutcome } from '../cloudSave/CloudSaveService'
import type { ReconnectOutcome } from './OnlineSessionController'
import { authorityStateForError } from './OnlineSessionController'

/**
 * B1-D - the spec-ordered reconnect pipeline the OnlineSessionController
 * auto-retries while 'reconnecting'. Order is the admission order:
 *
 *   1. Regain transport + refresh auth (single-flight; a transient
 *      refresh failure RETAINS the stored credential - only a proven
 *      terminal rejection expired it, resolved by the caller).
 *   2. Heartbeat the ACTIVE game session (session revoke is a different
 *      axis from Auth identity - the RPC decides).
 *   3. Load the authoritative save - the pending journal reconciles
 *      inside load() so a replayed write cannot be lost mid-reconnect.
 *   4. Confirm lineage: an unchanged revision resumes in-memory ('same');
 *      a moved revision hands the caller the authoritative payload for a
 *      zero-accrual live replacement ('replaced').
 */

export interface ReconnectPipelineDeps {
  /** Single-flight auth refresh. 'expired' = the stored credential was
   *  cleared by a proven terminal rejection; 'unavailable' = transient. */
  refreshAuth: () => Promise<'ok' | 'unavailable' | 'expired'>
  /** The active-session heartbeat RPC. */
  heartbeat: () => Promise<HeartbeatOutcome>
  /** Authoritative load (journal reconcile runs inside). */
  load: () => Promise<CloudSaveLoadResult>
  /** The revision this session last committed/loaded - lineage detection. */
  expectedRevision: () => number
}

function terminalFor(code: Parameters<typeof authorityStateForError>[0]): ReconnectOutcome {
  const mapped = authorityStateForError(code)
  return mapped === 'reconnecting' ? { status: 'unavailable' } : { status: 'terminal', state: mapped }
}

export async function runReconnectPipeline(deps: ReconnectPipelineDeps): Promise<ReconnectOutcome> {
  const refresh = await deps.refreshAuth()
  if (refresh === 'expired') {
    return { status: 'terminal', state: 'revoked' }
  }
  if (refresh === 'unavailable') {
    return { status: 'unavailable' }
  }

  const beat = await deps.heartbeat()
  if (beat.status !== 'ok') {
    // SESSION_REVOKED / a non-retryable AUTH_EXPIRED are terminal; the rest
    // classify through the B1.7 taxonomy.
    return terminalFor(beat.code)
  }

  const loaded = await deps.load()

  if (loaded.status === 'ok') {
    const replaced = loaded.revision !== deps.expectedRevision()
    return {
      status: 'resumed',
      lineage: replaced ? 'replaced' : 'same',
      // The reconnect restore is ZERO-ACCRUAL (live replacement): the
      // caller consumes the server clock bound only, never elapsed time.
      save: replaced ? loaded.save : undefined,
      serverAuthority: loaded.serverAuthority,
    }
  }

  if (loaded.status === 'unavailable') {
    return terminalFor(loaded.code)
  }

  // deleted / corrupted / incompatible / pending-conflict /
  // pending-quarantined mid-reconnect: the state cannot be reconciled
  // online - park on the recovery surface.
  return { status: 'terminal', state: 'recovery' }
}

export type { GameSave }
