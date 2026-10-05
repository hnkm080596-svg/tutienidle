import type { CombatEntity } from '../combat/CombatEntity'
import type { Stats } from '../stats/StatBlock'
import type { EnemyLane } from '../battle/BattleLane'
import type { EnemyStatInput } from './EnemyStatInput'
import { normalizeEnemyStats, applyBossMultiplier, assertEnemyDamageSurface } from './EnemyStatInput'
import type { EnemyArchetype } from './EnemyArchetype'
import type { TribulationPhase, BossEnrage } from './TribulationPhase'
import type { CombatVfxPresetId } from '../battle/CombatAction'
import type { SignatureDrop } from '../drop/DropTable'
import { getRealmIndex } from '../realm/realmSystem'

export type { EnemyLane }

/**
 * Combat Balance Pass (2026-08-29, plan sec3.6) - 1 action DAC BIET data-
 * driven cua quai (boss mau truoc): moi lan attack MOI thu `everyNth`
 * (1-based, dem LAI TU DAU sau khi khop) thay basic attack bang impact
 * voi `damageMultiplier` (nhan ca stats might qua pipeline thuong) va
 * `presetId` rieng de renderer dien xuat khac biet. `windupSeconds`
 * override thoi gian chuan bi (undefined = theo basic cua archetype).
 * KHONG co UI bao hieu telegraph rieng - phan do de danh phase sau.
 */
export interface EnemySpecialAttack {
  everyNth: number

  damageMultiplier: number

  presetId?: CombatVfxPresetId

  windupSeconds?: number
}

export interface EnemyReward {
  // Technique Mastery (`techniqueMastery` battle channel) - tich luy
  // pending roi flush vao canonical technique qua
  // TechniqueSystem.gainMastery o VICTORY (active) / per-cycle (idle).
  techniqueMastery: number

  // Tu vi gio CHI den tu tu luyen (2026-08-20) - giet quai KHONG cong
  // tu vi, nen EnemyReward khong co cultivation. Quest reward van dung
  // Reward.cultivation (core/reward/Reward.ts) - do la duong rieng.
  spiritStone: number
}

export interface Enemy {
  id: string

  // Template id this instance was spawned from; set by EnemySystem.spawn.
  // Kill consumers (quests, hidden beast) match template ids - the
  // instance id is uuid-unique and must never reach them (audit T3-16).
  templateId?: string

  name: string

  level: number

  // Canh gioi cua quai - dung de tinh Realm Pressure khi doi dau
  // player (xem core/combat/RealmPressure.ts). Phai khop 1 id trong
  // REALMS (data/realms/realm.ts).
  realmId: string

  stats: Stats

  currentHp: number

  maxHp: number

  alive: boolean

  rewards: EnemyReward

  // Co danh dau ban Elite ("Tinh Anh") - buff vua phai, spawn NGAU
  // NHIEN theo eliteChance (xem Stage.StageEnemyEntry). Chi true khi
  // tag tinh_anh duoc gan qua applyEnemyTags() (core/enemy/EnemyTag.ts).
  isElite?: boolean

  // Core Loop Foundation checklist (Muc BOSS) - tier RIENG, tach han
  // khoi Elite: buff lon hon nhieu (applyBossMultiplier), KHONG spawn
  // ngau nhien (dat CO DINH qua Stage.bossEnemyId, luon la quai CUOI
  // cua stage) - chi true khi tao qua createBossVariant().
  isBoss?: boolean

  // Core Loop Foundation checklist (Muc MONSTER) - nhan hanh vi nhe
  // (khong phai AI day du), xem EnemyArchetype.ts + BattleSystem.ts's
  // resolveMovement()/updateEnemyAttacks(). Khong khai = 'melee'.
  archetype?: EnemyArchetype

  // "Ho quai" (MASTER SPEC Muc III - vd 'wolf', 'demon') - nhom cac
  // quai cung chu de de co bo material rieng (Wolf -> Beast Fang/Hide/
  // Core). Thuan label, khong anh huong combat/stats.
  family?: string

  // Drop-system (2026-09-12): per-enemy named drops (rare/narrative
  // items) resolved as their own layer by resolveDrops - never scaled
  // by the family/stage pool. Replaces hand-placed itemDrops lines.
  signatureDrops?: SignatureDrop[]

