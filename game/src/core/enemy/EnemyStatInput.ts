import type { ElementType } from '../element/ElementType'
import type { Stats } from '../stats/StatBlock'
import type { StatType } from '../stats/StatTypes'
import { STAT_DOMAIN } from '../stats/StatDomain'
import type { BuffDefinition } from '../buff2/BuffDefinition'
import type { EnemyDefinition } from './Enemy'

/**
 * Shape AUTHORING gon cho quai thuong (~13-14 field) - Last Epoch
 * khuyen KHONG bat quai dung chung bo stat day du voi player (phan
 * lon field vo nghia voi quai nhu cultivationRate/attribute).
 * `normalizeEnemyStats()` dien du moi field Stats runtime tu input nay -
 * CombatEntity/DamageCalculator/BattleSystem van dung chung 1 `Stats`
 * shape voi player (khong branch dong co combat theo loai entity),
 * chi tang DATA AUTHORING gon lai.
 */
export interface EnemyStatInput {
  maxHp: number

  hpRegenPerTurn?: number

  might: number

  attackSpeed: number

  criticalRate: number

  criticalDamage: number

  // -> defense VA magicDefense cu da gop lam 1 (xem StatTypes.ts) -
  // chi con field `defense` duy nhat, qua Armor.ts.
  armor: number

  evasionRate?: number

  accuracyRating?: number

  // Chi can khai hanh nao co y nghia - hanh khong khai mac dinh 0
  // (khong khang gi).
  resistances?: Partial<Record<ElementType, number>>

  // 1 hanh chu dao (thay cho ElementAffinity cu) - quai thuong chi
  // can 1 hanh, khong phai toan bo 5.
  elemental?: { element: ElementType; power: number; penetration?: number }

  // CHI Elite/Boss can khai - moi field khac mac dinh 0/baseline.
  special?: {
    blockChance?: number
    blockEffectiveness?: number
    leechPercent?: number
    wardMax?: number
    wardRegenPerTurn?: number
    enduranceThreshold?: number
    endurancePercent?: number
    primordialPower?: number
    criticalAvoidance?: number
    chanceToIgnoreResistance?: number
    ailmentResistPercent?: number
    ailmentPotencyPercent?: number
    wardBreakDamagePercent?: number
    skillDamagePercent?: number
    dotResistancePercent?: number

    // stat-system-reimagined Task 10 (D9, spec section 5) -- declared
    // BASE slots for an enemy Phap Tu boss ("MP shield + hit + DoT",
    // D21). Base values are not modifier delivery, so the domain gate
    // does not apply here; reactionEffectPercent stays invalid enemy
    // input (no base slot exists for it).
    maxMp?: number
    manaShieldPercent?: number
    manaRegenPerTurn?: number
  }
}

const DEFAULT_EVASION_RATING = 25
const DEFAULT_ACCURACY_RATING = 80
const DEFAULT_BLOCK_EFFECTIVENESS = 0.25

// Enemy data cu duoc author theo thang 3-7, trong khi BattleSystem hieu
// attackSpeed la so don/giay. Quy doi ve nhip 0.8-2.5 don/giay de mot thay doi
// nho o Attack khong con tao burst damage qua lon. Gia tri <= 2.5 duoc xem la
// du lieu da theo thang moi, nho vay enemy moi co the author truc tiep.
const LEGACY_ATTACK_SPEED_DIVISOR = 2.5
const MIN_ENEMY_ATTACK_SPEED = 0.8
const MAX_ENEMY_ATTACK_SPEED = 2.5

// stat-system-reimagined Task 3 (D16) -- the enemy range-rank input and
// its clamp retired with the attackRange stat: reach is authored on
// skills/action targeting, not on the enemy stat block.

export function normalizeEnemyAttackSpeed(authoredAttackSpeed: number): number {
  const converted = authoredAttackSpeed > MAX_ENEMY_ATTACK_SPEED
    ? authoredAttackSpeed / LEGACY_ATTACK_SPEED_DIVISOR
    : authoredAttackSpeed

  return Math.min(MAX_ENEMY_ATTACK_SPEED, Math.max(MIN_ENEMY_ATTACK_SPEED, converted))
}

