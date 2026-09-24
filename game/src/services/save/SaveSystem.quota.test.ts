// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  writeGameSave,
  loadGame,
  backupCurrentSave,
  restoreBackup,
  deleteSave,
  hasBackup,
  getRawSave,
  importSaveRaw,

  CURRENT_SAVE_VERSION,
  type GameSave,
} from './SaveSystem'
import { resolveBackupKey, resolveImportHandoffKey, resolveRevisionKey, resolveSaveKey } from './saveKeys'
import { createDefaultPlayer } from '../../core/player/Player'

// Guest-slot keys (no account bound in this file).
const SAVE_KEY = resolveSaveKey()
const SAVE_REVISION_KEY = resolveRevisionKey()
// Captured at module load: calling a resolver INSIDE a Storage-method mock
// recurses (resolvers read sessionStorage -> the same mocked prototype).
const BACKUP_KEY = resolveBackupKey()
const IMPORT_DISCARDED_EQUIPMENT_COUNT_KEY = resolveImportHandoffKey()

// Fixture tối thiểu hợp lệ — writeGameSave không validate shape (việc
// của loadGame/importSaveRaw), chỉ cần object JSON-stringify được.
// v82 contract (F-INT-03): importSaveRaw now gates acceptance, so the
// fixture must be a legal save - pick + learned entry + core grant.
function minimalSave(): GameSave {
  const player = createDefaultPlayer()

  player.mortalBasicSkillId = 'tram'
  player.nodeLevels = { ...player.nodeLevels, core_tram: 1 }
  player.purchasedNodeIds = [...player.purchasedNodeIds, 'core_tram']

  return {
    version: CURRENT_SAVE_VERSION,
    player,
    techniques: [],
    skills: [
      {
        id: 'tram',
        name: 'Trảm',
        description: 'creation pick',
        type: 'active',
        level: 1,
        maxLevel: 10,
        cooldown: 0,
        target: 'enemy',
        effects: [],
      },
    ],
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
    localStorage.setItem(BACKUP_KEY, '{"version":1}')

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
      if (key === BACKUP_KEY) {
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

describe('Mission A review — storage failure matrix (getItem/removeItem)', () => {
  it('loadGame trả storage_unavailable khi getItem(SAVE_KEY) throw', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })

    expect(loadGame()).toEqual({ status: 'storage_unavailable' })
  })

  it('loadGame vẫn ok khi chỉ handoff getItem throw (marker phụ trợ degrade)', () => {
    writeGameSave(minimalSave())

    const realGetItem = Storage.prototype.getItem
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
      if (key === IMPORT_DISCARDED_EQUIPMENT_COUNT_KEY) {
        throw new DOMException('denied', 'SecurityError')
      }
      return realGetItem.call(this, key)
    })

    const outcome = loadGame()

    expect(outcome.status).toBe('ok')
  })

  it('deleteSave trả false khi removeItem(SAVE_KEY) throw nhưng vẫn xoá các key còn lại', () => {
    localStorage.setItem(SAVE_KEY, '{"version":1}')
    localStorage.setItem(IMPORT_DISCARDED_EQUIPMENT_COUNT_KEY, '{}')
    localStorage.setItem(SAVE_REVISION_KEY, '3')

    const realRemoveItem = Storage.prototype.removeItem
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, key: string) {
      if (key === SAVE_KEY) {
        throw new DOMException('denied', 'SecurityError')
      }
      return realRemoveItem.call(this, key)
    })

    expect(deleteSave()).toBe(false)
    // Save còn nguyên — caller KHÔNG được reload.
    expect(localStorage.getItem(SAVE_KEY)).not.toBeNull()
    // Partial-delete tránh tối đa: handoff + revision vẫn được dọn.
    expect(localStorage.getItem(IMPORT_DISCARDED_EQUIPMENT_COUNT_KEY)).toBeNull()
    expect(localStorage.getItem(SAVE_REVISION_KEY)).toBeNull()
  })

  it('deleteSave trả true khi mọi key xoá thành công', () => {
    localStorage.setItem(SAVE_KEY, '{"version":1}')

    expect(deleteSave()).toBe(true)
    expect(localStorage.getItem(SAVE_KEY)).toBeNull()
  })

  it('restoreBackup trả false và SAVE_KEY nguyên vẹn khi removeItem(handoff) throw', () => {
    localStorage.setItem(BACKUP_KEY, '{"version":1}')
    localStorage.setItem(SAVE_KEY, '{"version":2,"keep":true}')

    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })

    expect(restoreBackup()).toBe(false)
    // Reorder (MA-R2-03): handoff cleanup runs before the write, so a
    // throw leaves the real save untouched — false means "nothing
    // restored", not "restored but cleanup failed".
    expect(localStorage.getItem(SAVE_KEY)).toBe('{"version":2,"keep":true}')
  })

  it('hasBackup/getRawSave degrade thay vì throw khi getItem fail', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })

    expect(hasBackup()).toBe(false)
    expect(getRawSave()).toBeNull()
  })
})
