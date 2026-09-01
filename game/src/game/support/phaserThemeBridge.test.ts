import { describe, it, expect } from 'vitest'
import { THEME_TINT_MAP, getTintForTheme } from './phaserThemeBridge'

describe('phaserThemeBridge', () => {
  it('THEME_TINT_MAP has 5 entries', () => {
    expect(Object.keys(THEME_TINT_MAP)).toHaveLength(5)
  })

  it('getTintForTheme returns a number for known theme', () => {
    const tint = getTintForTheme('ink-minimal')
    expect(typeof tint).toBe('number')
    expect(tint).toBeGreaterThan(0)
  })

  it('getTintForTheme falls back to 0xffffff for unknown', () => {
    const tint = getTintForTheme('unknown')
    expect(tint).toBe(0xffffff)
  })
})
