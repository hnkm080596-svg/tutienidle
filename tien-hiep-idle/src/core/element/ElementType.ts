// Pháp Tu Redesign (magicpath, 2026-08-18) — Ngũ Hành (wood/fire/earth/
// metal/water) + Phong/Lôi (wind/lightning), NGANG HÀNG nhau về mặt
// gameplay architecture (cùng 1 ElementDefinition/StatType/DamageCalculator
// — không tạo hệ thống riêng cho Phong/Lôi). Khác biệt DUY NHẤT là điều
// kiện unlock: Phong/Lôi chỉ mở được từ Nguyên Anh trở lên — đó là gate
// ở tầng progression (xem core/element/ElementDefinition.ts), KHÔNG phải
// giới hạn ở type này.
export type ElementType =
  | 'wood'
  | 'fire'
  | 'earth'
  | 'metal'
  | 'water'
  | 'wind'
  | 'lightning'
