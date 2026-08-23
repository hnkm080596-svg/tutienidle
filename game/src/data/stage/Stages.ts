import type { Stage } from '../../core/stage/Stage'

// Thanh Vân naming pass (2026-08-15) — `name` của cả 10 Stage đổi
// sang "Quật 1".."Quật 10" (Zone cha đã đổi tên "Thanh Vân", xem
// data/stage/Zones.ts — Stage KHÔNG cần lặp lại chữ "Thanh Vân" nữa,
// đúng chỉ định "không cần mang theo chữ Thanh Vân ở mọi nơi"). id và
// description GIỮ NGUYÊN (an toàn save, description vẫn còn giá trị
// flavor riêng dù không còn khớp 1:1 với tên hiển thị "Quật N" nữa —
// chưa viết lại, để dành nếu cần một lượt riêng).
const BASE_STAGES: Stage[] = [
  {
    id: 'qi_refining_forest',

    name: 'Quật 1',

    description: 'Khu rừng đầu núi, nơi Dã Lang và Sơn Tặc lang thang — thử thách đầu tiên cho tu sĩ mới nhập môn.',

    requiredRealmId: 'qi_refining',

    enemyPool: [
      { enemyId: 'wild_wolf', weight: 5 },
      // 10% cơ hội là "Sơn Tặc Đầu Lĩnh" (Tinh Anh) — nguồn rơi thật
      // đầu tiên cho Phá Cảnh Tâm Pháp (xem eliteRewards trong
      // data/enemy/Enemies.ts).
      { enemyId: 'bandit', weight: 3, eliteChance: 0.1 },
      { enemyId: 'mountain_hawk', weight: 4 },
      { enemyId: 'giant_earthworm', weight: 2 },
    ],

    totalEnemyCount: 10,

    spawnIntervalSeconds: 3,

    // Core Loop Foundation checklist (Mục BOSS) — quái CUỐI CÙNG
    // (thứ 10) LUÔN LÀ "Đại Vương Sơn Tặc" (Boss, buff HP×7/Attack×1.6),
    // KHÔNG roll enemyPool cho lượt đó — khác "Sơn Tặc Đầu Lĩnh"
    // (Elite) ở trên vốn có thể xuất hiện NGẪU NHIÊN ở bất kỳ lượt nào.
    bossEnemyId: 'bandit',
  },

  // Luyện Khí tầng 1-10 content pass (2026-08-14) — 9 Stage mới (tầng
  // 2-10), cùng Zone qi_refining_valley (xem data/stage/Zones.ts). Ngũ
  // Hành Tương Sinh: Mộc(1-2)→Hỏa(3-4)→Thổ(5-6)→Kim(7-8)→Thủy(9-10),
  // mỗi cặp tầng dùng CHUNG 2 loài (data/enemy/Enemies.ts), tầng chẵn
  // chỉ đổi tên "Hung "+stat mạnh hơn, KHÔNG đổi loài. `requiredRealmLevel`
  // = số tầng hiển thị (label thôi — gate thật theo thứ tự khai trong
  // Zones.ts's stageIds, xem GameManager.isStageUnlocked()).
  // Nhịp spawn giữ ở 3 giây; tổng số quái được chuẩn hóa ở cuối file theo
  // công thức 10 + (tầng - 1), tạo cảm giác quy mô tăng dần mà không làm
  // thời lượng một màn nhảy quá mạnh.

  {
    id: 'qi_refining_deep_forest',
    name: 'Quật 2',
    description: 'Khu rừng sâu hơn hẳn Thanh Vân Cốc, nơi Lâm Yêu ẩn mình giữa tán cây rậm rạp.',
    requiredRealmId: 'qi_refining',
    requiredRealmLevel: 2,
    enemyPool: [
      { enemyId: 'ferocious_wild_wolf', weight: 5 },
      { enemyId: 'forest_fiend', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 10,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'forest_fiend',
  },

  {
    id: 'qi_refining_ember_canyon',
    name: 'Quật 3',
    description: 'Hẻm núi phủ tro nóng, Viêm Hồ tinh ranh lẩn khuất quanh những khe nứt phun lửa.',
    requiredRealmId: 'qi_refining',
    requiredRealmLevel: 3,
    enemyPool: [
      { enemyId: 'flame_fox', weight: 5 },
      { enemyId: 'magma_boar', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 10,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'magma_boar',
  },

  {
    id: 'qi_refining_scorched_ridge',
    name: 'Quật 4',
    description: 'Sườn núi cháy xém cao hơn Xích Diễm Cốc, Nham Trư hung hãn tụ tập đông hơn.',
    requiredRealmId: 'qi_refining',
    requiredRealmLevel: 4,
    enemyPool: [
      { enemyId: 'ferocious_flame_fox', weight: 5 },
      { enemyId: 'ferocious_magma_boar', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 10,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'ferocious_magma_boar',
  },

  {
    id: 'qi_refining_sand_plain',
    name: 'Quật 5',
    description: 'Đồng bằng cát vàng mênh mông, Sa Miêu di chuyển nhanh như gió cuốn.',
    requiredRealmId: 'qi_refining',
    requiredRealmLevel: 5,
    enemyPool: [
      { enemyId: 'sand_lynx', weight: 5 },
      { enemyId: 'rock_bear', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 10,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'rock_bear',
  },

  {
    id: 'qi_refining_stone_range',
    name: 'Quật 6',
    description: 'Dãy núi đá vàng sừng sững, Nham Hùng trấn giữ từng vách đá dựng đứng.',
    requiredRealmId: 'qi_refining',
    requiredRealmLevel: 6,
    enemyPool: [
      { enemyId: 'ferocious_sand_lynx', weight: 5 },
      { enemyId: 'ferocious_rock_bear', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 10,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'ferocious_rock_bear',
  },

  {
    id: 'qi_refining_blade_peak',
    name: 'Quật 7',
    description: 'Đỉnh núi phủ khoáng kim sắc trắng, Đoạn Nhận Ưng lượn vòng săn mồi từ trên cao.',
    requiredRealmId: 'qi_refining',
    requiredRealmLevel: 7,
    enemyPool: [
      { enemyId: 'blade_hawk', weight: 5 },
      { enemyId: 'metal_beetle', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 10,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'metal_beetle',
  },

  {
    id: 'qi_refining_mineral_pit',
    name: 'Quật 8',
    description: 'Hầm khoáng sâu dưới Bạch Nhận Sơn, Kim Giáp Trùng đào hang chằng chịt trong bóng tối.',
    requiredRealmId: 'qi_refining',
    requiredRealmLevel: 8,
    enemyPool: [
      { enemyId: 'ferocious_blade_hawk', weight: 5 },
      { enemyId: 'ferocious_metal_beetle', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 10,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'ferocious_metal_beetle',
  },

  {
    id: 'qi_refining_mystic_marsh',
    name: 'Quật 9',
    description: 'Đầm lầy mù sương huyền bí, Đàm Oa và Giao Xà ẩn mình dưới lớp nước đen.',
    requiredRealmId: 'qi_refining',
    requiredRealmLevel: 9,
    enemyPool: [
      { enemyId: 'pool_toad', weight: 5 },
      { enemyId: 'flood_serpent', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 10,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'flood_serpent',
  },

  {
    id: 'qi_refining_abyssal_pool',
    name: 'Quật 10',
    description: 'Vực nước sâu thẳm cuối Huyền Đàm Trạch — nơi Giao Xà ngự trị, chặng thử thách cuối cùng trước ngưỡng cửa Trúc Cơ.',
    requiredRealmId: 'qi_refining',
    requiredRealmLevel: 10,
    enemyPool: [
      { enemyId: 'ferocious_pool_toad', weight: 5 },
      { enemyId: 'ferocious_flood_serpent', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 10,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'ferocious_flood_serpent',
  },

  // Phàm Nhân Động 1-10 (2026-08-16) — cùng Zone pham_nhan_valley (xem
  // data/stage/Zones.ts), cùng Ngũ Hành Tương Sinh Mộc(1-2)->Hỏa(3-4)->
  // Thổ(5-6)->Kim(7-8)->Thủy(9-10) và cấu trúc "requiredRealmLevel =
  // số Động" như Luyện Khí, nhưng requiredRealmId 'pham_nhan' và quái
  // riêng (data/enemy/Enemies.ts, công thức base thấp hơn hẳn).

  {
    id: 'pham_nhan_dong_1',
    name: 'Động 1',
    description: 'Cửa hang đầu tiên nơi chân núi, Dã Trư và Sơn Khấu tranh nhau từng tấc đất — thử thách đầu đời của 1 phàm nhân.',
    requiredRealmId: 'pham_nhan',
    enemyPool: [
      { enemyId: 'pham_nhan_wild_boar', weight: 5 },
      { enemyId: 'pham_nhan_mountain_bandit', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 10,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'pham_nhan_mountain_bandit',
  },

  {
    id: 'pham_nhan_dong_2',
    name: 'Động 2',
    description: 'Hang sâu hơn, Dã Trư và Sơn Khấu ở đây đã dữ tợn hơn hẳn cửa hang ngoài.',
    requiredRealmId: 'pham_nhan',
    requiredRealmLevel: 2,
    enemyPool: [
      { enemyId: 'pham_nhan_ferocious_wild_boar', weight: 5 },
      { enemyId: 'pham_nhan_ferocious_mountain_bandit', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 10,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'pham_nhan_ferocious_mountain_bandit',
  },

  {
    id: 'pham_nhan_dong_3',
    name: 'Động 3',
    description: 'Vùng đất khô nóng, Hoang Cẩu và Man Hổ lang thang tìm mồi giữa nắng gắt.',
    requiredRealmId: 'pham_nhan',
    requiredRealmLevel: 3,
    enemyPool: [
      { enemyId: 'pham_nhan_feral_dog', weight: 5 },
      { enemyId: 'pham_nhan_savage_tiger', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 10,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'pham_nhan_savage_tiger',
  },

  {
    id: 'pham_nhan_dong_4',
    name: 'Động 4',
    description: 'Nắng càng gắt, Hoang Cẩu và Man Hổ càng hung hãn — không còn là con mồi dễ dàng.',
    requiredRealmId: 'pham_nhan',
    requiredRealmLevel: 4,
    enemyPool: [
      { enemyId: 'pham_nhan_ferocious_feral_dog', weight: 5 },
      { enemyId: 'pham_nhan_ferocious_savage_tiger', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 10,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'pham_nhan_ferocious_savage_tiger',
  },

  {
    id: 'pham_nhan_dong_5',
    name: 'Động 5',
    description: 'Nền đất đá cứng, Thạch Miêu ẩn mình sau từng tảng đá, Nê Ngưu lầm lì trấn giữ lối đi.',
    requiredRealmId: 'pham_nhan',
    requiredRealmLevel: 5,
    enemyPool: [
      { enemyId: 'pham_nhan_stone_lynx', weight: 5 },
      { enemyId: 'pham_nhan_mud_ox', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 10,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'pham_nhan_mud_ox',
  },

  {
    id: 'pham_nhan_dong_6',
    name: 'Động 6',
    description: 'Đất đá dày hơn, Thạch Miêu và Nê Ngưu ở tầng này đã to khỏe rõ rệt.',
    requiredRealmId: 'pham_nhan',
    requiredRealmLevel: 6,
    enemyPool: [
      { enemyId: 'pham_nhan_ferocious_stone_lynx', weight: 5 },
      { enemyId: 'pham_nhan_ferocious_mud_ox', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 10,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'pham_nhan_ferocious_mud_ox',
  },

  {
    id: 'pham_nhan_dong_7',
    name: 'Động 7',
    description: 'Vách hang lấp lánh khoáng kim, Ngân Hồ tinh ranh và Thiết Giáp Trư lì lợm cùng trấn giữ.',
    requiredRealmId: 'pham_nhan',
    requiredRealmLevel: 7,
    enemyPool: [
      { enemyId: 'pham_nhan_silver_fox', weight: 5 },
      { enemyId: 'pham_nhan_iron_boar', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 10,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'pham_nhan_iron_boar',
  },

  {
    id: 'pham_nhan_dong_8',
    name: 'Động 8',
    description: 'Khoáng kim dày đặc hơn, Ngân Hồ và Thiết Giáp Trư ở đây đã cứng cáp hơn hẳn.',
    requiredRealmId: 'pham_nhan',
    requiredRealmLevel: 8,
    enemyPool: [
      { enemyId: 'pham_nhan_ferocious_silver_fox', weight: 5 },
      { enemyId: 'pham_nhan_ferocious_iron_boar', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 10,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'pham_nhan_ferocious_iron_boar',
  },

  {
    id: 'pham_nhan_dong_9',
    name: 'Động 9',
    description: 'Hang ngập nước, Thủy Lang săn mồi dưới ánh sáng mờ, Cự Ngạc ẩn mình chờ đợi.',
    requiredRealmId: 'pham_nhan',
    requiredRealmLevel: 9,
    enemyPool: [
      { enemyId: 'pham_nhan_water_wolf', weight: 5 },
      { enemyId: 'pham_nhan_giant_crocodile', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 10,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'pham_nhan_giant_crocodile',
  },

  {
    id: 'pham_nhan_dong_10',
    name: 'Động 10',
    description: 'Đáy hang ngập nước sâu nhất — chặng thử thách cuối cùng của kiếp phàm nhân, trước ngưỡng cửa Luyện Khí.',
    requiredRealmId: 'pham_nhan',
    requiredRealmLevel: 10,
    enemyPool: [
      { enemyId: 'pham_nhan_ferocious_water_wolf', weight: 5 },
      { enemyId: 'pham_nhan_ferocious_giant_crocodile', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 10,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'pham_nhan_ferocious_giant_crocodile',
  },
]

const normalizedStages: Stage[] = BASE_STAGES.map(stage => ({
  ...stage,
  chapter: stage.requiredRealmId === 'pham_nhan' ? 1 : 2,
  floor: stage.requiredRealmLevel ?? 1,
  totalEnemyCount: 10 + (stage.requiredRealmLevel ?? 1) - 1,
}))

// Foundation content temporarily reuses the current Thanh Vân encounter
// pools. The chapter/floor model is real; enemy balance remains data-only
// and can be replaced without changing stage progression logic.
const foundationStages: Stage[] = normalizedStages
  .filter(stage => stage.chapter === 2)
  .map(stage => ({
    ...stage,
    id: `foundation_floor_${stage.floor}`,
    name: `Màn 3.${stage.floor}`,
    requiredRealmId: 'foundation',
    chapter: 3,
  }))

export const STAGES: Stage[] = [...normalizedStages, ...foundationStages]
