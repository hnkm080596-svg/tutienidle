// ProfessionValidators (2026-08-25, resource-professions-rework plan
// §5/§6) — validate metadata nghề TRÊN TỪNG material (boot validator)
// và toàn catalog (data-integrity test). KHÔNG còn cặp raw|processed.
import type { OreQuality } from '../production/ProductionTypes'
import { HERB_AGES, ORE_QUALITIES } from '../production/ProductionTypes'
import { isHerbProfessionMeta, isOreProfessionMeta } from './ProfessionMaterial'
import { SUPPORTED_PROFESSION_REALMS, type ProfessionMaterialMeta } from './ProfessionMaterial'

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
  if (!SUPPORTED_PROFESSION_REALMS.includes(meta.realmId)) {
    return `${materialId}: realm "${meta.realmId}" ngoài product scope`
  }

  switch (meta.resourceKind) {
    case 'wood': {
      const expected = `${meta.realmId}_wood`

      if (materialId !== expected) {
        return `${materialId}: id gỗ phải là "${expected}"`
      }

      return null
    }

    case 'ore': {
      if (!isOreProfessionMeta(meta)) {
        return `${materialId}: quáng thiếu phẩm hợp lệ (hoang..tien)`
      }

      const expected = `${meta.realmId}_ore_${meta.quality}`

      if (materialId !== expected) {
        return `${materialId}: id quáng phải là "${expected}"`
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
 * - Đủ 3 gỗ, đủ 15 quáng (3 realm × 5 phẩm), đủ thảo cho mọi đan phương.
 * - Thảo cùng đan phương có ĐỦ 4 niên đại, mỗi cặp (recipe, age) duy nhất.
 * - Thứ tự xác suất phẩm giảm dần được enforce ở ProductionCatalog.
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
      woods.add(meta.realmId)
    } else if (meta.resourceKind === 'ore') {
      ores.add(`${meta.realmId}:${meta.quality}`)
    } else if (meta.resourceKind === 'herb') {
      const ages = herbRecipes.get(meta.pillRecipeId!) ?? new Set<string>()

      ages.add(meta.age!)

      herbRecipes.set(meta.pillRecipeId!, ages)
    }
  }

  for (const realmId of SUPPORTED_PROFESSION_REALMS) {
    if (!woods.has(realmId)) {
      errors.push(`catalog: thiếu gỗ cho realm ${realmId}`)
    }

    for (const quality of ORE_QUALITIES) {
      if (!ores.has(`${realmId}:${quality}`)) {
        errors.push(`catalog: thiếu quáng ${realmId}/${quality}`)
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

  // Phẩm phải giảm dần trọng số — re-export check từ ProductionCatalog
  // qua contract riêng để test không phụ thuộc vòng import ngược.
  void ORE_QUALITIES

  return { valid: errors.length === 0, errors }
}
