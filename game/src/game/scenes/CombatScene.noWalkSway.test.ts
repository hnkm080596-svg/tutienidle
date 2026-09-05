// @vitest-environment jsdom
//
// Walk sway Ä‘Ã£ XÃ“A Háº´N (yÃªu cáº§u 2026-08-26 â€” "khÃ´ng dÃ¹ng flag táº¡m thá»i,
// xÃ³a háº³n Ä‘á»ƒ trÃ¡nh quay láº¡i lá»—i cÅ©"): positionSprite chá»‰ cÃ²n tá»a Ä‘á»™
// projection/interpolation + action offset (lunge/recoil) + rotation cá»§a
// death animation. Test nÃ y khÃ³a hÃ nh vi: di chuyá»ƒn bÃ¬nh thÆ°á»ng KHÃ”NG
// BAO GIá»œ sinh offset/bob/tilt â€” rotation luÃ´n 0, vá»‹ trÃ­ bÃ¡m Ä‘Ãºng Ä‘iá»ƒm
// chiáº¿u.
import { describe, expect, it } from 'vitest'
import { createTestScene } from './combat/combatTestHarness'

function chainableRect() {
  const state = {
    rotation: 123 as number,

    positions: [] as Array<{ x: number; y: number }>,

    setRotation(value: number) {
      state.rotation = value

      return state
    },

    setPosition(x: number, y: number) {
      state.positions.push({ x, y })

      return state
    },

    setDisplaySize() {
      return state
    },

    setScale(_value: number) {
      return state
    },
  }

  return state
}

function createScene(renderMode: 'flat' | 'perspective') {
  const scene = createTestScene('bare')

  scene.renderMode = renderMode
  scene.projection = {
    gridToScreen(row: number, column: number) {
      // Äiá»ƒm chiáº¿u tuyáº¿n tÃ­nh theo column â€” mÃ´ phá»ng unit Ä‘ang Ä‘i.
      return { x: 100 + column * 10, y: 200 + row * 5, scale: 1 }
    },
  }
  scene.dyingIds = new Set<string>()

  const rect = chainableRect()

  const sprite = {
    kind: 'sprite',
    rect,
    label: { setPosition: () => undefined },
    color: 0xffffff,
    offsetX: 0,
    row: 2,
    sizeMultiplier: 1,
    boost: { value: 1 },
    footY: 0,
    columnFloat: 0,
    shadow: undefined,
    healthBar: undefined,
    sourceSize: { w: 1254, h: 1254 },
  }

  return { scene, sprite, rect }
}

describe('CombatScene â€” walk sway bá»‹ xÃ³a hoÃ n toÃ n', () => {
  it('di chuyá»ƒn liÃªn tá»¥c: rotation giá»¯ nguyÃªn, khÃ´ng bao giá» bá»‹ xoay', () => {
    const { scene, sprite, rect } = createScene('perspective')

    // Sentinel 123 rad â€” má»i lá»‡nh setRotation ngoÃ i death tween Ä‘á»u lá»™.
    for (let frame = 0; frame < 40; frame++) {
      scene.positionSprite(sprite, frame * 0.25, 'enemy_walk')
    }

    expect(rect.rotation).toBe(123)
  })

  it('vá»‹ trÃ­ bÃ¡m Ä‘Ãºng Ä‘iá»ƒm chiáº¿u (khÃ´ng cá»™ng sway/bob), footY cáº­p nháº­t', () => {
    const { scene, sprite, rect } = createScene('perspective')

    for (let column = -3; column <= 3; column += 0.5) {
      scene.positionSprite(sprite, column, 'enemy_walk')

      const last = rect.positions.at(-1)!

      expect(last.x).toBe(100 + column * 10)

      expect(last.y).toBe(210)
    }

    expect(sprite.footY).toBe(210)

    expect(sprite.columnFloat).toBe(3)
  })

  it('action offset (lunge) váº«n hoáº¡t Ä‘á»™ng â€” nhÃ¢n depth scale, váº«n khÃ´ng xoay', () => {
    const { scene, sprite, rect } = createScene('perspective')

    sprite.offsetX = 8

    scene.positionSprite(sprite, 0, 'enemy_lunge')

    expect(rect.positions[0]).toEqual({ x: 108, y: 210 })

    expect(rect.rotation).toBe(123)
  })

  it('flat mode: vá»‹ trÃ­ tháº³ng, khÃ´ng xoay, boost Ã¡p qua setScale', () => {
    const { scene, sprite, rect } = createScene('flat')

    const scales: number[] = []

    rect.setScale = (value: number) => {
      scales.push(value)

      return rect
    }

    sprite.boost.value = 1

    scene.positionSprite(sprite, 2, 'enemy_flat')

    expect(rect.positions[0]).toEqual({ x: 120, y: 210 })

    expect(scales).toEqual([1])
  })
})
