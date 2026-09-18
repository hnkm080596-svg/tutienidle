// combat-player-visual (ui-discoverability-refactor-plan.md §3.2) — tách
// từ CombatScene.ts: đổi hình thái Player (visual profile: texture +
// kích thước nguồn + bảng anchor) và body-anchor resolver (điểm neo VFX
// bám theo transform sprite hiện hành). Module nhận dependency tường
// minh qua `scene`.
import type Phaser from 'phaser'

import {
  PLAYER_VISUAL_PROFILES,
  type PlayerVisualProfileId,
} from '@/presentation/art/PlayerVisualProfiles'
import {
  atlasFrameName,
  presentationFor,
} from '@/presentation/art/CombatPresentationCatalogue'

import type { CombatScene } from '../CombatScene'
import { PLAYER_ID } from './combatConstants'

export class CombatPlayerVisual {
  constructor(private readonly scene: CombatScene) {}

  /**
   * Đổi hình thái Player (plan §4.3): thay texture + kích thước nguồn +
   * bảng anchor nhưng GIỮ NGUYÊN entity, position interpolation, HP/VFX
   * state — chỉ "lột xác" presentation.
   */
  applyPlayerVisualProfile(profileId: PlayerVisualProfileId) {
    const profile = PLAYER_VISUAL_PROFILES[profileId] ?? PLAYER_VISUAL_PROFILES.mortal

    this.scene.playerProfileId = profile.id

    this.scene.playerProfile = profile

    this.scene.playerSourceSize = { ...profile.combatSourceSize }

    const sprite = this.scene.sprites.get(PLAYER_ID)

    if (sprite && sprite.kind === 'sprite') {
      const gameSprite = sprite.rect as Phaser.GameObjects.Sprite
      const presentation = presentationFor(profile.combatTextureKey)

      // Mode-aware swap (uniformity, 2026-09-19): an animated profile trades
      // in atlas frames - set the idle sheet's first frame and restart the
      // idle loop; a static profile swaps PNGs as before.
      if (presentation?.kind === 'animated') {
        if (this.scene.textures.exists(presentation.clips.idle.sheetKey)) {
          gameSprite.setTexture(
            presentation.clips.idle.sheetKey,
            atlasFrameName(presentation.clips.idle, presentation.clips.idle.firstFrame),
          )
          this.scene.playCombatAnimation(sprite, PLAYER_ID, 'idle')
        }
      } else if (this.scene.textures.exists(profile.combatTextureKey)) {
        gameSprite.setTexture(profile.combatTextureKey)
      }

      // The new profile's art may carry different authored dimensions -
      // re-resolve sourceSize/extent so applySpriteSize sizes the NEW art,
      // not the stale box captured at creation.
      sprite.sourceSize = presentation?.kind === 'animated'
        ? { ...presentation.clips.idle.sourceSize }
        : presentation?.kind === 'static'
          ? { ...presentation.texture.sourceSize }
          : undefined
      sprite.extent = presentation?.kind === 'animated'
        ? { ...presentation.clips.idle.extent }
        : presentation?.kind === 'static'
          ? { ...presentation.texture.extent }
          : undefined

      this.scene.applySpriteSize(sprite)
    }
  }
}
