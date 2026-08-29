// Nguồn sự thật duy nhất của version schema save — tách riêng để
// saveShapeValidation.ts import được mà KHÔNG tạo vòng circular với
// SaveSystem.ts (SaveSystem re-export lại cho mọi consumer cũ).
// v53 (2026-08-29, kiem-the-kiem-y spec): PlayerData.bossKillCount
// (tầng Kiếm Ý vĩnh viễn theo boss diệt), kiemTuRoute chốt vĩnh viễn
// lúc chọn path (gỡ setKiemTuRoute), gỡ skill Kiếm Tu cũ khỏi save
// (chuyển thành passive node — loadout mỗi route 1 skill), gỡ
// currentRage/rage resource. Save v52 bị từ chối (dev phase, không
// migration).
export const CURRENT_SAVE_VERSION = 53 as const
