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
    id: 'prefix_defense',
    name: 'Kiên Cố',
    stat: 'defense',
    kind: 'prefix',
    pool: 'basic',
    tiers: [
      { tier: 1, min: 2, max: 4 },
      { tier: 2, min: 5, max: 9 },
      { tier: 3, min: 10, max: 15 },
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
    name: 'Của Nhanh Nhẹn',
    stat: 'attackSpeed',
    kind: 'suffix',
    pool: 'basic',
    tiers: [
      { tier: 1, min: 1, max: 2 },
      { tier: 2, min: 3, max: 4 },
      { tier: 3, min: 5, max: 7 },
    ],
  },

  {
    id: 'suffix_dexterity',
    name: 'Của Thân Pháp',
    stat: 'dexterity',
    kind: 'suffix',
    pool: 'basic',
    tiers: [
      { tier: 1, min: 2, max: 4 },
      { tier: 2, min: 5, max: 8 },
      { tier: 3, min: 9, max: 13 },
    ],
  },

  {
    id: 'suffix_vitality',
    name: 'Của Thể Chất',
    stat: 'vitality',
    kind: 'suffix',
    pool: 'basic',
    tiers: [
      { tier: 1, min: 2, max: 4 },
      { tier: 2, min: 5, max: 8 },
      { tier: 3, min: 9, max: 13 },
    ],
  },

  {
    id: 'suffix_critical_damage',
    name: 'Của Trí Mạng',
    stat: 'criticalDamage',
    kind: 'suffix',
    pool: 'basic',
    tiers: [
      { tier: 1, min: 0.05, max: 0.1 },
      { tier: 2, min: 0.11, max: 0.2 },
      { tier: 3, min: 0.21, max: 0.35 },
    ],
  },

  {
    id: 'suffix_movement_speed',
    name: 'Của Phong Hành',
    stat: 'movementSpeed',
    kind: 'suffix',
    pool: 'basic',
    tiers: [
      { tier: 1, min: 1, max: 2 },
      { tier: 2, min: 3, max: 4 },
      { tier: 3, min: 5, max: 7 },
    ],
  },

  {
    id: 'prefix_supreme_strength',
    name: 'Cân Cốt Tuyệt Thế',
    stat: 'strength',
    kind: 'prefix',
    pool: 'supreme',
    tiers: [
      { tier: 1, min: 1, max: 2 },
      { tier: 2, min: 3, max: 4 },
      { tier: 3, min: 5, max: 7 },
      { tier: 4, min: 8, max: 11 },
      { tier: 5, min: 12, max: 16 },
    ],
  },

  {
    id: 'suffix_supreme_intelligence',
    name: 'Của Thần Thức Vô Song',
    stat: 'intelligence',
    kind: 'suffix',
    pool: 'supreme',
    tiers: [
      { tier: 1, min: 1, max: 2 },
      { tier: 2, min: 3, max: 4 },
      { tier: 3, min: 5, max: 7 },
      { tier: 4, min: 8, max: 11 },
      { tier: 5, min: 12, max: 16 },
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
    name: 'Của Dị Hoả',
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
    name: 'Của Hấp Huyết',
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
    name: 'Của Lưu Thủy',
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
    name: 'Của Bàn Thạch',
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
