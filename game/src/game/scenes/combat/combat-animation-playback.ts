// combat-animation-playback (Wave-3 large-file split) - tach tu CombatScene.ts.
// Entity animation playback + death sequence: registerCombatAnimations(),
// id->clip-prefix resolution, play-with-idle-return, and the deferred
// death finalize (animation + rotate/fade tween both done before destroy).
// All scene state (sprites/dyingIds/dotAccumulators/positionInterp) stays
// on the scene as Internal module-boundary members - this module only
// carries the mechanism.
import Phaser from 'phaser'

import { resolveEnemyTextureKey } from '@/game/support/EnemyArt'
import {
  combatAnimationKey,
  type CombatAnimationCatalogue,
  type CombatAnimationName,
} from '@/presentation/art/CombatEntityPresentation'
import {
  PLACEHOLDER_ENTITY_KEY,
  presentationFor,
} from '@/presentation/art/CombatPresentationCatalogue'

import type { CombatScene, CombatScenePayload } from '../CombatScene'
import { PLAYER_ID } from './combatConstants'
import type { EntitySprite } from './combatTypes'

/**
 * Uniform contract (2026-09-19) - transition clips lead INTO a loop, never
 * back out on their own. Asking for a transition an entity never authored
 * (placeholder catalogues have none) plays its destination directly, so an
 * unauthored entity snaps to the right state instead of freezing mid-air.
 */
const TRANSITION_DESTINATION: Partial<Record<CombatAnimationName, CombatAnimationName>> = {
  idle_to_standby: 'standby',
  standby_to_idle: 'idle',
}

/**
 * Register every clip of one entity's catalogue on a scene's AnimationManager.
 * Shared by CombatScene (combat playback) and TranPhapCombatPreviewScene
 * (panel rendering) - the registration rule lives in exactly one place so the
 * two scenes can never build different frame sets from the same clip data.
 * `anims` is Game-wide: the `exists()` guard keeps re-entry idempotent.
 */
export function registerClipCatalogue(
  anims: Phaser.Animations.AnimationManager,
  clips: CombatAnimationCatalogue,
): void {
  for (const clip of Object.values(clips)) {
    if (anims.exists(clip.key)) {
      continue
    }

    anims.create({
      key: clip.key,
      // Frame NAMES, not indices - the clip describes a TexturePacker atlas
      // (Spec B sec. 3.1/sec. 4.2), so a frame is `frame_` + a zero-padded number
      // + `.png` rather than an offset into a uniform grid.
      frames: anims.generateFrameNames(clip.sheetKey, {
        prefix: clip.framePrefix,
        suffix: clip.frameSuffix,
        start: clip.firstFrame,
        end: clip.lastFrame,
        zeroPad: clip.zeroPad,
      }),
      frameRate: clip.frameRate,
      repeat: clip.repeat,
    })
  }
}

export class CombatAnimationPlayback {
  constructor(private readonly scene: CombatScene) {}

  /**
   * Combat Art Pipeline Task 9 (2026-09-05) - dang ky Phaser
   * Animation cho MOT entity (player theo profile, hoac enemy theo texture
   * key) tu animation set da build san. `scene.anims` la AnimationManager
   * DUNG CHUNG toan Game (khong rieng theo scene) nen guard `exists()` bat
   * buoc - goi lai nhieu lan qua cac tran/scene KHONG duoc tao trung key.
   */
  // `entityKey` khong dung truc tiep trong than ham (moi clip da tu mang
  // du key/sheetKey) - giu tham so vi chu ky khop cach goi tai create() va
  // de log/mo rong sau nay (vd. gan nhan loi khi generateFrameNumbers rong).
  registerCombatAnimations(_entityKey: string, clips: CombatAnimationCatalogue): void {
    registerClipCatalogue(this.scene.anims, clips)
  }

