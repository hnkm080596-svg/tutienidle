import type { PlayerData } from '../player/Player'
import { getInsightPerCultivation } from '../talent/TalentEffects'

// Single owner of the insight_per_cultivation threshold accumulator
// (Mission G Task 34): online cultivate() and offline restoreFromSave()
// must settle the SAME way - no second copy of the loop.
//
// Guard `> 0` (audit fix 2026-08-31): a cultivationPerInsight: 0 data
// edit once made `accumulator -= 0` loop forever and froze the 100ms
// tick. Non-positive thresholds are meaningless - skip the whole branch.
export function accrueCultivationInsight(player: PlayerData, gained: number): void {
  const threshold = getInsightPerCultivation(player.selectedTalentIds, player.talentLevels)

  if (threshold === undefined || threshold <= 0 || gained <= 0) {
    return
  }

  player.cultivationInsightAccumulator += gained

  if (!Number.isFinite(player.cultivationInsightAccumulator)) {
    // Mechanism-level guard: a non-finite feed must not mint a
    // NaN/Infinity insight counter - the accrual just doesn't happen.
    return
  }

  // O(1) drain (r22-AUT nit): the loop body is uniform - subtracting
  // threshold and bumping the same two counters per step - so one
  // floor-division mints the identical result in bounded work even
  // when `gained` lands far past the threshold.
  const steps = Math.floor(player.cultivationInsightAccumulator / threshold)
  if (steps > 0) {
    player.cultivationInsightAccumulator -= steps * threshold
    player.skillInsight += steps
    player.totalSkillInsightGained += steps
  }
}
