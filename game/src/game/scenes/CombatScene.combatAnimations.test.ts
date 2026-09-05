// @vitest-environment jsdom
// Combat Art Pipeline Task 9 (2026-09-05) — headless coverage cho phần
// KHÔNG cần Phaser runtime thật: derive animation key theo actor, guard
// đăng ký Animation (anims.exists skip), dispatch playCombatAnimation(), và
// bookkeeping hoãn xóa sprite khi chết (death-deferral) — bao gồm case
// player không bao giờ bị destroy và case id tái xuất hiện giữa lúc sprite
// cũ còn đang chờ animation/tween chết (Task 5 review's orphan/double-
// destroy concern). Theo đúng pattern createTestScene('bare') +
// Object.create của các file CombatScene.*.test.ts khác — KHÔNG dựng
// Phaser thật.
import { describe, expect, it, vi } from 'vitest'
import { createTestScene } from './combat/combatTestHarness'
import { PLAYER_ID } from './combat/combatConstants'
import { combatAnimationKey } from '@/game/support/CombatAnimationSet'
import { PLAYER_VISUAL_PROFILES } from '@/game/support/PlayerVisualProfiles'

function createScene() {
  const scene = createTestScene('bare')

  scene.playerProfile = PLAYER_VISUAL_PROFILES.mortal
  scene.sprites = new Map()
  scene.interpolations = new Map()
  scene.castBars = new Map()
  scene.dotAccumulators = new Map()
  scene.dyingIds = new Set()
  scene.playerDying = false

  return scene
}

function fakeGameSprite() {
  const listeners = new Map<string, (...args: unknown[]) => void>()

  return {
    playCalls: [] as string[],
    destroyed: false,
    play(key: string) {
      this.playCalls.push(key)
      return this
    },
    once(event: string, handler: (...args: unknown[]) => void) {
      listeners.set(event, handler)
      return this
    },
    emit(event: string, ...args: unknown[]) {
      listeners.get(event)?.(...args)
    },
    setScale() {
      return this
    },
    destroy() {
      this.destroyed = true
    },
  }
}

function makeSprite(kind: 'sprite' | 'rect', rectOverride?: Record<string, unknown>) {
  const rect =
    rectOverride ??
    (kind === 'sprite'
      ? fakeGameSprite()
      : { destroyed: false, destroy(this: { destroyed: boolean }) { this.destroyed = true } })

  return {
    kind,
    rect,
    label: { destroy: vi.fn() },
    color: 0,
    offsetX: 0,
    row: 4,
    sizeMultiplier: 1,
    boost: { value: 1 },
    footY: 0,
    columnFloat: 0,
    // any-có-chủ-đích (cùng pattern CombatScene.enemyScale.test.ts) — stub
    // EntitySprite tối giản cho method Object.create test, không cần khớp
    // interface đầy đủ.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe('CombatScene — entityAnimationKeyPrefix()', () => {
  it('player → combatTextureKey của profile hiện hành', () => {
    const scene = createScene()

    expect(scene.entityAnimationKeyPrefix(PLAYER_ID)).toBe(
      PLAYER_VISUAL_PROFILES.mortal.combatTextureKey,
    )
  })

  it('enemy trong batch Mortal → resolveEnemyTextureKey()', () => {
    const scene = createScene()

    expect(scene.entityAnimationKeyPrefix('mortal_wild_boar_ab12')).toBe('mortal-wild-boar-v1')
  })

  it('enemy ngoài batch (vẫn Rectangle) → undefined', () => {
    const scene = createScene()

    expect(scene.entityAnimationKeyPrefix('enemy_1')).toBeUndefined()
  })
})

describe('CombatScene — registerCombatAnimations() guard', () => {
  it('this.anims.exists() === false cho mọi clip → create() gọi đủ 5 lần (idle/ready/cast/standby/death)', () => {
    const scene = createScene()
    const created: Array<{ key: string }> = []

    scene.anims = {
      exists: () => false,
      create: (config: { key: string }) => created.push(config),
      generateFrameNumbers: () => [],
    }

    scene.registerCombatAnimations(
      'entity-x',
      Object.fromEntries(
        ['idle', 'ready', 'cast', 'standby', 'death'].map((name) => [
          name,
          {
            key: combatAnimationKey('entity-x', name as never),
            sheetKey: `entity-x-${name}-sheet`,
            sheetUrl: '/x.png',
            frameWidth: 10,
            frameHeight: 10,
            frameCount: 1,
            frameRate: 1,
            repeat: name === 'cast' || name === 'death' ? 0 : -1,
          },
        ]),
      ),
    )

    expect(created).toHaveLength(5)
    expect(created.map((c) => c.key)).toContain('entity-x-idle')
  })

  it('this.anims.exists() === true cho mọi clip → KHÔNG create() lần nào (đã đăng ký trước đó, AnimationManager dùng chung toàn Game)', () => {
    const scene = createScene()
    const create = vi.fn()

    scene.anims = { exists: () => true, create, generateFrameNumbers: () => [] }

    scene.registerCombatAnimations('entity-x', {
      idle: {
        key: 'entity-x-idle',
        sheetKey: 'entity-x-idle-sheet',
        sheetUrl: '/x.png',
        frameWidth: 10,
        frameHeight: 10,
        frameCount: 1,
        frameRate: 1,
        repeat: -1,
      },
    } as never)

    expect(create).not.toHaveBeenCalled()
  })
})

