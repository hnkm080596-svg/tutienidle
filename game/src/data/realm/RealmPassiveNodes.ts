import { REALM_TIERS, type RealmTierId } from '@/core/realm/RealmTierMap'
import { isBeyondReleaseCeiling } from '@/core/realm/ReleasePolicy'

const LABELS: Record<RealmTierId, string> = {
  mortal: 'Nhập Đạo',
  qi_refining: 'Kiến Cơ',
  foundation_establishment: 'Trúc Cơ',
  golden_core: 'Kim Đan',
  nascent_soul: 'Nguyên Anh',
  soul_transformation: 'Hóa Thần',
  void_refinement: 'Luyện Hư',
  mahayana: 'Đại Thừa',
  tribulation: 'Độ Kiếp',
}

export interface RealmPassiveNode {
  realmId: RealmTierId
  label: string
  /** Tier đã bước vào sau khi thắng lôi kiếp để thắp sáng node. */
  unlockTier: number
  comingSoon: boolean
}

// FE-12 — node được label theo cảnh giới ĐÍCH của lần đột phá: node
// "Trúc Cơ" sáng khi người chơi BƯỚC VÀO Trúc Cơ, không còn hiện
// "Sắp ra mắt" cho chính cảnh giới đang đứng. comingSoon ghim theo
// ReleasePolicy (realm đích nằm trên trần release) thay vì index cứng —
// "Kim Đan" node vẫn báo sắp ra mắt vì TC → KD đóng.
export const REALM_PASSIVE_NODES: readonly RealmPassiveNode[] = REALM_TIERS.slice(0, -1).map(
  (_, index) => {
    const targetId = REALM_TIERS[index + 1]!
    return {
      realmId: targetId,
      label: LABELS[targetId],
      // Node đầu là phần thưởng Phàm → Luyện Khí; node hai là Luyện Khí → Trúc Cơ.
      unlockTier: index + 2,
      comingSoon: isBeyondReleaseCeiling(targetId),
    }
  },
)
