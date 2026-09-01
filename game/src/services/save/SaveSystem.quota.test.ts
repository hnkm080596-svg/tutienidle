// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { writeGameSave, SAVE_KEY, CURRENT_SAVE_VERSION, type GameSave } from './SaveSystem'
import { createDefaultPlayer } from '../../core/player/Player'

// Fixture tối thiểu hợp lệ — writeGameSave không validate shape (việc
// của loadGame/importSaveRaw), chỉ cần object JSON-stringify được.
function minimalSave(): GameSave {
  return {
    version: CURRENT_SAVE_VERSION,
    player: createDefaultPlayer(),
    techniques: [],
    skills: [],
    materials: [],
    equipment: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    equipmentSlots: [],
  }
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  // Hoàn prototype setItem đã bị mock bằng vi.spyOn — không restore thì
  // mọi test sau trong file này (và suite) kế thừa mock rò rỉ.
  vi.restoreAllMocks()
})

describe('writeGameSave — SaveWriteResult (quota handling, audit C1a)', () => {
  it('trả { status: "ok" } và localStorage có dữ liệu khi ghi thành công', () => {
    const save = minimalSave()

    const result = writeGameSave(save)

    expect(result).toEqual({ status: 'ok' })
    expect(localStorage.getItem(SAVE_KEY)).toBe(JSON.stringify(save))
  })

  it('trả { status: "failed", reason: "quota" } — KHÔNG throw — khi QuotaExceededError', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError')
    })

    const result = writeGameSave(minimalSave())

    expect(result).toEqual({ status: 'failed', reason: 'quota' })
  })

  it('trả { status: "failed", reason: "unknown" } khi setItem throw lỗi khác (vd SecurityError)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('security')
    })

    const result = writeGameSave(minimalSave())

    expect(result).toEqual({ status: 'failed', reason: 'unknown' })
  })
})
