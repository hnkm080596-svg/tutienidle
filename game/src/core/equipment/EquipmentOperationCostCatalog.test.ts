// EquipmentOperationCostCatalog (2026-08-25, plan §7): sau rework chỉ
// còn 'enhance' dùng cost catalog — Tẩy/Tinh/Hóa có cost riêng theo
// RefinementBalance; data-integrity cho material id mới.
import { describe, expect, it } from 'vitest'
import {
  createDefaultEquipmentOperationCostCatalog,
  EquipmentOperationCostCatalog,
} from './EquipmentOperationCostCatalog'

describe('EquipmentOperationCostCatalog', () => {
  it('enhance × 3 realm trong scope đều có cost; realm ngoài scope undefined', () => {
    const catalog = createDefaultEquipmentOperationCostCatalog()

    for (const realmId of ['mortal', 'qi_refining', 'foundation_establishment']) {
      const cost = catalog.resolve('enhance', realmId)

      expect(cost).toBeDefined()

      expect(cost!.materials.length).toBeGreaterThan(0)
    }

    expect(catalog.resolve('enhance', 'golden_core')).toBeUndefined()
  })

  it('mọi materialId trong cost tồn tại trong materials.ts (data-integrity)', async () => {
    const { materials } = await import('../../data/materials/materials')

    const materialIds = new Set(materials.map((material) => material.id))

    const catalog = createDefaultEquipmentOperationCostCatalog()

    for (const realmId of ['mortal', 'qi_refining', 'foundation_establishment']) {
      for (const entry of catalog.resolve('enhance', realmId)!.materials) {
        expect(materialIds.has(entry.materialId)).toBe(true)
      }
    }
  })

  it('Cường Hóa tiêu Quáng cùng realm (hoang) + Linh Thạch; trùng key → throw', () => {
    const catalog = createDefaultEquipmentOperationCostCatalog()

    const cost = catalog.resolve('enhance', 'mortal')!

    expect(cost.materials.some((entry) => entry.materialId === 'mortal_ore_hoang')).toBe(true)

    expect(cost.spiritStone).toBeGreaterThan(0)

    expect(
      () =>
        new EquipmentOperationCostCatalog([
          { operation: 'enhance', realmId: 'mortal', cost: { materials: [] } },
          { operation: 'enhance', realmId: 'mortal', cost: { materials: [] } },
        ]),
    ).toThrow(/already registered/)
  })
})
