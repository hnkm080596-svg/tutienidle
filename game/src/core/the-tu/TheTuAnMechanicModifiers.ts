import type { PlayerData } from '../player/Player'
import type { ProgressionNode } from '../progression/ProgressionNode'
import { getNodeLevel } from '../progression/NodeSystem'

// The Tu Reimagined (plan Task 20, review P1.7) — the ONE locked node ->
// the_tu_an channel. Nodes declare `effect.theTuAnMechanicModifiers`
// (flat, per-level); this collector sums them by channel over owned node
// levels and the participant build bakes the totals into participant-
// local def clones (buildTheTuAnKit) and the entity's maxThe cap.
// Registry/singleton defs are NEVER mutated. Economy channels live on
// the shared trunk (spec 8.2) — they feed all three mechanic branches
// and stay node-shaped "what happens after", never probability.

export interface TheTuAnMechanicModifierValues {
  /** Flat addition to the participant's The cap (MAX_THE + bonus). */
  maxTheBonus: number
  /** Flat shift on EVERY reactiveProc attempt's base cost (negative = cheaper). */
  procCostDelta: number
  /** Flat addition to EVERY reactiveProc's success credit. */
  procGainBonus: number
  /** Adds to the ung_the marker's dodge-outcome income. */
  evadeGainBonus: number
  /** Adds to the ung_the marker's taken-hit income. */
  takenGainBonus: number
  /** Adds to the ung_the marker's own-basic-lands income. */
  basicGainBonus: number
  /** Adds to the ung_the marker's round-boundary income. */
  roundGainBonus: number

  /** Extra The credited on a successful intercept (ho_mon marker theGainOnSuccess). */
  interceptTheGainBonus: number
  /** Successful intercept grants the rescued ally an externalWard of ratio x protector maxHp. */
  interceptWardRatio: number

  /** Post-evasion counter payload swap: flat multiplier bonus on trong_phan_kich. */
  evadeCounterMultiplierBonus: number
  /** Counter payload break rider: choang application chance on phan_kich clones. */
  counterChoangChance: number

  /** Successful Tro proc heals the triggering ally by ratio x its maxHp. */
  troHealTriggeringAllyRatio: number
  /** Additional cost shift on the tro_mon marker only (negative = cheaper Tro). */
  troCostDelta: number
  /** >0 = the Tro window also opens on non-damaging ally actions. */
  troAnyAction: number
}

export type TheTuAnMechanicModifierChannel = keyof TheTuAnMechanicModifierValues

const ZERO_MODIFIERS: TheTuAnMechanicModifierValues = {
  maxTheBonus: 0,
  procCostDelta: 0,
  procGainBonus: 0,
  evadeGainBonus: 0,
  takenGainBonus: 0,
  basicGainBonus: 0,
  roundGainBonus: 0,
  interceptTheGainBonus: 0,
  interceptWardRatio: 0,
  evadeCounterMultiplierBonus: 0,
  counterChoangChance: 0,
  troHealTriggeringAllyRatio: 0,
  troCostDelta: 0,
  troAnyAction: 0,
}

/**
 * Aggregates `node.effect.theTuAnMechanicModifiers` across every node
 * the player owns, each channel scaled linearly by node level (authored
 * value = per-level contribution). Mirrors collectTheTuKitModifiers.
 */
export function collectTheTuAnMechanicModifiers(
  registry: { getAll(): ProgressionNode[] },
  player: PlayerData,
): TheTuAnMechanicModifierValues {
  const totals: TheTuAnMechanicModifierValues = { ...ZERO_MODIFIERS }

  for (const node of registry.getAll()) {
    const level = getNodeLevel(player, node.id)

    if (level <= 0) {
      continue
    }

    for (const [channel, perLevel] of Object.entries(node.effect.theTuAnMechanicModifiers ?? {})) {
      const key = channel as TheTuAnMechanicModifierChannel
      totals[key] += (perLevel ?? 0) * level
    }
  }

  return totals
}
