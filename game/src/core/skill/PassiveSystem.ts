import type { EventBus } from '../events/EventBus'
import type { SkillManager } from './SkillManager'
import type { SkillSystem } from './SkillSystem'
import type { PassiveTrigger } from './SkillTypes'
import { addStack } from '../stats/StatCalculator'

export interface CombatEventPayload {
  type: string
  sourceId?: string
  targetId?: string
}

export const PLAYER_ID = 'player'

/**
 * EventBus dùng tên event tự do (string), không phải PassiveTrigger.
 * CombatSystem.attack() emit 'damage' cho sự kiện "bị đánh trúng" —
 * map sang PassiveTrigger 'damage_taken' để khớp nghĩa; các tên còn
 * lại trùng thẳng với giá trị PassiveTrigger. 'cast' được
 * BattleSystem.castSkill() emit riêng (xem BattleSystem.ts). 'dodge'
 * giờ được CombatSystem.resolveDodge() emit thật (né đòn — xem
 * CombatSystem.ts), targetId là bên né được.
 *
 * Export để FormationSystem.ts (trận pháp khảm vũ khí, cùng cơ chế
 * trigger nhưng theo trang bị thay vì theo skill) dùng chung, tránh
 * lặp bảng map này ở 2 nơi.
 */
export const EVENT_TO_TRIGGER: Record<string, PassiveTrigger> = {
  attack: 'attack',
  hit: 'hit',
  critical: 'critical',
  kill: 'kill',
  cast: 'cast',
  damage: 'damage_taken',
  dodge: 'dodge',
  block: 'block',
}

// 'damage_taken'/'dodge'/'block' xảy ra CHO player (player là target)
// — còn lại xảy ra DO player gây ra (player là source). Export để
// FormationSystem.ts dùng chung, tránh lệch logic giữa 2 nơi.
export const TARGET_BASED_TRIGGERS: PassiveTrigger[] = ['damage_taken', 'dodge', 'block']

/**
 * Tích stack cho skill.passiveModifiers — trước đây không nơi nào
 * làm việc này (comment cũ trong GameManager nhắc applySkillEvent()
 * nhưng hàm đó chưa từng viết). Mutate trực tiếp modifier trong
 * object Skill đang nằm ở SkillManager (giống Technique/Skill level
 * mutate tại chỗ), không dùng ModifierSystem riêng — nhờ vậy stack
 * tự động round-trip qua save/load cùng với Skill.
 */
export class PassiveSystem {
  private readonly perSecondAccumulator = new Map<string, number>()

  constructor(
    eventBus: EventBus,
    private readonly skillManager: SkillManager,
    private readonly skillSystem: SkillSystem,
  ) {
    for (const eventName of Object.keys(EVENT_TO_TRIGGER)) {
      eventBus.on<CombatEventPayload>(eventName, event => this.handleEvent(eventName, event))
    }
  }

  private handleEvent(eventName: string, event: CombatEventPayload) {
    const trigger = EVENT_TO_TRIGGER[eventName]

    if (!trigger) {
      return
    }

    // Chỉ tích passive của player — enemy chưa có khái niệm passive
    // riêng ở scope hiện tại.
    const relevant = TARGET_BASED_TRIGGERS.includes(trigger)
      ? event.targetId === PLAYER_ID
      : event.sourceId === PLAYER_ID

    if (!relevant) {
      return
    }

    for (const skill of this.skillManager.getPassiveSkills()) {
      // Core Loop Foundation checklist (Mục SKILL) — đọc qua
      // getEffectiveSkill() để tôn trọng Specialization đã chọn
      // (có thể đổi hẳn passiveTrigger/passiveModifiers).
      const effective = this.skillSystem.getEffectiveSkill(skill)

      if (effective.passiveTrigger !== trigger) {
        continue
      }

      for (const modifier of effective.passiveModifiers ?? []) {
        addStack(modifier)
      }
    }
  }

  /**
   * Đưa stack của mọi passive skill về 0 — gọi khi 1 trận MỚI bắt
   * đầu (xem GameManager.startBattle()). Theo yêu cầu: các chỉ số
   * tích lũy qua passive (vd Linh Khí Cảm Ứng +công kích/đòn trúng)
   * là buff TRONG TRẬN, không tích lũy qua nhiều trận/save nữa —
   * khác thiết kế permanent progression ban đầu.
   */
  resetStacks() {
    for (const skill of this.skillManager.getPassiveSkills()) {
      const effective = this.skillSystem.getEffectiveSkill(skill)

      for (const modifier of effective.passiveModifiers ?? []) {
        modifier.stacks = 0
      }
    }

    this.perSecondAccumulator.clear()
  }

  /**
   * Passive có passiveTrigger === 'per_second' tích 1 stack mỗi
   * giây đầy đủ trôi qua — accumulator riêng theo từng skill để
   * không mất phần lẻ giữa các tick.
   */
  tick(deltaSeconds: number) {
    for (const skill of this.skillManager.getPassiveSkills()) {
      const effective = this.skillSystem.getEffectiveSkill(skill)

      if (effective.passiveTrigger !== 'per_second') {
        continue
      }

      const accumulated = (this.perSecondAccumulator.get(skill.id) ?? 0) + deltaSeconds

      const wholeSeconds = Math.floor(accumulated)

      if (wholeSeconds <= 0) {
        this.perSecondAccumulator.set(skill.id, accumulated)

        continue
      }

      for (const modifier of effective.passiveModifiers ?? []) {
        addStack(modifier, wholeSeconds)
      }

      this.perSecondAccumulator.set(skill.id, accumulated - wholeSeconds)
    }
  }
}
