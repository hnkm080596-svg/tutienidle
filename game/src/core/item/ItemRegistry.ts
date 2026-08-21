import type { Item } from './Item'
import { EquipmentRegistry } from '../equipment/EquipmentRegistry'
import { PillRegistry } from '../pill/PillRegistry'
import { TalismanRegistry } from '../talisman/TalismanRegistry'
import { MaterialRegistry } from '../material/MaterialRegistry'

/**
 * Facade tra cứu item theo id trên toàn bộ 4 hệ thống con
 * (equipment/pill/talisman/material) mà không cần biết trước item
 * thuộc loại nào — chỗ duy nhất "quản lý toàn bộ Item của game".
 * Từng hệ thống con vẫn giữ registry/inventory riêng, ItemRegistry
 * không thay thế mà chỉ gộp lại một điểm tra cứu chung.
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
