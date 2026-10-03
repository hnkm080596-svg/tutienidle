// 1 building cu the nguoi choi da xay. KHONG luu `storedAmount` truc
// tiep - san luong tich luy hoan toan tinh duoc tu `lastCollectedAt` +
// thoi gian hien tai (pattern giong ActiveExploration.startedAt - thuan
// ham, khong can tick lien tuc de cap nhat state) - xem
// BuildingSystem.getStoredAmount().
//
// (2026-08-25, resource-professions-rework plan sec2) - bo gardenPlots/
// processingJobs: vong san xuat chuyen sang ProductionSystem, building
// trung gian da bi loai bo.
export interface BuildingInstance {
  instanceId: string

  buildingId: string

  level: number

  // Moc thoi gian lan thu hoach gan nhat (hoac luc xay, neu chua thu
  // hoach lan nao) - dung tinh san luong da tich luy, ke ca khi offline
  // (xem MASTER SPEC Muc VII).
  lastCollectedAt: number

  // EM-01 - realm the CURRENT accrual window runs under. Pinned at
  // build/claim; realm only grows so a mid-window breakthrough cannot
  // retroactively reprice the whole backlog at the new rate.
  // undefined (old save) -> current-realm fallback = old behavior.
  accrualRealmId?: string
}
