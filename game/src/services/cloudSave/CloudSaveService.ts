import type { GameSave, LoadOutcome } from '../save/SaveSystem'

export type CloudSaveLoadResult =
  | { status: 'empty'; revision: 0 }
  | {
      status: 'ok'
      save: GameSave
      revision: number
      /** Luôn có; 0 khi load không loại equipment legacy. */
      discardedEquipmentCount: number
    }
  | Extract<LoadOutcome, { status: 'incompatible' | 'corrupted' }>
  | { status: 'unavailable'; message: string }

export type CloudSaveWriteResult =
  | { status: 'ok'; revision: number; recoveredFromConflict?: boolean }
  | { status: 'conflict'; currentRevision: number }
  | { status: 'unavailable'; message: string; retryable: boolean }

export interface CloudSaveService {
  load(): Promise<CloudSaveLoadResult>
  save(save: GameSave, expectedRevision: number): Promise<CloudSaveWriteResult>
}
