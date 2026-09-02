import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loadGame,
  deleteSave,
  backupCurrentSave,
  hasBackup,
  restoreBackup,
  getRawSave,
  importSaveRaw,
  writeGameSave,
  SAVE_REVISION_KEY,
  CURRENT_SAVE_VERSION,
  type GameSave,
} from './SaveSystem'
import { createDefaultPlayer } from '../../core/player/Player'

const SAVE_KEY = 'tien-hiep-idle-save'
const BACKUP_KEY = 'tien-hiep-idle-save-backup'
const IMPORT_DISCARDED_EQUIPMENT_COUNT_KEY =
  'tien-hiep-idle-import-discarded-equipment-count'

// vitest.config chạy environment: 'node' — không có localStorage thật,
// polyfill in-memory tối thiểu đủ cho SaveSystem (chỉ dùng getItem/
// setItem/removeItem).
class MemoryStorage implements Storage {
  private store = new Map<string, string>()

  get length() {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
})

// Fixture hợp lệ đầy đủ theo shape GameSave hiện hành — từ
// save-shape-validation-plan.md, loadGame() giờ validate shape nên
// fixture tối thiểu { version, player: { name } } không còn đủ.
function validGameSave(name?: string): GameSave {
  const player = createDefaultPlayer()

  if (name) {
    player.name = name
  }

  return {
    version: CURRENT_SAVE_VERSION,
    player,
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

function validSave(): Record<string, unknown> {
  return { ...validGameSave() }
}

const VALID_RAW = JSON.stringify(validSave())

describe('loadGame — phân biệt empty/ok/incompatible/corrupted (Phase 5, mục XVI)', () => {
  it('empty khi chưa từng có save', () => {
    expect(loadGame()).toEqual({ status: 'empty' })
  })

  it('ok khi version khớp CURRENT_SAVE_VERSION', () => {
    localStorage.setItem(SAVE_KEY, VALID_RAW)

    const outcome = loadGame()

    expect(outcome.status).toBe('ok')
  })

  it('incompatible khi version không khớp — KHÔNG coi như empty (chặn silent reset)', () => {
    const raw = JSON.stringify({ version: 7, player: { name: 'old' } })

    localStorage.setItem(SAVE_KEY, raw)

    expect(loadGame()).toEqual({ status: 'incompatible', foundVersion: 7, raw })
  })

  it('corrupted khi JSON không parse được', () => {
    localStorage.setItem(SAVE_KEY, '{not valid json')

    const outcome = loadGame()

    expect(outcome.status).toBe('corrupted')
  })
})

describe('loadGame — shape validation (save-shape-validation-plan.md)', () => {
  it('corrupted khi đúng version nhưng thiếu array bắt buộc (materials)', () => {
    const save = validSave()

    delete save.materials

    localStorage.setItem(SAVE_KEY, JSON.stringify(save))

    expect(loadGame().status).toBe('corrupted')
  })

  it('corrupted khi thiếu player.nodeLevels (tiền lệ crash boot v47)', () => {
    const save = validSave()

    delete (save.player as Record<string, unknown>).nodeLevels

    localStorage.setItem(SAVE_KEY, JSON.stringify(save))

    expect(loadGame().status).toBe('corrupted')
  })

  it('corrupted khi player.lastSavedAt không phải number (chặn NaN cultivation)', () => {
    const save = validSave()
    ;(save.player as Record<string, unknown>).lastSavedAt = 'yesterday'

    localStorage.setItem(SAVE_KEY, JSON.stringify(save))

    expect(loadGame().status).toBe('corrupted')
  })

  it('corrupted khi materials entry có amount NaN', () => {
    const save = validSave()

    save.materials = [{ materialId: 'spirit_stone', amount: Number.NaN }]

    localStorage.setItem(SAVE_KEY, JSON.stringify(save))

    expect(loadGame().status).toBe('corrupted')
  })

  it('corrupted khi equipment current thiếu StatModifier identity thay vì để lỗi tới restore', () => {
    const save = validSave()

    save.equipment = [{
      instanceId: 'current-equipment',
      itemId: 'base_kiem',
      slot: 'weapon',
      equipped: true,
      grade: 'cuu_pham',
      quality: 'hoang',
      mainStat: { stat: 'attack', flat: 1 },
      affixes: [{ affixId: 'suffix_accuracy', tier: 1, value: 3 }],
      forgeUsesTotal: 6,
      forgeUsesRemaining: 6,
    }]
    localStorage.setItem(SAVE_KEY, JSON.stringify(save))

    expect(loadGame().status).toBe('corrupted')
  })

  it('ok với optional fields vắng mặt (productionSites/alchemyJobs/quests)', () => {
    const save = validSave()

    delete save.productionSites
    delete save.alchemyJobs
    delete save.quests

    localStorage.setItem(SAVE_KEY, JSON.stringify(save))

    expect(loadGame().status).toBe('ok')
  })

  it('loại equipment legacy khỏi save nạp, ghi counter và vẫn load phần còn lại', () => {
    const save = validSave()

    save.equipment = [{
      instanceId: 'legacy-equipment',
      itemId: 'legacy-sword',
      slot: 'weapon',
      equipped: false,
      realmId: 'mortal',
      rarity: 'hoang',
      mainStat: { stat: 'attack', flat: 1 },
      affixes: [],
      forgePoints: 0,
    }]
    localStorage.setItem(SAVE_KEY, JSON.stringify(save))

    const outcome = loadGame()

    expect(outcome.status).toBe('ok')
    if (outcome.status === 'ok') {
      expect(outcome.save.equipment).toEqual([])
      expect(outcome.discardedEquipmentCount).toBe(1)
    }
  })
})

describe('backup / restore', () => {
  it('deleteSave() sao lưu save hiện tại trước khi xoá', () => {
    localStorage.setItem(SAVE_KEY, VALID_RAW)

    expect(hasBackup()).toBe(false)

    deleteSave()

    expect(localStorage.getItem(SAVE_KEY)).toBeNull()
    expect(hasBackup()).toBe(true)
    expect(localStorage.getItem(BACKUP_KEY)).toBe(VALID_RAW)
  })

  // Fix (2026-08-24) — xoá save phải xoá cả revision key, nếu không
  // revision tồn dư khiến lần CAS đầu của nhân vật mới fail ("Save đã
  // thay đổi ở một phiên khác.").
  it('deleteSave() xoá cả SAVE_REVISION_KEY để revision không tồn dư', () => {
    localStorage.setItem(SAVE_KEY, VALID_RAW)
    localStorage.setItem(SAVE_REVISION_KEY, '12')

    deleteSave()

    expect(localStorage.getItem(SAVE_REVISION_KEY)).toBeNull()
  })

  it('restoreBackup() ghi backup trở lại SAVE_KEY', () => {
    localStorage.setItem(SAVE_KEY, VALID_RAW)
    backupCurrentSave()
    localStorage.setItem(SAVE_KEY, 'corrupted-overwrite')

    const restored = restoreBackup()

    expect(restored).toBe(true)
    expect(getRawSave()).toBe(VALID_RAW)
  })

  it('restoreBackup() trả false khi chưa từng có backup', () => {
    expect(restoreBackup()).toBe(false)
  })
})

describe('importSaveRaw', () => {
  it('từ chối JSON hỏng', () => {
    expect(importSaveRaw('not json')).toBe(false)
  })

  it('từ chối object thiếu field version/player', () => {
    expect(importSaveRaw(JSON.stringify({ foo: 'bar' }))).toBe(false)
  })

  it('chấp nhận save hợp lệ, sao lưu save cũ trước khi ghi đè', () => {
    localStorage.setItem(SAVE_KEY, VALID_RAW)

    const newRaw = JSON.stringify({ version: 13, player: { name: 'imported' } })

    expect(importSaveRaw(newRaw)).toBe(true)
    expect(getRawSave()).toBe(newRaw)
    expect(localStorage.getItem(BACKUP_KEY)).toBe(VALID_RAW)
  })

  it('từ chối save đúng version hiện hành nhưng sai shape (chặn ghi đè save hỏng)', () => {
    localStorage.setItem(SAVE_KEY, VALID_RAW)

    const broken = validSave()

    delete broken.equipment

    const brokenRaw = JSON.stringify(broken)

    expect(importSaveRaw(brokenRaw)).toBe(false)

    // Save tốt ban đầu KHÔNG bị ghi đè.
    expect(getRawSave()).toBe(VALID_RAW)
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull()
  })

  it('chấp nhận save nguyên shape đúng version hiện hành', () => {
    const raw = JSON.stringify(validSave())

    expect(importSaveRaw(raw)).toBe(true)
    expect(getRawSave()).toBe(raw)
  })

  it('đúng normalized payload nhận counter một lần và backup vẫn giữ save cũ', () => {
    localStorage.setItem(SAVE_KEY, VALID_RAW)
    const save = validSave()

    save.equipment = [{
      instanceId: 'legacy-equipment',
      itemId: 'legacy-sword',
      slot: 'weapon',
      equipped: false,
      realmId: 'mortal',
      rarity: 'hoang',
      mainStat: { stat: 'attack', flat: 1 },
      affixes: [],
      forgePoints: 0,
    }]

    expect(importSaveRaw(JSON.stringify(save))).toBe(true)

    const stored = getRawSave()

    expect(stored).not.toBeNull()
    expect(JSON.parse(stored ?? '{}').equipment).toEqual([])
    expect(localStorage.getItem(BACKUP_KEY)).toBe(VALID_RAW)

    const firstLoad = loadGame()

    expect(firstLoad.status).toBe('ok')
    if (firstLoad.status === 'ok') {
      expect(firstLoad.save.equipment).toEqual([])
      expect(firstLoad.discardedEquipmentCount).toBe(1)
    }

    const secondLoad = loadGame()

    expect(secondLoad.status).toBe('ok')
    if (secondLoad.status === 'ok') {
      expect(secondLoad.discardedEquipmentCount).toBe(0)
    }
  })

  it('không gán counter import cũ cho save khác được ghi trước lần load kế tiếp', () => {
    const imported = validSave()

    imported.equipment = [{
      instanceId: 'legacy-equipment',
      itemId: 'legacy-sword',
      slot: 'weapon',
      equipped: false,
      realmId: 'mortal',
      rarity: 'hoang',
      mainStat: { stat: 'attack', flat: 1 },
      affixes: [],
      forgePoints: 0,
    }]

    expect(importSaveRaw(JSON.stringify(imported))).toBe(true)
    expect(writeGameSave(validGameSave('live-pre-import'))).toEqual({ status: 'ok' })

    const outcome = loadGame()

    expect(outcome.status).toBe('ok')
    if (outcome.status === 'ok') {
      expect(outcome.save.player.name).toBe('live-pre-import')
      expect(outcome.discardedEquipmentCount).toBe(0)
    }
  })

  it('marker quota failure không thay main save hoặc backup và trả false', () => {
    const previousBackup = 'previous-backup'

    localStorage.setItem(SAVE_KEY, VALID_RAW)
    localStorage.setItem(BACKUP_KEY, previousBackup)

    const imported = validSave()

    imported.equipment = [{
      instanceId: 'legacy-equipment',
      itemId: 'legacy-sword',
      slot: 'weapon',
      equipped: false,
      realmId: 'mortal',
      rarity: 'hoang',
      mainStat: { stat: 'attack', flat: 1 },
      affixes: [],
      forgePoints: 0,
    }]

    const setItem = localStorage.setItem.bind(localStorage)

    vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === IMPORT_DISCARDED_EQUIPMENT_COUNT_KEY) {
        throw new DOMException('quota', 'QuotaExceededError')
      }

      setItem(key, value)
    })

    let result: boolean | undefined

    expect(() => {
      result = importSaveRaw(JSON.stringify(imported))
    }).not.toThrow()
    expect(result).toBe(false)
    expect(getRawSave()).toBe(VALID_RAW)
    expect(localStorage.getItem(BACKUP_KEY)).toBe(previousBackup)
  })
})
