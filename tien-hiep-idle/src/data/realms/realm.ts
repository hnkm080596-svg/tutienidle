export interface RealmData {
  id: string
  name: string
  maxLevel: number

  // Phàm Nhân (tutorial) DUY NHẤT — công thức hấp thu linh khí cũ
  // (baseRequiredCultivation * cultivationMultiplier^(level-1)), cố
  // tình KHÔNG đổi sang cơ chế ngân sách thời gian bên dưới (xem
  // getRequiredCultivation() ở core/realm/realmSystem.ts). Mọi cảnh
  // giới khác để trống 2 field này.
  baseRequiredCultivation?: number
  cultivationMultiplier?: number

  // Rework "100% mỗi tiểu cảnh giới" (2026-08-16) — bội số của
  // BASE_CULTIVATION_UNIT_SECONDS (x, xem realmSystem.ts): tổng thời
  // gian tu luyện MỤC TIÊU (giả định tốc độ tu luyện CƠ BẢN, không
  // cộng bonus) để đi hết toàn bộ cảnh giới này, chia không đều cho
  // từng tầng theo đường cong tăng dần — thay thế hẳn 2 field phía
  // trên cho MỌI cảnh giới TRỪ Phàm Nhân. x = 1 ngày -> Luyện Khí =
  // 10 ngày, mỗi đại cảnh giới sau x3 cảnh giới trước.
  realmDurationMultiplier?: number

  // Trần tổng bonus vĩnh viễn (cộng dồn qua các pill permanent_stat
  // cùng target 1 stat) mà nhân vật có thể hấp thu ở cảnh giới này —
  // undefined = cảnh giới chưa thiết kế trần, không giới hạn. Thay
  // thế cơ chế Pill.usageLimit cũ (giới hạn theo số lần uống 1 pill
  // cụ thể) — xem PillSystem.canUse().
  attributeCap?: number
}

export const REALMS: RealmData[] = [
  // Phàm Nhân (2026-08-16) — đại cảnh giới THẤP NHẤT, đứng TRƯỚC
  // qi_refining trong mảng này (getRealmIndex()/getGlobalCultivationLevel()
  // đều thuần index-driven, tự động đúng khi chèn ở đầu, không cần sửa
  // realmSystem.ts). Không có nghi lễ Đột Phá riêng như Trúc Cơ — "nghi
  // lễ" của Phàm Nhân -> Luyện Khí CHÍNH LÀ chọn Pháp Tu/Kiếm Tu (xem
  // GameManager.chooseCultivationPath(), CultivationSystem.breakthrough()).
  // Là tutorial nên GIỮ NGUYÊN công thức hấp thu cũ, không theo ngân
  // sách thời gian x/10x/30x... của các cảnh giới còn lại.
  {
    id: 'pham_nhan',
    name: 'Phàm Nhân',
    // 10 -> 18 (2026-08-20, Realm Passive & Pressure follow-up) — Quán
    // Khí (chọn Pháp Tu/Kiếm Tu) giờ mở sớm ở tầng 12 (xem
    // CharacterPanel.vue's QUAN_KHI_UNLOCK_TANG), KHÔNG còn bắt buộc
    // maxLevel — 18 chừa 6 tầng đệm (12-18) để chơi tiếp Luyện Thể
    // (tầng cuối Luyện Mạch cũng mở ở 12, xem data/realm/LuyenThe.ts)
    // hoặc grind thêm điểm thuộc tính trước khi quyết định Quán Khí.
    maxLevel: 18,
    baseRequiredCultivation: 20,
    cultivationMultiplier: 1.3,
    attributeCap: 10,
  },

  {
    id: 'qi_refining',
    name: 'Luyện Khí',
    maxLevel: 20,
    realmDurationMultiplier: 10,
    attributeCap: 20,
  },

  {
    id: 'foundation',
    name: 'Trúc Cơ',
    maxLevel: 9,
    realmDurationMultiplier: 30,
    attributeCap: 100,
  },

  {
    id: 'golden_core',
    name: 'Kim Đan',
    maxLevel: 9,
    realmDurationMultiplier: 90,
  },

  {
    id: 'nascent_soul',
    name: 'Nguyên Anh',
    maxLevel: 9,
    realmDurationMultiplier: 270,
  },

  {
    id: 'soul_transformation',
    name: 'Hóa Thần',
    maxLevel: 9,
    realmDurationMultiplier: 810,
  },

  {
    id: 'void_refinement',
    name: 'Luyện Hư',
    maxLevel: 9,
    realmDurationMultiplier: 2430,
  },

  {
    id: 'body_integration',
    name: 'Hợp Thể',
    maxLevel: 9,
    realmDurationMultiplier: 7290,
  },

  {
    id: 'mahayana',
    name: 'Đại Thừa',
    maxLevel: 9,
    realmDurationMultiplier: 21870,
  },

  {
    id: 'tribulation',
    name: 'Độ Kiếp',
    maxLevel: 9,
    realmDurationMultiplier: 65610,
  },
]
