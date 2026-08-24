import type { CombatEntity } from '../combat/CombatEntity'
import type { Stats } from '../stats/StatBlock'
import type { EnemyLane } from '../battle/BattleLane'
import type { EnemyStatInput } from './EnemyStatInput'
import { normalizeEnemyStats, applyEliteMultiplier, applyBossMultiplier } from './EnemyStatInput'
import type { EnemyArchetype } from './EnemyArchetype'
import type { TribulationPhase, BossEnrage } from './TribulationPhase'
import { getRealmIndex } from '../realm/realmSystem'

export type { EnemyLane }

export interface EnemyItemDrop {
  kind: 'material' | 'equipment' | 'pill' | 'technique'

  itemId: string

  // Dùng cho material/pill (số lượng cộng vào stack). Equipment luôn
  // tạo đúng 1 instance mỗi lần rớt, bỏ qua field này.
  amount?: number

  // 1.0 = 100%
  chance: number
}

export interface EnemyReward {
  // Cảm ngộ Tâm Pháp — CHỈ vào tâm pháp đang trang bị (undefined/hết
  // trần thì mất trắng, xem GameManager.gainEquippedTechniqueInsight()).
  techniqueInsight: number

  // Cảm ngộ Kỹ năng — LUÔN cấp bất kể có trang bị tâm pháp hay không
  // (skill-insight-and-auto-combat-hud-plan.md mục 3), xem
  // GameManager.grantBattleRewardIfNeeded(). Optional — undefined thì
  // suy ra từ techniqueInsight qua getSkillInsightReward() (xem
  // core/reward/SkillInsightBalance.ts), tránh phải sửa lại TOÀN BỘ
  // data enemy hiện có (72 entry) chỉ để thêm 1 con số phase-đầu tạm.
  skillInsight?: number

  cultivation: number

  spiritStone: number

  itemDrops?: EnemyItemDrop[]
}

export interface Enemy {
  id: string

  name: string

  level: number

  // Cảnh giới của quái — dùng để tính Realm Pressure khi đối đầu
  // player (xem core/combat/RealmPressure.ts). Phải khớp 1 id trong
  // REALMS (data/realms/realm.ts).
  realmId: string

  stats: Stats

  currentHp: number

  maxHp: number

  alive: boolean

  rewards: EnemyReward

  // Rewards dùng khi quái spawn dưới dạng Elite (roll trúng
  // eliteChance, xem GameManager.updateStageProgress()) — thường thêm
  // itemDrops chứa Phá Cảnh Tâm Pháp (kind 'technique'). Không khai
  // thì Elite vẫn dùng `rewards` thường (chỉ buff stat, không đổi
  // thưởng).
  eliteRewards?: EnemyReward

  // Cờ đánh dấu bản Elite ("Tinh Anh") — buff vừa phải, spawn NGẪU
  // NHIÊN theo eliteChance (xem Stage.StageEnemyEntry). Chỉ true khi
  // tạo qua createEliteVariant().
  isElite?: boolean

  // Core Loop Foundation checklist (Mục BOSS) — tier RIÊNG, tách hẳn
  // khỏi Elite: buff lớn hơn nhiều (applyBossMultiplier), KHÔNG spawn
  // ngẫu nhiên (đặt CỐ ĐỊNH qua Stage.bossEnemyId, luôn là quái CUỐI
  // của stage) — chỉ true khi tạo qua createBossVariant().
  isBoss?: boolean

  // Rewards dùng khi quái spawn dưới dạng Boss — không khai thì dùng
  // eliteRewards ?? rewards (fallback chain, xem createBossVariant()).
  bossRewards?: EnemyReward

  // Core Loop Foundation checklist (Mục MONSTER) — nhãn hành vi nhẹ
  // (không phải AI đầy đủ), xem EnemyArchetype.ts + BattleSystem.ts's
  // resolveMovement()/updateEnemyAttacks(). Không khai = 'melee'.
  archetype?: EnemyArchetype

  // "Họ quái" (MASTER SPEC Mục III — vd 'wolf', 'demon') — nhóm các
  // quái cùng chủ đề để có bộ material riêng (Wolf → Beast Fang/Hide/
  // Core). Thuần label, không ảnh hưởng combat/stats.
  family?: string

  // Đột Phá Trúc Cơ (Phase 4) — quái Kiếp (Nhân/Địa/Thiên/Đại Đạo Kiếp,
  // xem data/enemy/Tribulations.ts) leo thang sức mạnh giữa trận qua
  // các mốc HP. Combat Rework Phase 4 generic hoá: Boss thường
  // (Stage.bossEnemyId) cũng dùng chung field này (Attack Pattern/
  // Summon), quái thường để trống.
  tribulationPhases?: TribulationPhase[]

  // Combat Rework Phase 4 (Boss Mechanics) — DPS check, xem
  // TribulationPhase.ts's BossEnrage. CHỈ Boss cần khai, quái thường
  // để trống.
  enrage?: BossEnrage

  // Thể Tu (Combat Rework Phase 7) — thanh Break, xem CombatEntity.ts.
  // CHỈ Boss/quái lớn cần khai, quái thường để trống.
  breakGaugeMax?: number

  lane: EnemyLane
}

// Shape gọn cho data/enemy/Enemies.ts — statsInput (~13-14 field,
// xem EnemyStatInput.ts) thay vì phải khai đủ 41 field Stats. Đúng
// khuyến nghị Last Epoch: quái thường không cần bộ stat đầy đủ như
// player.
export interface EnemyDefinition {
  id: string

