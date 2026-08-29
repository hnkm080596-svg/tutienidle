import type { AlchemyHerbVariant, AlchemyRecipe } from '@/core/alchemy/AlchemySystem'
import { REALM_TIERS } from '@/core/realm/RealmTierMap'
import { PILL_FAMILIES } from '@/data/pill/PillFamilies'

function grottoVariants(baseId: string): AlchemyHerbVariant[] {
  return [
    { materialId: `${baseId}_decade`, age: 'decade', label: 'Thập Niên' },
    { materialId: `${baseId}_century`, age: 'century', label: 'Bách Niên' },
    { materialId: `${baseId}_millennium`, age: 'millennium', label: 'Thiên Niên' },
    { materialId: `${baseId}_myriad_year`, age: 'myriad_year', label: 'Vạn Niên' },
  ]
}

/** Tám đan phương mỗi phẩm; UI chỉ hiện tám công thức của phẩm hiện tại. */
const generatedRecipes: AlchemyRecipe[] = REALM_TIERS.flatMap((realmId, tierIndex) =>
  PILL_FAMILIES.map((family) => ({
    id: `alchemy_${family.id}_${realmId}`,
    pillId: `${family.id}_${realmId}`,
    realmId,
    herbVariants: grottoVariants(`${family.herbId}_${realmId}`),
    herbAmount: 2 + Math.floor(tierIndex / 3),
    fuelWoodRealmId: realmId,
    fuelWoodAmount: 2 + Math.floor(tierIndex / 2),
    spiritStoneCost: Math.round(50 * Math.pow(2, tierIndex)),
    baseDurationSeconds: Math.round(600 * Math.pow(1.45, tierIndex)),
  })),
)

// Đan đặc biệt (spec dot-pha-loi-kiep §4.1b) — 2 đan của gate Trúc Cơ,
// ngoài hệ 8-đan-phẩm theo PILL_FAMILIES. Nguyên liệu chính là Yêu Đan
// (boss Luyện Khí tầng 10) + thảo realm 2 + Linh Thạch. Số liệu
// first-pass, playtest chỉnh (spec §9).
export const SPECIAL_ALCHEMY_RECIPES: AlchemyRecipe[] = [
  {
    id: 'alchemy_thong_mach_dan',
    pillId: 'thong_mach_dan',
    realmId: 'qi_refining',
    herbVariants: grottoVariants('tu_linh_thao_qi_refining'),
    herbAmount: 3,
    fuelWoodRealmId: 'qi_refining',
    fuelWoodAmount: 3,
    spiritStoneCost: 500,
    baseDurationSeconds: 900,
    specialIngredients: [{ materialId: 'yeu_dan_hung_giao', amount: 1 }],
  },
  {
    id: 'alchemy_truc_co_dan',
    pillId: 'truc_co_dan',
    realmId: 'qi_refining',
    herbVariants: grottoVariants('tu_linh_thao_qi_refining'),
    herbAmount: 4,
    fuelWoodRealmId: 'qi_refining',
    fuelWoodAmount: 4,
    spiritStoneCost: 1000,
    baseDurationSeconds: 1200,
    specialIngredients: [{ materialId: 'yeu_dan_hung_giao', amount: 1 }],
  },
]

export const alchemyRecipes: AlchemyRecipe[] = [...generatedRecipes, ...SPECIAL_ALCHEMY_RECIPES]
