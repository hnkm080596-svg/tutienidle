/**
 * 1 building cụ thể người chơi đã xây — KHÔNG lưu `storedAmount` trực
 * tiếp (khác EquipmentInstance có state phức tạp hơn nhiều) vì sản
 * lượng tích luỹ hoàn toàn tính được từ `lastCollectedAt` + thời gian
 * hiện tại (pattern giống hệt ActiveExploration.startedAt — thuần
 * hàm, không cần tick liên tục để cập nhật state) — xem
 * BuildingSystem.getStoredAmount().
 */
import type { GardenPlotState } from './GardenPlot'

export interface BuildingInstance {
  instanceId: string

  buildingId: string

  level: number

  // Mốc thời gian lần thu hoạch gần nhất (hoặc lúc xây, nếu chưa thu
  // hoạch lần nào) — dùng tính sản lượng đã tích luỹ, kể cả khi
  // offline (xem MASTER SPEC Mục VII).
  lastCollectedAt: number

  // Linh Thảo Viên rework — CHỈ building có Building.gardenSeedMaterialId
  // mới dùng field này (xem GardenSystem.ts). undefined = chưa gieo ô
  // nào (tương đương toàn bộ ô đang trống) — GardenSystem tự coi thiếu
  // field này như mảng rỗng, không cần khởi tạo sẵn 9 phần tử lúc build().
  gardenPlots?: GardenPlotState[]
}
