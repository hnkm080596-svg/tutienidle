import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useThemeStore } from './themeStore'
import type { ThemeId } from '@/assets/themes'

// environment node — polyfill localStorage tối thiểu (cùng pattern
// SaveSystem.test.ts / uiScale.test.ts).
class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  get length() { return this.store.size }
  clear(): void { this.store.clear() }
  getItem(key: string): string | null { return this.store.get(key) ?? null }
  setItem(key: string, value: string): void { this.store.set(key, value) }
  removeItem(key: string): void { this.store.delete(key) }
  key(index: number): string | null { return Array.from(this.store.keys())[index] ?? null }
}

describe('themeStore', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage())
    setActivePinia(createPinia())
  })

  it('defaults to "default" theme', () => {
    const store = useThemeStore()
    expect(store.currentTheme).toBe('default')
  })

  it('setTheme updates currentTheme', () => {
    const store = useThemeStore()
    store.setTheme('ink-minimal' as ThemeId)
    expect(store.currentTheme).toBe('ink-minimal')
  })

  it('setTheme persists to localStorage', () => {
    const store = useThemeStore()
    store.setTheme('xianxia-glow' as ThemeId)
    expect(localStorage.getItem('theme')).toBe('xianxia-glow')
  })

  it('rejects unknown theme ids', () => {
    const store = useThemeStore()
    // @ts-expect-error testing invalid input
    store.setTheme('unknown-theme')
    expect(store.currentTheme).toBe('default')
  })
})
