import type { Stage } from '../../core/stage/Stage'
import { defineChapterStages, type ChapterConfig } from './ChapterStages'

// Spec v3 D9 (2026-09-11): the 30 stages are BUILT by
// defineChapterStages - the 3 ChapterConfig literals below are the ONLY
// hand-authored content (ids / names / descriptions / act rosters).
// All floor rules (totalEnemyCount = 9 + floor, waves split,
// bossEnemyId on floor 10 only, perfectClearTurnLimit, elite ramp,
// spawnIntervalSeconds) live in the builder - one owner.
//
// BETA SCOPE LOCK v2: each chapter's roster is exactly 3 distinct
// normal species (floor bands 1-3 / 4-6 / 7-9) + 1 act boss = the final
// 12-identity beta roster. The stage data is the allow-list; dormant
// catalog species can never roll into a beta stage.
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
    'Khu rừng đầu núi, nơi bầy Dã Lang lang thang săn mồi — thử thách đầu tiên cho tu sĩ mới nhập môn.',
    'Rừng sâu hơn hẳn Thanh Vân Cốc, Dã Lang nơi đây săn mồi thành bầy và hung hãn hơn.',
    'Rìa rừng giáp hẻm núi tro nóng, bầy Dã Lang lì lợm nhất chặn giữ đường lên.',
    'Hẻm núi phủ tro nóng, Viêm Hồ tinh ranh lẩn khuất quanh những khe nứt phun lửa.',
    'Đồng cát xém cháy, Viêm Hồ lướt qua từng luồng lửa — mỗi bước tiến đều bị theo dõi.',
    'Dãy núi đá đỏ nóng, Viêm Hồ nơi đây đã quen với máu tu sĩ, tàn nhẫn hơn hẳn.',
    'Đỉnh núi phủ khoáng, Trùn Đất khổng lồ ngầm dưới đất làm rung chuyển từng vách núi.',
    'Hầm khoáng sâu, Trùn Đất đào hang chằng chịt trong bóng tối, nuốt trọn kẻ xâm nhập.',
    'Đầm lầy mù sương huyền bí, Trùn Đất rình mập dưới lớp bùn đen.',
    'Vực nước sâu thẳm cuối Huyền Đàm Trạch — nơi Hung Giao Xà ngự trị, chặng thử thách cuối cùng trước ngưỡng cửa Trúc Cơ.',
  ],
  roster: {
    normals: ['wild_wolf', 'flame_fox', 'giant_earthworm'],
    boss: 'ferocious_flood_serpent',
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
    'Cửa hang đầu tiên nơi chân núi, bầy Dã Trư cào đất kiếm mồi — thử thách đầu đời của 1 phàm nhân.',
    'Hang sâu hơn, Dã Trư ở đây đã dữ tợn hơn hẳn cửa hang ngoài.',
    'Đoạn hang cuối cùng còn mùi cỏ dại, Dã Trư lớn nhất đàn lì lợm chặn lối.',
    'Vách hang khô nóng, Man Hổ lang thang tìm mồi giữa nắng gắt.',
    'Nắng càng gắt, Man Hổ càng hung hãn — không còn là con mồi dễ dàng.',
    'Sào huyệt mãnh thú, Man Hổ nơi đây đã nếm máu người — tiếng gầm rung cả vách hang.',
    'Hang ngập nước mát, Thủy Lang săn mồi dưới ánh sáng mờ.',
    'Nước càng sâu, Thủy Lang càng nhanh và đoàn kết — bóng sói lướt trên mặt sóng.',
    'Hồ nước ngầm cuối hang, bầy Thủy Lang hung bạo nhất canh giữ lãnh địa.',
    'Đáy hang ngập nước sâu nhất — Hung Cự Ngạc ngự trị, chặng thử thách cuối cùng của kiếp phàm nhân, trước ngưỡng cửa Luyện Khí.',
  ],
  roster: {
    normals: ['mortal_wild_boar', 'mortal_savage_tiger', 'mortal_water_wolf'],
    boss: 'mortal_ferocious_giant_crocodile',
  },
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
    'Hậu sơn Thanh Vân, tro nóng phủ tán cổ thụ — Dực Hỏa Khuyển dắt bầy dò lối, chặng thử thách đầu tiên cho tu sĩ Trúc Cơ.',
    'Sườn núi khói mỏ, Dực Hỏa Khuyển nơi đây đã học cách săn theo mùi linh khí.',
    'Miệng hỏa địa đầu tiên, bầy Dực Hỏa Khuyển hung bạo nhất gầm giữa tro tàn.',
    'Vùng đất hỏa diệm đỏ rực, Sa Hắc chui rúc dưới lớp cát nóng chờ con mồi lơi mỏi.',
    'Sa mạc càng sâu, Sa Hắc càng đông và càng độc — một cái chạm cũng đủ trả giá.',
    'Ổ độc dưới cồn cát, Sa Hắc nơi đây săn theo đàn — vũ khí của chúng là cả sa mạc.',
    'Thạch cốc hậu sơn, Nê Cự Nhân lầm lũi trấn giữ từng vách đá dựng đứng.',
    'Đất đá càng dày, Nê Cự Nhân càng to khỏe — mỗi bước chân đều rung chuyển thạch cốc.',
    'Lòng cốc sâu nhất, Nê Cự Nhân cổ đại nằm nghỉ — đánh thức chúng là đánh cược mạng sống.',
    'Đáy hàn thạch đàm — Hung Giao Sủng cuồng nộ ngự trị, chặng thử thách cuối cùng trước khi tu sĩ Trúc Cơ tìm kiếm cơ duyên kế tiếp.',
  ],
  roster: {
    normals: ['foundation_lava_hound', 'foundation_sand_scorpion', 'foundation_mud_golem'],
    boss: 'foundation_ferocious_flood_dragon_whelp',
  },
}

export const STAGES: Stage[] = [
  ...defineChapterStages(QI_CHAPTER),
  ...defineChapterStages(MORTAL_CHAPTER),
  ...defineChapterStages(FOUNDATION_CHAPTER),
]
