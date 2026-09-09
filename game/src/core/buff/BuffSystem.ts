import type { CombatEntity } from '../combat/CombatEntity'
import type { CombatSystem } from '../combat/CombatSystem'
import { getArmorMitigationPercent } from '../combat/Armor'
import { getResistanceMitigationPercent } from '../combat/Resistance'
import { elementalBasePower } from '../combat/ElementDamageCalculator'
import { getSkillRuntimeStat } from '../skill/SkillRuntimeStats'
import type { StatModifier } from '../stats/StatCalculator'
import { BuffPool } from './BuffPool'
import type {
  Buff,
  BuffDefinition,
  BuffEffectTemplate,
  BuffRegistry,
} from './BuffTypes'

// R4 (AR-19) — Canonical BuffSystem.
// Single authoritative buff system for the project. Turn-native by
// construction, with updateTime() support for out-of-battle persistent buffs.

const AILMENT_RESIST_CAP = 0.75

const POISON_ROOT_THRESHOLD_STACKS = 3

export class BuffSystem {
  constructor(private readonly pool: BuffPool) {}

  apply(definition: BuffDefinition, source: CombatEntity, target: CombatEntity, registry?: BuffRegistry) {
    const resolvedEffects = definition.effects.map((effect) => {
      if (effect.type === 'dot') {
        const dmg = this.calculateDamagePerTurn(effect, source, target)
        return {
          type: 'dot' as const,
          damagePerTurn: dmg,
          damagePerSecond: dmg,
          element: effect.element,
          poisonRootPercentPerStack: effect.poisonRootPercentPerStack,
          poisonRootMaxStacks: effect.poisonRootMaxStacks,
          poisonRootThresholdBonusPercent: effect.poisonRootThresholdBonusPercent,
        }
      }
      return effect
    })

    const resistMultiplier = 1 - Math.min(AILMENT_RESIST_CAP, Math.max(0, target.stats.ailmentResistPercent))
    const duration = definition.duration * resistMultiplier * (1 + source.stats.ailmentDurationPercent)

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
        maxStacks: this.resolveMaxStacks(definition, source),
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

  private resolveMaxStacks(definition: BuffDefinition, source: CombatEntity): number | undefined {
    if (definition.maxStacks === undefined) {
      return undefined
    }

    const bonus = source.skillStats?.maxStacksBonusByBuffId?.[definition.id] ?? 0

    return definition.maxStacks + bonus
  }

  private handleExisting(
    existing: Buff,
    definition: BuffDefinition,
    source: CombatEntity,
    target: CombatEntity,
    duration: number,
    resolvedEffects: Buff['effects'],
    registry?: BuffRegistry,
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

  private getPoisonRootMultiplier(
    effect: Extract<Buff['effects'][number], { type: 'dot' }>,
    continuousTurns: number,
  ): number {
    if (!effect.poisonRootMaxStacks) {
      return 1
    }

    const rootStacks = Math.min(effect.poisonRootMaxStacks, Math.floor(continuousTurns))
    const thresholdBonus =
      rootStacks >= POISON_ROOT_THRESHOLD_STACKS ? (effect.poisonRootThresholdBonusPercent ?? 0) : 0

    return 1 + (effect.poisonRootPercentPerStack ?? 0) * rootStacks + thresholdBonus
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
      const power = source.stats.attack
      const mitigation =
        getArmorMitigationPercent(target.stats.defense, target.realmIndex) * armorIgnoreMultiplier
      return Math.max(0, power * ratio * (1 - mitigation)) * (1 + source.stats.ailmentPotencyPercent)
    }

    const power = elementalBasePower(source, effect.element)
    const resistance = target.stats[`${effect.element}Resistance`]
    const penetration = source.stats[`${effect.element}Penetration`]
    const mitigation = getResistanceMitigationPercent(resistance, penetration) * armorIgnoreMultiplier

    const kimTheMultiplier =
      effect.element === 'metal'
        ? 1 +
          source.currentKimThe * getSkillRuntimeStat(source, 'kimTheDotDamagePercentPerStack') +
          getSkillRuntimeStat(source, 'metalAilmentPotencyPercent')
        : 1

    return Math.max(0, power * ratio * (1 - mitigation)) * (1 + source.stats.ailmentPotencyPercent) * kimTheMultiplier
  }

  private convert(buff: Buff, registry: BuffRegistry, target: CombatEntity, source?: CombatEntity) {
    const nextDefinition = registry.get(buff.convertsToId!)

    this.pool.removeInstance(buff.id, buff.sourceId)

    const resistMultiplier = 1 - Math.min(AILMENT_RESIST_CAP, Math.max(0, target.stats.ailmentResistPercent))
    const duration = nextDefinition.duration * resistMultiplier * (1 + (source?.stats.ailmentDurationPercent ?? 0))

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
        effect.type === 'dot' ? { ...effect, damagePerTurn: 0 } : effect,
      ),
    })
  }

  /**
   * Universal buff update.
   * - Turn battle: update(target, combatSystem, registry?, resolveSource?) — deltaSeconds = 1.
   * - Wall clock with target/combat: update(deltaSeconds, target, combatSystem, registry?, resolveSource?).
   * - Persistent out-of-battle: update(deltaSeconds) — decrements duration without combat.
   */
  update(
    deltaSeconds: number,
    target?: CombatEntity,
    combatSystem?: CombatSystem,
    registry?: BuffRegistry,
    resolveSource?: (sourceId: string) => CombatEntity | undefined,
  ): void
  update(
    target: CombatEntity,
    combatSystem: CombatSystem,
    registry?: BuffRegistry,
    resolveSource?: (sourceId: string) => CombatEntity | undefined,
  ): void
  update(
    targetOrDelta: CombatEntity | number,
    targetOrCombat?: CombatEntity | CombatSystem,
    combatOrRegistry?: CombatSystem | BuffRegistry,
    registryOrResolve?: BuffRegistry | ((sourceId: string) => CombatEntity | undefined),
    resolveSourceParam?: (sourceId: string) => CombatEntity | undefined,
  ): void {
    let deltaSeconds = 1
    let target: CombatEntity | undefined
    let combatSystem: CombatSystem | undefined
    let registry: BuffRegistry | undefined
    let resolveSource: ((sourceId: string) => CombatEntity | undefined) | undefined

    if (typeof targetOrDelta === 'number') {
      deltaSeconds = targetOrDelta
      if (targetOrCombat && typeof targetOrCombat === 'object' && 'stats' in targetOrCombat) {
        target = targetOrCombat as CombatEntity
        combatSystem = combatOrRegistry as CombatSystem | undefined
        registry = registryOrResolve as BuffRegistry | undefined
        resolveSource = resolveSourceParam
      } else {
        this.updateTime(targetOrDelta)
        return
      }
    } else {
      target = targetOrDelta
      combatSystem = targetOrCombat as CombatSystem | undefined
      registry = combatOrRegistry as BuffRegistry | undefined
      resolveSource = registryOrResolve as ((sourceId: string) => CombatEntity | undefined) | undefined
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
            const rawDamage =
              dotRate * buff.stacks * this.getPoisonRootMultiplier(effect, continuous) * deltaSeconds

            combatSystem.applyDotDamage({
              sourceId: buff.sourceId,
              source: resolveSource?.(buff.sourceId),
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

  isStunned(): boolean {
    return this.pool.getAll().some((buff) => buff.effects.some((e) => e.type === 'cc' && e.ccEffect === 'stun'))
  }

  isFrozen(): boolean {
    return this.pool.getAll().some((buff) => buff.effects.some((e) => e.type === 'cc' && e.ccEffect === 'freeze'))
  }

  isRooted(): boolean {
    return this.pool.getAll().some((buff) => buff.effects.some((e) => e.type === 'cc' && e.ccEffect === 'root'))
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
          })
        }
      }
    }

    return modifiers
  }

  rollOnHitEffects(source: CombatEntity, target: CombatEntity, registry: BuffRegistry) {
    for (const buff of this.pool.getAll()) {
      for (const effect of buff.effects) {
        if (effect.type === 'onHitProc' && Math.random() < effect.chance) {
          const definition = registry.get(effect.appliesBuffId)
          this.apply(definition, source, target, registry)
        }
      }
    }
  }

  rollReactiveTrigger(
    target: CombatEntity,
    triggerEvent: 'onCastBegin' | 'onImpactLanded',
    registry: BuffRegistry,
  ): { firedFollowUp: boolean } {
    let firedFollowUp = false

    for (const buff of this.pool.getAll()) {
      for (const effect of buff.effects) {
        if (effect.type === 'reactiveTrigger' && effect.trigger === triggerEvent) {
          if (Math.random() < effect.chance) {
            if (effect.appliesDefinitionId) {
              const definition = registry.get(effect.appliesDefinitionId)
              this.apply(definition, target, target, registry)
            }

            if (effect.queuesFollowUp) {
              firedFollowUp = true
            }
          }
        }
      }
    }

    return { firedFollowUp }
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
