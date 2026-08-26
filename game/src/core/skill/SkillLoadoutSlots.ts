import { getRealmIndex } from '../realm/realmSystem'

// PLAN HOÀN CHỈNH mục 8 — số ô Skill Loadout khả dụng theo cảnh giới.
// Doc CHỈ chốt cứng đúng 1 mốc ("Luyện Khí chỉ mở 2/5 ô, các ô còn lại
// khoá dần theo progression") — công thức bên dưới MIRROR NGUYÊN VẸN
// core/element/ElementSlot.ts's getElementSlotCount() (base 2 tại
// Luyện Khí, +1 mỗi 2 đại cảnh giới, trần 5) vì đó là đúng precedent
// "N/5 ô mở dần theo cảnh giới" DUY NHẤT đã có sẵn trong codebase —
// tái dùng thay vì bịa 1 đường cong khác không có cơ sở.
const BASE_SKILL_LOADOUT_SLOTS = 2

const SKILL_LOADOUT_SLOT_REALM_GROUP_SIZE = 2

export const MAX_SKILL_LOADOUT_SLOTS = 5

export function getSkillLoadoutSlotCount(realmId: string): number {
  const ordinal = getRealmIndex(realmId)

  // Phàm Nhân (ordinal 0) hoặc realmId không hợp lệ (ordinal -1) —
  // execution policy rework (combat-gate-teleport-autocast plan §8.6):
  // scheduler CHỈ đọc loadout nên Trảm được gán vào ĐÚNG slot mặc định
  // (slot 0) thay vì "equipped không slot" như trước.
  if (ordinal < 1) {
    return 1
  }

  const realmsPastFirst = ordinal - 1

  return Math.min(
    MAX_SKILL_LOADOUT_SLOTS,
    BASE_SKILL_LOADOUT_SLOTS + Math.floor(realmsPastFirst / SKILL_LOADOUT_SLOT_REALM_GROUP_SIZE),
  )
}