describe('CombatScene — playCombatAnimation()', () => {
  it('kind rect (fallback Rectangle) → không gọi .play() (không có method này)', () => {
    const scene = createScene()
    const sprite = makeSprite('rect')

    scene.anims = { exists: () => true }

    // Không throw dù rect không có .play — guard kind !== 'sprite' chặn trước.
    expect(() => scene.playCombatAnimation(sprite, 'mortal_wild_boar_1', 'ready')).not.toThrow()
  })

  it('actorId không map được entity key (enemy ngoài batch) → không play', () => {
    const scene = createScene()
    const sprite = makeSprite('sprite')

    scene.anims = { exists: () => true }
    scene.playCombatAnimation(sprite, 'enemy_1', 'ready')

    expect((sprite.rect as ReturnType<typeof fakeGameSprite>).playCalls).toHaveLength(0)
  })

  it('clip chưa đăng ký (anims.exists false) → không play', () => {
    const scene = createScene()
    const sprite = makeSprite('sprite')

    scene.anims = { exists: () => false }
    scene.playCombatAnimation(sprite, PLAYER_ID, 'ready')

    expect((sprite.rect as ReturnType<typeof fakeGameSprite>).playCalls).toHaveLength(0)
  })

  it('player + clip đã đăng ký → play(đúng key theo profile hiện hành)', () => {
    const scene = createScene()
    const sprite = makeSprite('sprite')

    scene.anims = { exists: () => true }
    scene.playCombatAnimation(sprite, PLAYER_ID, 'ready')

    expect((sprite.rect as ReturnType<typeof fakeGameSprite>).playCalls).toEqual([
      combatAnimationKey(PLAYER_VISUAL_PROFILES.mortal.combatTextureKey, 'ready'),
    ])
  })

  it('actorId undefined (spriteFor miss upstream) → không throw, không play', () => {
    const scene = createScene()
    const sprite = makeSprite('sprite')

    scene.anims = { exists: () => true }

    expect(() => scene.playCombatAnimation(sprite, undefined, 'cast')).not.toThrow()
    expect((sprite.rect as ReturnType<typeof fakeGameSprite>).playCalls).toHaveLength(0)
  })
})

