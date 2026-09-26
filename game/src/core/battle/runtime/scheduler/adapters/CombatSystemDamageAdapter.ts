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
//        contract extension): elemental power x coefficient mitigated
//        by the target's matching resistance (the attacker-element
//        ruling), delivered via the vitals authority with reason
//        'reaction', NO hit-layer modifiers, NO
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
// - element -> applyDotDamage.element for the dot economy; the
//   reaction channel reads it for the attacker-element resistance
//   lane (canonical reaction_damage authors element:'attacker',
//   resolved to a concrete element at emission).
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
// Result semantics: rawDamage = the channel-resolved amount handed to
// the vitals authority (profile formula applied: bare coefficient on
// the flat lanes, power-scaled on the elemental/reaction lanes);
// hpDamage = the vitals-truth HP actually removed (channel
// post-processing and the 0-clamp included -- hpDamage may diverge from
// rawDamage in EITHER direction); killed = the target's post-resolution
// liveness.
//
// ctx.events is intentionally unused: the underlying calls already emit
// their legacy domain events ('damage', 'entity_vitals_changed') through
// the EventBus; M3 invents no new gameplay events.

import type { CombatSystem } from '../../../../combat/CombatSystem'
import type { CombatEntity } from '../../../../combat/CombatEntity'
import type { ActiveCapabilityGrant } from '../../../contracts/capability'
import type {
  ActionDamageInfo,
  HitResolveOptions,
} from '../../../ActionImpactSystem'
import type { CombatRng } from '../../../contracts/rng'
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
  /** Contract v1.6 -- the 'skill_hit' channel's DECLARED policy rolls
      (crit bonus/armor bypass). The authority consumes this rng; the
      executor/scheduler never roll hit/crit/armor. REQUIRED: canonical
      combat damage never falls back to an implicit random source --
      the battle wiring passes the shared cycle rng. */
  rng: CombatRng
}

export class CombatSystemDamageAdapter implements DamageAuthority {
  private readonly rng: CombatRng

  constructor(
    private readonly combat: CombatSystem,
    private readonly resolveEntity: CombatEntityLookup,
    private readonly deps: CombatSystemDamageAdapterDeps,
  ) {
    if (deps?.rng === undefined) {
      throw new Error(
        'CombatSystemDamageAdapter requires an explicit CombatRng -- ' +
          'canonical combat damage never falls back to an implicit random source',
      )
    }
    this.rng = deps.rng
  }

  dealDamage(
    op: DealDamageOperation['payload'],
    ctx: CombatAuthorityExecutionContext,
  ): { rawDamage: number; hpDamage: number; killed: boolean; landed?: boolean; crit?: boolean } {
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
      const rawDamage = this.resolveReactionAmount(op, sourceId, target)
      const hpDamage = this.combat.applyReactionDamage(target, rawDamage, sourceId)
      return { rawDamage, hpDamage, killed: !target.alive }
    }

    if (op.damageProfile === 'legacy_flat') {
      // Flat direct damage (legacy applyDirectDamage semantics): NO
      // hit-layer multiplier, reason 'damage'. The consume-for-damage
      // lane (consumesAilmentId/consumesWardForDamage) rides this.
      const hpDamage = this.combat.applyDirectDamage(target, op.coefficient, sourceId)
      return { rawDamage: op.coefficient, hpDamage, killed: !target.alive }
    }

