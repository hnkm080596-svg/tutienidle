import { describe, expect, it } from 'vitest'
import {
  buildProfessionMaterialId,
  herbBaseId,
  herbMaterialId,
} from './ProfessionMaterial'
import { materials } from '../../data/materials/materials'

// Mission G Task 32 — one constructor owns the `<realm>_wood|ore_<age>`
// and `<herbId>_<realm>` / `<herbBase>_<age>` id grammars; every producer
// routes through it.
describe('buildProfessionMaterialId', () => {
  it('builds wood/ore ids on the shared age axis', () => {
    expect(buildProfessionMaterialId('wood', 'qi_refining', 'decade')).toBe(
      'qi_refining_wood_decade',
    )
    expect(buildProfessionMaterialId('ore', 'mortal', 'myriad_year')).toBe(
      'mortal_ore_myriad_year',
    )
  })
})

describe('herb id helpers', () => {
  it('builds base and variant ids', () => {
    expect(herbBaseId('tu_linh_thao', 'qi_refining')).toBe('tu_linh_thao_qi_refining')
    expect(herbMaterialId('tu_linh_thao_qi_refining', 'century')).toBe(
      'tu_linh_thao_qi_refining_century',
    )
  })
})

describe('generated catalog parity', () => {
  it('constructed ids still land in the material registry data', () => {
    const ids = new Set(materials.map((material) => material.id))

    expect(ids.has('qi_refining_wood_decade')).toBe(true)
    expect(ids.has('foundation_establishment_ore_thuong_co')).toBe(true)
    expect(ids.has('tu_linh_thao_qi_refining_century')).toBe(true)
  })
})
