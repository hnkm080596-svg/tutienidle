import { REALM_TIERS, type RealmTierId } from '@/core/realm/RealmTierMap'

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

export const REALM_PASSIVE_NODES: readonly RealmPassiveNode[] = REALM_TIERS.map((realmId, index) => ({
  realmId,
  label: LABELS[realmId],
  // Node đầu là phần thưởng Phàm → Luyện Khí; node hai là Luyện Khí → Trúc Cơ.
  unlockTier: index + 2,
  comingSoon: index >= 2,
}))
