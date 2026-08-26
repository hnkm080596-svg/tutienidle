// Validator dữ liệu nghề (2026-08-25, plan §5/§6) — lỗi authoring fail
// ngay: id convention từng kind, phẩm Quáng hợp lệ, niên đại thảo hợp
// lệ, catalog đầy đủ (3 gỗ / 15 quáng / 12 đan phương × 4 tuổi).
import { describe, expect, it } from 'vitest'
import {
  validateProfessionMaterialCatalog,
  validateProfessionMaterialEntry,
} from './ProfessionValidators'
import { SUPPORTED_PROFESSION_REALMS, type ProfessionMaterialMeta } from './ProfessionMaterial'
import { HERB_AGES, ORE_QUALITIES } from '../production/ProductionTypes'

function woodEntry(realmId: string): { id: string; profession: ProfessionMaterialMeta } {
  return { id: `${realmId}_wood`, profession: { resourceKind: 'wood', realmId } }
}

function oreEntry(realmId: string, quality: string): { id: string; profession: ProfessionMaterialMeta } {
  return {
    id: `${realmId}_ore_${quality}`,
    profession: { resourceKind: 'ore', realmId, quality },
  }
}

function herbEntry(
  baseId: string,
  realmId: string,
  age: string,
  recipeId: string,
): { id: string; profession: ProfessionMaterialMeta } {
  return {
    id: `${baseId}_${age}`,
    profession: { resourceKind: 'herb', realmId, age, pillRecipeId: recipeId, herbBaseId: baseId },
  }
}

describe('validateProfessionMaterialEntry — boot validator', () => {
  it('gỗ đúng convention → pass', () => {
    expect(validateProfessionMaterialEntry('mortal_wood', { resourceKind: 'wood', realmId: 'mortal' })).toBeNull()
  })

  it('gỗ sai id → fail', () => {
    expect(
      validateProfessionMaterialEntry('mortal_wood_common', {
        resourceKind: 'wood',
        realmId: 'mortal',
      }),
    ).not.toBeNull()
  })

  it('quáng thiếu phẩm → fail', () => {
    expect(
      validateProfessionMaterialEntry('mortal_ore_hoang', { resourceKind: 'ore', realmId: 'mortal' }),
    ).not.toBeNull()
  })

  it('quáng phẩm lạ → fail', () => {
    expect(
      validateProfessionMaterialEntry('mortal_ore_cuc', {
        resourceKind: 'ore',
        realmId: 'mortal',
        quality: 'cuc',
      }),
    ).not.toBeNull()
  })

  it('quáng id lệch phẩm → fail (id phải khớp <realm>_ore_<quality>)', () => {
    expect(
      validateProfessionMaterialEntry('mortal_ore_hoang', {
        resourceKind: 'ore',
        realmId: 'mortal',
        quality: 'huyen',
      }),
    ).not.toBeNull()
  })

  it('thảo thiếu đan phương → fail', () => {
    expect(
      validateProfessionMaterialEntry('huyet_tham_decade', {
        resourceKind: 'herb',
        realmId: 'mortal',
        age: 'decade',
      }),
    ).not.toBeNull()
  })

  it('realm ngoài scope → fail', () => {
    expect(
      validateProfessionMaterialEntry('golden_core_wood', {
        resourceKind: 'wood',
        realmId: 'golden_core',
      }),
    ).not.toBeNull()
  })
})

describe('validateProfessionMaterialCatalog — completeness', () => {
  function fullCatalog(): Array<{ id: string; profession: ProfessionMaterialMeta }> {
    const entries: Array<{ id: string; profession: ProfessionMaterialMeta }> = []

    for (const realmId of SUPPORTED_PROFESSION_REALMS) {
      entries.push(woodEntry(realmId))

      for (const quality of ORE_QUALITIES) {
        entries.push(oreEntry(realmId, quality))
      }

      for (let effect = 0; effect < 4; effect++) {
        const baseId = `thao_${realmId}_${effect}`

        for (const age of HERB_AGES) {
          entries.push(herbEntry(baseId, realmId, age, `alchemy_pill_${effect}_${realmId}`))
        }
      }
    }

    return entries
  }

  it('catalog đầy đủ chuẩn → pass không lỗi', () => {
    const result = validateProfessionMaterialCatalog(fullCatalog())

    expect(result.errors).toEqual([])

    expect(result.valid).toBe(true)
  })

  it('thiếu 1 gỗ → fail kèm lỗi rõ ràng', () => {
    const entries = fullCatalog().filter((entry) => entry.id !== 'qi_refining_wood')

    const result = validateProfessionMaterialCatalog(entries)

    expect(result.valid).toBe(false)

    expect(result.errors.some((error) => error.includes('qi_refining'))).toBe(true)
  })

  it('thiếu niên đại của một đan phương → fail', () => {
    const entries = fullCatalog().filter((entry) => entry.id !== 'thao_mortal_0_myriad_year')

    const result = validateProfessionMaterialCatalog(entries)

    expect(result.valid).toBe(false)

    expect(result.errors.some((error) => error.includes('myriad_year'))).toBe(true)
  })

  it('legacy material KHÔNG meta được bỏ qua (không fail)', () => {
    const result = validateProfessionMaterialCatalog([
      { id: 'linh_chi' },
      ...fullCatalog(),
    ] as never)

    expect(result.valid).toBe(true)
  })
})
