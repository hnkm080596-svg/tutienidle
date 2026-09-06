// @vitest-environment jsdom
//
// combat-grid-view.test.ts — regression thật cho Task 9.5: sprite-creation
// path (getOrCreateSprite) phải chọn ĐÚNG sizeMultiplier theo cờ isBoss của
// entity spawn, KHÔNG phải giá trị fixture gán tay như
// CombatScene.enemyScale.test.ts (test đó chỉ khoá applyEntityDepthScale()
// pass-through, không chạm production creation code — xem task-9-brief.md).
//
// Battlefield Slot (2026-09-06) — constructor giờ nhận CombatGridViewHost
// (không còn CombatScene cụ thể) nên fake host phải khai đủ
// fallbackSpriteTextureKey() — combat thật LUÔN trả undefined, xem
// CombatScene.fallbackSpriteTextureKey().
import { describe, expect, it, vi } from 'vitest'
import { CombatGridView } from './combat-grid-view'
import { BOSS_DISPLAY_SCALE_MULTIPLIER, ENEMY_DISPLAY_SCALE_MULTIPLIER } from './combatConstants'
import type { CombatGridViewHost } from './CombatGridViewHost'

/**
 * Fake host tối giản — chỉ implement đúng bề mặt API mà
 * CombatGridView.getOrCreateSprite() (nhánh enemy CÓ texture thật) chạm
 * tới. applySpriteSize/updateEnemyHealthBar gán SAU khi gridView đã tồn
 * tại vì getOrCreateSprite() gọi ngược `this.applySpriteSize(...)` (các
 * method của CHÍNH CombatGridView — trước đây uỷ quyền qua CombatScene,
 * xem Battlefield Slot Task 2).
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
    fallbackSpriteTextureKey: () => undefined,
  }

  const gridView = new CombatGridView(scene as unknown as CombatGridViewHost)

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

  it('nhánh fallback Rectangle (chưa có texture, host.fallbackSpriteTextureKey() = undefined): Boss vẫn KHÔNG được nhỏ hơn enemy thường có texture — round 1 review, tránh inversion', () => {
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

describe('CombatGridView.getOrCreateSprite() — host.fallbackSpriteTextureKey() (Battlefield Slot, 2026-09-06)', () => {
  it('host trả về 1 texture key hợp lệ (fallbackSpriteTextureKey + textures.exists đều true) → sprite kind "sprite", KHÔNG phải Rectangle', () => {
    const { scene, gridView } = createFakeScene()

    scene.fallbackSpriteTextureKey = () => 'shared-placeholder-sheet'

    const sprite = gridView.getOrCreateSprite('any_non_enemy_non_player_id', 0x4caf50, 'Test', 0)

    expect(sprite.kind).toBe('sprite')
  })

  it('host trả undefined (như CombatScene thật) → vẫn rơi về Rectangle fallback y hệt trước khi có branch mới — KHÔNG regression cho combat thật', () => {
    const { gridView } = createFakeScene()

    const sprite = gridView.getOrCreateSprite('some_enemy_outside_mortal_batch', 0xd94a4a, 'Test', 0, {
      currentHp: 10,
      maxHp: 10,
      isBoss: false,
    })

    expect(sprite.kind).toBe('rect')
  })

  it('gọi getOrCreateSprite 2 lần cùng id → trả về CÙNG object sprite (không destroy/tạo lại) — đây là cơ chế fix bug animation-reset của panel Trận Pháp (Task 4)', () => {
    const { scene, gridView } = createFakeScene()

    scene.fallbackSpriteTextureKey = () => 'shared-placeholder-sheet'

    const first = gridView.getOrCreateSprite('stable_id', 0x4caf50, 'Test', 0)
    const second = gridView.getOrCreateSprite('stable_id', 0x4caf50, 'Test', 0)

    expect(second).toBe(first)
  })
})
