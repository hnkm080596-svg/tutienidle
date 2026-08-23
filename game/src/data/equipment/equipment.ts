import type { Equipment, EquipmentStatRange } from '@/core/equipment/Equipment'
import type { EquipmentSlot } from '@/core/equipment/EquipmentTypes'

const MAIN_STATS: Record<EquipmentSlot, readonly EquipmentStatRange[]> = {
  weapon: [{ stat: 'attack', min: 12, max: 20 }], helmet: [{ stat: 'maxHp', min: 18, max: 30 }],
  armor: [{ stat: 'defense', min: 12, max: 20 }], boots: [{ stat: 'evasionRate', min: 12, max: 20 }],
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
export const EQUIPMENT_ICON_POOLS: Record<EquipmentSlot, readonly string[]> = {
  weapon: ['/assets/equipment-slots/weapon.png'], helmet: ['/assets/equipment-slots/helmet.png'],
  armor: ['/assets/equipment-slots/armor.png'], boots: ['/assets/equipment-slots/boots.png'],
  ring: ['/assets/equipment-slots/ring.png'], necklace: ['/assets/equipment-slots/necklace.png'],
}

const BASE_COSTS: Pick<Equipment, 'maxEnhanceLevel' | 'enhanceCost' | 'enhanceSpiritStoneCost' | 'upgradeQualityCost' | 'upgradeRealmCost' | 'addAffixCost' | 'upgradeAffixCost' | 'washCost' | 'refineCost'> = {
  maxEnhanceLevel: 10,
  enhanceCost: [{ materialId: 'bui_cot', amount: 3 }], enhanceSpiritStoneCost: 20,
  upgradeQualityCost: [{ materialId: 'yeu_dan_qi_refining', amount: 3 }],
  upgradeRealmCost: [{ materialId: 'yeu_dan_qi_refining', amount: 2 }],
  addAffixCost: [{ materialId: 'affix_rune_stone', amount: 1 }],
  upgradeAffixCost: [{ materialId: 'affix_tier_stone', amount: 1 }],
  washCost: [{ materialId: 'black-iron', amount: 2 }],
  refineCost: [{ materialId: 'black-iron', amount: 2 }],
}

function base(id: string, name: string, slot: EquipmentSlot): Equipment {
  return { id, name, slot, grade: 1, mainStats: MAIN_STATS[slot], iconPool: [...EQUIPMENT_ICON_POOLS[slot]], ...BASE_COSTS }
}

// Chỉ còn từ loại cơ sở; tên đầy đủ, quality/rarity, stat và ảnh sống trên instance.
export const equipment: Equipment[] = [
  base('base_kiem', 'Kiếm', 'weapon'), base('base_chau', 'Châu', 'weapon'), base('base_quyen', 'Quyền', 'weapon'),
  base('base_quan', 'Quán', 'helmet'), base('base_bao', 'Bào', 'armor'), base('base_hai', 'Hài', 'boots'),
  base('base_gioi', 'Giới', 'ring'), base('base_truy', 'Trụy', 'necklace'),
]
