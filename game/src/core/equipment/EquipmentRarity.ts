import type { Pham } from '../item/Pham'

/**
 * Equipment Rework (2026-08-14) — trục ĐỘC LẬP với EquipmentQuality
 * (9 bậc tu vi của món đồ, xem EquipmentQuality.ts) kiểu Path of Exile
 * "item level + rarity": Quality chỉ còn vai trò GATE (tier Affix tối
 * đa + pool Affix mở được + range Implicit), còn Rarity mới là thứ
 * quyết định SỐ LƯỢNG Affix (Prefix/Suffix) một item có thể mang —
 * "Quality = Potential, Rarity = Roll Density".
 *
 * Naming-principles pass (2026-08-14, "nguyen li dat ten") — trục này
 * đổi từ 4 bậc chủ đề "Duyên" (may mắn/số phận) sang 5 bậc Ngũ Phẩm
 * Hoàng/Huyền/Địa/Thiên/Tiên (dùng LẠI Pham.ts — tên/thứ tự CHUNG với
 * Pill/Talisman/Formation, xem Pham.ts), theo yêu cầu người dùng —
 * value = Pham (không định nghĩa lại union con). Ý nghĩa MECHANIC của
 * trục này (số lượng Affix, KHÔNG phải sức mạnh trần) không đổi, chỉ
 * đổi TÊN hiển thị + số bậc 4->5.
 *
 * Bỏ hẳn 'unique'/fixedAffixes (không còn item cố định affix — mọi
 * item đều roll ngẫu nhiên qua đúng 1 pipeline, "Không có item đúng,
 * chỉ có roll tốt hay xấu"). Rarity cao nhất (tien_pham) bù lại bằng
 * cơ hội roll thêm 1 "Exalted Affix" từ pool 'supreme' (xem Affix.ts/
 * EquipmentSystem.createInstance()) — vẫn ngẫu nhiên, không phải item
 * cố định.
 */
export type EquipmentRarity = Pham

// Nhãn RIÊNG của Equipment Rarity. ID nội bộ tiếp tục dùng Pham để giữ
// tương thích save và các bảng cap; phần hiển thị bỏ hậu tố "Phẩm" vì đây
// là mật độ Affix của trang bị, không phải tên đầy đủ của thang Phẩm dùng
// chung cho Đan/Phù/Trận.
export const EQUIPMENT_RARITY_LABELS: Record<EquipmentRarity, string> = {
  hoang_pham: 'Hoàng',
  huyen_pham: 'Huyền',
  dia_pham: 'Địa',
  thien_pham: 'Thiên',
  tien_pham: 'Tiên',
}

// Thứ tự thấp -> cao — dùng cho roll trọng số lúc rớt đồ.
export const EQUIPMENT_RARITY_ORDER: EquipmentRarity[] = [
  'hoang_pham',
  'huyen_pham',
  'dia_pham',
  'thien_pham',
  'tien_pham',
]

// Trọng số random khi rớt đồ — rarity càng cao càng hiếm.
export const EQUIPMENT_RARITY_DROP_WEIGHT: Record<EquipmentRarity, number> = {
  hoang_pham: 55,
  huyen_pham: 27,
  dia_pham: 12,
  thien_pham: 5,
  tien_pham: 1,
}

export interface EquipmentRarityAffixSlots {
  prefix: number

  suffix: number
}

// Số slot Prefix/Suffix tối đa theo rarity — 5 bậc thay 4, chặng giữa
// (dia_pham) lệch prefix trước suffix (2/1) trước khi đối xứng lại ở
// thien_pham (2/2) rồi tien_pham (3/3), tránh 1 bước nhảy đột ngột.
export const EQUIPMENT_RARITY_AFFIX_SLOTS: Record<EquipmentRarity, EquipmentRarityAffixSlots> = {
  hoang_pham: { prefix: 0, suffix: 0 },
  huyen_pham: { prefix: 1, suffix: 1 },
  dia_pham: { prefix: 2, suffix: 1 },
  thien_pham: { prefix: 2, suffix: 2 },
  tien_pham: { prefix: 3, suffix: 3 },
}

// "Exalted Affix" (mục 2 kế hoạch) — CHỈ tien_pham mới có cơ hội roll
// thêm 1 affix bonus từ pool 'supreme' (bỏ qua giới hạn slot rarity
// bình thường ở trên) — vẫn random, không phải item cố định. 6 base
// (3/3) + 1 exalted = 7, còn dư 1 dưới GLOBAL_MAX_AFFIXES=8 cho Yểm
// Phù, không cần đổi trần chung.
export const EQUIPMENT_RARITY_EXALTED_AFFIX_CHANCE = 0.15
