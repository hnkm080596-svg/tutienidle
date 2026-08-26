// 1 building cụ thể người chơi đã xây. KHÔNG lưu `storedAmount` trực
// tiếp — sản lượng tích luỹ hoàn toàn tính được từ `lastCollectedAt` +
// thời gian hiện tại (pattern giống ActiveExploration.startedAt — thuần
// hàm, không cần tick liên tục để cấp nhật state) — xem
// BuildingSystem.getStoredAmount().
//
// (2026-08-25, resource-professions-rework plan §2) — bỏ gardenPlots/
// processingJobs: vòng sản xuất chuyển sang ProductionSystem, building
// trung gian đã bị loại bỏ.
export interface BuildingInstance {
  instanceId: string

  buildingId: string

  level: number

  // Mốc thời gian lần thu hoạch gần nhất (hoặc lúc xây, nếu chưa thu
  // hoạch lần nào) — dùng tính sản lượng đã tích luỹ, kể cả khi offline
  // (xem MASTER SPEC Mục VII).
  lastCollectedAt: number
}
