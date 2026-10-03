// CombatGridViewHost (Battlefield Slot spec, 2026-09-06) - be mat API ma
// CombatGridView can tu scene chu cua no. Tach ra de CombatScene (combat
// that) VA TranPhapCombatPreviewScene (panel Tran Phap) co the dung chung
// dung 1 class CombatGridView thay vi moi ben tu viet lai logic sprite/
// animation - xem spec sec1.
import type Phaser from 'phaser'
import type { BattleGridProjection } from '@/presentation/geometry/BattleGridProjection'
import type { EntitySprite } from './combatTypes'

export interface CombatGridViewHost {
  readonly add: Phaser.GameObjects.GameObjectFactory
  readonly physics: Phaser.Physics.Arcade.ArcadePhysics
  readonly textures: Phaser.Textures.TextureManager
  // resetVisual() only - Phaser.Scene subclass da co san `tweens`.
  readonly tweens: Phaser.Tweens.TweenManager

  readonly isPerspective: boolean
  readonly projection: BattleGridProjection | undefined
  readonly gridGraphics: Phaser.GameObjects.Graphics | undefined
  readonly usingArtBackdrop: boolean
  readonly arenaRect: Phaser.GameObjects.Rectangle | undefined
  readonly characterWidth: number
  readonly characterHeight: number
  readonly playerSourceSize: { w: number; h: number }
  readonly playerProfile: { id: string; combatTextureKey: string }
  // Armed/unarmed discriminator for the mortal reskin (art-seam wave,
  // 2026-09-29): undefined resolves the canonical armed default.
  readonly playerArmed?: boolean
  readonly sprites: Map<string, EntitySprite>
  // resetVisual() only - host khong can interpolate that van thoa type
  // bang 1 Map rong (xem TranPhapCombatPreviewScene, Task 4).
  // S3 (AR-29): read-only view - hosts must not mutate interpolation state.
  readonly interpolations: ReadonlyMap<string, unknown>
  entityFootMinY: number
  entityFootMaxY: number

  /**
   * Texture key dung cho sprite khi placeholder texture cua entity khong
   * ton tai (double-fallback). Combat that tra undefined -> Rectangle;
   * panel Tran Phap tra ve sheet placeholder dung chung cho moi combatant.
   */
  fallbackSpriteTextureKey(id: string): string | undefined

  /**
   * Kick the entity's idle state right after sprite creation - a no-op for
   * entities whose presentation is static (playCombatAnimation guards), and
   * the reason an animated-mode entity starts on its idle loop rather than a
   * frozen first frame (uniformity, 2026-09-19).
   */
  startEntityIdle(sprite: EntitySprite, id: string): void
}
