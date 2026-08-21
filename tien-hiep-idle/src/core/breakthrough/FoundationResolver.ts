import type { PlayerData } from '../player/Player'
import type { MaterialBag } from '../material/MaterialBag'
import type { PillBag } from '../pill/PillBag'
import type { FoundationType } from './FoundationType'

/**
 * HiddenConditionChecker (mục 17 spec `breakthrough`) — âm thầm xác
 * định Căn Cơ CAO NHẤT mà người chơi hiện đủ điều kiện, KHÔNG BAO GIỜ
 * trả về lý do thất bại (mục 10 — hard rule). Gọi khi bấm nút
 * "TRÚC CƠ" (xem GameManager.startTribulation()).
 *
 * currentRealmCap = RealmData.attributeCap của cảnh giới hiện tại
 * (Luyện Khí = 20) — dùng để kiểm "Stat 20/20" (mục 8): tổng bonus
 * vĩnh viễn của maxHp/defense/maxMp (3 stat gắn với Trúc Cơ Đan/Tôi
 * Thể Đan/Rèn Linh Đan) phải ĐẦY trần, không chỉ đủ điều kiện tối
 * thiểu để uống thêm.
 */
export function resolveFoundation(
  player: PlayerData,
  materialBag: MaterialBag,
  pillBag: PillBag,
  currentRealmCap: number | undefined,
): FoundationType {
  if (isGreatDaoEligible(player, materialBag, pillBag, currentRealmCap)) {
    return 'great_dao'
  }

  if (player.realmLevel >= 12) {
    return 'heaven'
  }

  if (player.realmLevel >= 11) {
    return 'earth'
  }

  return 'human'
}

function isGreatDaoEligible(
  player: PlayerData,
  materialBag: MaterialBag,
  pillBag: PillBag,
  currentRealmCap: number | undefined,
): boolean {
  if (currentRealmCap === undefined) {
    return false
  }

  if (player.realmLevel < 18) {
    return false
  }

  if (!materialBag.has('great_dao_seed', 1)) {
    return false
  }

  if (
    !pillBag.has('foundation_pill', 10) ||
    !pillBag.has('body_refining_pill', 10) ||
    !pillBag.has('spirit_forging_pill', 10)
  ) {
    return false
  }

  const requiredStats: Array<'maxHp' | 'defense' | 'maxMp'> = ['maxHp', 'defense', 'maxMp']

  return requiredStats.every(stat => {
    const modifier = player.modifiers.find(candidate => candidate.id === `pill-permanent:${stat}`)

    return (modifier?.flat ?? 0) >= currentRealmCap
  })
}
