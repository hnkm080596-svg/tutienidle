import type { Material } from './Material'

// Linh Thach la MATERIAL (plan Workstream F) - KHONG con currency state
// rieng tren PlayerData. So du duy nhat:
//   materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)
// Cong bang materialBag.add(); tieu bang materialBag.remove() sau khi
// kiem tra has(). Voi penalty co the tru qua so du, dung amount thuc te
// Math.min(owned, requested).
//
// 2026-10-11 (spirit-stone flatten, owner ruling): "linh thach gio chi
// la linh thach, khong co pham cap nua" - trung/thuong pham da bi xoa,
// moi nguon/chi phi deu dung MOT id duy nhat. Save v88 migrate gap
// stack trung/thuong vao id nay 1:1 (xem services/save).
export const SPIRIT_STONE_MATERIAL_ID = 'material_spirit_stone'

export const SPIRIT_STONE_MATERIAL: Material = {
  id: SPIRIT_STONE_MATERIAL_ID,

  name: 'Linh Thạch',

  category: 'spirit_stone',

  sourceType: 'building',

  icon: '/assets/materials/spirit_stone_ha_pham.png',

  description: 'Tinh thể linh khí dùng làm vật liệu và đơn vị trao đổi.',

  // Tran stack chung (MAX_STACK_AMOUNT = 1000) KHONG phu hop Linh Thach
  // - chi phi Dot Pha len toi hang ty. undefined voi material khac =
  // tran chung.
  stackLimit: Number.MAX_SAFE_INTEGER,
}

export const SPIRIT_STONE_MATERIALS: readonly Material[] = [
  SPIRIT_STONE_MATERIAL,
]
