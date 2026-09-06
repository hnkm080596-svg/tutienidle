// ProfessionValidators (2026-08-25, resource-professions-rework plan
// §5/§6) — validate metadata nghề TRÊN TỪNG material (boot validator)
// và toàn catalog (data-integrity test). KHÔNG còn cặp raw|processed.
// gp123 6E task C2: gỗ/khoáng dùng trục tuổi thống nhất — id
// `<realm>_wood_<age>` / `<realm>_ore_<age>` (plain wood + phẩm
// hoang..tien đã xóa).
import { HERB_AGES } from '../production/ProductionTypes'
import { isHerbProfessionMeta, isProfessionResourceMeta } from './ProfessionMaterial'
import { SUPPORTED_PROFESSION_REALMS, type ProfessionMaterialMeta } from './ProfessionMaterial'
import { REALM_TIERS } from '../realm/RealmTierMap'

export interface ValidationResult {
  valid: boolean

  errors: string[]
}

/**
 * Validate MỘT entry — dùng ở GameManager.registerMaterials: lỗi
 * authoring fail NGAY lúc boot, không âm thầm tạo kinh tế hỏng. Trả về
 * chuỗi lỗi đầu tiên hoặc null nếu hợp lệ.
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
 * Validate TOÀN BỘ catalog nghề — data-integrity test:
 * - Đủ gỗ + đủ khoáng (mọi realm × 5 tuổi), đủ thảo cho mọi đan phương.
 * - Thảo cùng đan phương có ĐỦ 5 tuổi, mỗi cặp (recipe, age) duy nhất.
 * - Thứ tự xác suất tuổi giảm dần được enforce ở ProductionCatalog.
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