  // Dot Pha Truc Co (Phase 4) - quai Kiep (Nhan/Dia/Thien/Dai Dao Kiep,
  // xem data/enemy/Tribulations.ts) leo thang suc manh giua tran qua
  // cac moc HP. Combat Rework Phase 4 generic hoa: Boss thuong
  // (Stage.bossEnemyId) cung dung chung field nay (Attack Pattern/
  // Summon), quai thuong de trong.
  tribulationPhases?: TribulationPhase[]

  // Combat Rework Phase 4 (Boss Mechanics) - DPS check, xem
  // TribulationPhase.ts's BossEnrage. CHI Boss can khai, quai thuong
  // de trong.
  enrage?: BossEnrage

  // Turn-based boss enrage (Phase A2, 2026-09-07) - static config only;
  // TurnBattleAdapter.toTurnBattleParticipant() turns this into a live
  // TurnBossTrigger (adds firedAlready: false) on spawn. Separate from
  // the legacy `enrage`/`tribulationPhases` fields above, which remain
  // consumed only by battle/legacy/BattleSystem and are untouched here.
  bossTrigger?: { afterTurns: number; buffDefinitionId: string }

  // The Tu (Combat Rework Phase 7) - thanh Break, xem CombatEntity.ts.
  // CHI Boss/quai lon can khai, quai thuong de trong.
  breakGaugeMax?: number

  // Combat Balance Pass (2026-08-29, plan sec3.6) - action dac biet data-
  // driven thay basic attack cung, xem EnemySpecialAttack. Boss mau truoc.
  specialAttacks?: EnemySpecialAttack[]

  // Monster attack VFX sweep (2026-10-04) - authored VFX identity of the
  // enemy's basic attack (slash/claw/bite/elemental per its action type).
  // Threaded Enemy -> CombatEntity -> participant basic def so the shared
  // skill-presentation pipeline renders a distinct preset instead of the
  // generic arcane_impact fallback. undefined = generic fallback.
  attackPresetId?: CombatVfxPresetId

  // Hidden Perfection Lineage (design 2026-09-23 sec.9) - semantic
  // immortality for the Ancient Beast trial: an undefeatable enemy can
  // never die in battle (lethal hits clamp to 1 HP in
  // CombatSystem.killIfDead). NOT a huge-HP workaround.
  undefeatable?: boolean

  lane: EnemyLane
}

// Shape gon cho data/enemy/Enemies.ts - statsInput (~13-14 field,
// xem EnemyStatInput.ts) thay vi phai khai du 41 field Stats. Dung
// khuyen nghi Last Epoch: quai thuong khong can bo stat day du nhu
// player.
export interface EnemyDefinition {
  id: string

  name: string

  level: number

  realmId: string

  lane: EnemyLane

  statsInput: EnemyStatInput

  rewards: EnemyReward

  archetype?: EnemyArchetype

  family?: string

  // Threaded to Enemy.signatureDrops by defineEnemy(); elite/boss
  // variants inherit it via object spread.
  signatureDrops?: SignatureDrop[]

  tribulationPhases?: TribulationPhase[]

  enrage?: BossEnrage

  // Turn-based boss enrage (Phase A2, 2026-09-07) - same shape as the
  // Enemy interface's bossTrigger; threaded through defineEnemy() and
  // enemyToCombatEntity() unchanged.
  bossTrigger?: { afterTurns: number; buffDefinitionId: string }

  breakGaugeMax?: number

  // Combat Balance Pass (2026-08-29, plan sec3.6) - thread qua Enemy/
  // CombatEntity, tieu thu o BattleSystem.fireEnemyAttack().
  specialAttacks?: EnemySpecialAttack[]

  // Monster attack VFX sweep (2026-10-04) - threaded to Enemy/
  // CombatEntity by defineEnemy() + enemyToCombatEntity(); consumed by
  // the participant mint (enemyBasicAttackFor).
  attackPresetId?: CombatVfxPresetId

  // Dot Pha Truc Co (Phase 4) - quai Kiep set true truc tiep luc dinh
  // nghia (KHONG qua createBossVariant(), vi multiplier 8x/3x cua Boss
  // thuong khong ap dung - moi tier Kiep tu khai statsInput rieng).
  // Chi tai dung co isBoss de Combat HUD hien thanh mau co dinh.
  isBoss?: boolean

