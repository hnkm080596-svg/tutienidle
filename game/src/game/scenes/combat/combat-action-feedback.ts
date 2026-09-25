// combat-action-feedback (Wave-3 large-file split) - tach tu CombatScene.ts.
// Action visual feedback + presentation ACK pacing: shared attack lunge
// with midpoint impact ack, hit/critical/dodge flashes and floating text,
// action_impact VFX completion ack, turn_ready pulse ack, standby tail.
// Token is captured AT SPAWN for every delayed ack - a late callback holds
// a stale token the engine rejects (plan Task 1 Step 5; R5 AR-20).
import type {
  ActionImpactEvent,
} from '@/core/battle/BattleEvents'

import type { CombatScene, CombatScenePayload } from '../CombatScene'
import {
  ATTACK_LUNGE_DURATION_MS,
  ATTACK_LUNGE_PX,
  BUFF_ATTACH_COLOR,
  CRITICAL_FLASH_COLOR,
  DEBUFF_ATTACH_COLOR,
  HIT_FLASH_COLOR,
  HIT_RECOIL_DURATION_MS,
  HIT_RECOIL_PX,
  PLAYER_ID,
} from './combatConstants'
import type { StatusVfxAttachedEvent } from '@/core/battle/BattleEvents'

export class CombatActionFeedback {
  constructor(private readonly scene: CombatScene) {}

  /** Optional actor motion only; shared skill playback owns both action ACKs. */
  onAttack(event: CombatScenePayload) {
    const attacker = this.scene.spriteFor(event.sourceId)
    if (!attacker) return
    const dx = event.sourceId === PLAYER_ID ? ATTACK_LUNGE_PX : -ATTACK_LUNGE_PX
    this.scene.playHorizontalImpulse(attacker, dx, ATTACK_LUNGE_DURATION_MS)
  }

  onCritical(event: CombatScenePayload) {
    const scene = this.scene
    const target = scene.spriteFor(event.targetId)

    if (!target) {
      return
    }

    // Pop qua boost object - projection ghi kich thuoc moi frame nen
    // tween scale truc tiep se bi ghi de; boost nhan vao kich thuoc cuoi
    // o applyEntityDepthScale() (perspective) / setScale (flat).
    scene.tweens.killTweensOf(target.boost)
    target.boost.value = 1

    scene.tweens.add({
      targets: target.boost,
      value: 1.25,
      duration: 90,
      yoyo: true,
      ease: 'Quad.easeOut',
    })

    scene.flashColor(target, CRITICAL_FLASH_COLOR, 120)
    scene.showFloatingText(target, 'Chí Mạng!', '#ffd54f')
  }

  onHit(event: CombatScenePayload) {
    const scene = this.scene
    const target = scene.spriteFor(event.targetId)

    if (!target) {
      return
    }

    scene.flashColor(target, HIT_FLASH_COLOR, 100)

    const isPlayer = event.targetId === PLAYER_ID
    const recoilX = isPlayer ? -HIT_RECOIL_PX : HIT_RECOIL_PX

    scene.playHorizontalImpulse(target, recoilX, HIT_RECOIL_DURATION_MS)
  }

  onDodge(event: CombatScenePayload) {
    const scene = this.scene
    const dodger = scene.spriteFor(event.targetId)

    if (!dodger) {
      return
    }

    const isPlayer = event.targetId === PLAYER_ID
    const dx = isPlayer ? -18 : 18

    scene.playHorizontalImpulse(dodger, dx, 130)

    scene.tweens.add({
      targets: dodger.rect,
      alpha: 0.55,
      duration: 130,
      yoyo: true,
      ease: 'Quad.easeOut',
    })

    scene.showFloatingText(dodger, 'Né!', '#8be9fd')
  }

