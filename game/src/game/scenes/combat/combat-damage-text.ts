// combat-damage-text (ui-discoverability-refactor-plan.md sec3.2) - tach tu
// CombatScene.ts: NAY SO damage/crit/DoT gom 3 lan/giay. Module nhan
// dependency tuong minh qua `scene` (moi cross-call deu di qua scene
// delegate de giu nguyen seam test - showDotDamageNumber bI stub trong
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
  KILL_TEXT_COLOR,
  KILL_TEXT_STROKE,
  HEAL_TEXT_COLOR,
  PLAYER_ID,
} from './combatConstants'
import type { EntitySprite } from './combatTypes'
import { formatDotDamageText } from './combatTextFormat'

export class CombatDamageText {
  constructor(private readonly scene: CombatScene) {}

  handleDamageEvent(event: CombatEvent) {
    const target = this.scene.spriteFor(event.targetId)

    // The floating number tracks HP actually lost (hpDamage), matching
    // the HP bar - `value` is the pre-absorb impact and would show a
    // phantom "-100" on a fully warded hit. Older emitters without the
    // breakdown fall back to `value`.
    const hpDamage = event.hpDamage ?? event.value

    if (!target || hpDamage === undefined || hpDamage <= 0) {
      return
    }

    // Gameplay khong doi tick rate (sec7.1) - chi giam tan suat trinh dien.
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

    this.showDamageNumber(target, hpDamage, color, event.critical ?? false)
  }

  /** Bo gom DoT - khoa `targetId|effectId|sourceId`, cua so 1/3 giay. */
  private accumulateDotText(event: CombatEvent) {
    const key = `${event.targetId}|${event.effectId ?? ''}|${event.sourceId ?? ''}`

    let bucket = this.scene.dotAccumulators.get(key)

    if (!bucket) {
      bucket = { value: 0, nextFlushAt: this.scene.time.now + DOT_TEXT_FLUSH_INTERVAL_MS }

      this.scene.dotAccumulators.set(key, bucket)
    }

    bucket.value += event.hpDamage ?? event.value ?? 0
  }

  /** Flush cac bucket da den han - MOI KHOA dung 1 text (sec7.2). */
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

  // "Nay so" that su - pop-in bang Back.easeOut (bat nay qua co roi
  // co ve, khac easeOut tuyen tinh cua showFloatingText) roi mOi troi
  // len/mo dan, tach biet han phan chu "Chi Mang!"/"Ne!" (showFloatingText)
  // - jitter ngang nho de 2 hieu ung khong de khit len nhau khi cung
  // 1 don vua Chi Mang vua co sat thuong.
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

  /**
   * 6A-T2 (2026-09-01) - floating "Ha Guc!" tren dau enemy vua chet.
   * 18px bold trang stroke do (spec sec2); scene subscribe event 'kill'
   * va goi voi sprite cua targetId - fade cua sprite chet khong chan
   * text (text tu destroy sau tween).
   */
  showKillText(sprite: EntitySprite) {
    const label = this.scene.add
      .text(sprite.rect.x, this.scene.entityHeadY(sprite) - 12, 'Hạ Gục!', {
        fontSize: '18px',
        fontStyle: 'bold',
        color: KILL_TEXT_COLOR,
        stroke: KILL_TEXT_STROKE,
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH_OVERLAY_UI + 7)

    this.scene.tweens.add({
      targets: label,
      y: label.y - 24,
      alpha: 0,
      duration: 500,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy(),
    })
  }

  /**
   * 6A-T2 (2026-09-01) - floating "+N" xanh cho heal (event 'heal' tu
   * EntityVitalsSystem - healing/leech). formatNumber cho so lon.
   */
  showHealText(sprite: EntitySprite, value: number) {
    if (!Number.isFinite(value) || value <= 0) {
      return
    }

    const label = this.scene.add
      .text(sprite.rect.x, this.scene.entityHeadY(sprite), `+${formatNumber(Math.round(value))}`, {
        fontSize: '14px',
        fontStyle: 'bold',
        color: HEAL_TEXT_COLOR,
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

