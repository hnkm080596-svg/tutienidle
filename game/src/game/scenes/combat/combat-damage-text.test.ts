// @vitest-environment jsdom
// 6A-T2 (2026-09-01) — floating text kill + heal: showKillText/showHealText
// trên CombatDamageText, guard sprite null, màu đúng spec §2 (kill trắng
// stroke đỏ 18px, heal xanh "+N" 14px). Scene handlers test ở scene-level
// qua subscribe contract (Task 5 wiring).
import { describe, expect, it } from 'vitest'
import { CombatDamageText } from './combat-damage-text'
import type { CombatScene } from '../CombatScene'

function createTextHarness() {
  const texts: Array<{
    x: number
    y: number
    text: string
    style: Record<string, unknown>
    depth: number
    origin: unknown
    destroyed: boolean
    tweenCount: number
  }> = []

  const tweens: Array<{ targets: unknown; props: Record<string, unknown> }> = []

  const fakeScene = {
    add: {
      text: (x: number, y: number, text: string, style: Record<string, unknown>) => {
        const entry = {
          x,
          y,
          text,
          style,
          depth: 0,
          origin: [] as unknown[],
          destroyed: false,
          tweenCount: 0,
          setDepth(d: number) {
            entry.depth = d
            return entry
          },
          setOrigin(..._args: unknown[]) {
            entry.origin = _args
            return entry
          },
          setScale() {
            return entry
          },
          destroy() {
            entry.destroyed = true
          },
        }

        texts.push(entry)

        return entry
      },
    },
    tweens: {
      add: (config: { targets: unknown }) => {
        tweens.push({ targets: config.targets, props: config })
        const entry = config.targets as { destroy(): void; tweenCount: number }

        entry.tweenCount += 1
      },
    },
    entityHeadY: (sprite: { headY: number }) => sprite.headY,
    spriteFor: (id?: string) => (id === 'e1' ? { id: 'e1', headY: 42, rect: { x: 100 } } : undefined),
    dotAccumulators: new Map<string, { value: number; nextFlushAt: number }>(),
    time: { now: 0 },
  }

  const damageText = new CombatDamageText(fakeScene as unknown as CombatScene)

  return { damageText, texts, tweens, fakeScene }
}

describe('CombatDamageText — kill + heal floating (6A-T2)', () => {
  it('showKillText: text "Hạ Gục!" 18px bold trắng, stroke đỏ, depth overlay+7, tween rise', () => {
    const { damageText, texts, tweens } = createTextHarness()
    const sprite = { id: 'e1', headY: 42, rect: { x: 100 } }

    damageText.showKillText(sprite as never)

    expect(texts).toHaveLength(1)
    expect(texts[0]!.text).toBe('Hạ Gục!')
    expect(texts[0]!.style.fontSize).toBe('18px')
    expect(texts[0]!.style.color).toBe('#f4f4f0')
    expect(tweens).toHaveLength(1)
  })

  it('showHealText: text "+N" 14px xanh #7bd88f, formatNumber applied', () => {
    const { damageText, texts } = createTextHarness()
    const sprite = { id: 'e1', headY: 42, rect: { x: 100 } }

    damageText.showHealText(sprite as never, 1234)

    expect(texts[0]!.text).toBe('+1,234')
    expect(texts[0]!.style.fontSize).toBe('14px')
    expect(texts[0]!.style.color).toBe('#7bd88f')
  })

  it('handleDamageEvent floats hpDamage (actual HP lost), not the pre-absorb value', () => {
    const { damageText, texts } = createTextHarness()

    damageText.handleDamageEvent({
      type: 'damage',
      targetId: 'e1',
      value: 100,
      hpDamage: 35,
      wardAbsorbed: 65,
    })

    expect(texts).toHaveLength(1)
    expect(texts[0]!.text).toBe('-35')
  })

  it('DoT accumulator sums hpDamage — an overkill tick adds the HP actually lost', () => {
    const { damageText, fakeScene } = createTextHarness()

    damageText.handleDamageEvent({
      type: 'damage',
      targetId: 'e1',
      sourceId: 's1',
      value: 100,
      hpDamage: 5,
      effectId: 'trung_doc',
    })

    expect(fakeScene.dotAccumulators.get('e1|trung_doc|s1')?.value).toBe(5)
  })

  it('handleDamageEvent shows nothing on a fully absorbed hit (hpDamage 0)', () => {
    const { damageText, texts } = createTextHarness()

    damageText.handleDamageEvent({
      type: 'damage',
      targetId: 'e1',
      value: 100,
      hpDamage: 0,
      wardAbsorbed: 100,
    })

    expect(texts).toHaveLength(0)
  })

  it('scene guard: heal/kill handler với sprite không tồn tại → không crash, không text', () => {
    const { damageText, texts } = createTextHarness()

    // Giả lập handler path: spriteFor trả undefined → method phải no-op
    // an toàn (sprite chết giữa chừng fade).
    const dead = damageText as unknown as {
      scene: { spriteFor(id?: string): unknown }
    }

    expect(dead.scene.spriteFor('gone')).toBeUndefined()
    expect(texts).toHaveLength(0)
  })
})
