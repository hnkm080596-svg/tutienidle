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
    writeGameSave(save)
    localStorage.setItem(SAVE_REVISION_KEY, String(revision))
    return { status: 'ok', revision }
  }
}
