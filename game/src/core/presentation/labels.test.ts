import { describe, it, expect } from 'vitest'
import { materialLabel, SPIRIT_STONE_LABEL } from './labels'
import { MaterialRegistry } from '@/core/material/MaterialRegistry'
import { SPIRIT_STONE_MATERIAL_ID } from '@/core/material/SpiritStoneMaterial'

describe('SPIRIT_STONE_LABEL', () => {
  it('equals Vietnamese string "Linh Thạch"', () => {
    expect(SPIRIT_STONE_LABEL).toBe('Linh Thạch')
  })
})

describe('materialLabel', () => {
  it('returns registered material name for known id', () => {
    const registry = new MaterialRegistry()
    registry.register({
      id: 'test_herb',
      name: 'Linh Thảo',
      category: 'herb',
      sourceType: 'monster',
    })

    expect(materialLabel('test_herb', registry)).toBe('Linh Thảo')
  })

  it('returns UNKNOWN_DATA_LABEL for unregistered id', () => {
    const registry = new MaterialRegistry()

    expect(materialLabel('unknown_material', registry)).toBe('Dữ liệu không hợp lệ')
  })

  it('uses registry for spirit stone when registered', () => {
    const registry = new MaterialRegistry()
    registry.register({
      id: SPIRIT_STONE_MATERIAL_ID,
      name: 'Hạ phẩm Linh Thạch',
      category: 'spirit_stone',
      sourceType: 'building',
    })

    expect(materialLabel(SPIRIT_STONE_MATERIAL_ID, registry)).toBe('Hạ phẩm Linh Thạch')
  })
})
