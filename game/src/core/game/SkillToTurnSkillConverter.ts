import type { Skill } from '../skill/Skill'
import type { EffectiveSkill } from '../skill/SkillSystem'
import type { TurnSkillDefinition, TurnSkillAilmentApplication } from '../battle/turn/TurnSkillAction'
import type { ActionDamageInfo } from '../battle/ActionImpactSystem'
import type { ActionTargeting } from '../battle/CombatAction'
import type { SkillEffect } from '../skill/SkillEffect'
import type { SkillDamageComponent } from '../skill/SkillDamageComponent'

// R3 (AR-03) — Strict Skill → TurnSkillDefinition field mapper.
// The caller ALWAYS resolves specialization first via
// SkillSystem.getEffectiveSkill(); this function reads only the already-
// resolved EffectiveSkill output.
//
// Strictness contract (spec §4.2):
// - Explicit targetScope: 'self' vs 'enemy'.
// - Pure buff skills ('self' with buff effects) have NO damage.
// - Multiple debuffs and add_stack folding are mapped into appliesAilments.
// - Leech healing (healPercentOfDamage) is preserved.
// - Fails explicitly with an Error on unsupported effect types or invalid
//   configurations — never silently degrades to physical ×1 attack.

const SUPPORTED_EFFECT_TYPES = new Set(['damage', 'debuff', 'buff', 'add_stack'])

export function toTurnSkillDefinition(skill: Skill, effective: EffectiveSkill): TurnSkillDefinition {
  // Validate that all effects in the effective skill are supported
  for (const effect of effective.effects) {
    if (!SUPPORTED_EFFECT_TYPES.has(effect.type)) {
      throw new Error(`Unsupported skill effect type "${effect.type}" for skill "${skill.id}"`)
    }
  }

  const isSelf = skill.target === 'self'
  const damageEffect = effective.effects.find(isDamageEffect)

  let damage: ActionDamageInfo | undefined

  if (damageEffect) {
    if (damageEffect.components && damageEffect.components.length > 0) {
      damage = { kind: 'elemental', components: damageEffect.components, multiplier: damageEffect.value ?? 1 }
    } else if (damageEffect.damageType === 'primordial') {
      damage = { kind: 'primordial', multiplier: damageEffect.value ?? 1 }
    } else {
      damage = { kind: 'physical', multiplier: damageEffect.value ?? 1 }
    }
  } else if (!isSelf && !effective.effects.some(isDebuffEffect)) {
    throw new Error(`Unsupported: non-self skill "${skill.id}" has neither damage nor debuff effects`)
  }

  const targeting: ActionTargeting = isSelf
    ? { shape: 'single' }
    : (effective.targeting ?? skill.targeting ?? { shape: 'single' })

  const turnSkill: TurnSkillDefinition = {
    id: skill.id,
    cooldownTurns: skill.cooldown,
    targetScope: isSelf ? 'self' : 'enemy',
    resourceType: skill.resourceType,
    resourceCost: skill.cost,
    damage,
    targeting,
  }

  // Leech healing on hit (e.g. doc_vien_bao_can)
  if (damageEffect?.healPercentOfDamage) {
    turnSkill.healPercentOfDamage = damageEffect.healPercentOfDamage
  }

  // Detonate / ward-burst consume fields (Phase A3)
  if (damageEffect?.consumesAilmentId && damageEffect.damagePerStack) {
    turnSkill.consumesAilmentId = damageEffect.consumesAilmentId
    turnSkill.damagePerStack = damageEffect.damagePerStack
  }

  if (damageEffect?.consumesWardForDamage && damageEffect.damagePerWardPoint) {
    turnSkill.consumesWardForDamage = true
    turnSkill.damagePerWardPoint = damageEffect.damagePerWardPoint
  }

  // Buff effect (e.g. thanh_tuyen_duong_linh, dia_tru_thua_thien, or specializations)
  const buffEffect = effective.effects.find(isBuffEffect)
  if (buffEffect?.buffId) {
    turnSkill.appliesBuff = {
      definitionId: buffEffect.buffId,
      target: isSelf ? 'self' : 'target',
    }
  }

  // Debuff and add_stack effects
  const debuffEffects = effective.effects.filter(isDebuffEffect)
  const addStackEffects = effective.effects.filter(isAddStackEffect)
  const ailments: TurnSkillAilmentApplication[] = []

  for (const debuff of debuffEffects) {
    if (debuff.buffId) {
      ailments.push({
        buffDefinitionId: debuff.buffId,
        chance: debuff.ailmentChance ?? 1,
      })
    }
  }

  for (const addStack of addStackEffects) {
    if (addStack.buffId) {
      const existing = ailments.find((a) => a.buffDefinitionId === addStack.buffId)
      const extraStacks = addStack.stacks ?? 1
      if (existing) {
        existing.stacks = (existing.stacks ?? 1) + extraStacks
      } else {
        ailments.push({
          buffDefinitionId: addStack.buffId,
          chance: 1,
          stacks: 1 + extraStacks,
        })
      }
    }
  }

  if (ailments.length > 0) {
    turnSkill.appliesAilments = ailments
    turnSkill.appliesAilment = ailments[0]
  }

  return turnSkill
}

function isDamageEffect(effect: SkillEffect): effect is SkillEffect & {
  components?: SkillDamageComponent[]
  consumesAilmentId?: string
  damagePerStack?: number
  consumesWardForDamage?: boolean
  damagePerWardPoint?: number
  healPercentOfDamage?: number
} {
  return effect.type === 'damage'
}

function isDebuffEffect(effect: SkillEffect): effect is SkillEffect & { buffId: string; ailmentChance?: number } {
  return effect.type === 'debuff' && effect.buffId !== undefined
}

function isBuffEffect(effect: SkillEffect): effect is SkillEffect & { buffId: string } {
  return effect.type === 'buff' && effect.buffId !== undefined
}

function isAddStackEffect(effect: SkillEffect): effect is SkillEffect & { buffId: string; stacks?: number } {
  return effect.type === 'add_stack' && effect.buffId !== undefined
}
