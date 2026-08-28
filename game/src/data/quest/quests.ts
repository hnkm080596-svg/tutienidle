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
    id: 'collect_qi_refining_ore_hoang_1',
    name: 'Thu Thập Bát Phẩm Linh Khoáng',
    description: 'Nộp 3 Bát Phẩm Linh Khoáng để nhận thưởng.',
    condition: { kind: 'collect', materialId: 'qi_refining_ore_hoang', amount: 3 },
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
]
