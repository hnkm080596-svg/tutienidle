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

  /** Go Board (plan §4): tầm đánh theo HÀNH (rank) — data author trực tiếp, không heuristic runtime. */
  attackRangeRanks: number

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
    cooldownReduction?: number
    criticalAvoidance?: number
    chanceToIgnoreResistance?: number
    ailmentResistPercent?: number
    ailmentPotencyPercent?: number
    wardBreakDamagePercent?: number
    skillDamagePercent?: number
    dotResistancePercent?: number
  }
}

const DEFAULT_EVASION_RATING = 25
const DEFAULT_ACCURACY_RATING = 80
const DEFAULT_BLOCK_EFFECTIVENESS = 0.25

// Enemy data cũ được author theo thang 3-7, trong khi BattleSystem hiểu
// attackSpeed là số đòn/giây. Quy đổi về nhịp 0.8-2.5 đòn/giây để một thay đổi
// nhỏ ở Attack không còn tạo burst damage quá lớn. Giá trị <= 2.5 được xem là
// dữ liệu đã theo thang mới, nhờ vậy enemy mới có thể author trực tiếp.
const LEGACY_ATTACK_SPEED_DIVISOR = 2.5
const MIN_ENEMY_ATTACK_SPEED = 0.8
const MAX_ENEMY_ATTACK_SPEED = 2.5

// Balance pass (2026-08-26, combat AI rework): enemy DỪNG LẠI bắn khi
// vào đúng tầm của chính nó, nên điểm dừng xa nhất = cổng (cột 1) +
// attackRange. Trần 5 bảo đảm quái không bao giờ đứng ngoài tầm với tới
// của avatar Player (base range 5, xem StatBlock.ts) — chặn hẳn thế
// "sniper bất khả chiến thắng" đứng ngoài sân bắn cổng mãi không thả.
export const MAX_ENEMY_ATTACK_RANGE_RANKS = 5

// Enemy data trước Grid Rework được author theo world 0..400. Runtime mới
// dùng 16 cột, nên 25 world-unit cũ tương ứng đúng 1 column.
// (2026-08-25, plan §8.4) Heuristic world-unit → column đã XOÁ: enemy
// data author TRỰC TIẾP theo attackRangeRanks/movementSpeed mới.

export function normalizeEnemyAttackSpeed(authoredAttackSpeed: number): number {
  const converted = authoredAttackSpeed > MAX_ENEMY_ATTACK_SPEED
    ? authoredAttackSpeed / LEGACY_ATTACK_SPEED_DIVISOR
    : authoredAttackSpeed

  return Math.min(MAX_ENEMY_ATTACK_SPEED, Math.max(MIN_ENEMY_ATTACK_SPEED, converted))
}

