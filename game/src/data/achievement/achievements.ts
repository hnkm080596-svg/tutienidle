import type { AchievementDefinition, AchievementObjective, AchievementBand, AchievementCounter } from '../../core/achievement/Achievement'
import type { Reward } from '../../core/reward/Reward'

const count = (counter: Extract<AchievementObjective, { kind: 'counter' }>['counter'], target: number): AchievementObjective => ({ kind: 'counter', counter, target })
const facts = (...keys: string[]): AchievementObjective => ({ kind: 'facts', keys })
const add = (id: string, title: string, description: string, band: AchievementBand, reward: Reward, objective: AchievementObjective): AchievementDefinition => ({ id, title, description, band, reward, objective })

const m: AchievementBand = 'mortal'
const q: AchievementBand = 'qi_refining'
const f: AchievementBand = 'foundation_establishment'
const fixed: AchievementBand = 'fixed'
const stones = (spiritStone: number, cultivation: number): Reward => ({ spiritStone, cultivation })
const insight = (spiritStone: number, skillInsight: number): Reward => ({ spiritStone, skillInsight })

/** Authored selectors; the engine must not embed material/enemy content identities. */
export const ACHIEVEMENT_MATERIAL_COUNTERS: Readonly<Record<string, AchievementCounter>> = Object.freeze({
  material_spirit_wood_decade: 'mortal_wood',
  material_spirit_ore_decade: 'spirit_ore',
  tu_linh_thao_qi_refining_decade: 'qi_herb',
})
export const ACHIEVEMENT_ENEMY_COUNTERS: Readonly<Record<string, AchievementCounter>> = Object.freeze({
  mortal_wild_boar: 'wild_boar', bandit: 'bandit', foundation_spirit_wolf: 'spirit_wolf',
})

/** All 25 rows from ACHIEVEMENTS-DAILY-WEEKLY.md; no reward scaling occurs here. */
export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  add('ach_m01_lam_thu', 'Người giữ rừng', 'Nhận 20 Thập Niên Linh Mộc mới.', m, stones(5, 10), count('mortal_wood', 20)),
  add('ach_m02_tru_tich', 'Trừ hung thú', 'Hạ 10 Dã Trư phá rừng.', m, stones(8, 15), count('wild_boar', 10)),
  add('ach_m03_mach_san', 'Khai khoáng nhập môn', 'Nhận sản phẩm từ 3 lứa sản xuất.', m, stones(8, 15), count('production_batches', 3)),
  add('ach_m04_khoang_anh', 'Khoáng ảnh', 'Nhận 15 Thập Niên Linh Khoáng mới.', m, stones(8, 20), count('spirit_ore', 15)),
  add('ach_m05_khi_ho', 'Khí hộ thân', 'Trang bị 2 món khác nhau.', m, stones(10, 20), count('unique_equipment', 2)),
  add('ach_m06_the_mach', 'Thân như bàn thạch', 'Tăng Luyện Thể thành công 5 lần.', m, stones(10, 25), count('body_all', 5)),
  add('ach_m07_hung_tru', 'Trấn mạch rừng già', 'Thắng ải mortal_dong_10.', m, stones(14, 30), facts('stage:mortal_dong_10')),
  add('ach_q01_nhap_hoa', 'Người dẫn Hỏa', 'Đạt Luyện Khí và nhập đạo hệ Hỏa.', q, insight(4, 100), facts('realm:qi_refining', 'element:fire')),
  add('ach_q02_tru_tac', 'Thanh trừ sơn tặc', 'Hạ 20 Sơn Tặc Thanh Vân.', q, insight(8, 150), count('bandit', 20)),
  add('ach_q03_linh_thao', 'Thảo dược sư', 'Nhận 20 Tụ Linh Thảo Luyện Khí mới.', q, insight(8, 150), count('qi_herb', 20)),
  add('ach_q04_dan_su', 'Luyện đan sư', 'Luyện đan thành công 5 lò.', q, insight(10, 200), count('alchemy_crafts', 5)),
  add('ach_q05_cong_phap', 'Hỏa mạch thông suốt', 'Công Pháp từng đạt rank 3 trong grade hợp lệ.', q, insight(10, 300), facts('technique:rank3')),
  add('ach_q06_toi_luyen', 'Tôi luyện pháp khí', 'Cường hóa thành công 3 lần.', q, insight(12, 300), count('enhancements', 3)),
  add('ach_q07_son_tac_vuong', 'Phá hỏa trại', 'Thắng ải qi_refining_abyssal_pool.', q, insight(16, 400), facts('stage:qi_refining_abyssal_pool')),
  add('ach_f01_kien_co', 'Kiến Cơ thành đạo', 'Tiến vào Trúc Cơ thành công.', f, insight(4, 500), facts('realm:foundation_establishment')),
  add('ach_f02_bach_lang', 'Người nghe tiếng sói', 'Hạ 30 Linh Lang.', f, insight(7, 800), count('spirit_wolf', 30)),
  add('ach_f03_hau_son_khoang', 'Huyền khoáng hậu sơn', 'Nhận tổng cộng 30 Thập Niên Linh Khoáng.', f, insight(8, 900), count('spirit_ore', 30)),
  add('ach_f04_dong_hanh', 'Đồng đạo tương trợ', 'Sở hữu đồng hành beta và xếp vào đội hình.', f, insight(8, 1000), facts('companion:entitled', 'companion:assigned')),
  add('ach_f05_tran_phap', 'Kết trận hộ sơn', 'Thắng 3 trận với đồng hành trong đội hình từ đầu trận.', f, insight(10, 1200), count('formed_victories', 3)),
  add('ach_f06_than_the', 'Huyền thể sơ khai', 'Tăng Luyện Thể 5 lần sau khi vào Trúc Cơ.', f, insight(10, 1500), count('body_foundation', 5)),
  add('ach_f07_lang_vuong', 'Bình định cổ mạch', 'Thắng ải foundation_floor_10.', f, insight(16, 2000), facts('stage:foundation_floor_10')),
  add('ach_story_thanh_van_sealed', 'Thanh Vân yên mạch', 'Nhận thưởng của cả 21 chính tuyến Thanh Vân.', fixed, insight(1000, 2000), facts(...Array.from({ length: 21 }, (_, i) => `quest:tvdm2_main_${String(i + 1).padStart(2, '0')}`))),
  add('ach_meta_three_boss', 'Tam chiến định mạch', 'Thắng trọn ba ải boss Thanh Vân.', fixed, insight(500, 1000), facts('stage:mortal_dong_10', 'stage:qi_refining_abyssal_pool', 'stage:foundation_floor_10')),
  add('ach_meta_day_7', 'Thất nhật tinh cần', 'Nhận ít nhất một daily trong 7 ngày UTC liên tiếp.', fixed, insight(250, 500), { kind: 'daily_streak', target: 7 }),
  add('ach_meta_week_4', 'Bốn tuần bền chí', 'Nhận ít nhất 4 weekly qua tối thiểu 2 tuần.', fixed, insight(400, 800), { kind: 'weekly_claims', target: 4, minimumPeriods: 2 }),
]
