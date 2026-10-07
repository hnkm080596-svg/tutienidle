import type { PlayerData } from '../player/Player'
import type { ProgressionNode } from '../progression/ProgressionNode'
import type { StatType } from '../stats/StatTypes'
import type { TurnSkillDefinition } from '../battle/turn/TurnSkillAction'
import { ailmentInteractionPhase, type SkillAilmentInteraction } from '../skill/SkillEffect'
import { isNodeElementEffective, nodePathApplies, nodeWayApplies } from '../progression/NodeSystem'

// Hoa lane + Tam Muoi trades (Minh rulings 2026-10-06) - the spell-path
// consumer of `effect.skillDefinitionModifiers`: purchased node entries
// named for a kit skill fold into a DERIVED TurnSkillDefinition at kit
// build time (resolveBasic / resolveSpecialUltimate in
// CultivationPathRegistry). Mirrors KiemPhoNodeModifiers' collect/apply
// contract - the shared spec stays the ONLY node -> authored-def
// channel; this file owns how the phap_tu runtime folds it.
//
// Folded fields (Kiem Pho parity + the two Hoa additions):
//   damageMultiplierPerLevel  def.damage.multiplier *= (1 + x x nodeLevel)
//   armorPierceFraction       adds to armorPolicy.pierceFractionOnFail
//                             (clamped [0,1]); no-op on damage-less defs
//   addAilmentInteractions    appends, phase-sorted
//   cooldownTurnsDelta        flat once while owned + perLevel x level,
//                             floored at SPECIAL_CD_FLOOR_TURNS and
//                             rounded to whole turns
//   castStatModifiers         summed per stat into def.castModifiers -
//                             additive deltas the engine folds into the
//                             caster's stat view for THIS skill's hits
//                             only (cast scope: character stats and
//                             ailment reads stay untouched)

/** Hard floor for a Phap Trang cooldown after trade deltas (spec v4:
    "minimum 2 turn CD"). */
export const SPECIAL_CD_FLOOR_TURNS = 2

/** Runtime form of a purchased `skillDefinitionModifiers` spec: node
    level is captured at collect time so the fold is a pure data ->
    derived-def application. */
export interface PhapTuSkillDefinitionModifier {
  nodeId: string
  skillId: string
  level: number
  priority: number
  damageMultiplierPerLevel?: number
  armorPierceFraction?: number
  addAilmentInteractions?: readonly SkillAilmentInteraction[]
  cooldownTurnsDelta?: { flat?: number; perLevel?: number }
  castStatModifiers?: readonly { stat: StatType; perLevel: number }[]
}

/** Collect purchased `skillDefinitionModifiers` entries, gated exactly
    like the stat aggregator (path, way, element-effectiveness). */
export function collectPhapTuSkillDefinitionModifiers(
  player: PlayerData,
  nodes: readonly ProgressionNode[],
): PhapTuSkillDefinitionModifier[] {
  const modifiers: PhapTuSkillDefinitionModifier[] = []
  for (const node of nodes) {
    const specs = node.effect.skillDefinitionModifiers
    const level = player.nodeLevels?.[node.id] ?? 0
    if (
      specs === undefined ||
      specs.length === 0 ||
      level <= 0 ||
      !nodePathApplies(player, node) ||
      !nodeWayApplies(player, node) ||
      !isNodeElementEffective(player, node)
    ) {
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
        cooldownTurnsDelta: spec.cooldownTurnsDelta,
        castStatModifiers: spec.castStatModifiers,
      })
    }
  }
  return modifiers
}

/** Fold the matching modifiers for `def.id` into a DERIVED def copy.
    Returns the SAME object when nothing applies - object-identity
    consumers keep their reference when no node touches the def. */
export function applyPhapTuSkillDefinitionModifiers(
  def: TurnSkillDefinition,
  modifiers: readonly PhapTuSkillDefinitionModifier[],
): TurnSkillDefinition {
  const matching = modifiers
    .filter((m) => m.skillId === def.id)
    .sort((a, b) => a.priority - b.priority || a.nodeId.localeCompare(b.nodeId))
  if (matching.length === 0) return def

  let derived: TurnSkillDefinition = def
  const ensureDerived = () => {
    if (derived === def) derived = { ...def }
    return derived
  }

  // cooldownTurnsDelta folds sum-first then floors once ("minimum 2
  // turn CD" reads aggregate) - per-modifier flooring would make the
  // result order-sensitive when an intermediate dip crosses the floor.
  let cooldownDeltaSum = 0

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
        pierceFractionOnFail: Math.min(1, Math.max(0, existing + modifier.armorPierceFraction * modifier.level)),
      }
    }

    if (modifier.addAilmentInteractions !== undefined && modifier.addAilmentInteractions.length > 0) {
      const next = ensureDerived()
      next.ailmentInteractions = [
        ...(next.ailmentInteractions ?? []),
        ...modifier.addAilmentInteractions,
      ].sort((a, b) => ailmentInteractionPhase(a) - ailmentInteractionPhase(b))
    }

    if (modifier.cooldownTurnsDelta !== undefined) {
      cooldownDeltaSum +=
        (modifier.cooldownTurnsDelta.flat ?? 0) +
        (modifier.cooldownTurnsDelta.perLevel ?? 0) * modifier.level
    }

    if (modifier.castStatModifiers !== undefined && modifier.castStatModifiers.length > 0) {
      const next = ensureDerived()
      const merged = new Map<StatType, number>((next.castModifiers ?? []).map((m) => [m.stat, m.value]))
      for (const entry of modifier.castStatModifiers) {
        merged.set(entry.stat, (merged.get(entry.stat) ?? 0) + entry.perLevel * modifier.level)
      }
      next.castModifiers = [...merged.entries()].map(([stat, value]) => ({ stat, value }))
    }
  }

  if (cooldownDeltaSum !== 0) {
    const next = ensureDerived()
    next.cooldownTurns = Math.max(
      SPECIAL_CD_FLOOR_TURNS,
      Math.floor(next.cooldownTurns + cooldownDeltaSum),
    )
  }

  return derived
}
