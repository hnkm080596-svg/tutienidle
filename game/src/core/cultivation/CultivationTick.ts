// P6-M1 - framework-neutral production cultivation tick, extracted from
// stores/player.ts::cultivate() so the early-game simulation session and
// the Pinia action share ONE progression path. `addCultivation` stays the
// low-level clamped writer; this op owns speed composition, the
// cultivationPerSecond snapshot (offline-progress authority), lifetime
// accrual, and insight conversion. `nowMs` is injected so deterministic
// sessions run on a fixed clock instead of Date.now.
import type { PlayerData } from '../player/Player'
import { BASE_CULTIVATION_PER_SECOND } from '../realm/realmSystem'
import { getCultivationRampMultiplier, getCultivationSpeedMultiplier } from '../talent/TalentEffects'
import { getActiveCultivationSpeedPercent } from '../economy/TuLinhTranBalance'
import { accrueCultivationInsight } from './CultivationInsight'
import { addCultivation } from './CultivationSystem'

/**
 * Advance cultivation by `deltaSeconds` of real-time progress. Returns
 * the ACTUAL tu vi granted (addCultivation clamps at the current level's
 * required). Writes `player.cultivationPerSecond` - the snapshot saved
 * into the save and used for offline progress - so callers must not
 * cache it across talent/effect changes.
 */
export function cultivateTick(
  player: PlayerData,
  deltaSeconds: number,
  nowMs: number,
): number {
  // Guard 0.01 (plan sec.6) - negative percent is legal (Pham Cot -75%
  // -> 0.25x) but never reaches 0/negative.
  player.cultivationPerSecond =
    BASE_CULTIVATION_PER_SECOND *
    Math.max(0.01, getCultivationSpeedMultiplier(player.selectedTalentIds)) *
    // M2 - Hau Tich Bat Phat: per-realm-level ramp (neutral 1 when
    // absent). Multiplied into the saved rate so the offline grant
    // (cultivationPerSecond * elapsed) inherits the same curve.
    getCultivationRampMultiplier(player.selectedTalentIds, player.realmLevel)

  // Tu Linh Tran (economy-fixes-sinks-plan sec.3.2 B1, 2026-08-29) -
  // sums % from active tu_linh_tran effects. Read through the domain
  // getter (Mission G Task 39) - group-filtered + deadline-checked.
  const tuLinhPercent = getActiveCultivationSpeedPercent(
    player.persistentTimedEffects,
    nowMs,
  )

  if (tuLinhPercent > 0) {
    player.cultivationPerSecond *= 1 + tuLinhPercent
  }

  const before = player.cultivation

  addCultivation(player, player.cultivationPerSecond * deltaSeconds)

  const gained = player.cultivation - before

  // Lifetime cultivation tally (not consumed by breakthroughs) - feeds
  // technique tier.
  player.totalCultivationGained += gained

  // Ngo Dao talent (talent-direction-choice-plan sec.6) - converts
  // ONLINE tu vi into skill Cam Ngo at thresholds; an under-threshold
  // remainder rolls into the next accrual. Thresholds/counters are
  // owned by CultivationInsight.accrueCultivationInsight - shared
  // for online + offline (task 34, cleanup mission).
  accrueCultivationInsight(player, gained)

  // Techniques have their own experience track (2026-08-20) - the same
  // "gained" feeds Kiem Y above, see core/technique/TechniqueTier.ts's
  // getTechniqueTier().
  return gained
}
