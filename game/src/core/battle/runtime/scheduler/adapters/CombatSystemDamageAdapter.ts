// runtime/scheduler/adapters/CombatSystemDamageAdapter.ts -- M3
// DamageAuthority over the current engine's CombatSystem.
//
// DISPATCH RULE (review-locked): the PROFILE owns the channel, origin is
// context -- the infrastructure layer does NOT hard-code
// origin => channel (a buff_periodic op is not automatically DoT).
//
//   damageProfile 'legacy_dot'
//     -> CombatSystem.applyDotDamage -- the closed DoT economy
//        (dotResistancePercent sole mitigation, dotRecovery trigger,
//        vitals reason 'dot'). The periodic migration maps existing DoT
//        defs to this profile to preserve behavior.
//   damageProfile 'reaction_*' OR origin.kind 'reaction'
//     -> CombatSystem.applyReactionDamage -- the reaction channel (M3
//        contract extension): flat direct damage via the vitals
//        authority, reason 'reaction', NO hit-layer modifiers, NO
//        dotResistance/dotRecovery, and no crit/miss roll exists on the
//        path (canCrit:false honored by construction). NEVER
//        applyDotDamage -- that would consume dotResistancePercent, fire
//        dotRecovery and report reason 'dot'.
//   everything else (standard hit profiles)
//     -> CombatSystem.applyModifiedDirectDamage semantics -- the
//        hit-layer finalDamagePercent/finalDamageReductionPercent
//        channel with vitals reason 'damage'.
//
// Field mapping decisions (DealDamageOperation.payload ->
// current-engine signatures):
// - coefficient -> the channel's resolved pre-post-processing amount
//   (applyDotDamage.rawDamage / applyReactionDamage.amount /
//   applyModifiedDirectDamage.rawAmount). The current engine's channels
//   each take an already-resolved scalar; profile producers own the
//   formula that computes it (stats/scaling/mitigation layering is the
//   profile's decision -- review r2 HIGH 5).
// - element -> applyDotDamage.element (dot economy is the only channel
//   whose signature carries it).
// - periodicId -> applyDotDamage.effectId (falls back to the profile id
//   when no periodicId rides along) so the 'damage' event keeps its
//   per-effect attribution.
// - hitCount / canCrit / canMiss / tags -> NO carrier in the current
//   engine's direct channels: none of applyDotDamage /
//   applyReactionDamage / applyModifiedDirectDamage rolls hit or crit
//   and none applies a multi-hit count. Producers needing N hits emit N
//   ops; crit/miss-capable profiles belong to the action-hit pipeline
//   (resolveActionHit), which is the skill plan's channel, not M3's.
// - origin.sourceId -> the canonical source: dot sourceId/attribution,
//   the standard-hit attacker entity (its stats feed
//   finalDamagePercent), and the vitals event sourceId.
//
// Result semantics: rawDamage = the intent-level requested amount
// (payload.coefficient); hpDamage = the vitals-truth HP actually removed
// (channel post-processing and the 0-clamp included -- hpDamage may
// diverge from rawDamage in EITHER direction); killed = the target's
// post-resolution liveness.
//
// ctx.events is intentionally unused: the underlying calls already emit
// their legacy domain events ('damage', 'entity_vitals_changed') through
// the EventBus; M3 invents no new gameplay events.

import type { CombatSystem } from '../../../../combat/CombatSystem'
import type { CombatEntity } from '../../../../combat/CombatEntity'
import type { ActiveCapabilityGrant } from '../../../contracts/capability'
import { elementalBasePower } from '../../../../combat/ElementDamageCalculator'
import { getArmorMitigationPercent } from '../../../../combat/Armor'
import { getResistanceMitigationPercent } from '../../../../combat/Resistance'

import type { CombatAuthorityExecutionContext } from '../../../contracts/context'
import type { CombatEntityId } from '../../../contracts/ids'
import type { DealDamageOperation } from '../../../contracts/operations'

import type { DamageAuthority } from '../CombatAuthorityPorts'
import { CombatOperationSkip } from '../CombatOperationExecutor'

import { requireLivingEntity, type CombatEntityLookup } from './lookups'

export interface CombatSystemDamageAdapterDeps {
  /** Live lookup for the DoT source's capability grants -- the
      legacy_dot channel's dot_recovery trigger reads them at tick time
      (applyDotDamage.sourceGrants). Absent = no recovery contribution,
      matching the engine's own optional parameter. */
  resolveSourceGrants?: (sourceId: CombatEntityId) => readonly ActiveCapabilityGrant[] | undefined
}

export class CombatSystemDamageAdapter implements DamageAuthority {
  constructor(
    private readonly combat: CombatSystem,
    private readonly resolveEntity: CombatEntityLookup,
    private readonly deps: CombatSystemDamageAdapterDeps = {},
  ) {}

