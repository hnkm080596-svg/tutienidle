import type { Stage } from '../../core/stage/Stage'
import { defineChapterStages, type ChapterConfig } from './ChapterStages'

// Spec v3 D9 (2026-09-11): the 30 stages are BUILT by
// defineChapterStages - the 3 ChapterConfig literals below are the ONLY
// hand-authored content (ids / names / descriptions / species pairs /
// pool overrides). All floor rules (totalEnemyCount = 9 + floor, waves
// split, bossEnemyId on floor 10 only, perfectClearTurnLimit 3/5,
// spawnIntervalSeconds) live in the builder - one owner.
//
// STAGES export order is FROZEN (save/zone consumers depend on it):
// qi_refining chapter first, then mortal, then foundation - the same
// order the legacy literals used.

const QI_CHAPTER: ChapterConfig = {
  realmId: 'qi_refining',
  chapter: 2,
  ids: [
    'qi_refining_forest',
    'qi_refining_deep_forest',
    'qi_refining_ember_canyon',
    'qi_refining_scorched_ridge',
    'qi_refining_sand_plain',
    'qi_refining_stone_range',
    'qi_refining_blade_peak',
    'qi_refining_mineral_pit',
    'qi_refining_mystic_marsh',
    'qi_refining_abyssal_pool',
  ],
  names: (floor) => `Quật ${floor}`,
  descriptions: [
    'Khu rừng đầu núi, nơi Dã Lang và Sơn Tặc lang thang — thử thách đầu tiên cho tu sĩ mới nhập môn.',
    'Khu rừng sâu hơn hẳn Thanh Vân Cốc, nơi Lâm Yêu ẩn mình giữa tán cây rậm rạp.',
    'Hẻm núi phủ tro nóng, Viêm Hồ tinh ranh lẩn khuất quanh những khe nứt phun lửa.',
    'Sườn núi cháy xém cao hơn Xích Diễm Cốc, Nham Trư hung hãn tụ tập đông hơn.',
    'Đồng bằng cát vàng mênh mông, Sa Miêu di chuyển nhanh như gió cuốn.',
    'Dãy núi đá vàng sừng sững, Nham Hùng trấn giữ từng vách đá dựng đứng.',
    'Đỉnh núi phủ khoáng kim sắc trắng, Đoạn Nhận Ưng lượn vòng săn mồi từ trên cao.',
    'Hầm khoáng sâu dưới Bạch Nhận Sơn, Kim Giáp Trùng đào hang chằng chịt trong bóng tối.',
    'Đầm lầy mù sương huyền bí, Đàm Oa và Giao Xà ẩn mình dưới lớp nước đen.',
    'Vực nước sâu thẳm cuối Huyền Đàm Trạch — nơi Giao Xà ngự trị, chặng thử thách cuối cùng trước ngưỡng cửa Trúc Cơ.',
  ],
  speciesByFloor: [
    { common: 'wild_wolf', elite: 'bandit' },
    { common: 'ferocious_wild_wolf', elite: 'forest_fiend' },
    { common: 'flame_fox', elite: 'magma_boar' },
    { common: 'ferocious_flame_fox', elite: 'ferocious_magma_boar' },
    { common: 'sand_lynx', elite: 'rock_bear' },
    { common: 'ferocious_sand_lynx', elite: 'ferocious_rock_bear' },
    { common: 'blade_hawk', elite: 'metal_beetle' },
    { common: 'ferocious_blade_hawk', elite: 'ferocious_metal_beetle' },
    { common: 'pool_toad', elite: 'flood_serpent' },
    { common: 'ferocious_pool_toad', elite: 'ferocious_flood_serpent' },
  ],
  poolOverrides: {
    // Quat 1 keeps its 4-species tutorial pool - the override replaces
    // the standard 2-species pool and carries its own eliteChance.
    1: [
      { enemyId: 'wild_wolf', weight: 5 },
      { enemyId: 'bandit', weight: 3, eliteChance: 0.1 },
      { enemyId: 'mountain_hawk', weight: 4 },
      { enemyId: 'giant_earthworm', weight: 2 },
    ],
  },
}