  // Hidden Perfection Lineage (design 2026-09-23 sec.9) - semantic
  // immortality; threaded to Enemy.undefeatable via defineEnemy().
  undefeatable?: boolean
}

/**
 * Tinh san `stats` (normalizeEnemyStats) + `currentHp`/`maxHp`/`alive`
 * (luon = stats.maxHp/true cho 1 TEMPLATE moi dinh nghia) - data file
 * chi can khai statsInput, khong phai tu lap lai currentHp=maxHp moi
 * lan.
 */
export function defineEnemy(definition: EnemyDefinition): Enemy {
  // stat-system-reimagined Task 10 (D21/INV-14) -- reaction-tagged
  // buff ids and gated-stat modifier channels are rejected at the
  // authoring boundary; statsInput itself is gated inside
  // normalizeEnemyStats().
  assertEnemyDamageSurface(definition)

  const stats = normalizeEnemyStats(definition.statsInput)

  return {
    id: definition.id,

    name: definition.name,

    level: definition.level,

    realmId: definition.realmId,

    lane: definition.lane,

    family: definition.family,

    signatureDrops: definition.signatureDrops,

    archetype: definition.archetype,

    tribulationPhases: definition.tribulationPhases,

    enrage: definition.enrage,

    bossTrigger: definition.bossTrigger,

    breakGaugeMax: definition.breakGaugeMax,

    specialAttacks: definition.specialAttacks,

    attackPresetId: definition.attackPresetId,

    isBoss: definition.isBoss,

    undefeatable: definition.undefeatable,

    stats,

    currentHp: stats.maxHp,

    maxHp: stats.maxHp,

    alive: true,

    rewards: definition.rewards,
  }
}

const BOSS_NAME_PREFIX = 'Đại Vương '

/**
 * Core Loop Foundation checklist (Muc BOSS) - tier RIENG, buff LON
 * HON Elite nhieu (applyBossMultiplier). Goi khi Stage.bossEnemyId
 * khop luot spawn CUOI (xem GameManager.pickEnemyForSpawn()) - KHONG
 * roll ngau nhien nhu Elite.
 */
export function createBossVariant(enemy: Enemy): Enemy {
  const stats = applyBossMultiplier(enemy.stats)

  return {
    ...enemy,

    name: BOSS_NAME_PREFIX + enemy.name,

    stats,

    currentHp: stats.maxHp,

    maxHp: stats.maxHp,

    isBoss: true,
  }
}

/**
 * Chuyen Enemy thanh CombatEntity
 * truoc khi dua vao Combat System.
 */
export function enemyToCombatEntity(enemy: Enemy): CombatEntity {
  return {
    id: enemy.id,

    templateId: enemy.templateId,

    name: enemy.name,

    type: 'enemy',

    baseStats: enemy.stats,

    stats: enemy.stats,

    currentHp: enemy.currentHp,

    maxHp: enemy.maxHp,

    currentMp: enemy.stats.maxMp,


    currentWard: 0,

    turnsSinceLastHitLanded: Infinity,

    realmIndex: getRealmIndex(enemy.realmId),

    // Placeholder - BattleSystem.start()/spawnEnemyInto() set lai
    // thanh ENEMY_SPAWN_X ngay khi quai vao tran (xem
    // core/battle/BattleLane.ts).
    x: 0,

    // Placeholder - vi tri THAT duoc resolver roll DUNG MOT LAN khi dat
    // lich spawn telegraph (plan sec5.1): quai thuong row 0..9, column
    // 7..15; Boss luon HERO_LANE_INDEX. Xem
    // core/battle/EnemySpawnPlacement.ts. `enemy.row` (EnemyLane cu,
    // authored trong data/enemy/*.ts) khong con quyet dinh vi tri hien
    // thi nua.
    row: 0,

    alive: enemy.alive,

    isElite: enemy.isElite ?? false,

    isBoss: enemy.isBoss ?? false,

    archetype: enemy.archetype,

    tribulationPhases: enemy.tribulationPhases,

    enrage: enemy.enrage,

    bossTrigger: enemy.bossTrigger,

    breakGaugeMax: enemy.breakGaugeMax,

    currentBreakGauge: enemy.breakGaugeMax,

    specialAttacks: enemy.specialAttacks,

    attackPresetId: enemy.attackPresetId,

    undefeatable: enemy.undefeatable,
  }
}
