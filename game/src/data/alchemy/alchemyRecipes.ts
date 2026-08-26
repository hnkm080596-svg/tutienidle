import type { AlchemyHerbVariant, AlchemyRecipe } from '@/core/alchemy/AlchemySystem'

// Alchemy recipes (2026-08-25, resource-professions-rework plan §8) —
// thay toàn bộ Recipe/Crafting cho Đan Phòng. Mỗi đan phương nhận ĐÚNG
// MỘT Linh Thảo riêng (§6.1) + Gỗ nhiên liệu (realm tối thiểu) + Linh
// Thạch. Người chơi chọn biến thể niên đại đang có trong Bag.
//
// - 12 đan phương nghề mới: thảo Động Thiên riêng × 4 niên đại.
// - 18 đan phương legacy giữ nguyên tác dụng (FoundationResolver vẫn
//   cần body_refining_pill): primary herb = họ thảo cũ của recipe;
//   biến thể = 3 bậc niên đại hiện có (thường/Bách Niên/Thiên Niên).
//   Một số pill elemental dùng kim loại làm nguyên liệu chính — không
//   có trục niên đại nên chỉ có 1 biến thể "Thường" (decade).

const LINH_CHI_VARIANTS: readonly AlchemyHerbVariant[] = [
  { materialId: 'linh_chi', age: 'decade', label: 'Thường' },
  { materialId: 'bach_nien_linh_chi', age: 'century', label: 'Bách Niên' },
  { materialId: 'thien_nien_linh_chi', age: 'millennium', label: 'Thiên Niên' },
]

const QUE_VARIANTS: readonly AlchemyHerbVariant[] = [
  { materialId: 'que', age: 'decade', label: 'Thường' },
  { materialId: 'bach_nien_que', age: 'century', label: 'Bách Niên' },
  { materialId: 'thien_nien_que', age: 'millennium', label: 'Thiên Niên' },
]

const CUC_HOA_VARIANTS: readonly AlchemyHerbVariant[] = [
  { materialId: 'cuc_hoa', age: 'decade', label: 'Thường' },
  { materialId: 'bach_nien_cuc_hoa', age: 'century', label: 'Bách Niên' },
  { materialId: 'thien_nien_cuc_hoa', age: 'millennium', label: 'Thiên Niên' },
]

const THANH_LINH_MOC_VARIANTS: readonly AlchemyHerbVariant[] = [
  { materialId: 'thanh_linh_moc', age: 'decade', label: 'Thường' },
  { materialId: 'bach_nien_thanh_linh_moc', age: 'century', label: 'Bách Niên' },
]

function grottoVariants(baseId: string): AlchemyHerbVariant[] {
  return [
    { materialId: `${baseId}_decade`, age: 'decade', label: 'Thập Niên' },
    { materialId: `${baseId}_century`, age: 'century', label: 'Bách Niên' },
    { materialId: `${baseId}_millennium`, age: 'millennium', label: 'Thiên Niên' },
    { materialId: `${baseId}_myriad_year`, age: 'myriad_year', label: 'Vạn Niên' },
  ]
}

