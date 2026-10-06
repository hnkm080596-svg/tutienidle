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
    // NaN/Infinity insight counter - the accrual doesn't happen and
    // the poisoned accumulator resets to a writable value instead of
    // bricking every later save-write (r23-AUT nit - bounded deny).
    player.cultivationInsightAccumulator = 0
    return
  }

  // O(1) drain (r22-AUT nit): the loop body is uniform - subtracting
  // threshold and bumping the same two counters per step - so one
  // floor-division yields the same result in bounded work even when
  // `gained` lands far past the threshold. r23-COR-1: at acc magnitudes
  // where steps*threshold leaves the exact-integer domain (~4.6e18+)
  // the product rounding can leave a small negative remainder - clamp
  // at 0 so the field always re-validates. Every reachable feed stays
  // inside the domain where the jump is bit-identical to the loop.
  const steps = Math.floor(player.cultivationInsightAccumulator / threshold)
  if (steps > 0) {
    player.cultivationInsightAccumulator = Math.max(
      0,
      player.cultivationInsightAccumulator - steps * threshold,
    )
    player.skillInsight += steps
    player.totalSkillInsightGained += steps
  }
}
