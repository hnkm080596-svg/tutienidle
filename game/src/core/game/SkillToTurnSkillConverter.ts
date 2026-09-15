import type { Skill } from '../skill/Skill'
import type { EffectiveSkill } from '../skill/SkillSystem'
import type { TurnSkillDefinition, TurnSkillAilmentApplication } from '../battle/turn/TurnSkillAction'
import type { ActionDamageInfo } from '../battle/ActionImpactSystem'
import type { ActionTargeting } from '../battle/CombatAction'
import type { SkillEffect } from '../skill/SkillEffect'
import type { SkillDamageComponent } from '../skill/SkillDamageComponent'
import type { StatType } from '../stats/StatTypes'

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
//   configurations — never silently degrades to physical ×1 might.
//
// M10 (ARCH-008) — two extensions:
// - `appliesBuff.duration` carries the authored effect-level duration
//   override (duong_linh_tuyen: 8 turns instead of the registry's 6).
// - Trigger-migrated skills (tram) express their strike as a single
//   onCast -> dealDamage binding instead of a 'damage' effect; that exact
//   shape converts to `damage`. Anything richer throws — the engine has
//   no trigger runtime.
// - Field-level authored data the engine cannot execute (proc-grant
//   counters, multi-hit, zone spawning, spread, ...) is REPORTED through
//   collectUnsupportedSkillSemantics() — never silently dropped (A8).

const SUPPORTED_EFFECT_TYPES = new Set(['damage', 'debuff', 'buff', 'add_stack'])

const UNSUPPORTED_EFFECT_FIELDS = [
  'hitCountByRealm',
  'hitCount',
  'realmDamageRatio',
  'skillExperienceRatio',
  'spreadsAilmentId',
  'spreadStackPercent',
  'spreadRefreshesPrimary',
  'stacksPerAffectedTarget',
  'grantsZone',
  'zoneElement',
  'swordZoneCharges',
  'swordZoneTickInterval',
  'swordZoneDamageRatio',
] as const

const UNSUPPORTED_SKILL_FIELDS = [
  'breakDamagePerHit',
] as const

const UNSUPPORTED_DEAL_DAMAGE_FIELDS = [
  'realmDamageRatio',
  'skillExperienceRatio',
  'hitCountByRealm',
  'knockbackDistance',
] as const

/**
 * M10 (ARCH-008) — lists authored fields on the resolved skill that the
 * turn engine cannot execute. Callers report these (warn/log) instead of
 * discovering them silently. Keys are stable dotted paths.
 */
