// @vitest-environment jsdom
// Combat Art Pipeline Task 9 (2026-09-05) â€” headless coverage cho pháº§n
// KHÃ”NG cáº§n Phaser runtime tháº­t: derive animation key theo actor, guard
// Ä‘Äƒng kÃ½ Animation (anims.exists skip), dispatch playCombatAnimation(), vÃ 
// bookkeeping hoÃ£n xÃ³a sprite khi cháº¿t (death-deferral) â€” bao gá»“m case
// player khÃ´ng bao giá» bá»‹ destroy vÃ  case id tÃ¡i xuáº¥t hiá»‡n giá»¯a lÃºc sprite
// cÅ© cÃ²n Ä‘ang chá» animation/tween cháº¿t (Task 5 review's orphan/double-
// destroy concern). Theo Ä‘Ãºng pattern createTestScene('bare') +
// Object.create cá»§a cÃ¡c file CombatScene.*.test.ts khÃ¡c â€” KHÃ”NG dá»±ng
// Phaser tháº­t.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestScene } from './combat/combatTestHarness'
import { PLAYER_ID } from './combat/combatConstants'
import { combatAnimationKey } from '@/presentation/art/CombatEntityPresentation'
import { PLAYER_VISUAL_PROFILES } from '@/presentation/art/PlayerVisualProfiles'

// Spec B §3.2 (2026-09-11) — enemies are `kind: 'static'`: they have no clips,
// so the death-DEFERRAL machinery (wait for the tween AND
// ANIMATION_COMPLETE) has no live enemy to exercise it. The player is the only
// animated entity, and the player is never destroyed.
//
// Rather than delete that coverage, the promotion in §9 criterion 7 is
// performed here: one entity's entry becomes `animated`, and NO playback code
// changes for it to work. The tests below that assert the static behaviour
// leave the override unset, so both halves are covered in one file.
const PROMOTED = new Map<string, 'animated' | 'static'>()

vi.mock('@/presentation/art/CombatPresentationCatalogue', async (importActual) => {
  const actual = await importActual<
    typeof import('@/presentation/art/CombatPresentationCatalogue')
  >()

  return {
    ...actual,
    presentationFor: (entityKey: string) => {
      const override = PROMOTED.get(entityKey)

      if (override === 'animated') {
        return { kind: 'animated', clips: {} }
      }

      return actual.presentationFor(entityKey)
    },
  }
})

afterEach(() => {
  PROMOTED.clear()
})

function createScene() {
  const scene = createTestScene('bare')

  scene.playerProfile = PLAYER_VISUAL_PROFILES.mortal
  scene.sprites = new Map()
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
    // any-cÃ³-chá»§-Ä‘Ã­ch (cÃ¹ng pattern CombatScene.enemyScale.test.ts) â€” stub
    // EntitySprite tá»‘i giáº£n cho method Object.create test, khÃ´ng cáº§n khá»›p
    // interface Ä‘áº§y Ä‘á»§.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe('CombatScene â€” entityAnimationKeyPrefix()', () => {
  it('player â†’ combatTextureKey cá»§a profile hiá»‡n hÃ nh', () => {
    const scene = createScene()

    expect(scene.entityAnimationKeyPrefix(PLAYER_ID)).toBe(
      PLAYER_VISUAL_PROFILES.mortal.combatTextureKey,
    )
  })

  it('enemy trong batch Mortal â†’ resolveEnemyTextureKey()', () => {
    const scene = createScene()

    expect(scene.entityAnimationKeyPrefix('mortal_wild_boar_ab12')).toBe('mortal-wild-boar-v1')
  })

  it('enemy ngoÃ i batch (váº«n Rectangle) â†’ undefined', () => {
    const scene = createScene()

    expect(scene.entityAnimationKeyPrefix('enemy_1')).toBeUndefined()
  })
})

