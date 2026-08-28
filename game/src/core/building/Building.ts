import type { BuildingCategory } from './BuildingCategory'
import type { BuildingLevelDef } from './BuildingLevelEffect'

export interface BuildingUpgradeCost {
  materialId: string

  amount: number
}

// BUILDing spec mục 22 (Function Entry) — Building nào MỞ TRỰC TIẾP
// 1 Function UI khi click thì set field này khớp đúng LeftPanelMode
// của panel đó (xem stores/ui.ts). Không import LeftPanelMode thẳng
// từ stores/ui.ts vào core/ (core không phụ thuộc tầng store) — định
// nghĩa lại union con ở đây, chỉ các giá trị thật sự cần.
//
// (2026-08-25, resource-professions-rework plan §2/§10.1) — bỏ
// 'formation_altar'/'talisman_institute': Phù/Trận khai tử khỏi vòng
// kinh tế hiện tại. Production sites (Lâm/Quáng/Động Thiên) KHÔNG còn
// là building — chuyển sang core/production.
export type BuildingFunctionType =
  | 'pill_room'
  | 'equipment_hall'
  | 'stage_select'
  | 'exploration'
  | 'spirit_spring'

/**
 * Template tĩnh (registry entry) — sau rework 2026-08-25 chỉ còn 2 loại:
 * resource (Linh Tuyền sinh Linh Thạch) và crafting_station/gate.
 * Vòng sản xuất nguyên liệu chuyển hoàn toàn sang ProductionSite.
 */
export interface Building {
  id: string

  name: string

  description?: string

  category: BuildingCategory

  // Tier tổng thể (mở khoá theo cảnh giới, tương tự Recipe.requiredRealmId).
  tier: number

  maxLevel: number

  // Resource building — sản xuất material trực tiếp theo thời gian
  // (đơn vị: material/giây ở level 1). KHÔNG set = không phải
  // resource building. Linh Tuyền set producesMaterialId:
  // SPIRIT_STONE_MATERIAL_ID (plan Workstream F) — thu hoạch đổ thẳng
  // vào MaterialBag thay vì currency riêng.
  producesMaterialId?: string

  baseProductionRate?: number

  // Sức chứa tối đa ở level 1 — Storage đầy = Production Paused
  // (MASTER SPEC Mục VII), xem BuildingSystem.getStoredAmount().
  baseStorageCapacity: number

  // Chi phí XÂY DỰNG + từng lượt NÂNG CẤP — index 0 = chi phí xây
  // (level 0→1), index i (i≥1) = chi phí nâng từ level i lên i+1.
  // Sink chính của Gỗ từ Lâm (plan §5.2).
  upgradeCost: BuildingUpgradeCost[][]

  requiredRealmId?: string

  // BUILDing spec mục 3-4 — upgrade tree RIÊNG cho building này (level
  // → effects[]), CHỈ dùng cho category 'crafting_station'.
  levels?: BuildingLevelDef[]

  /** Số nhân công tự động toàn cục được cấp ở mỗi level. */
  workersPerLevel?: number

  // BUILDing spec mục 5/22 — click Building này (qua NavMenuOverlay)
  // mở PANEL nào. Chỉ crafting_station mới set.
  functionType?: BuildingFunctionType
}