// --- stat-system-reimagined Task 10: enemy input gate (D9/D21, INV-8/14) ---

const REACTION_ID_PATTERN = /reaction/i

// The `special` slots that are allowed to carry gated stats -- the MP
// trio is legitimate BASE authoring for an enemy Phap Tu boss. Every
// other gated stat (reactionEffectPercent, meta stats, future gated
// keys) is rejected wherever it appears on the input.
const ENEMY_GATED_BASE_KEYS: ReadonlySet<string> = new Set<string>([
  'maxMp',
  'manaShieldPercent',
  'manaRegenPerTurn',
])

function gatedKeysOf(record: object): StatType[] {
  return Object.keys(record).filter(
    (key): key is StatType => STAT_DOMAIN[key as StatType] !== undefined,
  )
}

/**
 * Runtime guard for cast/JSON payloads that bypass the type shape
 * (compile-time typing already rejects declared-shape violations).
 * Throws on the first violation -- same fail-fast policy as the
 * calculateStats domain gate in dev/test.
 */
export function assertEnemyStatInputAllowed(input: EnemyStatInput): void {
  const topLevel = input as unknown as Record<string, unknown>
  const special = (input.special ?? {}) as Record<string, unknown>

  for (const key of gatedKeysOf(topLevel)) {
    throw new Error(
      `[EnemyStatInput] gated stat "${key}" is invalid enemy input -- ` +
        'gated stats have no top-level base slot (reactionEffectPercent is never valid on enemies)',
    )
  }

  for (const key of gatedKeysOf(special)) {
    if (!ENEMY_GATED_BASE_KEYS.has(key)) {
      throw new Error(
        `[EnemyStatInput] gated stat "${key}" is invalid enemy input -- ` +
          'only the MP trio may be authored as base values (reactionEffectPercent is never valid on enemies)',
      )
    }
  }

  // Enemies have no StatModifier channel: buffs embedded on the
  // definition are gated separately by assertEnemyDamageSurface().
  if (Array.isArray(topLevel['modifiers']) && topLevel['modifiers'].length > 0) {
    throw new Error(
      '[EnemyStatInput] modifiers channel is invalid enemy input -- ' +
        'enemy stat deltas are authored via embedded definition buffs, never raw modifiers',
    )
  }
}

/**
 * Definition-surface gate (D21/INV-14): enemies resolve hit + DoT as
 * outgoing damage only, so no reaction-tagged buff/skill id may hang
 * off an enemy definition, and embedded buffs (tribulation/enrage) may
 * not deliver gated stats through their statModifier effects -- base
 * `special` slots are the only channel. `bossTrigger` references a
 * catalog buff by id, so only its id can be checked here.
 */
export function assertEnemyDamageSurface(
  definition: Pick<EnemyDefinition, 'bossTrigger' | 'tribulationPhases' | 'enrage'>,
): void {
  const buffs: BuffDefinition[] = []
  if (definition.bossTrigger) {
    if (REACTION_ID_PATTERN.test(definition.bossTrigger.buffDefinitionId)) {
      throw new Error(
        `[EnemyStatInput] reaction-tagged buffDefinitionId "${definition.bossTrigger.buffDefinitionId}" ` +
          'is invalid on an enemy definition -- reactions are player-path-exclusive (D21)',
      )
    }
  }
  for (const phase of definition.tribulationPhases ?? []) {
    buffs.push(phase.buff)
  }
  if (definition.enrage) {
    buffs.push(definition.enrage.buff)
  }

  for (const buff of buffs) {
    const chainedIds: Array<string | undefined> = [buff.id, buff.convertsToId]
    for (const modifier of buff.statModifiers ?? []) {
      if (STAT_DOMAIN[modifier.stat] !== undefined) {
        throw new Error(
          `[EnemyStatInput] embedded buff "${buff.id}" delivers gated stat "${modifier.stat}" ` +
            'through a modifier channel -- use a declared special base slot instead',
        )
      }
    }
    // buff2 (M5) - capability grants carry owner-typed payloads; the gate
    // scans the two buff-id fields proc/reactive payloads use (ProcCapabilities
    // appliesBuffId / appliesDefinitionId) so any buff chain authored on an
    // enemy-embedded def stays reaction-id-checked regardless of grant type.
    for (const grant of buff.capabilities ?? []) {
      const payload = grant.payload as
        | { appliesBuffId?: unknown; appliesDefinitionId?: unknown }
        | undefined
      if (typeof payload?.appliesBuffId === 'string') {
        chainedIds.push(payload.appliesBuffId)
      }
      if (typeof payload?.appliesDefinitionId === 'string') {
        chainedIds.push(payload.appliesDefinitionId)
      }
    }
    for (const id of chainedIds) {
      if (id !== undefined && REACTION_ID_PATTERN.test(id)) {
        throw new Error(
          `[EnemyStatInput] reaction-tagged buff/definition id "${id}" on enemy buff "${buff.id}" ` +
            'is invalid -- reactions are player-path-exclusive (D21)',
        )
      }
    }
  }
}

