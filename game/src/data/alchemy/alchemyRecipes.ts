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
export const alchemyRecipes: AlchemyRecipe[] = REALM_TIERS.flatMap((realmId, tierIndex) =>
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
