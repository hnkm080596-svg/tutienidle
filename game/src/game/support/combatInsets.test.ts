// 6A-T3 (2026-09-01) — insets TOP-ONLY: bottom bars (Status/Event/Control)
// rời DOM để vào canvas (PlayerHudLayer) — bottom inset luôn 0.
import { describe, expect, it, afterEach } from 'vitest'
import {
  setCombatInsets,
  resetCombatInsets,
  getCombatInsets,
  getFallbackCombatInsets,
} from './combatInsets'

afterEach(() => {
  resetCombatInsets()
})

describe('combatInsets — top-only (6A-T3)', () => {
  it('setCombatInsets ép bottom = 0 bất kể giá trị传入', () => {
    setCombatInsets({ top: 100, bottom: 999 })

    const insets = getCombatInsets()

    expect(insets.measured).toBe(true)
    expect(insets.top).toBe(100)
    expect(insets.bottom).toBe(0)
  })

  it('bottom âm cũng kẹp 0; top âm kẹp 0', () => {
    setCombatInsets({ top: -5, bottom: -3 })

    const insets = getCombatInsets()

    expect(insets.top).toBe(0)
    expect(insets.bottom).toBe(0)
  })

  it('fallback: bottom luôn 0, top vẫn tính theo tỷ lệ', () => {
    const fallback = getFallbackCombatInsets(1080)

    expect(fallback.top).toBe((1080 * (64 + 56)) / 1440)
    expect(fallback.bottom).toBe(0)
  })

  it('reset về measured=false để scene dùng fallback', () => {
    setCombatInsets({ top: 10, bottom: 0 })
    resetCombatInsets()

    const insets = getCombatInsets()

    expect(insets.measured).toBe(false)
    expect(insets.top).toBe(0)
  })
})
