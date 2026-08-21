import type { AffixPool } from './Affix'

export type EquipmentQuality =
  | 'pham_khi'
  | 'bao_khi'
  | 'linh_khi'
  | 'phap_khi'
  | 'phap_bao'
  | 'tien_bao'
  | 'chi_bao'
  | 'hon_don_chi_bao'
  | 'thien_dia_trong_khi'

// Thứ tự từ thấp tới cao — dùng cho upgradeQuality() (Phase nâng
// phẩm) và roll trọng số lúc rớt đồ.
export const EQUIPMENT_QUALITY_ORDER: EquipmentQuality[] = [
  'pham_khi',
  'bao_khi',
  'linh_khi',
  'phap_khi',
  'phap_bao',
  'tien_bao',
  'chi_bao',
  'hon_don_chi_bao',
  'thien_dia_trong_khi',
]

// Trích từ EquipmentHallPanel.vue (2026-08-15, tooltip Equipment dùng
// chung).
export const EQUIPMENT_QUALITY_LABELS: Record<EquipmentQuality, string> = {
  pham_khi: 'Phàm Khí',
  bao_khi: 'Bảo Khí',
  linh_khi: 'Linh Khí',
  phap_khi: 'Pháp Khí',
  phap_bao: 'Pháp Bảo',
  tien_bao: 'Tiên Bảo',
  chi_bao: 'Chí Bảo',
  hon_don_chi_bao: 'Hỗn Độn Chí Bảo',
  thien_dia_trong_khi: 'Thiên Địa Trọng Khí',
}

// Core Loop Foundation checklist — Quality KHÔNG còn tự roll stat gì
// (đã thay bằng Affix System, xem Affix.ts) — giờ chỉ còn vai trò
// GATE: quyết định Tier Affix CAO NHẤT có thể roll/nâng cấp được trên
// 1 item, giống "item level" trong ARPG chuẩn. Cứ 2 bậc quality +1
// tier, 9 bậc chia đều chạm tier 5 (khớp thang tier Affix mẫu ở
// data/equipment/affixes.ts).
export const EQUIPMENT_QUALITY_MAX_AFFIX_TIER: Record<EquipmentQuality, number> = {
  pham_khi: 1,
  bao_khi: 1,
  linh_khi: 2,
  phap_khi: 2,
  phap_bao: 3,
  tien_bao: 3,
  chi_bao: 4,
  hon_don_chi_bao: 4,
  thien_dia_trong_khi: 5,
}

// Trọng số random khi rớt đồ — phẩm càng cao càng hiếm.
export const EQUIPMENT_QUALITY_DROP_WEIGHT: Record<EquipmentQuality, number> = {
  pham_khi: 40,
  bao_khi: 24,
  linh_khi: 14,
  phap_khi: 8,
  phap_bao: 6,
  tien_bao: 4,
  chi_bao: 2.5,
  hon_don_chi_bao: 1,
  thien_dia_trong_khi: 0.5,
}

// Equipment Rework (2026-08-14) — trần Forge Point (xem
// EquipmentSystem.forge()) theo Quality: phẩm càng cao, "tiềm năng"
// đầu tư vào món đồ càng lớn — đúng nghĩa "Quality = Potential".
export const EQUIPMENT_QUALITY_MAX_FORGE_POINTS: Record<EquipmentQuality, number> = {
  pham_khi: 20,
  bao_khi: 30,
  linh_khi: 45,
  phap_khi: 60,
  phap_bao: 80,
  tien_bao: 100,
  chi_bao: 130,
  hon_don_chi_bao: 160,
  thien_dia_trong_khi: 200,
}

// Hệ số nhân áp vào range roll Implicit (mainStat) TRƯỚC khi random —
// KHÔNG cộng thẳng multiplier vào giá trị đã roll (xem
// EquipmentSystem.rollMainStat()) — độc lập với hệ số scale theo cảnh
// giới (Realm), cả 2 nhân dồn vào nhau.
export const EQUIPMENT_QUALITY_IMPLICIT_MULTIPLIER: Record<EquipmentQuality, number> = {
  pham_khi: 1,
  bao_khi: 1.08,
  linh_khi: 1.18,
  phap_khi: 1.28,
  phap_bao: 1.38,
  tien_bao: 1.48,
  chi_bao: 1.58,
  hon_don_chi_bao: 1.68,
  thien_dia_trong_khi: 1.8,
}

// Pool Affix mở được theo Quality (xem AffixPool trong Affix.ts) — Quality
// cao không chỉ nâng trần Tier (EQUIPMENT_QUALITY_MAX_AFFIX_TIER) mà
// còn mở rộng CHỦNG LOẠI affix roll được. Không khoá quá gắt — mỗi bậc
// chỉ CỘNG THÊM pool mới, không bao giờ mất quyền truy cập pool cũ.
export const EQUIPMENT_QUALITY_UNLOCKED_POOLS: Record<EquipmentQuality, AffixPool[]> = {
  pham_khi: ['basic'],
  bao_khi: ['basic'],
  linh_khi: ['basic', 'advanced'],
  phap_khi: ['basic', 'advanced'],
  phap_bao: ['basic', 'advanced', 'specialized'],
  tien_bao: ['basic', 'advanced', 'specialized'],
  chi_bao: ['basic', 'advanced', 'specialized', 'supreme'],
  hon_don_chi_bao: ['basic', 'advanced', 'specialized', 'supreme'],
  thien_dia_trong_khi: ['basic', 'advanced', 'specialized', 'supreme'],
}
