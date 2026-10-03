// Tham Hiem rework (2026-08-14) - "Dia Gioi", nhom nhieu Stage ("Man")
// lai thanh 1 vung ban do lon, thuong ung voi 1 dai canh gioi
// (requiredRealmId, cung convention getRealmIndex() da dung o Recipe/
// Building/Equipment). Man hinh chon man (StageSelectPanel.vue) di
// qua dung 2 tang: chon Dia Gioi -> chon Man trong `stageIds` (thu tu
// mang = thu tu Man, dung cho Tu Dong Tham Hiem leo tang - xem
// GameManager.getNextStageInZone()).
export interface Zone {
  id: string

  name: string

  requiredRealmId?: string

  stageIds: string[]
}
