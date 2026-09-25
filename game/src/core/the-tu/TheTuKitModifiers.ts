import type { PlayerData } from '../player/Player'
import type { ProgressionNode } from '../progression/ProgressionNode'
import { getNodeLevel, nodePathApplies, nodeWayApplies } from '../progression/NodeSystem'

// The Tu beta — the ONLY node -> kit channel for body. Nodes declare
// `effect.bodyKitModifiers` (flat, per-level); this collector sums them
// by channel over owned node levels and the participant build bakes the
// totals into participant-local def clones (kit skills + the phan_chan
// buff def). Registry/singleton defs are NEVER mutated — a shared-def
// mutation would leak node state across participants, battles, and
// tests. Every channel is skill-local: nodes fix CONVERSION/coercion,
// never character stats (no Might/HP/Defense/Block grants — beta spec).

export interface BodyKitModifierValues {
  /** Trong Quyen: adds to cuong_quyen's damage multiplier (Might-conversion). */
  cuongQuyenCoefficientBonus: number
  /** Pha Kinh: armor-pierce pierceFraction on cuong_quyen's hit. */
  cuongQuyenArmorPierce: number
  /** Huyet Sat: adds to loan_dau's damageBonusPerPaidHpPoint payoff. */
  loanDauPaidHpBonus: number
  /** Cuong Y: adds to the cuong kit's missingHpBonusPerMissingPercent (Huyet Cuong efficiency). */
  missingHpBonusBonus: number
  /** Trong The: adds to tran_ap's damage.sourceMaxHpRatio (Max-HP conversion). */
  tranApMaxHpRatioBonus: number
  /** Tran Kinh: +stacks on tran_ap's tran_kinh ailment application
      (statModifier.flat scales x stacks). */
  tranKinhStacksBonus: number
  /** Chan Cot: adds to phan_chan's reflectsDamage.maxHpRatio. */
  reflectMaxHpRatioBonus: number
  /** Tran An: adds to phan_chan's reflectsDamage.markedMaxHpRatio (Chấn Ấn amplification). */
  reflectMarkedRatioBonus: number
}

export type BodyKitModifierChannel = keyof BodyKitModifierValues

const ZERO_MODIFIERS: BodyKitModifierValues = {
  cuongQuyenCoefficientBonus: 0,
  cuongQuyenArmorPierce: 0,
  loanDauPaidHpBonus: 0,
  missingHpBonusBonus: 0,
  tranApMaxHpRatioBonus: 0,
  tranKinhStacksBonus: 0,
  reflectMaxHpRatioBonus: 0,
  reflectMarkedRatioBonus: 0,
}

/**
 * Aggregates `node.effect.bodyKitModifiers` across every node the
 * player owns, each channel scaled linearly by node level (authored
 * value = per-level contribution).
 */
export function collectBodyKitModifiers(
  registry: { getAll(): ProgressionNode[] },
  player: PlayerData,
): BodyKitModifierValues {
  const totals: BodyKitModifierValues = { ...ZERO_MODIFIERS }

  for (const node of registry.getAll()) {
    const level = getNodeLevel(player, node.id)

    // Review fix (LOW-3) — the path-ownership authority applies here
    // too, not just in the generic aggregators: a wrong-path level
    // (corrupt save, future reuse) must not leak into kit channels.
    // M3: the way-membership gate rides the same line.
    if (level <= 0 || !nodePathApplies(player, node) || !nodeWayApplies(player, node)) {
      continue
    }

    for (const [channel, perLevel] of Object.entries(node.effect.bodyKitModifiers ?? {})) {
      const key = channel as BodyKitModifierChannel
      totals[key] += (perLevel ?? 0) * level
    }
  }

  return totals
}
