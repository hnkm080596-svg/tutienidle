import type { PlayerData } from '../player/Player'
import type { ProgressionNode } from '../progression/ProgressionNode'
import { getNodeLevel, nodePathApplies, nodeWayApplies } from '../progression/NodeSystem'

// The Tu Reimagined (plan Task 6, review P0.2) — the ONLY node -> kit
// channel for the_tu. Nodes declare `effect.theTuKitModifiers` (flat,
// per-level); this collector sums them by channel over owned node levels
// and the participant build bakes the totals into participant-local def
// clones (kit skills + the phan_chinh buff def). Registry/singleton defs
// are NEVER mutated — a shared-def mutation would leak node state across
// participants, battles, and tests.

export interface TheTuKitModifierValues {
  /** Adds to cuong_quyen/loan_dau damage.missingHpBonusPerMissingPercent. */
  missingHpBonusBonus: number
  /** Adds to the phan_chinh reflectsDamage.maxHpRatio. */
  reflectMaxHpRatioBonus: number
  /** Adds to the phan_chinh reflectsDamage.takenRatio. */
  reflectTakenRatioBonus: number
  /** Adds to son_nhac's externalWardGrant.sourceMaxHpRatio. */
  sonNhacWardRatioBonus: number
  /** Adds holder/enemy turns via durationOverride on the khiem_khich application. */
  tauntTurnsBonus: number
  /** Adds holder-turns via durationOverride on the bat_tu_ba_the application. */
  batTuDurationBonus: number
}

export type TheTuKitModifierChannel = keyof TheTuKitModifierValues

const ZERO_MODIFIERS: TheTuKitModifierValues = {
  missingHpBonusBonus: 0,
  reflectMaxHpRatioBonus: 0,
  reflectTakenRatioBonus: 0,
  sonNhacWardRatioBonus: 0,
  tauntTurnsBonus: 0,
  batTuDurationBonus: 0,
}

/**
 * Aggregates `node.effect.theTuKitModifiers` across every node the
 * player owns, each channel scaled linearly by node level (authored
 * value = per-level contribution).
 */
export function collectTheTuKitModifiers(
  registry: { getAll(): ProgressionNode[] },
  player: PlayerData,
): TheTuKitModifierValues {
  const totals: TheTuKitModifierValues = { ...ZERO_MODIFIERS }

  for (const node of registry.getAll()) {
    const level = getNodeLevel(player, node.id)

    // Review fix (LOW-3) — the path-ownership authority applies here
    // too, not just in the generic aggregators: a wrong-path level
    // (corrupt save, future reuse) must not leak into kit channels.
    // M3: the way-membership gate rides the same line.
    if (level <= 0 || !nodePathApplies(player, node) || !nodeWayApplies(player, node)) {
      continue
    }

    for (const [channel, perLevel] of Object.entries(node.effect.theTuKitModifiers ?? {})) {
      const key = channel as TheTuKitModifierChannel
      totals[key] += (perLevel ?? 0) * level
    }
  }

  return totals
}
