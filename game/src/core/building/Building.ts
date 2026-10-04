import type { BuildingCategory } from './BuildingCategory'
import type { BuildingLevelDef } from './BuildingLevelEffect'

export interface BuildingUpgradeCost {
  materialId: string

  amount: number
}

// BUILDing spec muc 22 (Function Entry) - Building nao MO TRUC TIEP
// 1 Function UI khi click thi set field nay khop dung LeftPanelMode
// cua panel do (xem stores/ui.ts). Khong import LeftPanelMode thang
// tu stores/ui.ts vao core/ (core khong phu thuoc tang store) - dinh
// nghia lai union con o day, chi cac gia tri that su can.
//
// (2026-08-25, resource-professions-rework plan sec2/sec10.1) - bo
// 'formation_altar'/'talisman_institute': Phu/Tran khai tu khoi vong
// kinh te hien tai. Production sites (Lam/Quang/Dong Thien) KHONG con
// la building - chuyen sang core/production.
export type BuildingFunctionType =
  | 'pill_room'
  | 'equipment_hall'
  | 'stage_select'
  | 'exploration'
  | 'worker_lodge'
  | 'vendor'

/**
 * Template tinh (registry entry) - sau rework 2026-08-25 chi con 2 loai:
 * resource (Linh Tuyen sinh Linh Thach) va crafting_station/gate.
 * Vong san xuat nguyen lieu chuyen hoan toan sang ProductionSite.
 */
export interface Building {
  id: string

  name: string

  description?: string

  category: BuildingCategory

  // Tier tong the (mo khoa theo canh gioi, tuong tu Recipe.requiredRealmId).
  tier: number

  maxLevel: number

  // Resource building - san xuat material truc tiep theo thoi gian
  // (don vi: material/giay o level 1). KHONG set = khong phai
  // resource building. Linh Tuyen set producesMaterialId:
  // SPIRIT_STONE_MATERIAL_ID (plan Workstream F) - thu hoach do thang
  // vao MaterialBag thay vi currency rieng.
  producesMaterialId?: string

  baseProductionRate?: number

  // Suc chua toi da o level 1 - Storage day = Production Paused
  // (MASTER SPEC Muc VII), xem BuildingSystem.getStoredAmount().
  baseStorageCapacity: number

  // Chi phi XAY DUNG + tung luot NANG CAP - index 0 = chi phi xay
  // (level 0->1), index i (i>=1) = chi phi nang tu level i len i+1.
  // Sink chinh cua Go tu Lam (plan sec5.2).
  upgradeCost: BuildingUpgradeCost[][]

  requiredRealmId?: string

  // BUILDing spec muc 3-4 - upgrade tree RIENG cho building nay (level
  // -> effects[]), CHI dung cho category 'crafting_station'.
  levels?: BuildingLevelDef[]

  /** So nhan cong tu dong toan cuc duoc cap o moi level. */
  workersPerLevel?: number

  // BUILDing spec muc 5/22 - click Building nay (qua NavMenuOverlay)
  // mo PANEL nao. Chi crafting_station moi set.
  functionType?: BuildingFunctionType
}
