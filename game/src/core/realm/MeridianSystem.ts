import type { PlayerData } from '../player/Player'
import type { StatModifier } from '../stats/StatCalculator'
import { MERIDIANS } from '../../data/realm/Meridians'

// Bát Mạch (spec dot-pha-loi-kiep §4.1a) — khác Luyện Thể: mỗi đường chỉ
// CHƯA MỞ / ĐÃ MỞ (đủ nguyên liệu là thông hoàn toàn, không có progress
// từng phần). Tuần tự bắt buộc: đường N cần đủ N-1 trong openedMeridianIds.
function nextMeridian(player: PlayerData) {
  return MERIDIANS[player.openedMeridianIds.length]
}

export function getOpenedMeridianCount(player: PlayerData): number {
  return player.openedMeridianIds.length
}

function modifierId(meridianId: string, stat: string): string {
  return `bat-mach:${meridianId}:${stat}`
}

export function applyMeridianModifiers(player: PlayerData): void {
  const opened = new Set(player.openedMeridianIds)
  const rebuilt: StatModifier[] = []

  for (const meridian of MERIDIANS) {
    if (!opened.has(meridian.id)) continue
    for (const stat of meridian.stats) {
      rebuilt.push({
        id: modifierId(meridian.id, stat),
        sourceId: meridian.id,
        sourceType: 'realm',
        stat,
        percent: meridian.percentAtFullTier,
      })
    }
  }

  player.modifiers = player.modifiers.filter((m) => !m.id.startsWith('bat-mach:'))
  player.modifiers.push(...rebuilt)
}

/**
 * Đầu tư Thông Mạch Đan vào đường kế tiếp. Trả về số đan THẬT SỰ đã
 * tiêu (0 nếu không đủ điều kiện/không còn đường). thienDiaChiKieuOwned
 * chỉ có ý nghĩa với đường cuối (Kỳ Kinh) — các đường khác bỏ qua.
 */
export function investThongMachDan(
  player: PlayerData,
  availableDan: number,
  thienDiaChiKieuOwned = 0,
): number {
  const next = nextMeridian(player)

  if (!next || availableDan < next.thongMachDanCost) {
    return 0
  }

  // Gate tầng chỉ pace tiến độ TRONG Luyện Khí (pattern
  // BodyRefinementSystem.isTierRequiredRealmLevelMet) — rời Luyện Khí
  // rồi thì mở thẳng, chỉ còn ràng buộc tuần tự.
  if (player.realmId === 'qi_refining' && player.realmLevel < next.requiredRealmLevel) {
    return 0
  }

  if (next.requiresThienDiaChiKieu && thienDiaChiKieuOwned < 1) {
    return 0
  }

  player.openedMeridianIds.push(next.id)
  applyMeridianModifiers(player)

  return next.thongMachDanCost
}
