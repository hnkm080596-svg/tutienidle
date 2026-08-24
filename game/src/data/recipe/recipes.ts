import type { Recipe } from '@/core/recipe/Recipe'

// "tunghematandsuch" pass (2026-08-14) — mọi recipe giờ theo ĐÚNG 1
// trong 3 công thức tổng quát của tài liệu (mục 17), thay hẳn danh
// sách nguyên liệu tự do trước đây:
//   Đan:  1-3 Linh Thảo (bất kỳ bậc niên đại) + 1 Yêu Đan  + Linh Thạch
//   Phù:  1-2 Linh Mộc  (bất kỳ bậc niên đại) + 1 Yêu Huyết + Linh Thạch
//   Trận: 1-3 Linh Thiết (đa hành)             + 1 Yêu Cốt  + Linh Thạch
// Linh Thạch = player.spiritStone có sẵn (KHÔNG phải material mới),
// wire qua `spiritStoneCost` (xem core/recipe/Recipe.ts/CraftingSystem.ts).
// Niên đại nguyên liệu Đan/Phù đặt TRẦN theo Phẩm (mục 2 tài liệu — đã
// gán Phẩm ở naming-principles pass trước): Hoàng/Huyền Phẩm dùng bậc
// gốc (years 0), Địa Phẩm dùng Bách Niên (years 100), Thiên/Tiên Phẩm
// dùng Thiên Niên (years 1000, bậc niên đại cao nhất hiện có).
export const recipes: Recipe[] = [
  {
    id: 'recipe_minor_healing_pill',

    name: 'Đơn phương Hoàng Phẩm Hồi Nguyên Đan',

    description: 'Công thức luyện chế cơ bản, dùng Linh Chi phổ thông.',

    resultType: 'pill',

    resultId: 'minor_healing_pill',

    resultAmount: 1,

    materials: [
      { materialId: 'linh_chi', amount: 2 },
      { materialId: 'yeu_dan_luyen_khi_canh', amount: 1 },
    ],

    spiritStoneCost: 5,

    craftDuration: 30,
  },

  {
    id: 'recipe_medium_healing_pill',

    name: 'Đơn phương Huyền Phẩm Hồi Nguyên Đan',

    description: 'Đơn phương bậc trung, dùng nhiều Linh Thảo hơn để tăng hiệu quả hồi phục.',

    resultType: 'pill',

    resultId: 'medium_healing_pill',

    resultAmount: 1,

    materials: [
      { materialId: 'linh_chi', amount: 2 },
      { materialId: 'que', amount: 1 },
      { materialId: 'yeu_dan_luyen_khi_canh', amount: 1 },
    ],

    spiritStoneCost: 10,

    craftDuration: 45,
  },

  {
    id: 'recipe_qi_gathering_pill',

    name: 'Đơn phương Huyền Phẩm Tụ Khí Đan',

    description: 'Công thức luyện chế cơ bản, phối 2 loại Linh Thảo khác thuộc tính.',

    resultType: 'pill',

    resultId: 'qi_gathering_pill',

    resultAmount: 1,

    materials: [
      { materialId: 'linh_chi', amount: 1 },
      { materialId: 'que', amount: 1 },
      { materialId: 'yeu_dan_luyen_khi_canh', amount: 1 },
    ],

    spiritStoneCost: 10,

    craftDuration: 60,
  },

  {
    id: 'recipe_body_forging_pill',

    name: 'Đơn phương Địa Phẩm Cường Công Đan',

    description: 'Đan dược quý hiếm, tăng vĩnh viễn công kích — cần Quế trăm năm tuổi.',

    resultType: 'pill',

    resultId: 'body_forging_pill',

    resultAmount: 1,

    // Đột Phá Trúc Cơ (Home Hub, Phase 1) — mở ngay từ Luyện Khí, vì
    // pill này gắn liền trần thuộc tính theo cảnh giới (attributeCap,
    // xem PillSystem.canUse()) — khoá foundation/golden_core trước đó
    // khiến pill KHÔNG THỂ đạt được trong suốt Luyện Khí, sai mục
    // đích thiết kế.
    materials: [
      { materialId: 'bach_nien_que', amount: 2 },
      { materialId: 'yeu_dan_luyen_khi_canh', amount: 2 },
    ],

    spiritStoneCost: 20,

    craftDuration: 90,
  },

  {
    id: 'recipe_flame_fox_pill',

    name: 'Đơn phương Thiên Phẩm Cường Công Đan',

    description: 'Bậc kế tiếp của Cường Công Đan, cần Quế nghìn năm tuổi — nguyên liệu quý hiếm bậc cao.',

    resultType: 'pill',

    resultId: 'flame_fox_pill',

    resultAmount: 1,

    materials: [
      { materialId: 'thien_nien_que', amount: 2 },
      { materialId: 'yeu_dan_luyen_khi_canh', amount: 3 },
    ],

    spiritStoneCost: 40,

    craftDuration: 120,
  },

  {
    id: 'recipe_body_tempering_pill',

    name: 'Đơn phương Huyền Phẩm Cố Thể Đan',

    description: 'Kết hợp Linh Chi và Cúc Hoa, phối cùng Yêu Đan để cố thể.',

    resultType: 'pill',

    resultId: 'body_tempering_pill',

    resultAmount: 1,

    materials: [
      { materialId: 'linh_chi', amount: 2 },
      { materialId: 'cuc_hoa', amount: 1 },
      { materialId: 'yeu_dan_luyen_khi_canh', amount: 1 },
    ],

    spiritStoneCost: 10,

    craftDuration: 90,
  },

  {
    id: 'recipe_flood_serpent_pill',

    name: 'Đơn phương Tiên Phẩm Cố Thể Đan',

    description: 'Bậc cao nhất của Cố Thể Đan, cần Linh Chi và Cúc Hoa nghìn năm tuổi.',

    resultType: 'pill',

    resultId: 'flood_serpent_pill',

    resultAmount: 1,

    materials: [
      { materialId: 'thien_nien_linh_chi', amount: 2 },
      { materialId: 'thien_nien_cuc_hoa', amount: 2 },
      { materialId: 'yeu_dan_luyen_khi_canh', amount: 3 },
    ],

    spiritStoneCost: 50,

    craftDuration: 150,
  },

  {
    id: 'recipe_rock_bear_pill',

    name: 'Đơn phương Thiên Phẩm Cường Thủ Đan',

    description: 'Đan dược phòng ngự cao cấp, cần Cúc Hoa nghìn năm tuổi.',

    resultType: 'pill',

    resultId: 'rock_bear_pill',

    resultAmount: 1,

    materials: [
      { materialId: 'thien_nien_cuc_hoa', amount: 2 },
      { materialId: 'yeu_dan_luyen_khi_canh', amount: 3 },
    ],

    spiritStoneCost: 40,

    craftDuration: 120,
  },

  {
    id: 'recipe_blade_hawk_pill',

    name: 'Đơn phương Địa Phẩm Nhuệ Khí Đan',

    description: 'Đan dược tăng bạo kích, cần Linh Chi trăm năm tuổi.',

    resultType: 'pill',

    resultId: 'blade_hawk_pill',

    resultAmount: 1,

    materials: [
      { materialId: 'bach_nien_linh_chi', amount: 2 },
      { materialId: 'yeu_dan_luyen_khi_canh', amount: 2 },
    ],

    spiritStoneCost: 20,

    craftDuration: 120,
  },

  {
    id: 'recipe_spirit_condensing_pill',

    name: 'Đơn phương Địa Phẩm Ngưng Thần Đan',

    description: 'Đan dược cao cấp, cần Cúc Hoa trăm năm tuổi để ngưng tụ thần thức.',

    resultType: 'pill',

    resultId: 'spirit_condensing_pill',

    resultAmount: 1,

    materials: [
      { materialId: 'bach_nien_cuc_hoa', amount: 2 },
      { materialId: 'yeu_dan_luyen_khi_canh', amount: 2 },
    ],

    spiritStoneCost: 20,

    craftDuration: 150,
  },

  // Đột Phá Trúc Cơ (Home Hub, Phase 1) — 3 pill "hidden progression"
  // (mục 8 spec breakthrough) trước đó KHÔNG có recipe/nguồn rơi nào
  // — hoàn toàn không thể đạt được. Mở ngay từ Luyện Khí (không
  // requiredRealmId) — bí mật nằm ở việc TÌM RA cần uống đủ ×10 mỗi
  // loại VÀ giữ Stat 20/20, không phải ở việc khoá cảnh giới. Nguyên
  // liệu đổi sang Linh Thảo/Yêu Đan (naming-principles pass) nhưng
  // GIỮ NGUYÊN resultId/effects/description — mật độ ×10 counter tra
  // theo id (FoundationResolver.ts), không phụ thuộc nguyên liệu.
  {
    id: 'recipe_foundation_pill',

    name: 'Đơn phương Địa Phẩm Trúc Cơ Đan',

    description: 'Đan dược cổ phương, dùng Linh Chi trăm năm tuổi.',

    resultType: 'pill',

    resultId: 'foundation_pill',

    resultAmount: 1,

    materials: [
      { materialId: 'bach_nien_linh_chi', amount: 2 },
      { materialId: 'yeu_dan_luyen_khi_canh', amount: 1 },
    ],

    spiritStoneCost: 15,

    craftDuration: 45,
  },

  {
    id: 'recipe_body_refining_pill',

    name: 'Đơn phương Địa Phẩm Tôi Thể Đan',

    description: 'Đan dược tôi luyện thân thể, dùng Linh Chi trăm năm tuổi.',

    resultType: 'pill',

    resultId: 'body_refining_pill',

    resultAmount: 1,

    materials: [
      { materialId: 'bach_nien_linh_chi', amount: 2 },
      { materialId: 'yeu_dan_luyen_khi_canh', amount: 1 },
    ],

    spiritStoneCost: 15,

    craftDuration: 45,
  },

  {
    id: 'recipe_spirit_forging_pill',

    name: 'Đơn phương Địa Phẩm Rèn Linh Đan',

    description: 'Đan dược rèn luyện linh khí, dùng Quế trăm năm tuổi.',

    resultType: 'pill',

    resultId: 'spirit_forging_pill',

    resultAmount: 1,

    materials: [
      { materialId: 'bach_nien_que', amount: 2 },
      { materialId: 'yeu_dan_luyen_khi_canh', amount: 1 },
    ],

    spiritStoneCost: 15,

    craftDuration: 45,
  },

  {
    id: 'recipe_slot_expansion_talisman',

    name: 'Phù lục Huyền Phẩm Khai Huyệt',

    description: 'Vẽ phù khai mở huyệt vị trên trang bị, dùng Phù Chỉ đã qua xử lý ở Thiên Công Phường.',

    resultType: 'talisman',

    resultId: 'slot_expansion_talisman',

    resultAmount: 1,

    materials: [
      { materialId: 'phu_chi', amount: 2 },
      { materialId: 'yeu_huyet_luyen_khi_canh', amount: 1 },
    ],

    spiritStoneCost: 15,

    craftDuration: 90,
  },

  {
    id: 'recipe_golden_bell_formation',

    name: 'Trận đồ Huyền Phẩm Kim Chung',

    description: 'Bày trận phòng ngự, cần Huyền Thiết và Hoàng Kim Linh Thiết làm nền.',

    resultType: 'formation',

    resultId: 'golden_bell_formation',

    resultAmount: 1,

    materials: [
      { materialId: 'huyen_thiet', amount: 2 },
      { materialId: 'hoang_kim_linh_thiet', amount: 2 },
      { materialId: 'yeu_cot_luyen_khi_canh', amount: 1 },
    ],

    spiritStoneCost: 20,

    craftDuration: 100,

    requiredRealmId: 'foundation_establishment',
  },

  {
    id: 'recipe_lifesteal_formation',

    name: 'Trận đồ Địa Phẩm Đoạt Mệnh',

    description: 'Trận pháp tà môn, cần Hàn Thiết và Xích Đồng mới đủ tà khí bày trận.',

    resultType: 'formation',

    resultId: 'lifesteal_formation',

    resultAmount: 1,

    materials: [
      { materialId: 'han-thiet', amount: 2 },
      { materialId: 'xich_dong', amount: 2 },
      { materialId: 'yeu_cot_luyen_khi_canh', amount: 2 },
    ],

    spiritStoneCost: 30,

    craftDuration: 160,

    requiredRealmId: 'golden_core',
  },

  {
    id: 'recipe_blazing_strike_formation',

    name: 'Trận đồ Huyền Phẩm Liệt Hỏa',

    description: 'Bày trận khắc hoạ sát khí lên vũ khí, cần Xích Đồng và Huyền Thiết.',

    resultType: 'formation',

    resultId: 'blazing_strike_formation',

    resultAmount: 1,

    materials: [
      { materialId: 'xich_dong', amount: 2 },
      { materialId: 'huyen_thiet', amount: 2 },
      { materialId: 'yeu_cot_luyen_khi_canh', amount: 1 },
    ],

    spiritStoneCost: 15,

    craftDuration: 120,
  },

  // Pháp Tu profession-tier ladder (2026-08-14) — recipe cho pill Hỏa
  // hệ đầu tiên, cùng công thức Đan chuẩn (Linh Thảo + Yêu Đan + Linh
  // Thạch), dùng Bách Niên Quế (Địa Phẩm trần, khớp pham dia_pham).
  {
    id: 'recipe_fire_might_pill',

    name: 'Đơn phương Địa Phẩm Viêm Uy Đan',

    description: 'Công thức luyện đan Hỏa hệ, dùng Quế trăm năm tuổi.',

    resultType: 'pill',

    resultId: 'fire_might_pill',

    resultAmount: 1,

    materials: [
      { materialId: 'bach_nien_que', amount: 2 },
      { materialId: 'yeu_dan_luyen_khi_canh', amount: 1 },
    ],

    spiritStoneCost: 20,

    craftDuration: 90,
  },

  {
    id: 'recipe_wood_drain_pill',

    name: 'Đơn phương Địa Phẩm Hấp Huyết Đan',

    description: 'Công thức luyện đan Mộc hệ, dùng Thanh Linh Mộc trăm năm tuổi.',

    resultType: 'pill',

    resultId: 'wood_drain_pill',

    resultAmount: 1,

    materials: [
      { materialId: 'bach_nien_thanh_linh_moc', amount: 2 },
      { materialId: 'yeu_huyet_luyen_khi_canh', amount: 1 },
    ],

    spiritStoneCost: 20,

    craftDuration: 90,
  },

  {
    id: 'recipe_water_control_pill',

    name: 'Đơn phương Địa Phẩm Băng Tâm Đan',

    description: 'Công thức luyện đan Thủy hệ, dùng Cúc Hoa trăm năm tuổi.',

    resultType: 'pill',

    resultId: 'water_control_pill',

    resultAmount: 1,

    materials: [
      { materialId: 'bach_nien_cuc_hoa', amount: 2 },
      { materialId: 'yeu_dan_luyen_khi_canh', amount: 1 },
    ],

    spiritStoneCost: 20,

    craftDuration: 90,
  },

  {
    id: 'recipe_metal_bleed_pill',

    name: 'Đơn phương Địa Phẩm Thiết Sa Đan',

    description: 'Công thức luyện đan Kim hệ, dùng Huyền Thiết tinh luyện.',

    resultType: 'pill',

    resultId: 'metal_bleed_pill',

    resultAmount: 1,

    materials: [
      { materialId: 'huyen_thiet', amount: 2 },
      { materialId: 'yeu_dan_luyen_khi_canh', amount: 1 },
    ],

    spiritStoneCost: 20,

    craftDuration: 90,
  },

  {
    id: 'recipe_earth_shield_pill',

    name: 'Đơn phương Địa Phẩm Bàn Thạch Đan',

    description: 'Công thức luyện đan Thổ hệ, dùng Hoàng Kim Linh Thiết.',

    resultType: 'pill',

    resultId: 'earth_shield_pill',

    resultAmount: 1,

    materials: [
      { materialId: 'hoang_kim_linh_thiet', amount: 2 },
      { materialId: 'yeu_dan_luyen_khi_canh', amount: 1 },
    ],

    spiritStoneCost: 20,

    craftDuration: 90,
  },
]
