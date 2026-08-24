import type { Affix } from '@/core/equipment/Affix'

// Core Loop Foundation checklist (Phase 3, Mục AFFIX) — data mẫu minh
// hoạ, phủ đúng các stat từng có trong substatPool cũ của
// iron_sword/spirit_silver_armor (attack/defense/maxHp/maxMp/
// dexterity/vitality) + thêm 4 affix mới (criticalRate/
// criticalDamage/attackSpeed/movementSpeed) cho phong phú. Không khai
// `slots` = roll được trên mọi loại trang bị (đơn giản hoá cho đợt
// data mẫu này, có thể thu hẹp sau nếu cần cân bằng riêng theo slot).
//
// Equipment Rework (2026-08-14) — 9 affix gốc đều gắn `pool: 'basic'`
// (giữ nguyên hành vi cũ, mọi Quality đều truy cập được — xem
// EQUIPMENT_QUALITY_UNLOCKED_POOLS trong core/equipment/EquipmentQuality.ts).
// Thêm 2 affix mới ở pool 'supreme' — trước đây EQUIPMENT_QUALITY_MAX_AFFIX_TIER
// đã cho phép tier tới 5 nhưng chưa affix nào roll quá tier 3 (data
// gap), giờ có nội dung thật để pool 'supreme'/roll "Exalted Affix"
// (thien_duyen rarity, xem EquipmentRarity.ts) không rơi vào no-op.
export const affixes: Affix[] = [
  {
    id: 'prefix_attack',
    name: 'Cường Lực',
    stat: 'attack',
    kind: 'prefix',
    pool: 'basic',
    tiers: [
      { tier: 1, min: 3, max: 6 },
      { tier: 2, min: 7, max: 12 },
      { tier: 3, min: 13, max: 20 },
    ],
  },

  {
    id: 'prefix_max_hp',
    name: 'Cường Kiện',
    stat: 'maxHp',
    kind: 'prefix',
    pool: 'basic',
    tiers: [
      { tier: 1, min: 10, max: 20 },
      { tier: 2, min: 21, max: 40 },
      { tier: 3, min: 41, max: 70 },
    ],
  },

  {
    id: 'prefix_max_mp',
    name: 'Linh Tuyền',
    stat: 'maxMp',
    kind: 'prefix',
    pool: 'basic',
    tiers: [
      { tier: 1, min: 5, max: 10 },
      { tier: 2, min: 11, max: 20 },
      { tier: 3, min: 21, max: 35 },
    ],
  },

  {
    id: 'prefix_critical_rate',
    name: 'Chuẩn Xác',
    stat: 'criticalRate',
    kind: 'prefix',
    pool: 'basic',
    tiers: [
      { tier: 1, min: 0.01, max: 0.02 },
      { tier: 2, min: 0.03, max: 0.05 },
      { tier: 3, min: 0.06, max: 0.09 },
    ],
  },

  {
    id: 'suffix_attack_speed',
    name: 'Nhanh Nhẹn',
    stat: 'attackSpeed',
    kind: 'suffix',
    pool: 'basic',
    tiers: [
      { tier: 1, min: 0.01, max: 0.02 },
      { tier: 2, min: 0.03, max: 0.04 },
      { tier: 3, min: 0.05, max: 0.07 },
    ],
  },

  {
    id: 'suffix_accuracy',
    name: 'Chính Xác',
    stat: 'accuracyRating',
    kind: 'suffix',
    pool: 'basic',
    tiers: [
      { tier: 1, min: 2, max: 4 },
      { tier: 2, min: 5, max: 8 },
      { tier: 3, min: 9, max: 13 },
    ],
  },

  {
    id: 'suffix_critical_avoidance',
    name: 'Hộ Mệnh',
    stat: 'criticalAvoidance',
    kind: 'suffix',
    pool: 'basic',
    tiers: [
      { tier: 1, min: 0.02, max: 0.04 },
      { tier: 2, min: 0.05, max: 0.08 },
      { tier: 3, min: 0.09, max: 0.13 },
    ],
  },

  {
    id: 'suffix_critical_damage',
    name: 'Trí Mạng',
    stat: 'criticalDamage',
    kind: 'suffix',
    pool: 'basic',
    tiers: [
      { tier: 1, min: 0.05, max: 0.1 },
      { tier: 2, min: 0.11, max: 0.2 },
      { tier: 3, min: 0.21, max: 0.35 },
    ],
  },

  

  // Pool advanced mở từ Linh Khí: bổ sung lớp phòng thủ thật thay vì gate
  // rỗng. Kháng dùng thang rating (1 điểm = 1%) giống Resistance.ts.
  ...([
    ['fire', 'Hỏa', ['helmet', 'armor', 'boots', 'necklace']],
    ['wood', 'Mộc', ['helmet', 'armor', 'boots', 'necklace']],
    ['water', 'Thủy', ['helmet', 'armor', 'boots', 'necklace']],
    ['metal', 'Kim', ['helmet', 'armor', 'boots', 'necklace']],
    ['earth', 'Thổ', ['helmet', 'armor', 'boots', 'necklace']],
    ['wind', 'Phong', ['helmet', 'armor', 'boots', 'necklace']],
    ['lightning', 'Lôi', ['helmet', 'armor', 'boots', 'necklace']],
  ] as const).map(([element, label, slots]) => ({
    id: `suffix_${element}_resistance`,
    name: `Kháng ${label}`,
    stat: `${element}Resistance` as Affix['stat'],
    kind: 'suffix' as const,
    pool: 'advanced' as const,
    slots: [...slots] as Affix['slots'],
    tiers: [
      { tier: 1, min: 4, max: 8 },
      { tier: 2, min: 9, max: 15 },
      { tier: 3, min: 16, max: 24 },
      { tier: 4, min: 25, max: 34 },
      { tier: 5, min: 35, max: 45 },
    ],
  })),

  {
    id: 'prefix_ward',
    name: 'Hộ Thuẫn',
    stat: 'wardMax',
    kind: 'prefix',
    pool: 'advanced',
    slots: ['helmet', 'necklace'],
    tiers: [
      { tier: 1, min: 8, max: 15 },
      { tier: 2, min: 16, max: 28 },
      { tier: 3, min: 29, max: 45 },
      { tier: 4, min: 46, max: 68 },
      { tier: 5, min: 69, max: 95 },
    ],
  },

  {
    id: 'prefix_supreme_final_damage',
    name: 'Tuyệt Thế Công Phạt',
    stat: 'finalDamagePercent',
    kind: 'prefix',
    pool: 'supreme',
    tiers: [
      { tier: 1, min: 0.01, max: 0.02 },
      { tier: 2, min: 0.03, max: 0.04 },
      { tier: 3, min: 0.05, max: 0.07 },
      { tier: 4, min: 0.08, max: 0.11 },
      { tier: 5, min: 0.12, max: 0.16 },
    ],
  },

  {
    id: 'suffix_supreme_final_reduction',
    name: 'Tuyệt Thế Hộ Thể',
    stat: 'finalDamageReductionPercent',
    kind: 'suffix',
    pool: 'supreme',
    tiers: [
      { tier: 1, min: 0.01, max: 0.02 },
      { tier: 2, min: 0.03, max: 0.04 },
      { tier: 3, min: 0.05, max: 0.07 },
      { tier: 4, min: 0.08, max: 0.11 },
      { tier: 5, min: 0.12, max: 0.16 },
    ],
  },

  // Pháp Tu profession-tier ladder (2026-08-14) — 2 affix Hỏa hệ đầu
  // tiên, pool 'specialized' (mở từ Pháp Bảo/Tiên Bảo Quality trở lên,
  // xem EQUIPMENT_QUALITY_UNLOCKED_POOLS) — ailmentPotencyPercent nền
  // = 0 nên tiers dùng giá trị nhỏ, trực tiếp CỘNG THẲNG vào % (0.03 =
  // +3 điểm %, không phải +3% của 0).
  {
    id: 'prefix_fire_power',
    name: 'Viêm Uy',
    stat: 'firePower',
    kind: 'prefix',
    pool: 'specialized',
    tiers: [
      { tier: 1, min: 4, max: 8 },
      { tier: 2, min: 9, max: 15 },
      { tier: 3, min: 16, max: 24 },
    ],
  },

  {
    id: 'suffix_ailment_potency',
    name: 'Dị Hỏa',
    stat: 'ailmentPotencyPercent',
    kind: 'suffix',
    pool: 'specialized',
    tiers: [
      { tier: 1, min: 0.03, max: 0.06 },
      { tier: 2, min: 0.07, max: 0.12 },
      { tier: 3, min: 0.13, max: 0.2 },
    ],
  },

  // Mộc Tu (2026-08-15) — Mộc Uy song hành prefix_fire_power, Của Hấp
  // Huyết là affix leechPercent ĐẦU TIÊN (trước đó chỉ có nguồn kỹ
  // năng/tâm pháp) — applyScaledModifier() luôn roll affix dưới dạng
  // `flat` bất kể stat (xem EquipmentSystem.ts), nên không dính gotcha
  // percent-trên-nền-0 như modifier tự khai tay.
  {
    id: 'prefix_wood_power',
    name: 'Mộc Uy',
    stat: 'woodPower',
    kind: 'prefix',
    pool: 'specialized',
    tiers: [
      { tier: 1, min: 4, max: 8 },
      { tier: 2, min: 9, max: 15 },
      { tier: 3, min: 16, max: 24 },
    ],
  },

  {
    id: 'suffix_leech',
    name: 'Hấp Huyết',
    stat: 'leechPercent',
    kind: 'suffix',
    pool: 'specialized',
    tiers: [
      { tier: 1, min: 0.02, max: 0.04 },
      { tier: 2, min: 0.05, max: 0.08 },
      { tier: 3, min: 0.09, max: 0.14 },
    ],
  },

  // Thủy/Kim/Thổ Tu (2026-08-15) — mỗi hành thêm 1 affix Power (song
  // hành prefix_fire_power/prefix_wood_power) + 1 affix theo ĐÚNG cơ
  // chế riêng của hành đó (Thủy: cooldownReduction cho lối chơi tung
  // chiêu liên tục giữ Làm Chậm; Thổ: thornsPercent cho Thạch Giáp —
  // Kim tái dùng thẳng suffix_ailment_potency có sẵn ở trên, khuếch
  // đại Chảy Máu, không cần thêm affix riêng).
  {
    id: 'prefix_water_power',
    name: 'Thủy Uy',
    stat: 'waterPower',
    kind: 'prefix',
    pool: 'specialized',
    tiers: [
      { tier: 1, min: 4, max: 8 },
      { tier: 2, min: 9, max: 15 },
      { tier: 3, min: 16, max: 24 },
    ],
  },

  {
    id: 'suffix_cooldown_reduction',
    name: 'Lưu Thủy',
    stat: 'cooldownReduction',
    kind: 'suffix',
    pool: 'specialized',
    tiers: [
      { tier: 1, min: 0.02, max: 0.04 },
      { tier: 2, min: 0.05, max: 0.08 },
      { tier: 3, min: 0.09, max: 0.13 },
    ],
  },

  {
    id: 'prefix_metal_power',
    name: 'Kim Uy',
    stat: 'metalPower',
    kind: 'prefix',
    pool: 'specialized',
    tiers: [
      { tier: 1, min: 4, max: 8 },
      { tier: 2, min: 9, max: 15 },
      { tier: 3, min: 16, max: 24 },
    ],
  },

  {
    id: 'prefix_earth_power',
    name: 'Địa Uy',
    stat: 'earthPower',
    kind: 'prefix',
    pool: 'specialized',
    tiers: [
      { tier: 1, min: 4, max: 8 },
      { tier: 2, min: 9, max: 15 },
      { tier: 3, min: 16, max: 24 },
    ],
  },

  {
    id: 'suffix_thorns',
    name: 'Bàn Thạch',
    stat: 'thornsPercent',
    kind: 'suffix',
    pool: 'specialized',
    tiers: [
      { tier: 1, min: 0.02, max: 0.05 },
      { tier: 2, min: 0.06, max: 0.1 },
      { tier: 3, min: 0.11, max: 0.16 },
    ],
  },
]