    if (op.damageProfile === 'skill_hit') {
      // The skill pipeline's hit-resolving channel: full
      // resolveActionHit semantics (accuracy/evasion, crit, block,
      // endurance, armor/resistance mitigation, ward/MP-shield absorb,
      // survive-lethal) instead of the flat channels. DECLARED v1.6
      // policies resolve HERE via the injected rng -- one roll each,
      // same consumption order the legacy providers used (crit then
      // armor).
      const attacker = this.resolveEntity(op.statSourceId ?? sourceId)
      if (attacker === undefined) {
        throw new CombatOperationSkip(
          'invalid_target_state',
          `skill_hit attacker '${op.statSourceId ?? sourceId}' is not resolvable in the live battle roster`,
        )
      }
      const damage = this.toActionDamageInfo(op, attacker)
      const options = this.resolveHitOptions(op)
      const result = this.combat.resolveActionHit(attacker, target, damage, options)
      return {
        rawDamage: result.finalDamage,
        hpDamage: result.hpDamage,
        killed: result.targetKilled,
        landed: !result.dodged,
        crit: result.critical,
      }
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
   * Payload -> ActionDamageInfo. Single-kind components keep their own
   * channel (physical/primordial ride calculateBaseDamage so the
   * armorPierceFraction path stays reachable); multi-component and
   * element lanes ride calculateSkillBaseDamage like legacy's
   * kind:'elemental'. The multiplier folds the The Tu missing-HP
   * scalar against the ATTACKER's live hp -- applyMissingHpScalar
   * parity, per hit, never snapshotted.
   */
  private toActionDamageInfo(
    op: DealDamageOperation['payload'],
    attacker: CombatEntity,
  ): ActionDamageInfo {
    let multiplier = op.coefficient
    const perPercent = op.missingHpBonusPerMissingPercent
    if (perPercent !== undefined && attacker.maxHp > 0) {
      const missingFraction = Math.max(0, 1 - attacker.currentHp / attacker.maxHp)
      const bonus = Math.min(
        op.missingHpBonusCap ?? Infinity,
        missingFraction * perPercent * 100,
      )
      if (bonus > 0) {
        multiplier *= 1 + bonus
      }
    }

    const scaling = op.scaling !== undefined ? { scaling: op.scaling } : {}
    const components = op.components ?? []
    if (components.length === 1 && components[0]!.kind === 'physical') {
      return { kind: 'physical', multiplier, ...scaling }
    }
    if (components.length === 1 && components[0]!.kind === 'primordial') {
      return { kind: 'primordial', multiplier, ...scaling }
    }
    if (components.length > 0) {
      return { kind: 'elemental', components: [...components], multiplier, ...scaling }
    }
    if (op.element !== undefined && op.element !== 'physical') {
      return {
        kind: 'elemental',
        components: [{ kind: 'element', element: op.element, ratio: 1 }],
        multiplier,
        ...scaling,
      }
    }
    return { kind: 'physical', multiplier, ...scaling }
  }

  /**
   * Payload policies -> resolved HitResolveOptions. Every roll the
   * legacy perInstanceOptions closure made now happens HERE (the
   * DamageAuthority owns CombatRng consumption for hit/crit/armor):
   *   hitPolicy.guaranteedHit     -> skip the accuracy/evasion roll
   *                                  (canMiss:false maps the same way)
   *   critPolicy.bonusChance      -> one roll: forced crit on success,
   *                                  normal crit channel on failure
   *   armorPolicy.bypassChance    -> one roll: full bypass on success
   *   armorPolicy.pierceFractionOnFail -> else mitigation x (1-fraction)
   */
  private resolveHitOptions(
    op: DealDamageOperation['payload'],
  ): Partial<HitResolveOptions> {
    const options: Partial<HitResolveOptions> = { isPrimary: true }

    if (op.hitPolicy?.guaranteedHit === true || op.canMiss === false) {
      options.guaranteedHit = true
    }

    if (op.canCrit === false) {
      options.critical = false
    } else if (op.critPolicy?.bonusChance !== undefined) {
      options.critical = this.rng.roll() < op.critPolicy.bonusChance ? true : undefined
    }

    if (op.armorPolicy !== undefined) {
      const bypassed =
        op.armorPolicy.bypassChance !== undefined &&
        this.rng.roll() < op.armorPolicy.bypassChance
      if (bypassed) {
        options.armorBypass = true
      } else if (op.armorPolicy.pierceFractionOnFail !== undefined) {
        options.armorPierceFraction = op.armorPolicy.pierceFractionOnFail
      }
    }

    // Spec D7/D11 -- per-hit penetration points ride the payload's
    // folded bonus (authored elementalPenetration + penetrationFrom-
    // Stacks late bindings resolve into this field pre-resolve).
    if (op.elementalPenetrationBonus !== undefined) {
      options.elementalPenetrationBonus = op.elementalPenetrationBonus
    }

    return options
  }

  /**
   * The reaction profile formula -- khac damage carries the ATTACKER's
   * element so the target's matching elemental resistance applies
   * (reaction spec sec.68: the DamageSystem owns stats/mitigation/
   * resistance; the elementless/true-damage variant was rejected at
   * review, which is why the op still carries `element`). Resolution:
   *   power = elementalBasePower(source, element)   [might + elementPower]
   *   raw   = power x coefficient x (1 - netResistanceMitigation)
   * where net = (resistance - penetration)/100 clamped to [-1, 0.75].
   * NO hit-layer modifiers, NO dotResistance/dotRecovery, NO crit/miss
   * (canCrit:false/canMiss:false stay structural), and no
   * ailmentPotency -- that multiplier is the DoT economy's, not the
   * reaction channel's. An elementless reaction op keeps the legacy
   * flat coefficient lane -- every canonical reaction_damage authors
   * element:'attacker' so that lane is unreachable from production
   * data.
   */
  private resolveReactionAmount(
    op: DealDamageOperation['payload'],
    sourceId: CombatEntityId,
    target: CombatEntity,
  ): number {
    if (op.element === undefined || op.element === 'physical') {
      return Math.max(0, op.coefficient)
    }
    const source = this.resolveEntity(op.statSourceId ?? sourceId)
    const power = source === undefined ? 0 : elementalBasePower(source, op.element)
    const resistance = target.stats[`${op.element}Resistance`] ?? 0
    const penetration = source?.stats[`${op.element}Penetration`] ?? 0
    const mitigation = getResistanceMitigationPercent(resistance, penetration)
    return Math.max(0, power * op.coefficient * (1 - mitigation))
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
    // canonical-seals addendum: the instance-local bonus ADDS penetration
    // points at resolution -- never a source.stats mutation (structural
    // validation already confined the field to this profile+origin lane).
    const penetration =
      (source?.stats[`${op.element}Penetration`] ?? 0) +
      (op.elementalPenetrationBonus ?? 0)
    const mitigation =
      getResistanceMitigationPercent(resistance, penetration) * armorIgnoreMultiplier
    return Math.max(0, power * ratio * (1 - mitigation)) * potencyMultiplier
  }
}
