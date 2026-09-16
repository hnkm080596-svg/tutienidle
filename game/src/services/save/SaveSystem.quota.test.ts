// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  writeGameSave,
  backupCurrentSave,
  restoreBackup,
  deleteSave,
  importSaveRaw,
  SAVE_KEY,
  CURRENT_SAVE_VERSION,
  type GameSave,
} from './SaveSystem'
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

// Mission A5 — mọi đường ghi/xoá storage recovery cũng phải qua
// try/catch như writeGameSave: private mode / quota throw SecurityError
// hoặc QuotaExceededError và UI không được crash.
describe('recovery storage ops — exception-safe (Mission A5)', () => {
  it('backupCurrentSave trả false — KHÔNG throw — khi setItem throw', () => {
    localStorage.setItem(SAVE_KEY, '{"version":1}')

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError')
    })

    expect(backupCurrentSave()).toBe(false)
  })

  it('backupCurrentSave trả true khi không có save gì để backup (no-op)', () => {
    expect(backupCurrentSave()).toBe(true)
  })

  it('restoreBackup trả false — KHÔNG throw — khi setItem throw', () => {
    // BACKUP_KEY là private constant trong SaveSystem — literal khớp.
    localStorage.setItem('tien-hiep-idle-save-backup', '{"version":1}')

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('security')
    })

    expect(restoreBackup()).toBe(false)
  })

  it('deleteSave không throw khi backup (setItem) throw — save vẫn bị xoá', () => {
    localStorage.setItem(SAVE_KEY, '{"version":1}')

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError')
    })

    expect(() => deleteSave()).not.toThrow()
    expect(localStorage.getItem(SAVE_KEY)).toBeNull()
  })

  it('importSaveRaw trả false — KHÔNG throw — khi ghi save chính throw', () => {
    const validRaw = JSON.stringify(minimalSave())
    const original = Storage.prototype.setItem

    // Chỉ chặn write vào SAVE_KEY — handoff marker/backup vẫn chạy được,
    // để test đúng nhánh "final write throw".

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === SAVE_KEY) {
        throw new DOMException('quota exceeded', 'QuotaExceededError')
      }

      return original.call(this, key, value)
    })

    expect(importSaveRaw(validRaw)).toBe(false)
    expect(localStorage.getItem(SAVE_KEY)).toBeNull()
  })

  it('importSaveRaw trả false khi BACKUP write throw — save hiện tại nguyên vẹn', () => {
    const currentRaw = JSON.stringify(minimalSave())

    localStorage.setItem(SAVE_KEY, currentRaw)

    const original = Storage.prototype.setItem

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === 'tien-hiep-idle-save-backup') {
        throw new DOMException('quota exceeded', 'QuotaExceededError')
      }

      return original.call(this, key, value)
    })

    // Không backup được → KHÔNG ghi đè save duy nhất khi chưa có
    // safety net.
    expect(importSaveRaw(validRaw())).toBe(false)
    expect(localStorage.getItem(SAVE_KEY)).toBe(currentRaw)

    function validRaw(): string {
      return JSON.stringify({ ...minimalSave(), player: { ...minimalSave().player, name: 'imported' } })
    }
  })
})
