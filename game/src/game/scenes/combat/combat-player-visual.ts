// combat-player-visual (ui-discoverability-refactor-plan.md sec3.2) - tach
// tu CombatScene.ts: doi hinh thai Player (visual profile: texture +
// kich thuoc nguon + bang anchor) va body-anchor resolver (diem neo VFX
// bam theo transform sprite hien hanh). Module nhan dependency tuong
// minh qua `scene`.
import type Phaser from 'phaser'

import {
  PLAYER_VISUAL_PROFILES,
  type PlayerVisualProfileId,
} from '@/presentation/art/PlayerVisualProfiles'
import {
  atlasFrameName,
  presentationFor,
  resolvePlayerEntityKey,
  staticArtFormFor,
} from '@/presentation/art/CombatPresentationCatalogue'

import type { CombatScene } from '../CombatScene'
import { PLAYER_ID } from './combatConstants'

export class CombatPlayerVisual {
  constructor(private readonly scene: CombatScene) {}

  /**
   * Doi hinh thai Player (plan sec4.3): thay texture + kich thuoc nguon +
   * bang anchor nhung GIU NGUYEN entity, position interpolation, HP/VFX
   * state - chi "lot xac" presentation.
   */
  applyPlayerVisualProfile(profileId: PlayerVisualProfileId) {
    const profile = PLAYER_VISUAL_PROFILES[profileId] ?? PLAYER_VISUAL_PROFILES.mortal

    this.scene.playerProfileId = profile.id

    this.scene.playerProfile = profile

    this.scene.playerSourceSize = { ...profile.combatSourceSize }

    const sprite = this.scene.sprites.get(PLAYER_ID)

    // The corpse owns its final frame - a profile event during the death
    // sequence must not replay idle over the defeat visual.
    if (this.scene.playerDying) {
      return
    }

    if (sprite && sprite.kind === 'sprite') {
      const gameSprite = sprite.rect as Phaser.GameObjects.Sprite
      // Character reskin (character-art-infra): resolve the ENTITY key, not
      // the texture key - a mapped profile's skin is its character slug, and
      // swapping back to the profile PNG here would strip the reskin.
      const entityKey = resolvePlayerEntityKey(profile.id, profile.combatTextureKey, {
        armed: this.scene.playerArmed,
      })
      const presentation = presentationFor(entityKey)

      // Mode-aware swap (uniformity, 2026-09-19): an animated profile trades
      // in atlas frames - set the idle sheet's first frame and restart the
      // idle loop; a static profile swaps PNGs as before.
      if (presentation?.kind === 'animated') {
        if (this.scene.textures.exists(presentation.clips.idle.sheetKey)) {
          // Halt the in-flight clip AND drop its pending ANIMATION_COMPLETE
          // once-listener before the swap - otherwise it sits armed and can
          // stack up across repeated mid-clip swaps (Clean-R1 F3). Remove
          // exactly the transition listener, not the whole channel - a
          // blanket off() would silently drop any other armed listener
          // (Clean-B2 IN3-F1).
          gameSprite.anims.stop()
          if (sprite.pendingTransitionListener) {
            gameSprite.off('animationcomplete', sprite.pendingTransitionListener)
            sprite.pendingTransitionListener = undefined
          }
          sprite.deferredLoopRequest = undefined
          sprite.pendingBaseTextureKey = undefined
          gameSprite.setTexture(
            presentation.clips.idle.sheetKey,
            atlasFrameName(presentation.clips.idle, presentation.clips.idle.firstFrame),
          )
          this.scene.playCombatAnimation(sprite, PLAYER_ID, 'idle')
        }
      } else if (this.scene.textures.exists(profile.combatTextureKey)) {
        // Leaving atlas art for a static PNG: halt the in-flight clip first.
        // A pending ANIMATION_COMPLETE once-listener would otherwise replay
        // its standby destination on the OLD atlas and undo the swap; clips
        // still queue frames into a texture the sprite no longer draws.
        gameSprite.anims.stop()
        if (sprite.pendingTransitionListener) {
          gameSprite.off('animationcomplete', sprite.pendingTransitionListener)
          sprite.pendingTransitionListener = undefined
        }
        sprite.deferredLoopRequest = undefined
        sprite.pendingBaseTextureKey = undefined
        gameSprite.setTexture(profile.combatTextureKey)
      }

      // Sizing belongs to the texture actually drawn: on atlas-miss the
      // sprite keeps the avatar, so it must carry the avatar's box, not the
      // absent atlas frames' (finding: atlas-miss + profile event squashed
      // the fallback ~32% horizontally). On double-miss the sprite still
      // draws whatever the terminal fallback left (profile PNG / host
      // fallback) - resolve THAT texture's registered static form, never
      // the absent atlas metrics (Clean-A2 R2-F3).
      const atlasMissing =
        presentation?.kind === 'animated' &&
        !this.scene.textures.exists(presentation.clips.idle.sheetKey)
      const avatarForm = atlasMissing ? staticArtFormFor(entityKey) : undefined
      const survivingKey = (gameSprite.texture as { key?: string } | undefined)?.key
      // avatarDrawn asks what the sprite DRAWS, not what exists - an avatar
      // that arrived after sprite creation is loaded but not drawn, and
      // mislabelling its 512x512 box onto a profile PNG squashes the sprite
      // (Clean-B2 CR2-F3).
      const avatarDrawn =
        avatarForm !== undefined && survivingKey === avatarForm.texture.textureKey
      const survivingForm = survivingKey ? presentationFor(survivingKey) : undefined

      // Static branch: the absent-PNG edge must keep the prior metrics -
      // assigning the unloaded form's dims labels a box the sprite is not
      // drawing (Clean-B2 CR2-F3b).
      const staticDrawn =
        presentation?.kind === 'static' &&
        this.scene.textures.exists(presentation.texture.textureKey)

      sprite.sourceSize = presentation?.kind === 'animated'
        ? avatarDrawn
          ? { ...avatarForm!.texture.sourceSize }
          : atlasMissing && survivingForm?.kind === 'static'
            ? { ...survivingForm.texture.sourceSize }
            : { ...presentation.clips.idle.sourceSize }
        : staticDrawn
          ? { ...presentation.texture.sourceSize }
          : sprite.sourceSize
      sprite.extent = presentation?.kind === 'animated'
        ? avatarDrawn
          ? { ...avatarForm!.texture.extent }
          : atlasMissing && survivingForm?.kind === 'static'
            ? { ...survivingForm.texture.extent }
            : { ...presentation.clips.idle.extent }
        : staticDrawn
          ? { ...presentation.texture.extent }
          : sprite.extent

      this.scene.applySpriteSize(sprite)
    }
  }
}