  dealDamage(
    op: DealDamageOperation['payload'],
    ctx: CombatAuthorityExecutionContext,
  ): { rawDamage: number; hpDamage: number; killed: boolean } {
    const target = requireLivingEntity(this.resolveEntity, op.targetId)
    const sourceId = ctx.origin.sourceId

    if (op.damageProfile === 'legacy_dot' || op.damageProfile === 'detonate_burst') {
      // spec sec.24 -- 'dynamic' scaling: the tick resolves against LIVE
      // source+target stats through the damage authority (the request's
      // coefficient is intent-level ratio x stacks x modifiers -- the
      // profile owns the stat formula). 'detonate_burst' shares the
      // resolution but delivers FLAT (applyDirectDamage, reason
      // 'damage') -- the detonate consume lane's authored channel,
      // deliberately outside the closed DoT economy (no dotResistance,
      // no dotRecovery, no 'dot' vitals reason).
      const source = this.resolveEntity(op.statSourceId ?? sourceId)
      const rawDamage = this.resolveLegacyDotAmount(op, source, target)

      if (op.damageProfile === 'detonate_burst') {
        const hpDamage = this.combat.applyDirectDamage(target, rawDamage, sourceId)
        return { rawDamage, hpDamage, killed: !target.alive }
      }

      const hpDamage = this.combat.applyDotDamage({
        sourceId,
        // An absent source entity is a supported DoT case in the current
        // engine (dotResistance still applies to the target, recovery
        // contributes nothing) -- not an invalidation.
        source,
        sourceGrants: this.deps.resolveSourceGrants?.(sourceId),
        target,
        rawDamage,
        element: op.element,
        effectId: op.periodicId ?? op.damageProfile,
      })
      return { rawDamage, hpDamage, killed: !target.alive }
    }

    if (op.damageProfile.startsWith('reaction_') || ctx.origin.kind === 'reaction') {
      const hpDamage = this.combat.applyReactionDamage(target, op.coefficient, sourceId)
      return { rawDamage: op.coefficient, hpDamage, killed: !target.alive }
    }

    if (op.damageProfile === 'legacy_flat') {
      // Flat direct damage (legacy applyDirectDamage semantics): NO
      // hit-layer multiplier, reason 'damage'. The consume-for-damage
      // lane (consumesAilmentId/consumesWardForDamage) rides this.
      const hpDamage = this.combat.applyDirectDamage(target, op.coefficient, sourceId)
      return { rawDamage: op.coefficient, hpDamage, killed: !target.alive }
    }

    if (op.damageProfile === 'reflection') {
      // phan_chinh Reflection: the hit-layer multiplier applies through
      // the REFLECTING holder as attacker; vitals reason 'reflection'.
      // A dead holder still reflects (legacy passed the entity object).
      const holder = this.resolveEntity(sourceId)
      if (holder === undefined) {
        throw new CombatOperationSkip(
          'invalid_target_state',
          `reflection source '${sourceId}' is not resolvable in the live battle roster`,
        )
      }
      const hpDamage = this.combat.applyModifiedDirectDamage(target, op.coefficient, holder, 'reflection')
      return { rawDamage: op.coefficient, hpDamage, killed: !target.alive }
    }

    // Standard hit channel -- the hit-layer multiplier reads the
    // attacker's stats, so an unresolvable source is a stale-state skip.
    const attacker = this.resolveEntity(sourceId)
    if (attacker === undefined) {
      throw new CombatOperationSkip(
        'invalid_target_state',
        `attacker '${sourceId}' is not resolvable in the live battle roster`,
      )
    }
    const hpDamage = this.combat.applyModifiedDirectDamage(target, op.coefficient, attacker, 'damage')
    return { rawDamage: op.coefficient, hpDamage, killed: !target.alive }
  }

  /**
   * The legacy_dot/detonate_burst profile formula -- the dynamic-scaling
   * port of the retired BuffSystem.calculateDamagePerTurn: power x ratio
   * x (1 - mitigation x armorIgnore) x (1 + ailmentPotencyPercent).
   * 'dynamic' resolves LIVE stats at tick (spec sec.24); an absent
   * source contributes 0 power but the tick still lands on the target
   * (legacy parity). op.coefficient arrives intent-level (ratio x
   * stacks x modifier channels, already folded by the request builder).
   */
  private resolveLegacyDotAmount(
    op: DealDamageOperation['payload'],
    source: CombatEntity | undefined,
    target: CombatEntity,
  ): number {
    const ratio = op.coefficient
    const armorIgnoreMultiplier = op.tags?.includes('armor_ignore_by_realm')
      ? 1 - Math.min(0.9, 0.1 + (source?.realmIndex ?? 0) * 0.1)
      : 1
    const potencyMultiplier = 1 + (source?.stats.ailmentPotencyPercent ?? 0)

    if (op.element === undefined || op.element === 'physical') {
      const power = source?.stats.might ?? 0
      const mitigation =
        getArmorMitigationPercent(target.stats.defense, target.realmIndex) * armorIgnoreMultiplier
      return Math.max(0, power * ratio * (1 - mitigation)) * potencyMultiplier
    }

    const power = source === undefined ? 0 : elementalBasePower(source, op.element)
    const resistance = target.stats[`${op.element}Resistance`] ?? 0
    const penetration = source?.stats[`${op.element}Penetration`] ?? 0
    const mitigation =
      getResistanceMitigationPercent(resistance, penetration) * armorIgnoreMultiplier
    return Math.max(0, power * ratio * (1 - mitigation)) * potencyMultiplier
  }
}
