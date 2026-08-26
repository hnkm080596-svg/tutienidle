import type { Material } from './Material'

// Linh Thạch là MATERIAL (plan Workstream F) — KHÔNG còn currency state
// riêng trên PlayerData. Số dư duy nhất:
//   materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)
// Cộng bằng materialBag.add(); tiêu bằng materialBag.remove() sau khi
// kiểm tra has(). Với penalty có thể trừ quá số dư, dùng amount thực tế
// Math.min(owned, requested).
export const SPIRIT_STONE_MATERIAL_ID = 'spirit_stone'

export const SPIRIT_STONE_MATERIAL: Material = {
  id: SPIRIT_STONE_MATERIAL_ID,

  name: 'Linh Thạch',

  category: 'spirit_stone',

  sourceType: 'building',

  description: 'Tinh thể linh khí dùng làm vật liệu và đơn vị trao đổi.',

  // Trần stack chung (MAX_STACK_AMOUNT = 1000) KHÔNG phù hợp Linh Thạch
  // — chi phí Đột Phá lên tới hàng tỷ. undefined với material khác =
  // trần chung.
  stackLimit: Number.MAX_SAFE_INTEGER,
}
