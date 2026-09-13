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
      setDisplaySize: vi.fn(() => obj),
      destroy: () => obj,
      // positionSprite() writes here. Captured so a test can read where the
      // body actually landed (Spec B §4.3's idle bob).
      setPosition: vi.fn(() => obj),
      displayHeight: 0,
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
    playerProfile: { combatTextureKey: 'player-mortal-ink-sword-concept-v2' },
    add: {
      text: () => chainable(),
      sprite: () => chainable(),
      rectangle: () => chainable(),
      ellipse: () => chainable(),
    },
    physics: { add: { existing: vi.fn() } },
    textures: { exists: () => true },
    // Spec B §4.3 — enemies now start an idle-bob tween on creation. The host
    // interface always declared `tweens`; this fixture simply never supplied it,
    // and the cast below hid that until something read it.
    tweens: { add: vi.fn(), killTweensOf: vi.fn() },
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


describe('CombatGridView.redrawGridLines() — kích thước lưới lấy từ projection (Battlefield Perspective Panel, 2026-09-06)', () => {
  function createFakeGraphics() {
    return {
      clear: vi.fn(),
      lineStyle: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      strokePath: vi.fn(),
      strokePoints: vi.fn(),
      fillStyle: vi.fn(),
      fillPoints: vi.fn(),
    }
  }

  function createFakeProjection(rows: number, columns: number) {
    return {
      rows,
      columns,
      gridToScreen: (row: number, column: number) => ({ x: column, y: row, scale: 1 }),
      footprintPolygon: () => [],
    }
  }

  it('lưới 6x6 (panel) → 7 đường ngang + 7 đường dọc (rows+1, columns+1), KHÔNG phải 11/17 của lưới thật', () => {
    const { scene, gridView } = createFakeScene()
    const graphics = createFakeGraphics()

    scene.gridGraphics = graphics
    scene.projection = createFakeProjection(6, 6)
    scene.usingArtBackdrop = false
    scene.arenaRect = undefined

    gridView.redrawGridLines()

    expect(graphics.moveTo).toHaveBeenCalledTimes(7 + 7)
  })

  it('KHÔNG còn gọi fillPoints (cổng phòng thủ HERO_COLUMN đã bị xóa — obsolete với turn-based)', () => {
    const { scene, gridView } = createFakeScene()
    const graphics = createFakeGraphics()

    scene.gridGraphics = graphics
    scene.projection = createFakeProjection(10, 16)
    scene.usingArtBackdrop = false
    scene.arenaRect = undefined

    gridView.redrawGridLines()

    expect(graphics.fillPoints).not.toHaveBeenCalled()
  })

  it('perspective mode (arenaRect undefined) vẫn vẽ viền ngoài qua strokePoints (viền KHÔNG bị xóa, chỉ gate polygon bị xóa)', () => {
    const { scene, gridView } = createFakeScene()
    const graphics = createFakeGraphics()

    scene.gridGraphics = graphics
    scene.projection = createFakeProjection(10, 16)
    scene.usingArtBackdrop = false
    scene.arenaRect = undefined

    gridView.redrawGridLines()

    expect(graphics.strokePoints).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// Spec B §4.3/§6 B6 — the idle bob
// ---------------------------------------------------------------------------
//
// §3.2 described enemies as static "như hiện tại". They were not: walk sway/
// bob/tilt were deleted outright on 2026-08-26, leaving rotation 0 and a
// straight projected position. So "static plus a slight shake" is a TARGET
// state, and these tests cover the half that had to be ADDED, not removed.
describe('CombatGridView — idle motion for static entities', () => {
  function fakeProjection() {
    return {
      rows: 6,
      columns: 6,
      gridToScreen: () => ({ x: 100, y: 200, scale: 1 }),
      cellSizeAt: () => ({ width: 94.49, height: 41.4 }),
      footprintPolygon: () => [],
    }
  }

  it('a static enemy starts a looping, phase-delayed bob on creation', () => {
    const { scene, gridView } = createFakeScene()

    const sprite = gridView.getOrCreateSprite('mortal_wild_boar_1', 0xd94a4a, 'Boar', 4, {
      currentHp: 10,
      maxHp: 10,
      isBoss: false,
    })

    expect(sprite.idle).toBeDefined()

    const tweens = scene.tweens as { add: ReturnType<typeof vi.fn> }

    expect(tweens.add).toHaveBeenCalledTimes(1)

    const config = tweens.add.mock.calls[0]![0] as Record<string, unknown>

    expect(config.targets).toBe(sprite.idle)
    expect(config.repeat).toBe(-1)
    expect(config.yoyo).toBe(true)
    expect(config.offsetY).toBeLessThan(0)
    expect(config.duration as number).toBeGreaterThan(0)
  })

  it('two individuals of the SAME species get different phases', () => {
    // The failure this pins is the one that reads worse than no motion at all:
    // five wolves share one texture key, so a per-key phase would make a row
    // breathe as a single organism. The delay comes from the runtime id.
    const { scene, gridView } = createFakeScene()

    gridView.getOrCreateSprite('mortal_wild_boar_1', 0xd94a4a, 'A', 4, {
      currentHp: 10,
      maxHp: 10,
      isBoss: false,
    })
    gridView.getOrCreateSprite('mortal_wild_boar_2', 0xd94a4a, 'B', 4, {
      currentHp: 10,
      maxHp: 10,
      isBoss: false,
    })

    const tweens = scene.tweens as { add: ReturnType<typeof vi.fn> }
    const first = tweens.add.mock.calls[0]![0] as { delay: number }
    const second = tweens.add.mock.calls[1]![0] as { delay: number }

    expect(first.delay).not.toBe(second.delay)
  })

  it('the bob moves the BODY, leaving feet, shadow and depth on the ground', () => {
    const { scene, gridView } = createFakeScene()

    scene.isPerspective = true
    scene.projection = fakeProjection()

    const sprite = gridView.getOrCreateSprite('mortal_wild_boar_1', 0xd94a4a, 'Boar', 4, {
      currentHp: 10,
      maxHp: 10,
      isBoss: false,
    })

    sprite.idle!.offsetY = -6

    gridView.positionSprite(sprite, 3)

    const body = sprite.rect as unknown as { setPosition: ReturnType<typeof vi.fn> }
    const shadow = sprite.shadow as unknown as { setPosition: ReturnType<typeof vi.fn> }

    // Body lifted by exactly the offset...
    expect(body.setPosition).toHaveBeenCalledWith(100, 194)

    // ...while the shadow and the foot point stay on the projected ground. A
    // shadow that rose with the body would read as the creature hovering, and a
    // moving footY would reorder the depth sort mid-breath.
    expect(shadow.setPosition).toHaveBeenCalledWith(100, 200)
    expect(sprite.footY).toBe(200)
  })

  it('the player gets no bob — it moves because its frames do', () => {
    const { scene, gridView } = createFakeScene()

    const player = gridView.getOrCreateSprite('player', 0x4a90d9, 'Player', 4)

    expect(player.idle).toBeUndefined()
    expect((scene.tweens as { add: ReturnType<typeof vi.fn> }).add).not.toHaveBeenCalled()
  })

  it('destroying a sprite kills its bob, which outlives the GameObject otherwise', () => {
    const { scene, gridView } = createFakeScene()

    const sprite = gridView.getOrCreateSprite('mortal_wild_boar_1', 0xd94a4a, 'Boar', 4, {
      currentHp: 10,
      maxHp: 10,
      isBoss: false,
    })

    gridView.destroyEntitySprite(sprite)

    expect((scene.tweens as { killTweensOf: ReturnType<typeof vi.fn> }).killTweensOf).toHaveBeenCalledWith(
      sprite.idle,
    )
  })
})

describe('CombatGridView — size is the character, not the box (Spec C §3.2)', () => {
  function perspectiveHost() {
    const { scene, gridView } = createFakeScene()

    scene.isPerspective = true
    scene.projection = {
      rows: 10,
      columns: 16,
      gridToScreen: () => ({ x: 100, y: 200, scale: 0.70735 }),
      cellSizeAt: () => ({ width: 94.49, height: 41.4 }),
      footprintPolygon: () => [],
    }

    return { scene, gridView }
  }

  it('trimmed art gets a BIGGER box so the character lands at the same height', () => {
    const { gridView } = perspectiveHost()

    const untrimmed = gridView.getOrCreateSprite('mortal_wild_boar_1', 0xd94a4a, 'Boar', 4, {
      currentHp: 10,
      maxHp: 10,
      isBoss: false,
    })

    const boxHeight = (untrimmed.rect as unknown as { setDisplaySize: ReturnType<typeof vi.fn> })
      .setDisplaySize.mock.calls.at(-1)![1] as number

    // The boar's PNG is untrimmed, so its box IS its character height. Spec C
    // §3.2's calibration says that must stay 122.98 at this depth.
    expect(boxHeight).toBeCloseTo(122.98, 0)
  })
})
