// EquipmentOperationCostCatalog (2026-08-25, resource-professions-rework
// plan §7) — sau rework Khí Đường chỉ còn BỐN operation public; trong
// đó chỉ Cường Hóa dùng cost catalog (Tẩy/Tinh/Hóa có cost riêng theo
// RefinementBalance + tham số người chơi chọn).
//
// Cường Hóa (§7.1): cost chuyển sang Quáng CÙNG cảnh giới mục tiêu +
// Linh Thạch. Baseline để playtest chỉnh tại đây.
import type { RecipeMaterialCost } from './Equipment'
import { SUPPORTED_PROFESSION_REALMS } from '../profession/ProfessionMaterial'

export type EquipmentOperation = 'enhance'

export interface EquipmentOperationCost {
  materials: RecipeMaterialCost[]

  /** Linh Thạch (currency player.spiritStone) — undefined = không tốn. */
  spiritStone?: number
}

export interface EquipmentOperationCostContext {
  /** Enhance band — scale theo level như getScaledCost hiện có. */
  enhanceLevel?: number
}

export interface EquipmentOperationCostEntry {
  operation: EquipmentOperation

  /** Realm CỦA ITEM bị tác động. */
  realmId: string

  cost: EquipmentOperationCost
}

export class EquipmentOperationCostCatalog {
  private readonly entries = new Map<string, EquipmentOperationCost>()

  constructor(entries: EquipmentOperationCostEntry[]) {
    for (const entry of entries) {
      const key = `${entry.operation}:${entry.realmId}`

      if (this.entries.has(key)) {
        throw new Error(`Equipment operation cost already registered: ${key}`)
      }

      this.entries.set(key, entry.cost)
    }
  }

  resolve(
    operation: EquipmentOperation,
    realmId: string,
    _context: EquipmentOperationCostContext = {},
  ): EquipmentOperationCost | undefined {
    return this.entries.get(`${operation}:${realmId}`)
  }
}

/** Catalog mặc định product scope: enhance × 3 realm Thanh Vân. */
export function createDefaultEquipmentOperationCostCatalog(): EquipmentOperationCostCatalog {
  const entries: EquipmentOperationCostEntry[] = []

  for (const realmId of SUPPORTED_PROFESSION_REALMS) {
    entries.push({
      operation: 'enhance',

      realmId,

      // Sink Quáng Thập Niên (`ore_decade`, gp123 6E C2) + Linh Thạch — scale theo enhance level.
      cost: {
        materials: [{ materialId: `${realmId}_ore_decade`, amount: 2 }],

        spiritStone: 50,
      },
    })
  }

  return new EquipmentOperationCostCatalog(entries)
}
