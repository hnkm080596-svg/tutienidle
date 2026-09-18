import type { CombatEntity } from '../combat/CombatEntity'
import type { CombatSystem } from '../combat/CombatSystem'
import { getArmorMitigationPercent } from '../combat/Armor'
import { getResistanceMitigationPercent } from '../combat/Resistance'
import { elementalBasePower } from '../combat/ElementDamageCalculator'
import type { StatModifier } from '../stats/StatCalculator'
import { BuffPool } from './BuffPool'
import type {
  Buff,
  BuffCcEffect,
  BuffDefinition,
  BuffEffectTemplate,
  BuffDefinitionCatalog,
} from './BuffTypes'

// R4 (AR-19) — Canonical BuffSystem.
// Single authoritative buff system for the project. Turn-native by
// construction, with updateTime() support for out-of-battle persistent buffs.

const AILMENT_RESIST_CAP = 0.75

/**
 * Review fix (MED-4) — generic potency amplification for a live Buff.
 * Scales EVERY numeric magnitude carrier on the buff's effects, not just
 * DoT fields: statModifier flat/percent, onHitProc and reactiveTrigger
 * proc chances, gaugeDelta percent, dotRecovery heal. Chance-type fields
 * clamp at 1. Sign is preserved — a debuff's -0.3 deepens to -0.45 at
 * x1.5, a buff's +0.3 strengthens to +0.45. Duration is NOT touched here
 * (callers own their own duration policy — Cong Minh amps it separately).
 *
 * Once per INSTANCE: the buff's potencyAmplified flag marks the consumed
 * amplification — refresh/stack keep the instance, so without it repeat
 * events compound (x1.5 -> x2.25 -> ...). Returns false when the instance
 * was already amplified so callers can skip the rest of their amp path.
 */
export function scaleBuffPotency(buff: Buff, factor: number): boolean {
  if (buff.potencyAmplified) {
    return false
  }

  buff.potencyAmplified = true

  for (const effect of buff.effects) {
    switch (effect.type) {
      case 'dot':
        if (effect.damagePerTurn !== undefined) effect.damagePerTurn *= factor
        if (effect.damagePerSecond !== undefined) effect.damagePerSecond *= factor
        break
      case 'statModifier':
        if (effect.percent !== undefined) effect.percent *= factor
        if (effect.flat !== undefined) effect.flat *= factor
        break
      case 'onHitProc':
      case 'reactiveTrigger':
        effect.chance = Math.min(1, effect.chance * factor)
        break
      case 'gaugeDelta':
        effect.percentOfMax *= factor
        break
      case 'dotRecovery':
        effect.healPercent *= factor
        break
    }
  }

  return true
}


export class BuffSystem {
  constructor(private readonly pool: BuffPool) {}

  /**
   * M10 (ARCH-008) — `durationOverride` replaces the registry's authored
   * duration as the pre-resist base (SkillEffect.duration semantics from
   * the legacy effect system). undefined keeps `definition.duration`.
   */
  apply(
    definition: BuffDefinition,
    source: CombatEntity,
    target: CombatEntity,
    registry?: BuffDefinitionCatalog,
    durationOverride?: number,
  ) {
    const resolvedEffects = definition.effects.map((effect) => {
      if (effect.type === 'dot') {
        const dmg = this.calculateDamagePerTurn(effect, source, target)
        return {
          type: 'dot' as const,
          damagePerTurn: dmg,
          damagePerSecond: dmg,
          element: effect.element,
        }
      }
      // Detach from the registry template — runtime mutations
      // (scaleBuffPotency/Cong Minh) must never write back into the
      // canonical BuffDefinition. All BuffEffectTemplate fields are
      // primitives, so a shallow spread is a complete clone.
      return { ...effect }
    })

    // The Tu Reimagined (plan v2.4 review P0) — fixed_holder_turns:
    // the authored duration IS the holder-turn count; neither the
    // target's ailment resist nor the source's ailment-duration stat may
    // scale it. ailment_scaled (default) keeps the legacy formula.
    const baseDuration = durationOverride ?? definition.duration
    const duration =
      definition.durationPolicy === 'fixed_holder_turns'
        ? baseDuration
        : baseDuration * (1 - Math.min(AILMENT_RESIST_CAP, Math.max(0, target.stats.ailmentResistPercent))) * (1 + source.stats.ailmentDurationPercent)

    // uniquePerTarget — newest application wins by construction: drop
    // every instance of this id (any source) before adding the new one.
    if (definition.uniquePerTarget) {
      this.pool.removeAllById(definition.id)
    }

    const existing = this.pool.getFromSource(definition.id, source.id)

    if (!existing) {
      this.pool.add({
        id: definition.id,
        sourceId: source.id,
        targetId: target.id,
        polarity: definition.polarity,
        hidden: definition.hidden,
        duration,
        remainingTurns: duration,
        remainingTime: duration,
        stacks: 1,
        maxStacks: definition.maxStacks,
        stackMode: definition.stackMode,
        continuousTurns: 0,
        continuousSeconds: 0,
        convertsToId: definition.convertsToId,
        convertsAfterContinuousTurns: definition.convertsAfterContinuousTurns ?? definition.convertsAfterContinuousSeconds,
        effects: resolvedEffects,
      })
      return
    }

    this.handleExisting(existing, definition, source, target, duration, resolvedEffects, registry)
  }