  /**
   * Map id RUNTIME (PLAYER_ID hoac enemy id dang '<templateId>_<uuid>')
   * sang ENTITY KEY dung lam tien to animation clip - khop DUNG cach
   * CombatPreload.ts build animation set (player theo profile hien hanh,
   * enemy theo resolveEnemyTextureKey()). Unregistered ids resolve to the
   * shared placeholder entity (uniformity 2026-09-19) - never undefined.
   */
  entityAnimationKeyPrefix(actorId: string): string | undefined {
    if (actorId === PLAYER_ID) {
      return this.scene.playerProfile.combatTextureKey
    }

    // Uniformity (2026-09-19): an unregistered entity resolves to the shared
    // placeholder, never to "nothing" - the placeholder's `kind` matches the
    // mode, so isAnimatedEntity() still gates whether anything plays.
    return resolveEnemyTextureKey(actorId) ?? PLACEHOLDER_ENTITY_KEY
  }

  /**
   * Spec B sec.3.2 - is this entity's art ANIMATED, or a still image?
   *
   * One question, asked of the catalogue, in the one place that plays clips.
   * A static entity is not a degraded animated one: it has no clips at all, and
   * asking for one is a no-op rather than a fallback.
   */
  isAnimatedEntity(entityKey: string): boolean {
    return presentationFor(entityKey)?.kind === 'animated'
  }

  /**
   * Phat 1 animation clip cho actor NEU sprite la Sprite that (kind ===
   * 'sprite') VA clip do da duoc registerCombatAnimations() dang ky -
   * no-op an toan cho Rectangle fallback (enemy ngoai batch) hoac clip
   * chua/khong ton tai (test fixture khong stub scene.anims day du).
   *
   * Spec B sec.3.2 (2026-09-11) - AND the entity's art is animated. Before this,
   * an enemy taking its turn played the 32-frame placeholder, which SWAPPED its
   * texture from its own Mortal PNG to a numbered stick figure for the length of
   * the clip. Enemies are static now; their motion is the bob in
   * `combat-grid-view.ts`.
   */
  playCombatAnimation(
    sprite: EntitySprite,
    actorId: string | undefined,
    name: CombatAnimationName,
  ): void {
    if (sprite.kind !== 'sprite' || actorId === undefined) {
      return
    }

    const prefix = this.entityAnimationKeyPrefix(actorId)

    if (!prefix || !this.isAnimatedEntity(prefix)) {
      return
    }

    const key = combatAnimationKey(prefix, name)

    if (!this.scene.anims.exists(key)) {
      // A transition the entity never authored snaps to its destination
      // loop - the engaged state is still reached, just without the road.
      const destination = TRANSITION_DESTINATION[name]

      if (destination !== undefined) {
        this.playCombatAnimation(sprite, actorId, destination)
      }

      return
    }

    const gameSprite = sprite.rect as Phaser.GameObjects.Sprite

    gameSprite.play(key)

    // Only one-shot transitions need a completion handler - they land on their
    // destination loop. Loops ('idle'/'standby'/'cultivate') never emit
    // ANIMATION_COMPLETE so a listener would sit stale, and 'death' has its
    // own lifecycle in beginDeathSequence.
    const destination = TRANSITION_DESTINATION[name]

    if (destination === undefined) {
      return
    }

    const destinationKey = combatAnimationKey(prefix, destination)

    if (!this.scene.anims.exists(destinationKey) || typeof gameSprite.once !== 'function') {
      return
    }

    gameSprite.once(
      Phaser.Animations.Events.ANIMATION_COMPLETE,
      (anim: Phaser.Animations.Animation) => {
        if (anim.key !== key) {
          return
        }

        gameSprite.play(destinationKey)
      },
    )
  }

  onDeath(event: CombatScenePayload): void {
    const id = event.targetId

    if (!id) {
      return
    }

    const sprite = this.scene.sprites.get(id)

    if (!sprite) {
      return
    }

    this.beginDeathSequence(sprite, id)
  }

