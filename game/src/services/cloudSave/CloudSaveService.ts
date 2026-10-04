import type { GameSave, LoadOutcome } from '../save/SaveSystem'
import type { BackendErrorCode, RemoteCharacterMetadata } from '../session/BackendStatus'

export type CloudSaveLoadResult =
  | { status: 'empty'; revision: 0 }
  | {
      status: 'ok'
      save: GameSave
      revision: number
      /** Luon co; 0 khi load khong loai equipment legacy. */
      discardedEquipmentCount: number
      /** Stored bytes - mirrors LoadOutcome.ok so a rejected-after-shape
       * save exports byte-identically at the recovery surface. */
      raw: string
      /** remote-authoritative only (B1-D): the remote head adopted our
       * durable pending record - the payload IS the same-lineage write
       * this client issued, so a reconnect resumes in-memory instead of
       * restoring. */
      adoptedPending?: boolean
      /** remote-authoritative only (B1-D): server-authorized cold-boot
       * time bounds - every offline-accrual owner consumes these instead
       * of the client clock or the payload's editable timestamps. */
      serverAuthority?: {
        /** progression_cutoff_at of the loaded save row (ms epoch).
         *  Undefined when the row predates the checkpoint contract. */
        cutoffMs?: number
        /** serverTimeUtc of the load response (ms epoch). */
        serverNowMs: number
      }
    }
  | Extract<LoadOutcome, { status: 'incompatible' | 'corrupted' }>
  | {
      /** remote-authoritative only: the character row exists but no save
       * was ever committed (crash before revision 1). The boot path must
       * rebuild the starter snapshot from `character` - the canonical
       * server metadata - and commit expectedRevision 0, never reroll. */
      status: 'uninitialized'
      character: RemoteCharacterMetadata
      revision: 0
    }
  | {
      /** remote-authoritative only: the character row is soft-deleted;
       * a terminal state with no in-client recovery path. */
      status: 'deleted'
      character?: RemoteCharacterMetadata
    }
  | {
      /** remote-authoritative only (B1-C): a durable pending mutation
       * hit genuine CAS divergence during the load-time replay. The
       * journal record is retained and pendingRaw carries the pending
       * payload bytes for the recovery/export surface. */
      status: 'pending-conflict'
      currentRevision: number
      pendingRaw: string
    }
  | {
      /** remote-authoritative only (B1-C): a durable pending record was
       * corrupt or permanently uncommittable; it was parked in the
       * quarantine slot and pendingRaw preserves its payload bytes for
       * explicit export. */
      status: 'pending-quarantined'
      reason: string
      pendingRaw: string
    }
  | {
      status: 'unavailable'
      message: string
      /** B1.7 taxonomy: transport/session/config rejections keep their
       * precise code; absent on legacy local-only failures. */
      code?: BackendErrorCode
      retryable?: boolean
      /** Server-supplied detail code carried for diagnostics. */
      detail?: string
    }

export type CloudSaveWriteResult =
  | {
      status: 'ok'
      revision: number
      recoveredFromConflict?: boolean
      /** B1-C: the server ACK committed but a durable mirror step
       *  (cache write / journal clear) reported a storage or quota
       *  failure - the server ACK remains the authority. */
      storageWarning?: string
    }
  | { status: 'conflict'; currentRevision: number }
  | { status: 'unavailable'; message: string; retryable: boolean; code?: BackendErrorCode; detail?: string }

// R10 (AR-15) + beta-final B1 - explicit adapter boundary:
// 'local-only'    : single-key localStorage, non-atomic revision CAS,
//                   last-writer-wins conflict recovery.
// 'remote-authoritative' : guarded Supabase RPCs own admission, save
//                   revision and commit ordering (B1.4-B1.6). A revision
//                   conflict is a TERMINAL lifecycle state (reconcile/
//                   journal work, PR4-5) - the coordinator must never run
//                   the local load-latest/retry-overwrite branch.
export type CloudSaveCapability = 'local-only' | 'remote-authoritative'

/** B1-D: one authenticated probe of the active session - the heartbeat
 *  RPC. 'ok' renews the server checkpoint lease; 'unavailable' keeps the
 *  B1.7 error taxonomy for the admission controller to classify. */
export interface HeartbeatOutcome {
  status: 'ok' | 'unavailable'
  code?: BackendErrorCode
  message?: string
  retryable?: boolean
  detail?: string
}

export interface CloudSaveService {
  readonly capability: CloudSaveCapability
  load(): Promise<CloudSaveLoadResult>
  save(save: GameSave, expectedRevision: number): Promise<CloudSaveWriteResult>
  /** B1-C: the ACKed cache mirror for export/resume seams - null when
   *  absent or corrupt. Never an authority read. */
  readCachedSave?(): Promise<{ raw: string; revision: number } | null>
  /** B1-C: generation fence. Reset/logout/user-switch calls this so
   *  in-flight continuations of the OLD generation cannot write the
   *  checkpoint, journal, or cache when their transport resolves. */
  advanceGeneration?(): void
  /** B1-D: heartbeat the active session (30s cadence per B1.7). Absent
   *  on local-only adapters - there is no remote authority to probe. */
  heartbeat?(): Promise<HeartbeatOutcome>
}
