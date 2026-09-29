import type { GameSave, LoadOutcome } from '../save/SaveSystem'
import type { BackendErrorCode, RemoteCharacterMetadata } from '../session/BackendStatus'

export type CloudSaveLoadResult =
  | { status: 'empty'; revision: 0 }
  | {
      status: 'ok'
      save: GameSave
      revision: number
      /** Luôn có; 0 khi load không loại equipment legacy. */
      discardedEquipmentCount: number
      /** Stored bytes - mirrors LoadOutcome.ok so a rejected-after-shape
       * save exports byte-identically at the recovery surface. */
      raw: string
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
  | { status: 'ok'; revision: number; recoveredFromConflict?: boolean }
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

export interface CloudSaveService {
  readonly capability: CloudSaveCapability
  load(): Promise<CloudSaveLoadResult>
  save(save: GameSave, expectedRevision: number): Promise<CloudSaveWriteResult>
}
