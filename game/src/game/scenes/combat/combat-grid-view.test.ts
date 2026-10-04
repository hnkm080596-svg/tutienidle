// @vitest-environment jsdom
//
// combat-grid-view.test.ts - regression that cho Task 9.5: sprite-creation
// path (getOrCreateSprite) phai chon DUNG sizeMultiplier theo co isBoss cua
// entity spawn, KHONG phai gia tri fixture gan tay nhu
// CombatScene.enemyScale.test.ts (test do chi khoa applyEntityDepthScale()
// pass-through, khong cham production creation code - xem task-9-brief.md).
//
// Battlefield Slot (2026-09-06) - constructor gio nhan CombatGridViewHost
// (khong con CombatScene cu the) nen fake host phai khai du
// fallbackSpriteTextureKey() - combat that LUON tra undefined, xem
// CombatScene.fallbackSpriteTextureKey().
import { describe, expect, it, vi } from 'vitest'
import { CombatGridView } from './combat-grid-view'
import { BOSS_DISPLAY_SCALE_MULTIPLIER, ENEMY_DISPLAY_SCALE_MULTIPLIER, PLAYER_ID } from './combatConstants'
import { MONSTER_ART } from '@/game/support/MonsterArt'
import { CHARACTER_ART } from '@/game/support/CharacterArt'
import type { CombatGridViewHost } from './CombatGridViewHost'

