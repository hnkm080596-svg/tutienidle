// @vitest-environment node
// Materials economy rework (2026-10-11) - scope flag fail-closed:
// `equipmentOreDecompose` hidden -> KHONG gi phan giai duoc, ca 3 nhanh
// ore/wood/herb (list/preview rong, decompose false, bag nguyen).
import { describe, expect, it, vi } from 'vitest'

vi.mock('../betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => true,
}))

import { DecomposeSystem } from './DecomposeSystem'
import { MaterialBag } from '../material/MaterialBag'
import { materials } from '../../data/materials/materials'

function buildSystem(): {
  system: DecomposeSystem
  bag: MaterialBag
  delivered: Array<{ materialId: string; amount: number }>
} {
  const bag = new MaterialBag()
  for (const id of ['mortal_ore_decade', 'mortal_wood_decade', 'tu_linh_thao_mortal_decade']) {
    const material = materials.find((entry) => entry.id === id)
    if (!material) throw new Error(`materials fixture thiếu ${id}`)
    bag.add(material, 10)
  }
  const delivered: Array<{ materialId: string; amount: number }> = []
  const system = new DecomposeSystem(bag, {
    deliverOutput: (entry) => delivered.push(entry),
  })
  return { system, bag, delivered }
}

describe('DecomposeSystem — scope hidden fails closed (3 nhánh)', () => {
  it('list/preview/decompose đều rỗng; bag không bị trừ; không delivery', () => {
    const { system, bag, delivered } = buildSystem()
    const ids = ['mortal_ore_decade', 'mortal_wood_decade', 'tu_linh_thao_mortal_decade']

    expect(system.listDecomposableIds()).toEqual([])
    expect(system.previewDecompose(ids)).toEqual([])
    expect(system.decompose(ids)).toBe(false)

    expect(bag.getAmount('mortal_ore_decade')).toBe(10)
    expect(bag.getAmount('mortal_wood_decade')).toBe(10)
    expect(bag.getAmount('tu_linh_thao_mortal_decade')).toBe(10)
    expect(delivered).toEqual([])
  })
})
