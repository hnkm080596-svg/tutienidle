/**
 * "Con đường bình thường" của Đột Phá tổng quát (2026-08-16) — khác
 * hẳn cơ chế ẨN của FoundationResolver.ts (âm thầm xét Căn Cơ, không
 * bao giờ lộ điều kiện): field này lộ CÔNG KHAI cho người chơi qua
 * BreakthroughRequirementPanel.vue trước khi vào Độ Kiếp. Áp dụng cho
 * MỌI đại cảnh giới cần Đột Phá (Phàm Nhân không có mặt ở đây — nghi
 * lễ riêng là chọn Pháp Tu/Kiếm Tu, xem GameManager.chooseCultivationPath()).
 *
 * Mỗi cảnh giới chỉ cần sở hữu ĐÚNG 1 vật phẩm "Đột Phá Lệnh" của
 * chính nó (xem data/materials/materials.ts) — luyện được bằng Linh
 * Thạch qua GameManager.craftBreakthroughToken(), không cần nguyên
 * liệu nào khác (tránh phải dựng cả 1 chuỗi kinh tế mới cho 8 cảnh
 * giới chưa có nội dung farm nào).
 */
export interface BreakthroughRequirement {
  materialId: string

  spiritStoneCost: number
}

export const BREAKTHROUGH_REQUIREMENTS: Record<string, BreakthroughRequirement> = {
  // economy-fixes-sinks-plan §3.2 B1 (2026-08-29) — re-anchor sink Linh
  // Thạch cho gate đột phá: baseline 500 (Trúc Cơ — GATE THẬT DUY NHẤT
  // hiện chơi được, content kết thúc ở Trúc Cơ), ×4 mỗi cảnh giới kế
  // (data hàm mũ đặt sẵn cho mọi gate — Kim Đan+ hiện chưa reachable
  // trong game nhưng giữ entry để scale khi mở). Kim Đan M2/M3 đã bỏ
  // khỏi roadmap — xem roadmap.md section 5.
  foundation_establishment: { materialId: 'breakthrough_token_foundation_establishment', spiritStoneCost: 500 },
  golden_core: { materialId: 'breakthrough_token_golden_core', spiritStoneCost: 2000 },
  nascent_soul: { materialId: 'breakthrough_token_nascent_soul', spiritStoneCost: 8000 },
  soul_transformation: { materialId: 'breakthrough_token_soul_transformation', spiritStoneCost: 32000 },
  void_refinement: { materialId: 'breakthrough_token_void_refinement', spiritStoneCost: 128000 },
  body_integration: { materialId: 'breakthrough_token_body_integration', spiritStoneCost: 512000 },
  mahayana: { materialId: 'breakthrough_token_mahayana', spiritStoneCost: 2048000 },
  tribulation: { materialId: 'breakthrough_token_tribulation', spiritStoneCost: 8192000 },
}
