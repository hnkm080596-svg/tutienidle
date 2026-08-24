import type { Stats } from '../stats/StatBlock'
import type { LaneIndex } from '../battle/BattleLane'
import type { EnemyArchetype } from '../enemy/EnemyArchetype'
import type { TribulationPhase, BossEnrage } from '../enemy/TribulationPhase'
import type { SkillRuntimeStats } from '../skill/SkillRuntimeStats'

export type CombatEntityType =
  | 'player'
  | 'enemy'

export interface CombatEntity {
  id: string

  name: string

  type: CombatEntityType

  // Stats trước khi cộng buff phát sinh trong trận (talisman, skill
  // buff/debuff...). `stats` là giá trị hiệu lực hiện tại, được
  // BattleSystem recompute mỗi tick từ baseStats + buff đang active
  // trên entity này — xem Battle.playerBuffs/enemyBuffs.
  baseStats: Stats

  stats: Stats

  // Tham số riêng của skill/path, tách khỏi character Stats. Optional để
  // enemy và fixture không dùng skill không phải cấp một object toàn số 0.
  skillStats?: SkillRuntimeStats

  // Snapshot level của các skill đã học lúc bắt đầu trận. Skill vẫn nhận XP
  // và level-up trong progression, nhưng damage trong trận đọc snapshot này
  // để build mới chỉ có hiệu lực từ trận kế tiếp.
  skillLevels?: Readonly<Record<string, number>>

  currentHp: number

  maxHp: number

  // MP/Rage là state "sống" giống currentHp — chỉ tồn tại trong lúc
  // battle, không persist vào PlayerData (xem ghi chú trong
  // core/player/Player.ts).
  currentMp: number

  currentRage: number

  // Kiếm Tu (2026-08-15) — Kiếm Ý CHIẾN ĐẤU, state "sống" như
  // currentRage nhưng pool RIÊNG (0-9999, xem CombatTypes.ts's
  // MAX_SWORD_INTENT), tích theo cơ chế khác hẳn Rage (mỗi kiếm của
  // Ngự Kiếm Thuật ĐÁNH TRÚNG +1, không theo % damage gây/nhận).
  currentSwordIntent: number

  // Thể Tu (Combat Rework Phase 7) — Momentum CHIẾN ĐẤU, cùng mô hình
  // currentSwordIntent nhưng pool 0-100 (xem CombatTypes.ts's
  // MAX_MOMENTUM), tích qua Skill.grantsMomentumPerHit.
  currentMomentum: number

  // Hỏa Tu Pure (Plans/FirePath mục 7, 2026-08-21) — Hỏa Thế CHIẾN
  // ĐẤU, cùng mô hình currentSwordIntent/currentMomentum nhưng pool
  // 0-5 (xem CombatTypes.ts's MAX_HOA_THE), tích qua Skill.
  // grantsHoaThePerCast × source.skillStats.hoaTheGainPerCast (0 nếu chưa
  // mua node "Tụ Hỏa" — xem BattleSystem.castSkill()), TỰ GIẢM dần
  // theo thời gian nếu không cast tiếp (BattleSystem.updateHoaThe()).
  // Chưa cấp hiệu ứng gì (đúng tinh thần "chưa vội +damage" của spec —
  // nền tảng cho Major Pure ở Kim Đan trở đi).
  currentHoaThe: number

  // Thổ Tu Pure (Plans/EarthPath mục XV, 2026-08-21) — Thổ Thế CHIẾN
  // ĐẤU, cùng mô hình currentHoaThe nhưng KHÔNG tự giảm theo thời gian
  // (doc không nhắc tới decay, khác Hỏa Thế) — chỉ tích qua Skill.
  // grantsThoThePerCast × source.skillStats.thoTheGainPerCast (0 nếu chưa
  // mua "Thổ Thế" — xem BattleSystem.castSkill()), pool 0-5 (xem
  // CombatTypes.ts's MAX_THO_THE). Cũng chưa cấp hiệu ứng +damage nào
  // riêng — vai trò thật của nó là kích hoạt AOE+Knockback thật (đọc
  // trực tiếp earthAoeRadius/earthKnockbackDistance, KHÔNG qua stack
  // này), currentThoThe thuần là counter theo đúng tinh thần doc "không
  // gán thêm hiệu ứng tuỳ tiện vào từng stack ở giai đoạn này".
  currentThoThe: number

