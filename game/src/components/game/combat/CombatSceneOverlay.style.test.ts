// @vitest-environment node
// T8.1 (2026-09-02) — style-contract: khôi phục styles bị mất của
// CombatSceneOverlay (root cause: 991ba75 xóa <style scoped>).
// jsdom/vitest KHÔNG apply scoped CSS runtime → assert SOURCE SFC
// (pattern source-contract, đọc file thật qua import query — vitest
// hỗ trợ ?raw): 4 selector + properties chính, chống regression tái diễn.
//
// Combat Art Pipeline Task 7 (2026-09-05, spec §7.5) — Build HUD +
// TurnCombatSkillBar rời battlefield slot vào CombatSkillDockPanel
// (dock mép phải). Rules __build-hud/__turn-skill-bar + media guard
// padding-left 210px KHÔNG còn ở overlay — contract cập nhật theo;
// dock tự bảo quản style của nó.
import { describe, expect, it } from 'vitest'
import source from './CombatSceneOverlay.vue?raw'

function styleBlock(): string {
  const match = /<style[^>]*>([\s\S]*?)<\/style>/.exec(source)

  if (!match) {
    throw new Error('CombatSceneOverlay.vue KHÔNG có <style> block — đây chính là regression 991ba75!')
  }

  return match[1]!
}

function ruleOf(selector: string): string {
  const style = styleBlock()
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'm')
  const match = regex.exec(style)

  if (!match) {
    throw new Error(`Selector "${selector}" không tồn tại trong style block`)
  }

  return match[1]!
}

describe('CombatSceneOverlay — style contract (T8.1)', () => {
  it('SFC có <style> block (regression guard chính — 991ba75 từng xóa)', () => {
    expect(styleBlock()).not.toBe('')
  })

  it('root: absolute + inset 0 + z-15 + pointer-events none (phủ canvas)', () => {
    const rule = ruleOf('.combat-scene-overlay')

    expect(rule).toContain('position: absolute')
    expect(rule).toContain('inset: 0')
    expect(rule).toContain('z-index: 15')
    expect(rule).toContain('pointer-events: none')
  })

  it('top-bar: height var (bar DOM duy nhất còn lại)', () => {
    const rule = ruleOf('.combat-scene-overlay__top-bar')

    expect(rule).toContain('height: var(--combat-topbar-h)')
  })

  it('battlefield: relative + flex 1 (vùng chứa 2 panel)', () => {
    const rule = ruleOf('.combat-scene-overlay__battlefield')

    expect(rule).toContain('position: relative')
    expect(rule).toContain('flex: 1 1 auto')
    expect(rule).toContain('pointer-events: none')
  })

  it('AI panel (bảng chọn mục tiêu): absolute + left/top var + z-12', () => {
    const rule = ruleOf('.combat-scene-overlay__ai-panel')

    expect(rule).toContain('position: absolute')
    expect(rule).toContain('left: var(--space-3)')
    expect(rule).toContain('top: var(--space-3)')
    expect(rule).toContain('z-index: 12')
  })

  it('Build HUD + turn skill bar KHÔNG còn ở overlay (Task 7 — đã vào dock)', () => {
    const style = styleBlock()

    expect(style).not.toContain('.combat-scene-overlay__build-hud')
    expect(style).not.toContain('.combat-scene-overlay__turn-skill-bar')
  })
})