  private handleExisting(
    existing: Buff,
    definition: BuffDefinition,
    source: CombatEntity,
    target: CombatEntity,
    duration: number,
    resolvedEffects: Buff['effects'],
    registry?: BuffDefinitionCatalog,
  ) {
    switch (definition.stackMode) {
      case 'stack': {
        let nextStacks = existing.stacks + 1
        if (existing.maxStacks !== undefined) {
          nextStacks = Math.min(nextStacks, existing.maxStacks)
        }

        if (
          definition.convertsToId &&
          registry &&
          existing.maxStacks !== undefined &&
          nextStacks >= existing.maxStacks
        ) {
          this.pool.removeInstance(existing.id, existing.sourceId)
          this.apply(registry.get(definition.convertsToId), source, target, registry)
          return
        }

        existing.stacks = nextStacks
        existing.remainingTurns = duration
        existing.remainingTime = duration
        break
      }

      case 'refresh':
        existing.remainingTurns = duration
        existing.remainingTime = duration
        break

      case 'replace':
        this.pool.removeInstance(existing.id, existing.sourceId)
        this.pool.add({
          ...existing,
          duration,
          remainingTurns: duration,
          remainingTime: duration,
          effects: resolvedEffects,
        })
        break
    }
  }

  private calculateDamagePerTurn(
    effect: Extract<BuffEffectTemplate, { type: 'dot' }>,
    source: CombatEntity,
    target: CombatEntity,
  ): number {
    const ratio = effect.dpsRatio ?? 1

    const armorIgnoreMultiplier = effect.armorIgnorePercentByRealm
      ? 1 - Math.min(0.9, 0.1 + source.realmIndex * 0.1)
      : 1

    if (!effect.element || effect.element === 'physical') {
      const power = source.stats.might
      const mitigation =
        getArmorMitigationPercent(target.stats.defense, target.realmIndex) * armorIgnoreMultiplier
      return Math.max(0, power * ratio * (1 - mitigation)) * (1 + source.stats.ailmentPotencyPercent)
    }

    const power = elementalBasePower(source, effect.element)
    const resistance = target.stats[`${effect.element}Resistance`]
    const penetration = source.stats[`${effect.element}Penetration`]
    const mitigation = getResistanceMitigationPercent(resistance, penetration) * armorIgnoreMultiplier

    return Math.max(0, power * ratio * (1 - mitigation)) * (1 + source.stats.ailmentPotencyPercent)
  }

  private convert(buff: Buff, registry: BuffDefinitionCatalog, target: CombatEntity, source?: CombatEntity) {
    const nextDefinition = registry.get(buff.convertsToId!)

    this.pool.removeInstance(buff.id, buff.sourceId)

    const duration =
      nextDefinition.durationPolicy === 'fixed_holder_turns'
        ? nextDefinition.duration
        : nextDefinition.duration *
          (1 - Math.min(AILMENT_RESIST_CAP, Math.max(0, target.stats.ailmentResistPercent))) *
          (1 + (source?.stats.ailmentDurationPercent ?? 0))

    this.pool.removeInstance(nextDefinition.id, buff.sourceId)

    this.pool.add({
      id: nextDefinition.id,
      sourceId: buff.sourceId,
      targetId: buff.targetId,
      polarity: nextDefinition.polarity,
      hidden: nextDefinition.hidden,
      duration,
      remainingTurns: duration,
      remainingTime: duration,
      stacks: 1,
      maxStacks: nextDefinition.maxStacks,
      stackMode: nextDefinition.stackMode,
      continuousTurns: 0,
      continuousSeconds: 0,
      convertsToId: nextDefinition.convertsToId,
      convertsAfterContinuousTurns: nextDefinition.convertsAfterContinuousTurns ?? nextDefinition.convertsAfterContinuousSeconds,
      effects: nextDefinition.effects.map((effect) =>
        effect.type === 'dot' ? { ...effect, damagePerTurn: 0 } : { ...effect },
      ),
    })
  }

