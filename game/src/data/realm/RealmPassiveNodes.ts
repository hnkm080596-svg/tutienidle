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

// FE-12 - nodes are labeled by the DESTINATION realm of the breakthrough:
// the "Truc Co" node lights up when the player STEPS INTO Truc Co, so it
// no longer shows "coming soon" for the realm the player stands in.
// comingSoon is pinned to ReleasePolicy (destination realm above the
// release ceiling) instead of a hardcoded index - the "Kim Dan" node
// still reports coming-soon because TC -> KD is closed.
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
