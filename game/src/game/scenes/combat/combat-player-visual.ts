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

    this.scene.playerUsesStaticTexture = true

    const sprite = this.scene.sprites.get(PLAYER_ID)

    if (sprite && sprite.kind === 'sprite') {
      const gameSprite = sprite.rect as Phaser.GameObjects.Sprite

      if (this.scene.textures.exists(profile.combatTextureKey)) {
        gameSprite.setTexture(profile.combatTextureKey)
      }

      this.scene.applySpriteSize(sprite)
    }
  }
}
