import type { SkillEffect } from './SkillEffect'
import type { StatModifier } from '../stats/StatCalculator'
import type { PassiveTrigger } from './SkillTypes'
import type { ActionTargeting } from '../battle/CombatAction'

/**
 * Core Loop Foundation checklist (Muc SKILL) - "behavior-changing
 * node": chon 1 Specialization doi HAN cach skill hoat dong (effect
 * khac, trigger khac), khong chi doi so nhu level-up thuong. Moi field
 * *Override co mat thi THAY THE HOAN TOAN field goc tuong ung tren
 * Skill (khong merge) - xem SkillSystem.getEffectiveSkill().
 */
export interface SkillSpecialization {
  id: string

  name: string

  description?: string

  effectsOverride?: SkillEffect[]

  passiveModifiersOverride?: StatModifier[]

  passiveTriggerOverride?: PassiveTrigger

  // Phap Tu Thuan He (Task 10, spec 2026-09-03 sec2) - bien the C/D doi
  // VUNG tac dong (Tu <-> Tan, single <-> line, area <-> all_lanes). Co mat
  // thi THAY targeting goc cua skill (cung tinh than effectsOverride);
  // khong co = giu targeting skill. BattleSystem.resolveSkillEffects
  // doc qua getEffectiveSkill().
  targeting?: ActionTargeting
}
