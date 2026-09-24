import type { GameSave, LoadOutcome } from '../save/SaveSystem'

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
  | { status: 'unavailable'; message: string }

export type CloudSaveWriteResult =
  | { status: 'ok'; revision: number; recoveredFromConflict?: boolean }
  | { status: 'conflict'; currentRevision: number }
  | { status: 'unavailable'; message: string; retryable: boolean }

// R10 (AR-15, local scope, S5) — explicit adapter boundary. Only
// 'local-only' exists today: single-key localStorage, non-atomic
// (last-writer-wins) revision compare-and-swap, no remote transport. A
// future remote/cloud adapter is a SEPARATE product with its own explicit
// scope (auth/session boundary, real transactional writes) — it must not
// be introduced by quietly branching inside this factory. See BOUNDS.md.
export type CloudSaveCapability = 'local-only'

export interface CloudSaveService {
  readonly capability: CloudSaveCapability
  load(): Promise<CloudSaveLoadResult>
  save(save: GameSave, expectedRevision: number): Promise<CloudSaveWriteResult>
}