export function normalizeEnemyStats(input: EnemyStatInput): Stats {
  return {
    attack: input.attack,
    defense: input.armor,

    maxHp: input.maxHp,
    // Quái không có Linh Lực (MP là tài nguyên riêng của Pháp Tu) — vì
    // vậy manaShieldPercent/manaRegenPerSecond không thể author được ở
    // EnemyStatInput.special (không có pool MP để hấp thụ/hồi vào).
    maxMp: 0,

    attackSpeed: normalizeEnemyAttackSpeed(input.attackSpeed),
    movementSpeed: input.movementSpeed,

    // Balance pass — clamp Trần 5 (xem MAX_ENEMY_ATTACK_RANGE_RANKS):
    // data author > 5 tự hạ về 5, mọi quái spawn qua funnel này đều
    // đứng trong tầm đánh của Player.
    attackRange: Math.min(input.attackRangeRanks, MAX_ENEMY_ATTACK_RANGE_RANKS),

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
    manaShieldPercent: 0,
    leechPercent: input.special?.leechPercent ?? 0,
    thornsPercent: input.special?.thornsPercent ?? 0,
    hpRegenPerSecond: input.hpRegenPerSecond ?? 0,
    manaRegenPerSecond: 0,
    cooldownReduction: input.special?.cooldownReduction ?? 0,
    castSpeedPercent: 0,
    finalDamagePercent: 0,
    finalDamageReductionPercent: 0,
    criticalAvoidance: input.special?.criticalAvoidance ?? 0,
    chanceToIgnoreResistance: input.special?.chanceToIgnoreResistance ?? 0,
    ailmentResistPercent: input.special?.ailmentResistPercent ?? 0,
    ailmentPotencyPercent: input.special?.ailmentPotencyPercent ?? 0,
    skillDamagePercent: input.special?.skillDamagePercent ?? 0,
    elementApplicationPercent: 0,
    reactionEffectPercent: 0,
    ailmentDurationPercent: 0,
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

// Elite tăng thời gian giao chiến nhưng chỉ tăng vừa phải sát thương; thêm
// Armor/Accuracy để khác quái thường mà không tạo burst bất ngờ.
const ELITE_MAX_HP_MULTIPLIER = 2.5
const ELITE_ATTACK_MULTIPLIER = 1.35
const ELITE_DEFENSE_MULTIPLIER = 1.15
const ELITE_ACCURACY_MULTIPLIER = 1.1

export function applyEliteMultiplier(stats: Stats): Stats {
  return {
    ...stats,

    maxHp: stats.maxHp * ELITE_MAX_HP_MULTIPLIER,
    attack: stats.attack * ELITE_ATTACK_MULTIPLIER,
    defense: stats.defense * ELITE_DEFENSE_MULTIPLIER,
    accuracyRating: stats.accuracyRating * ELITE_ACCURACY_MULTIPLIER,
  }
}

// Boss dùng phần lớn power budget cho thời gian giao chiến và phòng thủ.
// Attack chỉ ×1.6 vì boss sống lâu; hệ số ×3 cũ khiến tổng áp lực tăng quá
// mạnh, đặc biệt với enemy data legacy có tốc đánh 3-7.
const BOSS_MAX_HP_MULTIPLIER = 7
const BOSS_ATTACK_MULTIPLIER = 1.6
const BOSS_DEFENSE_MULTIPLIER = 1.2
const BOSS_ACCURACY_MULTIPLIER = 1.15
const BOSS_RESISTANCE_BONUS = 15
const BOSS_CRITICAL_AVOIDANCE = 0.15

export function applyBossMultiplier(stats: Stats): Stats {
  return {
    ...stats,

    maxHp: stats.maxHp * BOSS_MAX_HP_MULTIPLIER,
    attack: stats.attack * BOSS_ATTACK_MULTIPLIER,
    defense: stats.defense * BOSS_DEFENSE_MULTIPLIER,
    accuracyRating: stats.accuracyRating * BOSS_ACCURACY_MULTIPLIER,
    criticalAvoidance: Math.max(stats.criticalAvoidance, BOSS_CRITICAL_AVOIDANCE),
    woodResistance: stats.woodPower > 0 ? stats.woodResistance + BOSS_RESISTANCE_BONUS : stats.woodResistance,
    fireResistance: stats.firePower > 0 ? stats.fireResistance + BOSS_RESISTANCE_BONUS : stats.fireResistance,
    earthResistance: stats.earthPower > 0 ? stats.earthResistance + BOSS_RESISTANCE_BONUS : stats.earthResistance,
    metalResistance: stats.metalPower > 0 ? stats.metalResistance + BOSS_RESISTANCE_BONUS : stats.metalResistance,
    waterResistance: stats.waterPower > 0 ? stats.waterResistance + BOSS_RESISTANCE_BONUS : stats.waterResistance,
    windResistance: stats.windPower > 0 ? stats.windResistance + BOSS_RESISTANCE_BONUS : stats.windResistance,
    lightningResistance: stats.lightningPower > 0 ? stats.lightningResistance + BOSS_RESISTANCE_BONUS : stats.lightningResistance,
  }
}