export function collectUnsupportedSkillSemantics(skill: Skill, effective: EffectiveSkill): string[] {
  const unsupported = new Set<string>()

  const skillRecord = skill as unknown as Record<string, unknown>
  for (const field of UNSUPPORTED_SKILL_FIELDS) {
    if (skillRecord[field] !== undefined) {
      unsupported.add(`skill.${field}`)
    }
  }

  for (const effect of effective.effects) {
    const record = effect as unknown as Record<string, unknown>
    for (const field of UNSUPPORTED_EFFECT_FIELDS) {
      if (record[field] !== undefined) {
        unsupported.add(`effect.${field}`)
      }
    }
  }

  for (const binding of effective.triggers ?? []) {
    if (binding.trigger !== 'onCast') {
      unsupported.add(`trigger.${binding.trigger}`)
    }
    for (const action of binding.actions) {
      if (action.type !== 'dealDamage') {
        unsupported.add(`trigger.action.${action.type}`)
        continue
      }
      for (const field of UNSUPPORTED_DEAL_DAMAGE_FIELDS) {
        if (action[field] !== undefined) {
          unsupported.add(`trigger.dealDamage.${field}`)
        }
      }
    }
  }

  return [...unsupported]
}

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
    // R3 re-audit (AR-03 gap) — attributeScaling/manaScalingRatio
    // were being silently dropped here (only
    // `.value` survived conversion), so every Pháp Tu skill's
    // authored scaling had zero effect once cast through the turn
    // engine. `undefined` when the skill authors none, so unaffected
    // skills produce an identical damage shape to before.
    const scaling = damageEffect.attributeScaling || damageEffect.manaScalingRatio
      ? {
          attributeScaling: damageEffect.attributeScaling,
          manaScalingRatio: damageEffect.manaScalingRatio,
        }
      : undefined

    if (damageEffect.components && damageEffect.components.length > 0) {
      damage = { kind: 'elemental', components: damageEffect.components, multiplier: damageEffect.value ?? 1, scaling }
    } else if (damageEffect.damageType === 'primordial') {
      damage = { kind: 'primordial', multiplier: damageEffect.value ?? 1, scaling }
    } else {
      damage = { kind: 'physical', multiplier: damageEffect.value ?? 1, scaling }
    }
  } else {
    // M10 (ARCH-008) — trigger-migrated skills (tram) express their strike
    // as onCast -> dealDamage rather than a 'damage' effect. Only the
    // exact single-binding/single-action shape converts; richer kits throw.
    damage = resolveTriggerDamage(skill, effective)

    if (!damage && !isSelf && !effective.effects.some(isDebuffEffect)) {
      throw new Error(`Unsupported: non-self skill "${skill.id}" has neither damage nor debuff effects`)
    }
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
    turnSkill.appliesBuffs = [{
      definitionId: buffEffect.buffId,
      target: isSelf ? 'self' : 'action_targets',
      // M10 (ARCH-008) — authored duration override (e.g. duong_linh_tuyen
      // spec: 8) must reach BuffSystem.apply; without it the registry
      // default silently wins (5.988 instead of 7.984 under resist 0.998).
      ...(buffEffect.duration !== undefined ? { durationOverride: buffEffect.duration } : {}),
    }]
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

/**
 * M10 (ARCH-008) — converts a trigger-migrated strike (tram's onCast ->
 * dealDamage) into ActionDamageInfo. Strict shape: exactly one onCast
 * binding with exactly one dealDamage action. Returns undefined when the
 * skill declares no triggers at all; throws on any richer shape — the
 * engine has no trigger runtime, so degrading would silently corrupt.
 */
function resolveTriggerDamage(skill: Skill, effective: EffectiveSkill): ActionDamageInfo | undefined {
  const triggers = effective.triggers

  if (!triggers || triggers.length === 0) {
    return undefined
  }

  const [binding] = triggers

  if (!binding || triggers.length !== 1 || binding.trigger !== 'onCast' || binding.actions.length !== 1) {
    throw new Error(
      `Unsupported trigger kit for skill "${skill.id}": turn combat executes ` +
        'exactly one onCast binding with a single dealDamage action',
    )
  }

  const action = binding.actions[0]!

  if (action.type !== 'dealDamage') {
    throw new Error(`Unsupported trigger action "${action.type}" for skill "${skill.id}"`)
  }

  const scaling = action.attributeScaling || action.manaScalingRatio
    ? {
        attributeScaling: action.attributeScaling,
        manaScalingRatio: action.manaScalingRatio,
      }
    : undefined

  if (action.components && action.components.length > 0) {
    return { kind: 'elemental', components: action.components, multiplier: action.value ?? 1, scaling }
  }

  if (action.damageType === 'primordial') {
    return { kind: 'primordial', multiplier: action.value ?? 1, scaling }
  }

  return { kind: 'physical', multiplier: action.value ?? 1, scaling }
}

function isDamageEffect(effect: SkillEffect): effect is SkillEffect & {
  components?: SkillDamageComponent[]
  consumesAilmentId?: string
  damagePerStack?: number
  consumesWardForDamage?: boolean
  damagePerWardPoint?: number
  healPercentOfDamage?: number
  attributeScaling?: { attributes: StatType[]; ratioPerPoint: number }[]
  manaScalingRatio?: number
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
