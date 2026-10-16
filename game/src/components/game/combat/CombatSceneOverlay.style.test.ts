// @vitest-environment node
// T8.1 (2026-09-02) - style-contract: khoi phuc styles bi mat cua
// CombatSceneOverlay (root cause: 991ba75 xoa <style scoped>).
// jsdom/vitest KHONG apply scoped CSS runtime -> assert SOURCE SFC
// (pattern source-contract, doc file that qua import query - vitest
// ho tro ?raw): 4 selector + properties chinh, chong regression tai dien.
//
// Combat Art Pipeline Task 7 (2026-09-05, spec sec7.5) - Build HUD +
// TurnCombatSkillBar roi battlefield slot vao CombatSkillDockPanel
// (dock mep phai). Rules __build-hud/__turn-skill-bar + media guard
// padding-left 210px KHONG con o overlay - contract cap nhat theo;
// dock tu bao quan style cua no.
import { describe, expect, it } from 'vitest'
import source from './CombatSceneOverlay.vue?raw'
import panelSource from '@/components/scenes/combat/CombatPanel.vue?raw'
import canvasSource from '@/components/common/SceneDesignCanvas.vue?raw'
import { GAME_UI_WIDTH, GAME_UI_HEIGHT } from '@/presentation/geometry/GameUiFrame'

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
  const regex = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'gm')
  const matches = [...style.matchAll(regex)]
  const match = matches.at(-1)

  if (!match) {
    throw new Error(`Selector "${selector}" không tồn tại trong style block`)
  }

  const declarations = new Map<string, string>()
  for (const rule of matches) {
    for (const declaration of rule[1]!.split(';')) {
      const colon = declaration.indexOf(':')
      if (colon < 0) continue
      declarations.set(declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim())
    }
  }
  return [...declarations].map(([name, value]) => `${name}: ${value}`).join('; ')
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

  it('battlefield fills the shared design canvas without intercepting pointer input', () => {
    const rule = ruleOf('.combat-scene-overlay__battlefield')

    expect(rule).toContain('position: absolute')
    expect(rule).toContain('inset: 0')
    expect(rule).toContain('pointer-events: none')
    expect(panelSource).toContain('<SceneDesignCanvas overlay')
    expect(canvasSource).toContain('width: GAME_UI_WIDTH, height: GAME_UI_HEIGHT')
    expect(GAME_UI_WIDTH / GAME_UI_HEIGHT).toBe(16 / 9)
    expect(canvasSource).toContain('Math.min(width / props.width, height / props.height)')
  })

  it('AI panel uses fixed coordinates inside the shared design canvas', () => {
    const rule = ruleOf('.combat-scene-overlay__ai-panel')

    expect(rule).toContain('position: absolute')
    expect(rule).toContain('right: 248px')
    // The last authored selector wins inside the shared design canvas.
    expect(rule).toContain('top: 68px')
    expect(rule).toContain('width: 210px')
    expect(rule).toContain('z-index: 12')
    expect(ruleOf('.combat-scene-overlay__turn-order-strip')).toContain('left: 50%')
    expect(ruleOf('.combat-scene-overlay__turn-order-strip')).toContain('translateX(-50%)')
  })

  it('Build HUD + turn skill bar KHÔNG còn ở overlay (Task 7 — đã vào dock)', () => {
    const style = styleBlock()

    expect(style).not.toContain('.combat-scene-overlay__build-hud')
    expect(style).not.toContain('.combat-scene-overlay__turn-skill-bar')
  })
})
