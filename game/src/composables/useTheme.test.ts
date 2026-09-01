// game/src/composables/useTheme.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useThemeStore } from '@/stores/themeStore'
import { useTheme } from './useTheme'

describe('useTheme composable', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('exposes currentTheme from store', () => {
    const store = useThemeStore()
    store.setTheme('ink-minimal')
    const { currentTheme } = useTheme()
    expect(currentTheme.value).toBe('ink-minimal')
  })

  it('exposes all 5 themes', () => {
    const { themes } = useTheme()
    expect(themes).toHaveLength(5)
  })

  it('setTheme is a passthrough to store', () => {
    const { setTheme, currentTheme } = useTheme()
    setTheme('classical-imperial')
    expect(currentTheme.value).toBe('classical-imperial')
  })
})
