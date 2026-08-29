// combat-cast-bar (ui-discoverability-refactor-plan.md Â§3.2) â€” tÃ¡ch tá»«
// CombatScene.ts: CAST BAR + windup (thanh tiáº¿n Ä‘á»™ niá»‡m chiÃªu + náº£y tÃªn
// skill). Module nháº­n dependency tÆ°á»ng minh qua `scene`.
import type { CombatScene, CombatScenePayload } from '../CombatScene'
import { DEPTH_OVERLAY_UI } from '@/game/support/BattleLayers'
import { CAST_BAR_BG_COLOR, CAST_BAR_FILL_COLOR, CAST_BAR_HEIGHT, CAST_BAR_OFFSET_Y, CAST_NAME_COLOR } from './combatConstants'
import type { CastBarSprite, EntitySprite } from './combatTypes'

export class CombatCastBar {
  constructor(private readonly scene: CombatScene) {}

  // Cast Time (2026-08-21) â€” skill cÃ³ cast time > 0 niá»‡m trong má»™t
  // khoáº£ng thá»i gian TRÆ¯á»šC khi hiá»‡u á»©ng thi triá»ƒn â€” váº½ 1 thanh tiáº¿n Ä‘á»™
  // phÃ­a trÃªn Ä‘áº§u unit + náº£y TÃŠN skill lÃªn (khÃ¡c 'cast' cÅ© chá»‰ flash mÃ u).
  onCastStart(event: CombatScenePayload) {
    const caster = this.scene.spriteFor(event.sourceId)

    if (!caster || !event.sourceId || !event.castTimeSeconds || event.castTimeSeconds <= 0) {
      return
    }

    this.scene.destroyCastBar(event.sourceId)

    const widthPx = this.scene.characterWidth
    const y = this.scene.entityHeadY(caster) - CAST_BAR_OFFSET_Y

    const bg = this.scene.add
      .rectangle(caster.rect.x, y, widthPx, CAST_BAR_HEIGHT, CAST_BAR_BG_COLOR)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0x000000, 0.5)
      .setDepth(DEPTH_OVERLAY_UI + 3)

    const fill = this.scene.add
      .rectangle(
        caster.rect.x - widthPx / 2,
        y,
        widthPx - 2,
        CAST_BAR_HEIGHT - 2,
        CAST_BAR_FILL_COLOR,
      )
      .setOrigin(0, 0.5)
      .setScale(0, 1)
      .setDepth(DEPTH_OVERLAY_UI + 3)

    this.scene.castBars.set(event.sourceId, { bg, fill, widthPx })

    this.scene.tweens.add({
      targets: fill,
      scaleX: 1,
      duration: event.castTimeSeconds * 1000,
      ease: 'Linear',
    })

    if (event.skillName) {
      this.scene.showFloatingText(caster, event.skillName, CAST_NAME_COLOR)
    }
  }

  positionCastBar(sprite: EntitySprite, castBar: CastBarSprite) {
    const y = this.scene.entityHeadY(sprite) - CAST_BAR_OFFSET_Y

    castBar.bg.setPosition(sprite.rect.x, y)
    castBar.fill.setPosition(sprite.rect.x - castBar.widthPx / 2, y)
  }

  destroyCastBar(id: string) {
    const existing = this.scene.castBars.get(id)

    if (!existing) {
      return
    }

    this.scene.tweens.killTweensOf(existing.fill)

    this.scene.castBars.delete(id)

    existing.bg.destroy()
    existing.fill.destroy()
  }
}


