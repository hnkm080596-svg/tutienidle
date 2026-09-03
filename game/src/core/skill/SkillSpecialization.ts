import type { SkillEffect } from './SkillEffect'
import type { StatModifier } from '../stats/StatCalculator'
import type { PassiveTrigger } from './SkillTypes'
import type { ActionTargeting } from '../battle/CombatAction'

/**
 * Core Loop Foundation checklist (Mục SKILL) — "behavior-changing
 * node": chọn 1 Specialization đổi HẲN cách skill hoạt động (effect
 * khác, trigger khác), không chỉ đổi số như level-up thường. Mỗi field
 * *Override có mặt thì THAY THẾ HOÀN TOÀN field gốc tương ứng trên
 * Skill (không merge) — xem SkillSystem.getEffectiveSkill().
 */
export interface SkillSpecialization {
  id: string

  name: string

  description?: string

  effectsOverride?: SkillEffect[]

  passiveModifiersOverride?: StatModifier[]

  passiveTriggerOverride?: PassiveTrigger

  // Pháp Tu Thuần Hệ (Task 10, spec 2026-09-03 §2) — biến thể C/D đổi
  // VÙNG tác động (Tụ ↔ Tán, single ↔ line, area ↔ all_lanes). Có mặt
  // thì THAY targeting gốc của skill (cùng tinh thần effectsOverride);
  // không có = giữ targeting skill. BattleSystem.resolveSkillEffects
  // đọc qua getEffectiveSkill().
  targeting?: ActionTargeting
}