  name: string

  level: number

  realmId: string

  lane: EnemyLane

  statsInput: EnemyStatInput

  rewards: EnemyReward

  eliteRewards?: EnemyReward

  bossRewards?: EnemyReward

  archetype?: EnemyArchetype

  family?: string

  tribulationPhases?: TribulationPhase[]

  enrage?: BossEnrage

  breakGaugeMax?: number

  // Đột Phá Trúc Cơ (Phase 4) — quái Kiếp set true trực tiếp lúc định
  // nghĩa (KHÔNG qua createBossVariant(), vì multiplier 8x/3x của Boss
  // thường không áp dụng — mỗi tier Kiếp tự khai statsInput riêng).
  // Chỉ tái dùng cờ isBoss để Combat HUD hiện thanh máu cố định.
  isBoss?: boolean
}

/**
 * Tính sẵn `stats` (normalizeEnemyStats) + `currentHp`/`maxHp`/`alive`
 * (luôn = stats.maxHp/true cho 1 TEMPLATE mới định nghĩa) — data file
 * chỉ cần khai statsInput, không phải tự lặp lại currentHp=maxHp mỗi
 * lần.
 */
export function defineEnemy(definition: EnemyDefinition): Enemy {
  const stats = normalizeEnemyStats(definition.statsInput)

  return {
    id: definition.id,

    name: definition.name,

    level: definition.level,

    realmId: definition.realmId,

    lane: definition.lane,

    family: definition.family,

    archetype: definition.archetype,

    tribulationPhases: definition.tribulationPhases,

    enrage: definition.enrage,

    breakGaugeMax: definition.breakGaugeMax,

    isBoss: definition.isBoss,

    stats,

    currentHp: stats.maxHp,

    maxHp: stats.maxHp,

    alive: true,

    rewards: definition.rewards,

    eliteRewards: definition.eliteRewards,

    bossRewards: definition.bossRewards,
  }
}

const ELITE_NAME_PREFIX = 'Tinh Anh '

/**
 * Biến 1 Enemy TEMPLATE thành bản Elite (buff stat cố định + đổi
 * rewards nếu có eliteRewards) — gọi lúc SPAWN (GameManager.
 * updateStageProgress()), không đụng tới template gốc trong registry.
 */
export function createEliteVariant(enemy: Enemy): Enemy {
  const stats = applyEliteMultiplier(enemy.stats)

  return {
    ...enemy,

    name: ELITE_NAME_PREFIX + enemy.name,

    stats,

    currentHp: stats.maxHp,

    maxHp: stats.maxHp,

    rewards: enemy.eliteRewards ?? enemy.rewards,

    isElite: true,
  }
}

const BOSS_NAME_PREFIX = 'Đại Vương '

/**
 * Core Loop Foundation checklist (Mục BOSS) — tier RIÊNG, buff LỚN
 * HƠN Elite nhiều (applyBossMultiplier). Gọi khi Stage.bossEnemyId
 * khớp lượt spawn CUỐI (xem GameManager.pickEnemyForSpawn()) — KHÔNG
 * roll ngẫu nhiên như Elite.
 */
export function createBossVariant(enemy: Enemy): Enemy {
  const stats = applyBossMultiplier(enemy.stats)

  return {
    ...enemy,

    name: BOSS_NAME_PREFIX + enemy.name,

    stats,

    currentHp: stats.maxHp,

    maxHp: stats.maxHp,

    rewards: enemy.bossRewards ?? enemy.eliteRewards ?? enemy.rewards,

    isBoss: true,
  }
}

/**
 * Chuyển Enemy thành CombatEntity
 * trước khi đưa vào Combat System.
 */
export function enemyToCombatEntity(
  enemy: Enemy,
): CombatEntity {
  return {
    id: enemy.id,

    name: enemy.name,

    type: 'enemy',

    baseStats: enemy.stats,

    stats: enemy.stats,

    currentHp: enemy.currentHp,

    maxHp: enemy.maxHp,

    currentMp: enemy.stats.maxMp,

    currentRage: 0,

    currentSwordIntent: 0,

    currentMomentum: 0,

    currentHoaThe: 0,

    currentThoThe: 0,

    currentKimThe: 0,

    timeSinceLastBleedProc: 0,

    currentWard: 0,

    timeSinceLastHitTaken: Infinity,

    realmIndex: getRealmIndex(enemy.realmId),

    // Placeholder — BattleSystem.start()/spawnEnemyInto() set lại
    // thành ENEMY_SPAWN_X ngay khi quái vào trận (xem
    // core/battle/BattleLane.ts).
    x: 0,

    // Placeholder — GameManager.startBattle()/updateStageProgress() set
    // lại NGAY thành randomEnemyLaneIndex() (hoặc HERO_LANE_INDEX nếu
    // isBoss) khi quái vào trận (2026-08-22, top-down 5-lane, xem
    // core/battle/BattleLane.ts). `enemy.row` (EnemyLane cũ, authored
    // trong data/enemy/*.ts) không còn quyết định vị trí hiển thị nữa.
    row: 0,

    alive: enemy.alive,

    isElite: enemy.isElite ?? false,

    isBoss: enemy.isBoss ?? false,

    archetype: enemy.archetype,

    tribulationPhases: enemy.tribulationPhases,

    enrage: enemy.enrage,

    breakGaugeMax: enemy.breakGaugeMax,

    currentBreakGauge: enemy.breakGaugeMax,
  }
}
