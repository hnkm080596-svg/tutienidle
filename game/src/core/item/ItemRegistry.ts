import type { Item } from './Item'
import { EquipmentRegistry } from '../equipment/EquipmentRegistry'
import { PillRegistry } from '../pill/PillRegistry'
import { TalismanRegistry } from '../talisman/TalismanRegistry'
import { MaterialRegistry } from '../material/MaterialRegistry'

/**
 * Facade tra cuu item theo id tren toan bo 4 he thong con
 * (equipment/pill/talisman/material) ma khong can biet truoc item
 * thuoc loai nao - cho duy nhat "quan ly toan bo Item cua game".
 * Tung he thong con van giu registry/inventory rieng, ItemRegistry
 * khong thay the ma chi gop lai mot diem tra cuu chung.
 */
export class ItemRegistry {
  constructor(
    private readonly equipment: EquipmentRegistry,
    private readonly pills: PillRegistry,
    private readonly talismans: TalismanRegistry,
    private readonly materials: MaterialRegistry,
  ) {}

  get(itemId: string): Item | undefined {
    if (this.equipment.has(itemId)) {
      return { category: 'equipment', item: this.equipment.get(itemId) }
    }

    if (this.pills.has(itemId)) {
      return { category: 'pill', item: this.pills.get(itemId) }
    }

    if (this.talismans.has(itemId)) {
      return { category: 'talisman', item: this.talismans.get(itemId) }
    }

    if (this.materials.has(itemId)) {
      return { category: 'material', item: this.materials.get(itemId) }
    }

    return undefined
  }

  has(itemId: string): boolean {
    return this.get(itemId) !== undefined
  }

  getAll(): Item[] {
    return [
      ...this.equipment.getAll().map(item => ({ category: 'equipment' as const, item })),
      ...this.pills.getAll().map(item => ({ category: 'pill' as const, item })),
      ...this.talismans.getAll().map(item => ({ category: 'talisman' as const, item })),
      ...this.materials.getAll().map(item => ({ category: 'material' as const, item })),
    ]
  }
}