/**
 * Fake host toi gian - chi implement dung be mat API ma
 * CombatGridView.getOrCreateSprite() (nhanh enemy CO texture that) cham
 * toi. applySpriteSize/updateEnemyHealthBar gan SAU khi gridView da ton
 * tai vi getOrCreateSprite() goi nguoc `this.applySpriteSize(...)` (cac
 * method cua CHINH CombatGridView - truoc day uy quyen qua CombatScene,
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
      // body actually landed (Spec B sec4.3's idle bob).
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
    playerProfile: { id: 'mortal', combatTextureKey: 'player-mortal-pham-nhan-v1' },
    add: {
      text: () => chainable(),
      sprite: vi.fn(() => chainable()),
      rectangle: () => chainable(),
      ellipse: () => chainable(),
    },
    physics: { add: { existing: vi.fn() } },
    textures: { exists: () => true },
    // Spec B sec4.3 - enemies now start an idle-bob tween on creation. The host
    // interface always declared `tweens`; this fixture simply never supplied it,
    // and the cast below hid that until something read it.
    tweens: { add: vi.fn(), killTweensOf: vi.fn() },
    // CombatGridViewHost.startEntityIdle - kicks the entity's idle state after
    // creation (clip in animated mode, no-op where a static bob already runs).
    startEntityIdle: vi.fn(),
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

    const sprite = gridView.getOrCreateSprite('mortal_savage_tiger_boss', 0xd94a4a, 'Boss Boar', 4, {
      currentHp: 100,
      maxHp: 100,
      isBoss: true,
    })

    expect(sprite.sizeMultiplier).toBe(BOSS_DISPLAY_SCALE_MULTIPLIER)
    expect(sprite.sizeMultiplier).toBe(4)
  })

  it('isBoss: false → sizeMultiplier = ENEMY_DISPLAY_SCALE_MULTIPLIER (×2)', () => {
    const { gridView } = createFakeScene()

    const sprite = gridView.getOrCreateSprite('mortal_savage_tiger_regular', 0xd94a4a, 'Boar', 4, {
      currentHp: 100,
      maxHp: 100,
      isBoss: false,
    })

    expect(sprite.sizeMultiplier).toBe(ENEMY_DISPLAY_SCALE_MULTIPLIER)
    expect(sprite.sizeMultiplier).toBe(2)
  })

  it('health không truyền (undefined) → mặc định ENEMY_DISPLAY_SCALE_MULTIPLIER như enemy thường', () => {
    const { gridView } = createFakeScene()

    const sprite = gridView.getOrCreateSprite('mortal_savage_tiger_no_health', 0xd94a4a, 'Boar', 4)

    expect(sprite.sizeMultiplier).toBe(ENEMY_DISPLAY_SCALE_MULTIPLIER)
  })

  it('id ngoài batch → placeholder sprite CÙNG MODE (uniformity 2026-09-19): Boss vẫn KHÔNG được nhỏ hơn enemy thường — round 1 review, tránh inversion', () => {
    // resolveEnemyTextureKey() tra falsy cho id khong nam trong batch art ->
    // entity key roi ve PLACEHOLDER_ENTITY_KEY, render placeholder texture
    // cua mode hien hanh thay vi Rectangle (Rectangle chi con double-
    // fallback khi ca placeholder texture cung thieu).
    const { gridView } = createFakeScene()

    const bossSprite = gridView.getOrCreateSprite('unknown_id_no_art_boss', 0xd94a4a, 'Boss X', 4, {
      currentHp: 100,
      maxHp: 100,
      isBoss: true,
    })

    expect(bossSprite.kind).toBe('sprite')
    expect(bossSprite.sizeMultiplier).toBe(BOSS_DISPLAY_SCALE_MULTIPLIER)
    // Khong duoc nho hon enemy thuong CO texture (nhanh sprite, x2) - day
    // chinh la bug bi lat nguoc ma review round 1 tim ra.
    expect(bossSprite.sizeMultiplier).toBeGreaterThanOrEqual(ENEMY_DISPLAY_SCALE_MULTIPLIER)

    // Enemy thuong cung nhanh placeholder giu ENEMY multiplier nhu moi
    // entity co texture - dong nhat voi quai co art that.
    const regularSprite = gridView.getOrCreateSprite('unknown_id_no_art_regular', 0xd94a4a, 'Regular X', 4, {
      currentHp: 100,
      maxHp: 100,
      isBoss: false,
    })

    expect(regularSprite.kind).toBe('sprite')
    expect(regularSprite.sizeMultiplier).toBe(ENEMY_DISPLAY_SCALE_MULTIPLIER)
  })
})

describe('CombatGridView.getOrCreateSprite() — host.fallbackSpriteTextureKey() (Battlefield Slot, 2026-09-06)', () => {
  it('host trả về 1 texture key hợp lệ (fallbackSpriteTextureKey + textures.exists đều true) → sprite kind "sprite", KHÔNG phải Rectangle', () => {
    const { scene, gridView } = createFakeScene()

    scene.fallbackSpriteTextureKey = () => 'shared-placeholder-sheet'

    const sprite = gridView.getOrCreateSprite('any_non_enemy_non_player_id', 0x4caf50, 'Test', 0)

    expect(sprite.kind).toBe('sprite')
  })

  it('placeholder texture cũng thiếu + host trả undefined (như CombatScene thật) → Rectangle double-fallback — KHÔNG regression cho combat thật', () => {
    // Uniformity 2026-09-19: id ngoai batch gio render placeholder texture
    // CUNG MODE thay vi Rectangle - Rectangle chi con la double-fallback khi
    // ca placeholder texture cung khong load duoc.
    const { scene, gridView } = createFakeScene()

    scene.textures = { exists: () => false }

    const sprite = gridView.getOrCreateSprite('some_enemy_outside_mortal_batch', 0xd94a4a, 'Test', 0, {
      currentHp: 10,
      maxHp: 10,
      isBoss: false,
    })

    expect(sprite.kind).toBe('rect')
  })

  it('reskinned enemy with a MISSING atlas still draws its avatar PNG (F-EAW-09) - never falls straight to Rectangle', () => {
    const { scene, gridView } = createFakeScene()

    // mortal_wild_boar_* resolves to tusked-mountain-boar (animated). Only
    // the avatar texture reports loaded - the atlas sheet does not.
    const avatarKey = MONSTER_ART['tusked-mountain-boar']?.avatarKey

    expect(avatarKey).toBeDefined()

    scene.textures = { exists: (key: string) => key === avatarKey }

    const sprite = gridView.getOrCreateSprite('mortal_wild_boar_9f2c', 0xd94a4a, 'Boar', 0, {
      currentHp: 10,
      maxHp: 10,
      isBoss: false,
    })

    expect(sprite.kind).toBe('sprite')

    const spriteFactory = (scene.add as { sprite: ReturnType<typeof vi.fn> }).sprite
    expect(spriteFactory.mock.calls[0]?.[2]).toBe(avatarKey)
  })

  it('reskinned enemy with BOTH atlas and avatar missing -> Rectangle double-fallback (same as any unloaded art)', () => {
    const { scene, gridView } = createFakeScene()

    scene.textures = { exists: () => false }

    const sprite = gridView.getOrCreateSprite('mortal_wild_boar_9f2c', 0xd94a4a, 'Boar', 0, {
      currentHp: 10,
      maxHp: 10,
      isBoss: false,
    })

    expect(sprite.kind).toBe('rect')
  })

  it('reskinned PLAYER with atlas+avatar missing falls back to the profile PNG - never __MISSING (F-CAI-25)', () => {
    const { scene, gridView } = createFakeScene()

    // mortal maps to pham_nhan (animated). Only the profile PNG reports
    // loaded - atlas AND avatar both miss.
    const profileKey = (scene.playerProfile as { combatTextureKey: string }).combatTextureKey

    scene.textures = { exists: (key: string) => key === profileKey }

    const sprite = gridView.getOrCreateSprite(PLAYER_ID, 0x4caf50, 'Player', 0)

    expect(sprite.kind).toBe('sprite')

    const spriteFactory = (scene.add as { sprite: ReturnType<typeof vi.fn> }).sprite
    expect(spriteFactory.mock.calls[0]?.[2]).toBe(profileKey)
  })

  it('reskinned PLAYER with atlas missing still draws the variant avatar - the intermediate chain step (Clean-B2 coverage)', () => {
    const { scene, gridView } = createFakeScene()

    // mortal maps to pham_nhan (animated). Only the variant avatar reports
    // loaded - the idle sheet misses, so the draw chain must land on the
    // avatar, not skip straight to the profile PNG / Rectangle.
    const avatarKey = CHARACTER_ART['pham_nhan']?.avatarKey

    expect(avatarKey).toBeDefined()

    scene.textures = { exists: (key: string) => key === avatarKey }

    const sprite = gridView.getOrCreateSprite(PLAYER_ID, 0x4caf50, 'Player', 0)

    expect(sprite.kind).toBe('sprite')

    const spriteFactory = (scene.add as { sprite: ReturnType<typeof vi.fn> }).sprite
    expect(spriteFactory.mock.calls[0]?.[2]).toBe(avatarKey)
  })

  it('reskinned PLAYER with atlas+avatar+profile ALL missing -> Rectangle terminal fallback (F-CAI-25)', () => {
    const { scene, gridView } = createFakeScene()

    scene.textures = { exists: () => false }

    const sprite = gridView.getOrCreateSprite(PLAYER_ID, 0x4caf50, 'Player', 0)

    // The player branch must end on the same Rectangle the enemy branch
    // does - Phaser's implicit __MISSING checkerboard is not an acceptable
    // final visual.
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
// Spec B sec4.3/sec6 B6 - the idle bob
// ---------------------------------------------------------------------------
//
// sec3.2 described enemies as static "nhu hien tai". They were not: walk sway/
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

    const sprite = gridView.getOrCreateSprite('mortal_savage_tiger_1', 0xd94a4a, 'Boar', 4, {
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

    gridView.getOrCreateSprite('mortal_savage_tiger_1', 0xd94a4a, 'A', 4, {
      currentHp: 10,
      maxHp: 10,
      isBoss: false,
    })
    gridView.getOrCreateSprite('mortal_savage_tiger_2', 0xd94a4a, 'B', 4, {
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

    const sprite = gridView.getOrCreateSprite('mortal_savage_tiger_1', 0xd94a4a, 'Boar', 4, {
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

  it('the reskinned player draws its character atlas and skips the bob (character-art-infra)', () => {
    // The fixture's profile id 'mortal' maps to 'pham_nhan' in
    // CHARACTER_RESKIN_MAP, so the player is an animated override entity in
    // every mode: atlas idle frame, no bob tween.
    const { scene, gridView } = createFakeScene()

    const player = gridView.getOrCreateSprite('player', 0x4a90d9, 'Player', 4)

    const spriteCalls = (scene.add as { sprite: ReturnType<typeof vi.fn> }).sprite.mock.calls
    const playerCall = spriteCalls.find((call) => String(call[2]).startsWith('pham_nhan-sheet-'))

    expect(playerCall, 'player did not draw the pham_nhan atlas').toBeDefined()
    expect(playerCall![3]).toBe('pham_nhan-idle-001.png')
    expect(player.idle).toBeUndefined()
    expect(
      (scene.tweens as { add: ReturnType<typeof vi.fn> }).add,
    ).not.toHaveBeenCalled()
    expect(
      (scene.startEntityIdle as ReturnType<typeof vi.fn>),
    ).toHaveBeenCalledWith(player, 'player')
  })

  it('destroying a sprite kills its bob, which outlives the GameObject otherwise', () => {
    const { scene, gridView } = createFakeScene()

    const sprite = gridView.getOrCreateSprite('mortal_savage_tiger_1', 0xd94a4a, 'Boar', 4, {
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

    const untrimmed = gridView.getOrCreateSprite('mortal_savage_tiger_1', 0xd94a4a, 'Boar', 4, {
      currentHp: 10,
      maxHp: 10,
      isBoss: false,
    })

    const boxHeight = (untrimmed.rect as unknown as { setDisplaySize: ReturnType<typeof vi.fn> })
      .setDisplaySize.mock.calls.at(-1)![1] as number

    // The boar's PNG is untrimmed, so its box IS its character height. Spec C
    // sec3.2's calibration says that must stay 122.98 at this depth.
    expect(boxHeight).toBeCloseTo(122.98, 0)
  })
})