const MORTAL_CHAPTER: ChapterConfig = {
  realmId: 'mortal',
  chapter: 1,
  ids: [
    'mortal_dong_1',
    'mortal_dong_2',
    'mortal_dong_3',
    'mortal_dong_4',
    'mortal_dong_5',
    'mortal_dong_6',
    'mortal_dong_7',
    'mortal_dong_8',
    'mortal_dong_9',
    'mortal_dong_10',
  ],
  names: (floor) => `Động ${floor}`,
  descriptions: [
    'Cửa hang đầu tiên nơi chân núi, Dã Trư và Sơn Khấu tranh nhau từng tấc đất — thử thách đầu đời của 1 phàm nhân.',
    'Hang sâu hơn, Dã Trư và Sơn Khấu ở đây đã dữ tợn hơn hẳn cửa hang ngoài.',
    'Vùng đất khô nóng, Hoang Cẩu và Man Hổ lang thang tìm mồi giữa nắng gắt.',
    'Nắng càng gắt, Hoang Cẩu và Man Hổ càng hung hãn — không còn là con mồi dễ dàng.',
    'Nền đất đá cứng, Thạch Miêu ẩn mình sau từng tảng đá, Nê Ngưu lầm lì trấn giữ lối đi.',
    'Đất đá dày hơn, Thạch Miêu và Nê Ngưu ở tầng này đã to khỏe rõ rệt.',
    'Vách hang lấp lánh khoáng kim, Ngân Hồ tinh ranh và Thiết Giáp Trư lì lợm cùng trấn giữ.',
    'Khoáng kim dày đặc hơn, Ngân Hồ và Thiết Giáp Trư ở đây đã cứng cáp hơn hẳn.',
    'Hang ngập nước, Thủy Lang săn mồi dưới ánh sáng mờ, Cự Ngạc ẩn mình chờ đợi.',
    'Đáy hang ngập nước sâu nhất — chặng thử thách cuối cùng của kiếp phàm nhân, trước ngưỡng cửa Luyện Khí.',
  ],
  speciesByFloor: [
    { common: 'mortal_wild_boar', elite: 'mortal_mountain_bandit' },
    { common: 'mortal_ferocious_wild_boar', elite: 'mortal_ferocious_mountain_bandit' },
    { common: 'mortal_feral_dog', elite: 'mortal_savage_tiger' },
    { common: 'mortal_ferocious_feral_dog', elite: 'mortal_ferocious_savage_tiger' },
    { common: 'mortal_stone_lynx', elite: 'mortal_mud_ox' },
    { common: 'mortal_ferocious_stone_lynx', elite: 'mortal_ferocious_mud_ox' },
    { common: 'mortal_silver_fox', elite: 'mortal_iron_boar' },
    { common: 'mortal_ferocious_silver_fox', elite: 'mortal_ferocious_iron_boar' },
    { common: 'mortal_water_wolf', elite: 'mortal_giant_crocodile' },
    { common: 'mortal_ferocious_water_wolf', elite: 'mortal_ferocious_giant_crocodile' },
  ],
}

const FOUNDATION_CHAPTER: ChapterConfig = {
  realmId: 'foundation_establishment',
  chapter: 3,
  ids: [
    'foundation_floor_1',
    'foundation_floor_2',
    'foundation_floor_3',
    'foundation_floor_4',
    'foundation_floor_5',
    'foundation_floor_6',
    'foundation_floor_7',
    'foundation_floor_8',
    'foundation_floor_9',
    'foundation_floor_10',
  ],
  names: (floor) => `Màn 3.${floor}`,
  descriptions: [
    'Hậu sơn Thanh Vân, yêu thú gỗ quấn quanh tán cổ thụ — chặng thử thách đầu tiên cho tu sĩ Trúc Cơ.',
    'Rừng sâu hơn, đám yêu thú Mộc hành ở đây đã bắt đầu có chút linh tính — lì lợm hơn hẳn.',
    'Vùng đất hỏa địa hậu sơn, khí nóng bốc lên ngùn ngụt — Dực Hỏa Khuyển và Sa Hắc ẩn mình trong tro tàn.',
    'Hỏa địa càng dữ, lũ yêu Hỏa hành hung tợn hơn — không còn là trò trẻ con.',
    'Thạch cốc hậu sơn — Thạch Giáp Quy lì lợm canh giữ, Nê Cự Nhân lầm lũi trấn lối đi.',
    'Đá càng dày đặc, đám yêu Thổ hành to khỏe hơn hẳn — đòn đánh nào cũng nặng trịch.',
    'Thiết mãng lệnh — khoáng kim lấp lánh, Đoạn Nhận Ưng Vương lượn vòng trên cao săn mồi.',
    'Khoáng kim dày đặc hơn, kim trùng và ưng vương nơi đây đã cứng cáp khác thường.',
    'Hàn thạch đàm — hơi nước lạnh buốt, Vụ Cáp lướt nhanh dưới mặt nước, Giao Sủng ẩn mình chờ đợi.',
    'Đáy hàn thạch đàm — Giao Sủng Hung cuồng nộ ngự trị, chặng thử thách cuối cùng trước khi người tu sĩ Trúc Cơ tìm kiếm cơ duyên kế tiếp.',
  ],
  speciesByFloor: [
    { common: 'foundation_wood_ape', elite: 'foundation_stone_fungus' },
    { common: 'foundation_ferocious_wood_ape', elite: 'foundation_ferocious_stone_fungus' },
    { common: 'foundation_lava_hound', elite: 'foundation_sand_scorpion' },
    { common: 'foundation_ferocious_lava_hound', elite: 'foundation_ferocious_sand_scorpion' },
    { common: 'foundation_rock_tortoise', elite: 'foundation_mud_golem' },
    { common: 'foundation_ferocious_rock_tortoise', elite: 'foundation_ferocious_mud_golem' },
    { common: 'foundation_metal_beetle_swarm', elite: 'foundation_blade_hawk_king' },
    { common: 'foundation_ferocious_metal_beetle_swarm', elite: 'foundation_ferocious_blade_hawk_king' },
    { common: 'foundation_mist_shark', elite: 'foundation_flood_dragon_whelp' },
    { common: 'foundation_ferocious_mist_shark', elite: 'foundation_ferocious_flood_dragon_whelp' },
  ],
}

export const STAGES: Stage[] = [
  ...defineChapterStages(QI_CHAPTER),
  ...defineChapterStages(MORTAL_CHAPTER),
  ...defineChapterStages(FOUNDATION_CHAPTER),
]
