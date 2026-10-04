// combat-animation-playback (Wave-3 large-file split) - tach tu CombatScene.ts.
// Entity animation playback + death sequence: registerCombatAnimations(),
// id->clip-prefix resolution, play-with-idle-return, and the deferred
// death finalize (animation + rotate/fade tween both done before destroy).
// All scene state (sprites/dyingIds/dotAccumulators/positionInterp) stays
// on the scene as Internal module-boundary members - this module only
// carries the mechanism.
import Phaser from 'phaser'

import {
  atlasClipsOf,
  combatAnimationKey,
  type AtlasClip,
  type CombatAnimationCatalogue,
  type CombatAnimationName,
} from '@/presentation/art/CombatEntityPresentation'
import {
  animatedArtFormFor,
  presentationFor,
  resolveCombatEntityKey,
  resolvePlayerEntityKey,
} from '@/presentation/art/CombatPresentationCatalogue'
import type { SkillCastPresentation } from '@/core/battle/turn/SkillPresentationFacts'

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
  // Authored attack clips are play-once fired from inside the standby state
  // (a turn is always engaged when 'attack' fires) - return there, not to
  // idle, or the sprite would drop out of its engaged loop mid-turn.
  attack: 'standby',
  // Character ults follow the attack contract (play-once cast inside the
  // engaged state) - same destination.
  ult: 'standby',
}

/**
 * Degradation for one-shot clips the entity never authored - checked when
 * `anims.exists(name)` fails, BEFORE TRANSITION_DESTINATION. An 'ult' cast
 * on a set without an authored ult still deserves its attack tell; 'attack'
 * itself falls through to the standby snap like before.
 */
const MISSING_CLIP_FALLBACK: Partial<Record<CombatAnimationName, CombatAnimationName>> = {
  ult: 'attack',
  // A loop whose sheet is missing must not freeze the sprite on the last
  // transition frame (Clean-R2 F3): degrade to the sibling loop. idle<->standby
  // cross-reference, so chain resolution below tracks visited names to break
  // the cycle when BOTH loops are unplayable.
  standby: 'idle',
  idle: 'standby',
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
  for (const clip of atlasClipsOf(clips)) {
    if (anims.exists(clip.key)) {
      continue
    }

    anims.create({
      key: clip.key,
      // Frame NAMES, not indices - the clip describes a TexturePacker atlas
      // (Spec B sec. 3.1/sec. 4.2), so a frame is `frame_` + a zero-padded number
      // + `.png` rather than an offset into a uniform grid.
      frames: clip.frameSequence?.map(index => ({ key: clip.sheetKey,
        frame: `${clip.framePrefix}${String(index).padStart(clip.zeroPad, '0')}${clip.frameSuffix}` }))
        ?? anims.generateFrameNames(clip.sheetKey, {
        prefix: clip.framePrefix,
        suffix: clip.frameSuffix,
        start: clip.firstFrame,
        end: clip.lastFrame,
        zeroPad: clip.zeroPad,
      }),
      frameRate: clip.frameRate,
      repeat: clip.repeat,
    })

    // A zero-frame registration (atlas not loaded yet) must not lock the key
    // forever: anims.exists() would then veto a later re-registration for the
    // Game's whole lifetime even if the texture arrives (Clean-A2 CR1-F2).
    // Drop the empty entry - playback already treats a missing key exactly
    // like an empty one, so the degrade path is unchanged.
    if (anims.get?.(clip.key)?.frames.length === 0) {
      anims.remove?.(clip.key)
    }
  }
}

/**
 * Which candidate in the canonical cast-clip order actually played
 * (impact-sync). 'none' reports that NO authored animation went out - the
 * caller runs the cast on recipe timing. The source is reported, not
 * guessed: a test can distinguish a resolved-skill cast clip from the
 * generic attack fallthrough instead of only seeing "some clip played".
 */
