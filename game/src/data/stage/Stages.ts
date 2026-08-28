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

    description:
      'Khu rừng đầu núi, nơi Dã Lang và Sơn Tặc lang thang — thử thách đầu tiên cho tu sĩ mới nhập môn.',

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
    description:
      'Hầm khoáng sâu dưới Bạch Nhận Sơn, Kim Giáp Trùng đào hang chằng chịt trong bóng tối.',
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
    description:
      'Vực nước sâu thẳm cuối Huyền Đàm Trạch — nơi Giao Xà ngự trị, chặng thử thách cuối cùng trước ngưỡng cửa Trúc Cơ.',
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

  // Phàm Nhân Động 1-10 (2026-08-16) — cùng Zone mortal_valley (xem
  // data/stage/Zones.ts), cùng Ngũ Hành Tương Sinh Mộc(1-2)->Hỏa(3-4)->
  // Thổ(5-6)->Kim(7-8)->Thủy(9-10) và cấu trúc "requiredRealmLevel =
  // số Động" như Luyện Khí, nhưng requiredRealmId 'mortal' và quái
  // riêng (data/enemy/Enemies.ts, công thức base thấp hơn hẳn).

  {
    id: 'mortal_dong_1',
    name: 'Động 1',
    description:
      'Cửa hang đầu tiên nơi chân núi, Dã Trư và Sơn Khấu tranh nhau từng tấc đất — thử thách đầu đời của 1 phàm nhân.',
    requiredRealmId: 'mortal',
    enemyPool: [
      { enemyId: 'mortal_wild_boar', weight: 5 },
      { enemyId: 'mortal_mountain_bandit', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 10,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'mortal_mountain_bandit',
  },

  {
    id: 'mortal_dong_2',
    name: 'Động 2',
    description: 'Hang sâu hơn, Dã Trư và Sơn Khấu ở đây đã dữ tợn hơn hẳn cửa hang ngoài.',
    requiredRealmId: 'mortal',
    requiredRealmLevel: 2,
    enemyPool: [
      { enemyId: 'mortal_ferocious_wild_boar', weight: 5 },
      { enemyId: 'mortal_ferocious_mountain_bandit', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 10,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'mortal_ferocious_mountain_bandit',
  },

  {
    id: 'mortal_dong_3',
    name: 'Động 3',
    description: 'Vùng đất khô nóng, Hoang Cẩu và Man Hổ lang thang tìm mồi giữa nắng gắt.',
    requiredRealmId: 'mortal',
    requiredRealmLevel: 3,
    enemyPool: [
      { enemyId: 'mortal_feral_dog', weight: 5 },
      { enemyId: 'mortal_savage_tiger', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 10,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'mortal_savage_tiger',
  },

  {
    id: 'mortal_dong_4',
    name: 'Động 4',
    description: 'Nắng càng gắt, Hoang Cẩu và Man Hổ càng hung hãn — không còn là con mồi dễ dàng.',
    requiredRealmId: 'mortal',
    requiredRealmLevel: 4,
    enemyPool: [
      { enemyId: 'mortal_ferocious_feral_dog', weight: 5 },
      { enemyId: 'mortal_ferocious_savage_tiger', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 10,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'mortal_ferocious_savage_tiger',
  },

  {
    id: 'mortal_dong_5',
    name: 'Động 5',
    description:
      'Nền đất đá cứng, Thạch Miêu ẩn mình sau từng tảng đá, Nê Ngưu lầm lì trấn giữ lối đi.',
    requiredRealmId: 'mortal',
    requiredRealmLevel: 5,
    enemyPool: [
      { enemyId: 'mortal_stone_lynx', weight: 5 },
      { enemyId: 'mortal_mud_ox', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 10,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'mortal_mud_ox',
  },

  {
    id: 'mortal_dong_6',
    name: 'Động 6',
    description: 'Đất đá dày hơn, Thạch Miêu và Nê Ngưu ở tầng này đã to khỏe rõ rệt.',
    requiredRealmId: 'mortal',
    requiredRealmLevel: 6,
    enemyPool: [
      { enemyId: 'mortal_ferocious_stone_lynx', weight: 5 },
      { enemyId: 'mortal_ferocious_mud_ox', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 10,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'mortal_ferocious_mud_ox',
  },

  {
    id: 'mortal_dong_7',
    name: 'Động 7',
    description:
      'Vách hang lấp lánh khoáng kim, Ngân Hồ tinh ranh và Thiết Giáp Trư lì lợm cùng trấn giữ.',
    requiredRealmId: 'mortal',
    requiredRealmLevel: 7,
    enemyPool: [
      { enemyId: 'mortal_silver_fox', weight: 5 },
      { enemyId: 'mortal_iron_boar', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 10,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'mortal_iron_boar',
  },

  {
    id: 'mortal_dong_8',
    name: 'Động 8',
    description: 'Khoáng kim dày đặc hơn, Ngân Hồ và Thiết Giáp Trư ở đây đã cứng cáp hơn hẳn.',
    requiredRealmId: 'mortal',
    requiredRealmLevel: 8,
    enemyPool: [
      { enemyId: 'mortal_ferocious_silver_fox', weight: 5 },
      { enemyId: 'mortal_ferocious_iron_boar', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 10,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'mortal_ferocious_iron_boar',
  },

  {
    id: 'mortal_dong_9',
    name: 'Động 9',
    description: 'Hang ngập nước, Thủy Lang săn mồi dưới ánh sáng mờ, Cự Ngạc ẩn mình chờ đợi.',
    requiredRealmId: 'mortal',
    requiredRealmLevel: 9,
    enemyPool: [
      { enemyId: 'mortal_water_wolf', weight: 5 },
      { enemyId: 'mortal_giant_crocodile', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 10,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'mortal_giant_crocodile',
  },

  {
    id: 'mortal_dong_10',
    name: 'Động 10',
    description:
      'Đáy hang ngập nước sâu nhất — chặng thử thách cuối cùng của kiếp phàm nhân, trước ngưỡng cửa Luyện Khí.',
    requiredRealmId: 'mortal',
    requiredRealmLevel: 10,
    enemyPool: [
      { enemyId: 'mortal_ferocious_water_wolf', weight: 5 },
      { enemyId: 'mortal_ferocious_giant_crocodile', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 10,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'mortal_ferocious_giant_crocodile',
  },
]

const normalizedStages: Stage[] = BASE_STAGES.map((stage) => ({
  ...stage,
  chapter: stage.requiredRealmId === 'mortal' ? 1 : 2,
  floor: stage.requiredRealmLevel ?? 1,
  totalEnemyCount: 10 + (stage.requiredRealmLevel ?? 1) - 1,
}))

// Trúc Cơ (2026-08-29) — 10 stage authored tường minh, bỏ hẳn việc
// clone enemy pool Luyện Khí. Ngũ Hành Tương Sinh Mộc(1-2)->Hỏa(3-4)->
// Thổ(5-6)->Kim(7-8)->Thủy(9-10), 2 loài/tầng (1 thường + 1
// boss-eligible), tầng chẵn dùng bản "Hung " mạnh hơn — đúng quy luật
// Luyện Khí + Phàm Nhân. Quái `foundation_*` xem data/enemy/Enemies.ts.
// Stage 10 (`foundation_floor_10`) có boss 2-phase + enrage 60s
// (`foundation_ferocious_flood_dragon_whelp`). `requiredRealmLevel` =
// số tầng hiển thị (gate thật theo thứ tự zone.stageIds, xem
// GameManager.isStageUnlocked()).
const foundationStages: Stage[] = [
  {
    id: 'foundation_floor_1',
    name: 'Màn 3.1',
    description: 'Hậu sơn Thanh Vân, yêu thú gỗ quấn quanh tán cổ thụ — chặng thử thách đầu tiên cho tu sĩ Trúc Cơ.',
    requiredRealmId: 'foundation_establishment',
    requiredRealmLevel: 1,
    chapter: 3,
    floor: 1,
    enemyPool: [
      { enemyId: 'foundation_wood_ape', weight: 5 },
      { enemyId: 'foundation_stone_fungus', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 10,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'foundation_stone_fungus',
  },

  {
    id: 'foundation_floor_2',
    name: 'Màn 3.2',
    description: 'Rừng sâu hơn, đám yêu thú Mộc hành ở đây đã bắt đầu có chút linh tính — lì lợm hơn hẳn.',
    requiredRealmId: 'foundation_establishment',
    requiredRealmLevel: 2,
    chapter: 3,
    floor: 2,
    enemyPool: [
      { enemyId: 'foundation_ferocious_wood_ape', weight: 5 },
      { enemyId: 'foundation_ferocious_stone_fungus', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 11,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'foundation_ferocious_stone_fungus',
  },

  {
    id: 'foundation_floor_3',
    name: 'Màn 3.3',
    description: 'Vùng đất hỏa địa hậu sơn, khí nóng bốc lên ngùn ngụt — Dực Hỏa Khuyển và Sa Hắc ẩn mình trong tro tàn.',
    requiredRealmId: 'foundation_establishment',
    requiredRealmLevel: 3,
    chapter: 3,
    floor: 3,
    enemyPool: [
      { enemyId: 'foundation_lava_hound', weight: 5 },
      { enemyId: 'foundation_sand_scorpion', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 12,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'foundation_sand_scorpion',
  },

  {
    id: 'foundation_floor_4',
    name: 'Màn 3.4',
    description: 'Hỏa địa càng dữ, lũ yêu Hỏa hành hung tợn hơn — không còn là trò trẻ con.',
    requiredRealmId: 'foundation_establishment',
    requiredRealmLevel: 4,
    chapter: 3,
    floor: 4,
    enemyPool: [
      { enemyId: 'foundation_ferocious_lava_hound', weight: 5 },
      { enemyId: 'foundation_ferocious_sand_scorpion', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 13,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'foundation_ferocious_sand_scorpion',
  },

  {
    id: 'foundation_floor_5',
    name: 'Màn 3.5',
    description: 'Thạch cốc hậu sơn — Thạch Giáp Quy lì lợm canh giữ, Nê Cự Nhân lầm lũi trấn lối đi.',
    requiredRealmId: 'foundation_establishment',
    requiredRealmLevel: 5,
    chapter: 3,
    floor: 5,
    enemyPool: [
      { enemyId: 'foundation_rock_tortoise', weight: 5 },
      { enemyId: 'foundation_mud_golem', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 14,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'foundation_mud_golem',
  },

  {
    id: 'foundation_floor_6',
    name: 'Màn 3.6',
    description: 'Đá càng dày đặc, đám yêu Thổ hành to khỏe hơn hẳn — đòn đánh nào cũng nặng trịch.',
    requiredRealmId: 'foundation_establishment',
    requiredRealmLevel: 6,
    chapter: 3,
    floor: 6,
    enemyPool: [
      { enemyId: 'foundation_ferocious_rock_tortoise', weight: 5 },
      { enemyId: 'foundation_ferocious_mud_golem', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 15,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'foundation_ferocious_mud_golem',
  },

  {
    id: 'foundation_floor_7',
    name: 'Màn 3.7',
    description: 'Thiết mãng lệnh — khoáng kim lấp lánh, Đoạn Nhận Ưng Vương lượn vòng trên cao săn mồi.',
    requiredRealmId: 'foundation_establishment',
    requiredRealmLevel: 7,
    chapter: 3,
    floor: 7,
    enemyPool: [
      { enemyId: 'foundation_metal_beetle_swarm', weight: 5 },
      { enemyId: 'foundation_blade_hawk_king', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 16,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'foundation_blade_hawk_king',
  },

  {
    id: 'foundation_floor_8',
    name: 'Màn 3.8',
    description: 'Khoáng kim dày đặc hơn, kim trùng và ưng vương nơi đây đã cứng cáp khác thường.',
    requiredRealmId: 'foundation_establishment',
    requiredRealmLevel: 8,
    chapter: 3,
    floor: 8,
    enemyPool: [
      { enemyId: 'foundation_ferocious_metal_beetle_swarm', weight: 5 },
      { enemyId: 'foundation_ferocious_blade_hawk_king', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 17,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'foundation_ferocious_blade_hawk_king',
  },

  {
    id: 'foundation_floor_9',
    name: 'Màn 3.9',
    description: 'Hàn thạch đàm — hơi nước lạnh buốt, Vụ Cáp lướt nhanh dưới mặt nước, Giao Sủng ẩn mình chờ đợi.',
    requiredRealmId: 'foundation_establishment',
    requiredRealmLevel: 9,
    chapter: 3,
    floor: 9,
    enemyPool: [
      { enemyId: 'foundation_mist_shark', weight: 5 },
      { enemyId: 'foundation_flood_dragon_whelp', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 18,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'foundation_flood_dragon_whelp',
  },

  {
    id: 'foundation_floor_10',
    name: 'Màn 3.10',
    description: 'Đáy hàn thạch đàm — Giao Sủng Hung cuồng nộ ngự trị, chặng thử thách cuối cùng trước khi người tu sĩ Trúc Cơ tìm kiếm cơ duyên kế tiếp.',
    requiredRealmId: 'foundation_establishment',
    requiredRealmLevel: 10,
    chapter: 3,
    floor: 10,
    enemyPool: [
      { enemyId: 'foundation_ferocious_mist_shark', weight: 5 },
      { enemyId: 'foundation_ferocious_flood_dragon_whelp', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 19,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'foundation_ferocious_flood_dragon_whelp',
  },
]

export const STAGES: Stage[] = [...normalizedStages, ...foundationStages]
