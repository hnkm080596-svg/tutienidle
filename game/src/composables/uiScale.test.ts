import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_UI_SCALE, UI_SCALE_OPTIONS, applyUiScale, initUiScale, loadUiScale, saveUiScale } from './uiScale'

const STORAGE_KEY = 'tien-hiep-idle-ui-scale'

// environment node — polyfill localStorage tối thiểu (cùng pattern
// SaveSystem.test.ts) + documentElement stub cho setProperty.
class MemoryStorage implements Storage {
  private store = new Map<string, string>()

  get length() { return this.store.size }
  clear(): void { this.store.clear() }
  getItem(key: string): string | null { return this.store.get(key) ?? null }
  setItem(key: string, value: string): void { this.store.set(key, value) }
  removeItem(key: string): void { this.store.delete(key) }
  key(index: number): string | null { return Array.from(this.store.keys())[index] ?? null }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  vi.stubGlobal('document', {
    documentElement: {
      style: {
        setProperty: vi.fn(),
      },
    },
  })
})

describe('uiScale (WS8)', () => {
  it('loadUiScale trả mặc định khi chưa từng lưu', () => {
    expect(loadUiScale()).toBe(DEFAULT_UI_SCALE)
  })

  it('saveUiScale lưu giá trị hợp lệ và áp vào :root', () => {
    saveUiScale(1.25)

    expect(localStorage.getItem(STORAGE_KEY)).toBe('1.25')
    expect(document.documentElement.style.setProperty).toHaveBeenCalledWith('--ui-scale', '1.25')
  })

  it('giá trị lạ từ storage bị kẹp về mặc định (không phá layout)', () => {
    localStorage.setItem(STORAGE_KEY, '7')

    expect(loadUiScale()).toBe(DEFAULT_UI_SCALE)
  })

  it('initUiScale đọc storage và áp ngay lúc boot', () => {
    localStorage.setItem(STORAGE_KEY, '0.9')

    initUiScale()

    expect(document.documentElement.style.setProperty).toHaveBeenCalledWith('--ui-scale', '0.9')
  })

  it('danh sách option đúng spec 90/100/110/125%', () => {
    expect([...UI_SCALE_OPTIONS]).toEqual([0.9, 1, 1.1, 1.25])
  })
})
