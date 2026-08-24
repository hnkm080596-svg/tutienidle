import { getRealmIndex } from '../realm/realmSystem'

// Pháp Tu Redesign (magicpath, mục 5/20) — Element Slot quyết định
// BAO NHIÊU Element được mang vào combat cùng lúc, tách biệt HOÀN
// TOÀN khỏi Cảm ngộ Kỹ năng (PlayerData.skillInsight) — 2 hệ thống
// không được trộn lẫn theo đúng yêu cầu spec.
const BASE_ELEMENT_SLOTS = 2

const ELEMENT_SLOT_REALM_GROUP_SIZE = 2

export const MAX_ELEMENT_SLOTS = 5

/**
 * Luyện Khí (đại cảnh giới THẬT đầu tiên, index 1 trong REALMS — Phàm
 * Nhân index 0 là tutorial, không tính) = 2 slot. Mỗi 2 đại cảnh giới
 * kế tiếp +1 slot, trần 5. THUẦN index-driven (giống getRealmIndex()/
 * getGlobalCultivationLevel() đã có) — không hard-code tên cảnh giới,
 * tự đúng nếu REALMS thay đổi cấu trúc sau này, đúng yêu cầu spec mục
 * 5: "Nếu hệ thống cảnh giới thực tế có grouping khác, giữ nguyên quy
 * tắc... không hard-code tên cảnh giới vào hệ thống."
 */
export function getElementSlotCount(realmId: string): number {
  const ordinal = getRealmIndex(realmId)

  // Phàm Nhân (ordinal 0) hoặc realmId không hợp lệ (ordinal -1) —
  // chưa có Element Slot nào, path còn chưa chọn.
  if (ordinal < 1) {
    return 0
  }

  const realmsPastFirst = ordinal - 1

  return Math.min(
    MAX_ELEMENT_SLOTS,
    BASE_ELEMENT_SLOTS + Math.floor(realmsPastFirst / ELEMENT_SLOT_REALM_GROUP_SIZE),
  )
}
