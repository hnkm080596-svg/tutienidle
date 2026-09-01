import type { ActionRuntimeContext, SkillAction, SkillActionType } from './SkillAction'
import type { CombatEntity } from '../combat/CombatEntity'
import type { SkillEffectContext } from './SkillEffectSystem'
import type { TriggerContextMap, TriggerType } from './SkillTrigger'
import { MAX_SWORD_INTENT, MAX_MOMENTUM, MAX_HOA_THE, MAX_THO_THE, MAX_KIM_THE, MAX_HUYET_PHA } from '../combat/CombatTypes'
import type { SkillResourcePoolKey } from './SkillAction'
import type { ActionImpactEvent } from '../battle/BattleEvents'

// Shared by grantResource (Task 5) and consumeResource (Task 6) — every
// named pool's CombatEntity field and hard cap. Pools with no cap in
// today's game (none currently) would map to Infinity; all 6 current
// pools have one.
export const RESOURCE_POOL_FIELD: Record<SkillResourcePoolKey, keyof CombatEntity> = {
  swordIntent: 'currentSwordIntent',
  momentum: 'currentMomentum',
  hoaThe: 'currentHoaThe',
  thoThe: 'currentThoThe',
  kimThe: 'currentKimThe',
  huyetPha: 'currentHuyetPha',
}

export const RESOURCE_POOL_MAX: Record<SkillResourcePoolKey, number> = {
  swordIntent: MAX_SWORD_INTENT,
  momentum: MAX_MOMENTUM,
  hoaThe: MAX_HOA_THE,
  thoThe: MAX_THO_THE,
  kimThe: MAX_KIM_THE,
  huyetPha: MAX_HUYET_PHA,
}

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

const grantResource: ActionExecutor<Extract<SkillAction, { type: 'grantResource' }>> = (
  action,
  source,
  _target,
  _ctx,
  _runtime,
  helpers,
) => {
  const field = RESOURCE_POOL_FIELD[action.pool]
  const max = RESOURCE_POOL_MAX[action.pool]
  const current = (source[field] as number | undefined) ?? 0

  const next = Math.min(max, current + action.amount)

  ;(source[field] as number) = next

  if (next >= max) {
    helpers.fireNested('onResourceFull', { source, resource: action.pool })
  }
}

const consumeResource: ActionExecutor<Extract<SkillAction, { type: 'consumeResource' }>> = (
  action,
  source,
  target,
  _ctx,
  runtime,
  helpers,
) => {
  if (action.pool === 'breakGauge') {
    const current = target.currentBreakGauge

    if (current === undefined) {
      return
    }

    const amount = action.amount === 'all' ? current : action.amount
    const next = Math.max(0, current - amount)

    target.currentBreakGauge = next
    runtime.consumedAmount = current - next

    if (next <= 0) {
      helpers.fireNested('onBreak', { source, target })
    }

    return
  }

  const field = RESOURCE_POOL_FIELD[action.pool]
  const current = (source[field] as number | undefined) ?? 0
  const amount = action.amount === 'all' ? current : action.amount
  const next = Math.max(0, current - amount)

  ;(source[field] as number) = next
  runtime.consumedAmount = current - next
}

const consumeForDamage: ActionExecutor<Extract<SkillAction, { type: 'consumeForDamage' }>> = (
  action,
  source,
  target,
  ctx,
  runtime,
) => {
  if (!target.alive) {
    return
  }

  let bonusDamage = 0

  if (action.source === 'ailment' && action.ailmentId) {
    const stacks = ctx.targetAilments.getStacks(action.ailmentId)

    if (stacks <= 0) {
      return
    }

    bonusDamage = stacks * action.damagePerUnit

    ctx.combatSystem.applyDirectDamage(target, bonusDamage, source.id, 'damage')
    ctx.targetAilments.remove(action.ailmentId)
    ctx.combatSystem.killIfDead(target, source.id)
  } else if (action.source === 'ward' && source.currentWard > 0) {
    bonusDamage = source.currentWard * action.damagePerUnit

    source.currentWard = 0

    ctx.combatSystem.applyDirectDamage(target, bonusDamage, source.id, 'ward_break')
  } else {
    return
  }

  runtime.consumedDamage = bonusDamage
}

const spawnZone: ActionExecutor<Extract<SkillAction, { type: 'spawnZone' }>> = (action, source, target, ctx) => {
  const anchor = action.position === 'source' ? source : target

  if (action.zoneKind === 'sword' && ctx.spawnSwordZone) {
    ctx.spawnSwordZone({
      ownerId: source.id,
      row: anchor.row,
      column: Math.round(anchor.x),
      laneRadius: 0,
      columnRadius: 1,
      charges: action.charges,
      tickInterval: action.tickInterval,
      damagePerTick: action.damageRatio * source.stats.attack,
    })
  } else if (action.zoneKind === 'lava' && ctx.spawnLavaZone) {
    ctx.spawnLavaZone({
      ownerId: source.id,
      row: anchor.row,
      column: Math.round(anchor.x),
      laneRadius: 0,
      columnRadius: 1,
      duration: action.charges * action.tickInterval,
      tickInterval: action.tickInterval,
      damagePerTick: action.damageRatio * source.stats.attack,
      element: 'fire',
    })
  }
}

let spawnVfxInstanceCounter = 0

const spawnVfx: ActionExecutor<Extract<SkillAction, { type: 'spawnVfx' }>> = (action, source, target, ctx) => {
  if (!ctx.eventBus) {
    return
  }

  const anchor = action.target === 'source' ? source : target

  ctx.eventBus.emit<ActionImpactEvent>('action_impact', {
    type: 'action_impact',
    actionId: `spawnVfx:${action.presetId}`,
    actionInstanceId: `spawnvfx-${++spawnVfxInstanceCounter}`,
    sourceId: source.id,
    primaryTargetId: anchor.id,
    anchorCell: { row: anchor.row, column: Math.round(anchor.x) },
    affectedTargetIds: [anchor.id],
    landedTargetIds: [anchor.id],
    dodgedTargetIds: [],
    affectedArea: { rowStart: anchor.row, rowEnd: anchor.row, colStart: Math.round(anchor.x), colEnd: Math.round(anchor.x), shape: 'single' },
    hitCount: 1,
    presetId: action.presetId,
  })
}

export const SKILL_ACTION_REGISTRY: { [K in SkillActionType]: ActionExecutor<Extract<SkillAction, { type: K }>> } = {
  dealDamage,
  heal,
  applyBuff,
  applyDebuff,
  applyAilment,
  grantResource,
  consumeResource,
  consumeForDamage,
  spawnZone,
  spawnVfx,
}

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
