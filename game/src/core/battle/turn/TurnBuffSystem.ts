// TurnBuffSystem — song song với BuffSystem.ts (real-time) nhưng duration
// ĐO BẰNG LƯỢT: apply/update/convert/CC-check port verbatim, đổi
// remainingTime → remainingTurns, continuousSeconds → continuousTurns,
// damagePerSecond → damagePerTurn (spec 2026-09-04-turn-buff-system §3).
// KHÔNG import từ BuffSystem.ts; pure helpers thời gian-không-liên-quan
// (Armor/Resistance/ElementDamageCalculator/SkillRuntimeStats) reuse qua
// import từ vị trí gốc.
import type { CombatEntity } from '../../combat/CombatEntity'
import type { CombatSystem } from '../../combat/CombatSystem'
import { getArmorMitigationPercent } from '../../combat/Armor'
import { getResistanceMitigationPercent } from '../../combat/Resistance'
import { elementalBasePower } from '../../combat/ElementDamageCalculator'
import { getSkillRuntimeStat } from '../../skill/SkillRuntimeStats'
import type { StatModifier } from '../../stats/StatCalculator'
import { TurnBuffPool } from './TurnBuffPool'
import type {
  TurnBuff,
  TurnBuffDefinition,
  TurnBuffEffectTemplate,
  TurnBuffRegistry,
} from './TurnBuffTypes'

// Ported verbatim from BuffSystem.ts's AILMENT_RESIST_CAP — trần % giảm
// duration buff/debuff nhận vào.
const AILMENT_RESIST_CAP = 0.75

// Ported verbatim from BuffSystem.ts's POISON_ROOT_THRESHOLD_STACKS.
const POISON_ROOT_THRESHOLD_STACKS = 3

export class TurnBuffSystem {
  constructor(private readonly pool: TurnBuffPool) {}

