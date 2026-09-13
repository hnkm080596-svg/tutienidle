// combat-animation-playback (Wave-3 large-file split) — tach tu CombatScene.ts.
// Entity animation playback + death sequence: registerCombatAnimations(),
// id→clip-prefix resolution, play-with-idle-return, and the deferred
// death finalize (animation + rotate/fade tween both done before destroy).
// All scene state (sprites/dyingIds/dotAccumulators/positionInterp) stays
// on the scene as Internal module-boundary members — this module only
// carries the mechanism.
import Phaser from 'phaser'

import { resolveEnemyTextureKey } from '@/game/support/EnemyArt'
import {
  combatAnimationKey,
  type CombatAnimationCatalogue,
  type CombatAnimationName,
} from '@/presentation/art/CombatEntityPresentation'
import { presentationFor } from '@/presentation/art/CombatPresentationCatalogue'

import type { CombatScene, CombatScenePayload } from '../CombatScene'
import { PLAYER_ID } from './combatConstants'
import type { EntitySprite } from './combatTypes'

export class CombatAnimationPlayback {
  constructor(private readonly scene: CombatScene) {}

  /**
   * Combat Art Pipeline Task 9 (2026-09-05) — đăng ký Phaser
   * Animation cho MỘT entity (player theo profile, hoặc enemy theo texture
   * key) từ animation set đã build sẵn. `scene.anims` là AnimationManager
   * DÙNG CHUNG toàn Game (không riêng theo scene) nên guard `exists()` bắt
   * buộc — gọi lại nhiều lần qua các trận/scene KHÔNG được tạo trùng key.
   */
  // `entityKey` không dùng trực tiếp trong thân hàm (mỗi clip đã tự mang
  // đủ key/sheetKey) — giữ tham số vì chữ ký khớp cách gọi tại create() và
  // để log/mở rộng sau này (vd. gắn nhãn lỗi khi generateFrameNumbers rỗng).
  registerCombatAnimations(_entityKey: string, clips: CombatAnimationCatalogue): void {
    for (const clip of Object.values(clips)) {
      if (this.scene.anims.exists(clip.key)) {
        continue
      }

      this.scene.anims.create({
        key: clip.key,
        // Frame NAMES, not indices — the clip describes a TexturePacker atlas
        // (Spec B §3.1/§4.2), so a frame is `frame_` + a zero-padded number
        // + `.png` rather than an offset into a uniform grid.
        frames: this.scene.anims.generateFrameNames(clip.sheetKey, {
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

  /**
   * Map id RUNTIME (PLAYER_ID hoặc enemy id dạng '<templateId>_<uuid>')
   * sang ENTITY KEY dùng làm tiền tố animation clip — khớp ĐÚNG cách
   * CombatPreload.ts build animation set (player theo profile hiện hành,
   * enemy theo resolveEnemyTextureKey()). undefined khi actor không có
   * animation set nào (enemy ngoài batch Mortal, vẫn Rectangle) — caller
   * PHẢI guard trước khi gọi sprite.play().
   */
  entityAnimationKeyPrefix(actorId: string): string | undefined {
    if (actorId === PLAYER_ID) {
      return this.scene.playerProfile.combatTextureKey
    }

    return resolveEnemyTextureKey(actorId)
  }

  /**
   * Spec B §3.2 — is this entity's art ANIMATED, or a still image?
   *
   * One question, asked of the catalogue, in the one place that plays clips.
   * A static entity is not a degraded animated one: it has no clips at all, and
   * asking for one is a no-op rather than a fallback.
   */
  isAnimatedEntity(entityKey: string): boolean {
    return presentationFor(entityKey)?.kind === 'animated'
  }

  /**
   * Phát 1 animation clip cho actor NẾU sprite là Sprite thật (kind ===
   * 'sprite') VÀ clip đó đã được registerCombatAnimations() đăng ký —
   * no-op an toàn cho Rectangle fallback (enemy ngoài batch) hoặc clip
   * chưa/không tồn tại (test fixture không stub scene.anims đầy đủ).
   *
   * Spec B §3.2 (2026-09-11) — AND the entity's art is animated. Before this,
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
      return
    }

    const gameSprite = sprite.rect as Phaser.GameObjects.Sprite

    gameSprite.play(key)

    // Spec B §4.5 — `idle` is the state every other clip returns to.
    //
    // Without this a one-shot leaves the sprite frozen on its last frame until
    // something else happens to play. `death` is excluded: it has its own
    // completion handler in onDeath(), which finalises and destroys the sprite,
    // and returning a corpse to idle would undo it.
    if (name === 'idle' || name === 'death') {
      return
    }

    const idleKey = combatAnimationKey(prefix, 'idle')

    if (!this.scene.anims.exists(idleKey) || typeof gameSprite.once !== 'function') {
      return
    }

    gameSprite.once(
      Phaser.Animations.Events.ANIMATION_COMPLETE,
      (anim: Phaser.Animations.Animation) => {
        if (anim.key !== key) {
          return
        }

        gameSprite.play(idleKey)
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
   * Combat Art Pipeline Task 9 (2026-09-05) — dùng chung bởi onDeath() (event
   * 'death' thật) và reconcileCombatantSprites() (fallback khi entity mất
   * khỏi snapshot mà không có event riêng): đánh dấu dying, dọn DoT/cast bar,
   * phát animation '-death' NẾU sprite là Sprite thật + clip đã đăng ký, và
   * HOÃN destroy tới khi CẢ tween xoay/mờ CŨ lẫn animation (nếu có) đều xong
   * — spec §9: cleanup không được cắt ngang animation chết. Không có
   * animation hợp lệ → animDone giữ true ngay từ đầu, hành vi y hệt trước
   * Task 9 (chỉ chờ tween).
   *
   * Player KHÔNG BAO GIỜ bị destroy ở đây (giữ vị trí cuối dưới overlay kết
   * quả, xem onBattleEnd) — chỉ tween/animation chạy, isPlayer chặn nhánh
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

    // DoT accumulator — xóa bucket của target chết.
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

      // isPlayer: không destroy (xem doc). Identity check chặn double-
      // destroy/orphan khi id này đã bị forceFinalizeDeath() dọn sớm (tái
      // xuất hiện giữa lúc animation/tween cũ còn chạy, xem getOrCreateSprite()).
      if (isPlayer || scene.sprites.get(id) !== sprite) {
        return
      }

      scene.destroyEntitySprite(sprite)
      scene.sprites.delete(id)
      scene.dyingIds.delete(id)
      scene.positionInterp.delete(id)
    }

    if (sprite.kind === 'sprite') {
      // Spec B §3.2 — this path bypasses playCombatAnimation() because it needs
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

    // A playing death clip IS the body visual — the generic fall/fade tween
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
   * Dọn NGAY sprite đang ở giữa death sequence (animation/tween chưa xong) —
   * dùng khi id đó tái xuất hiện (xem getOrCreateSprite()) để tránh
   * beginDeathSequence() cũ đóng cửa nhầm sprite mới sau này. Đơn giản hơn
   * beginDeathSequence(): không cần chờ gì cả, huỷ NGAY.
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
