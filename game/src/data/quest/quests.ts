import { QUEST_FLAG_ALCHEMY_CRAFTED, type Quest } from '../../core/quest/Quest'

// Nội dung khởi tạo Quest System v1 — id material/enemy xác nhận thật
// trong data/materials/materials.ts và data/enemy/Enemies.ts. Linh Chi/
// Quế/Cúc Hoa legacy đã bị loại khỏi registry runtime (materials.ts
// dòng 569-571, filter category 'herb' khỏi legacyMaterials) — dùng
// linh thảo MỚI từ buildReworkPillHerbs() (`${herbId}_${realmId}_${age}`,
// xem data/pill/PillFamilies.ts) thay thế. Số liệu thưởng chỉ ở mức
// tham khảo, cân bằng kỹ hơn để sau.
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
    name: 'Hổ Khiếu Lâm Trung',
    description: 'Man Hổ chiếm giữ Động 4–6 — đánh bại 5 con.',
    condition: { kind: 'kill', enemyId: 'mortal_savage_tiger', amount: 5 },
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
    name: 'Thủy Lang Ẩm Đàm',
    description: 'Đoạn hang ngập nước là địa bàn Thủy Lang — diệt 5 con.',
    condition: { kind: 'kill', enemyId: 'mortal_water_wolf', amount: 5 },
    reward: { reward: { spiritStone: 20, cultivation: 80 } },
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'main_04_quang_chi_nguyen',
  },
  {
    id: 'main_06_vuong_gia_da_de',
    name: 'Vương Giả Đá Đề',
    description: 'Hung Cự Ngạc ngự trị đáy Động 10 — diệt 5 con, dọn đường tới Luyện Khí.',
    condition: { kind: 'kill', enemyId: 'mortal_ferocious_giant_crocodile', amount: 5 },
    reward: { reward: { spiritStone: 40, cultivation: 120 } },
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'main_05_thuy_lang_dam',
  },
  {
    id: 'main_07_ngu_hanh_nhap_mon',
    name: 'Ngũ Hành Nhập Môn',
    description: 'Đạt Phàm Nhân tầng 12 rồi làm lễ Quán Khí chọn một hành. Sau khi nhập môn, săn 5 Dã Lang nơi Quật 1–3.',
    condition: { kind: 'kill', enemyId: 'wild_wolf', amount: 5 },
    reward: { reward: { spiritStone: 30, cultivation: 150, skillInsight: 5 } },
    cadence: 'once',
    requiredRealmId: 'qi_refining',
    chainId: 'mainline',
    unlocksAfterQuestId: 'main_06_vuong_gia_da_de',
  },
  {
    id: 'main_08_viem_ho_coc',
    name: 'Viêm Hồ Xích Cốc',
    description: 'Quật 4–6 rực lửa, Viêm Hồ chặn đường — diệt 5 con.',
    condition: { kind: 'kill', enemyId: 'flame_fox', amount: 5 },
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
    name: 'Trùn Đồn Khoáng',
    description: 'Trùn Đất khổng lồ ngầm Quật 7–9 — diệt 5 con.',
    condition: { kind: 'kill', enemyId: 'giant_earthworm', amount: 5 },
    reward: { reward: { spiritStone: 45, cultivation: 200 } },
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'collect_qi_refining_ore_decade_1',
  },
  {
    id: 'main_13_giao_xa_uyen_dam',
    name: 'Giao Xà Uyên Đàm',
    description: 'Hung Giao Xà trấn Quật 10 — diệt 5 con. Đây là điều kiện độ kiếp Trúc Cơ.',
    condition: { kind: 'kill', enemyId: 'ferocious_flood_serpent', amount: 5 },
    reward: { reward: { spiritStone: 60, skillInsight: 10 } },
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'main_12_trun_don_khoang',
  },
  {
    id: 'main_14_do_kiep_truc_co',
    name: 'Độ Kiếp Trúc Cơ',
    description: 'Tầng 12 + vượt Quật 10 mở lôi kiếp — độ kiếp thành công, bước chân đầu vào hậu sơn: diệt 5 Dực Hỏa Khuyển.',
    condition: { kind: 'kill', enemyId: 'foundation_lava_hound', amount: 5 },
    reward: { reward: { spiritStone: 100, cultivation: 500 } },
    cadence: 'once',
    requiredRealmId: 'foundation_establishment',
    chainId: 'mainline',
    unlocksAfterQuestId: 'main_13_giao_xa_uyen_dam',
  },
  {
    id: 'main_15_giao_sung_chung_cuc',
    name: 'Giao Sủng Chung Cực',
    description: 'Hung Giao Sủng cuồng nộ đáy hàn thạch đàm — diệt 5 con, khép lại chính tuyến beta.',
    condition: { kind: 'kill', enemyId: 'foundation_ferocious_flood_dragon_whelp', amount: 5 },
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
    // wild_wolf only spawns in the qi_refining Quat stages - ungated,
    // the quest auto-admitted at mortal creation as a dead 0/10 row.
    // The realm gate keeps it admission-gated to Act II; a carried save
    // that already holds it active retains the row (inverse pass only
    // retires product-dead quests) so it stays finishable at qi_refining.
    id: 'kill_wild_wolf_10',
    name: 'Tiêu Diệt Dã Lang',
    description: 'Đánh bại 10 Dã Lang.',
    condition: { kind: 'kill', enemyId: 'wild_wolf', amount: 10 },
    reward: { reward: { spiritStone: 25 } },
    cadence: 'once',
    requiredRealmId: 'qi_refining',
  },
  // Trúc Cơ content pass M1 (2026-08-29) — 5 quest chuỗi Trúc Cơ,
  // tham chiếu quái `foundation_*` mới (data/enemy/Enemies.ts) + sink
  // Linh Khoáng hiện có. Phần thưởng tài nguyên (spiritStone/
  // skillInsight/cultivation) - QuestItemReward chua ho tro
  // equipment, thưởng trang bị lần đầu dời sau (spec mục 4.3 ghi chú).
  // Số liệu thưởng first pass, cân bằng kỹ hơn để sau.
  {
    // BETA SCOPE LOCK v2 Phase-5 (Phase-4 fallout): foundation_stone_fungus
    // has no beta spawn source - the kill target retargets onto the
    // roster earth-construct (mud golem); the quest id is preserved so
    // save progress/claimed state keyed by questId keeps resolving.
    id: 'kill_foundation_stone_fungus_15',
    name: 'Diệt Nê Ngẫu',
    description: 'Nê Ngẫu trỗi dậy chắn lối hậu sơn Thanh Vân — diệt 15 con.',
    condition: { kind: 'kill', enemyId: 'foundation_mud_golem', amount: 15 },
    reward: { reward: { skillInsight: 120 } },
    cadence: 'once',
    requiredRealmId: 'foundation_establishment',
  },
  {
    id: 'kill_foundation_floor_10_boss_1',
    name: 'Chinh Phục Hậu Sơn',
    description: 'Đánh bại Giao Sủng hung hãn nơi đáy hàn thạch đàm — trùm cuối Trúc Cơ.',
    condition: { kind: 'kill', enemyId: 'foundation_ferocious_flood_dragon_whelp', amount: 1 },
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
    // BETA SCOPE LOCK v2 Phase-5 (Phase-4 fallout): the non-ferocious
    // foundation_flood_dragon_whelp is off the beta roster - its kill
    // quest retargets onto the same-species roster twin (the ferocious
    // variant, final boss of Act III); the quest id is preserved.
    id: 'kill_foundation_flood_dragon_whelp_10',
    name: 'Diệt Giao Sủng',
    description: 'Giao Sủng hung hãn trú ngụ hàn thạch đàm — đánh bại 10 con.',
    condition: { kind: 'kill', enemyId: 'foundation_ferocious_flood_dragon_whelp', amount: 10 },
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
