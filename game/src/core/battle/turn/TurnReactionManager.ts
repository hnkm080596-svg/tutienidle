// Turn-based port of ReactionManager.ts (Phase A1, 2026-09-07) — verbatim
// logic with the established turn-engine type substitutions, following the
// BuffPool/BuffSystem port precedent (no import from the legacy
// file). Buff pools are passed as BuffPool and wrapped in
// BuffSystem at each use site. The legacy spawnLavaZone parameter is
// DROPPED entirely: the turn-based engine has no hazard-zone system
// (zone = DoT via AOE + buff, roadmap mục 9.3) — appliesAilmentId:
// 'dung_nham' alone already produces the DoT.
import type { CombatEntity } from '../../combat/CombatEntity'
import { getSkillRuntimeStat } from '../../skill/SkillRuntimeStats'
import type { CombatSystem } from '../../combat/CombatSystem'
import { BuffSystem } from '../../buff/BuffSystem'
import type { BuffPool } from '../../buff/BuffPool'
import type { BuffDefinitionCatalog } from '../../buff/BuffTypes'
import type { EventBus } from '../../events/EventBus'
import { elementalBasePower } from '../../combat/ElementDamageCalculator'
import { ELEMENT_REACTIONS } from '../../element/ElementReaction'

// Ported verbatim from ReactionManager.ts's MAX_HP_REDUCTION_CAP_PERCENT.
const MAX_HP_REDUCTION_CAP_PERCENT = 0.3

/**
 * Turn-based port of ReactionManager (Combat Rework Phase 6). Stateless —
 * scans the buffs CURRENTLY on the target right after a new buff/debuff was
 * successfully applied, finds a pair matching ELEMENT_REACTIONS, and fires
 * it (at most once per call). Called from TurnBattleSystem's ailment
 * application hook (applyActionImpact) — mirrors the legacy SkillEffectSystem
 * call shape: roll chance -> apply -> check reaction against the just-applied
 * id.
 */
export class TurnReactionManager {
  constructor(private readonly eventBus: EventBus) {}

  checkAndTrigger(
    targetBuffs: BuffPool,
    newBuffId: string,
    source: CombatEntity,
    target: CombatEntity,
    combatSystem: CombatSystem,
    buffRegistry?: BuffDefinitionCatalog,
    sourceBuffs?: BuffPool,
    // Ported verbatim from ReactionManager's reactionKeepChance (Phan Phac
    // talent) — keep-both-sides roll on the standard consume branch.
    reactionKeepChance = 0,
  ) {
    const targetBuffSystem = new BuffSystem(targetBuffs)

    // ARCH-009 (M9) — match on the ingredient INSTANCE, not just the buff
    // id: `existing` keeps its real sourceId so consumption removes the
    // exact ingredient that matched (a bong applied by the player is not
    // the same ingredient as one applied by a companion). When several
    // sources supply a valid ingredient, the OLDEST applied instance is
    // consumed — BuffPool preserves insertion order, so the scan below
    // hits it first.
    for (const existing of targetBuffs.getAll()) {
      if (existing.id === newBuffId) {
        continue
      }

      const reaction = ELEMENT_REACTIONS[newBuffId]?.[existing.id] ?? ELEMENT_REACTIONS[existing.id]?.[newBuffId]

      if (!reaction) {
        continue
      }

      const newBuffInstance = targetBuffs.getFromSource(newBuffId, source.id)
      const dotEffect = newBuffInstance?.effects.find(
        (e): e is Extract<typeof e, { type: 'dot' }> => e.type === 'dot',
      )
      const powerElement = dotEffect?.element

      const sourcePower =
        reaction.powerScalingRatio && powerElement && powerElement !== 'physical'
          ? elementalBasePower(source, powerElement) * reaction.powerScalingRatio
          : 0

      const realmScalar = 1 + Math.max(0, source.realmIndex) * 1.5

      const flatAndPercentDamage =
        reaction.baseDamage * realmScalar +
        sourcePower +
        (reaction.percentOfTargetCurrentHp ? target.currentHp * reaction.percentOfTargetCurrentHp : 0)

      const reactionDamage = flatAndPercentDamage * (1 + source.stats.reactionEffectPercent)

      combatSystem.applyModifiedDirectDamage(target, reactionDamage, source, 'reaction')

      if (reaction.maxHpReductionPercent) {
        const alreadyReduced = target.totalMaxHpReductionPercent ?? 0

        const appliedPercent = Math.min(reaction.maxHpReductionPercent, MAX_HP_REDUCTION_CAP_PERCENT - alreadyReduced)

        if (appliedPercent > 0) {
          target.maxHp = Math.max(1, target.maxHp * (1 - appliedPercent))
          combatSystem.vitals.clampToMaxHp(target, 'reaction', source.id)
          target.totalMaxHpReductionPercent = alreadyReduced + appliedPercent
        }
      }

      // Consume the matched ingredient by ITS real (id, sourceId) — never
      // reconstructed from the triggering caster (ARCH-009/AUD-C08).
      const existingId = existing.id
      const existingSourceId = existing.sourceId

      if (reaction.appliesBuffId && sourceBuffs && buffRegistry) {
        targetBuffs.removeInstance(existingId, existingSourceId)
        targetBuffs.removeInstance(newBuffId, source.id)

        new BuffSystem(sourceBuffs).apply(buffRegistry.get(reaction.appliesBuffId), source, source, buffRegistry)
      } else if (reaction.appliesAilmentId && buffRegistry) {
        targetBuffs.removeInstance(existingId, existingSourceId)
        targetBuffs.removeInstance(newBuffId, source.id)

        const definition = buffRegistry.get(reaction.appliesAilmentId)

        targetBuffSystem.apply(definition, source, target, buffRegistry)

        if (source.stats.reactionEffectPercent > 0) {
          targetBuffSystem.renewWithExtension(
            reaction.appliesAilmentId,
            source.id,
            definition.duration * source.stats.reactionEffectPercent,
          )
        }
      } else {
        const keptIsExisting = reaction.keepsAilmentId === existingId
        const keptBuffId = keptIsExisting
          ? existingId
          : reaction.keepsAilmentId === newBuffId
            ? newBuffId
            : undefined

        const extensionSeconds = getSkillRuntimeStat(source, 'waterReactionExtensionSeconds')
        if (keptBuffId && extensionSeconds > 0) {
          if (keptIsExisting) {
            targetBuffs.removeInstance(newBuffId, source.id)
            targetBuffSystem.renewWithExtension(existingId, existingSourceId, extensionSeconds)
          } else {
            targetBuffs.removeInstance(existingId, existingSourceId)
            targetBuffSystem.renewWithExtension(newBuffId, source.id, extensionSeconds)
          }
        } else if (reactionKeepChance > 0 && Math.random() < reactionKeepChance) {
          // Keep-both roll succeeded: no mutation, further reactions possible.
        } else {
          targetBuffs.removeInstance(existingId, existingSourceId)
          targetBuffs.removeInstance(newBuffId, source.id)
        }
      }

      this.eventBus.emit('reaction', {
        type: 'reaction',
        sourceId: source.id,
        targetId: target.id,
        name: reaction.name,
        damage: reactionDamage,
      })

      combatSystem.killIfDead(target, source.id)

      // One newly applied buff triggers AT MOST one reaction.
      return
    }
  }
}
