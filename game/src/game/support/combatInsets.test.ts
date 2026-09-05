// 6A-T3 (2026-09-01) — insets TOP-ONLY: bottom bars (Status/Event/Control)
// rời DOM để vào canvas (PlayerHudLayer) — bottom inset luôn 0.
//
// Combat Art Pipeline Task 7 (2026-09-05, spec §7.5) — thêm 2 publisher
// chuyên biệt: TopBar (overlay) chỉ ghi `top`, skill dock panel chỉ ghi
// `right` — mỗi publisher GIỮ NGUYÊN trường của publisher còn lại.
import { describe, expect, it, afterEach } from 'vitest'
import {
  clearSkillDockWidth,
  publishSkillDockWidth,
  publishTopBarHeight,
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
    setCombatInsets({ top: 100, bottom: 999, right: 0 })

    const insets = getCombatInsets()

    expect(insets.measured).toBe(true)
    expect(insets.top).toBe(100)
    expect(insets.bottom).toBe(0)
  })

  it('bottom âm cũng kẹp 0; top âm kẹp 0', () => {
    setCombatInsets({ top: -5, bottom: -3, right: 0 })

    const insets = getCombatInsets()

    expect(insets.top).toBe(0)
    expect(insets.bottom).toBe(0)
  })

  it('fallback: bottom luôn 0, top vẫn tính theo tỷ lệ', () => {
    const fallback = getFallbackCombatInsets(1080)

    expect(fallback.top).toBe((1080 * (64 + 56)) / 1440)
    expect(fallback.bottom).toBe(0)
    expect(fallback.right).toBe(0)
  })

  it('reset về measured=false để scene dùng fallback', () => {
    setCombatInsets({ top: 10, bottom: 0, right: 0 })
    resetCombatInsets()

    const insets = getCombatInsets()

    expect(insets.measured).toBe(false)
    expect(insets.top).toBe(0)
  })

  it('right: đo được truyền thẳng, kẹp âm về 0', () => {
    setCombatInsets({ top: 0, bottom: 0, right: 320 })

    expect(getCombatInsets().right).toBe(320)

    setCombatInsets({ top: 0, bottom: 0, right: -10 })

    expect(getCombatInsets().right).toBe(0)
  })
})

describe('combatInsets — dedicated publishers (Task 7, spec §7.5)', () => {
  afterEach(() => {
    resetCombatInsets()
  })

  it('publishTopBarHeight chỉ ghi top, giữ nguyên right của dock', () => {
    publishSkillDockWidth(360)
    publishTopBarHeight(64)

    const insets = getCombatInsets()

    expect(insets.measured).toBe(true)
    expect(insets.top).toBe(64)
    expect(insets.right).toBe(360)
  })

  it('publishSkillDockWidth chỉ ghi right, giữ nguyên top của TopBar', () => {
    publishTopBarHeight(64)
    publishSkillDockWidth(360)

    const insets = getCombatInsets()

    expect(insets.measured).toBe(true)
    expect(insets.top).toBe(64)
    expect(insets.right).toBe(360)
  })

  it('publishSkillDockWidth kẹp âm về 0', () => {
    publishTopBarHeight(64)
    publishSkillDockWidth(-10)

    expect(getCombatInsets().right).toBe(0)
  })

  it('clearSkillDockWidth về 0 nhưng giữ top', () => {
    publishTopBarHeight(64)
    publishSkillDockWidth(360)
    clearSkillDockWidth()

    const insets = getCombatInsets()

    expect(insets.measured).toBe(true)
    expect(insets.top).toBe(64)
    expect(insets.right).toBe(0)
  })
})
