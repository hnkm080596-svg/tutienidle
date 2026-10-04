import type { AlchemyHerbVariant, AlchemyRecipe } from '@/core/alchemy/AlchemySystem'
import { HERB_AGES } from '@/core/production/ProductionTypes'
import { REALM_TIERS } from '@/core/realm/RealmTierMap'
import { MATERIAL_AGE_LABELS } from '@/data/materials/materials'
import { herbBaseId, herbMaterialId } from '@/core/profession/ProfessionMaterial'
import { isPillFamilyRecipeLiveAtRealm, PILL_FAMILIES } from '@/data/pill/PillFamilies'

/** Bien the phu DU truc HerbAge (5 bac - gp123 6E C1, thuong_co craftable). */
function grottoVariants(baseId: string): AlchemyHerbVariant[] {
  return HERB_AGES.map((age) => ({
    materialId: herbMaterialId(baseId, age),
    age,
    label: MATERIAL_AGE_LABELS[age],
  }))
}

/** Tam dan phuong moi pham; UI chi hien tam cong thuc cua pham hien tai. */
const generatedRecipes: AlchemyRecipe[] = REALM_TIERS.flatMap((realmId, tierIndex) =>
  PILL_FAMILIES.map((family) => ({
    id: `alchemy_${family.id}_${realmId}`,
    pillId: `${family.id}_${realmId}`,
    realmId,
    herbVariants: grottoVariants(herbBaseId(family.herbId, realmId)),
    herbAmount: 2 + Math.floor(tierIndex / 3),
    fuelWoodRealmId: realmId,
    fuelWoodAmount: 2 + Math.floor(tierIndex / 2),
    spiritStoneCost: Math.round(50 * Math.pow(2, tierIndex)),
    baseDurationSeconds: Math.round(600 * Math.pow(1.45, tierIndex)),
    // M10 (ARCH-008) - retired families (Hoi Xuan Dan) keep their recipes
    // resolvable for in-flight settle, but new jobs are rejected.
    // Per-realm retirement predicate lives in PillFamilies
    // (isPillFamilyRecipeLiveAtRealm): hoi_linh_dan at mortal is retired
    // because mp_regen cannot land while spell-domain stats stay 0.
    ...(isPillFamilyRecipeLiveAtRealm(family, realmId) ? {} : { retired: true }),
  })),
)

// Dan dac biet (spec dot-pha-loi-kiep sec4.1b) - 2 dan cua gate Truc Co,
// ngoai he 8-dan-pham theo PILL_FAMILIES. Nguyen lieu chinh la Yeu Dan
// (boss Luyen Khi tang 10) + thao realm 2 + Linh Thach. So lieu
// first-pass, playtest chinh (spec sec9).
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
    // M-F-CEILING - the recipe is the acquisition route for the Truc Co
    // breakthrough input; tagged so release policy gates the craft.
    breakthroughRealmId: 'foundation_establishment',
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
