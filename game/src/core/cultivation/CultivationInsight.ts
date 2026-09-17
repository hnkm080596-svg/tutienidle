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
  const threshold = getInsightPerCultivation(player.selectedTalentIds)

  if (threshold === undefined || threshold <= 0 || gained <= 0) {
    return
  }

  player.cultivationInsightAccumulator += gained

  while (player.cultivationInsightAccumulator >= threshold) {
    player.cultivationInsightAccumulator -= threshold
    player.skillInsight += 1
    player.totalSkillInsightGained += 1
  }
}
