// Phap Tu Reimagined Task 12 — spec §6 sinh/khac RULE engine. The 10
// authored ELEMENT_REACTIONS pairs are retired; every unordered
// distinct-element pair resolves through exactly one of two rule
// classes read from WuxingRelations (the one authority for pair
// relations):
//
//   khac pair -> KHAC CHE: consume BOTH instances; burst =
//     consumedStacks x elementalBasePower(source, overcomer)
//     x KHAC_CHE_COEFF x (1 + reactionEffectPercent), dealt on the
//     OVERCOMER element (target's resistance to it applies normally).
//   sinh pair -> CONG MINH: no consume; the wuxing-direction CHILD
//     gains potency + duration on its remaining life (v1 locked:
//     amp only — no zone, no self-buff).
//
// One application event resolves in TWO PHASES (INV-17): every sinh
// pair first, then every khac pair, each in canonical ELEMENT_ORDER —
// generation before destruction. A khac resolution consumes the
// newcomer, which ends its remaining pairs. Pair granularity is the
// incumbent ELEMENT (<=4 distinct elements); the OLDEST instance of
// each element is the one consumed (BuffPool insertion order, the
// ARCH-009 contract).
import type { CombatEntity } from '../../combat/CombatEntity'
import type { CombatSystem } from '../../combat/CombatSystem'
import type { BuffPool } from '../../buff/BuffPool'
import { scaleBuffPotency } from '../../buff/BuffSystem'
import type { Buff, BuffDefinitionCatalog } from '../../buff/BuffTypes'
import type { ElementType } from '../../element/ElementType'
import type { EventBus } from '../../events/EventBus'
import { elementalBasePower } from '../../combat/ElementDamageCalculator'
import { getResistanceMitigationPercent } from '../../combat/Resistance'
import { ELEMENT_ORDER } from '../../element/ElementLabels'
import { khacOvercomer, relationOf, sinhBeneficiary } from '../../element/WuxingRelations'

// First-pass tuning constants (plan constants block) — KHAC_CHE_COEFF
// lives here per the plan; CONG_MINH_AMP is the v1 sinh amp (potency
// and remaining-duration multiplier), unpinned by spec and flagged for
// the balance pass.
export const KHAC_CHE_COEFF = 1.0
export const CONG_MINH_AMP = 0.5

interface ElementIncumbent {
  buff: Buff
  element: ElementType
  order: number
}

function elementOf(
  buffRegistry: BuffDefinitionCatalog,
  buffId: string,
): ElementType | undefined {
  try {
    return buffRegistry.get(buffId).element
  } catch {
    return undefined
  }
}

export class TurnReactionManager {
  constructor(private readonly eventBus: EventBus) {}

  /**
   * Called once per successful ailment application (the "newcomer").
   * Provenance-agnostic incumbents — a pair forms on coexisting
   * ELEMENTS regardless of applier; initiation gating (player-origin
   * only, INV-8/D21) is the CALLER's job (applySkillAilments).
   */
  checkAndTrigger(
    targetBuffs: BuffPool,
    newBuffId: string,
    source: CombatEntity,
    target: CombatEntity,
    combatSystem: CombatSystem,
    buffRegistry: BuffDefinitionCatalog,
  ): void {
    const newcomerElement = elementOf(buffRegistry, newBuffId)
    if (!newcomerElement) return

    // The just-applied ingredient instance — ARCH-009 identity is
    // (id, sourceId). If the application left no live instance
    // (convertsToId path, immediate removal) there is nothing to pair.
    const newcomer = targetBuffs.getFromSource(newBuffId, source.id)
    if (!newcomer) return

    // Oldest live instance per distinct element, excluding the newcomer
    // and anything sharing its element (same-element pairs never react).
    const incumbents = new Map<ElementType, ElementIncumbent>()
    for (const buff of targetBuffs.getAll()) {
      if (buff === newcomer) continue

      const element = elementOf(buffRegistry, buff.id)
      if (!element || element === newcomerElement || incumbents.has(element)) continue

      incumbents.set(element, { buff, element, order: ELEMENT_ORDER.indexOf(element) })
    }

    const pairs = [...incumbents.values()].sort((a, b) => a.order - b.order)

    // Phase 1 — every CONG MINH (sinh) pair in ELEMENT_ORDER.
    for (const { buff: incumbent, element } of pairs) {
      if (relationOf(newcomerElement, element) !== 'sinh') continue

      const child =
        sinhBeneficiary(newcomerElement, element) === newcomerElement ? newcomer : incumbent

      // Review fix (MED-4) — "potency" is every numeric magnitude
      // carrier on the child (buff-domain primitive), not only DoT
      // fields: a non-DoT child like Thach Hoa (statModifier +
      // onHitProc) now gains real potency, not just duration.
      scaleBuffPotency(child, 1 + CONG_MINH_AMP)
      child.remainingTurns *= 1 + CONG_MINH_AMP
      if (child.remainingTime !== undefined) child.remainingTime *= 1 + CONG_MINH_AMP

      this.eventBus.emit('reaction', {
        type: 'reaction',
        sourceId: source.id,
        targetId: target.id,
        name: 'cong_minh',
        damage: 0,
      })
    }

    // Phase 2 — every KHAC CHE (khac) pair in ELEMENT_ORDER. A consumed
    // newcomer ends its remaining pairs.
    for (const { buff: incumbent, element } of pairs) {
      if (relationOf(newcomerElement, element) !== 'khac') continue
      if (!targetBuffs.hasInstance(newcomer)) break
      if (!targetBuffs.hasInstance(incumbent)) continue

      const overcomer = khacOvercomer(newcomerElement, element)
      const consumedStacks = newcomer.stacks + incumbent.stacks

      const rawBurst =
        consumedStacks *
        elementalBasePower(source, overcomer) *
        KHAC_CHE_COEFF *
        (1 + source.stats.reactionEffectPercent)

      const mitigation = getResistanceMitigationPercent(
        target.stats[`${overcomer}Resistance`],
        source.stats[`${overcomer}Penetration`],
      )
      const burst = rawBurst * (1 - mitigation)

      targetBuffs.removeInstance(incumbent.id, incumbent.sourceId)
      targetBuffs.removeInstance(newcomer.id, newcomer.sourceId)

      combatSystem.applyModifiedDirectDamage(target, burst, source, 'reaction')

      this.eventBus.emit('reaction', {
        type: 'reaction',
        sourceId: source.id,
        targetId: target.id,
        name: 'khac_che',
        damage: burst,
      })

      combatSystem.killIfDead(target, source.id)
    }
  }
}