  /**
   * Universal buff update.
   * - Turn battle: update(target, combatSystem, registry?, resolveSource?, resolveSourceBuffs?) — deltaSeconds = 1.
   * - Wall clock with target/combat: update(deltaSeconds, target, combatSystem, registry?, resolveSource?, resolveSourceBuffs?).
   * - Persistent out-of-battle: update(deltaSeconds) — decrements duration without combat.
   */
  update(
    deltaSeconds: number,
    target?: CombatEntity,
    combatSystem?: CombatSystem,
    registry?: BuffDefinitionCatalog,
    resolveSource?: (sourceId: string) => CombatEntity | undefined,
    resolveSourceBuffs?: (sourceId: string) => readonly Buff[] | undefined,
  ): void
  update(
    target: CombatEntity,
    combatSystem: CombatSystem,
    registry?: BuffDefinitionCatalog,
    resolveSource?: (sourceId: string) => CombatEntity | undefined,
    resolveSourceBuffs?: (sourceId: string) => readonly Buff[] | undefined,
  ): void
  update(
    targetOrDelta: CombatEntity | number,
    targetOrCombat?: CombatEntity | CombatSystem,
    combatOrRegistry?: CombatSystem | BuffDefinitionCatalog,
    registryOrResolve?: BuffDefinitionCatalog | ((sourceId: string) => CombatEntity | undefined),
    // Target-first overloads land their 5th arg (resolveSourceBuffs) in
    // this position, so the union covers both resolver shapes; each
    // branch narrows it to the one its own overload declares.
    resolveSourceParam?:
      | ((sourceId: string) => CombatEntity | undefined)
      | ((sourceId: string) => readonly Buff[] | undefined),
    resolveSourceBuffsParam?: (sourceId: string) => readonly Buff[] | undefined,
  ): void {
    let deltaSeconds = 1
    let target: CombatEntity | undefined
    let combatSystem: CombatSystem | undefined
    let registry: BuffDefinitionCatalog | undefined
    let resolveSource: ((sourceId: string) => CombatEntity | undefined) | undefined
    let resolveSourceBuffs: ((sourceId: string) => readonly Buff[] | undefined) | undefined

    if (typeof targetOrDelta === 'number') {
      deltaSeconds = targetOrDelta
      if (targetOrCombat && typeof targetOrCombat === 'object' && 'stats' in targetOrCombat) {
        target = targetOrCombat as CombatEntity
        combatSystem = combatOrRegistry as CombatSystem | undefined
        registry = registryOrResolve as BuffDefinitionCatalog | undefined
        resolveSource = resolveSourceParam as ((sourceId: string) => CombatEntity | undefined) | undefined
        resolveSourceBuffs = resolveSourceBuffsParam
      } else {
        this.updateTime(targetOrDelta)
        return
      }
    } else {
      target = targetOrDelta
      combatSystem = targetOrCombat as CombatSystem | undefined
      registry = combatOrRegistry as BuffDefinitionCatalog | undefined
      resolveSource = registryOrResolve as ((sourceId: string) => CombatEntity | undefined) | undefined
      resolveSourceBuffs = resolveSourceParam as
        | ((sourceId: string) => readonly Buff[] | undefined)
        | undefined
    }

    if (!combatSystem || !target) return

    const expired: Buff[] = []

    for (const buff of this.pool.getAll()) {
      if (!this.pool.hasInstance(buff)) {
        continue
      }

      buff.continuousTurns = (buff.continuousTurns ?? 0) + deltaSeconds
      buff.continuousSeconds = (buff.continuousSeconds ?? 0) + deltaSeconds

      const continuous = buff.continuousSeconds ?? buff.continuousTurns
      const convertsThreshold = buff.convertsAfterContinuousSeconds ?? buff.convertsAfterContinuousTurns

      if (
        registry &&
        buff.convertsToId &&
        convertsThreshold !== undefined &&
        continuous >= convertsThreshold
      ) {
        this.convert(buff, registry, target, resolveSource?.(buff.sourceId))
        continue
      }

      for (const effect of buff.effects) {
        if (!this.pool.hasInstance(buff)) {
          break
        }

        if (effect.type === 'dot' && target.alive) {
          const dotRate = effect.damagePerSecond ?? effect.damagePerTurn
          if (dotRate) {
            const rawDamage = dotRate * buff.stacks * deltaSeconds

            combatSystem.applyDotDamage({
              sourceId: buff.sourceId,
              source: resolveSource?.(buff.sourceId),
              // buff2 M4 -- this legacy lane is unreachable (no live
              // caller); dot_recovery grants exist only in the buff2
              // capability model, so nothing is resolvable here.
              target,
              rawDamage,
              element: effect.element,
              effectId: buff.id,
            })

            if (!this.pool.hasInstance(buff)) {
              break
            }
          }
        }
      }

      if (!this.pool.hasInstance(buff)) {
        continue
      }

      buff.remainingTurns -= deltaSeconds
      if (buff.remainingTime !== undefined) {
        buff.remainingTime -= deltaSeconds
      }

      const rem = buff.remainingTime ?? buff.remainingTurns
      if (rem <= 0) {
        expired.push(buff)
      }
    }

    for (const buff of expired) {
      this.pool.removeInstance(buff.id, buff.sourceId)
    }
  }

