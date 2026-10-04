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
}

export const REALMS: RealmData[] = [
  // PRODUCT SCOPE: progression hien chi duoc thiet ke va can bang toi
  // Truc Co tang 18. Cac canh gioi tu Kim Dan tro di moi la du lieu giu cho;
  // khong duoc dung maxLevel/gate cua chung de suy ra rang nguoi choi hien co
  // the tien xa hon Truc Co. Khi mo rong scope phai thiet ke lai gate dai canh
  // gioi, thoi gian tu luyen, noi dung va test progression cung luc.
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
    // 10 -> 18 (2026-08-20, Realm Passive & Pressure follow-up) - Quan
    // Khi (chon Phap Tu/Kiem Tu) gio mo qua tribulation qi_refining,
    // KHONG con bat buoc
    // maxLevel - 18 chua 6 tang dem (12-18) de choi tiep Luyen The
    // (tang cuoi Luyen Mach cung mo o 12, xem data/realm/LuyenThe.ts)
    // hoac grind them diem thuoc tinh truoc khi quyet dinh Quan Khi.
    maxLevel: 18,
    baseCultivationMinutes: 1
  },

  {
    id: 'qi_refining',
    name: 'Luyện Khí',
    maxLevel: 18,
    baseCultivationMinutes: 22
  },

  {
    id: 'foundation_establishment',
    name: 'Trúc Cơ',
    // Moc ket thuc noi dung progression hien tai, khong co dot pha Kim Dan.
    maxLevel: 18,
    baseCultivationMinutes: 64
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
