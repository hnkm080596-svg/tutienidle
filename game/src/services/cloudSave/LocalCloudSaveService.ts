import { getRawSave, loadGame, writeGameSave, type GameSave } from '../save/SaveSystem'
import { resolveRevisionKey } from '../save/saveKeys'
import type { CloudSaveLoadResult, CloudSaveService, CloudSaveWriteResult } from './CloudSaveService'

export function readLocalSaveRevision(): number {
  const value = Number(localStorage.getItem(resolveRevisionKey()))
  return Number.isSafeInteger(value) && value >= 0 ? value : 0
}

export class LocalCloudSaveService implements CloudSaveService {
  readonly capability = 'local-only' as const

  // B1-C cache facade - the local slot IS the mirror here.
  async readCachedSave(): Promise<{ raw: string; revision: number } | null> {
    const raw = getRawSave()
    return raw ? { raw, revision: readLocalSaveRevision() } : null
  }

  async load(): Promise<CloudSaveLoadResult> {
    try {
      const outcome = loadGame()
      if (outcome.status === 'ok') return { ...outcome, revision: readLocalSaveRevision() }
      if (outcome.status === 'empty') return { status: 'empty', revision: 0 }
      if (outcome.status === 'storage_unavailable') {
        return { status: 'unavailable', message: 'localStorage không truy cập được' }
      }
      return outcome
    } catch {
      // readLocalSaveRevision() or any residual storage throw - 'unavailable' is
      // the lifecycle-handled status (boot.fail, never new-character).
      return { status: 'unavailable', message: 'localStorage không truy cập được' }
    }
  }

  async save(save: GameSave, expectedRevision: number): Promise<CloudSaveWriteResult> {
    const currentRevision = readLocalSaveRevision()
    if (currentRevision !== expectedRevision) return { status: 'conflict', currentRevision }
    const revision = currentRevision + 1
    // 9.11 - revision-first: ghi SAVE_REVISION_KEY truoc, SAVE_KEY sau.
    // Crash giua hai key de lai revision moi + save cu -> lan save ke tiep
    // CAS mismatch -> coordinator resync (doc revision tu storage) - an toan
    // hon stale-revision (save moi + revision cu, hai ben lech vinh vien).
    try {
      localStorage.setItem(resolveRevisionKey(), String(revision))
    } catch {
      return {
        status: 'unavailable',
        message: 'không ghi được revision',
        retryable: true,
      }
    }
    const write = writeGameSave(save)
    if (write.status !== 'ok') {
      // Save write fail (quota...) - rollback revision ve gia tri cu de CAS
      // state nguyen ven; autosave ke tiep (15s) retry tu nhien -> retryable.
      try {
        localStorage.setItem(resolveRevisionKey(), String(currentRevision))
      } catch {
        // Rollback fail: revision moi + save cu -> CAS mismatch o lan save
        // ke tiep -> coordinator resync - van an toan theo ly thuyet 9.11.
      }
      return {
        status: 'unavailable',
        message: write.reason === 'quota' ? 'localStorage đầy (quota)' : 'ghi save thất bại',
        retryable: true,
      }
    }
    return { status: 'ok', revision }
  }
}
