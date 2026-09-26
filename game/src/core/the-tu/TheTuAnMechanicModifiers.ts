import type { PlayerData } from '../player/Player'
import type { ProgressionNode } from '../progression/ProgressionNode'
import { getNodeLevel, nodePathApplies, nodeWayApplies } from '../progression/NodeSystem'

// Ung The beta (design authority docs/design/the-tu-an-ung-the-design.txt)
// - the ONE locked node -> ung_the channel. Nodes declare
// `effect.hiddenBodyMechanicModifiers` (flat, per-level); this collector
// sums them by channel over owned node levels and the participant build
// bakes the totals into participant-local def clones (buildTheTuAnKit).
// Registry/singleton defs are NEVER mutated.
//
// The design forbids tree content that touches chances, main stats, Max
// HP/Def, generic damage/crit, Ung Tre, the debt cap, free reactions, or
// proc-cost fillers (Part XIII sec.87) - the channels below are payload/
// consequence/observation riders only.

export interface HiddenBodyMechanicModifierValues {
  /** Thau The - adds to the ung_the marker's observed-action income. */
  observationGainBonus: number

  /** Phan Kinh - armor-bypass rider on the Phan/Trong Phan Kich payload clones. */
  phanKinhArmorPierce: number

  /** Ho Bich - committed intercept wards the rescued ally for ratio x protector maxHp. */
  interceptWardRatio: number

  /** Trong Phan - post-evasion counter payload swap: flat multiplier bonus on trong_phan_kich. */
  evadeCounterMultiplierBonus: number

  /** Dan The - >0 plants the dan_the one-shot application on the tro_kich clone. */
  danTheBonus: number
}

export type HiddenBodyMechanicModifierChannel = keyof HiddenBodyMechanicModifierValues

const ZERO_MODIFIERS: HiddenBodyMechanicModifierValues = {
  observationGainBonus: 0,
  phanKinhArmorPierce: 0,
  interceptWardRatio: 0,
  evadeCounterMultiplierBonus: 0,
  danTheBonus: 0,
}

/**
 * Aggregates `node.effect.hiddenBodyMechanicModifiers` across every node
 * the player owns, each channel scaled linearly by node level (authored
 * value = per-level contribution). Mirrors collectBodyKitModifiers.
 */
export function collectHiddenBodyMechanicModifiers(
  registry: { getAll(): ProgressionNode[] },
  player: PlayerData,
): HiddenBodyMechanicModifierValues {
  const totals: HiddenBodyMechanicModifierValues = { ...ZERO_MODIFIERS }

  for (const node of registry.getAll()) {
    const level = getNodeLevel(player, node.id)

    // Same ownership gate as collectBodyKitModifiers — nodePathApplies
    // is the single authority; callers must not be trusted to pre-filter.
    // M3: the way-membership gate rides the same line.
    if (level <= 0 || !nodePathApplies(player, node) || !nodeWayApplies(player, node)) {
      continue
    }

    for (const [channel, perLevel] of Object.entries(node.effect.hiddenBodyMechanicModifiers ?? {})) {
      const key = channel as HiddenBodyMechanicModifierChannel
      totals[key] += (perLevel ?? 0) * level
    }
  }

  return totals
}
