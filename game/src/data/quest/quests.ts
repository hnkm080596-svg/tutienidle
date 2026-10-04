import { QUEST_FLAG_ALCHEMY_CRAFTED, type Quest } from '../../core/quest/Quest'

// Noi dung khoi tao Quest System v1 - id material/enemy xac nhan that
// trong data/materials/materials.ts va data/enemy/Enemies.ts. Linh Chi/
// Que/Cuc Hoa legacy da bi loai khoi registry runtime (materials.ts
// dong 569-571, filter category 'herb' khoi legacyMaterials) - dung
// linh thao MOI tu buildReworkPillHerbs() (`${herbId}_${realmId}_${age}`,
// xem data/pill/PillFamilies.ts) thay the. So lieu thuong chi o muc
// tham khao, can bang ky hon de sau.
export const QUESTS: Quest[] = [
  // ---------------------------------------------------------------
  // MAINLINE (Chinh Tuyen) - tutorial -> feature intro -> realm push.
  // 15 quests, 3 acts, chainId 'mainline'. Ordering derives from
  // unlocksAfterQuestId (the head has none); admission flows through
  // QuestSystem.reconcileActiveQuests only - creation reconciles
  // (initializeCharacter), claims reconcile (GameManagerQuestOps), and
  // realm transitions reconcile (markQuestRealmTransition) for the
  // realm-gated members. Design: docs/design/mainline-quest-design.md.
  // ---------------------------------------------------------------
  {
    id: 'main_01_da_san_dau_tien',
    name: 'Săn Mồi Đầu Tiên',
    description: 'Vào Thanh Vân Động 1, đánh bại 3 Dã Trư.',
    condition: { kind: 'kill', enemyId: 'mortal_wild_boar', amount: 3 },
    reward: { reward: { spiritStone: 10 } },
    cadence: 'once',
    chainId: 'mainline',
  },
  {
    id: 'main_02_lam_chi_san',
    name: 'Lâm Chi Sản',
    description: 'Mở Sản Xuất, để Thanh Vân Lâm tự khai thác — nộp 3 Thập Niên Linh Mộc Phàm Nhân.',
    condition: { kind: 'collect', materialId: 'mortal_wood_decade', amount: 3 },
    reward: { reward: { spiritStone: 10 } },
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'main_01_da_san_dau_tien',
  },
  {
    id: 'main_03_ho_khieu_lam_trung',
    name: 'Bầy Trư Trỗi Dậy',
    description: 'Heo Rừng chiếm giữ Động 4–6 — đánh bại 5 con.',
    condition: { kind: 'kill', enemyId: 'mortal_wild_boar', amount: 5 },
    reward: { reward: { spiritStone: 15, cultivation: 50 } },
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'main_02_lam_chi_san',
  },
  {
    id: 'main_04_quang_chi_nguyen',
    name: 'Quáng Chi Nguyên',
    description: 'Huyền Thiết Quảng chảy về Khí Đường — nộp 3 Thập Niên Linh Khoáng Phàm Nhân.',
    condition: { kind: 'collect', materialId: 'mortal_ore_decade', amount: 3 },
    reward: { reward: { spiritStone: 15 } },
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'main_03_ho_khieu_lam_trung',
  },
  {
    id: 'main_05_thuy_lang_dam',
    name: 'Trư Đàn Địa Bàn',
    description: 'Đoạn hang ngập nước là địa bàn Heo Rừng — diệt 5 con.',
    condition: { kind: 'kill', enemyId: 'mortal_wild_boar', amount: 5 },
    reward: { reward: { spiritStone: 20, cultivation: 80 } },
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'main_04_quang_chi_nguyen',
  },
  {
    id: 'main_06_vuong_gia_da_de',
    name: 'Vương Giả Đá Đề',
    description: 'Heo Rừng Vương ngự trị đáy Động 10 — diệt 5 con, dọn đường tới Luyện Khí.',
    condition: { kind: 'kill', enemyId: 'mortal_ferocious_wild_boar', amount: 5 },
    reward: { reward: { spiritStone: 40, cultivation: 120 } },
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'main_05_thuy_lang_dam',
  },
  {
    id: 'main_07_ngu_hanh_nhap_mon',
    name: 'Ngũ Hành Nhập Môn',
    description: 'Đạt Phàm Nhân tầng 12 rồi làm lễ Quán Khí chọn một hành. Sau khi nhập môn, săn 5 Sơn Tặc nơi Quật 1–3.',
    condition: { kind: 'kill', enemyId: 'bandit', amount: 5 },
    reward: { reward: { spiritStone: 30, cultivation: 150, skillInsight: 5 } },
    cadence: 'once',
    requiredRealmId: 'qi_refining',
    chainId: 'mainline',
    unlocksAfterQuestId: 'main_06_vuong_gia_da_de',
  },
  {
    id: 'main_08_viem_ho_coc',
    name: 'Sơn Tặc Giáp Khẩu',
    description: 'Quật 4–6 là đồn Sơn Tặc chặn đường — diệt 5 con.',
    condition: { kind: 'kill', enemyId: 'bandit', amount: 5 },
    reward: { reward: { spiritStone: 40, skillInsight: 10 } },
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'main_07_ngu_hanh_nhap_mon',
  },
  {
    // MAINLINE FOLD (keep id): the herb stockpile beat is chain step 9 -
    // teaches Dong Thien production into alchemy. Id unchanged so save
    // progress/completedOnceIds survives; admission now chains off
    // main_08 instead of activating ungated at mortal.
    id: 'collect_tu_linh_thao_1',
    name: 'Động Thiên Dị Thảo',
    description: 'Động Thiên nuôi linh thảo chủ dược — nộp 5 Tụ Linh Thảo.',
    condition: { kind: 'collect', materialId: 'tu_linh_thao_qi_refining_decade', amount: 5 },
    reward: { reward: { spiritStone: 20 } },
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'main_08_viem_ho_coc',
  },
  {
    id: 'main_10_dan_lo_so_khai',
    name: 'Đan Lò Sơ Khai',
    description: 'Vào Đan Phòng, luyện chế thành công một viên đan dược bất kỳ.',
    condition: { kind: 'flag', flagId: QUEST_FLAG_ALCHEMY_CRAFTED, amount: 1 },
    reward: {
      reward: { spiritStone: 30 },
      // Design sec.1 row 10: one qi-refining Tu Linh Dan lands as a pill
      // itemDrop (claim() pill branch handles bag overflow).
      itemDrops: [{ kind: 'pill', itemId: 'tu_linh_dan_qi_refining', amount: 1 }],
    },
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'collect_tu_linh_thao_1',
  },
  {
    // MAINLINE FOLD (keep id): the ore stockpile beat is chain step 11 -
    // teaches ore -> Khi Duong enhance. Id preserved for carried saves.
    id: 'collect_qi_refining_ore_decade_1',
    name: 'Thu Thập Thập Niên Linh Khoáng',
    description: 'Nộp 3 Thập Niên Linh Khoáng để nhận thưởng.',
    condition: { kind: 'collect', materialId: 'qi_refining_ore_decade', amount: 3 },
    reward: { reward: { spiritStone: 30 } },
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'main_10_dan_lo_so_khai',
  },
  {
    id: 'main_12_trun_don_khoang',
    name: 'Sơn Tặc Trại Lớn',
    description: 'Sơn Tặc ngầm Quật 7–9 — diệt 5 con.',
    condition: { kind: 'kill', enemyId: 'bandit', amount: 5 },
    reward: { reward: { spiritStone: 45, cultivation: 200 } },
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'collect_qi_refining_ore_decade_1',
  },
  {
    id: 'main_13_giao_xa_uyen_dam',
    name: 'Sơn Tặc Vương Đàm',
    description: 'Sơn Tặc Vương trấn Quật 10 — diệt 5 con. Đây là điều kiện độ kiếp Trúc Cơ.',
    condition: { kind: 'kill', enemyId: 'ferocious_bandit', amount: 5 },
    reward: { reward: { spiritStone: 60, skillInsight: 10 } },
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'main_12_trun_don_khoang',
  },
  {
    id: 'main_14_do_kiep_truc_co',
    name: 'Độ Kiếp Trúc Cơ',
    description: 'Tầng 12 + vượt Quật 10 mở lôi kiếp — độ kiếp thành công, bước chân đầu vào hậu sơn: diệt 5 Linh Lang.',
    condition: { kind: 'kill', enemyId: 'foundation_spirit_wolf', amount: 5 },
    reward: { reward: { spiritStone: 100, cultivation: 500 } },
    cadence: 'once',
    requiredRealmId: 'foundation_establishment',
    chainId: 'mainline',
    unlocksAfterQuestId: 'main_13_giao_xa_uyen_dam',
  },
  {
    id: 'main_15_giao_sung_chung_cuc',
    name: 'Lang Vương Chung Cực',
    description: 'Linh Lang Vương cuồng nộ đáy cổ mộc đàm — diệt 5 con, khép lại chính tuyến beta.',
    condition: { kind: 'kill', enemyId: 'foundation_ferocious_spirit_wolf', amount: 5 },
    reward: { reward: { spiritStone: 200, skillInsight: 30 } },
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'main_14_do_kiep_truc_co',
  },
  // BETA SCOPE LOCK v2 Phase-5 (sec.15): the daily cadence and its
  // three quests (daily_collect_hoi_xuan_thao, daily_kill_bandit_15,
  // daily_chieu_hien_lenh) leave the active beta lifecycle entirely -
  // the entries are removed, not just scope-hidden, so saves holding
  // their progress simply find no active quest to resume.
  {
    // bandit only spawns in the qi_refining Quat stages - ungated,
    // the quest auto-admitted at mortal creation as a dead 0/10 row.
    // The realm gate keeps it admission-gated to Act II; a carried save
    // that already holds it active retains the row (inverse pass only
    // retires product-dead quests) so it stays finishable at qi_refining.
    // Roster remap (2026-10-04): target is the qi roster family.
    id: 'kill_wild_wolf_10',
    name: 'Tiêu Diệt Sơn Tặc',
    description: 'Đánh bại 10 Sơn Tặc.',
    condition: { kind: 'kill', enemyId: 'bandit', amount: 10 },
    reward: { reward: { spiritStone: 25 } },
    cadence: 'once',
    requiredRealmId: 'qi_refining',
  },
  // Truc Co content pass M1 (2026-08-29) - 5 quest chuoi Truc Co,
  // tham chieu quai `foundation_*` moi (data/enemy/Enemies.ts) + sink
  // Linh Khoang hien co. Phan thuong tai nguyen (spiritStone/
  // skillInsight/cultivation) - QuestItemReward chua ho tro
  // equipment, thuong trang bi lan dau doi sau (spec muc 4.3 ghi chu).
  // So lieu thuong first pass, can bang ky hon de sau.
  {
    // Roster remap (2026-10-04): one species per realm - the kill
    // target retargets onto the foundation roster family (Linh Lang);
    // the quest id is preserved so save progress/claimed state keyed by
    // questId keeps resolving.
    id: 'kill_foundation_stone_fungus_15',
    name: 'Diệt Linh Lang',
    description: 'Linh Lang trỗi dậy chắn lối hậu sơn Thanh Vân — diệt 15 con.',
    condition: { kind: 'kill', enemyId: 'foundation_spirit_wolf', amount: 15 },
    reward: { reward: { skillInsight: 120 } },
    cadence: 'once',
    requiredRealmId: 'foundation_establishment',
  },
  {
    id: 'kill_foundation_floor_10_boss_1',
    name: 'Chinh Phục Hậu Sơn',
    description: 'Đánh bại Linh Lang Vương nơi đáy cổ mộc đàm — trùm cuối Trúc Cơ.',
    condition: { kind: 'kill', enemyId: 'foundation_ferocious_spirit_wolf', amount: 1 },
    reward: { reward: { spiritStone: 800 } },
    cadence: 'once',
    requiredRealmId: 'foundation_establishment',
  },
  {
    id: 'collect_foundation_ore_30',
    name: 'Thu Thập Linh Khoáng Hậu Sơn',
    description: 'Nộp 30 Thập Niên Linh Khoáng thu được từ yêu thú hậu sơn.',
    condition: { kind: 'collect', materialId: 'qi_refining_ore_decade', amount: 30 },
    reward: { reward: { cultivation: 4000 } },
    cadence: 'once',
    requiredRealmId: 'foundation_establishment',
  },
  {
    // Roster remap (2026-10-04): the act-3 boss is the Linh Lang
    // Vuong - the kill target retargets onto it; the quest id is
    // preserved for save progress/claimed state.
    id: 'kill_foundation_flood_dragon_whelp_10',
    name: 'Diệt Lang Vương',
    description: 'Linh Lang Vương trú ngụ cổ mộc đàm — đánh bại 10 con.',
    condition: { kind: 'kill', enemyId: 'foundation_ferocious_spirit_wolf', amount: 10 },
    reward: { reward: { skillInsight: 200 } },
    cadence: 'once',
    requiredRealmId: 'foundation_establishment',
  },
  {
    id: 'kill_foundation_any_50',
    name: 'Thanh Lý Yêu Thú Hậu Sơn',
    description: 'Đánh bại 50 yêu thú bất kỳ nơi hậu sơn Thanh Vân.',
    condition: { kind: 'kill', amount: 50 },
    reward: { reward: { spiritStone: 500 } },
    cadence: 'once',
    requiredRealmId: 'foundation_establishment',
  },
]