export function normalizeEnemyStats(input: EnemyStatInput): Stats {
  assertEnemyStatInputAllowed(input)

  return {
    might: input.might,
    defense: input.armor,

    maxHp: input.maxHp,
    // Quai thuong khong co Linh Luc (MP la tai nguyen rieng cua Phap
    // Tu); boss Phap Tu author BASE qua special.maxMp (D9/D21).
    maxMp: input.special?.maxMp ?? 0,

    // Gameplay fixes (2026-09-05) - turn-based pacing: he song author
    // attackSpeed theo DON/GIAY (0.8-2.5 don/s) -> turn engine can gauge
    // rate tuong duong: 1 don = 1 turn = GAUGE_MAX day moi (1/attackSpeed)
    // giay -> speed stat = 100 x attackSpeed (thang chung voi player
    // speed=100+dexx0.15, 1 turn/giay tai speed 100).
    speed: normalizeEnemyAttackSpeed(input.attackSpeed) * 100,

    criticalRate: input.criticalRate,
    criticalDamage: input.criticalDamage,

    evasionRate: input.evasionRate ?? DEFAULT_EVASION_RATING,

    // Quai khong co hanh trinh attribute rieng.
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
    wardRegenPerTurn: input.special?.wardRegenPerTurn ?? 0,
    wardBreakDamagePercent: input.special?.wardBreakDamagePercent ?? 0,
    manaShieldPercent: input.special?.manaShieldPercent ?? 0,
    // Phap Tu Reimagined (spec D9) - Ho The is a player-path mechanic;
    // enemies never carry an LL-shield cap (0 = no DR contribution).
    linhLucHoTheCap: 0,
    leechPercent: input.special?.leechPercent ?? 0,
    // The Tu Reimagined (spec 2026-09-15 T12) - generic thorns stat retired;
    // enemies never had a real source for it anyway (special input
    // dropped in the same sweep).
    // D18 - enemies have no authored healing-effectiveness channel yet;
    // the stat exists on Stats but stays 0 until a real source needs it.
    healingEffectivenessPercent: 0,
    // The Tu An reactive chances (spec 2026-09-15) - attribute-derived
    // player-path stats; enemies have no attribute journey so always 0.
    counterChance: 0,
    protectChance: 0,
    followUpChance: 0,
    hpRegenPerTurn: input.hpRegenPerTurn ?? 0,
    manaRegenPerTurn: input.special?.manaRegenPerTurn ?? 0,
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

    // i18n refactor 2026-08-31 - technique-tier / realm / production /
    // artifact / pill stats are player-only; enemy gets 0 / baseline.
    realmPassivePercent: 0,
    affixDeltaPercent: 0,
    productionSpeedMultiplier: 1,
    artifactGradeMultiplier: 1,
    cultivationPercent: 0,

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

    // Spec 2026-08-30-phap-tu-dao-sac sec5 - Phong/Loi da bo toan he nen
    // khong con field normalize tuong ung.

    primordialPower: input.special?.primordialPower ?? 0,
  }
}

