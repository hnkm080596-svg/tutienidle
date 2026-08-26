// @vitest-environment jsdom
//
// Enemy art x2 (yêu cầu 2026-08-26): PNG quái hiển thị GẤP ĐÔI — chiều
// cao cuối = base × depthScale × ENEMY_DISPLAY_SCALE_MULTIPLIER (2),
// ÁP CẢ CHO BOSS. Multiplier chỉ nhân MỘT LẦN tại applyEntityDepthScale
// (resize gọi lại không cộng dồn), spawn fade-in tween kết thúc đúng
// kích thước x2. Fallback Rectangle giữ kích thước cũ (×1).
import { describe, expect, it } from 'vitest'
import { CombatScene } from './CombatScene'
import { ENEMY_SOURCE_SIZE } from '../support/EnemyArt'

function createScene() {
  const scene = Object.create(CombatScene.prototype) as any

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

  // any-có-chủ đích: stub EntitySprite cho method private any-typed
  // (Object.create pattern) — không cần khớp interface đầy đủ.
  const sprite: any = {
    kind,
    rect,
    row: 4,
    sourceSize: kind === 'sprite' ? { ...ENEMY_SOURCE_SIZE } : undefined,
    // ENEMY_DISPLAY_SCALE_MULTIPLIER — giá trị production của enemy PNG.
    sizeMultiplier: kind === 'sprite' ? 2 : 1,
    boost: { value: 1 },
    shadow: undefined,
    healthBar: undefined,
  }

  return { sprite, calls }
}

describe('CombatScene — ENEMY_DISPLAY_SCALE_MULTIPLIER ×2', () => {
  it('enemy PNG cao đúng base × depthScale × 2', () => {
    const scene = createScene()
    const { sprite, calls } = makeEnemySprite('sprite')

    scene.applyEntityDepthScale(sprite, 0.8)

    expect(calls).toHaveLength(1)
    expect(calls[0]![1]).toBeCloseTo(50 * 0.8 * 2, 5)

    // Aspect ratio nguồn giữ nguyên (PNG vuông 1254² → width === height).
    expect(calls[0]![0]).toBeCloseTo(calls[0]![1], 5)
  })

  it('Boss áp CÙNG quy tắc ×2', () => {
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

    scene.applyEntityDepthScale(sprite, 1)

    // Kích thước sprite không phân biệt boss/thường — cùng ×2.
    expect(calls[0]![1]).toBeCloseTo(50 * 1 * 2, 5)
  })

  it('resize gọi lại KHÔNG cộng multiplier lặp — cùng input ra cùng kích thước', () => {
    const scene = createScene()
    const { sprite, calls } = makeEnemySprite('sprite')

    scene.applyEntityDepthScale(sprite, 0.8)
    scene.applyEntityDepthScale(sprite, 0.8)
    scene.applyEntityDepthScale(sprite, 0.8)

    expect(calls).toHaveLength(3)
    expect(new Set(calls.map(([width, height]) => `${width}x${height}`)).size).toBe(1)
    expect(calls[0]![1]).toBeCloseTo(80, 5)
  })

  it('spawn fade-in tween (boost 0.7→1) kết thúc đúng kích thước ×2', () => {
    const scene = createScene()
    const { sprite, calls } = makeEnemySprite('sprite')

    sprite.shadow = {
      sizes: [],

      setSize(width: number, height: number) {
        sprite.shadow!.sizes.push([width, height])

        return sprite.shadow
      },
    }

    // playMaterializeFadeIn đặt boost 0.7 rồi tween về 1 — mỗi bước
    // projection ghi lại kích thước tuyệt đối (không nhân dồn).
    sprite.boost.value = 0.7
    scene.applyEntityDepthScale(sprite, 0.8)
    expect(calls[0]![1]).toBeCloseTo(50 * 0.8 * 0.7 * 2, 5)

    sprite.boost.value = 1
    scene.applyEntityDepthScale(sprite, 0.8)
    expect(calls.at(-1)![1]).toBeCloseTo(50 * 0.8 * 2, 5)

    // Bóng ellipse co giãn theo cùng nhân số ×2 (SHADOW_WIDTH_RATIO 1.12).
    expect(sprite.shadow.sizes.at(-1)![0]).toBeCloseTo(40 * 0.8 * 2 * 1.12, 5)
  })

  it('fallback Rectangle giữ kích thước cũ ×1', () => {
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
