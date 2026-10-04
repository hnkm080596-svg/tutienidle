import type { PendingSaveRecord } from './PendingSaveJournal'

// Beta-final B1-C (PR4) - pure reconciliation of a durable pending
// record against the remote head and the replayed-mutation outcome.
// No I/O, no clock: the same inputs always yield the same decision,
// which keeps the lost-ACK path deterministic and testable.
//
// Outcomes:
//   retry-same        - fate unresolved (replay could not reach the
//                       server); the journal record stays and replays
//                       on a later load.
//   already-committed - the receipt proves the mutation committed (either
//                       idempotent replay or a fresh commit); the journal
//                       clears. When the receipt's current revision moved
//                       past the committed one, the pending payload is
//                       obsolete - cache the retrieved remote row, never
//                       the stale pending bytes.
//   conflict          - genuine CAS divergence; the record stays in the
//                       journal and the boot surfaces it for export.
//   quarantine        - corrupt or permanently uncommittable; the record
//                       parks in quarantine for explicit export.

export type RemoteSaveHead =
  | { status: 'save-row'; currentRevision: number }
  | { status: 'no-save' }
  | { status: 'character-missing' }

export type PendingReplayOutcome =
  | {
      kind: 'committed'
      alreadyCommitted: boolean
      committedRevision: number
      currentRevision: number
      serverTimeUtc?: string
    }
  | { kind: 'conflict'; currentRevision: number }
  | { kind: 'rejected'; code: string }
  | { kind: 'unavailable' }

export type ReconcileDecision =
  | { status: 'retry-same' }
  | {
      status: 'already-committed'
      committedRevision: number
      currentRevision: number
      /** Which bytes the acked mirror should hold - 'remote' whenever the
       *  head moved past this commit (never cache an obsolete payload). */
      cachePayload: 'pending' | 'remote'
    }
  | { status: 'conflict'; currentRevision: number }
  | { status: 'quarantine'; reason: string }

export function reconcilePendingSave(
  _pending: PendingSaveRecord,
  remote: RemoteSaveHead,
  replay: PendingReplayOutcome,
): ReconcileDecision {
  // A pending bound to a character the server no longer has can never
  // commit - park it rather than replaying a hopeless mutation forever.
  if (remote.status === 'character-missing') {
    return { status: 'quarantine', reason: remote.status }
  }

  switch (replay.kind) {
    case 'unavailable':
      return { status: 'retry-same' }

    case 'conflict':
      return { status: 'conflict', currentRevision: replay.currentRevision }

    case 'rejected':
      return { status: 'quarantine', reason: replay.code }

    case 'committed': {
      const { committedRevision, currentRevision } = replay
      if (currentRevision < committedRevision) {
        // Server-impossible receipt shape - do not trust anything derived
        // from it; park the record for forensic export.
        return { status: 'quarantine', reason: 'receipt-inconsistent' }
      }
      return {
        status: 'already-committed',
        committedRevision,
        currentRevision,
        cachePayload: currentRevision === committedRevision ? 'pending' : 'remote',
      }
    }
  }
}
