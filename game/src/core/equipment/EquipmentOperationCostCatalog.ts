// EquipmentOperationCostCatalog (2026-08-25, resource-professions-rework
// plan sec7) - sau rework Khi Duong chi con BON operation public; trong
// do chi Cuong Hoa dung cost catalog (Tay/Tinh/Hoa co cost rieng theo
// RefinementBalance + tham so nguoi choi chon).
//
// Cuong Hoa (sec7.1): cost chuyen sang Quang CUNG canh gioi muc tieu +
// Linh Thach. Baseline de playtest chinh tai day.
import type { RecipeMaterialCost } from './Equipment'
import { SUPPORTED_PROFESSION_REALMS } from '../profession/ProfessionMaterial'
import { LUYEN_KHI_TINH_HOA_ID } from './TinhHoaMaterial'
import { stoneCostRealmFactor } from '../economy/EconomyRealmPace'

export type EquipmentOperation = 'enhance'

export interface EquipmentOperationCost {
  materials: RecipeMaterialCost[]

  /** Linh Thach (currency player.spiritStone) - undefined = khong ton. */
  spiritStone?: number
}

export interface EquipmentOperationCostContext {
  /** Enhance band - scale theo level nhu getScaledCost hien co. */
  enhanceLevel?: number
}

export interface EquipmentOperationCostEntry {
  operation: EquipmentOperation

  /** Realm CUA ITEM bi tac dong. */
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

/** Catalog mac dinh product scope: enhance x 3 realm Thanh Van. */
export function createDefaultEquipmentOperationCostCatalog(): EquipmentOperationCostCatalog {
  const entries: EquipmentOperationCostEntry[] = []

  for (const realmId of SUPPORTED_PROFESSION_REALMS) {
    entries.push({
      operation: 'enhance',

      realmId,

      // 2026-10-11 materials rework: Cuong Hoa burns Luyen Khi Tinh Hoa
      // (ore is now decompose-only per owner ruling) + Linh Thach.
      // Stone fee still scales with the item's realm income
      // (50 mortal / 400 qi / 2500 foundation per attempt) so the
      // per-floor upgrade grind still costs meaningful farming time.
      cost: {
        materials: [{ materialId: LUYEN_KHI_TINH_HOA_ID, amount: 2 }],

        spiritStone: 50 * stoneCostRealmFactor(realmId),
      },
    })
  }

  return new EquipmentOperationCostCatalog(entries)
}
