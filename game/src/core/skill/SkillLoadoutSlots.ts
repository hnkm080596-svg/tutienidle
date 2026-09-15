// PLAN HOÀN CHỈNH mục 8 + Pháp Tu Đạo Sắc (spec 2026-08-30-phap-tu-dao-sac
// §6) — số ô Skill Loadout mở THEO BẢNG realm gate (thay công thức
// +1 mỗi 2 đại cảnh giới cũ). Mỗi mốc mở đúng 1 link chuỗi mới của
// Thuần hệ: Phàm Nhân 1 (Trảm), Luyện Khí/Trúc Cơ 2 (A+B), Kim Đan/
// Nguyên Anh 3 (+C), Hóa Thần→Đại Thừa 4 (+D), Độ Kiếp 5 (+E — đủ
// chuỗi). Nội dung hiện dừng ở Trúc Cơ nên thực tế chỉ A+B chơi được;
// C/D/E là data khóa realm chờ mở (pattern on-hit Kiếm Tu 5-9).
const REALM_SLOT_TABLE: Record<string, number> = {
  mortal: 1,
  qi_refining: 2,
  foundation_establishment: 2,
  golden_core: 3,
  nascent_soul: 3,
  soul_transformation: 4,
  void_refinement: 4,
  body_integration: 4,
  mahayana: 4,
  tribulation: 5,
}

export const MAX_SKILL_LOADOUT_SLOTS = 5

export function getSkillLoadoutSlotCount(realmId: string): number {
  // realmId không hợp lệ → 1 slot (hành vi an toàn cũ cho scheduler —
  // Trảm của Phàm Nhân luôn có slot 0).
  return REALM_SLOT_TABLE[realmId] ?? 1
}
