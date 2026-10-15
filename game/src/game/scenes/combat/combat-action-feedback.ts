// combat-action-feedback (Wave-3 large-file split) - split from CombatScene.ts.
// Hit/critical/dodge flashes and floating text, turn_ready lean + ack, and the
// standby tail. The actor lunge and the action_impact visual moved to the
// shared skill presentation runner, which owns both action ACKs; the legacy
// attack/action_impact feed keeps no production subscribers here.
import type { CombatScene, CombatScenePayload } from '../CombatScene'
import {
  BUFF_ATTACH_COLOR,
  CRITICAL_FLASH_COLOR,
  DEBUFF_ATTACH_COLOR,
  HIT_FLASH_COLOR,
  HIT_RECOIL_DURATION_MS,
  HIT_RECOIL_PX,
  PLAYER_ID,
  TURN_READY_LEAN_MS,
} from './combatConstants'
import type { StatusVfxAttachedEvent } from '@/core/battle/BattleEvents'
import { getCombatPlaybackSpeed } from '@/presentation/combat/CombatPlaybackSpeed'
import { beginInitiativeReady, cancelInitiativeReady, consumeInitiativeReady, hasInitiativeView } from '@/presentation/combat/CombatInitiativeReady'

export class CombatActionFeedback {
  constructor(private readonly scene: CombatScene) {}

  onCritical(event: CombatScenePayload) {
    const scene = this.scene
    const target = scene.spriteFor(event.targetId)

    if (!target) {
      return
    }

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

    const attacker = scene.spriteFor(event.sourceId)
    const dx = attacker && attacker.rect.x !== dodger.rect.x
      ? Math.sign(dodger.rect.x - attacker.rect.x) * 18
      : event.targetId === PLAYER_ID ? -18 : 18

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
   * Action Playback Task 7 (2026-09-05) - 'turn_ready': standby transition
   * plus a short forward lean on the shared offsetX impulse channel, then
   * acknowledgeTurnReady() on the same wall-clock beat (5-phase machine
   * step 1 -> 2). The boost scale punch it replaces read as a grow/shrink
   * defect on every actor (player and monsters alike).
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

    if (hasInitiativeView() && port) {
      beginInitiativeReady(event.actorId, token)
      const timer = scene.time.addEvent({ delay: 16, loop: true, callback: () => {
        if (port.getPendingPlaybackToken() !== token) {
          cancelInitiativeReady(event.actorId, token)
          cleanup()
          return
        }
        if (consumeInitiativeReady(event.actorId, token)) {
          cleanup()
          port.acknowledgeTurnReady(token)
        }
      } })
      const cleanup = () => {
        timer.remove(false)
        cancelInitiativeReady(event.actorId, token)
        scene.events.off('shutdown', cleanup)
      }
      scene.events.once('shutdown', cleanup)
      return
    }

    // Authored animation owns the body; readiness keeps only its pacing ACK.
    // Ack on the same beat the removed boost yoyo used (2 x TURN_READY_LEAN_MS),
    // so the ready phase paces declare exactly as before.
    scene.time.delayedCall(TURN_READY_LEAN_MS * 2 / getCombatPlaybackSpeed(), () => {
      port?.acknowledgeTurnReady(token)
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
