import type { Skill } from '../skill/Skill'
import type { EffectiveSkill } from '../skill/SkillSystem'
import type { TurnSkillDefinition } from '../battle/turn/TurnSkillAction'
import type { ActionDamageInfo } from '../battle/ActionImpactSystem'
import type { ActionTargeting } from '../battle/CombatAction'
import type { SkillEffect } from '../skill/SkillEffect'
import type { SkillDamageComponent } from '../skill/SkillDamageComponent'

// Phase A3 (2026-09-07) — pure Skill → TurnSkillDefinition field mapper.
// The caller ALWAYS resolves specialization first via
// SkillSystem.getEffectiveSkill(); this function reads only the already-
// resolved EffectiveSkill output and never inspects
// selectedSpecializationId/specializations itself (see the A3 spec's
// Non-Goals). Number-preserved unit policy: skill.cooldown carries over
// as cooldownTurns with the same numeric value (A1/A2 precedent).

export function toTurnSkillDefinition(skill: Skill, effective: EffectiveSkill): TurnSkillDefinition {
  const damageEffect = effective.effects.find(isDamageEffect)
  const debuffEffect = effective.effects.find(isDebuffEffect)

  let damage: ActionDamageInfo = { kind: 'physical', multiplier: 1 }

  if (damageEffect) {
    // Legacy damage effects carry either explicit components (mixed/
    // elemental) or a bare damageType. Same mapping the turn-based
    // TurnBasicAttacks content uses (elemental = components array).
    if (damageEffect.components && damageEffect.components.length > 0) {
      damage = { kind: 'elemental', components: damageEffect.components, multiplier: damageEffect.value ?? 1 }
    } else if (damageEffect.damageType === 'primordial') {
      damage = { kind: 'primordial', multiplier: damageEffect.value ?? 1 }
    } else {
      damage = { kind: 'physical', multiplier: damageEffect.value ?? 1 }
    }
  }

  const targeting: ActionTargeting = effective.targeting ?? skill.targeting ?? { shape: 'single' }

  const turnSkill: TurnSkillDefinition = {
    id: skill.id,
    cooldownTurns: skill.cooldown,
    resourceType: skill.resourceType,
    resourceCost: skill.cost,
    damage,
    targeting,
  }

  // Debuff effect → chance-gated ailment application (A1's field, reused —
  // not a second mechanism). Legacy applies elementApplicationPercent on
  // top of ailmentChance at apply-time; the turn engine's
  // applyActionImpact() hook already rolls Math.random() < chance, and
  // elementApplicationPercent is a source-stat modulation that stays a
  // legacy-side detail (the converter copies the authored chance).
  if (debuffEffect?.buffId) {
    turnSkill.appliesAilment = {
      buffDefinitionId: debuffEffect.buffId,
      chance: debuffEffect.ailmentChance ?? 1,
    }
  }

  // Detonate / ward-burst consume fields (Phase A3, Component 5).
  if (damageEffect?.consumesAilmentId && damageEffect.damagePerStack) {
    turnSkill.consumesAilmentId = damageEffect.consumesAilmentId
    turnSkill.damagePerStack = damageEffect.damagePerStack
  }

  if (damageEffect?.consumesWardForDamage && damageEffect.damagePerWardPoint) {
    turnSkill.consumesWardForDamage = true
    turnSkill.damagePerWardPoint = damageEffect.damagePerWardPoint
  }

  return turnSkill
}

function isDamageEffect(effect: SkillEffect): effect is SkillEffect & {
  components?: SkillDamageComponent[]
  consumesAilmentId?: string
  damagePerStack?: number
  consumesWardForDamage?: boolean
  damagePerWardPoint?: number
} {
  return effect.type === 'damage'
}

function isDebuffEffect(effect: SkillEffect): effect is SkillEffect & { buffId: string; ailmentChance?: number } {
  return effect.type === 'debuff' && effect.buffId !== undefined
}
