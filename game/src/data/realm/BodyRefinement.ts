import type { StatType } from '../../core/stats/StatTypes'

// Currency Luyện Thể — xem data/materials/materials.ts (định nghĩa
// Material) và data/enemy/Enemies.ts (nguồn rơi, 20 quái Phàm Nhân).
export const TINH_HOA_PHAM_THE_MATERIAL_ID = 'tinh_hoa_pham_the'

// Luyện Thể (Realm Passive & Pressure System, 2026-08-20) — 6 tầng rèn
// thể TUẦN TỰ, độc quyền Phàm Nhân (xem core/realm/BodyRefinementSystem.ts).
// Mỗi tầng ứng với ĐÚNG 1 (hoặc 2, tầng cuối) StatType theo tài liệu
// Plan gốc — số liệu (cap/percent) là first pass, cần tinh chỉnh qua
// playtest giống mọi hằng số cân bằng khác trong codebase.
export interface BodyRefinementTierDefinition {
  id: string

  name: string

  description: string

  // Tinh Hoa Phàm Thể cần để làm ĐẦY tầng này (tuần tự — phải làm đầy
  // tầng trước mới được đầu tư vào tầng sau, xem BodyRefinementSystem.ts).
  cap: number

  // Stat được cộng percent khi tầng này đầy (scale tuyến tính theo
  // progress/cap lúc CHƯA đầy — xem BodyRefinementSystem.buildTierModifiers()).
  stats: StatType[]

  // % cộng vào MỖI stat trong `stats` lúc tầng đầy 100%.
  percentAtFullTier: number

  // Phàm Nhân tầng tối thiểu để BẮT ĐẦU đầu tư tầng này (2026-08-20,
  // yêu cầu cụ thể: Bì/Nhục/Cốt/Huyết/Tạng/Mạch mở lần lượt ở tầng
  // 2/4/6/8/10/12) — ĐỘC LẬP với thứ tự tuần tự (phải làm đầy tầng
  // trước MỚI tới lượt tầng này, xem BodyRefinementSystem.investTinhHoa());
  // cả 2 điều kiện đều phải thoả. Tầng cuối (Luyện Mạch) mở cùng lúc
  // Quán Khí (tầng 12, xem CharacterPanel.vue's QUAN_KHI_UNLOCK_LEVEL)
  // — cố ý, chừa tầng 12-18 làm cửa sổ hoàn thiện trước khi Quán Khí.
  requiredRealmLevel: number
}

export const BODY_REFINEMENT_TIERS: BodyRefinementTierDefinition[] = [
  {
    id: 'luyen_bi',
    name: 'Luyện Bì',
    description: 'Rèn luyện lớp da và khả năng chịu đựng bên ngoài.',
    cap: 50,
    stats: ['defense'],
    percentAtFullTier: 0.08,
    requiredRealmLevel: 2,
  },
  {
    id: 'luyen_nhuc',
    name: 'Luyện Nhục',
    description: 'Rèn cơ nhục.',
    cap: 90,
    stats: ['attack'],
    percentAtFullTier: 0.08,
    requiredRealmLevel: 4,
  },
  {
    id: 'luyen_cot',
    name: 'Luyện Cốt',
    description: 'Rèn xương và nền tảng thân thể.',
    cap: 160,
    stats: ['maxHp'],
    percentAtFullTier: 0.08,
    requiredRealmLevel: 6,
  },
  {
    id: 'luyen_huyet',
    name: 'Luyện Huyết',
    description: 'Rèn khí huyết.',
    cap: 290,
    stats: ['hpRegenPerSecond'],
    percentAtFullTier: 0.08,
    requiredRealmLevel: 8,
  },
  {
    id: 'luyen_tang',
    name: 'Luyện Tạng',
    description: 'Rèn lục phủ ngũ tạng.',
    cap: 520,
    // "Damage Reduction / Vitality" (tài liệu mục III.5) — dùng
    // vitality (Thể Chất, tầng Attribute gốc) thay vì 1 stat mitigation
    // trực tiếp: đi qua đúng pipeline deriveAttributeModifiers() sẵn có
    // (StatCalculator.ts), tự dẫn ra maxHp/hpRegen/enduranceThreshold.
    stats: ['vitality'],
    percentAtFullTier: 0.08,
    requiredRealmLevel: 10,
  },
  {
    id: 'luyen_mach',
    name: 'Luyện Mạch',
    description: 'Khai thông kinh mạch — chuẩn bị Nhập Đạo.',
    cap: 940,
    stats: ['maxHp', 'hpRegenPerSecond'],
    percentAtFullTier: 0.08,
    requiredRealmLevel: 12,
  },
]