  /**
   * Combat Art Pipeline Task 9 (2026-09-05) - dung chung boi onDeath() (event
   * 'death' that) va reconcileCombatantSprites() (fallback khi entity mat
   * khoi snapshot ma khong co event rieng): danh dau dying, don DoT/cast bar,
   * phat animation '-death' NEU sprite la Sprite that + clip da dang ky, va
   * HOAN destroy toi khi CA tween xoay/mo CU lan animation (neu co) deu xong
   * - spec sec.9: cleanup khong duoc cat ngang animation chet. Khong co
   * animation hop le -> animDone giu true ngay tu dau, hanh vi y het truoc
   * Task 9 (chi cho tween).
   *
   * Player KHONG BAO GIO bi destroy o day (giu vi tri cuoi duoi overlay ket
   * qua, xem onBattleEnd) - chi tween/animation chay, isPlayer chan nhanh
   * destroy trong finalize().
   */
  beginDeathSequence(sprite: EntitySprite, id: string): void {
    const scene = this.scene
    const isPlayer = id === PLAYER_ID

    if (isPlayer) {
      scene.playerDying = true
    } else {
      scene.dyingIds.add(id)
    }

    // DoT accumulator - xoa bucket cua target chet.
    for (const key of [...scene.dotAccumulators.keys()]) {
      if (key.split('|')[0] === id) {
        scene.dotAccumulators.delete(key)
      }
    }

    scene.destroyCastBar(id)

    scene.tweens.killTweensOf(sprite.rect)
    scene.tweens.killTweensOf(sprite)
    scene.tweens.killTweensOf(sprite.boost)
    sprite.offsetX = 0

    let tweenDone = false
    let animDone = true
    let deathClipPlaying = false

    const finalize = () => {
      if (!tweenDone || !animDone) {
        return
      }

      // isPlayer: khong destroy (xem doc). Identity check chan double-
      // destroy/orphan khi id nay da bi forceFinalizeDeath() don som (tai
      // xuat hien giua luc animation/tween cu con chay, xem getOrCreateSprite()).
      if (isPlayer || scene.sprites.get(id) !== sprite) {
        return
      }

      scene.destroyEntitySprite(sprite)
      scene.sprites.delete(id)
      scene.dyingIds.delete(id)
      scene.positionInterp.delete(id)
    }

    if (sprite.kind === 'sprite') {
      // Spec B sec.3.2 - this path bypasses playCombatAnimation() because it needs
      // the ANIMATION_COMPLETE callback, so it has to ask the same question
      // itself. A static enemy plays no death clip; the rotate/fade tween below
      // is what it dies by, and always was.
      const prefix = this.entityAnimationKeyPrefix(id)
      const animated = prefix !== undefined && this.isAnimatedEntity(prefix)
      const deathKey = animated && prefix ? combatAnimationKey(prefix, 'death') : undefined

      if (deathKey && scene.anims.exists(deathKey)) {
        animDone = false
        deathClipPlaying = true

        const gameSprite = sprite.rect as Phaser.GameObjects.Sprite

        gameSprite.play(deathKey)
        gameSprite.once(
          Phaser.Animations.Events.ANIMATION_COMPLETE,
          (anim: Phaser.Animations.Animation) => {
            if (anim.key !== deathKey) {
              return
            }

            animDone = true
            finalize()
          },
        )
      }
    }

    // A playing death clip IS the body visual - the generic fall/fade tween
    // below is the death visual only for entities with no clip. Running both
    // at once rotates and fades the sprite mid-clip and hides the animation
    // the player is supposed to see.
    if (deathClipPlaying) {
      tweenDone = true
    } else {
      scene.tweens.add({
        targets: sprite.rect,
        rotation: Math.PI / 2,
        alpha: 0,
        duration: 500,
        ease: 'Quad.easeIn',
        onComplete: () => {
          tweenDone = true
          finalize()
        },
      })
    }

    scene.tweens.add({
      targets: [
        sprite.label,
        sprite.shadow,
        sprite.healthBar?.background,
        sprite.healthBar?.fill,
      ].filter(Boolean),
      alpha: 0,
      duration: 500,
    })
  }

  /**
   * Don NGAY sprite dang o giua death sequence (animation/tween chua xong) -
   * dung khi id do tai xuat hien (xem getOrCreateSprite()) de tranh
   * beginDeathSequence() cu dong cua nham sprite moi sau nay. Don gian hon
   * beginDeathSequence(): khong can cho gi ca, huy NGAY.
   */
  forceFinalizeDeath(id: string): void {
    const scene = this.scene
    const sprite = scene.sprites.get(id)

    scene.dyingIds.delete(id)

    if (!sprite) {
      return
    }

    scene.tweens.killTweensOf(sprite.rect)
    scene.tweens.killTweensOf(sprite)
    scene.tweens.killTweensOf(sprite.boost)

    scene.destroyEntitySprite(sprite)
    scene.sprites.delete(id)
    scene.positionInterp.delete(id)
  }
}
