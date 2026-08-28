import { REALMS } from '../../data/realms/realm'

export function getCurrentRealm(realmId: string) {
  const realm = REALMS.find((realm) => realm.id === realmId)

  if (!realm) {
    throw new Error(`Không tìm thấy cảnh giới: ${realmId}`)
  }

  return realm
}

export function getNextRealm(realmId: string) {
  const index = REALMS.findIndex((realm) => realm.id === realmId)

  if (index === -1) {
    return null
  }

  return REALMS[index + 1] ?? null
}

// Rework "100% mỗi tiểu cảnh giới" (2026-08-16) — x, đơn vị thời gian
// GỐC (giây) cho ngân sách tu luyện mỗi đại cảnh giới, xem
// RealmData.realmDurationMultiplier. Hằng số điều chỉnh được theo yêu
// cầu — đổi 1 dòng này để retune toàn bộ tốc độ tu luyện của MỌI cảnh
// giới trừ Phàm Nhân. Tạm thời = 1 ngày.
export const BASE_CULTIVATION_UNIT_SECONDS = 86400

// Tốc độ tu luyện CƠ BẢN dùng để quy đổi ngân sách thời gian ở trên
// thành lượng cultivation cần. Pháp Tu Redesign (magicpath, 2026-08-18)
// — cultivationRate đã bị xoá HOÀN TOÀN khỏi Stats; đây là tốc độ NỀN.
// Từ 2026-08-27, thiên phú character creation có thể nhân tốc độ này
// (xem core/talent/TalentEffects.ts's getCultivationSpeedMultiplier), nhưng
// yêu cầu tu vi mỗi tầng vẫn tính theo tốc độ nền để không phá vỡ pace.
export const BASE_CULTIVATION_PER_SECOND = 10

// Mốc tầng tối thiểu CHUNG cho mọi cổng đột phá đại cảnh giới
// (2026-08-27): mốc 12 = Nhân Đạo baseline. Tu vi luôn chỉ là mốc thấp
// nhất; các gate/cấp đột phá ẩn khác (ví dụ 4 mức Kiến Cơ cho Luyện Khí
// → Trúc Cơ) sẽ được thiết kế sau. Dùng lại 1 hằng số duy nhất cho
// mortal → qi_refining (GameManager.chooseCultivationPath()) VÀ
// qi_refining → foundation_establishment
// (GameManager.canTriggerFoundationBreakthrough()).
export const CORE_REALM_LEVEL = 12

export const EXTENDED_REALM_LEVEL = 18

export function getCultivationDurationSeconds(realmId: string, realmLevel: number): number {
  const realm = getCurrentRealm(realmId)

  if (realm.baseCultivationMinutes === undefined) {
    const required = Math.floor(
      (realm.baseRequiredCultivation ?? 0) *
        Math.pow(realm.cultivationMultiplier ?? 1, realmLevel - 1),
    )

    return required / BASE_CULTIVATION_PER_SECOND
  }

  return (realm.baseCultivationMinutes + Math.max(1, realmLevel) - 1) * 60
}

// Trong 1 đại cảnh giới, tầng cuối tốn thời gian lâu hơn tầng đầu theo
// đường cong mũ này (trọng số tầng T = growthRate^(T-1), tổng ngân
// sách chia theo tỉ lệ trọng số) — hằng số điều chỉnh được.
const INTRA_REALM_DURATION_GROWTH_RATE = 1.15

export function getRequiredCultivation(realmId: string, realmLevel: number): number {
  const realm = getCurrentRealm(realmId)

  if (realm.baseCultivationMinutes !== undefined) {
    return Math.floor(
      getCultivationDurationSeconds(realmId, realmLevel) * BASE_CULTIVATION_PER_SECOND,
    )
  }

  if (realm.realmDurationMultiplier === undefined) {
    // Phàm Nhân (tutorial) — công thức hấp thu cũ, không đổi.
    return Math.floor(
      (realm.baseRequiredCultivation ?? 0) *
        Math.pow(realm.cultivationMultiplier ?? 1, realmLevel - 1),
    )
  }

  const totalSeconds = realm.realmDurationMultiplier * BASE_CULTIVATION_UNIT_SECONDS

  let weightSum = 0

  for (let tang = 1; tang <= realm.maxLevel; tang++) {
    weightSum += Math.pow(INTRA_REALM_DURATION_GROWTH_RATE, tang - 1)
  }

  const tangWeight = Math.pow(INTRA_REALM_DURATION_GROWTH_RATE, realmLevel - 1)
  const tangSeconds = (totalSeconds * tangWeight) / weightSum

  return Math.floor(tangSeconds * BASE_CULTIVATION_PER_SECOND)
}

export function canBreakthrough(realmId: string, realmLevel: number): boolean {
  const realm = getCurrentRealm(realmId)

  return realmLevel < realm.maxLevel
}

/**
 * Vị trí (0-based) của 1 đại cảnh giới trong REALMS — dùng để so
 * sánh "cảnh giới nào cao hơn" mà không cần biết realmLevel (vd
 * tính Realm Pressure trong combat).
 */
export function getRealmIndex(realmId: string): number {
  return REALMS.findIndex((realm) => realm.id === realmId)
}

/**
 * Quy đổi (realmId, realmLevel) thành 1 số tăng dần xuyên suốt 9
 * đại cảnh giới — dùng để scale chỉ số chính trang bị theo cảnh
 * giới người chơi lúc rớt đồ (xem EquipmentSystem.createInstance()).
 */
export function getGlobalCultivationLevel(realmId: string, realmLevel: number): number {
  const index = REALMS.findIndex((realm) => realm.id === realmId)

  if (index === -1) {
    return realmLevel
  }

  let total = realmLevel

  for (let i = 0; i < index; i++) {
    total += REALMS[i]!.maxLevel
  }

  return total
}
