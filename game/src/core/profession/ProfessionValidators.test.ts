// Validator dữ liệu nghề (2026-08-25, plan §5/§6) — lỗi authoring fail
// ngay: id convention từng kind, tuổi gỗ/khoáng hợp lệ, niên đại thảo hợp
// lệ, catalog đầy đủ (gỗ/khoáng 3 realm × 5 tuổi / 12 đan phương × 5 tuổi).
// gp123 6E (task C2): gỗ/khoáng dùng trục tuổi thống nhất.
import { describe, expect, it } from 'vitest'
import {
  validateProfessionMaterialCatalog,
  validateProfessionMaterialEntry,
} from './ProfessionValidators'
import { SUPPORTED_PROFESSION_REALMS, type ProfessionMaterialMeta } from './ProfessionMaterial'
import { HERB_AGES, type HerbAge } from '../production/ProductionTypes'

function woodEntry(realmId: string, age: HerbAge): { id: string; profession: ProfessionMaterialMeta } {
  return { id: `${realmId}_wood_${age}`, profession: { resourceKind: 'wood', realmId, age } }
}

function oreEntry(realmId: string, age: HerbAge): { id: string; profession: ProfessionMaterialMeta } {
  return {
    id: `${realmId}_ore_${age}`,
    profession: { resourceKind: 'ore', realmId, age },
  }
}

function herbEntry(
  baseId: string,
  realmId: string,
  age: HerbAge,
  recipeId: string,
): { id: string; profession: ProfessionMaterialMeta } {
  return {
    id: `${baseId}_${age}`,
    profession: { resourceKind: 'herb', realmId, age, pillRecipeId: recipeId, herbBaseId: baseId },
  }
}

describe('validateProfessionMaterialEntry — boot validator', () => {
  it('gỗ đúng convention → pass', () => {
    expect(
      validateProfessionMaterialEntry('mortal_wood_decade', {
        resourceKind: 'wood',
        realmId: 'mortal',
        age: 'decade',
      }),
    ).toBeNull()
  })

  it('gỗ sai id → fail', () => {
    expect(
      validateProfessionMaterialEntry('mortal_wood_common', {
        resourceKind: 'wood',
        realmId: 'mortal',
        age: 'decade',
      }),
    ).not.toBeNull()
  })

  it('plain gỗ (không age) → fail (gp123 6E C2: plain wood đã xóa)', () => {
    expect(
      validateProfessionMaterialEntry('mortal_wood', {
        resourceKind: 'wood',
        realmId: 'mortal',
      }),
    ).not.toBeNull()
  })

  it('khoáng thiếu age → fail', () => {
    expect(
      validateProfessionMaterialEntry('mortal_ore_decade', { resourceKind: 'ore', realmId: 'mortal' }),
    ).not.toBeNull()
  })

  it('khoáng age lạ → fail', () => {
    expect(
      validateProfessionMaterialEntry('mortal_ore_cuc', {
        resourceKind: 'ore',
        realmId: 'mortal',
        age: 'cuc' as never,
      }),
    ).not.toBeNull()
  })

  it('khoáng id lệch tuổi → fail (id phải khớp <realm>_ore_<age>)', () => {
    expect(
      validateProfessionMaterialEntry('mortal_ore_decade', {
        resourceKind: 'ore',
        realmId: 'mortal',
        age: 'century',
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

  it('realm không hợp lệ → fail', () => {
    expect(
      validateProfessionMaterialEntry('unknown_realm_wood_decade', {
        resourceKind: 'wood',
        realmId: 'unknown_realm',
        age: 'decade',
      }),
    ).not.toBeNull()
  })
})

describe('validateProfessionMaterialCatalog — completeness', () => {
  function fullCatalog(): Array<{ id: string; profession: ProfessionMaterialMeta }> {
    const entries: Array<{ id: string; profession: ProfessionMaterialMeta }> = []

    for (const realmId of SUPPORTED_PROFESSION_REALMS) {
      for (const age of HERB_AGES) {
        entries.push(woodEntry(realmId, age))

        entries.push(oreEntry(realmId, age))
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
    const entries = fullCatalog().filter((entry) => entry.id !== 'qi_refining_wood_decade')

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
