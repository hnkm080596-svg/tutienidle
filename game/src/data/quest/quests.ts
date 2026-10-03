import type { Quest } from '../../core/quest/Quest'

// Nội dung khởi tạo Quest System v1 — id material/enemy xác nhận thật
// trong data/materials/materials.ts và data/enemy/Enemies.ts. Linh Chi/
// Quế/Cúc Hoa legacy đã bị loại khỏi registry runtime (materials.ts
// dòng 569-571, filter category 'herb' khỏi legacyMaterials) — dùng
// linh thảo MỚI từ buildReworkPillHerbs() (`${herbId}_${realmId}_${age}`,
// xem data/pill/PillFamilies.ts) thay thế. Số liệu thưởng chỉ ở mức
// tham khảo, cân bằng kỹ hơn để sau.
export const QUESTS: Quest[] = [
  {
    id: 'collect_tu_linh_thao_1',
    // ui-audit economy M6: the once quest and the daily quest used to
    // share the name "Thu Thap Tu Linh Thao" verbatim - two quests
    // reading identically in the same panel. The once quest now reads
    // as the one-off stockpile task.
    name: 'Dự Trữ Tụ Linh Thảo',
    description: 'Nộp 5 Tụ Linh Thảo để nhận thưởng.',
    condition: { kind: 'collect', materialId: 'tu_linh_thao_qi_refining_decade', amount: 5 },
    reward: { reward: { spiritStone: 20 } },
    cadence: 'once',
  },
  {
    id: 'collect_qi_refining_ore_decade_1',
    name: 'Thu Thập Thập Niên Linh Khoáng',
    description: 'Nộp 3 Thập Niên Linh Khoáng để nhận thưởng.',
    condition: { kind: 'collect', materialId: 'qi_refining_ore_decade', amount: 3 },
    reward: { reward: { spiritStone: 30 } },
    cadence: 'once',
  },
  // BETA SCOPE LOCK v2 Phase-5 (sec.15): the daily cadence and its
  // three quests (daily_collect_hoi_xuan_thao, daily_kill_bandit_15,
  // daily_chieu_hien_lenh) leave the active beta lifecycle entirely -
  // the entries are removed, not just scope-hidden, so saves holding
  // their progress simply find no active quest to resume.
  {
    id: 'kill_wild_wolf_10',
    name: 'Tiêu Diệt Dã Lang',
    description: 'Đánh bại 10 Dã Lang.',
    condition: { kind: 'kill', enemyId: 'wild_wolf', amount: 10 },
    reward: { reward: { spiritStone: 25 } },
    cadence: 'once',
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
