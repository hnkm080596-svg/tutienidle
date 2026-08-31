import { describe, it, expect } from 'vitest'
import { THEME_REGISTRY, type ThemeId } from './index'

describe('theme registry', () => {
  it('contains 5 themes', () => {
    expect(THEME_REGISTRY).toHaveLength(5)
  })

  it('all themes have unique id', () => {
    const ids = THEME_REGISTRY.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('default theme is first', () => {
    expect(THEME_REGISTRY[0]?.id).toBe('default')
  })

  it('every theme has label and preview svg data', () => {
    for (const theme of THEME_REGISTRY) {
      expect(theme.label).toBeTruthy()
      expect(theme.preview).toMatch(/^data:image\/svg\+xml/)
    }
  })
})