describe('CombatScene â€” registerCombatAnimations() guard', () => {
  it('this.anims.exists() === false cho má»i clip â†’ create() gá»i Ä‘á»§ 5 láº§n (idle/ready/cast/standby/death)', () => {
    const scene = createScene()
    const created: Array<{ key: string }> = []

    scene.anims = {
      exists: () => false,
      create: (config: { key: string }) => created.push(config),
      generateFrameNames: () => [],
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

  it('this.anims.exists() === true cho má»i clip â†’ KHÃ”NG create() láº§n nÃ o (Ä‘Ã£ Ä‘Äƒng kÃ½ trÆ°á»›c Ä‘Ã³, AnimationManager dÃ¹ng chung toÃ n Game)', () => {
    const scene = createScene()
    const create = vi.fn()

    scene.anims = { exists: () => true, create, generateFrameNames: () => [] }

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

describe('CombatScene â€” playCombatAnimation()', () => {
  it('kind rect (fallback Rectangle) â†’ khÃ´ng gá»i .play() (khÃ´ng cÃ³ method nÃ y)', () => {
    const scene = createScene()
    const sprite = makeSprite('rect')

    scene.anims = { exists: () => true }

    // KhÃ´ng throw dÃ¹ rect khÃ´ng cÃ³ .play â€” guard kind !== 'sprite' cháº·n trÆ°á»›c.
    expect(() => scene.playCombatAnimation(sprite, 'mortal_wild_boar_1', 'ready')).not.toThrow()
  })

  it('actorId khÃ´ng map Ä‘Æ°á»£c entity key (enemy ngoÃ i batch) â†’ khÃ´ng play', () => {
    const scene = createScene()
    const sprite = makeSprite('sprite')

    scene.anims = { exists: () => true }
    scene.playCombatAnimation(sprite, 'enemy_1', 'ready')

    expect((sprite.rect as ReturnType<typeof fakeGameSprite>).playCalls).toHaveLength(0)
  })

  it('clip chÆ°a Ä‘Äƒng kÃ½ (anims.exists false) â†’ khÃ´ng play', () => {
    const scene = createScene()
    const sprite = makeSprite('sprite')

    scene.anims = { exists: () => false }
    scene.playCombatAnimation(sprite, PLAYER_ID, 'ready')

    expect((sprite.rect as ReturnType<typeof fakeGameSprite>).playCalls).toHaveLength(0)
  })

  it('player + clip Ä‘Ã£ Ä‘Äƒng kÃ½ â†’ play(Ä‘Ãºng key theo profile hiá»‡n hÃ nh)', () => {
    const scene = createScene()
    const sprite = makeSprite('sprite')

    scene.anims = { exists: () => true }
    scene.playCombatAnimation(sprite, PLAYER_ID, 'ready')

    expect((sprite.rect as ReturnType<typeof fakeGameSprite>).playCalls).toEqual([
      combatAnimationKey(PLAYER_VISUAL_PROFILES.mortal.combatTextureKey, 'ready'),
    ])
  })

  it('a STATIC enemy plays no clip at all, even with every animation registered (B5)', () => {
    // The regression this pins is visible, not theoretical: before Spec B an
    // enemy taking its turn played the shared 32-frame placeholder, which
    // SWAPPED its texture off its own Mortal PNG onto a numbered stick figure
    // for the length of the clip, then left it there.
    const scene = createScene()
    const sprite = makeSprite('sprite')

    scene.anims = { exists: () => true }
    scene.playCombatAnimation(sprite, 'mortal_wild_boar_1', 'ready')
    scene.playCombatAnimation(sprite, 'mortal_wild_boar_1', 'cast')
    scene.playCombatAnimation(sprite, 'mortal_wild_boar_1', 'standby')

    expect((sprite.rect as ReturnType<typeof fakeGameSprite>).playCalls).toEqual([])
  })

  it('promoting that same enemy to animated makes it play — one data edit, no playback code (§9 criterion 7)', () => {
    // This is the criterion that protects §3.2's reversibility. The ONLY
    // difference from the test above is the catalogue entry.
    PROMOTED.set('mortal-wild-boar-v1', 'animated')

    const scene = createScene()
    const sprite = makeSprite('sprite')

    scene.anims = { exists: () => true }
    scene.playCombatAnimation(sprite, 'mortal_wild_boar_1', 'ready')

    expect((sprite.rect as ReturnType<typeof fakeGameSprite>).playCalls[0]).toBe(
      combatAnimationKey('mortal-wild-boar-v1', 'ready'),
    )
  })

  it('a one-shot clip returns the player to idle when it completes (B7)', () => {
    // §4.5: idle is the state every other clip returns to. Without this the
    // sprite freezes on the last frame of `cast` until something else plays.
    const scene = createScene()
    const sprite = makeSprite('sprite')
    const gameSprite = sprite.rect as ReturnType<typeof fakeGameSprite>
    const profileKey = PLAYER_VISUAL_PROFILES.mortal.combatTextureKey

    scene.anims = { exists: () => true }
    scene.playCombatAnimation(sprite, PLAYER_ID, 'cast')

    expect(gameSprite.playCalls).toEqual([combatAnimationKey(profileKey, 'cast')])

    gameSprite.emit('animationcomplete', { key: combatAnimationKey(profileKey, 'cast') })

    expect(gameSprite.playCalls).toEqual([
      combatAnimationKey(profileKey, 'cast'),
      combatAnimationKey(profileKey, 'idle'),
    ])
  })

  it('a DIFFERENT clip completing does not yank the player back to idle', () => {
    const scene = createScene()
    const sprite = makeSprite('sprite')
    const gameSprite = sprite.rect as ReturnType<typeof fakeGameSprite>

    scene.anims = { exists: () => true }
    scene.playCombatAnimation(sprite, PLAYER_ID, 'cast')

    gameSprite.emit('animationcomplete', { key: 'some-other-clip' })

    expect(gameSprite.playCalls).toHaveLength(1)
  })

  it('idle does not re-trigger itself, and death is left to onDeath()', () => {
    // Chaining idle off idle would restart a looping clip on every completion;
    // chaining it off death would return a corpse to standing before the
    // destroy handler runs.
    const scene = createScene()
    const profileKey = PLAYER_VISUAL_PROFILES.mortal.combatTextureKey

    for (const name of ['idle', 'death'] as const) {
      const sprite = makeSprite('sprite')
      const gameSprite = sprite.rect as ReturnType<typeof fakeGameSprite>

      scene.anims = { exists: () => true }
      scene.playCombatAnimation(sprite, PLAYER_ID, name)

      gameSprite.emit('animationcomplete', { key: combatAnimationKey(profileKey, name) })

      expect(gameSprite.playCalls).toEqual([combatAnimationKey(profileKey, name)])
    }
  })

  it('actorId undefined (spriteFor miss upstream) â†’ khÃ´ng throw, khÃ´ng play', () => {
    const scene = createScene()
    const sprite = makeSprite('sprite')

    scene.anims = { exists: () => true }

    expect(() => scene.playCombatAnimation(sprite, undefined, 'cast')).not.toThrow()
    expect((sprite.rect as ReturnType<typeof fakeGameSprite>).playCalls).toHaveLength(0)
  })
})

describe('CombatScene â€” beginDeathSequence() death-deferral', () => {
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

  it('enemy Rectangle (khÃ´ng animation kháº£ dá»¥ng) â€” destroy CHá»ˆ sau khi tween xong (hÃ nh vi y há»‡t trÆ°á»›c Task 9)', () => {
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

    // Tween chÃ­nh (rotation/alpha trÃªn sprite.rect) luÃ´n Ä‘Æ°á»£c add() Ä‘áº§u tiÃªn.
    const mainTweenOnComplete = tweenConfigs[0]!.onComplete as () => void

    mainTweenOnComplete()

    expect(scene._gridView.destroyEntitySprite).toHaveBeenCalledTimes(1)
    expect(scene.sprites.has('enemy-1')).toBe(false)
    expect(scene.dyingIds.has('enemy-1')).toBe(false)
  })

  it('an ANIMATED enemy (promoted, §9 criterion 7) plays -death at once, but destroy waits for BOTH the tween AND ANIMATION_COMPLETE', () => {
    PROMOTED.set('mortal-wild-boar-v1', 'animated')

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

    // Tween xong TRÆ¯á»šC â€” animation váº«n Ä‘ang cháº¡y â†’ CHÆ¯A destroy.
    mainTweenOnComplete()
    expect(scene._gridView.destroyEntitySprite).not.toHaveBeenCalled()
    expect(scene.sprites.has('mortal_wild_boar_1')).toBe(true)

    // Animation xong SAU â€” Cáº¢ 2 tÃ­n hiá»‡u Ä‘Ã£ Ä‘á»§ â†’ destroy Ä‘Ãºng 1 láº§n.
    gameSprite.emit('animationcomplete', { key: combatAnimationKey('mortal-wild-boar-v1', 'death') })

    expect(scene._gridView.destroyEntitySprite).toHaveBeenCalledTimes(1)
    expect(scene.sprites.has('mortal_wild_boar_1')).toBe(false)
    expect(scene.dyingIds.has('mortal_wild_boar_1')).toBe(false)
  })

  it('animationcomplete cá»§a Má»˜T clip khÃ¡c (key khÃ´ng khá»›p) khÃ´ng kÃ­ch hoáº¡t finalize', () => {
    PROMOTED.set('mortal-wild-boar-v1', 'animated')

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

  it('player â€” KHÃ”NG BAO GIá»œ destroy dÃ¹ cáº£ tween láº«n animation Ä‘á»u xong (giá»¯ vá»‹ trÃ­ cuá»‘i dÆ°á»›i overlay káº¿t quáº£)', () => {
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

describe('CombatScene.getOrCreateSprite() â€” id tÃ¡i xuáº¥t hiá»‡n giá»¯a death sequence (Task 5 review: orphan/double-destroy)', () => {
  it('id Ä‘ang dyingIds â†’ sprite cÅ© bá»‹ finalize NGAY (destroy) trÆ°á»›c khi táº¡o sprite má»›i, vÃ  tÃ­n hiá»‡u completion CÅ¨ khÃ´ng Ä‘á»¥ng tá»›i sprite Má»šI', () => {
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

    // Sprite cÅ© bá»‹ dá»n NGAY (khÃ´ng chá» animation/tween nÃ o) â€” khÃ´ng rÆ¡i vÃ o
    // beginDeathSequence() láº§n hai.
    expect(destroyEntitySprite).toHaveBeenCalledWith(oldSprite)
    expect((oldSprite.rect as ReturnType<typeof fakeGameSprite>).destroyed).toBe(true)
    expect(scene.dyingIds.has('mortal_wild_boar_1')).toBe(false)

    // getOrCreateSprite() tháº­t (gridView) Ä‘Æ°á»£c gá»i Ä‘á»ƒ táº¡o sprite Má»šI.
    expect(result).toBe(newSprite)
    expect(scene.sprites.get('mortal_wild_boar_1')).toBe(newSprite)
  })

  it('id KHÃ”NG trong dyingIds â†’ khÃ´ng Ä‘á»¥ng gÃ¬ tá»›i forceFinalizeDeath, Ä‘i tháº³ng qua gridView', () => {
    const scene = createScene()
    const sprite = makeSprite('sprite')

    scene._gridView = { getOrCreateSprite: vi.fn(() => sprite) }

    const result = scene.getOrCreateSprite('enemy-2', 0, 'Enemy', 4)

    expect(result).toBe(sprite)
  })
})
