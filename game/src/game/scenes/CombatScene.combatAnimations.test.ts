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
import { createTestScene, patchScene } from './combat/combatTestHarness'
import { PLAYER_ID } from './combat/combatConstants'
import { CombatActionFeedback } from './combat/combat-action-feedback'
import { combatAnimationKey } from '@/presentation/art/CombatEntityPresentation'
import { PLACEHOLDER_ENTITY_KEY } from '@/presentation/art/CombatPresentationCatalogue'
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
        return { kind: 'animated', clips: {} as never }
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
  // Set-per-event matches Phaser's emitter: multiple once-listeners CAN be
  // armed on the same event (the stale-listener edge this suite pins).
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>()

  return {
    playCalls: [] as string[],
    textureCalls: [] as string[],
    offCalls: [] as [string, unknown][],
    texture: undefined as { key: string } | undefined,
    destroyed: false,
    play(key: string) {
      this.playCalls.push(key)
      return this
    },
    setTexture(key: string) {
      this.textureCalls.push(key)
      this.texture = { key }
      return this
    },
    once(event: string, handler: (...args: unknown[]) => void) {
      const s = listeners.get(event) ?? new Set()
      s.add(handler)
      listeners.set(event, s)
      return this
    },
    off(event: string, handler: (...args: unknown[]) => void) {
      listeners.get(event)?.delete(handler)
      this.offCalls.push([event, handler])
      return this
    },
    emit(event: string, ...args: unknown[]) {
      // once() handlers self-remove on fire, like Phaser.
      const s = listeners.get(event)
      for (const h of [...(s ?? [])]) {
        s?.delete(h)
        h(...args)
      }
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
  it('player â†’ character slug for a reskin-mapped profile (character-art-infra)', () => {
    const scene = createScene()

    // 'mortal' maps to 'zuofeng' in CHARACTER_RESKIN_MAP - the slug is the
    // entity key now, the profile texture key only for unmapped profiles.
    expect(scene.entityAnimationKeyPrefix(PLAYER_ID)).toBe('zuofeng')
  })

  it('enemy trong batch Mortal â†’ resolveEnemyTextureKey()', () => {
    const scene = createScene()

    expect(scene.entityAnimationKeyPrefix('mortal_savage_tiger_ab12')).toBe('mortal-savage-tiger-v1')
  })

  it('enemy ngoÃ i batch â†’ shared placeholder entity key (uniformity 2026-09-19 — never undefined)', () => {
    const scene = createScene()

    expect(scene.entityAnimationKeyPrefix('enemy_1')).toBe(PLACEHOLDER_ENTITY_KEY)
  })
})