  /**
   * Remediation Task 2 - ack engine tu completion THUC cua VFX tween qua
   * handle, khong con delayedCall tu tinh duration trung lap. Token
   * CAPTURE TAI SPAWN (plan Task 1 Step 5): callback muon giu token cu -
   * engine da sang phase/action khac (token moi) thi ack cu thanh stale
   * no-op o GameManager, chan cross-battle mutation. Khong spawn duoc VFX
   * (projection miss) -> ack ngay de engine khong treo.
   */
  onActionImpact(event: ActionImpactEvent) {
    // Retained standalone visual API, not subscribed to production action events.
    this.scene.vfxSpawner.onActionImpact(event)
  }

  /**
   * Action Playback Task 7 (2026-09-05) - 'turn_ready': short flash/pulse
   * tren sprite actor roi acknowledgeTurnReady() trong onComplete (5-phase
   * machine buoc 1 -> 2). Placeholder visual don gian theo plan (khong
   * designed visual - polish sau).
   */
  onTurnReady(event: { actorId: string }) {
    const scene = this.scene
    const port = scene.gameManagerRef
    const token = port?.getPendingPlaybackToken() ?? ''
    const sprite = scene.spriteFor(event.actorId)

    if (!sprite) {
      // Khong co sprite (late-join miss) - ack ngay de engine khong treo.
      port?.acknowledgeTurnReady(token)
      return
    }

    // Uniform contract (2026-09-19) - turn start engages the standby loop
    // through its transition. Entities without the transition clip snap
    // straight to standby (playback resolves the fallback).
    scene.playCombatAnimation(sprite, event.actorId, 'idle_to_standby')

    // Pop qua boost object - projection ghi scale moi frame nen tween
    // scale truc tiep tren rect bi ghi de (xem onCritical). boost nhan
    // vao kich thuoc cuoi o applyEntityDepthScale() / setScale (flat).
    scene.tweens.killTweensOf(sprite.boost)
    sprite.boost.value = 1

    scene.tweens.add({
      targets: sprite.boost,
      value: 1.15,
      duration: 250, // was 90 -- too fast to observe (2026-09-07 playtest)
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        sprite.boost.value = 1

        port?.acknowledgeTurnReady(token)
      },
    })
  }

  /**
   * Action Playback Task 7 (2026-09-05) - 'turn_standby_complete': tail
   * event (completeAction DA chay truoc khi event toi) - presentation-only
   * bookkeeping, KHONG ack gi (khong con wait-gate).
   */
  onTurnStandbyComplete(event: { actorId: string }) {
    const scene = this.scene
    const sprite = scene.spriteFor(event.actorId)

    if (sprite) {
      // Uniform contract (2026-09-19) - turn end disengages back to idle
      // through its transition; entities without it snap straight to idle.
      scene.playCombatAnimation(sprite, event.actorId, 'standby_to_idle')

      scene.tweens.killTweensOf(sprite.rect)

      sprite.rect.setScale(1)
    }
  }

  // Buff bar (2026-09-02) - floating text ten hieu ung CHI lan dau
  // attach theo (targetId:buffId) - 2 nguon cung buff id chi floating 1
  // lan; stack tang khong floating lai. Clear o 2 cleanup sites.
  onStatusAttached(event: StatusVfxAttachedEvent) {
    const scene = this.scene
    const statusKey = `${event.targetId}:${event.dotType}`
    // Optional chaining defensive: field initializer KHONG chay voi
    // Object.create(prototype) trong test (xem ghi chu class header) -
    // undefined coi nhu "chua floating lan nao".
    const firstOnTarget = scene.floatedStatusKeys?.has(statusKey) !== true

    scene.floatedStatusKeys?.add(statusKey)

    if (firstOnTarget && event.buffName) {
      const sprite = scene.spriteFor(event.targetId)

      if (sprite) {
        scene.showFloatingText(
          sprite,
          event.buffName,
          event.polarity === 'buff' ? BUFF_ATTACH_COLOR : DEBUFF_ATTACH_COLOR,
        )
      }
    }

    scene.vfxSpawner.onStatusAttached(event)
  }
}
