// ProfessionValidators (2026-08-25, resource-professions-rework plan
// sec5/sec6) - validate metadata nghe TREN TUNG material (boot validator)
// va toan catalog (data-integrity test). KHONG con cap raw|processed.
// gp123 6E task C2: go/khoang dung truc tuoi thong nhat - id
// `<realm>_wood_<age>` / `<realm>_ore_<age>` (plain wood + pham
// hoang..tien da xoa).
import { HERB_AGES } from '../production/ProductionTypes'
import { isHerbProfessionMeta, isProfessionResourceMeta } from './ProfessionMaterial'
import { SUPPORTED_PROFESSION_REALMS, type ProfessionMaterialMeta } from './ProfessionMaterial'
import { REALM_TIERS } from '../realm/RealmTierMap'

export interface ValidationResult {
  valid: boolean

  errors: string[]
}

/**
 * Validate MOT entry - dung o GameManager.registerMaterials: loi
 * authoring fail NGAY luc boot, khong am tham tao kinh te hong. Tra ve
 * chuoi loi dau tien hoac null neu hop le.
 */
export function validateProfessionMaterialEntry(
  materialId: string,
  meta: ProfessionMaterialMeta,
): string | null {
  if (!REALM_TIERS.some((realmId) => realmId === meta.realmId)) {
    return `${materialId}: realm "${meta.realmId}" không hợp lệ`
  }

  switch (meta.resourceKind) {
    case 'wood':
    case 'ore': {
      if (!isProfessionResourceMeta(meta)) {
        return `${materialId}: ${meta.resourceKind} thiếu age hợp lệ (decade..thuong_co)`
      }

      const expected = `${meta.realmId}_${meta.resourceKind}_${meta.age}`

      if (materialId !== expected) {
        return `${materialId}: id ${meta.resourceKind} phải là "${expected}"`
      }

      return null
    }

    case 'herb': {
      if (!isHerbProfessionMeta(meta)) {
        return `${materialId}: linh thảo thiếu age/pillRecipeId/herbBaseId`
      }

      if (!HERB_AGES.includes(meta.age as (typeof HERB_AGES)[number])) {
        return `${materialId}: age "${meta.age}" không hợp lệ`
      }

      const expected = `${meta.herbBaseId}_${meta.age}`

      if (materialId !== expected) {
        return `${materialId}: id thảo phải là "${expected}"`
      }

      return null
    }

    default:
      return `${materialId}: resourceKind lạ`
  }
}

/**
 * Validate TOAN BO catalog nghe - data-integrity test:
 * - Du go + du khoang (moi realm x 5 tuoi), du thao cho moi dan phuong.
 * - Thao cung dan phuong co DU 5 tuoi, moi cap (recipe, age) duy nhat.
 * - Thu tu xac suat tuoi giam dan duoc enforce o ProductionCatalog.
 */
export function validateProfessionMaterialCatalog(
  entries: Array<{ id: string; profession?: ProfessionMaterialMeta }>,
): ValidationResult {
  const errors: string[] = []

  const ores = new Set<string>()

  const woods = new Set<string>()

  const herbRecipes = new Map<string, Set<string>>()

  for (const entry of entries) {
    if (!entry.profession) {
      continue
    }

    const error = validateProfessionMaterialEntry(entry.id, entry.profession)

    if (error) {
      errors.push(error)

      continue
    }

    const meta = entry.profession

    if (meta.resourceKind === 'wood') {
      woods.add(`${meta.realmId}:${meta.age}`)
    } else if (meta.resourceKind === 'ore') {
      ores.add(`${meta.realmId}:${meta.age}`)
    } else if (meta.resourceKind === 'herb') {
      const ages = herbRecipes.get(meta.pillRecipeId!) ?? new Set<string>()

      ages.add(meta.age!)

      herbRecipes.set(meta.pillRecipeId!, ages)
    }
  }

  for (const realmId of SUPPORTED_PROFESSION_REALMS) {
    for (const age of HERB_AGES) {
      if (!woods.has(`${realmId}:${age}`)) {
        errors.push(`catalog: thiếu gỗ ${realmId}/${age}`)
      }

      if (!ores.has(`${realmId}:${age}`)) {
        errors.push(`catalog: thiếu quáng ${realmId}/${age}`)
      }
    }
  }

  for (const [recipeId, ages] of herbRecipes) {
    for (const age of HERB_AGES) {
      if (!ages.has(age)) {
        errors.push(`catalog: đan phương ${recipeId} thiếu thảo tuổi ${age}`)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}
