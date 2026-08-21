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
// 'stage_select'/'exploration' thêm ở rework "Truyền Tống Trận"/"Khai
// Thác" (2026-08-14) — Thám Hiểm (combat) và Tầm Bảo (gather) giờ
// cũng là Building thật, gate y hệt Tứ Nghệ, chỉ khác KHÔNG set
// `levels` (không có craft modifier nào áp dụng cho 2 Building này).
export type BuildingFunctionType =
  | 'pill_room' | 'formation_altar' | 'talisman_institute' | 'equipment_hall'
  | 'stage_select' | 'exploration'

/**
 * Template tĩnh (registry entry) — 1 building có thể xây NHIỀU
 * instance khác nhau (vd 2 Herb Garden), giống Equipment. Level/
 * Production Rate/Storage Capacity/Processing Speed đều SCALE THEO
 * LEVEL của từng instance (xem BuildingSystem.ts) — field ở đây chỉ
 * là giá trị BASE (level 1).
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
  // resource building (Processing dùng processingRecipeId, xem
  // Phase 5's ProcessingRecipe.ts).
  producesMaterialId?: string

  baseProductionRate?: number

  // Sức chứa tối đa ở level 1 — Storage đầy = Production Paused
  // (MASTER SPEC Mục VII), xem BuildingSystem.getStoredAmount().
  baseStorageCapacity: number

  // Processing building — tốc độ xử lý ở level 1 (hệ số nhân,
  // 1 = chuẩn) — xem Phase 5.
  processingRecipeId?: string

  baseProcessingSpeed?: number

  // Khai Thác/Thiết Khoáng Sơn rework (2026-08-15) — sản lượng
  // (baseProductionRate/baseStorageCapacity ở trên) đổ THẲNG vào
  // player.spiritStone thay vì materialBag khi thu hoạch (xem
  // BuildingSystem.claim()) — Linh Tuyền dùng field này, KHÔNG set
  // producesMaterialId (2 kiểu output loại trừ nhau).
  producesSpiritStone?: boolean

  // Linh Thảo Viên rework — building "vườn": 9 ô vuông (GARDEN_PLOT_COUNT,
  // xem GardenSystem.ts), mỗi level building mở thêm đúng 1 ô (ô unlock
  // = index < instance.level). Gieo 1 gardenSeedMaterialId vào ô trống
  // đã mở khoá, chờ gardenGrowSeconds rồi thu hoạch ra
  // gardenYieldMaterialId x gardenYieldAmount. Set field này = building
  // KHÔNG dùng producesMaterialId/processingRecipeId (3 kiểu building
  // loại trừ nhau).
  gardenSeedMaterialId?: string

  gardenGrowSeconds?: number

  gardenYieldMaterialId?: string

  gardenYieldAmount?: number

  // Chi phí XÂY DỰNG + từng lượt NÂNG CẤP — index 0 = chi phí xây
  // (level 0→1), index i (i≥1) = chi phí nâng từ level i lên i+1.
  upgradeCost: BuildingUpgradeCost[][]

  requiredRealmId?: string

  // BUILDing spec mục 3-4 — upgrade tree RIÊNG cho building này (level
  // → effects[]), CHỈ dùng cho category 'crafting_station'. Không set
  // = building dùng công thức generic cũ (LEVEL_BONUS_PER_LEVEL trong
  // BuildingSystem.ts) — building resource/processing hiện có
  // (herb_garden/linh_tuyen/smelter) KHÔNG set field này, không đổi gì.
  levels?: BuildingLevelDef[]

  // BUILDing spec mục 5/22 — click Building này (qua NavMenuOverlay)
  // mở PANEL nào. Chỉ crafting_station mới set.
  functionType?: BuildingFunctionType
}
