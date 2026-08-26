// @vitest-environment jsdom
//
// Renderer 2.5D (plan §12.1): avatar Player LỚN GẤP ĐÔI enemy — cùng
// depth scale thì kích thước cuối = baseline × depthScale × sizeMultiplier,
// với sizeMultiplier chỉ áp lên PLAYER sprite (enemy/VFX footprint giữ
// nguyên), bóng ellipse dưới chân co giãn theo nhân số nhân.
import { describe, expect, it } from 'vitest'
import { CombatScene } from './CombatScene'

function createScene() {
  const scene = Object.create(CombatScene.prototype) as any

  scene.renderMode = 'perspective'
  scene.projection = undefined
  scene.characterWidth = 40
  scene.characterHeight = 50
  scene.playerSourceSize = { w: 1244, h: 1264 }
  scene.playerProfileId = 'mortal'

  return scene
}

describe('CombatScene — PLAYER_DISPLAY_SCALE_MULTIPLIER (plan §12.1)', () => {
  it('player sprite ×2: chiều cao = characterHeight × depthScale × 2', () => {
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

  it('enemy rectangle ×1: KHÔNG bị nhân đôi footprint', () => {
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

  it('shadow ellipse của player co giãn theo ×2, của enemy giữ ×1', () => {
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
