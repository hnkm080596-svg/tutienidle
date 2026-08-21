import type { ElementType } from '../element/ElementType'
import type { Stats } from '../stats/StatBlock'

/**
 * Shape AUTHORING gọn cho quái thường (~13-14 field) — Last Epoch
 * khuyên KHÔNG bắt quái dùng chung bộ stat đầy đủ với player (41
 * field, phần lớn vô nghĩa với quái như cultivationRate/attribute).
 * `normalizeEnemyStats()` điền đủ 41 field runtime từ input này —
 * CombatEntity/DamageCalculator/BattleSystem vẫn dùng chung 1 `Stats`
 * shape với player (không branch động cơ combat theo loại entity),
 * chỉ tầng DATA AUTHORING gọn lại.
 */
export interface EnemyStatInput {
  maxHp: number

  hpRegenPerSecond?: number

  attack: number

  attackSpeed: number

  movementSpeed: number

  attackRange: number

  criticalRate: number

  criticalDamage: number

  // -> defense VÀ magicDefense cũ đã gộp làm 1 (xem StatTypes.ts) —
  // chỉ còn field `defense` duy nhất, qua Armor.ts.
  armor: number

  evasionRate?: number

  accuracyRating?: number

  // Chỉ cần khai hành nào có ý nghĩa — hành không khai mặc định 0
  // (không kháng gì).
  resistances?: Partial<Record<ElementType, number>>

  // 1 hành chủ đạo (thay cho ElementAffinity cũ) — quái thường chỉ
  // cần 1 hành, không phải toàn bộ 5.
  elemental?: { element: ElementType; power: number; penetration?: number }

  // CHỈ Elite/Boss cần khai — mọi field khác mặc định 0/baseline.
  special?: {
    blockChance?: number
    blockEffectiveness?: number
    thornsPercent?: number
    leechPercent?: number
    wardMax?: number
    wardRegenPerSecond?: number
    enduranceThreshold?: number
    endurancePercent?: number
    primordialPower?: number
    manaRegenPerSecond?: number
    cooldownReduction?: number
    criticalAvoidance?: number
    chanceToIgnoreResistance?: number
    ailmentResistPercent?: number
    ailmentPotencyPercent?: number
    wardBreakDamagePercent?: number
    manaShieldPercent?: number
    skillDamagePercent?: number
    dotResistancePercent?: number
  }
}

const DEFAULT_EVASION_RATING = 25
const DEFAULT_ACCURACY_RATING = 80
const DEFAULT_BLOCK_EFFECTIVENESS = 0.25