  /**
   * Wall-clock / seconds-based update for out-of-battle persistent buffs
   * (e.g. GameManager.tick() decrementing Kiếp Thương debuff duration).
   */
  updateTime(deltaSeconds: number): void {
    const expired: Buff[] = []

    for (const buff of this.pool.getAll()) {
      if (buff.remainingTurns !== undefined) {
        buff.remainingTurns -= deltaSeconds
      }
      if (buff.remainingTime !== undefined) {
        buff.remainingTime -= deltaSeconds
      }

      const rem = buff.remainingTurns ?? buff.remainingTime ?? 0
      if (rem <= 0) {
        expired.push(buff)
      }
    }

    for (const buff of expired) {
      this.pool.removeInstance(buff.id, buff.sourceId)
    }
  }

  /**
   * ARCH-009 (M9) — target-scoped CC queries. A buff's cc effect applies
   * to buff.targetId, NOT to the pool holder: after the proc-routing fix
   * every buff lands in its victim's pool, but a misrouted/legacy instance
   * whose targetId points elsewhere must not control this holder. Callers
   * pass the entity id they are asking about.
   */
  isStunned(targetId: string): boolean {
    return this.hasActiveCc(targetId, 'stun')
  }

  isFrozen(targetId: string): boolean {
    return this.hasActiveCc(targetId, 'freeze')
  }

  isRooted(targetId: string): boolean {
    return this.hasActiveCc(targetId, 'root')
  }

  private hasActiveCc(targetId: string, ccEffect: BuffCcEffect): boolean {
    return this.pool
      .getAll()
      .some(
        (buff) =>
          buff.targetId === targetId &&
          buff.effects.some((effect) => effect.type === 'cc' && effect.ccEffect === ccEffect),
      )
  }

  getActiveModifiers(): StatModifier[] {
    const modifiers: StatModifier[] = []

    for (const buff of this.pool.getAll()) {
      for (const effect of buff.effects) {
        if (effect.type === 'statModifier') {
          modifiers.push({
            id: `buff:${buff.id}:${buff.sourceId}:${effect.stat}`,
            sourceId: buff.sourceId,
            sourceType: buff.polarity,
            stat: effect.stat,
            flat: effect.flat,
            percent: effect.percent,
            stacks: buff.stacks,
            domain: effect.domain,
          })
        }
      }
    }

    return modifiers
  }

