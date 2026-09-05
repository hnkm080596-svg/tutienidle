// @vitest-environment jsdom
//
// Enemy art x2 (yÃªu cáº§u 2026-08-26): PNG quÃ¡i hiá»ƒn thá»‹ Gáº¤P ÄÃ”I â€” chiá»u
// cao cuá»‘i = base Ã— depthScale Ã— ENEMY_DISPLAY_SCALE_MULTIPLIER (2),
// ÃP Cáº¢ CHO BOSS. Multiplier chá»‰ nhÃ¢n Má»˜T Láº¦N táº¡i applyEntityDepthScale
// (resize gá»i láº¡i khÃ´ng cá»™ng dá»“n), spawn fade-in tween káº¿t thÃºc Ä‘Ãºng
// kÃ­ch thÆ°á»›c x2. Fallback Rectangle giá»¯ kÃ­ch thÆ°á»›c cÅ© (Ã—1).
import { describe, expect, it } from 'vitest'
import { createTestScene } from './combat/combatTestHarness'
import { ENEMY_SOURCE_SIZE } from '../support/EnemyArt'

function createScene() {
  const scene = createTestScene('bare')

  scene.renderMode = 'perspective'
  scene.projection = undefined
  scene.characterWidth = 40
  scene.characterHeight = 50
  scene.playerSourceSize = { w: 1244, h: 1264 }

  return scene
}

interface SizeRecordingRect {
  calls: Array<[number, number]>

  setDisplaySize(width: number, height: number): this
}

function makeEnemySprite(kind: 'sprite' | 'rect') {
  const calls: Array<[number, number]> = []

  const rect = {
    width: 0,

    height: 0,

    updateDisplayOrigin() {
      return this
    },

    setDisplaySize(width: number, height: number) {
      calls.push([width, height])

      return this
    },
  }

  // any-cÃ³-chá»§ Ä‘Ã­ch: stub EntitySprite cho method private any-typed
  // (Object.create pattern) â€” khÃ´ng cáº§n khá»›p interface Ä‘áº§y Ä‘á»§.
  const sprite: any = {
    kind,
    rect,
    row: 4,
    sourceSize: kind === 'sprite' ? { ...ENEMY_SOURCE_SIZE } : undefined,
    // ENEMY_DISPLAY_SCALE_MULTIPLIER â€” giÃ¡ trá»‹ production cá»§a enemy PNG.
    sizeMultiplier: kind === 'sprite' ? 2 : 1,
    boost: { value: 1 },
    shadow: undefined,
    healthBar: undefined,
  }

  return { sprite, calls }
}

describe('CombatScene â€” ENEMY_DISPLAY_SCALE_MULTIPLIER Ã—2', () => {
  it('enemy PNG cao Ä‘Ãºng base Ã— depthScale Ã— 2', () => {
    const scene = createScene()
    const { sprite, calls } = makeEnemySprite('sprite')

    scene.applyEntityDepthScale(sprite, 0.8)

    expect(calls).toHaveLength(1)
    expect(calls[0]![1]).toBeCloseTo(50 * 0.8 * 2, 5)

    // Aspect ratio nguá»“n giá»¯ nguyÃªn (PNG vuÃ´ng 1254Â² â†’ width === height).
    expect(calls[0]![0]).toBeCloseTo(calls[0]![1], 5)
  })

  it("Boss renders at 2× a regular enemy's size (2026-09-05: no longer the same ×2 rule)", () => {
    const scene = createScene()
    const { sprite, calls } = makeEnemySprite('sprite')

    const barPart = () => {
      const part = {
        setScale() {
          return part
        },

        setSize() {
          return part
        },

        updateDisplayOrigin() {
          return part
        },
      }

      return part
    }

    sprite.healthBar = {
      background: barPart(),
      fill: barPart(),
      width: 42,
      currentHp: 100,
      maxHp: 100,
      isBoss: true,
    }
    // BOSS_DISPLAY_SCALE_MULTIPLIER — set tại thời điểm tạo sprite trong
    // combat-grid-view.ts, không phải bên trong applyEntityDepthScale()
    // (hàm này chỉ nhân lại giá trị sizeMultiplier có sẵn trên sprite).
    sprite.sizeMultiplier = 4

    scene.applyEntityDepthScale(sprite, 1)

    expect(calls[0]![1]).toBeCloseTo(50 * 1 * 4, 5)
  })

  it('resize gá»i láº¡i KHÃ”NG cá»™ng multiplier láº·p â€” cÃ¹ng input ra cÃ¹ng kÃ­ch thÆ°á»›c', () => {
    const scene = createScene()
    const { sprite, calls } = makeEnemySprite('sprite')

    scene.applyEntityDepthScale(sprite, 0.8)
    scene.applyEntityDepthScale(sprite, 0.8)
    scene.applyEntityDepthScale(sprite, 0.8)

    expect(calls).toHaveLength(3)
    expect(new Set(calls.map(([width, height]) => `${width}x${height}`)).size).toBe(1)
    expect(calls[0]![1]).toBeCloseTo(80, 5)
  })

  it('spawn fade-in tween (boost 0.7â†’1) káº¿t thÃºc Ä‘Ãºng kÃ­ch thÆ°á»›c Ã—2', () => {
    const scene = createScene()
    const { sprite, calls } = makeEnemySprite('sprite')

    sprite.shadow = {
      sizes: [],

      setSize(width: number, height: number) {
        sprite.shadow!.sizes.push([width, height])

        return sprite.shadow
      },
    }

    // playMaterializeFadeIn Ä‘áº·t boost 0.7 rá»“i tween vá» 1 â€” má»—i bÆ°á»›c
    // projection ghi láº¡i kÃ­ch thÆ°á»›c tuyá»‡t Ä‘á»‘i (khÃ´ng nhÃ¢n dá»“n).
    sprite.boost.value = 0.7
    scene.applyEntityDepthScale(sprite, 0.8)
    expect(calls[0]![1]).toBeCloseTo(50 * 0.8 * 0.7 * 2, 5)

    sprite.boost.value = 1
    scene.applyEntityDepthScale(sprite, 0.8)
    expect(calls.at(-1)![1]).toBeCloseTo(50 * 0.8 * 2, 5)

    // BÃ³ng ellipse co giÃ£n theo cÃ¹ng nhÃ¢n sá»‘ Ã—2 (SHADOW_WIDTH_RATIO 1.12).
    expect(sprite.shadow.sizes.at(-1)![0]).toBeCloseTo(40 * 0.8 * 2 * 1.12, 5)
  })

  it('fallback Rectangle giá»¯ kÃ­ch thÆ°á»›c cÅ© Ã—1', () => {
    const scene = createScene()

    const updates: Array<{ width?: number; height?: number }> = []

    const enemyRect = {
      width: 0,
      height: 0,
      updateDisplayOrigin() {
        updates.push({ width: this.width, height: this.height })
      },
    }

    const sprite = {
      kind: 'rect',
      rect: enemyRect,
      row: 4,
      sizeMultiplier: 1,
      boost: { value: 1 },
      shadow: undefined,
      healthBar: undefined,
    }

    scene.applyEntityDepthScale(sprite, 0.8)

    expect(enemyRect.height).toBeCloseTo(50 * 0.8, 5)
  })
})
