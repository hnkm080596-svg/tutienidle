// R5 (AR-29) — CombatCastBar encapsulates its own private castBars map.
// M13: cleanup-only now — the creation path (onCastStart/CastStartEvent)
// was retired with the legacy 'cast'/'cast_start' producers; what remains
// is position/destroy/clear driven by entity-removal paths.
import type Phaser from 'phaser'
import { CAST_BAR_OFFSET_Y } from './combatConstants'
import type { CastBarSprite, EntitySprite } from './combatTypes'

/**
 * R11 (AR-29) — the narrow capability the cast bar consumes. The scene
 * satisfies this structurally; the helper never sees the full CombatScene.
 * M13: shrunk after onCastStart/CastStartEvent were retired (no live
 * 'cast_start' producer) — only the position/destroy/clear cleanup API
 * remains, driven by entity-removal paths.
 */
export interface CastBarHost {
  entityHeadY(sprite: EntitySprite): number
  readonly tweens: Pick<Phaser.Tweens.TweenManager, 'killTweensOf'>
}

export class CombatCastBar {
  private castBarsMap = new Map<string, CastBarSprite>()

  // S3 (AR-29) — read-only exposure; mutation only via the owned
  // destroyCastBar/delete/clear API below (no creation path remains —
  // the 'cast_start' producer was retired with the legacy engine, M13).
  get castBars(): ReadonlyMap<string, CastBarSprite> {
    return this.castBarsMap
  }

  constructor(private readonly host: CastBarHost) {}

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