  /**
   * ARCH-009 (M9) — proc'd effects belong to the HIT VICTIM's pool, not
   * the holder's. `this.pool` only supplies the holder's proc definitions;
   * the resulting buff applies through `targetBuffs` so its targetId is
   * the victim and it ticks/cc's on the victim's side. sourceId stays the
   * entity that landed the hit (`source`).
   */
  rollOnHitEffects(
    source: CombatEntity,
    target: CombatEntity,
    targetBuffs: BuffPool,
    registry: BuffDefinitionCatalog,
    // Lazy closure — a stored `Math.random` reference would bypass
    // vi.spyOn interception and the session-RNG boundary (Mission C).
    rng: () => number = () => Math.random(),
  ) {
    const targetBuffSystem = new BuffSystem(targetBuffs)

    for (const buff of this.pool.getAll()) {
      for (const effect of buff.effects) {
        if (effect.type === 'onHitProc' && rng() < effect.chance) {
          const definition = registry.get(effect.appliesBuffId)
          targetBuffSystem.apply(definition, source, target, registry)
        }
      }
    }
  }

  /**
   * The Tu Reimagined (plan Task 8) — `context` carries the landed-hit
   * facts reflection needs (the attacker + the hpDamage actually taken).
   * BuffSystem stays pure (A6): it only RESOLVES reflect requests — the
   * turn engine executes them through the damage authority.
   */
  rollReactiveTrigger(
    target: CombatEntity,
    triggerEvent: 'onCastBegin' | 'onImpactLanded',
    registry: BuffDefinitionCatalog,
    context?: { attacker?: CombatEntity; hpDamage?: number },
    rng: () => number = () => Math.random(),
  ): { firedFollowUp: boolean; reflectRequests: { attackerEntity: CombatEntity; amount: number }[] } {
    let firedFollowUp = false
    const reflectRequests: { attackerEntity: CombatEntity; amount: number }[] = []

    for (const buff of this.pool.getAll()) {
      for (const effect of buff.effects) {
        if (effect.type === 'reactiveTrigger' && effect.trigger === triggerEvent) {
          if (rng() < effect.chance) {
            if (effect.appliesDefinitionId) {
              const definition = registry.get(effect.appliesDefinitionId)
              this.apply(definition, target, target, registry)
            }

            if (effect.queuesFollowUp) {
              firedFollowUp = true
            }

            // Reflection (phan_chinh): only a TAKEN hit reflects — the
            // caller gates on hpDamage > 0; the context guard keeps
            // onCastBegin/context-less calls from reflecting nothing.
            if (effect.reflectsDamage && context?.attacker && (context.hpDamage ?? 0) > 0) {
              reflectRequests.push({
                attackerEntity: context.attacker,
                amount:
                  context.hpDamage! * effect.reflectsDamage.takenRatio +
                  target.stats.maxHp * effect.reflectsDamage.maxHpRatio,
              })
            }
          }
        }
      }
    }

    return { firedFollowUp, reflectRequests }
  }

  getStacks(id: string, sourceId?: string): number {
    if (sourceId !== undefined) {
      return this.pool.getFromSource(id, sourceId)?.stacks ?? 0
    }
    return this.pool.getAllById(id).reduce((sum, b) => sum + b.stacks, 0)
  }

  getFromSource(id: string, sourceId: string): Buff | undefined {
    return this.pool.getFromSource(id, sourceId)
  }

  getActiveIds(): string[] {
    return Array.from(new Set(this.pool.getAll().map((b) => b.id)))
  }

  getAll(): Buff[] {
    return this.pool.getAll()
  }

  getAllById(id: string): Buff[] {
    return this.pool.getAllById(id)
  }

  remove(id: string, sourceId?: string): void {
    if (sourceId !== undefined) {
      this.pool.removeInstance(id, sourceId)
      return
    }

    this.pool.removeAllById(id)
  }

  removeAllById(id: string): void {
    this.pool.removeAllById(id)
  }

  /**
   * The Tu Reimagined (plan Task 9/11) — pool-level cc strip for
   * clearsCcOnApply buffs on grant paths outside TurnBattleSystem's
   * appliesBuffs resolution (e.g. CombatSystem's survive-lethal grant).
   */
  clearCcEffects(): void {
    this.pool.clearCcEffects()
  }

  renewWithExtension(id: string, sourceId: string, addedDuration: number): void {
    const existing = this.pool.getFromSource(id, sourceId)

    if (existing) {
      if (existing.remainingTurns !== undefined) {
        existing.remainingTurns += addedDuration
      }
      if (existing.remainingTime !== undefined) {
        existing.remainingTime += addedDuration
      }
    }
  }
}