  // Kim Tu Trúc Cơ Pure (Plans/KimPath mục 9/11/12, 2026-08-21) — Kim
  // Thế CHIẾN ĐẤU, pool 0-(MAX_KIM_THE + stats.kimTheMaxStacksBonus).
  // Tích qua Skill.grantsKimThePerProc CHỈ khi Xuất Huyết áp THÀNH CÔNG
  // (xem SkillEffectSystem.ts's apply(), case 'ailment' — KHÁC hẳn
  // currentHoaThe/currentThoThe: gate theo ROLL, không phải mỗi lần
  // cast). Tự giảm CHẬM theo timeSinceLastBleedProc bên dưới (xem
  // BattleSystem.updateKimThe()) — 1 tầng mỗi
  // KIM_THE_DECAY_INTERVAL_SECONDS giây KHÔNG proc mới, không phải
  // continuous per-second như Hỏa Thế. CÓ cấp hiệu ứng thật (KHÁC Hỏa
  // Thế/Thổ Thế) — đọc trực tiếp trong AilmentSystem.
  // calculateDamagePerSecond() cho DoT element 'metal'.
  currentKimThe: number

  // Kim Tu Trúc Cơ Pure — giây kể từ lần cuối currentKimThe TĂNG (reset
  // về 0 mỗi lần proc thành công), dùng để gate decay 1-tầng-mỗi-N-giây
  // ở updateKimThe(). Vô nghĩa nếu currentKimThe đã về 0.
  timeSinceLastBleedProc: number

  // Kim Tu ("Thiêu Huyết" reaction, Hỏa+Kim, Plans/KimPath mục 5) — %
  // maxHp ĐÃ bị Reaction này trừ vĩnh viễn (trần MAX_HP_REDUCTION_CAP_
  // PERCENT, xem ReactionManager.ts), tránh boss bị xoá HP quá nhanh
  // qua nhiều lần Reaction liên tiếp. Optional — undefined = 0, CHỈ
  // entity nào từng dính Thiêu Huyết mới có giá trị, không cần touch
  // mọi fixture/factory hiện có (khác currentHoaThe/currentThoThe/
  // currentKimThe — những field đó BẮT BUỘC vì luôn có giá trị nền 0
  // ngay từ đầu trận, cái này chỉ phát sinh khi thật sự bị Reaction).
  totalMaxHpReductionPercent?: number

  // Kim Tu ("Huyết Phá", Plans/magicpathgeneral Phase 13, 2026-08-21) —
  // charge CHIẾN ĐẤU, cùng mô hình currentKimThe (tích theo ROLL Xuất
  // Huyết THÀNH CÔNG) nhưng KHÔNG có decay — chạm MAX_HUYET_PHA thì
  // consume/reset về 0 + burst damage. Optional (KHÔNG bắt buộc như
  // currentHoaThe/currentKimThe) — cùng lý do totalMaxHpReductionPercent
  // ở trên: 1 field reaction-like hiếm gặp, không phải counter mọi
  // entity cần có nền từ đầu trận, không cần touch mọi fixture/factory
  // hiện có. undefined coi như 0.
  currentHuyetPha?: number

  // Ward — máu phụ hấp thụ damage TRƯỚC currentHp (xem
  // CombatSystem.resolveHit()). State "sống" như currentHp/currentMp,
  // reset về 0 lúc BattleSystem.start()/createBattleEnemy().
  currentWard: number

  // Pháp Tu (Thổ Tu, 2026-08-15) — giây đã trôi qua kể từ lần cuối
  // NHẬN 1 đòn trúng (reset về 0 trong CombatSystem.resolveAttack()
  // khi hit thật sự landed lên entity này) — gate cho
  // wardRegenPerSecond (chỉ hồi Ward sau khi không bị đánh trúng đủ
  // lâu, xem BattleSystem.updateRegen()'s WARD_REGEN_DELAY_SECONDS).
  // wardRegenPerSecond từng là "dead stat" (có field, chưa từng được
  // tick ở đâu) — cùng tình trạng hpRegenPerSecond đã gặp trước đó.
  timeSinceLastHitTaken: number

