/**
 * Bảng thuật ngữ chuẩn (terminology glossary) — i18n refactor Task 10
 * (plan docs/superpowers/plans/2026-08-31-i18n-string-refactor.md).
 *
 * Nguồn sự thật (source of truth) cho các thuật ngữ level/tier/damage
 * chống trôi từ ngữ (Cấp/Tầng/Bậc lẫn lộn, Sát Thương/ST, hoa thường
 * không đều). Components CHƯA bắt buộc import — giá trị trong
 * locales/vi.json phải AGREE với bảng này; khi thêm chuỗi mới, tra bảng
 * trước khi viết chữ.
 *
 * Quy ước hoa (vi): Title Case khi chữ là label/tiêu đề hoặc đứng một
 * mình ("Tầng", "Chỉ Số"); viết thường giữa câu ("cần Phàm Nhân tầng 3",
 * "sát thương nhận vào").
 */
export const TERMS = {
  // level/tier
  skillLevel: 'Cấp', // level skill/node/công trình — tự nâng được
  realmLevel: 'Tầng', // tầng trong 1 cảnh giới (player.realmLevel 1-18)
  itemTier: 'Bậc', // bậc xếp loại/thưởng (Bậc Nhập Đạo, bậc đột phá)
  // damage
  damage: 'Sát Thương', // đủ chữ
  damageAbbrev: 'ST', // bảng hẹp ("ST bạo kích")
  // stat
  stat: 'Chỉ Số', // tiêu đề bảng/section
  // attack/defense
  attack: 'Công Kích',
  defense: 'Phòng Thủ', // tiêu đề tab/section ("Phòng Thủ & Sinh Tồn")
  // bổ sung từ audit Task 10
  realm: 'Cảnh Giới', // đại cảnh giới (Phàm Nhân/Luyện Khí/Trúc Cơ…)
  grade: 'Phẩm', // phẩm pháp bảo/nguyên liệu (Phàm Phẩm…, "Đổi Phẩm")
} as const

export type TermKey = keyof typeof TERMS

export function term(key: TermKey): string {
  return TERMS[key]
}
