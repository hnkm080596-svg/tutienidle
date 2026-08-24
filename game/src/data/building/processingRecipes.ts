import type { ProcessingRecipe } from '@/core/building/ProcessingRecipe'

// Chuỗi mẫu (MASTER SPEC Mục V "Iron Ore → Iron Ingot") — iron-ore giờ
// nhặt từ Khai Thác (exploration, xem data/exploration/explorations.ts),
// Lò Luyện (smelter) tự tiêu thụ theo thời gian thực để ra black-iron,
// không cần người chơi bấm craft thủ công (xem BuildingSystem.claim()).
export const processingRecipes: ProcessingRecipe[] = [
  {
    id: 'iron_ore_smelting',

    buildingId: 'smelter',

    inputMaterialId: 'quang_sat',

    inputAmount: 1,

    outputMaterialId: 'huyen_thiet',

    outputAmount: 1,

    processingSeconds: 60,
  },

  // Thiên Công Phường (2026-08-15) — chuỗi thứ 2 cùng khuôn: Mộc Lâm
  // (exploration) tự sinh thanh-linh-moc, Thiên Công Phường tự tiêu
  // thụ theo thời gian thực để ra phu-chi (nguyên liệu chế Phù thật).
  {
    id: 'spirit_wood_processing',

    buildingId: 'artisan_workshop',

    inputMaterialId: 'thanh_linh_moc',

    inputAmount: 1,

    outputMaterialId: 'phu_chi',

    outputAmount: 1,

    processingSeconds: 60,
  },
]
