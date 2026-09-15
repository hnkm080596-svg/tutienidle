import type { Stats } from '../stats/StatBlock'
import type { LaneIndex } from '../battle/BattleLane'
import type { EnemyArchetype } from '../enemy/EnemyArchetype'
import type { TribulationPhase, BossEnrage } from '../enemy/TribulationPhase'
import type { EnemySpecialAttack } from '../enemy/Enemy'

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

  // Phap Tu Reimagined Task 8 — The pool, BATTLE-INSTANCE SCOPED
  // (breaking lifecycle change): resets to 0 at every fresh
  // participant build and every auto-repeat cycle
  // (resetBattleScopedResources), for every path sharing the pool
  // (Phap Tu, Bat Kiem). No PlayerData persistence, no cross-cycle
  // carry. Gains are skill-authored (TurnSkillDefinition.
  // theGainOnLandedCast/theGainOnCrit — once per cast, never per
  // target). Optional — readers use `?? 0`.
  currentThe?: number
  // Battle snapshot of the The cap (undefined => MAX_THE). Derived once
  // at participant build — two disjoint producers, one per path:
  // phap_tu via resolveMaxThe(player) (MAX_THE + truong_the_<element>
  // node contribution); the_tu_an via the kit-baked MAX_THE +
  // maxTheBonus (Task 20 collector). TheEconomy.theCap is the single
  // read site (`entity.maxThe ?? MAX_THE`); never persisted.
  maxThe?: number

  // The Tu Reimagined (spec 2026-09-15 D7/section 7.13) — momentum resource
  // retired: the hidden path fuels reactive checks from currentThe, and
  // the visible path has no pool resource at all.

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
}
