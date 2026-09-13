// R5 (AR-29) — CombatCastBar encapsulates its own private castBars map.
// Manages creation, tweening, positioning, and destruction of cast bars.
import type Phaser from 'phaser'
import { DEPTH_OVERLAY_UI } from '@/game/support/BattleLayers'
import { CAST_BAR_BG_COLOR, CAST_BAR_FILL_COLOR, CAST_BAR_HEIGHT, CAST_BAR_OFFSET_Y, CAST_NAME_COLOR } from './combatConstants'
import type { CastBarSprite, EntitySprite } from './combatTypes'

/** Payload the scene hands the cast bar on a cast-start event. */
export interface CastStartEvent {
  sourceId?: string
  castTimeSeconds?: number
  skillName?: string
}

/**
 * R11 (AR-29) — the narrow capability the cast bar consumes. The scene
 * satisfies this structurally; the helper never sees the full CombatScene.
 */
export interface CastBarHost {
  spriteFor(id: string | undefined): EntitySprite | undefined
  readonly characterWidth: number
  entityHeadY(sprite: EntitySprite): number
  readonly add: Pick<Phaser.GameObjects.GameObjectFactory, 'rectangle'>
  readonly tweens: Pick<Phaser.Tweens.TweenManager, 'add' | 'killTweensOf'>
  showFloatingText(sprite: EntitySprite, text: string, color: string): void
}

export class CombatCastBar {
  private castBarsMap = new Map<string, CastBarSprite>()

  // S3 (AR-29) — read-only exposure; mutation only via the owned
  // onCastStart/destroyCastBar/delete/clear API below.
  get castBars(): ReadonlyMap<string, CastBarSprite> {
    return this.castBarsMap
  }

  constructor(private readonly host: CastBarHost) {}

  onCastStart(event: CastStartEvent) {
    const caster = this.host.spriteFor(event.sourceId)

    if (!caster || !event.sourceId || !event.castTimeSeconds || event.castTimeSeconds <= 0) {
      return
    }

    this.destroyCastBar(event.sourceId)

    const widthPx = this.host.characterWidth
    const y = this.host.entityHeadY(caster) - CAST_BAR_OFFSET_Y

    const bg = this.host.add
      .rectangle(caster.rect.x, y, widthPx, CAST_BAR_HEIGHT, CAST_BAR_BG_COLOR)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0x000000, 0.5)
      .setDepth(DEPTH_OVERLAY_UI + 3)

    const fill = this.host.add
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

    this.host.tweens.add({
      targets: fill,
      scaleX: 1,
      duration: event.castTimeSeconds * 1000,
      ease: 'Linear',
    })

    if (event.skillName) {
      this.host.showFloatingText(caster, event.skillName, CAST_NAME_COLOR)
    }
  }

  positionCastBar(sprite: EntitySprite, castBar: CastBarSprite) {
    const y = this.host.entityHeadY(sprite) - CAST_BAR_OFFSET_Y

    castBar.bg.setPosition(sprite.rect.x, y)
    castBar.fill.setPosition(sprite.rect.x - castBar.widthPx / 2, y)
  }

  destroyCastBar(id: string) {
    const existing = this.castBarsMap.get(id)

    if (!existing) {
      return
    }

    this.host.tweens.killTweensOf(existing.fill)

    this.castBarsMap.delete(id)

    existing.bg.destroy()
    existing.fill.destroy()
  }

  destroyAll() {
    for (const id of [...this.castBarsMap.keys()]) {
      this.destroyCastBar(id)
    }
  }

  clear(): void {
    this.destroyAll()
  }

  delete(id: string): void {
    this.destroyCastBar(id)
  }
}
