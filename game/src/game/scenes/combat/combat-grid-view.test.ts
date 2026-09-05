// @vitest-environment jsdom
//
// combat-grid-view.test.ts — regression thật cho Task 9.5: sprite-creation
// path (getOrCreateSprite) phải chọn ĐÚNG sizeMultiplier theo cờ isBoss của
// entity spawn, KHÔNG phải giá trị fixture gán tay như
// CombatScene.enemyScale.test.ts (test đó chỉ khoá applyEntityDepthScale()
// pass-through, không chạm production creation code — xem task-9-brief.md).
import { describe, expect, it, vi } from 'vitest'
import { CombatGridView } from './combat-grid-view'
import { BOSS_DISPLAY_SCALE_MULTIPLIER, ENEMY_DISPLAY_SCALE_MULTIPLIER } from './combatConstants'
import type { CombatScene } from '../CombatScene'

/**
 * Fake scene tối giản — chỉ implement đúng bề mặt API mà
 * CombatGridView.getOrCreateSprite() (nhánh enemy CÓ texture thật) chạm
 * tới. applySpriteSize/updateEnemyHealthBar gán SAU khi gridView đã tồn
 * tại vì getOrCreateSprite() gọi ngược `this.scene.applySpriteSize(...)`
 * (CombatScene thật cũng uỷ quyền vòng lại gridView y hệt — xem
 * CombatScene.ts dòng 1013-1014).
 */
function createFakeScene() {
  const chainable = () => {
    const obj = {
      setOrigin: () => obj,
      setDepth: () => obj,
      setStrokeStyle: () => obj,
      setSize: () => obj,
      setScale: () => obj,
      updateDisplayOrigin: () => obj,
      setDisplaySize: () => obj,
      destroy: () => obj,
    }

    return obj
  }

  const scene: Record<string, unknown> = {
    sprites: new Map(),
    isPerspective: false,
    projection: undefined,
    characterWidth: 40,
    characterHeight: 50,
    playerSourceSize: { w: 1244, h: 1264 },
    add: {
      text: () => chainable(),
      sprite: () => chainable(),
      rectangle: () => chainable(),
      ellipse: () => chainable(),
    },
    physics: { add: { existing: vi.fn() } },
    textures: { exists: () => true },
  }

  const gridView = new CombatGridView(scene as unknown as CombatScene)

  scene.applySpriteSize = (sprite: Parameters<CombatGridView['applySpriteSize']>[0]) =>
    gridView.applySpriteSize(sprite)
  scene.updateEnemyHealthBar = (
    sprite: Parameters<CombatGridView['updateEnemyHealthBar']>[0],
    currentHp: number,
    maxHp: number,
  ) => gridView.updateEnemyHealthBar(sprite, currentHp, maxHp)

  return { scene, gridView }
}

describe('CombatGridView.getOrCreateSprite() — Task 9.5 boss sizeMultiplier', () => {
  it('isBoss: true → sizeMultiplier = BOSS_DISPLAY_SCALE_MULTIPLIER (×4)', () => {
    const { gridView } = createFakeScene()

    const sprite = gridView.getOrCreateSprite('mortal_wild_boar_boss', 0xd94a4a, 'Boss Boar', 4, {
      currentHp: 100,
      maxHp: 100,
      isBoss: true,
    })

    expect(sprite.sizeMultiplier).toBe(BOSS_DISPLAY_SCALE_MULTIPLIER)
    expect(sprite.sizeMultiplier).toBe(4)
  })

  it('isBoss: false → sizeMultiplier = ENEMY_DISPLAY_SCALE_MULTIPLIER (×2)', () => {
    const { gridView } = createFakeScene()

    const sprite = gridView.getOrCreateSprite('mortal_wild_boar_regular', 0xd94a4a, 'Boar', 4, {
      currentHp: 100,
      maxHp: 100,
      isBoss: false,
    })

    expect(sprite.sizeMultiplier).toBe(ENEMY_DISPLAY_SCALE_MULTIPLIER)
    expect(sprite.sizeMultiplier).toBe(2)
  })

  it('health không truyền (undefined) → mặc định ENEMY_DISPLAY_SCALE_MULTIPLIER như enemy thường', () => {
    const { gridView } = createFakeScene()

    const sprite = gridView.getOrCreateSprite('mortal_wild_boar_no_health', 0xd94a4a, 'Boar', 4)

    expect(sprite.sizeMultiplier).toBe(ENEMY_DISPLAY_SCALE_MULTIPLIER)
  })

  it('nhánh fallback Rectangle (chưa có texture): Boss vẫn KHÔNG được nhỏ hơn enemy thường có texture — round 1 review, tránh inversion', () => {
    // resolveEnemyTextureKey() trả falsy cho id không nằm trong batch art
    // (id không khớp pattern quái Mortal) → rơi vào nhánh `rect` cuối cùng
    // của getOrCreateSprite(), chỗ trước đây hardcode sizeMultiplier: 1 cho
    // MỌI trường hợp kể cả Boss.
    const { gridView } = createFakeScene()

    const bossSprite = gridView.getOrCreateSprite('unknown_id_no_art_boss', 0xd94a4a, 'Boss X', 4, {
      currentHp: 100,
      maxHp: 100,
      isBoss: true,
    })

    expect(bossSprite.kind).toBe('rect')
    expect(bossSprite.sizeMultiplier).toBe(BOSS_DISPLAY_SCALE_MULTIPLIER)
    // Không được nhỏ hơn enemy thường CÓ texture (nhánh sprite, ×2) — đây
    // chính là bug bị lật ngược mà review round 1 tìm ra.
    expect(bossSprite.sizeMultiplier).toBeGreaterThanOrEqual(ENEMY_DISPLAY_SCALE_MULTIPLIER)

    // Enemy thường rơi cùng nhánh fallback vẫn giữ nguyên size 1 như trước —
    // lựa chọn bảo thủ (conservative), không đổi hình ảnh enemy thường hiện
    // có khi chưa có art.
    const regularSprite = gridView.getOrCreateSprite('unknown_id_no_art_regular', 0xd94a4a, 'Regular X', 4, {
      currentHp: 100,
      maxHp: 100,
      isBoss: false,
    })

    expect(regularSprite.kind).toBe('rect')
    expect(regularSprite.sizeMultiplier).toBe(1)
  })
})
