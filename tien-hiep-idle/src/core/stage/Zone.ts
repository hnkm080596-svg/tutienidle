// Thám Hiểm rework (2026-08-14) — "Địa Giới", nhóm nhiều Stage ("Màn")
// lại thành 1 vùng bản đồ lớn, thường ứng với 1 đại cảnh giới
// (requiredRealmId, cùng convention getRealmIndex() đã dùng ở Recipe/
// Building/Equipment). Màn hình chọn màn (StageSelectPanel.vue) đi
// qua đúng 2 tầng: chọn Địa Giới → chọn Màn trong `stageIds` (thứ tự
// mảng = thứ tự Màn, dùng cho Tự Động Thám Hiểm leo tầng — xem
// GameManager.getNextStageInZone()).
export interface Zone {
  id: string

  name: string

  requiredRealmId?: string

  stageIds: string[]
}