describe('CombatScene — beginDeathSequence() death-deferral', () => {
  function stubTweensCapturingOnComplete() {
    const tweenConfigs: Array<Record<string, unknown>> = []

    return {
      tweens: {
        killTweensOf: vi.fn(),
        add: (config: Record<string, unknown>) => tweenConfigs.push(config),
      },
      tweenConfigs,
    }
  }

  it('enemy Rectangle (không animation khả dụng) — destroy CHỈ sau khi tween xong (hành vi y hệt trước Task 9)', () => {
    const scene = createScene()
    const { tweens, tweenConfigs } = stubTweensCapturingOnComplete()

    scene.tweens = tweens
    scene.anims = { exists: () => true }

    const sprite = makeSprite('rect')

    scene.sprites.set('enemy-1', sprite)
    scene._gridView = { destroyEntitySprite: vi.fn() }

    scene.beginDeathSequence(sprite, 'enemy-1')

    expect(scene.dyingIds.has('enemy-1')).toBe(true)
    expect(scene._gridView.destroyEntitySprite).not.toHaveBeenCalled()

    // Tween chính (rotation/alpha trên sprite.rect) luôn được add() đầu tiên.
    const mainTweenOnComplete = tweenConfigs[0]!.onComplete as () => void

    mainTweenOnComplete()

    expect(scene._gridView.destroyEntitySprite).toHaveBeenCalledTimes(1)
    expect(scene.sprites.has('enemy-1')).toBe(false)
    expect(scene.dyingIds.has('enemy-1')).toBe(false)
  })

  it('enemy Sprite thật + clip -death đã đăng ký — phát animation NGAY, nhưng destroy CHỜ CẢ tween LẪN ANIMATION_COMPLETE (spec §9, không cắt ngang)', () => {
    const scene = createScene()
    const { tweens, tweenConfigs } = stubTweensCapturingOnComplete()

    scene.tweens = tweens
    scene.anims = { exists: () => true }

    const sprite = makeSprite('sprite')
    const gameSprite = sprite.rect as ReturnType<typeof fakeGameSprite>

    scene.sprites.set('mortal_wild_boar_1', sprite)
    scene._gridView = { destroyEntitySprite: vi.fn() }

    scene.beginDeathSequence(sprite, 'mortal_wild_boar_1')

    expect(gameSprite.playCalls).toEqual([combatAnimationKey('mortal-wild-boar-v1', 'death')])

    const mainTweenOnComplete = tweenConfigs[0]!.onComplete as () => void

    // Tween xong TRƯỚC — animation vẫn đang chạy → CHƯA destroy.
    mainTweenOnComplete()
    expect(scene._gridView.destroyEntitySprite).not.toHaveBeenCalled()
    expect(scene.sprites.has('mortal_wild_boar_1')).toBe(true)

    // Animation xong SAU — CẢ 2 tín hiệu đã đủ → destroy đúng 1 lần.
    gameSprite.emit('animationcomplete', { key: combatAnimationKey('mortal-wild-boar-v1', 'death') })

    expect(scene._gridView.destroyEntitySprite).toHaveBeenCalledTimes(1)
    expect(scene.sprites.has('mortal_wild_boar_1')).toBe(false)
    expect(scene.dyingIds.has('mortal_wild_boar_1')).toBe(false)
  })

  it('animationcomplete của MỘT clip khác (key không khớp) không kích hoạt finalize', () => {
    const scene = createScene()
    const { tweens, tweenConfigs } = stubTweensCapturingOnComplete()

    scene.tweens = tweens
    scene.anims = { exists: () => true }

    const sprite = makeSprite('sprite')
    const gameSprite = sprite.rect as ReturnType<typeof fakeGameSprite>

    scene.sprites.set('mortal_wild_boar_1', sprite)
    scene._gridView = { destroyEntitySprite: vi.fn() }

    scene.beginDeathSequence(sprite, 'mortal_wild_boar_1')
    ;(tweenConfigs[0]!.onComplete as () => void)()

    gameSprite.emit('animationcomplete', { key: 'some-other-clip' })

    expect(scene._gridView.destroyEntitySprite).not.toHaveBeenCalled()
  })

  it('player — KHÔNG BAO GIỜ destroy dù cả tween lẫn animation đều xong (giữ vị trí cuối dưới overlay kết quả)', () => {
    const scene = createScene()
    const { tweens, tweenConfigs } = stubTweensCapturingOnComplete()

    scene.tweens = tweens
    scene.anims = { exists: () => true }

    const sprite = makeSprite('sprite')
    const gameSprite = sprite.rect as ReturnType<typeof fakeGameSprite>

    scene.sprites.set(PLAYER_ID, sprite)
    scene._gridView = { destroyEntitySprite: vi.fn() }

    scene.beginDeathSequence(sprite, PLAYER_ID)

    expect(scene.playerDying).toBe(true)
    ;(tweenConfigs[0]!.onComplete as () => void)()
    gameSprite.emit('animationcomplete', {
      key: combatAnimationKey(PLAYER_VISUAL_PROFILES.mortal.combatTextureKey, 'death'),
    })

    expect(scene._gridView.destroyEntitySprite).not.toHaveBeenCalled()
    expect(scene.sprites.has(PLAYER_ID)).toBe(true)
  })
})

describe('CombatScene.getOrCreateSprite() — id tái xuất hiện giữa death sequence (Task 5 review: orphan/double-destroy)', () => {
  it('id đang dyingIds → sprite cũ bị finalize NGAY (destroy) trước khi tạo sprite mới, và tín hiệu completion CŨ không đụng tới sprite MỚI', () => {
    const scene = createScene()

    scene.tweens = { killTweensOf: vi.fn(), add: vi.fn() }
    scene.anims = { exists: () => true }

    const oldSprite = makeSprite('sprite')
    const newSprite = makeSprite('sprite')

    scene.sprites.set('mortal_wild_boar_1', oldSprite)
    scene.dyingIds.add('mortal_wild_boar_1')

    const destroyEntitySprite = vi.fn((sprite: unknown) => {
      if (sprite === oldSprite) {
        ;(oldSprite.rect as ReturnType<typeof fakeGameSprite>).destroy()
      }
    })

    scene._gridView = {
      destroyEntitySprite,
      getOrCreateSprite: vi.fn(() => {
        scene.sprites.set('mortal_wild_boar_1', newSprite)
        return newSprite
      }),
    }

    const result = scene.getOrCreateSprite('mortal_wild_boar_1', 0, 'Boar', 4)

    // Sprite cũ bị dọn NGAY (không chờ animation/tween nào) — không rơi vào
    // beginDeathSequence() lần hai.
    expect(destroyEntitySprite).toHaveBeenCalledWith(oldSprite)
    expect((oldSprite.rect as ReturnType<typeof fakeGameSprite>).destroyed).toBe(true)
    expect(scene.dyingIds.has('mortal_wild_boar_1')).toBe(false)

    // getOrCreateSprite() thật (gridView) được gọi để tạo sprite MỚI.
    expect(result).toBe(newSprite)
    expect(scene.sprites.get('mortal_wild_boar_1')).toBe(newSprite)
  })

  it('id KHÔNG trong dyingIds → không đụng gì tới forceFinalizeDeath, đi thẳng qua gridView', () => {
    const scene = createScene()
    const sprite = makeSprite('sprite')

    scene._gridView = { getOrCreateSprite: vi.fn(() => sprite) }

    const result = scene.getOrCreateSprite('enemy-2', 0, 'Enemy', 4)

    expect(result).toBe(sprite)
  })
})