  // Vị trí (0-based) trong REALMS — dùng để tính Realm Pressure giữa
  // 2 bên combat (xem RealmPressure.ts). Cùng ý nghĩa với
  // realmSystem.getRealmIndex(), tính sẵn lúc convert sang CombatEntity
  // để CombatSystem không phải biết về PlayerData/Enemy.
  realmIndex: number

  // Bậc Nhập Đạo (1-6, xem core/player/Player.ts's breakthroughGrade) —
  // giảm Realm Pressure chịu/gây ra (xem RealmPressure.ts). CHỈ player
  // có giá trị (enemyToCombatEntity() để undefined) — enemy không có
  // khái niệm "chất lượng đột phá".
  breakthroughGrade?: number

  // Vị trí world-space trên trục X (đơn vị chung — xem
  // core/battle/BattleLane.ts) — dùng cho né/đuổi thật theo khoảng
  // cách (BattleSystem.resolveMovement()) và va chạm missile
  // (MissileSystem). Không có trục Y — sân đấu chỉ 1 chiều ngang.
  x: number

  // Combat Grid Rework (2026-08-24) — `row` là LANE thật trên grid
  // 10×16 (xem BattleGrid.ts): targeting/AOE query đọc row + column
  // (column = làm tròn `x`). Player đứng ở HERO_LANE_INDEX đại diện;
  // quái random mỗi lần spawn trừ Boss luôn HERO_LANE_INDEX.
  row: LaneIndex

  alive: boolean

  // Cờ Elite ("Tinh Anh") cho Combat HUD (thanh máu luôn hiện) — xem
  // core/enemy/Enemy.ts's createEliteVariant(). Player luôn falsy
  // (không set trong playerToCombatEntity()).
  isElite?: boolean

  // Core Loop Foundation checklist (Mục BOSS) — tier RIÊNG, tách hẳn
  // isElite (xem createBossVariant()). Combat HUD ưu tiên hiện Boss
  // trước Elite nếu cả 2 cùng có mặt.
  isBoss?: boolean

  // Nhãn hành vi nhẹ (Mục MONSTER) — đọc bởi BattleSystem.
  // resolveMovement()/updateEnemyAttacks(). Không set = 'melee'.
  archetype?: EnemyArchetype

  // Đột Phá Trúc Cơ (Phase 4) — mốc HP leo thang sức mạnh của quái
  // Kiếp, xem BattleSystem.updateTribulationPhases(). Combat Rework
  // Phase 4 generic hoá field này cho Boss thường luôn (xem
  // TribulationPhase.ts).
  tribulationPhases?: TribulationPhase[]

  // Combat Rework Phase 4 (Boss Mechanics) — DPS check, xem
  // TribulationPhase.ts's BossEnrage, BattleSystem.updateEnrage().
  enrage?: BossEnrage

  // Thể Tu (Combat Rework Phase 7) — thanh máu phụ CHỐNG PHÁ, tách
  // hẳn currentHp: Thể Tu skill (Skill.breakDamagePerHit) trừ riêng
  // thanh này mỗi đòn trúng, KHÔNG qua Damage Engine/mitigation (giống
  // tinh thần Detonate — bỏ qua Armor/Resistance). Chạm 0 thì Stagger
  // (áp ailment 'choang' có sẵn) rồi reset về breakGaugeMax, xem
  // BattleSystem's missile-resolve callback. undefined = entity này
  // không có Break (quái thường/player) — CHỈ Boss/quái lớn khai.
  breakGaugeMax?: number

  currentBreakGauge?: number

  // Cast Time (2026-08-21) — entity đang "niệm" 1 skill có Skill.castTime
  // > 0 (xem BattleSystem.updateCasting()). undefined = không casting
  // (mọi entity mặc định — factory functions KHÔNG cần set, giống
  // currentHuyetPha/totalMaxHpReductionPercent). castTimeRemaining đếm
  // ngược về 0 thì hiệu ứng thi triển thật (resolveSkillEffects()),
  // castTimeTotal giữ NGUYÊN suốt quá trình niệm — chỉ dùng để UI vẽ %
  // tiến độ (castTimeRemaining / castTimeTotal), không ảnh hưởng logic.
  castingSkillId?: string
  castTimeRemaining?: number
  castTimeTotal?: number
}