export const alchemyRecipes: AlchemyRecipe[] = [
  // ============================================================
  // Đan phương nghề mới (12) — thảo Động Thiên riêng theo realm
  // ============================================================
  {
    id: 'alchemy_pill_regen_mortal',
    pillId: 'pill_regen_mortal',
    realmId: 'mortal',
    herbVariants: grottoVariants('huyet_tham'),
    herbAmount: 2,
    fuelWoodRealmId: 'mortal',
    fuelWoodAmount: 2,
    spiritStoneCost: 50,
    baseDurationSeconds: 600,
  },

  {
    id: 'alchemy_pill_cultivation_mortal',
    pillId: 'pill_cultivation_mortal',
    realmId: 'mortal',
    herbVariants: grottoVariants('tinh_khi_thao'),
    herbAmount: 2,
    fuelWoodRealmId: 'mortal',
    fuelWoodAmount: 2,
    spiritStoneCost: 60,
    baseDurationSeconds: 900,
  },

  {
    id: 'alchemy_pill_insight_mortal',
    pillId: 'pill_insight_mortal',
    realmId: 'mortal',
    herbVariants: grottoVariants('minh_muc_thao'),
    herbAmount: 2,
    fuelWoodRealmId: 'mortal',
    fuelWoodAmount: 3,
    spiritStoneCost: 80,
    baseDurationSeconds: 900,
  },

  {
    id: 'alchemy_pill_main_stat_mortal',
    pillId: 'pill_main_stat_mortal',
    realmId: 'mortal',
    herbVariants: grottoVariants('pho_cot_hoa'),
    herbAmount: 3,
    fuelWoodRealmId: 'mortal',
    fuelWoodAmount: 4,
    spiritStoneCost: 100,
    baseDurationSeconds: 1200,
  },

  {
    id: 'alchemy_pill_regen_qi_refining',
    pillId: 'pill_regen_qi_refining',
    realmId: 'qi_refining',
    herbVariants: grottoVariants('ngoc_huyet_chi'),
    herbAmount: 2,
    fuelWoodRealmId: 'qi_refining',
    fuelWoodAmount: 2,
    spiritStoneCost: 150,
    baseDurationSeconds: 1200,
  },

  {
    id: 'alchemy_pill_cultivation_qi_refining',
    pillId: 'pill_cultivation_qi_refining',
    realmId: 'qi_refining',
    herbVariants: grottoVariants('tuan_linh_cao'),
    herbAmount: 2,
    fuelWoodRealmId: 'qi_refining',
    fuelWoodAmount: 2,
    spiritStoneCost: 180,
    baseDurationSeconds: 1500,
  },

  {
    id: 'alchemy_pill_insight_qi_refining',
    pillId: 'pill_insight_qi_refining',
    realmId: 'qi_refining',
    herbVariants: grottoVariants('than_thong_hoa'),
    herbAmount: 2,
    fuelWoodRealmId: 'qi_refining',
    fuelWoodAmount: 3,
    spiritStoneCost: 220,
    baseDurationSeconds: 1500,
  },

  {
    id: 'alchemy_pill_main_stat_qi_refining',
    pillId: 'pill_main_stat_qi_refining',
    realmId: 'qi_refining',
    herbVariants: grottoVariants('loc_cot_thao'),
    herbAmount: 3,
    fuelWoodRealmId: 'qi_refining',
    fuelWoodAmount: 4,
    spiritStoneCost: 260,
    baseDurationSeconds: 1800,
  },

  {
    id: 'alchemy_pill_regen_foundation_establishment',
    pillId: 'pill_regen_foundation_establishment',
    realmId: 'foundation_establishment',
    herbVariants: grottoVariants('cu_phuong_qua'),
    herbAmount: 2,
    fuelWoodRealmId: 'foundation_establishment',
    fuelWoodAmount: 2,
    spiritStoneCost: 350,
    baseDurationSeconds: 1800,
  },

  {
    id: 'alchemy_pill_cultivation_foundation_establishment',
    pillId: 'pill_cultivation_foundation_establishment',
    realmId: 'foundation_establishment',
    herbVariants: grottoVariants('dao_diem_lien'),
    herbAmount: 2,
    fuelWoodRealmId: 'foundation_establishment',
    fuelWoodAmount: 2,
    spiritStoneCost: 420,
    baseDurationSeconds: 2100,
  },

  {
    id: 'alchemy_pill_insight_foundation_establishment',
    pillId: 'pill_insight_foundation_establishment',
    realmId: 'foundation_establishment',
    herbVariants: grottoVariants('van_tu_dang'),
    herbAmount: 2,
    fuelWoodRealmId: 'foundation_establishment',
    fuelWoodAmount: 3,
    spiritStoneCost: 500,
    baseDurationSeconds: 2100,
  },

  {
    id: 'alchemy_pill_main_stat_foundation_establishment',
    pillId: 'pill_main_stat_foundation_establishment',
    realmId: 'foundation_establishment',
    herbVariants: grottoVariants('thien_cot_thao'),
    herbAmount: 3,
    fuelWoodRealmId: 'foundation_establishment',
    fuelWoodAmount: 4,
    spiritStoneCost: 600,
    baseDurationSeconds: 2700,
  },

  // ============================================================
  // Đan phương legacy (18) — giữ nguyên tác dụng; đổi cost sang
  // nhóm mới: thảo họ cũ + gỗ + Linh Thạch (plan §8.1)
  // ============================================================
  {
    id: 'alchemy_minor_healing_pill',
    pillId: 'minor_healing_pill',
    realmId: 'mortal',
    herbVariants: LINH_CHI_VARIANTS,
    herbAmount: 2,
    fuelWoodRealmId: 'mortal',
    fuelWoodAmount: 1,
    spiritStoneCost: 20,
    baseDurationSeconds: 300,
  },

  {
    id: 'alchemy_medium_healing_pill',
    pillId: 'medium_healing_pill',
    realmId: 'mortal',
    herbVariants: LINH_CHI_VARIANTS,
    herbAmount: 3,
    fuelWoodRealmId: 'mortal',
    fuelWoodAmount: 2,
    spiritStoneCost: 40,
    baseDurationSeconds: 480,
  },

  {
    id: 'alchemy_major_healing_pill',
    pillId: 'major_healing_pill',
    realmId: 'mortal',
    herbVariants: LINH_CHI_VARIANTS,
    herbAmount: 4,
    fuelWoodRealmId: 'qi_refining',
    fuelWoodAmount: 2,
    spiritStoneCost: 80,
    baseDurationSeconds: 720,
  },

  {
    id: 'alchemy_qi_gathering_pill',
    pillId: 'qi_gathering_pill',
    realmId: 'mortal',
    herbVariants: CUC_HOA_VARIANTS,
    herbAmount: 2,
    fuelWoodRealmId: 'mortal',
    fuelWoodAmount: 2,
    spiritStoneCost: 30,
    baseDurationSeconds: 480,
  },

  {
    id: 'alchemy_body_forging_pill',
    pillId: 'body_forging_pill',
    realmId: 'mortal',
    herbVariants: QUE_VARIANTS,
    herbAmount: 2,
    fuelWoodRealmId: 'mortal',
    fuelWoodAmount: 2,
    spiritStoneCost: 30,
    baseDurationSeconds: 480,
  },

  {
    id: 'alchemy_flame_fox_pill',
    pillId: 'flame_fox_pill',
    realmId: 'qi_refining',
    herbVariants: QUE_VARIANTS,
    herbAmount: 3,
    fuelWoodRealmId: 'qi_refining',
    fuelWoodAmount: 2,
    spiritStoneCost: 90,
    baseDurationSeconds: 900,
  },

  {
    id: 'alchemy_body_tempering_pill',
    pillId: 'body_tempering_pill',
    realmId: 'mortal',
    herbVariants: LINH_CHI_VARIANTS,
    herbAmount: 2,
    fuelWoodRealmId: 'mortal',
    fuelWoodAmount: 2,
    spiritStoneCost: 40,
    baseDurationSeconds: 600,
  },

  {
    id: 'alchemy_flood_serpent_pill',
    pillId: 'flood_serpent_pill',
    realmId: 'qi_refining',
    herbVariants: CUC_HOA_VARIANTS,
    herbAmount: 4,
    fuelWoodRealmId: 'qi_refining',
    fuelWoodAmount: 3,
    spiritStoneCost: 120,
    baseDurationSeconds: 1200,
  },

  {
    id: 'alchemy_rock_bear_pill',
    pillId: 'rock_bear_pill',
    realmId: 'qi_refining',
    herbVariants: CUC_HOA_VARIANTS,
    herbAmount: 3,
    fuelWoodRealmId: 'qi_refining',
    fuelWoodAmount: 3,
    spiritStoneCost: 120,
    baseDurationSeconds: 1200,
  },

  {
    id: 'alchemy_blade_hawk_pill',
    pillId: 'blade_hawk_pill',
    realmId: 'qi_refining',
    herbVariants: QUE_VARIANTS,
    herbAmount: 3,
    fuelWoodRealmId: 'qi_refining',
    fuelWoodAmount: 2,
    spiritStoneCost: 110,
    baseDurationSeconds: 1050,
  },

  {
    id: 'alchemy_spirit_condensing_pill',
    pillId: 'spirit_condensing_pill',
    realmId: 'qi_refining',
    herbVariants: LINH_CHI_VARIANTS,
    herbAmount: 3,
    fuelWoodRealmId: 'qi_refining',
    fuelWoodAmount: 2,
    spiritStoneCost: 110,
    baseDurationSeconds: 1050,
  },

  {
    id: 'alchemy_foundation_pill',
    pillId: 'foundation_pill',
    realmId: 'qi_refining',
    herbVariants: LINH_CHI_VARIANTS,
    herbAmount: 3,
    fuelWoodRealmId: 'qi_refining',
    fuelWoodAmount: 3,
    spiritStoneCost: 160,
    baseDurationSeconds: 1500,
  },

  {
    id: 'alchemy_body_refining_pill',
    pillId: 'body_refining_pill',
    realmId: 'qi_refining',
    herbVariants: LINH_CHI_VARIANTS,
    herbAmount: 3,
    fuelWoodRealmId: 'qi_refining',
    fuelWoodAmount: 3,
    spiritStoneCost: 160,
    baseDurationSeconds: 1500,
  },

  {
    id: 'alchemy_spirit_forging_pill',
    pillId: 'spirit_forging_pill',
    realmId: 'qi_refining',
    herbVariants: QUE_VARIANTS,
    herbAmount: 3,
    fuelWoodRealmId: 'qi_refining',
    fuelWoodAmount: 2,
    spiritStoneCost: 130,
    baseDurationSeconds: 1200,
  },

  {
    id: 'alchemy_fire_might_pill',
    pillId: 'fire_might_pill',
    realmId: 'qi_refining',
    herbVariants: QUE_VARIANTS,
    herbAmount: 2,
    fuelWoodRealmId: 'qi_refining',
    fuelWoodAmount: 2,
    spiritStoneCost: 90,
    baseDurationSeconds: 900,
  },

  {
    id: 'alchemy_wood_drain_pill',
    pillId: 'wood_drain_pill',
    realmId: 'qi_refining',
    herbVariants: THANH_LINH_MOC_VARIANTS,
    herbAmount: 2,
    fuelWoodRealmId: 'qi_refining',
    fuelWoodAmount: 2,
    spiritStoneCost: 90,
    baseDurationSeconds: 900,
  },

  {
    id: 'alchemy_water_control_pill',
    pillId: 'water_control_pill',
    realmId: 'qi_refining',
    herbVariants: CUC_HOA_VARIANTS,
    herbAmount: 2,
    fuelWoodRealmId: 'qi_refining',
    fuelWoodAmount: 2,
    spiritStoneCost: 90,
    baseDurationSeconds: 900,
  },

  {
    id: 'alchemy_metal_bleed_pill',
    pillId: 'metal_bleed_pill',
    realmId: 'qi_refining',
    herbVariants: [{ materialId: 'huyen_thiet', age: 'decade', label: 'Thường' }],
    herbAmount: 2,
    fuelWoodRealmId: 'qi_refining',
    fuelWoodAmount: 2,
    spiritStoneCost: 90,
    baseDurationSeconds: 900,
  },

  {
    id: 'alchemy_earth_shield_pill',
    pillId: 'earth_shield_pill',
    realmId: 'qi_refining',
    herbVariants: [{ materialId: 'hoang_kim_linh_thiet', age: 'decade', label: 'Thường' }],
    herbAmount: 2,
    fuelWoodRealmId: 'qi_refining',
    fuelWoodAmount: 2,
    spiritStoneCost: 90,
    baseDurationSeconds: 900,
  },
]
