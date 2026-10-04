import type { Stage } from '../../core/stage/Stage'
import { defineChapterStages, type ChapterConfig } from './ChapterStages'

// Spec v3 D9 (2026-09-11): the 30 stages are BUILT by
// defineChapterStages - the 3 ChapterConfig literals below are the ONLY
// hand-authored content (ids / names / descriptions / act rosters).
// All floor rules (totalEnemyCount = 9 + floor, waves split,
// bossEnemyId on floor 10 only, perfectClearTurnLimit, elite ramp,
// spawnIntervalSeconds) live in the builder - one owner.
//
// BETA SCOPE LOCK v3 (roster remap, Minh ruling 2026-10-04): each
// chapter's roster is ONE species family - the same normal id on all
// floor bands + its king as the act boss = 6 identities total. The
// stage data is the allow-list; dormant catalog species can never roll
// into a beta stage.
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
    'Khu rừng đầu núi, Sơn Tặc lập đồn chặn đường thu mãi lộ — thử thách đầu tiên cho tu sĩ mới nhập môn.',
    'Rừng sâu hơn hẳn Thanh Vân Cốc, Sơn Tặc nơi đây phục kích thành bọn và hung hãn hơn.',
    'Rìa rừng giáp hẻm núi tro nóng, bọn Sơn Tặc lì lợm nhất chặn giữ đường lên.',
    'Hẻm núi phủ tro nóng, Sơn Tặc lẩn khuất quanh những khe nứt rình cướp bóc.',
    'Đồng cát xém cháy, Sơn Tặc rình rập từng luồng bụi — mỗi bước tiến đều bị theo dõi.',
    'Dãy núi đá đỏ nóng, Sơn Tặc nơi đây đã quen với máu tu sĩ, tàn nhẫn hơn hẳn.',
    'Đỉnh núi phủ khoáng, Sơn Tặc dựng trại lớn ngầm dưới đá, đe dọa từng vách núi.',
    'Hầm khoáng sâu, Sơn Tặc đào hang chằng chịt trong bóng tối, cướp trọn kẻ xâm nhập.',
    'Đầm lầy mù sương huyền bí, Sơn Tặc bố trí mai phục dưới lớp sương dày đặc.',
    'Doanh trại cuối Huyền Đàm Trạch — nơi Sơn Tặc Vương ngự trị, chặng thử thách cuối cùng trước ngưỡng cửa Trúc Cơ.',
  ],
  roster: {
    normals: ['bandit', 'bandit', 'bandit'],
    boss: 'ferocious_bandit',
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
    'Cửa hang đầu tiên nơi chân núi, bầy Heo Rừng cào đất kiếm mồi — thử thách đầu đời của một phàm nhân.',
    'Hang sâu hơn, Heo Rừng ở đây đã dữ tợn hơn hẳn cửa hang ngoài.',
    'Đoạn hang cuối cùng còn mùi cỏ dại, Heo Rừng lớn nhất đàn lì lợm chặn lối.',
    'Vách hang khô nóng, bầy Heo Rừng lang thang kiếm mồi giữa nắng gắt.',
    'Nắng càng gắt, heo rừng càng hung hãn — không còn là con mồi dễ dàng.',
    'Sào huyệt mãnh trư, heo rừng nơi đây đã nếm máu người — tiếng hí rung cả vách hang.',
    'Hang ngập nước mát, bầy Heo Rừng lội bùn săn mồi dưới ánh sáng mờ.',
    'Bùn càng sâu, heo rừng càng nhanh và đoàn kết — bóng trư lướt trên mặt nước đục.',
    'Hồ ngầm cuối hang, bầy Heo Rừng hung bạo nhất canh giữ lãnh địa của Vương.',
    'Đáy hang ngập nước sâu nhất — Heo Rừng Vương ngự trị, chặng thử thách cuối cùng của kiếp phàm nhân, trước ngưỡng cửa Luyện Khí.',
  ],
  roster: {
    normals: ['mortal_wild_boar', 'mortal_wild_boar', 'mortal_wild_boar'],
    boss: 'mortal_ferocious_wild_boar',
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
    'Hậu sơn Thanh Vân, bóng trắng Linh Lang lướt qua tán cổ thụ — chặng thử thách đầu tiên cho tu sĩ Trúc Cơ.',
    'Sườn núi khói mỏ, Linh Lang nơi đây đã học cách săn theo mùi linh khí.',
    'Miệng hỏa địa đầu tiên, bầy Linh Lang hung bạo nhất gầm giữa tro tàn.',
    'Vùng đất mộc khí dày đặc, Linh Lang chạy dưới tán rừng chờ con mồi lơi mỏi.',
    'Rừng càng sâu, Linh Lang càng đông và càng hiểm — một cái chạm cũng đủ trả giá.',
    'Ổ linh thú dưới tán cổ mộc, Linh Lang nơi đây săn theo đàn — vũ khí của chúng là cả khu rừng.',
    'Thạch cốc hậu sơn, Linh Lang lầm lũi rình giữa từng vách đá dựng đứng.',
    'Vách đá càng cao, Linh Lang càng lắm bầy — mỗi bước chân đều lọt vào phục kích.',
    'Lòng cốc sâu nhất, Linh Lang cổ đại nằm nghỉ — đánh thức chúng là đánh cược mạng sống.',
    'Đáy cổ mộc đàm — Linh Lang Vương cuồng nộ ngự trị, chặng thử thách cuối cùng trước khi tu sĩ Trúc Cơ tìm kiếm cơ duyên kế tiếp.',
  ],
  roster: {
    normals: ['foundation_spirit_wolf', 'foundation_spirit_wolf', 'foundation_spirit_wolf'],
    boss: 'foundation_ferocious_spirit_wolf',
  },
}

export const STAGES: Stage[] = [
  ...defineChapterStages(QI_CHAPTER),
  ...defineChapterStages(MORTAL_CHAPTER),
  ...defineChapterStages(FOUNDATION_CHAPTER),
]
