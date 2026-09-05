// @vitest-environment jsdom
//
// Renderer 2.5D (plan Â§12.1): avatar Player Lá»šN Gáº¤P ÄÃ”I enemy â€” cÃ¹ng
// depth scale thÃ¬ kÃ­ch thÆ°á»›c cuá»‘i = baseline Ã— depthScale Ã— sizeMultiplier,
// vá»›i sizeMultiplier chá»‰ Ã¡p lÃªn PLAYER sprite (enemy/VFX footprint giá»¯
// nguyÃªn), bÃ³ng ellipse dÆ°á»›i chÃ¢n co giÃ£n theo nhÃ¢n sá»‘ nhÃ¢n.
import { describe, expect, it } from 'vitest'
import { createTestScene } from './combat/combatTestHarness'

function createScene() {
  const scene = createTestScene('bare')

  scene.renderMode = 'perspective'
  scene.projection = undefined
  scene.characterWidth = 40
  scene.characterHeight = 50
  scene.playerSourceSize = { w: 1244, h: 1264 }
  scene.playerProfileId = 'mortal'

  return scene
}

describe('CombatScene â€” PLAYER_DISPLAY_SCALE_MULTIPLIER (plan Â§12.1)', () => {
  it('player sprite Ã—2: chiá»u cao = characterHeight Ã— depthScale Ã— 2', () => {
    const scene = createScene()

    const setSizeCalls: Array<[number, number]> = []

    const playerSprite = {
      kind: 'sprite',
      rect: {
        setDisplaySize(width: number, height: number) {
          setSizeCalls.push([width, height])

          return this
        },
      },
      row: 4,
      sizeMultiplier: 2,
      boost: { value: 1 },
      shadow: undefined,
      healthBar: undefined,
    }

    scene.applyEntityDepthScale(playerSprite, 0.8)

    expect(setSizeCalls).toHaveLength(1)
    expect(setSizeCalls[0]![1]).toBeCloseTo(50 * 0.8 * 2, 5)
  })

  it('enemy rectangle Ã—1: KHÃ”NG bá»‹ nhÃ¢n Ä‘Ã´i footprint', () => {
    const scene = createScene()

    const updates: Array<{ width?: number; height?: number }> = []

    const enemyRect = {
      width: 0,
      height: 0,
      updateDisplayOrigin() {
        updates.push({ width: this.width, height: this.height })
      },
    }

    const enemySprite = {
      kind: 'rect',
      rect: enemyRect,
      row: 4,
      sizeMultiplier: 1,
      boost: { value: 1 },
      shadow: undefined,
      healthBar: undefined,
    }

    scene.applyEntityDepthScale(enemySprite, 0.8)

    expect(enemyRect.width).toBeCloseTo(40 * 0.8 * 1, 5)
    expect(enemyRect.height).toBeCloseTo(50 * 0.8 * 1, 5)
  })

  it('shadow ellipse cá»§a player co giÃ£n theo Ã—2, cá»§a enemy giá»¯ Ã—1', () => {
    const scene = createScene()

    const setSizeCalls: Array<[number, number]> = []

    const makeShadow = () => ({
      setSize(width: number, height: number) {
        setSizeCalls.push([width, height])

        return this
      },
    })

    const playerSprite = {
      kind: 'sprite',
      rect: { setDisplaySize: () => undefined },
      row: 4,
      sizeMultiplier: 2,
      boost: { value: 1 },
      shadow: makeShadow(),
      healthBar: undefined,
    }

    scene.applyEntityDepthScale(playerSprite, 1)

    // SHADOW_WIDTH_RATIO = 1.12.
    expect(setSizeCalls[0]![0]).toBeCloseTo(40 * 1 * 2 * 1.12, 5)

    setSizeCalls.length = 0

    const enemyShadow = makeShadow()
    const enemyRect = {
      width: 0,
      height: 0,
      updateDisplayOrigin() {
        return this
      },
    }

    const enemySprite = {
      kind: 'rect',
      rect: enemyRect,
      row: 4,
      sizeMultiplier: 1,
      boost: { value: 1 },
      shadow: enemyShadow,
      healthBar: undefined,
    }

    scene.applyEntityDepthScale(enemySprite, 1)

    expect(setSizeCalls[0]![0]).toBeCloseTo(40 * 1 * 1 * 1.12, 5)
  })
})