export function normalizeEnemyStats(input: EnemyStatInput): Stats {
  return {
    attack: input.attack,
    defense: input.armor,

    maxHp: input.maxHp,
    maxMp: 0,

    attackSpeed: input.attackSpeed,
    movementSpeed: input.movementSpeed,
    attackRange: input.attackRange,

    criticalRate: input.criticalRate,
    criticalDamage: input.criticalDamage,

    evasionRate: input.evasionRate ?? DEFAULT_EVASION_RATING,

    // Quái không có hành trình attribute riêng.
    strength: 0,
    dexterity: 0,
    intelligence: 0,
    attunement: 0,
    vitality: 0,

    accuracyRating: input.accuracyRating ?? DEFAULT_ACCURACY_RATING,
    blockChance: input.special?.blockChance ?? 0,
    blockEffectiveness: input.special?.blockEffectiveness ?? DEFAULT_BLOCK_EFFECTIVENESS,
    enduranceThreshold: input.special?.enduranceThreshold ?? 0,
    endurancePercent: input.special?.endurancePercent ?? 0,
    wardMax: input.special?.wardMax ?? 0,
    wardRegenPerSecond: input.special?.wardRegenPerSecond ?? 0,
    wardBreakDamagePercent: input.special?.wardBreakDamagePercent ?? 0,
    manaShieldPercent: input.special?.manaShieldPercent ?? 0,
    leechPercent: input.special?.leechPercent ?? 0,
    thornsPercent: input.special?.thornsPercent ?? 0,
    hpRegenPerSecond: input.hpRegenPerSecond ?? 0,
    manaRegenPerSecond: input.special?.manaRegenPerSecond ?? 0,
    cooldownReduction: input.special?.cooldownReduction ?? 0,
    castSpeedPercent: 0,
    criticalAvoidance: input.special?.criticalAvoidance ?? 0,
    chanceToIgnoreResistance: input.special?.chanceToIgnoreResistance ?? 0,
    ailmentResistPercent: input.special?.ailmentResistPercent ?? 0,
    ailmentPotencyPercent: input.special?.ailmentPotencyPercent ?? 0,
    skillDamagePercent: input.special?.skillDamagePercent ?? 0,
    projectileSpeedPercent: 0,
    elementApplicationPercent: 0,
    reactionEffectPercent: 0,
    ailmentDurationPercent: 0,
    hoaTheGainPerCast: 0,
    hoaTheDecayReductionPercent: 0,
    thuyThePercent: 0,
    waterReactionExtensionSeconds: 0,
    poisonRootPercentPerStack: 0,
    poisonRootMaxStacks: 0,
    poisonRootThresholdBonusPercent: 0,
    earthAoeRadius: 0,
    earthAoeSecondaryDamagePercent: 0,
    earthKnockbackDistance: 0,
    skillImpactPercent: 0,
    thoTheGainPerCast: 0,
    kimTheGainPerProc: 0,
    kimTheDotDamagePercentPerStack: 0,
    kimTheDotResistancePenetrationPercentPerStack: 0,
    kimTheMaxStacksBonus: 0,
    metalAilmentPotencyPercent: 0,
    huyetPhaGainPerProc: 0,
    huyetPhaBurstDamage: 0,
    dotResistancePercent: input.special?.dotResistancePercent ?? 0,
    poisonRecoveryPercent: 0,

    woodPower: input.elemental?.element === 'wood' ? input.elemental.power : 0,
    woodResistance: input.resistances?.wood ?? 0,
    woodPenetration: input.elemental?.element === 'wood' ? (input.elemental.penetration ?? 0) : 0,

    firePower: input.elemental?.element === 'fire' ? input.elemental.power : 0,
    fireResistance: input.resistances?.fire ?? 0,
    firePenetration: input.elemental?.element === 'fire' ? (input.elemental.penetration ?? 0) : 0,

    earthPower: input.elemental?.element === 'earth' ? input.elemental.power : 0,
    earthResistance: input.resistances?.earth ?? 0,
    earthPenetration: input.elemental?.element === 'earth' ? (input.elemental.penetration ?? 0) : 0,

    metalPower: input.elemental?.element === 'metal' ? input.elemental.power : 0,
    metalResistance: input.resistances?.metal ?? 0,
    metalPenetration: input.elemental?.element === 'metal' ? (input.elemental.penetration ?? 0) : 0,

    waterPower: input.elemental?.element === 'water' ? input.elemental.power : 0,
    waterResistance: input.resistances?.water ?? 0,
    waterPenetration: input.elemental?.element === 'water' ? (input.elemental.penetration ?? 0) : 0,

    windPower: input.elemental?.element === 'wind' ? input.elemental.power : 0,
    windResistance: input.resistances?.wind ?? 0,
    windPenetration: input.elemental?.element === 'wind' ? (input.elemental.penetration ?? 0) : 0,

    lightningPower: input.elemental?.element === 'lightning' ? input.elemental.power : 0,
    lightningResistance: input.resistances?.lightning ?? 0,
    lightningPenetration: input.elemental?.element === 'lightning' ? (input.elemental.penetration ?? 0) : 0,

    primordialPower: input.special?.primordialPower ?? 0,
  }
}

// Hệ số Elite tối giản — buff thẳng maxHp/attack theo hằng số cố
// định thay vì hệ thống rarity đầy đủ, đủ để có 1 nguồn rơi thật cho
// Phá Cảnh Tâm Pháp (Boss/Elite+) mà không cần xây lại toàn bộ
// Stage/Enemy. Xem Stage.StageEnemyEntry.eliteChance.
const ELITE_MAX_HP_MULTIPLIER = 3
const ELITE_ATTACK_MULTIPLIER = 1.8

export function applyEliteMultiplier(stats: Stats): Stats {
  return {
    ...stats,

    maxHp: stats.maxHp * ELITE_MAX_HP_MULTIPLIER,
    attack: stats.attack * ELITE_ATTACK_MULTIPLIER,
  }
}

// Core Loop Foundation checklist (Mục BOSS) — hệ số LỚN HƠN Elite
// nhiều (HP×8/Attack×3 so với Elite HP×3/Attack×1.8), khớp vai trò
// "thử thách cuối stage" thay vì spawn ngẫu nhiên như Elite.
const BOSS_MAX_HP_MULTIPLIER = 8
const BOSS_ATTACK_MULTIPLIER = 3

export function applyBossMultiplier(stats: Stats): Stats {
  return {
    ...stats,

    maxHp: stats.maxHp * BOSS_MAX_HP_MULTIPLIER,
    attack: stats.attack * BOSS_ATTACK_MULTIPLIER,
  }
}
