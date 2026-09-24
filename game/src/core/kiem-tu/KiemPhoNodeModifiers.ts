import type { PlayerData } from '../player/Player'
import type { ProgressionNode } from '../progression/ProgressionNode'
import type { KiemPhoCombo, KiemPhoComboModifier } from './KiemPhoSystem'
import type { TurnSkillDefinition } from '../battle/turn/TurnSkillAction'
import { ailmentInteractionPhase, type SkillAilmentInteraction } from '../skill/SkillEffect'
import { nodeWayApplies } from '../progression/NodeSystem'

// Kiem Tu Reimagined Task 11 (spec sec.4.2) - converts purchased nodes
// carrying `effect.swordPathComboModifier` into the runtime modifier hooks
// KiemPhoProvider applies at combo-fire time. Data -> behavior mapping
// lives HERE so node defs stay declarative and the provider never
// learns node ids.
//
// Modifier semantics (apply returns a DERIVED copy, spec's mutation ban):
//   minOrbCount          matches(): pattern has >= count of `orb`
//   completingOrb        matches(): combo's LAST pattern orb equals `orb`
//                        (Kiem Pho Beta Kiem Ket - "combos whose
//                        completing orb is X")
//   bonusDamageMultiplier  damage.multiplier *= (1 + x) (no-op w/o damage)
//   appliesBuff          attach to the combo; same definitionId merges
//                        stacks, different ids COEXIST in the combo's
//                        appliesBuffs list
//   bonusAilmentStacks   add stacks to every buff the combo carries
//   ailmentInteractions  append same-source seal interactions to the
//                        derived combo (phase-sorted by applyModifiers)
//   priority             sort key, default 0
//
// Kiem Pho Beta (design sec.10/15) adds the sibling channel
// `effect.skillDefinitionModifiers` - skill-scoped adjustments folded
// into derived TurnSkillDefinition copies at provider emit (Can /
// Thuan Thuc nodes). It never carries statModifiers: nodes modify the
// SKILL, never the character (design sec.16.A).
export function collectKiemPhoComboModifiers(
  player: PlayerData,
  nodes: readonly ProgressionNode[],
): KiemPhoComboModifier[] {
  const modifiers: KiemPhoComboModifier[] = []

  for (const node of nodes) {
    const data = node.effect.swordPathComboModifier

    if (!data || (player.nodeLevels?.[node.id] ?? 0) <= 0 || !nodeWayApplies(player, node)) {
      continue
    }

    modifiers.push({
      nodeId: node.id,
      priority: data.priority ?? 0,

      matches: combo => {
        if (
          data.minOrbCount !== undefined &&
          combo.pattern.filter(orb => orb === data.minOrbCount!.orb).length < data.minOrbCount!.count
        ) {
          return false
        }
        if (
          data.completingOrb !== undefined &&
          combo.pattern[combo.pattern.length - 1] !== data.completingOrb
        ) {
          return false
        }
        return data.minOrbCount !== undefined || data.completingOrb !== undefined
      },

      apply: combo => {
        const derived: KiemPhoCombo = { ...combo, pattern: [...combo.pattern] }

        if (data.bonusDamageMultiplier && derived.damage) {
          derived.damage = { multiplier: derived.damage.multiplier * (1 + data.bonusDamageMultiplier) }
        }

        const granted = data.appliesBuff
        if (granted) {
          const buffs = [...(derived.appliesBuffs ?? [])]
          const existing = buffs.findIndex(
            (b) => b.definitionId === granted.definitionId && b.target === granted.target,
          )
          if (existing >= 0) {
            buffs[existing] = {
              ...buffs[existing]!,
              stacks: (buffs[existing]!.stacks ?? 1) + (granted.stacks ?? 1),
            }
          } else {
            buffs.push({ ...granted })
          }
          derived.appliesBuffs = buffs
        }

        if (data.bonusAilmentStacks && derived.appliesBuffs?.length) {
          derived.appliesBuffs = derived.appliesBuffs.map((b) => ({
            ...b,
            stacks: (b.stacks ?? 1) + data.bonusAilmentStacks!,
          }))
        }

        if (data.ailmentInteractions !== undefined && data.ailmentInteractions.length > 0) {
          derived.ailmentInteractions = [
            ...(derived.ailmentInteractions ?? []),
            ...data.ailmentInteractions,
          ]
        }

        return derived
      },
    })
  }

  return modifiers
}

