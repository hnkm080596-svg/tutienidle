import type { PlayerData } from '../../core/player/Player'
import type { FoundationType } from '../../core/breakthrough/FoundationType'
import { MERIDIANS } from '../realm/Meridians'
import { MAIN_STAT_KEYS } from '../../core/stats/StatTypes'
import { getMainStatCap } from '../../core/stats/StatCap'
import { BODY_REFINEMENT_TIERS } from '../realm/BodyRefinement'

// 4 bậc Kiến Cơ (spec dot-pha-loi-kiep §4.2) — điều kiện ẨN, KHÔNG
// hiển thị trước; công bố SAU khi đạt. great_dao chỉ người chơi hội tụ
// đủ mọi điều kiện (kể cả thiên phú Phàm Cốt) mới được xét — UI gate
// công khai chỉ bậc 'human' (tầng 12 + Linh Thạch).
export type KienCoGrade = FoundationType

// Số đường tối thiểu từng bậc — Thiên cần 6/8 (KHÔNG gồm Kỳ Kinh, spec
// ghi chú điều kiện), Đại Đạo cần 9/9.
const HEAVEN_MERIDIAN_COUNT = 6
const GREAT_DAO_MERIDIAN_COUNT = MERIDIANS.length // 9

const EARTH_BODY_TIERS = 3
const HEAVEN_BODY_TIERS = BODY_REFINEMENT_TIERS.length // 6

function hasEveryMainStatAtCap(player: PlayerData): boolean {
  const cap = getMainStatCap(player.realmId)

  return MAIN_STAT_KEYS.every((stat) => player.baseStats[stat] >= cap)
}

/**
 * Xét bậc Kiến Cơ lúc bấm đột phá (spec §2.1 — chỉ từ đầu tư TRƯỚC
 * kiếp, trận kiếp không cộng/trừ bậc). `hasTrucCoDan` = Trúc Cơ Đan
 * có trong túi đồ lúc bấm (bậc Địa trở lên cần, KHÔNG tiêu — vật chứng).
 * Điều kiện lũy tiến: bậc cao chỉ xét khi đủ bậc thấp.
 */
export function resolveKienCoGrade(player: PlayerData, hasTrucCoDan: boolean): KienCoGrade {
  // Vĩnh viễn: thua kiếp Đại Đạo → cap Thiên (spec §4.3)
  const greatDaoBlocked = player.greatDaoOpportunityLost

  const earthReady = hasTrucCoDan && player.bodyRefinementCompletedTiers >= EARTH_BODY_TIERS
  const heavenReady =
    earthReady &&
    player.bodyRefinementCompletedTiers >= HEAVEN_BODY_TIERS &&
    player.openedMeridianIds.length >= HEAVEN_MERIDIAN_COUNT

  if (!greatDaoBlocked && heavenReady && player.openedMeridianIds.length >= GREAT_DAO_MERIDIAN_COUNT) {
    const hasPhamCot = player.selectedTalentIds.includes('pham_cot')

    if (
      hasPhamCot &&
      player.mortalPerfectionAchieved &&
      player.realmId === 'qi_refining' &&
      player.realmLevel >= MERIDIANS[MERIDIANS.length - 1]!.requiredRealmLevel &&
      hasEveryMainStatAtCap(player)
    ) {
      return 'great_dao'
    }
  }

  if (heavenReady) {
    return 'heaven'
  }

  if (earthReady) {
    return 'earth'
  }

  return 'human'
}
