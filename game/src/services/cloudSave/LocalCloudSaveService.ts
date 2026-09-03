import { loadGame, writeGameSave, SAVE_REVISION_KEY, type GameSave } from '../save/SaveSystem'
import type { CloudSaveLoadResult, CloudSaveService, CloudSaveWriteResult } from './CloudSaveService'

function readRevision(): number {
  const value = Number(localStorage.getItem(SAVE_REVISION_KEY))
  return Number.isSafeInteger(value) && value >= 0 ? value : 0
}

export class LocalCloudSaveService implements CloudSaveService {
  async load(): Promise<CloudSaveLoadResult> {
    const outcome = loadGame()
    if (outcome.status === 'ok') return { ...outcome, revision: readRevision() }
    if (outcome.status === 'empty') return { status: 'empty', revision: 0 }
    return outcome
  }

  async save(save: GameSave, expectedRevision: number): Promise<CloudSaveWriteResult> {
    const currentRevision = readRevision()
    if (currentRevision !== expectedRevision) return { status: 'conflict', currentRevision }
    const revision = currentRevision + 1
    // 9.11 — revision-first: ghi SAVE_REVISION_KEY trước, SAVE_KEY sau.
    // Crash giữa hai key để lại revision mới + save cũ → lần save kế tiếp
    // CAS mismatch → coordinator resync (đọc revision từ storage) — an toàn
    // hơn stale-revision (save mới + revision cũ, hai bên lệch vĩnh viễn).
    try {
      localStorage.setItem(SAVE_REVISION_KEY, String(revision))
    } catch {
      return {
        status: 'unavailable',
        message: 'không ghi được revision',
        retryable: true,
      }
    }
    const write = writeGameSave(save)
    if (write.status !== 'ok') {
      // Save write fail (quota...) — rollback revision về giá trị cũ để CAS
      // state nguyên vẹn; autosave kế tiếp (15s) retry tự nhiên → retryable.
      try {
        localStorage.setItem(SAVE_REVISION_KEY, String(currentRevision))
      } catch {
        // Rollback fail: revision mới + save cũ → CAS mismatch ở lần save
        // kế tiếp → coordinator resync — vẫn an toàn theo lý thuyết 9.11.
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
