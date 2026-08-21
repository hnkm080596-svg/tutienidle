// Linh Thảo Viên rework — state PERSIST của 1 ô vườn. `plantedAt`
// undefined = ô trống (chưa gieo) — trạng thái "đang lớn"/"đã chín"
// tính THUẦN HÀM từ plantedAt + Building.gardenGrowSeconds (giống
// pattern BuildingInstance.lastCollectedAt/ActiveExploration.startedAt,
// không cần tick liên tục để cập nhật), xem GardenSystem.ts.
export interface GardenPlotState {
  plantedAt?: number
}

export const GARDEN_PLOT_COUNT = 9