  apply(definition: TurnBuffDefinition, source: CombatEntity, target: CombatEntity, registry?: TurnBuffRegistry) {
    const resolvedEffects = definition.effects.map((effect) =>
      effect.type === 'dot'
        ? {
            type: 'dot' as const,
            damagePerTurn: this.calculateDamagePerTurn(effect, source, target),
            element: effect.element,
            poisonRootPercentPerStack: effect.poisonRootPercentPerStack,
            poisonRootMaxStacks: effect.poisonRootMaxStacks,
            poisonRootThresholdBonusPercent: effect.poisonRootThresholdBonusPercent,
          }
        : effect,
    )

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
        stacks: 1,
        maxStacks: this.resolveMaxStacks(definition, source),
        stackMode: definition.stackMode,
        continuousTurns: 0,
        convertsToId: definition.convertsToId,
        convertsAfterContinuousTurns: definition.convertsAfterContinuousTurns,
        effects: resolvedEffects,
      })
      return
    }

    this.handleExisting(existing, definition, source, target, duration, resolvedEffects, registry)
  }

  private resolveMaxStacks(definition: TurnBuffDefinition, source: CombatEntity): number | undefined {
    if (definition.maxStacks === undefined) {
      return undefined
    }

    const bonus = source.skillStats?.maxStacksBonusByBuffId?.[definition.id] ?? 0

    return definition.maxStacks + bonus
  }

  private handleExisting(
    existing: TurnBuff,
    definition: TurnBuffDefinition,
    source: CombatEntity,
    target: CombatEntity,
    duration: number,
    resolvedEffects: TurnBuff['effects'],
    registry?: TurnBuffRegistry,
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
        break
      }

      case 'refresh':
        existing.remainingTurns = duration
        break

      case 'replace':
        this.pool.removeInstance(existing.id, existing.sourceId)
        this.pool.add({
          ...existing,
          duration,
          remainingTurns: duration,
          effects: resolvedEffects,
        })
        break
    }
  }

  private getPoisonRootMultiplier(
    effect: Extract<TurnBuff['effects'][number], { type: 'dot' }>,
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
    effect: Extract<TurnBuffEffectTemplate, { type: 'dot' }>,
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

  private convert(buff: TurnBuff, registry: TurnBuffRegistry, target: CombatEntity, source?: CombatEntity) {
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
      stacks: 1,
      maxStacks: nextDefinition.maxStacks,
      stackMode: nextDefinition.stackMode,
      continuousTurns: 0,
      convertsToId: nextDefinition.convertsToId,
      convertsAfterContinuousTurns: nextDefinition.convertsAfterContinuousTurns,
      // Defect Task 8 (2026-09-05): Convert-to-id chains hiện KHÔNG mang theo
      // dot damage của buff gốc (hardcode 0) — nếu tương lai cần 1 chain
      // convert dựa trên dot (vd. Độc → Cháy giữ % sát thương gốc), phải sửa
      // Ở ĐÂY, không giả định giá trị tự động carry qua.
      effects: nextDefinition.effects.map((effect) =>
        effect.type === 'dot' ? { ...effect, damagePerTurn: 0 } : effect,
      ),
    })
  }

  update(
    target: CombatEntity,
    combatSystem: CombatSystem,
    registry?: TurnBuffRegistry,
    resolveSource?: (sourceId: string) => CombatEntity | undefined,
  ) {
    const expired: TurnBuff[] = []

    // Defect Task 8 (2026-09-05): duration/remainingTurns có thể là số thập
    // phân (resist%/duration-bonus% scale) — hệ tick nguyên lượt nên 1 buff
    // duration=2.3 thực tế tồn tại hết lượt thứ 3 (làm tròn lên), KHÔNG hết
    // đúng giữa lượt 2 và 3. Đây là hành vi đã biết (không phải bug) —
    // balance pass cần tính theo số lượt NGUYÊN thực tế, không phải giá trị
    // duration thô.
    for (const buff of this.pool.getAll()) {
      buff.continuousTurns += 1

      if (
        registry &&
        buff.convertsToId &&
        buff.convertsAfterContinuousTurns !== undefined &&
        buff.continuousTurns >= buff.convertsAfterContinuousTurns
      ) {
        this.convert(buff, registry, target, resolveSource?.(buff.sourceId))
        continue
      }

      for (const effect of buff.effects) {
        if (effect.type === 'dot' && effect.damagePerTurn && target.alive) {
          const rawDamage =
            effect.damagePerTurn * buff.stacks * this.getPoisonRootMultiplier(effect, buff.continuousTurns)

          combatSystem.applyDotDamage({
            sourceId: buff.sourceId,
            source: resolveSource?.(buff.sourceId),
            target,
            rawDamage,
            element: effect.element,
            effectId: buff.id,
          })
        }
      }

      buff.remainingTurns -= 1
      if (buff.remainingTurns <= 0) {
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

  // Thổ Tu ("Trói Chân") — Root: CHỈ chặn di chuyển (turn-based engine
  // không có movement liên tục — giữ method cho parity + future use).
  isRooted(): boolean {
    return this.pool.getAll().some((buff) => buff.effects.some((e) => e.type === 'cc' && e.ccEffect === 'root'))
  }

  /**
   * Port verbatim từ BuffSystem.getActiveModifiers() (BuffSystem.ts:336-356):
   * gom mọi statModifier effect đang active thành StatModifier[] (giữ
   * provenance + stacks) — đầu vào cho StatCalculator.calculateStats()
   * (xem TurnStatsRecompute.ts). Đổi field time-based theo quy ước file.
   */
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

  /**
   * Port verbatim từ BuffSystem.rollOnHitEffects() (BuffSystem.ts:383-391):
   * quét MỌI buff active trên pool (pool của TARGET vừa bị đánh trúng),
   * roll ĐỘC LẬP từng onHitProc effect, thắng roll thì áp appliesBuffId
   * (buff mới có source = kẻ vừa đánh trúng).
   */
  rollOnHitEffects(source: CombatEntity, target: CombatEntity, registry: TurnBuffRegistry) {
    for (const buff of this.pool.getAll()) {
      for (const effect of buff.effects) {
        if (effect.type === 'onHitProc' && Math.random() < effect.chance) {
          this.apply(registry.get(effect.appliesBuffId), source, target, registry)
        }
      }
    }
  }

  /**
   * Action Playback Task 5 (2026-09-05) — roll reactiveTrigger effects trên
   * pool của `entity` (mirror rollOnHitEffects conventions). Trả về
   * firedFollowUp khi 1 onImpactLanded trigger có queuesFollowUp thắng roll
   * (GameManager/TurnBattleSystem đặt battle.queuedFollowUpActorId).
   */
  rollReactiveTrigger(
    entity: CombatEntity,
    trigger: 'onCastBegin' | 'onImpactLanded',
    registry: TurnBuffRegistry,
  ): { firedFollowUp: boolean } {
    let firedFollowUp = false

    for (const buff of this.pool.getAll()) {
      for (const effect of buff.effects) {
        if (effect.type !== 'reactiveTrigger' || effect.trigger !== trigger) {
          continue
        }

        if (Math.random() >= effect.chance) {
          continue
        }

        if (effect.appliesDefinitionId) {
          this.apply(registry.get(effect.appliesDefinitionId), entity, entity, registry)
        }

        if (effect.queuesFollowUp) {
          firedFollowUp = true
        }
      }
    }

    return { firedFollowUp }
  }

  /**
   * Port verbatim từ BuffSystem.getStacks() (BuffSystem.ts:397-402):
   * không sourceId = tổng stacks trên MỌI nguồn; có sourceId = đúng 1
   * instance của nguồn đó.
   */
  getStacks(id: string, sourceId?: string): number {
    if (sourceId !== undefined) {
      return this.pool.getFromSource(id, sourceId)?.stacks ?? 0
    }
    return this.pool.getAllById(id).reduce((sum, buff) => sum + buff.stacks, 0)
  }
}
