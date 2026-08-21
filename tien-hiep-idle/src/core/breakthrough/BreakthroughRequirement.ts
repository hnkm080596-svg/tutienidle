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
  foundation: { materialId: 'breakthrough_token_foundation', spiritStoneCost: 200 },
  golden_core: { materialId: 'breakthrough_token_golden_core', spiritStoneCost: 2000 },
  nascent_soul: { materialId: 'breakthrough_token_nascent_soul', spiritStoneCost: 20000 },
  soul_transformation: { materialId: 'breakthrough_token_soul_transformation', spiritStoneCost: 200000 },
  void_refinement: { materialId: 'breakthrough_token_void_refinement', spiritStoneCost: 2000000 },
  body_integration: { materialId: 'breakthrough_token_body_integration', spiritStoneCost: 20000000 },
  mahayana: { materialId: 'breakthrough_token_mahayana', spiritStoneCost: 200000000 },
  tribulation: { materialId: 'breakthrough_token_tribulation', spiritStoneCost: 2000000000 },
}
