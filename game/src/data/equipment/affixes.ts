import type { Affix } from '@/core/equipment/Affix'

// Core Loop Foundation checklist (Phase 3, Muc AFFIX) - data mau minh
// hoa, phu dung cac stat tung co trong substatPool cu cua
// iron_sword/spirit_silver_armor (might/defense/maxHp/maxMp/
// dexterity/vitality) + them 4 affix moi (criticalRate/
// criticalDamage/attackSpeed/movementSpeed) cho phong phu. Khong khai
// `slots` = roll duoc tren moi loai trang bi (don gian hoa cho dot
// data mau nay, co the thu hep sau neu can can bang rieng theo slot).
//
// Equipment Rework (2026-08-14) - 9 affix goc deu gan `pool: 'basic'`
// (giu nguyen hanh vi cu, moi Quality deu truy cap duoc - xem
// ITEM_QUALITY_UNLOCKED_POOLS trong core/equipment/ItemQualityBalance.ts).
// Them 2 affix moi o pool 'supreme' - truoc day ITEM_QUALITY_AFFIX_TIER
// da cho phep tier toi 5 nhung chua affix nao roll qua tier 3 (data
// gap), gio co noi dung that de pool 'supreme'/roll "Exalted Affix"
// (quality tien cao nhat, xem ITEM_QUALITY_EXALTED_AFFIX_CHANCE trong
// ItemQualityBalance.ts) khong roi vao no-op.
export const affixes: Affix[] = [
  {
    id: 'prefix_attack',
    name: 'Cường Lực',
    stat: 'might',
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
    stat: 'speed',
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

  // Pool advanced mo tu Linh Khi: bo sung lop phong thu that thay vi gate
  // rong. Khang dung thang rating (1 diem = 1%) giong Resistance.ts.
  // Spec 2026-08-30-phap-tu-dao-sac sec5 - nhom affix khang Phong/Loi da
  // xoa cung element wind/lightning.
  ...(
    [
      ['fire', 'Hỏa', ['helmet', 'armor', 'boots', 'necklace']],
      ['wood', 'Mộc', ['helmet', 'armor', 'boots', 'necklace']],
      ['water', 'Thủy', ['helmet', 'armor', 'boots', 'necklace']],
      ['metal', 'Kim', ['helmet', 'armor', 'boots', 'necklace']],
      ['earth', 'Thổ', ['helmet', 'armor', 'boots', 'necklace']],
    ] as const
  ).map(([element, label, slots]) => ({
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

  // Phap Tu profession-tier ladder (2026-08-14) - 2 affix Hoa he dau
  // tien, pool 'specialized' (mo tu Phap Bao/Tien Bao Quality tro len,
  // xem ITEM_QUALITY_UNLOCKED_POOLS) - ailmentPotencyPercent nen
  // = 0 nen tiers dung gia tri nho, truc tiep CONG THANG vao % (0.03 =
  // +3 diem %, khong phai +3% cua 0).
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

  // Moc Tu (2026-08-15) - Moc Uy song hanh prefix_fire_power, Cua Hap
  // Huyet la affix leechPercent DAU TIEN (truoc do chi co nguon ky
  // nang/tam phap) - applyScaledModifier() luon roll affix duoi dang
  // `flat` bat ke stat (xem EquipmentSystem.ts), nen khong dinh gotcha
  // percent-tren-nen-0 nhu modifier tu khai tay.
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

  // Thuy/Kim/Tho Tu (2026-08-15) - moi hanh them 1 affix Power (song
  // hanh prefix_fire_power/prefix_wood_power) + 1 affix theo DUNG co
  // che rieng cua hanh do (Thuy: speed cho loi choi ra don nhanh hon
  // giu Lam Cham; Kim tai dung thang suffix_ailment_potency co san o
  // tren, khuech dai Chay Mau, khong can them affix rieng). The Tu
  // Reimagined (spec 2026-09-15 T12): generic thorns stat retired - the
  // "Ban Thach" thorns affix is gone with the stat.
  // Turn-based conversion (2026-09-04): cooldownReduction retired -
  // affix Luu Thuy chuyen sang speed, cung co che giu nhip.
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
    stat: 'speed',
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

]
