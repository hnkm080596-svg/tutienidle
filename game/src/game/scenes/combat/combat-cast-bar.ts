// R5 (AR-29) — CombatCastBar encapsulates its own private castBars map.
// Manages creation, tweening, positioning, and destruction of cast bars.
import type { CombatScene, CombatScenePayload } from '../CombatScene'
import { DEPTH_OVERLAY_UI } from '@/game/support/BattleLayers'
import { CAST_BAR_BG_COLOR, CAST_BAR_FILL_COLOR, CAST_BAR_HEIGHT, CAST_BAR_OFFSET_Y, CAST_NAME_COLOR } from './combatConstants'
import type { CastBarSprite, EntitySprite } from './combatTypes'

export class CombatCastBar {
  private castBarsMap = new Map<string, CastBarSprite>()

  get castBars(): Map<string, CastBarSprite> {
    return this.castBarsMap
  }

  set castBars(map: Map<string, CastBarSprite>) {
    this.castBarsMap = map
  }

  constructor(private readonly scene: CombatScene) {}

  onCastStart(event: CombatScenePayload) {
    const caster = this.scene.spriteFor(event.sourceId)

    if (!caster || !event.sourceId || !event.castTimeSeconds || event.castTimeSeconds <= 0) {
      return
    }

    this.destroyCastBar(event.sourceId)

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

    this.castBarsMap.set(event.sourceId, { bg, fill, widthPx })

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
    const existing = this.castBarsMap.get(id)

    if (!existing) {
      return
    }

    this.scene.tweens.killTweensOf(existing.fill)

    this.castBarsMap.delete(id)

    existing.bg.destroy()
    existing.fill.destroy()
  }

  destroyAll() {
    for (const id of [...this.castBarsMap.keys()]) {
      this.destroyCastBar(id)
    }
  }
}
