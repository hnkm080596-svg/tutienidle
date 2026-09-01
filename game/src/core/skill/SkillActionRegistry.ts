import type { ActionRuntimeContext, SkillAction, SkillActionType } from './SkillAction'
import type { CombatEntity } from '../combat/CombatEntity'
import type { SkillEffectContext } from './SkillEffectSystem'
import type { TriggerContextMap, TriggerType } from './SkillTrigger'

export interface ActionExecutionHelpers {
  fireNested: <T extends TriggerType>(trigger: T, context: Omit<TriggerContextMap[T], 'skill'>) => void
}

export type ActionExecutor<A extends SkillAction = SkillAction> = (
  action: A,
  source: CombatEntity,
  target: CombatEntity,
  ctx: SkillEffectContext,
  runtime: ActionRuntimeContext,
  helpers: ActionExecutionHelpers,
) => void

// Ported verbatim from SkillEffectSystem.apply()'s case 'damage' — same
// scaling formula, same fireHit contract. consumesAilmentId/
// consumesWardForDamage/grantsSwordZone stay on the OLD SkillEffect path
// until their own dedicated actions (consumeForDamage/spawnZone) are built
// in a later plan; dealDamage only owns the plain-hit subset.
const dealDamage: ActionExecutor<Extract<SkillAction, { type: 'dealDamage' }>> = (
  action,
  source,
  target,
  ctx,
) => {
  const scalingBonus =
    (action.attributeScaling ?? []).reduce(
      (sum, entry) =>
        sum +
        (entry.attributes.length === 0
          ? 0
          : entry.ratioPerPoint * Math.max(...entry.attributes.map((stat) => source.stats[stat]))),
      0,
    ) +
    (action.swordIntentDamageRatio ? action.swordIntentDamageRatio * source.currentSwordIntent : 0) +
    (action.realmDamageRatio ? action.realmDamageRatio * source.realmIndex : 0) +
    (action.manaScalingRatio ? action.manaScalingRatio * source.stats.maxMp : 0) +
    (action.skillExperienceRatio
      ? (action.skillExperienceRatio * (ctx.skillExperience ?? 0)) / Math.max(1, source.stats.attack)
      : 0)

  const finalMultiplier = (action.value ?? 1) * (1 + scalingBonus) * (1 + source.stats.skillDamagePercent)

  const hitCount = action.hitCountByRealm ? source.realmIndex + 1 : 1

  for (let hitIndex = 0; hitIndex < hitCount; hitIndex++) {
    if (!target.alive) {
      break
    }

    if (action.components) {
      ctx.fireHit(target, { kind: 'elemental', components: action.components, multiplier: finalMultiplier })
    } else {
      ctx.fireHit(target, { kind: action.damageType ?? 'physical', multiplier: finalMultiplier })
    }
  }
}

const heal: ActionExecutor<Extract<SkillAction, { type: 'heal' }>> = (action, source, target, ctx, runtime) => {
  const value = (action.value ?? 0) + (action.healPercentOfDamage ? action.healPercentOfDamage * (runtime.consumedDamage ?? 0) : 0)

  ctx.combatSystem.applyHealing(target, value, source.id, 'healing')
}

const applyBuff: ActionExecutor<Extract<SkillAction, { type: 'applyBuff' }>> = (action, _source, _target, ctx) => {
  ctx.sourceBuffs.apply(ctx.buffRegistry.get(action.buffId))
}

const applyDebuff: ActionExecutor<Extract<SkillAction, { type: 'applyDebuff' }>> = (action, _source, _target, ctx) => {
  ctx.targetBuffs.apply(ctx.buffRegistry.get(action.buffId))
}

// Ported from SkillEffectSystem.apply()'s case 'ailment', minus the
// grantsKimThePerProc/grantsHuyetPhaPerProc flags — those become separate
// onProc-bound grantResource actions once a skill migrates. The only new
// responsibility here versus the old code is firing onProc on a successful
// roll, via helpers.fireNested.
const applyAilment: ActionExecutor<Extract<SkillAction, { type: 'applyAilment' }>> = (
  action,
  source,
  target,
  ctx,
  _runtime,
  helpers,
) => {
  const ailmentChance = Math.min(1, (action.chance ?? 1) + source.stats.elementApplicationPercent)

  if (Math.random() >= ailmentChance) {
    return
  }

  ctx.targetAilments.apply(ctx.ailmentRegistry.get(action.ailmentId), source, target, ctx.ailmentRegistry)

  helpers.fireNested('onProc', { source, target, ailmentId: action.ailmentId })

  ctx.reactionManager.checkAndTrigger(
    ctx.targetAilments,
    action.ailmentId,
    source,
    target,
    ctx.combatSystem,
    ctx.ailmentRegistry,
    ctx.sourceBuffs,
    ctx.buffRegistry,
    ctx.spawnLavaZone,
    ctx.reactionKeepChance ?? 0,
  )
}

export const SKILL_ACTION_REGISTRY: { [K in SkillActionType]: ActionExecutor<Extract<SkillAction, { type: K }>> } = {
  dealDamage,
  heal,
  applyBuff,
  applyDebuff,
  applyAilment,
} as { [K in SkillActionType]: ActionExecutor<Extract<SkillAction, { type: K }>> }

export function runSkillAction(
  action: SkillAction,
  source: CombatEntity,
  target: CombatEntity,
  ctx: SkillEffectContext,
  runtime: ActionRuntimeContext,
  helpers: ActionExecutionHelpers,
): void {
  const executor = SKILL_ACTION_REGISTRY[action.type] as ActionExecutor
  executor(action, source, target, ctx, runtime, helpers)
}
