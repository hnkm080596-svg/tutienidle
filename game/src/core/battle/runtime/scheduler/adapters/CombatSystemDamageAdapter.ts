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
import type { Buff } from '../../../../buff/BuffTypes'

import type { CombatAuthorityExecutionContext } from '../../../contracts/context'
import type { CombatEntityId } from '../../../contracts/ids'
import type { DealDamageOperation } from '../../../contracts/operations'

import type { DamageAuthority } from '../CombatAuthorityPorts'
import { CombatOperationSkip } from '../CombatOperationExecutor'

import { requireLivingEntity, type CombatEntityLookup } from './lookups'

export interface CombatSystemDamageAdapterDeps {
  /** Live lookup for the DoT source's buff list -- the legacy_dot
      channel's dotRecovery trigger reads it (applyDotDamage.sourceBuffs).
      Absent = no recovery contribution, matching the engine's own
      optional parameter. */
  resolveSourceBuffs?: (sourceId: CombatEntityId) => readonly Buff[] | undefined
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

    if (op.damageProfile === 'legacy_dot') {
      const hpDamage = this.combat.applyDotDamage({
        sourceId,
        // An absent source entity is a supported DoT case in the current
        // engine (dotResistance still applies to the target, recovery
        // contributes nothing) -- not an invalidation.
        source: this.resolveEntity(sourceId),
        sourceBuffs: this.deps.resolveSourceBuffs?.(sourceId),
        target,
        rawDamage: op.coefficient,
        element: op.element,
        effectId: op.periodicId ?? op.damageProfile,
      })
      return { rawDamage: op.coefficient, hpDamage, killed: !target.alive }
    }

    if (op.damageProfile.startsWith('reaction_') || ctx.origin.kind === 'reaction') {
      const hpDamage = this.combat.applyReactionDamage(target, op.coefficient, sourceId)
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
}