// Elite tang thoi gian giao chien nhung chi tang vua phai sat thuong; them
// Armor/Accuracy de khac quai thuong ma khong tao burst bat ngo.
const ELITE_MAX_HP_MULTIPLIER = 2.5
const ELITE_MIGHT_MULTIPLIER = 1.35
const ELITE_DEFENSE_MULTIPLIER = 1.15
const ELITE_ACCURACY_MULTIPLIER = 1.1

export function applyEliteMultiplier(stats: Stats): Stats {
  return {
    ...stats,

    maxHp: stats.maxHp * ELITE_MAX_HP_MULTIPLIER,
    might: stats.might * ELITE_MIGHT_MULTIPLIER,
    defense: stats.defense * ELITE_DEFENSE_MULTIPLIER,
    accuracyRating: stats.accuracyRating * ELITE_ACCURACY_MULTIPLIER,
  }
}

// Floor stat-scale (stat wall ladder): the stage's own difficulty
// multiplier - same spec-shape as the elite path (hp / might / defense /
// accuracy). Applied at spawn AFTER tag/boss transforms, so floors
// 1-9 scale normals and floor 10 scales the boss on top of
// applyBossMultiplier. Evasion and attackSpeed stay unscaled: evasion
// already gates hit rate through the accuracy curve, and attack speed
// changes the engagement's ATB shape (a pacing knob, not a stat knob).
export function applyFloorStatScale(stats: Stats, scale: number): Stats {
  if (scale <= 0) {
    throw new Error(`applyFloorStatScale: scale must be > 0 (got ${scale})`)
  }
  if (scale === 1) {
    return stats
  }
  return {
    ...stats,
    maxHp: stats.maxHp * scale,
    might: stats.might * scale,
    defense: stats.defense * scale,
    accuracyRating: stats.accuracyRating * scale,
  }
}

// Boss spends most of its power budget on engagement time and defense.
// Attack x2.0 (2026-09-13, up from x1.6): x1.6 was set when legacy speed
// 3-7 gave the boss ~2 actions/round, so each hit had to stay small. With
// speed re-authored to the parity band (~1 action/round), the boss needs
// heavier hits or floor 10 stays easier than floors 8-9 before it.
const BOSS_MAX_HP_MULTIPLIER = 7
const BOSS_MIGHT_MULTIPLIER = 2.0
const BOSS_DEFENSE_MULTIPLIER = 1.2
const BOSS_ACCURACY_MULTIPLIER = 1.15
const BOSS_RESISTANCE_BONUS = 15
const BOSS_CRITICAL_AVOIDANCE = 0.15

export function applyBossMultiplier(stats: Stats): Stats {
  return {
    ...stats,

    maxHp: stats.maxHp * BOSS_MAX_HP_MULTIPLIER,
    might: stats.might * BOSS_MIGHT_MULTIPLIER,
    defense: stats.defense * BOSS_DEFENSE_MULTIPLIER,
    accuracyRating: stats.accuracyRating * BOSS_ACCURACY_MULTIPLIER,
    criticalAvoidance: Math.max(stats.criticalAvoidance, BOSS_CRITICAL_AVOIDANCE),
    // Uniform five-element bonus: the bonus must not single out players
    // whose damage element matches the boss's own power element (the
    // three beta stage bosses all lean water). Rebalance knob lives with
    // the balance matrix.
    woodResistance: stats.woodResistance + BOSS_RESISTANCE_BONUS,
    fireResistance: stats.fireResistance + BOSS_RESISTANCE_BONUS,
    earthResistance: stats.earthResistance + BOSS_RESISTANCE_BONUS,
    metalResistance: stats.metalResistance + BOSS_RESISTANCE_BONUS,
    waterResistance: stats.waterResistance + BOSS_RESISTANCE_BONUS,
    // Spec 2026-08-30-phap-tu-dao-sac sec5 - boss resistance bonus cho
    // Phong/Loi da xoa cung stat.
  }
}
