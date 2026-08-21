import type { EquipmentSet } from '@/core/equipment/EquipmentSet'

// Cơ chế Set (2026-08-15) — 1 Set/Pháp Tu (Ngũ Hành + Kiếm Tu), tên vị
// thần trong thần thoại Trung Hoa (Ngũ Phương Thần cai quản Mộc/Hỏa/
// Thổ/Kim/Thủy — Kiếm Tu dùng "Thái Hư" theo chỉ định riêng). Cả 6 Set
// giờ có đủ 6 vật phẩm thật (data/equipment/equipment.ts's
// generatedSetEquipment) VÀ bonus 2/4/6 món thật — bonus mỗi Set chọn
// theo ĐÚNG stat identity đã có sẵn ở Pill hệ nguyên tố tương ứng
// (data/pill/pills.ts's fire_might/wood_drain/water_control/
// metal_bleed/earth_shield_pill) để nhất quán cảm quan giữa Pill và
// Set cùng 1 nguyên tố, không bịa stat mới.
export const equipmentSets: EquipmentSet[] = [
  {
    id: 'thai_hu',
    name: 'Thái Hư',
    pathId: 'kiem_tu',
    colorVar: '--set-thai_hu',
    bonuses: [
      {
        pieces: 2,
        modifiers: [
          {
            id: 'thai_hu_set_2_crit_rate',
            sourceId: 'thai_hu:2',
            sourceType: 'equipment',
            stat: 'criticalRate',
            flat: 0.04,
          },
        ],
      },
      {
        pieces: 4,
        modifiers: [
          {
            id: 'thai_hu_set_4_attack',
            sourceId: 'thai_hu:4',
            sourceType: 'equipment',
            stat: 'attack',
            percent: 0.12,
          },
        ],
      },
      {
        pieces: 6,
        modifiers: [
          {
            id: 'thai_hu_set_6_crit_damage',
            sourceId: 'thai_hu:6',
            sourceType: 'equipment',
            stat: 'criticalDamage',
            percent: 0.3,
          },
        ],
      },
    ],
  },

  {
    id: 'hau_tho',
    name: 'Hậu Thổ',
    pathId: 'phap_tu',
    colorVar: '--set-hau_tho',
    bonuses: [
      {
        pieces: 2,
        modifiers: [
          { id: 'hau_tho_set_2_defense', sourceId: 'hau_tho:2', sourceType: 'equipment', stat: 'defense', percent: 0.1 },
        ],
      },
      {
        pieces: 4,
        modifiers: [
          { id: 'hau_tho_set_4_ward_max', sourceId: 'hau_tho:4', sourceType: 'equipment', stat: 'wardMax', flat: 40 },
        ],
      },
      {
        pieces: 6,
        modifiers: [
          { id: 'hau_tho_set_6_thorns', sourceId: 'hau_tho:6', sourceType: 'equipment', stat: 'thornsPercent', flat: 0.15 },
        ],
      },
    ],
  },

  {
    id: 'cau_mang',
    name: 'Câu Mang',
    pathId: 'phap_tu',
    colorVar: '--set-cau_mang',
    bonuses: [
      {
        pieces: 2,
        modifiers: [
          { id: 'cau_mang_set_2_max_hp', sourceId: 'cau_mang:2', sourceType: 'equipment', stat: 'maxHp', percent: 0.1 },
        ],
      },
      {
        pieces: 4,
        modifiers: [
          { id: 'cau_mang_set_4_defense', sourceId: 'cau_mang:4', sourceType: 'equipment', stat: 'defense', percent: 0.08 },
        ],
      },
      {
        pieces: 6,
        modifiers: [
          { id: 'cau_mang_set_6_leech', sourceId: 'cau_mang:6', sourceType: 'equipment', stat: 'leechPercent', flat: 0.12 },
        ],
      },
    ],
  },

  {
    id: 'chuc_dung',
    name: 'Chúc Dung',
    pathId: 'phap_tu',
    colorVar: '--set-chuc_dung',
    bonuses: [
      {
        pieces: 2,
        modifiers: [
          { id: 'chuc_dung_set_2_fire_power', sourceId: 'chuc_dung:2', sourceType: 'equipment', stat: 'firePower', flat: 8 },
        ],
      },
      {
        pieces: 4,
        modifiers: [
          { id: 'chuc_dung_set_4_attack', sourceId: 'chuc_dung:4', sourceType: 'equipment', stat: 'attack', percent: 0.1 },
        ],
      },
      {
        pieces: 6,
        modifiers: [
          { id: 'chuc_dung_set_6_ailment', sourceId: 'chuc_dung:6', sourceType: 'equipment', stat: 'ailmentPotencyPercent', flat: 0.15 },
        ],
      },
    ],
  },

  {
    id: 'nhuc_thu',
    name: 'Nhục Thu',
    pathId: 'phap_tu',
    colorVar: '--set-nhuc_thu',
    bonuses: [
      {
        pieces: 2,
        modifiers: [
          { id: 'nhuc_thu_set_2_metal_power', sourceId: 'nhuc_thu:2', sourceType: 'equipment', stat: 'metalPower', flat: 8 },
        ],
      },
      {
        pieces: 4,
        modifiers: [
          { id: 'nhuc_thu_set_4_crit_damage', sourceId: 'nhuc_thu:4', sourceType: 'equipment', stat: 'criticalDamage', percent: 0.2 },
        ],
      },
      {
        pieces: 6,
        modifiers: [
          { id: 'nhuc_thu_set_6_ailment', sourceId: 'nhuc_thu:6', sourceType: 'equipment', stat: 'ailmentPotencyPercent', flat: 0.15 },
        ],
      },
    ],
  },

  {
    id: 'huyen_minh',
    name: 'Huyền Minh',
    pathId: 'phap_tu',
    colorVar: '--set-huyen_minh',
    bonuses: [
      {
        pieces: 2,
        modifiers: [
          { id: 'huyen_minh_set_2_water_power', sourceId: 'huyen_minh:2', sourceType: 'equipment', stat: 'waterPower', flat: 8 },
        ],
      },
      {
        pieces: 4,
        modifiers: [
          { id: 'huyen_minh_set_4_cooldown', sourceId: 'huyen_minh:4', sourceType: 'equipment', stat: 'cooldownReduction', flat: 0.06 },
        ],
      },
      {
        pieces: 6,
        modifiers: [
          { id: 'huyen_minh_set_6_max_mp', sourceId: 'huyen_minh:6', sourceType: 'equipment', stat: 'maxMp', percent: 0.15 },
        ],
      },
    ],
  },
]