/** Runtime form of a purchased `skillDefinitionModifiers` spec: the
    node's level is captured at collect time so the fold is a pure
    data -> derived-def application. */
export interface KiemPhoSkillDefinitionModifier {
  nodeId: string
  skillId: string
  level: number
  priority: number
  damageMultiplierPerLevel?: number
  armorPierceFraction?: number
  addAilmentInteractions?: readonly SkillAilmentInteraction[]
}

/** Collect purchased `skillDefinitionModifiers` entries (way-gated like
    every other kiem_pho node read). */
export function collectKiemPhoSkillDefinitionModifiers(
  player: PlayerData,
  nodes: readonly ProgressionNode[],
): KiemPhoSkillDefinitionModifier[] {
  const modifiers: KiemPhoSkillDefinitionModifier[] = []
  for (const node of nodes) {
    const specs = node.effect.skillDefinitionModifiers
    const level = player.nodeLevels?.[node.id] ?? 0
    if (specs === undefined || specs.length === 0 || level <= 0 || !nodeWayApplies(player, node)) {
      continue
    }
    for (const spec of specs) {
      modifiers.push({
        nodeId: node.id,
        skillId: spec.skillId,
        level,
        priority: spec.priority ?? 0,
        damageMultiplierPerLevel: spec.damageMultiplierPerLevel,
        armorPierceFraction: spec.armorPierceFraction,
        addAilmentInteractions: spec.addAilmentInteractions,
      })
    }
  }
  return modifiers
}

/** Fold the matching modifiers for `def.id` into a DERIVED def copy.
    Returns the SAME object when nothing applies - object-identity
    consumers (INV-13 manual/auto parity) keep their reference when no
    node touches the def. */
export function applySkillDefinitionModifiers(
  def: TurnSkillDefinition,
  modifiers: readonly KiemPhoSkillDefinitionModifier[],
): TurnSkillDefinition {
  const matching = modifiers
    .filter(m => m.skillId === def.id)
    .sort((a, b) => a.priority - b.priority || a.nodeId.localeCompare(b.nodeId))
  if (matching.length === 0) return def

  let derived: TurnSkillDefinition = def
  const ensureDerived = () => {
    if (derived === def) derived = { ...def }
    return derived
  }

  for (const modifier of matching) {
    if (modifier.damageMultiplierPerLevel !== undefined && derived.damage !== undefined) {
      const next = ensureDerived()
      next.damage = {
        ...next.damage!,
        multiplier: next.damage!.multiplier * (1 + modifier.damageMultiplierPerLevel * modifier.level),
      }
    }

    if (modifier.armorPierceFraction !== undefined && derived.damage !== undefined) {
      const next = ensureDerived()
      const existing = next.armorPolicy?.pierceFractionOnFail ?? 0
      next.armorPolicy = {
        ...next.armorPolicy,
        pierceFractionOnFail: Math.min(1, existing + modifier.armorPierceFraction * modifier.level),
      }
    }

    if (modifier.addAilmentInteractions !== undefined && modifier.addAilmentInteractions.length > 0) {
      const next = ensureDerived()
      next.ailmentInteractions = [
        ...(next.ailmentInteractions ?? []),
        ...modifier.addAilmentInteractions,
      ].sort((a, b) => ailmentInteractionPhase(a) - ailmentInteractionPhase(b))
    }
  }

  return derived
}
