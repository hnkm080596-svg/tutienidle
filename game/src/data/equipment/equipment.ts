import type { Equipment, EquipmentStatRange } from '@/core/equipment/Equipment'
import type { EquipmentSlot } from '@/core/equipment/EquipmentTypes'

const MAIN_STATS: Record<EquipmentSlot, readonly EquipmentStatRange[]> = {
  weapon: [{ stat: 'attack', min: 12, max: 20 }],
  helmet: [{ stat: 'maxHp', min: 18, max: 30 }],
  armor: [{ stat: 'defense', min: 12, max: 20 }],
  boots: [{ stat: 'evasionRate', min: 12, max: 20 }],
  ring: [
    { stat: 'criticalRate', min: 0.02, max: 0.05 },
    { stat: 'criticalDamage', min: 0.1, max: 0.2 },
  ],
  necklace: [
    { stat: 'attackSpeed', min: 0.03, max: 0.08 },
    { stat: 'castSpeedPercent', min: 0.03, max: 0.08 },
  ],
}

// Thêm art mới vào đúng slot; mỗi instance tự chọn một ảnh trong pool.
export const EQUIPMENT_ICON_POOLS = {
  base_kiem: Array.from(
    { length: 5 },
    (_, index) =>
      `/assets/equipment/items/base-kiem/kiem-${String(index + 1).padStart(2, '0')}.png`,
  ),
  base_chau: Array.from(
    { length: 5 },
    (_, index) =>
      `/assets/equipment/items/base-chau/chau-${String(index + 1).padStart(2, '0')}.png`,
  ),
  base_quyen: Array.from(
    { length: 5 },
    (_, index) =>
      `/assets/equipment/items/base-quyen/quyen-${String(index + 1).padStart(2, '0')}.png`,
  ),
  base_quan: Array.from(
    { length: 5 },
    (_, index) =>
      `/assets/equipment/items/base-quan/quan-${String(index + 1).padStart(2, '0')}.png`,
  ),
  base_bao: Array.from(
    { length: 5 },
    (_, index) => `/assets/equipment/items/base-bao/bao-${String(index + 1).padStart(2, '0')}.png`,
  ),
  base_hai: Array.from(
    { length: 5 },
    (_, index) => `/assets/equipment/items/base-hai/hai-${String(index + 1).padStart(2, '0')}.png`,
  ),
  base_gioi: Array.from(
    { length: 5 },
    (_, index) =>
      `/assets/equipment/items/base-gioi/gioi-${String(index + 1).padStart(2, '0')}.png`,
  ),
  base_truy: Array.from(
    { length: 5 },
    (_, index) =>
      `/assets/equipment/items/base-truy/truy-${String(index + 1).padStart(2, '0')}.png`,
  ),
} as const

type EquipmentTemplateId = keyof typeof EQUIPMENT_ICON_POOLS

const BASE_COSTS: Pick<Equipment, 'maxEnhanceLevel' | 'enhanceSpiritStoneCost'> = {
  maxEnhanceLevel: 10,

  // Fallback khi catalog nghề không có band cho realm hiện hành (xem
  // EquipmentSystem.resolveEnhanceCost(): catalog → template → Linh
  // Thạch thuần). Catalog hiện phủ đủ 3 realm có content nên nhánh
  // này chỉ là lưới an toàn.
  enhanceSpiritStoneCost: 20,
}

function base(id: EquipmentTemplateId, name: string, slot: EquipmentSlot): Equipment {
  const iconPool = [...EQUIPMENT_ICON_POOLS[id]]

  return {
    id,
    name,
    slot,
    grade: 1,
    mainStats: MAIN_STATS[slot],
    icon: iconPool[0],
    iconPool,
    ...BASE_COSTS,
  }
}

// Chỉ còn từ loại cơ sở; tên đầy đủ, quality/rarity, stat và ảnh sống trên instance.
export const equipment: Equipment[] = [
  base('base_kiem', 'Kiếm', 'weapon'),
  base('base_chau', 'Châu', 'weapon'),
  base('base_quyen', 'Quyền', 'weapon'),
  base('base_quan', 'Quán', 'helmet'),
  base('base_bao', 'Bào', 'armor'),
  base('base_hai', 'Hài', 'boots'),
  base('base_gioi', 'Giới', 'ring'),
  base('base_truy', 'Trụy', 'necklace'),
]
