// Nguồn sự thật duy nhất của version schema save — tách riêng để
// saveShapeValidation.ts import được mà KHÔNG tạo vòng circular với
// SaveSystem.ts (SaveSystem re-export lại cho mọi consumer cũ).
// v54 (2026-08-29, dot-pha-loi-kiep spec): 4 field PlayerData mới —
// openedMeridianIds (Bát Mạch đã thông), luyenKhiKillsSinceBeast (cửa
// sổ quái ẩn 1000 kill), mortalPerfectionAchieved (snapshot hoàn hảo
// Phàm Nhân chốt lúc Quán Khí), greatDaoOpportunityLost (thua kiếp Đại
// Đạo mất vĩnh viễn). Gỡ Đột Phá Lệnh (token materials) + quái Kiếp +
// TribulationSystem cũ (thay TribulationDirector chương kiếp).
// v55 (2026-09-02, chi-hien-quan spec): XÓA building spirit_spring
// (chức năng linh mạch chuyển vào gathering_outpost), THÊM building
// chi_hien_quan (nguồn nhân công duy nhất, capacity 1+level×2), thêm
// field productionSiteStates[].assignedWorkers (phân bổ nhân công
// manual). Save v54 bị từ chối (dev phase, không migration).
// v56 (2026-09-04, stage-auto-farm spec): 3 field PlayerData mới —
// perfectClearStageIds (stage đã đạt điều kiện Hoàn Mỹ),
// perfectClearSeconds (wall-clock giây lần đạt đầu tiên, dùng làm cơ
// sở cycleSeconds cho auto-farm), autoFarmStage (slot auto-farm đang
// chạy, null nếu không có). Save v55 bị từ chối (dev phase, không
// migration).
// v57 (2026-09-05, gp123 6E task C2 — unification of the age axes):
// material wood/ore đổi id sang trục tuổi thống nhất —
// `<realm>_wood_<age>` / `<realm>_ore_<age>` (age decade..thuong_co);
// plain `<realm>_wood` và hậu tố phẩm cũ hoang..tien KHÔNG TỒN TẠI nữa
// (meta profession.quality → profession.age). Save v56 bị từ chối (dev
// phase, không migration).
export const CURRENT_SAVE_VERSION = 57 as const
