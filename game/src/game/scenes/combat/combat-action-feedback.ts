// combat-action-feedback (Wave-3 large-file split) — tach tu CombatScene.ts.
// Action visual feedback + presentation ACK pacing: attack lunge with the
// midpoint impact ack, hit/critical/dodge/cast flashes and floating text,
// action_impact VFX completion ack, turn_ready pulse ack, standby tail.
// Token is captured AT SPAWN for every delayed ack — a late callback holds
// a stale token the engine rejects (plan Task 1 Step 5; R5 AR-20).
import type {
  ActionImpactEvent,
} from '@/core/battle/BattleEvents'

import type { CombatScene, CombatScenePayload } from '../CombatScene'
import {
  ATTACK_LUNGE_DURATION_MS,
  ATTACK_LUNGE_PX,
  BUFF_ATTACH_COLOR,
  CAST_GLOW_COLOR,
  CAST_NAME_COLOR,
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

  onAttack(event: CombatScenePayload) {
    const scene = this.scene
    const attacker = scene.spriteFor(event.sourceId)

    if (attacker) {
      const isPlayer = event.sourceId === PLAYER_ID
      const dx = isPlayer ? ATTACK_LUNGE_PX : -ATTACK_LUNGE_PX

      // Combat Art Pipeline Task 9 (2026-09-05) — phát clip '-cast' TRƯỚC
      // tween lunge (đòn đánh niệm/vung trước khi lao vào), cạnh tween vị
      // trí hiện có (không thay thế).
      scene.playCombatAnimation(attacker, event.sourceId, 'cast')

      scene.playHorizontalImpulse(attacker, dx, ATTACK_LUNGE_DURATION_MS)

      // Action Playback Task 7 (2026-09-05) / R5 (AR-20) — impact frame tại midpoint
      // lunge: damage áp đúng lúc đòn "trúng" trên màn hình. Token bắt tại spawn.
      const token = scene.gameManagerRef?.getPendingPlaybackToken() ?? ''
      if (scene.gameManagerRef && this.isActionPlaybackActive()) {
        scene.time.delayedCall(ATTACK_LUNGE_DURATION_MS / 2, () => {
          scene.gameManagerRef?.acknowledgeActionImpact(token)
        })
      }
    } else if (scene.gameManagerRef && this.isActionPlaybackActive()) {
      const token = scene.gameManagerRef?.getPendingPlaybackToken() ?? ''
      scene.gameManagerRef.acknowledgeActionImpact(token)
    }
  }

  /**
   * Action Playback Task 7 — presentationActive đang bật? Dùng registry
   * gameManagerRef presence làm proxy (set/unmount cùng subscribe lifecycle).
   */
  private isActionPlaybackActive(): boolean {
    return this.scene.gameManagerRef !== undefined
  }

  onCritical(event: CombatScenePayload) {
    const scene = this.scene
    const target = scene.spriteFor(event.targetId)

    if (!target) {
      return
    }

    // Pop qua boost object — projection ghi kích thước mỗi frame nên
    // tween scale trực tiếp sẽ bị ghi đè; boost nhân vào kích thước cuối
    // ở applyEntityDepthScale() (perspective) / setScale (flat).
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

  onCast(event: CombatScenePayload) {
    const scene = this.scene
    const caster = scene.spriteFor(event.sourceId)

    if (!caster) {
      return
    }

    scene.flashColor(caster, CAST_GLOW_COLOR, 160)

    if (event.skillName) {
      scene.showFloatingText(caster, event.skillName, CAST_NAME_COLOR)
    }
  }

  onCastComplete(event: CombatScenePayload) {
    if (event.sourceId) {
      this.scene.destroyCastBar(event.sourceId)
    }
  }

  /**
   * Remediation Task 2 — ack engine từ completion THỰC của VFX tween qua
   * handle, không còn delayedCall tự tính duration trùng lặp. Token
   * CAPTURE TẠI SPAWN (plan Task 1 Step 5): callback muộn giữ token cũ —
   * engine đã sang phase/action khác (token mới) thì ack cũ thành stale
   * no-op ở GameManager, chặn cross-battle mutation. Không spawn được VFX
   * (projection miss) → ack ngay để engine không treo.
   */
  onActionImpact(event: ActionImpactEvent) {
    const scene = this.scene
    const token = scene.gameManagerRef?.getPendingPlaybackToken() ?? null
    const acknowledge = () => {
      if (token !== null) {
        scene.gameManagerRef?.acknowledgeActionComplete(token)
      }
    }

    const handle = scene.vfxSpawner.onActionImpact(event, acknowledge)

    if (!handle) {
      acknowledge()
    }
  }

  /**
   * Action Playback Task 7 (2026-09-05) — 'turn_ready': short flash/pulse
   * trên sprite actor rồi acknowledgeTurnReady() trong onComplete (5-phase
   * machine bước 1 → 2). Placeholder visual đơn giản theo plan (không
   * designed visual — polish sau).
   */
  onTurnReady(event: { actorId: string }) {
    const scene = this.scene
    const token = scene.gameManagerRef?.getPendingPlaybackToken() ?? ''
    const sprite = scene.spriteFor(event.actorId)

    if (!sprite) {
      // Không có sprite (late-join miss) — ack ngay để engine không treo.
      scene.gameManagerRef?.acknowledgeTurnReady(token)
      return
    }

    // Combat Art Pipeline Task 9 (2026-09-05) — phát clip '-ready' CẠNH pulse
    // scale hiện có (không thay thế).
    scene.playCombatAnimation(sprite, event.actorId, 'ready')

    // Pulse đơn giản: scale bump rồi trở lại (tween trên rect/sprite GameObject
    // — EntitySprite wrapper không expose scale, projection ghi mỗi frame).
    const visual = sprite.rect

    scene.tweens.killTweensOf(visual)

    scene.tweens.add({
      targets: visual,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 250, // was 90 -- too fast to observe (2026-09-07 playtest)
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        visual.setScale(1)

        scene.gameManagerRef?.acknowledgeTurnReady(token)
      },
    })
  }

  /**
   * Action Playback Task 7 (2026-09-05) — 'turn_standby_complete': tail
   * event (completeAction ĐÃ chạy trước khi event tới) — presentation-only
   * bookkeeping, KHÔNG ack gì (không còn wait-gate).
   */
  onTurnStandbyComplete(event: { actorId: string }) {
    const scene = this.scene
    const sprite = scene.spriteFor(event.actorId)

    if (sprite) {
      // Combat Art Pipeline Task 9 (2026-09-05) — quay lại clip '-standby'
      // (idle-adjacent) khi kết thúc lượt.
      scene.playCombatAnimation(sprite, event.actorId, 'standby')

      scene.tweens.killTweensOf(sprite.rect)

      sprite.rect.setScale(1)
    }
  }

  // Buff bar (2026-09-02) — floating text tên hiệu ứng CHỈ lần đầu
  // attach theo (targetId:buffId) — 2 nguồn cùng buff id chỉ floating 1
  // lần; stack tăng không floating lại. Clear ở 2 cleanup sites.
  onStatusAttached(event: StatusVfxAttachedEvent) {
    const scene = this.scene
    const statusKey = `${event.targetId}:${event.dotType}`
    // Optional chaining defensive: field initializer KHÔNG chạy với
    // Object.create(prototype) trong test (xem ghi chú class header) —
    // undefined coi như "chưa floating lần nào".
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
