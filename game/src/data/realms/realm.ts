export interface RealmData {
  id: string
  name: string
  maxLevel: number

  // Minutes needed for level 1 -> 2. Later levels add one minute each.
  // Extended levels 13-18 never affect the next realm's base time.
  // Mutually exclusive with realmDurationMultiplier (XOR contract -
  // pinned by CultivationSystem.test.ts).
  baseCultivationMinutes?: number

  // Rework "100% per minor realm" (2026-08-16) - a multiple of
  // BASE_CULTIVATION_UNIT_SECONDS (x, see realmSystem.ts): total TARGET
  // cultivation time (assuming BASIC cultivation speed, no bonuses) to
  // cross this whole realm, split unevenly per tier on an increasing
  // curve. x = 1 day -> Luyen Khi = 10 days, each later major realm x3
  // the previous.
  realmDurationMultiplier?: number

  // Trần tổng bonus vĩnh viễn (cộng dồn qua các pill permanent_stat
  // cùng target 1 stat) mà nhân vật có thể hấp thu ở cảnh giới này —
  // undefined = cảnh giới chưa thiết kế trần, không giới hạn. Thay
  // thế cơ chế Pill.usageLimit cũ (giới hạn theo số lần uống 1 pill
  // cụ thể) — xem PillSystem.canUse().
  attributeCap?: number
}

export const REALMS: RealmData[] = [
  // PRODUCT SCOPE: progression hiện chỉ được thiết kế và cân bằng tới
  // Trúc Cơ tầng 18. Các cảnh giới từ Kim Đan trở đi mới là dữ liệu giữ chỗ;
  // không được dùng maxLevel/gate của chúng để suy ra rằng người chơi hiện có
  // thể tiến xa hơn Trúc Cơ. Khi mở rộng scope phải thiết kế lại gate đại cảnh
  // giới, thời gian tu luyện, nội dung và test progression cùng lúc.
  // Pham Nhan (2026-08-16) - the LOWEST major realm, placed BEFORE
  // qi_refining in this array (getRealmIndex()/getGlobalCultivationLevel()
  // are purely index-driven, automatically correct when prepended - no
  // realmSystem.ts edits needed). No separate Breakthrough rite like Truc Co - the
  // "rite" for Pham Nhan -> Luyen Khi IS choosing Phap Tu/Kiem Tu (see
  // GameManager.chooseCultivationPath(), CultivationSystem.breakthrough()).
  // Being the tutorial, it uses a fixed minutes-per-tier cadence
  // (baseCultivationMinutes), not the x/10x/30x... time budgets of later
  // realms.
  {
    id: 'mortal',
    name: 'Phàm Nhân',
    // 10 -> 18 (2026-08-20, Realm Passive & Pressure follow-up) — Quán
    // Khí (chọn Pháp Tu/Kiếm Tu) giờ mở qua tribulation qi_refining,
    // KHÔNG còn bắt buộc
    // maxLevel — 18 chừa 6 tầng đệm (12-18) để chơi tiếp Luyện Thể
    // (tầng cuối Luyện Mạch cũng mở ở 12, xem data/realm/LuyenThe.ts)
    // hoặc grind thêm điểm thuộc tính trước khi quyết định Quán Khí.
    maxLevel: 18,
    baseCultivationMinutes: 1,
    attributeCap: 10,
  },

  {
    id: 'qi_refining',
    name: 'Luyện Khí',
    maxLevel: 18,
    baseCultivationMinutes: 22,
    attributeCap: 20,
  },

  {
    id: 'foundation_establishment',
    name: 'Trúc Cơ',
    // Mốc kết thúc nội dung progression hiện tại, không có đột phá Kim Đan.
    maxLevel: 18,
    baseCultivationMinutes: 64,
    attributeCap: 100,
  },

  {
    id: 'golden_core',
    name: 'Kim Đan',
    maxLevel: 18,
    realmDurationMultiplier: 90,
  },

  {
    id: 'nascent_soul',
    name: 'Nguyên Anh',
    maxLevel: 18,
    realmDurationMultiplier: 270,
  },

  {
    id: 'soul_transformation',
    name: 'Hóa Thần',
    maxLevel: 18,
    realmDurationMultiplier: 810,
  },

  {
    id: 'void_refinement',
    name: 'Luyện Hư',
    maxLevel: 18,
    realmDurationMultiplier: 2430,
  },

  {
    id: 'body_integration',
    name: 'Hợp Thể',
    maxLevel: 18,
    realmDurationMultiplier: 7290,
  },

  {
    id: 'mahayana',
    name: 'Đại Thừa',
    maxLevel: 18,
    realmDurationMultiplier: 21870,
  },

  {
    id: 'tribulation',
    name: 'Độ Kiếp',
    maxLevel: 18,
    realmDurationMultiplier: 65610,
  },
]
