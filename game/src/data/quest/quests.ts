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
    name: 'Thu Thập Tụ Linh Thảo',
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
  {
    id: 'daily_collect_hoi_xuan_thao',
    name: '[Hàng Ngày] Thu Thập Hồi Xuân Thảo',
    description: 'Nộp 5 Hồi Xuân Thảo mỗi ngày để nhận thưởng.',
    condition: { kind: 'collect', materialId: 'hoi_xuan_thao_qi_refining_decade', amount: 5 },
    reward: { reward: { techniqueInsight: 15 } },
    cadence: 'daily',
  },
  {
    id: 'kill_wild_wolf_10',
    name: 'Tiêu Diệt Dã Lang',
    description: 'Đánh bại 10 Dã Lang.',
    condition: { kind: 'kill', enemyId: 'wild_wolf', amount: 10 },
    reward: { reward: { spiritStone: 25 } },
    cadence: 'once',
  },
  {
    id: 'daily_kill_bandit_15',
    name: '[Hàng Ngày] Diệt Sơn Tặc',
    description: 'Đánh bại 15 Sơn Tặc bất kỳ khu vực nào.',
    condition: { kind: 'kill', enemyId: 'bandit', amount: 15 },
    reward: { reward: { cultivation: 200 } },
    cadence: 'daily',
  },

  // Trúc Cơ content pass M1 (2026-08-29) — 5 quest chuỗi Trúc Cơ,
  // tham chiếu quái `foundation_*` mới (data/enemy/Enemies.ts) + sink
  // Linh Khoáng hiện có. Phần thưởng tài nguyên (spiritStone/
  // techniqueInsight/cultivation) — QuestItemReward chưa hỗ trợ
  // equipment, thưởng trang bị lần đầu dời sau (spec mục 4.3 ghi chú).
  // Số liệu thưởng first pass, cân bằng kỹ hơn để sau.
  {
    id: 'kill_foundation_stone_fungus_15',
    name: 'Diệt Địa Tinh Giám',
    description: 'Yêu thú Địa Tinh Giám quấy phá hậu sơn Thanh Vân — diệt 15 con.',
    condition: { kind: 'kill', enemyId: 'foundation_stone_fungus', amount: 15 },
    reward: { reward: { techniqueInsight: 120 } },
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
    id: 'kill_foundation_flood_dragon_whelp_10',
    name: 'Diệt Giao Sủng',
    description: 'Giao Sủng trú ngụ hàn thạch đàm — đánh bại 10 con.',
    condition: { kind: 'kill', enemyId: 'foundation_flood_dragon_whelp', amount: 10 },
    reward: { reward: { techniqueInsight: 200 } },
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
