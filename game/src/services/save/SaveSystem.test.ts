import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loadGame,
  deleteSave,
  backupCurrentSave,
  hasBackup,
  restoreBackup,
  getRawSave,
  importSaveRaw,
  SAVE_REVISION_KEY,
  CURRENT_SAVE_VERSION,
} from './SaveSystem'
import { createDefaultPlayer } from '../../core/player/Player'

const SAVE_KEY = 'tien-hiep-idle-save'
const BACKUP_KEY = 'tien-hiep-idle-save-backup'

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
function validSave(): Record<string, unknown> {
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

  it('ok với optional fields vắng mặt (productionSites/alchemyJobs/quests)', () => {
    const save = validSave()

    delete save.productionSites
    delete save.alchemyJobs
    delete save.quests

    localStorage.setItem(SAVE_KEY, JSON.stringify(save))

    expect(loadGame().status).toBe('ok')
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
  })

  it('chấp nhận save nguyên shape đúng version hiện hành', () => {
    const raw = JSON.stringify(validSave())

    expect(importSaveRaw(raw)).toBe(true)
    expect(getRawSave()).toBe(raw)
  })
})
