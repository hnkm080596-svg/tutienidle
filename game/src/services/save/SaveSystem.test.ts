import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loadGame,
  deleteSave,
  backupCurrentSave,
  hasBackup,
  restoreBackup,
  getRawSave,
  importSaveRaw,
} from './SaveSystem'

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

const VALID_RAW = JSON.stringify({ version: 37, player: { name: 'test' } })

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

describe('backup / restore', () => {
  it('deleteSave() sao lưu save hiện tại trước khi xoá', () => {
    localStorage.setItem(SAVE_KEY, VALID_RAW)

    expect(hasBackup()).toBe(false)

    deleteSave()

    expect(localStorage.getItem(SAVE_KEY)).toBeNull()
    expect(hasBackup()).toBe(true)
    expect(localStorage.getItem(BACKUP_KEY)).toBe(VALID_RAW)
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
})