describe('CombatScene â€” registerCombatAnimations() guard', () => {
  it('this.anims.exists() === false for every clip -> create() called for all 6 declared', () => {
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
        ['idle', 'standby', 'death', 'idle_to_standby', 'standby_to_idle', 'cultivate'].map((name) => [
          name,
          {
            key: combatAnimationKey('entity-x', name as never),
            sheetKey: `entity-x-${name}-sheet`,
            sheetUrl: '/x.png',
            frameWidth: 10,
            frameHeight: 10,
            frameCount: 1,
            frameRate: 1,
            repeat: ['idle', 'standby'].includes(name) ? -1 : 0,
          },
        ]),
      ),
    )

    expect(created).toHaveLength(6)
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
    expect(() => scene.playCombatAnimation(sprite, 'mortal_savage_tiger_1', 'idle_to_standby')).not.toThrow()
  })

  it('actorId resolves to the STATIC placeholder entity (enemy ngoÃ i batch) â†’ khÃ´ng play', () => {
    const scene = createScene()
    const sprite = makeSprite('sprite')

    scene.anims = { exists: () => true }
    scene.playCombatAnimation(sprite, 'enemy_1', 'idle_to_standby')

    expect((sprite.rect as ReturnType<typeof fakeGameSprite>).playCalls).toHaveLength(0)
  })

  it('clip chÆ°a Ä‘Äƒng kÃ½ (anims.exists false) â†’ khÃ´ng play', () => {
    const scene = createScene()
    const sprite = makeSprite('sprite')

    scene.anims = { exists: () => false }
    scene.playCombatAnimation(sprite, PLAYER_ID, 'idle_to_standby')

    expect((sprite.rect as ReturnType<typeof fakeGameSprite>).playCalls).toHaveLength(0)
  })

  it('player + clip Ä‘Ã£ Ä‘Äƒng kÃ½ â†’ play(Ä‘Ãºng key theo entity key hiá»‡n hÃ nh)', () => {
    // character-art-infra: the reskinned profile resolves to 'zuofeng', which
    // IS animated in the real catalogue - no promotion needed.
    const scene = createScene()
    const sprite = makeSprite('sprite')
    const playerKey = scene.entityAnimationKeyPrefix(PLAYER_ID)!

    scene.anims = { exists: () => true }
    scene.playCombatAnimation(sprite, PLAYER_ID, 'idle_to_standby')

    expect((sprite.rect as ReturnType<typeof fakeGameSprite>).playCalls).toEqual([
      combatAnimationKey(playerKey, 'idle_to_standby'),
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
    scene.playCombatAnimation(sprite, 'mortal_savage_tiger_1', 'idle_to_standby')
    scene.playCombatAnimation(sprite, 'mortal_savage_tiger_1', 'death')
    scene.playCombatAnimation(sprite, 'mortal_savage_tiger_1', 'standby_to_idle')

    expect((sprite.rect as ReturnType<typeof fakeGameSprite>).playCalls).toEqual([])
  })

  it('promoting that same enemy to animated makes it play — one data edit, no playback code (§9 criterion 7)', () => {
    // This is the criterion that protects §3.2's reversibility. The ONLY
    // difference from the test above is the catalogue entry.
    PROMOTED.set('mortal-savage-tiger-v1', 'animated')

    const scene = createScene()
    const sprite = makeSprite('sprite')

    scene.anims = { exists: () => true }
    scene.playCombatAnimation(sprite, 'mortal_savage_tiger_1', 'idle_to_standby')

    expect((sprite.rect as ReturnType<typeof fakeGameSprite>).playCalls[0]).toBe(
      combatAnimationKey('mortal-savage-tiger-v1', 'idle_to_standby'),
    )
  })

  it('a transition clip chains into its destination loop when it completes (B7)', () => {
    // idle_to_standby's completion lands on the standby LOOP, not on idle -
    // the transition is the road into the engaged state, not a detour out.
    const scene = createScene()
    const sprite = makeSprite('sprite')
    const gameSprite = sprite.rect as ReturnType<typeof fakeGameSprite>
    const profileKey = scene.entityAnimationKeyPrefix(PLAYER_ID)!

    scene.anims = { exists: () => true }
    scene.playCombatAnimation(sprite, PLAYER_ID, 'idle_to_standby')

    expect(gameSprite.playCalls).toEqual([combatAnimationKey(profileKey, 'idle_to_standby')])

    gameSprite.emit('animationcomplete', {
      key: combatAnimationKey(profileKey, 'idle_to_standby'),
    })

    expect(gameSprite.playCalls).toEqual([
      combatAnimationKey(profileKey, 'idle_to_standby'),
      combatAnimationKey(profileKey, 'standby'),
    ])
  })

  // Atlas-miss registers the clip name with ZERO frames (generateFrameNames
  // on an absent texture). exists() says true, but playing an empty anim
  // must not swap the avatar fallback texture - the degrade path treats
  // zero-frame clips as missing.
  it('a clip registered with zero frames does not play - avatar fallback stays drawn', () => {
    const scene = createScene()
    const sprite = makeSprite('sprite')
    const gameSprite = sprite.rect as ReturnType<typeof fakeGameSprite>
    const playerKey = scene.entityAnimationKeyPrefix(PLAYER_ID)!

    scene.anims = {
      exists: (key: string) => key === combatAnimationKey(playerKey, 'idle'),
      get: () => ({ frames: [] }),
    }
    scene.playCombatAnimation(sprite, PLAYER_ID, 'idle')

    expect(gameSprite.playCalls).toEqual([])
  })

  // character-art-infra: 'ult' is OPTIONAL per entity - an ultimate cast on a
  // set without authored ult art degrades to the attack clip (which itself
  // degrades to the standby snap), never silently to standby. This is the
  // MISSING_CLIP_FALLBACK chain; a refactor that drops it would revert ults
  // to a standby snap with no failing test.
  it("an 'ult' the entity never authored degrades to its attack clip, then standby", () => {
    const scene = createScene()
    const sprite = makeSprite('sprite')
    const gameSprite = sprite.rect as ReturnType<typeof fakeGameSprite>
    const playerKey = scene.entityAnimationKeyPrefix(PLAYER_ID)!
    const ultKey = combatAnimationKey(playerKey, 'ult')
    const attackKey = combatAnimationKey(playerKey, 'attack')

    scene.anims = { exists: (key: string) => key !== ultKey }
    scene.playCombatAnimation(sprite, PLAYER_ID, 'ult')

    expect(gameSprite.playCalls).toEqual([attackKey])

    gameSprite.emit('animationcomplete', { key: attackKey })

    expect(gameSprite.playCalls).toEqual([
      attackKey,
      combatAnimationKey(playerKey, 'standby'),
    ])
  })

  // character-art-infra: 'ult' plays ONLY for casts whose turn_cast_start
  // carried slotRole 'ultimate' - a basic/special cast on the same sprite
  // must still take the attack clip.
  it("onAttack picks 'ult' for slotRole 'ultimate' and 'attack' otherwise", () => {
    const scene = createScene()
    const sprite = makeSprite('sprite')
    const gameSprite = sprite.rect as ReturnType<typeof fakeGameSprite>
    const playerKey = scene.entityAnimationKeyPrefix(PLAYER_ID)!

    scene.sprites.set(PLAYER_ID, sprite)
    patchScene(scene, { _vfxSpawner: { playHorizontalImpulse: vi.fn() } })
    scene.anims = { exists: () => true }

    scene.onAttack({ sourceId: PLAYER_ID, slotRole: 'ultimate' })
    expect(gameSprite.playCalls).toEqual([combatAnimationKey(playerKey, 'ult')])

    gameSprite.playCalls.length = 0
    scene.onAttack({ sourceId: PLAYER_ID, slotRole: 'special' })
    expect(gameSprite.playCalls).toEqual([combatAnimationKey(playerKey, 'attack')])

    gameSprite.playCalls.length = 0
    scene.onAttack({ sourceId: PLAYER_ID })
    expect(gameSprite.playCalls).toEqual([combatAnimationKey(playerKey, 'attack')])
  })

  // Clean-B F-CB2-02: slotRole 'none' marks a declared turn that is not a
  // slot cast (charge-continuation/skipped) - no lunge, no clip.
  it("onAttack with slotRole 'none' plays neither impulse nor clip", () => {
    const scene = createScene()
    const sprite = makeSprite('sprite')
    const gameSprite = sprite.rect as ReturnType<typeof fakeGameSprite>
    const impulse = vi.fn()

    scene.sprites.set(PLAYER_ID, sprite)
    patchScene(scene, { _vfxSpawner: { playHorizontalImpulse: impulse } })
    scene.anims = { exists: () => true }

    scene.onAttack({ sourceId: PLAYER_ID, slotRole: 'none' })

    expect(impulse).not.toHaveBeenCalled()
    expect(gameSprite.playCalls).toEqual([])
  })

  // Clean-B F-CB2-04: the dying check precedes the impulse - a resume
  // replay of a dead actor's cast must not shove the corpse.
  it('onAttack on a dying actor skips both impulse and clip', () => {
    const scene = createScene()
    const sprite = makeSprite('sprite')
    const gameSprite = sprite.rect as ReturnType<typeof fakeGameSprite>
    const impulse = vi.fn()

    scene.sprites.set(PLAYER_ID, sprite)
    scene.playerDying = true
    patchScene(scene, { _vfxSpawner: { playHorizontalImpulse: impulse } })
    scene.anims = { exists: () => true }

    scene.onAttack({ sourceId: PLAYER_ID, slotRole: 'ultimate' })

    expect(impulse).not.toHaveBeenCalled()
    expect(gameSprite.playCalls).toEqual([])
  })

  // Clean-A2 R2-F1: a late cast/standby event mid-death must not replace
  // the death clip - its key-filtered ANIMATION_COMPLETE would never fire,
  // wedging the corpse (enemies) or replaying casts under the overlay
  // (player). Death owns the animation channel until finalize.
  it('a dying entity ignores further clip plays - the death sequence owns the channel', () => {
    const scene = createScene()
    const sprite = makeSprite('sprite')
    const gameSprite = sprite.rect as ReturnType<typeof fakeGameSprite>
    const enemyId = 'mortal_wild_boar_dead1'

    scene.sprites.set(enemyId, sprite)
    scene.dyingIds.add(enemyId)
    scene.anims = { exists: () => true }

    scene.playCombatAnimation(sprite, enemyId, 'attack')
    scene.playCombatAnimation(sprite, enemyId, 'idle')

    expect(gameSprite.playCalls).toEqual([])

    // Player path: same gate via playerDying.
    const playerSprite = makeSprite('sprite')
    const playerGame = playerSprite.rect as ReturnType<typeof fakeGameSprite>
    scene.sprites.set(PLAYER_ID, playerSprite)
    scene.playerDying = true

    scene.playCombatAnimation(playerSprite, PLAYER_ID, 'attack')

    expect(playerGame.playCalls).toEqual([])
  })

  // Clean-R1 F1: the ANIMATION_COMPLETE chain plays the destination clip -
  // on a partial sheet failure the destination registers zero frames
  // (zuofeng splits clips across sheets) and a bare play() would throw.
  // The destination hop must take the same empty-clip guard as the start.
  it('a zero-frame destination clip degrades to the sibling loop - no freeze, no throw', () => {
    const scene = createScene()
    const sprite = makeSprite('sprite')
    const gameSprite = sprite.rect as ReturnType<typeof fakeGameSprite>
    const playerKey = scene.entityAnimationKeyPrefix(PLAYER_ID)!
    const attackKey = combatAnimationKey(playerKey, 'attack')
    const standbyKey = combatAnimationKey(playerKey, 'standby')
    const idleKey = combatAnimationKey(playerKey, 'idle')

    scene.anims = {
      exists: () => true,
      // standby is the sheet that "failed to load" - registered, zero frames
      get: (key: string) => ({ frames: key === standbyKey ? [] : [{ f: 1 }] }),
    }

    scene.playCombatAnimation(sprite, PLAYER_ID, 'attack')
    expect(gameSprite.playCalls).toEqual([attackKey])

    gameSprite.emit('animationcomplete', { key: attackKey })

    // Destination empty -> MISSING_CLIP_FALLBACK degrades standby -> idle
    // instead of freezing the sprite on the last attack frame (Clean-R2 F3).
    expect(gameSprite.playCalls).toEqual([attackKey, idleKey])
  })

  it('a double loop miss (idle AND standby empty) terminates the chain - no infinite fallback', () => {
    const scene = createScene()
    const sprite = makeSprite('sprite')
    const gameSprite = sprite.rect as ReturnType<typeof fakeGameSprite>
    const playerKey = scene.entityAnimationKeyPrefix(PLAYER_ID)!
    const attackKey = combatAnimationKey(playerKey, 'attack')
    const standbyKey = combatAnimationKey(playerKey, 'standby')
    const idleKey = combatAnimationKey(playerKey, 'idle')

    scene.anims = {
      exists: () => true,
      // BOTH loop sheets failed - idle<->standby cross-reference must not
      // recurse forever.
      get: (key: string) => ({ frames: key === standbyKey || key === idleKey ? [] : [{ f: 1 }] }),
    }

    scene.playCombatAnimation(sprite, PLAYER_ID, 'attack')
    gameSprite.emit('animationcomplete', { key: attackKey })

    // Chain terminates: standby empty -> idle empty -> cycle guard -> stop.
    expect(gameSprite.playCalls).toEqual([attackKey])
  })

  // Clean-B F-CB2-01: a loop request arriving while a one-shot is armed must
  // NOT interrupt the clip - it defers, and the armed listener consumes it
  // in place of the clip's default destination on completion.
  it('standby_to_idle during an armed attack defers until the clip completes', () => {
    const scene = createScene()
    const sprite = makeSprite('sprite')
    const gameSprite = sprite.rect as ReturnType<typeof fakeGameSprite>
    const playerKey = scene.entityAnimationKeyPrefix(PLAYER_ID)!
    const attackKey = combatAnimationKey(playerKey, 'attack')
    const standbyKey = combatAnimationKey(playerKey, 'standby')
    const idleKey = combatAnimationKey(playerKey, 'idle')
    const transitionKey = combatAnimationKey(playerKey, 'standby_to_idle')

    // Zuofeng authors no transition clips: standby_to_idle resolves to the
    // idle LOOP - which is exactly the request shape that must defer.
    scene.anims = { exists: (key: string) => key !== transitionKey }

    scene.playCombatAnimation(sprite, PLAYER_ID, 'attack')
    expect(gameSprite.playCalls).toEqual([attackKey])

    // Turn end fires standby_to_idle mid-clip: nothing plays yet.
    scene.playCombatAnimation(sprite, PLAYER_ID, 'standby_to_idle')
    expect(gameSprite.playCalls).toEqual([attackKey])
    expect(sprite.deferredLoopRequest).toBe('idle')

    // Clip completes -> listener consumes the deferral, landing on idle
    // instead of the clip's own standby destination.
    gameSprite.emit('animationcomplete', { key: attackKey })
    expect(gameSprite.playCalls).toEqual([attackKey, idleKey])
    expect(sprite.deferredLoopRequest).toBeUndefined()
  })

  it('without a deferral the one-shot still lands on its own destination', () => {
    const scene = createScene()
    const sprite = makeSprite('sprite')
    const gameSprite = sprite.rect as ReturnType<typeof fakeGameSprite>
    const playerKey = scene.entityAnimationKeyPrefix(PLAYER_ID)!
    const attackKey = combatAnimationKey(playerKey, 'attack')
    const standbyKey = combatAnimationKey(playerKey, 'standby')

    scene.anims = { exists: () => true }

    scene.playCombatAnimation(sprite, PLAYER_ID, 'attack')
    gameSprite.emit('animationcomplete', { key: attackKey })

    expect(gameSprite.playCalls).toEqual([attackKey, standbyKey])
  })

  // Clean-B F-CB2-03: when the WHOLE loop chain is unplayable (partial
  // multi-sheet loss) the sprite restores the still art it drew before the
  // one-shot instead of freezing on the clip's last frame.
  it('a fully-empty loop chain restores the pre-clip base texture', () => {
    const scene = createScene()
    const sprite = makeSprite('sprite')
    const gameSprite = sprite.rect as ReturnType<typeof fakeGameSprite>
    const playerKey = scene.entityAnimationKeyPrefix(PLAYER_ID)!
    const attackKey = combatAnimationKey(playerKey, 'attack')
    const standbyKey = combatAnimationKey(playerKey, 'standby')
    const idleKey = combatAnimationKey(playerKey, 'idle')

    gameSprite.texture = { key: 'zuofeng-avatar' }
    scene.textures = { exists: (key: string) => key === 'zuofeng-avatar' }
    scene.anims = {
      exists: () => true,
      get: (key: string) => ({ frames: key === standbyKey || key === idleKey ? [] : [{ f: 1 }] }),
    }

    scene.playCombatAnimation(sprite, PLAYER_ID, 'attack')
    gameSprite.emit('animationcomplete', { key: attackKey })

    // standby empty -> idle empty -> terminate -> avatar still art restored.
    expect(gameSprite.textureCalls).toEqual(['zuofeng-avatar'])
    expect(gameSprite.playCalls).toEqual([attackKey])
  })

  it('a transition the entity never authored snaps straight to its destination loop', () => {
    // Placeholder catalogues have no transition clips: asking for one must
    // still REACH the engaged loop, or an unauthored entity would freeze in
    // the wrong state. Zuofeng has none either - the character dump carries
    // no transition art.
    const scene = createScene()
    const sprite = makeSprite('sprite')
    const gameSprite = sprite.rect as ReturnType<typeof fakeGameSprite>
    const profileKey = scene.entityAnimationKeyPrefix(PLAYER_ID)!
    const transitionKey = combatAnimationKey(profileKey, 'idle_to_standby')

    scene.anims = { exists: (key: string) => key !== transitionKey }
    scene.playCombatAnimation(sprite, PLAYER_ID, 'idle_to_standby')

    expect(gameSprite.playCalls).toEqual([combatAnimationKey(profileKey, 'standby')])
  })

  it('a DIFFERENT clip completing does not yank the player to the destination', () => {
    const scene = createScene()
    const sprite = makeSprite('sprite')
    const gameSprite = sprite.rect as ReturnType<typeof fakeGameSprite>

    scene.anims = { exists: () => true }
    scene.playCombatAnimation(sprite, PLAYER_ID, 'idle_to_standby')

    gameSprite.emit('animationcomplete', { key: 'some-other-clip' })

    expect(gameSprite.playCalls).toHaveLength(1)
  })

  // Clean-A F3 / Clean-B F1: replaying the SAME one-shot mid-flight used to
  // leave the first once-listener orphaned on the emitter - on completion it
  // fired before the live one, consumed the deferred intent, and the live
  // listener then overrode it (latest intent lost). The arming path now
  // removes the superseded listener first.
  it('a same-key one-shot re-arm removes the superseded listener - latest intent wins', () => {
    const scene = createScene()
    const sprite = makeSprite('sprite')
    const gameSprite = sprite.rect as ReturnType<typeof fakeGameSprite>
    const playerKey = scene.entityAnimationKeyPrefix(PLAYER_ID)!
    const attackKey = combatAnimationKey(playerKey, 'attack')
    const idleKey = combatAnimationKey(playerKey, 'idle')

    scene.anims = { exists: (key: string) => !key.endsWith('_to_idle') && !key.endsWith('idle_to_standby') }

    scene.playCombatAnimation(sprite, PLAYER_ID, 'attack')
    const first = sprite.pendingTransitionListener
    scene.playCombatAnimation(sprite, PLAYER_ID, 'attack')
    const second = sprite.pendingTransitionListener

    expect(first).toBeDefined()
    expect(second).toBeDefined()
    expect(second).not.toBe(first)
    // The first listener was explicitly removed from the emitter.
    expect(gameSprite.offCalls).toEqual([['animationcomplete', first]])

    // A deferred loop request arrives while the second attack plays.
    scene.playCombatAnimation(sprite, PLAYER_ID, 'standby_to_idle')
    expect(sprite.deferredLoopRequest).toBe('idle')

    // Completion: only the live listener may consume the deferral.
    gameSprite.emit('animationcomplete', { key: attackKey })
    expect(gameSprite.playCalls).toEqual([attackKey, attackKey, idleKey])
    expect(sprite.deferredLoopRequest).toBeUndefined()
  })

  // Clean-A F4: deferral must not hinge on the destination clip being
  // registered - a partial-sheet miss (destination gone, clip playing) would
  // otherwise let a later loop request truncate the in-flight one-shot.
  it('a loop request still defers when the one-shot destination registration is missing', () => {
    const scene = createScene()
    const sprite = makeSprite('sprite')
    const gameSprite = sprite.rect as ReturnType<typeof fakeGameSprite>
    const playerKey = scene.entityAnimationKeyPrefix(PLAYER_ID)!
    const attackKey = combatAnimationKey(playerKey, 'attack')
    const idleKey = combatAnimationKey(playerKey, 'idle')

    // standby (attack's destination) is entirely unregistered and the
    // transition clip is unauthored: the clip still arms, and completion
    // routes through the guarded chain to idle.
    const transitionKey = combatAnimationKey(playerKey, 'standby_to_idle')
    const standbyKey = combatAnimationKey(playerKey, 'standby')
    scene.anims = {
      exists: (key: string) => key !== transitionKey && key !== standbyKey,
      get: () => ({ frames: [{ f: 1 }] }),
    }

    scene.playCombatAnimation(sprite, PLAYER_ID, 'attack')
    expect(sprite.pendingTransitionListener).toBeDefined()

    scene.playCombatAnimation(sprite, PLAYER_ID, 'standby_to_idle')
    expect(gameSprite.playCalls).toEqual([attackKey]) // still deferred, not truncated
    expect(sprite.deferredLoopRequest).toBe('idle')

    gameSprite.emit('animationcomplete', { key: attackKey })
    expect(gameSprite.playCalls[gameSprite.playCalls.length - 1]).toBe(idleKey)
  })

  it('idle does not re-trigger itself, and death is left to onDeath()', () => {
    // Chaining idle off idle would restart a looping clip on every completion;
    // chaining it off death would return a corpse to standing before the
    // destroy handler runs.
    const scene = createScene()
    const profileKey = scene.entityAnimationKeyPrefix(PLAYER_ID)!

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

    expect(() => scene.playCombatAnimation(sprite, undefined, 'death')).not.toThrow()
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

  it('an ANIMATED enemy (promoted, §9 criterion 7) plays -death at once - the clip is the body visual: no fall/fade tween, destroy waits for ANIMATION_COMPLETE only', () => {
    PROMOTED.set('mortal-savage-tiger-v1', 'animated')

    const scene = createScene()
    const { tweens, tweenConfigs } = stubTweensCapturingOnComplete()

    scene.tweens = tweens
    scene.anims = { exists: () => true }

    const sprite = makeSprite('sprite')
    const gameSprite = sprite.rect as ReturnType<typeof fakeGameSprite>

    scene.sprites.set('mortal_savage_tiger_1', sprite)
    scene._gridView = { destroyEntitySprite: vi.fn() }

    scene.beginDeathSequence(sprite, 'mortal_savage_tiger_1')

    expect(gameSprite.playCalls).toEqual([combatAnimationKey('mortal-savage-tiger-v1', 'death')])

    // The generic rotate/fade tween must NOT run on the body while a real
    // clip plays - it would rotate the sprite mid-clip and hide the death
    // animation. The only tween added is the accessory fade (label/shadow/
    // health bar), which carries no onComplete gate.
    expect(tweenConfigs.every((config) => config.onComplete === undefined)).toBe(true)
    expect(scene._gridView.destroyEntitySprite).not.toHaveBeenCalled()
    expect(scene.sprites.has('mortal_savage_tiger_1')).toBe(true)

    // Destroy is gated by ANIMATION_COMPLETE alone.
    gameSprite.emit('animationcomplete', { key: combatAnimationKey('mortal-savage-tiger-v1', 'death') })

    expect(scene._gridView.destroyEntitySprite).toHaveBeenCalledTimes(1)
    expect(scene.sprites.has('mortal_savage_tiger_1')).toBe(false)
    expect(scene.dyingIds.has('mortal_savage_tiger_1')).toBe(false)
  })

  // Clean-A F-1: an atlas-miss registers the death clip NAME with zero
  // frames (exists() true) - play() on it throws on frames[0]. The death
  // path must treat an empty clip as missing and die by the tween, exactly
  // like a static entity.
  it('an empty (zero-frame) death clip is skipped - the entity dies by the tween path', () => {
    PROMOTED.set('mortal-savage-tiger-v1', 'animated')

    const scene = createScene()
    const { tweens, tweenConfigs } = stubTweensCapturingOnComplete()

    scene.tweens = tweens
    scene.anims = { exists: () => true, get: () => ({ frames: [] }) }

    const sprite = makeSprite('sprite')
    const gameSprite = sprite.rect as ReturnType<typeof fakeGameSprite>

    scene.sprites.set('mortal_savage_tiger_1', sprite)
    scene._gridView = { destroyEntitySprite: vi.fn() }

    scene.beginDeathSequence(sprite, 'mortal_savage_tiger_1')

    // No play() on an empty clip; the body tween carries the death.
    expect(gameSprite.playCalls).toEqual([])

    const mainTweenOnComplete = tweenConfigs[0]!.onComplete as () => void

    mainTweenOnComplete()

    expect(scene._gridView.destroyEntitySprite).toHaveBeenCalledTimes(1)
    expect(scene.sprites.has('mortal_savage_tiger_1')).toBe(false)
  })

  it('animationcomplete cá»§a Má»˜T clip khÃ¡c (key khÃ´ng khá»›p) khÃ´ng kÃ­ch hoáº¡t finalize', () => {
    PROMOTED.set('mortal-savage-tiger-v1', 'animated')

    const scene = createScene()
    const { tweens } = stubTweensCapturingOnComplete()

    scene.tweens = tweens
    scene.anims = { exists: () => true }

    const sprite = makeSprite('sprite')
    const gameSprite = sprite.rect as ReturnType<typeof fakeGameSprite>

    scene.sprites.set('mortal_savage_tiger_1', sprite)
    scene._gridView = { destroyEntitySprite: vi.fn() }

    scene.beginDeathSequence(sprite, 'mortal_savage_tiger_1')

    gameSprite.emit('animationcomplete', { key: 'some-other-clip' })

    expect(scene._gridView.destroyEntitySprite).not.toHaveBeenCalled()
  })

  it('player â€” KHÃ”NG BAO GIá»œ destroy dÃ¹ cáº£ tween láº«n animation Ä‘á»u xong (giá»¯ vá»‹ trÃ­ cuá»‘i dÆ°á»›i overlay káº¿t quáº£)', () => {
    PROMOTED.set(PLAYER_VISUAL_PROFILES.mortal.combatTextureKey, 'animated')

    const scene = createScene()
    const { tweens } = stubTweensCapturingOnComplete()

    scene.tweens = tweens
    scene.anims = { exists: () => true }

    const sprite = makeSprite('sprite')
    const gameSprite = sprite.rect as ReturnType<typeof fakeGameSprite>

    scene.sprites.set(PLAYER_ID, sprite)
    scene._gridView = { destroyEntitySprite: vi.fn() }

    scene.beginDeathSequence(sprite, PLAYER_ID)

    expect(scene.playerDying).toBe(true)
    // Emit with the ACTUAL key the death path played (the reskin slug, not the
    // profile texture key) - otherwise animDone never resolves and finalize
    // never runs, so the isPlayer guard would pass even if deleted.
    gameSprite.emit('animationcomplete', {
      key: combatAnimationKey(scene.entityAnimationKeyPrefix(PLAYER_ID)!, 'death'),
    })

    expect(scene._gridView.destroyEntitySprite).not.toHaveBeenCalled()
    expect(scene.sprites.has(PLAYER_ID)).toBe(true)
  })

  it('reset after player death - onBattleStart() replays idle so the corpse frame does not carry into the new battle', () => {
    PROMOTED.set(PLAYER_VISUAL_PROFILES.mortal.combatTextureKey, 'animated')

    const scene = createScene()
    const { tweens } = stubTweensCapturingOnComplete()

    scene.tweens = tweens
    scene.anims = { exists: () => true }
    scene.statuses = new Map()
    scene.backdropGeneration = 0
    scene.spawnVfxHandles = new Map()
    scene.turnCountdownSpawnVfxHandles = new Map()
    scene.entityVisual = { hidePlayer: vi.fn(), clear: vi.fn(), markPlayerMaterialized: vi.fn() }
    scene._telegraph = { reset: vi.fn() }
    scene._castBar = { clear: vi.fn(), destroyCastBar: vi.fn() }
    scene._vfxSpawner = { statusTooltip: undefined }
    scene._positionInterp = { snapInterpolationTarget: vi.fn(), delete: vi.fn(), clear: vi.fn(), interpolations: new Map() }
    scene._gridView = { destroyEntitySprite: vi.fn(), resetVisual: vi.fn(), positionSprite: vi.fn() }

    const sprite = makeSprite('sprite')
    const gameSprite = sprite.rect as ReturnType<typeof fakeGameSprite>

    scene.sprites.set(PLAYER_ID, sprite)

    scene.beginDeathSequence(sprite, PLAYER_ID)

    const playerKey = scene.entityAnimationKeyPrefix(PLAYER_ID)!

    expect(gameSprite.playCalls).toEqual([
      combatAnimationKey(playerKey, 'death'),
    ])

    scene.onBattleStart()

    expect(gameSprite.playCalls.at(-1)).toBe(
      combatAnimationKey(playerKey, 'idle'),
    )
    expect(scene.playerDying).toBe(false)
  })
})

describe('CombatScene.getOrCreateSprite() â€” id tÃ¡i xuáº¥t hiá»‡n giá»¯a death sequence (Task 5 review: orphan/double-destroy)', () => {
  it('id Ä‘ang dyingIds â†’ sprite cÅ© bá»‹ finalize NGAY (destroy) trÆ°á»›c khi táº¡o sprite má»›i, vÃ  tÃ­n hiá»‡u completion CÅ¨ khÃ´ng Ä‘á»¥ng tá»›i sprite Má»šI', () => {
    const scene = createScene()

    scene.tweens = { killTweensOf: vi.fn(), add: vi.fn() }
    scene.anims = { exists: () => true }

    const oldSprite = makeSprite('sprite')
    const newSprite = makeSprite('sprite')

    scene.sprites.set('mortal_savage_tiger_1', oldSprite)
    scene.dyingIds.add('mortal_savage_tiger_1')

    const destroyEntitySprite = vi.fn((sprite: unknown) => {
      if (sprite === oldSprite) {
        ;(oldSprite.rect as ReturnType<typeof fakeGameSprite>).destroy()
      }
    })

    scene._gridView = {
      destroyEntitySprite,
      getOrCreateSprite: vi.fn(() => {
        scene.sprites.set('mortal_savage_tiger_1', newSprite)
        return newSprite
      }),
    }

    const result = scene.getOrCreateSprite('mortal_savage_tiger_1', 0, 'Boar', 4)

    // Sprite cÅ© bá»‹ dá»n NGAY (khÃ´ng chá» animation/tween nÃ o) â€” khÃ´ng rÆ¡i vÃ o
    // beginDeathSequence() láº§n hai.
    expect(destroyEntitySprite).toHaveBeenCalledWith(oldSprite)
    expect((oldSprite.rect as ReturnType<typeof fakeGameSprite>).destroyed).toBe(true)
    expect(scene.dyingIds.has('mortal_savage_tiger_1')).toBe(false)

    // getOrCreateSprite() tháº­t (gridView) Ä‘Æ°á»£c gá»i Ä‘á»ƒ táº¡o sprite Má»šI.
    expect(result).toBe(newSprite)
    expect(scene.sprites.get('mortal_savage_tiger_1')).toBe(newSprite)
  })

  it('id KHÃ”NG trong dyingIds â†’ khÃ´ng Ä‘á»¥ng gÃ¬ tá»›i forceFinalizeDeath, Ä‘i tháº³ng qua gridView', () => {
    const scene = createScene()
    const sprite = makeSprite('sprite')

    scene._gridView = { getOrCreateSprite: vi.fn(() => sprite) }

    const result = scene.getOrCreateSprite('enemy-2', 0, 'Enemy', 4)

    expect(result).toBe(sprite)
  })
})

describe('CombatScene — onTurnStandbyComplete dying-entity tween channel (CR1-F1)', () => {
  it('standby tail does NOT kill the death fall-tween on a dying enemy corpse', () => {
    const scene = createScene()
    const sprite = makeSprite('rect')

    scene.sprites.set('mortal_savage_tiger_1', sprite)
    scene.dyingIds.add('mortal_savage_tiger_1')

    const killTweensOf = vi.fn()
    scene.tweens = { killTweensOf }
    scene.anims = { exists: () => false }

    new CombatActionFeedback(scene as never).onTurnStandbyComplete({ actorId: 'mortal_savage_tiger_1' })

    expect(killTweensOf).not.toHaveBeenCalled()
  })

  it('standby tail does NOT kill the fall-tween on a dying player either', () => {
    const scene = createScene()
    const sprite = makeSprite('rect')

    scene.sprites.set(PLAYER_ID, sprite)
    scene.playerDying = true

    const killTweensOf = vi.fn()
    scene.tweens = { killTweensOf }
    scene.anims = { exists: () => false }

    new CombatActionFeedback(scene as never).onTurnStandbyComplete({ actorId: PLAYER_ID })

    expect(killTweensOf).not.toHaveBeenCalled()
  })

  it('living entity still gets the rect tween reset — baseline behavior unchanged', () => {
    const scene = createScene()
    const sprite = makeSprite('rect', fakeGameSprite())

    scene.sprites.set('mortal_savage_tiger_1', sprite)

    const killTweensOf = vi.fn()
    scene.tweens = { killTweensOf }
    scene.anims = { exists: () => false }

    new CombatActionFeedback(scene as never).onTurnStandbyComplete({ actorId: 'mortal_savage_tiger_1' })

    expect(killTweensOf).toHaveBeenCalledWith(sprite.rect)
  })
})
