import type { SkillEffect } from './SkillEffect'
import type { StatModifier } from '../stats/StatCalculator'
import type { PassiveTrigger } from './SkillTypes'

/**
 * Core Loop Foundation checklist (Mục SKILL) — "behavior-changing
 * node": chọn 1 Specialization đổi HẲN cách skill hoạt động (effect
 * khác, trigger khác), không chỉ đổi số như level-up thường. Mỗi
 * field *Override có mặt thì THAY THẾ HOÀN TOÀN field gốc tương ứng
 * trên Skill (không merge) — xem SkillSystem.getEffectiveSkill().
 */
export interface SkillSpecialization {
  id: string

  name: string

  description?: string

  effectsOverride?: SkillEffect[]

  passiveModifiersOverride?: StatModifier[]

  passiveTriggerOverride?: PassiveTrigger
}
