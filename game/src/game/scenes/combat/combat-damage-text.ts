// combat-damage-text (ui-discoverability-refactor-plan.md Â§3.2) â€” tÃ¡ch tá»«
// CombatScene.ts: Náº¢Y Sá» damage/crit/DoT gom 3 láº§n/giÃ¢y. Module nháº­n
// dependency tÆ°á»ng minh qua `scene` (má»i cross-call Ä‘á»u Ä‘i qua scene
// delegate Ä‘á»ƒ giá»¯ nguyÃªn seam test â€” showDotDamageNumber bá»‹ stub trong
// CombatScene.dotPresentation.test.ts).
import Phaser from 'phaser'

import type { CombatEvent } from '@/core/combat/CombatEvent'
import { formatNumber } from '@/core/format/NumberFormatter'

import type { CombatScene } from '../CombatScene'
import { DEPTH_OVERLAY_UI } from '@/game/support/BattleLayers'
import {
  CRITICAL_DAMAGE_COLOR,
  DAMAGE_DEALT_COLOR,
  DAMAGE_TAKEN_COLOR,
  DOT_TEXT_FLUSH_INTERVAL_MS,
  PLAYER_ID,
} from './combatConstants'
import type { EntitySprite } from './combatTypes'
import { formatDotDamageText } from './combatTextFormat'

export class CombatDamageText {
  constructor(private readonly scene: CombatScene) {}

  handleDamageEvent(event: CombatEvent) {
    const target = this.scene.spriteFor(event.targetId)

    if (!target || event.value === undefined || event.value <= 0) {
      return
    }

    // Gameplay khÃ´ng Ä‘á»•i tick rate (Â§7.1) â€” chá»‰ giáº£m táº§n suáº¥t trÃ¬nh diá»…n.
    if (event.effectId) {
      this.accumulateDotText(event)

      return
    }

    const isDamageToPlayer = event.targetId === PLAYER_ID
    const color = event.critical
      ? CRITICAL_DAMAGE_COLOR
      : isDamageToPlayer
        ? DAMAGE_TAKEN_COLOR
        : DAMAGE_DEALT_COLOR

    this.showDamageNumber(target, event.value, color, event.critical ?? false)
  }

  /** Bộ gom DoT — khóa `targetId|effectId|sourceId`, cửa sổ 1/3 giây. */
  private accumulateDotText(event: CombatEvent) {
    const key = `${event.targetId}|${event.effectId ?? ''}|${event.sourceId ?? ''}`

    let bucket = this.scene.dotAccumulators.get(key)

    if (!bucket) {
      bucket = { value: 0, nextFlushAt: this.scene.time.now + DOT_TEXT_FLUSH_INTERVAL_MS }

      this.scene.dotAccumulators.set(key, bucket)
    }

    bucket.value += event.value ?? 0
  }

  /** Flush cÃ¡c bucket Ä‘Ã£ Ä‘áº¿n háº¡n â€” Má»–I KHÃ“A Ä‘Ãºng 1 text (Â§7.2). */
  flushDueDotTexts() {
    this.scene.dotAccumulators ??= new Map()

    for (const [key, bucket] of [...this.scene.dotAccumulators]) {
      if (this.scene.time.now < bucket.nextFlushAt) {
        continue
      }

      this.scene.dotAccumulators.delete(key)

      const targetId = key.split('|')[0]

      const target = targetId ? this.scene.spriteFor(targetId) : undefined

      if (!target || bucket.value <= 0) {
        continue
      }

      const isDamageToPlayer = targetId === PLAYER_ID

      this.scene.showDotDamageNumber(target, bucket.value, isDamageToPlayer ? DAMAGE_TAKEN_COLOR : DAMAGE_DEALT_COLOR)
    }
  }

  // "Náº£y sá»‘" tháº­t sá»± â€” pop-in báº±ng Back.easeOut (báº­t náº£y quÃ¡ cá»¡ rá»“i
  // co vá», khÃ¡c easeOut tuyáº¿n tÃ­nh cá»§a showFloatingText) rá»“i má»›i trÃ´i
  // lÃªn/má» dáº§n, tÃ¡ch biá»‡t háº³n pháº§n chá»¯ "ChÃ­ Máº¡ng!"/"NÃ©!" (showFloatingText)
  // â€” jitter ngang nhá» Ä‘á»ƒ 2 hiá»‡u á»©ng khÃ´ng Ä‘Ã¨ khÃ­t lÃªn nhau khi cÃ¹ng
  // 1 Ä‘Ã²n vá»«a ChÃ­ Máº¡ng vá»«a cÃ³ sÃ¡t thÆ°Æ¡ng.
  showDamageNumber(sprite: EntitySprite, value: number, color: string, critical: boolean) {
    const jitterX = Phaser.Math.Between(-10, 10)
    const fontSize = critical ? 20 : 14

    const label = this.scene.add
      .text(
        sprite.rect.x + jitterX,
        this.scene.entityHeadY(sprite),
        `-${formatNumber(Math.round(value))}`,
        {
          fontSize: `${fontSize}px`,
          fontStyle: critical ? 'bold' : 'normal',
          color,
        },
      )
      .setOrigin(0.5, 1)
      .setDepth(DEPTH_OVERLAY_UI + 6)
      .setScale(0.4)

    this.scene.tweens.add({
      targets: label,
      scale: 1,
      duration: 110,
      ease: 'Back.easeOut',
    })

    this.scene.tweens.add({
      targets: label,
      y: label.y - 34,
      alpha: 0,
      delay: 110,
      duration: 480,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy(),
    })
  }

  showDotDamageNumber(sprite: EntitySprite, value: number, color: string) {
    const display = formatDotDamageText(value)

    const footY = this.scene.isPerspective ? sprite.rect.y : sprite.rect.y + sprite.rect.displayHeight / 2

    const label = this.scene.add
      .text(sprite.rect.x + Phaser.Math.Between(-6, 6), footY - 4, display, {
        fontSize: '12px',
        color,
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH_OVERLAY_UI + 5)
      .setScale(0.6)

    this.scene.tweens.add({
      targets: label,
      scale: 1,
      alpha: 0.9,
      duration: 90,
      ease: 'Quad.easeOut',
    })

    this.scene.tweens.add({
      targets: label,
      y: label.y - 18,
      alpha: 0,
      delay: 140,
      duration: 380,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy(),
    })
  }

  showFloatingText(sprite: EntitySprite, text: string, color: string) {
    const label = this.scene.add
      .text(sprite.rect.x, this.scene.entityHeadY(sprite) - 12, text, {
        fontSize: '13px',
        fontStyle: 'bold',
        color,
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH_OVERLAY_UI + 7)

    this.scene.tweens.add({
      targets: label,
      y: label.y - 20,
      alpha: 0,
      duration: 620,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy(),
    })
  }
}