export interface ResolvedCastPlayback {
  clip?: AtlasClip
  source: 'resolved-skill' | 'root-skill' | 'slot-role' | 'ultimate' | 'attack' | 'none'
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
      // Character reskin (character-art-infra): a mapped profile resolves to
      // its character slug before the static texture key, same amendment as
      // the enemy branch below.
      return resolvePlayerEntityKey(
        this.scene.playerProfile.id,
        this.scene.playerProfile.combatTextureKey,
        { armed: this.scene.playerArmed },
      )
    }

    // Uniformity (2026-09-19): an unregistered entity resolves to the shared
    // placeholder, never to "nothing" - the placeholder's `kind` matches the
    // mode, so isAnimatedEntity() still gates whether anything plays.
    return resolveCombatEntityKey(actorId)
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

    // Death owns the sprite's animation channel (Clean-A2 R2-F1): a late
    // turn_cast_start / turn_standby_complete arriving mid-death would
    // replace the death clip, and the key-filtered ANIMATION_COMPLETE
    // listener would then never fire - animDone stays false forever and the
    // corpse wedges (enemies) or replays casts under the result overlay
    // (player). Same guard as combat-player-visual's dying check.
    const dying = actorId === PLAYER_ID
      ? this.scene.playerDying
      : this.scene.dyingIds.has(actorId)

    if (dying) {
      return
    }

    const prefix = this.entityAnimationKeyPrefix(actorId)

    if (!prefix || !this.isAnimatedEntity(prefix)) {
      return
    }

    // Resolve the requested clip through the degradation chain BEFORE
    // playing (iterative, not recursive - idle<->standby cross-reference
    // would ping-pong forever when both loops are unplayable). Atlas-miss
    // registers the clip NAME with zero frames - an empty anim exists()
    // but must not play (`anims.get` is absent on sparse test doubles;
    // then exists() rules).
    let resolved: CombatAnimationName | undefined = name
    const visited = new Set<CombatAnimationName>([name])

    while (resolved !== undefined) {
      const candidateKey = combatAnimationKey(prefix, resolved)
      const empty = this.scene.anims.get?.(candidateKey)?.frames.length === 0

      if (this.scene.anims.exists(candidateKey) && !empty) {
        break
      }

      const next: CombatAnimationName | undefined = MISSING_CLIP_FALLBACK[resolved] ?? TRANSITION_DESTINATION[resolved]
      resolved = next !== undefined && !visited.has(next) ? next : undefined
      if (resolved !== undefined) {
        visited.add(resolved)
      }
    }

    if (resolved === undefined) {
      // Every link in the chain is unplayable (partial multi-sheet loss):
      // restore the still art the sprite drew before the one-shot rather
      // than freezing on the clip's last frame (Clean-B F-CB2-03).
      const base = sprite.pendingBaseTextureKey
      sprite.pendingBaseTextureKey = undefined
      sprite.deferredLoopRequest = undefined
      if (base !== undefined && this.scene.textures?.exists?.(base)) {
        ;(sprite.rect as Phaser.GameObjects.Sprite).setTexture?.(base)
      }
      return
    }

    // A loop request arriving while a one-shot is mid-flight must wait for
    // the clip to finish - playing it now truncates the cast's strike
    // frames every routine turn (Clean-B F-CB2-01). The armed completion
    // listener consumes the deferred request in place of the clip's own
    // default destination (latest intent wins).
    const destination = TRANSITION_DESTINATION[resolved]

    if (destination === undefined && sprite.pendingTransitionListener) {
      sprite.deferredLoopRequest = resolved
      return
    }

    this.playResolvedClip(sprite, actorId, combatAnimationKey(prefix, resolved), destination)
  }

  /**
   * Play exactly ONE authored clip, or nothing (impact-sync): same guards
   * as the generic path - real sprite, live actor, registered non-empty
   * anim - and then the clip itself, with NO fallback inside. A clip that
   * cannot play returns false so the caller's own resolution order decides
   * what tries next; the old silent 'attack' hop here is what made a
   * missing cast clip report timing for an animation that never played.
   */
  tryPlayExactAtlasClip(
    sprite: EntitySprite,
    actorId: string | undefined,
    clip: AtlasClip | undefined,
  ): boolean {
    if (clip === undefined || sprite.kind !== 'sprite' || actorId === undefined) {
      return false
    }

    const dying = actorId === PLAYER_ID
      ? this.scene.playerDying
      : this.scene.dyingIds.has(actorId)

    if (dying) {
      return false
    }

    const empty = this.scene.anims.get?.(clip.key)?.frames.length === 0

    if (!this.scene.anims.exists(clip.key) || empty) {
      return false
    }

    this.playResolvedClip(sprite, actorId, clip.key, 'standby')
    return true
  }

  /**
   * The ONE cast-clip resolver (impact-sync canonical order). Returns the
   * clip that ACTUALLY played - the caller passes its impact timing to the
   * presentation runner, so the timing clip IS the played clip and no
   * silent fallback can drive an ACK the viewer never saw.
   *
   * Order (plan sec.22): the resolved skill id's cast clip -> the root
   * skill id's (queued/composite wrappers resolve to the skill that
   * authored them) -> the declared slot role's -> the authored ult clip
   * (only for slot role 'ultimate') -> the authored attack clip -> none.
   * slotRole 'none' is not a lookup miss: it marks a turn that is not a
   * cast at all, so no authored animation is attempted.
   */
  startCastPlayback(
    sprite: EntitySprite,
    actorId: string | undefined,
    cast: SkillCastPresentation,
  ): ResolvedCastPlayback {
    if (cast.slotRole === 'none') {
      return { source: 'none' }
    }

    const entityKey = actorId !== undefined ? this.entityAnimationKeyPrefix(actorId) : undefined
    // A static-kind entity has no clips at all - not a degraded animated
    // one (same contract playCombatAnimation states). Resolution ends at
    // 'none' so the cast runs on recipe timing instead of pulling a
    // placeholder clip over the entity's still art.
    if (entityKey === undefined || !this.isAnimatedEntity(entityKey)) {
      return { source: 'none' }
    }
    const catalogue = animatedArtFormFor(entityKey)
    const castClips = catalogue?.castClips

    const resolved = castClips?.[cast.resolvedSkillId]
    if (resolved && this.tryPlayExactAtlasClip(sprite, actorId, resolved)) {
      return { clip: resolved, source: 'resolved-skill' }
    }

    const root = castClips?.[cast.rootSkillId]
    if (root && this.tryPlayExactAtlasClip(sprite, actorId, root)) {
      return { clip: root, source: 'root-skill' }
    }

    const bySlot = castClips?.[`role:${cast.slotRole}`]
    if (bySlot && this.tryPlayExactAtlasClip(sprite, actorId, bySlot)) {
      return { clip: bySlot, source: 'slot-role' }
    }

    if (
      cast.slotRole === 'ultimate' &&
      catalogue?.ult &&
      this.tryPlayExactAtlasClip(sprite, actorId, catalogue.ult)
    ) {
      return { clip: catalogue.ult, source: 'ultimate' }
    }

    if (catalogue?.attack && this.tryPlayExactAtlasClip(sprite, actorId, catalogue.attack)) {
      return { clip: catalogue.attack, source: 'attack' }
    }

    return { source: 'none' }
  }

  /**
   * Shared tail of the one-shot paths: swap the sprite onto `key`, then arm
   * the completion listener that lands the entity on `destination` (or on a
   * deferred loop request that arrived mid-clip). `destination ===
   * undefined` means the playing key is a loop - no listener is armed, and
   * the pre-one-shot base texture reference is cleared.
   */
  private playResolvedClip(
    sprite: EntitySprite,
    actorId: string,
    key: string,
    destination: CombatAnimationName | undefined,
  ): void {
    const gameSprite = sprite.rect as Phaser.GameObjects.Sprite

    if (destination !== undefined && sprite.pendingBaseTextureKey === undefined) {
      // Capture the still art before the one-shot swaps it - the restore
      // path needs it if the whole loop chain turns out unplayable.
      sprite.pendingBaseTextureKey = gameSprite.texture?.key
    }

    gameSprite.play(key)

    // Arm the completion handler only when the clip ACTUALLY playing is a
    // one-shot. Loops ('idle'/'standby'/'cultivate') never emit
    // ANIMATION_COMPLETE so a listener on them sits dead forever
    // (Clean-B2 CR2-F1); 'death' has its own lifecycle in beginDeathSequence.
    if (destination === undefined) {
      sprite.pendingBaseTextureKey = undefined
      return
    }

    // Arm whenever the clip ACTUALLY playing is a one-shot - even when the
    // destination registration is missing/empty. The listener routes through
    // playCombatAnimation, which walks the same exists/empty/substitute chain,
    // so an unloadable destination degrades to base-restore instead of leaving
    // the door open for a later loop request to truncate the in-flight clip
    // (deferral keys on this listener's presence).
    if (typeof gameSprite.once !== 'function') {
      return
    }

    const listener = (anim: Phaser.Animations.Animation) => {
      if (anim.key !== key || sprite.pendingTransitionListener !== listener) {
        return
      }

      sprite.pendingTransitionListener = undefined

      // Newest intent wins: a loop requested mid-clip (deferredLoopRequest)
      // supersedes the clip's default destination.
      const next = sprite.deferredLoopRequest ?? destination
      sprite.deferredLoopRequest = undefined

      // Route through playCombatAnimation: the destination may be an
      // atlas-miss clip on ANOTHER sheet (zuofeng splits clips across
      // sheets - partial load failure leaves it registered-but-empty),
      // and the guarded path applies the same exists/empty/substitute
      // chain instead of throwing on frames[0].
      this.playCombatAnimation(sprite, actorId, next)
    }

    // A same-key re-arm while the previous one-shot is still mid-flight
    // leaves the old once-listener orphaned on the emitter - remove it so a
    // stale handler cannot consume the deferred intent ahead of the live one.
    if (sprite.pendingTransitionListener && typeof gameSprite.off === 'function') {
      gameSprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE, sprite.pendingTransitionListener)
    }

    sprite.pendingTransitionListener = listener
    gameSprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, listener)
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
    const alreadyDying = isPlayer ? scene.playerDying : scene.dyingIds.has(id)

    // Re-entry guard (Clean-A2 CR1-F3): a second death trigger for the same id
    // would replay the clip and stack duplicate fades. Real callers dedup
    // upstream, but the sequence itself owns the invariant.
    if (alreadyDying) {
      return
    }

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
    // The idle-bob tween lives on sprite.idle - a static corpse would keep
    // breathing through its fall/fade without this kill (Clean-A2 CR1-F4).
    if (sprite.idle) {
      scene.tweens.killTweensOf(sprite.idle)
    }
    // Death also voids any armed/deferred playback bookkeeping - the corpse
    // owns the animation channel from here on.
    sprite.pendingTransitionListener = undefined
    sprite.deferredLoopRequest = undefined
    sprite.pendingBaseTextureKey = undefined
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

      // Same atlas-miss hazard playCombatAnimation guards above: an empty
      // clip registers under its name (exists() true) but play() throws on
      // frames[0] - skip to the tween path exactly as if no clip existed.
      const deathEmpty = deathKey ? scene.anims.get?.(deathKey)?.frames.length === 0 : false

      if (deathKey && scene.anims.exists(deathKey) && !deathEmpty) {
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
