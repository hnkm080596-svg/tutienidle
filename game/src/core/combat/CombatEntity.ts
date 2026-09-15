import type { Stats } from '../stats/StatBlock'
import type { LaneIndex } from '../battle/BattleLane'
import type { EnemyArchetype } from '../enemy/EnemyArchetype'
import type { TribulationPhase, BossEnrage } from '../enemy/TribulationPhase'
import type { EnemySpecialAttack } from '../enemy/Enemy'
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

  // MP là state "sống" giống currentHp — chỉ tồn tại trong lúc
  // battle, không persist vào PlayerData (xem ghi chú trong
  // core/player/Player.ts).
  currentMp: number

  // Kiếm Tu (2026-08-15) — Kiếm Ý CHIẾN ĐẤU, state "sống" như
  // currentRage nhưng pool RIÊNG (0-9999, xem CombatTypes.ts's
  // MAX_SWORD_INTENT), tích theo cơ chế khác hẳn Rage (mỗi kiếm của
  // Ngự Kiếm Thuật ĐÁNH TRÚNG +1, không theo % damage gây/nhận).
  currentSwordIntent: number

  // Kiếm Thế / Kiếm Ý tạm (spec 2026-08-29-kiem-the-kiem-y) — 2 pool
  // CHIẾN ĐẤU của 2 route Kiếm Tu sau khi chốt đường ở Quán Khí, cùng
  // mô hình "sống, không persist" như currentSwordIntent:
  //   currentKiemThe (route Kiếm Trận): pool 0-MAX_KIEM_THE, reset về
  //   0 mỗi trận, +số kiếm của trận mỗi lần cast (KiemTuResourceSystem
  //   .gainKiemTheOnFormationCast), tiêu hao cho ult Tru Tiên Kiếm
  //   Trận + buff +1% dmg mỗi 2 điểm (kiemTheDamageBonusPercent).
  //   currentKiemYTemp (route Bạt Kiếm): kiếm ý TẠM khởi đầu bằng số
  //   kiếm ý vĩnh viễn (tầng boss × 10), gain qua channel tick + dmg
  //   nhận vào, cap vĩnh viễn + MAX_KIEM_Y_TEMP_CAP. Tiêu hao ăn tạm
  //   TRƯỚC — vĩnh viễn bất khả xâm phạm (consumeKiemYTempFirst).
  // Optional (KHÔNG bắt buộc như currentSwordIntent) — cùng precedent
  // currentHuyetPha/totalMaxHpReductionPercent bên dưới: 2 field này
  // CHỈ có ý nghĩa với Kiếm Tu đã chốt route, mọi fixture/factory hiện
  // có của path khác không cần touch; undefined coi như 0 (mọi consumer
  // đọc qua `?? 0`, xem KiemTuResourceSystem).
  currentKiemThe?: number
  currentKiemYTemp?: number

  // Pháp Tu Đạo Sắc (spec 2026-08-30-phap-tu-dao-sac §2.3) — Thế
  // THUẦN HỆ Pháp Tu sau Lập Đạo, pool 0-MAX_THE (CombatTypes.ts),
  // tích +10 mỗi link chuỗi cast hoàn tất (+20 finisher E), XUYÊN
  // KILL trong phiên farm (không decay), reset về 0 khi bắn Ultimate.
  // Optional — cùng precedent currentKiemThe: chỉ Pháp Tu đã chốt
  // Thuần mới có ý nghĩa, mọi fixture/path khác đọc qua `?? 0`
  // (TheResourceSystem retired M13 — gains live in TurnBattleSystem).
  currentThe?: number

  // The Tu Reimagined (spec 2026-09-15 section 4.1, plan Task 15 review
  // P0.2) — participant-build The cap. Baked as MAX_THE + the_tu_an
  // node maxTheBonus at battle construction (Task 20 collector);
  // TheEconomy.theCap is the single read site (`entity.maxThe ?? MAX_THE`),
  // so Phap Tu entities without the field keep the global MAX_THE.
  maxThe?: number

  // The Tu Reimagined (spec 2026-09-15 D7/section 7.13) — momentum resource
  // retired: the hidden path fuels reactive checks from currentThe, and
  // the visible path has no pool resource at all.

  // Hỏa Tu Pure (Plans/FirePath mục 7, 2026-08-21) — Hỏa Thế CHIẾN
  // ĐẤU, cùng mô hình currentSwordIntent nhưng pool
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

  // The Tu Reimagined (plan Task 11, spec 2026-09-15 D3) — Sơn Nhạc
  // external ward: a SEPARATE, protection-only absorb pool granted by an
  // external source. Distinct from currentWard on purpose: it is exempt
  // from wardMax/regen, absorbs BEFORE the native ward, never feeds
  // spendWard, and its existence is bound to the granting marker
  // instance (reconciled per-source — newest grant replaces wholesale).
  externalWard?: { sourceId: string; amount: number }

  // Phap Tu (Tho Tu, 2026-08-15) — holder turns elapsed since the last
  // LANDED hit on this entity (reset to 0 in CombatSystem.resolveAttack;
  // incremented once per declareActorAction — follow-up bypass declares
  // count too). Gates ward regen via WARD_REGEN_DELAY_TURNS in
  // TurnBattleSystem. Unit changed seconds -> holder-turns in M8
  // (ARCH-003); the legacy seconds-based gate lived in the retired
  // engine's updateRegen.
  turnsSinceLastHitLanded: number

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
  // cách (BattleSystem.resolveMovement()) và va chạm action impact
  // (ActionImpactSystem). Không có trục Y — sân đấu chỉ 1 chiều ngang.
  x: number

  // Combat Grid Rework (2026-08-24) — `row` là LANE thật trên grid
  // 10×16 (xem BattleGrid.ts): targeting/AOE query đọc row + column
  // (column = làm tròn `x`). Player đứng ở HERO_LANE_INDEX đại diện;
  // quái random mỗi lần spawn trừ Boss luôn HERO_LANE_INDEX.
  row: LaneIndex

  alive: boolean

  // Cờ Elite ("Tinh Anh") cho Combat HUD (thanh máu luôn hiện) — set
  // khi tag tinh_anh gắn qua applyEnemyTags (core/enemy/EnemyTag.ts).
  // Player luôn falsy (không set trong playerToCombatEntity()).
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

  // Turn-based boss enrage (Phase A2, 2026-09-07) — see Enemy.ts's
  // bossTrigger for the full comment; threaded here unchanged via
  // enemyToCombatEntity(), read by TurnBattleAdapter.toTurnBattleParticipant().
  bossTrigger?: { afterTurns: number; buffDefinitionId: string }

  // Combat Balance Pass (2026-08-29, plan §3.6) — action đặc biệt data-
  // driven thay basic attack cứng (xem core/enemy/Enemy.ts's
  // EnemySpecialAttack). Thread từ Enemy qua enemyToCombatEntity(), đọc
  // tại TurnBattleSystem.declareActorAction() (everyNth counter).
  // undefined = quái chỉ basic attack.
  specialAttacks?: EnemySpecialAttack[]

  // Thể Tu (Combat Rework Phase 7) — thanh máu phụ CHỐNG PHÁ, tách
  // hẳn currentHp: Thể Tu skill (Skill.breakDamagePerHit) trừ riêng
  // thanh này mỗi đòn trúng, KHÔNG qua Damage Engine/mitigation (giống
  // tinh thần Detonate — bỏ qua Armor/Resistance). Chạm 0 thì Stagger
  // (áp ailment 'choang' có sẵn) rồi reset về breakGaugeMax, xem
  // BattleSystem's missile-resolve callback. undefined = entity này
  // không có Break (quái thường/player) — CHỈ Boss/quái lớn khai.
  breakGaugeMax?: number

  currentBreakGauge?: number

  // Kiếm Tu Bạt Kiếm — trạng thái tụ lực (reset mỗi kỳ sau mỗi phát
  // quạt; tuLucActive=false khi chết/khống chế cứng).
  tuLucActive: boolean
  tuLucElapsed: number
  // % maxHP đã MẤT trong kỳ tụ hiện tại — nền cho amp "nhận càng
  // nhiều gây càng nhiều" (spec §4.2), đọc lúc resolve phát quạt.
  tuLucDamageTakenPercent: number
}
