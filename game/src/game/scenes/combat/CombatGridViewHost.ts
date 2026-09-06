// CombatGridViewHost (Battlefield Slot spec, 2026-09-06) — bề mặt API mà
// CombatGridView cần từ scene chủ của nó. Tách ra để CombatScene (combat
// thật) VÀ TranPhapCombatPreviewScene (panel Trận Pháp) có thể dùng chung
// đúng 1 class CombatGridView thay vì mỗi bên tự viết lại logic sprite/
// animation — xem spec §1.
import type Phaser from 'phaser'
import type { BattleGridProjection } from '@/game/support/BattleGridProjection'
import type { EntitySprite } from './combatTypes'

export interface CombatGridViewHost {
  readonly add: Phaser.GameObjects.GameObjectFactory
  readonly physics: Phaser.Physics.Arcade.ArcadePhysics
  readonly textures: Phaser.Textures.TextureManager
  // resetVisual() only — Phaser.Scene subclass đã có sẵn `tweens`.
  readonly tweens: Phaser.Tweens.TweenManager

  readonly isPerspective: boolean
  readonly projection: BattleGridProjection | undefined
  readonly gridGraphics: Phaser.GameObjects.Graphics | undefined
  readonly usingArtBackdrop: boolean
  readonly arenaRect: Phaser.GameObjects.Rectangle | undefined
  readonly characterWidth: number
  readonly characterHeight: number
  readonly playerSourceSize: { w: number; h: number }
  readonly playerProfile: { combatTextureKey: string }
  readonly sprites: Map<string, EntitySprite>
  // resetVisual() only — host không cần interpolate thật vẫn thoả type
  // bằng 1 Map rỗng (xem TranPhapCombatPreviewScene, Task 4).
  readonly interpolations: Map<string, unknown>
  entityFootMinY: number
  entityFootMaxY: number

  /**
   * Texture key dùng cho sprite khi id không phải PLAYER_ID và không khớp
   * resolveEnemyTextureKey() — combat thật trả undefined (giữ NGUYÊN
   * Rectangle fallback cho enemy ngoài batch Mortal, hành vi hiện tại
   * không đổi); panel Trận Pháp trả về sheet placeholder dùng chung cho
   * mọi combatant.
   */
  fallbackSpriteTextureKey(id: string): string | undefined
}
