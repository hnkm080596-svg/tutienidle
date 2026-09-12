// CompanionProgression (companion-gacha Task 2, 2026-09-12) - replaces the
// old flat-curve leveling module: realm-aware exp curve, dynamic player-realm ceiling,
// constellation-scaled stats, skill unlock/override resolution, feed values.
// All functions are pure - they return new objects, never mutate inputs.
import type {
  CompanionBaseStats,
  CompanionDefinition,
  CompanionInstance,
  CompanionSkillOverride,
  CompanionSkillSlot,
} from '@/data/companion/Companions'
import type { TurnSkillDefinition } from '@/core/battle/turn/TurnSkillAction'
import { REALMS } from '@/data/realms/realm'
import { getGlobalCultivationLevel, getRealmIndex } from '@/core/realm/realmSystem'
import type { Material } from '@/core/material/Material'

export const MAX_CONSTELLATION_RANK = 6
export const CONSTELLATION_STAT_PER_RANK = 0.10

const EXP_BASE = 40
const EXP_TIER_EXPONENT = 1.2
const BATTLE_EXP_PER_KILL_BASE = 2
const FEED_EXP_BASE = 10

// (index+1) makes mortal cost 1x - getRealmIndex('mortal') is 0 and a 0
// multiplier would make every tier free.
export function companionExpRequiredForLevel(realmId: string, realmLevel: number): number {
  return Math.round(EXP_BASE * Math.pow(realmLevel, EXP_TIER_EXPONENT) * (getRealmIndex(realmId) + 1))
}

export function companionBattleExpPerKill(stageRealmId: string): number {
  return BATTLE_EXP_PER_KILL_BASE * (getRealmIndex(stageRealmId) + 1)
}

export function companionGlobalLevel(instance: Pick<CompanionInstance, 'realmId' | 'realmLevel'>): number {
  return getGlobalCultivationLevel(instance.realmId, instance.realmLevel)
}

export interface ApplyExpResult {
  instance: CompanionInstance
  levelsGained: number
  realmBreakthroughs: string[] // realmIds entered, in order (can chain)
  clampedExp: number // exp discarded at the player-realm ceiling
}

// Exp is capped by the PLAYER's current realm: a companion levels freely
// inside its own realm, auto-breaks through to the next realm while it sits
// below the player realm, and discards leftover exp once it reaches the top
// tier of the player realm - the ceiling rises as the player advances.
export function applyCompanionExp(
  instance: CompanionInstance,
  amount: number,
  playerRealmId: string,
): ApplyExpResult {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { instance, levelsGained: 0, realmBreakthroughs: [], clampedExp: 0 }
  }

  const playerRealmIndex = getRealmIndex(playerRealmId)

  let realmId = instance.realmId
  let realmLevel = instance.realmLevel
  let exp = instance.exp + amount
  let levelsGained = 0
  let clampedExp = 0
  const realmBreakthroughs: string[] = []

  while (true) {
    const realmIndex = getRealmIndex(realmId)
    const realm = realmIndex >= 0 ? REALMS[realmIndex] : undefined

    if (!realm) {
      break // unknown realmId: stop, keep whatever progress was made
    }

    // Ceiling: top tier of the player realm (or beyond it - defensive, a
    // companion can never legitimately out-realm the player). Checked before
    // spending exp so realmLevel can never exceed maxLevel at the cap.
    if (realmIndex >= playerRealmIndex && realmLevel >= realm.maxLevel) {
      clampedExp = exp
      exp = 0
      break
    }

    const required = companionExpRequiredForLevel(realmId, realmLevel)

    if (exp < required) {
      break
    }

    exp -= required
    realmLevel += 1
    levelsGained += 1

    // Passing maxLevel means the ceiling check above passed, i.e. the
    // companion is below the player realm, so REALMS[realmIndex + 1] always
    // exists. Leftover exp keeps flowing - breakthroughs can chain.
    if (realmLevel > realm.maxLevel) {
      const nextRealm = REALMS[realmIndex + 1]

      if (!nextRealm) {
        break
      }

      realmId = nextRealm.id
      realmLevel = 1
      realmBreakthroughs.push(realmId)
    }
  }

  return {
    instance: { ...instance, realmId, realmLevel, exp },
    levelsGained,
    realmBreakthroughs,
    clampedExp,
  }
}

// "Level-maxed" = at the top tier of the player's current realm - a dynamic
// cap that rises when the player breaks through (design spec section 5).
export function isCompanionLevelMaxed(instance: CompanionInstance, playerRealmId: string): boolean {
  const realmIndex = getRealmIndex(instance.realmId)
  const realm = realmIndex >= 0 ? REALMS[realmIndex] : undefined

  return (
    realm !== undefined &&
    realmIndex === getRealmIndex(playerRealmId) &&
    instance.realmLevel === realm.maxLevel
  )
}

export type ApplyConstellationRankResult = { maxed: true } | { maxed: false; instance: CompanionInstance }

// rank < MAX -> +1 on a new instance; rank maxed -> { maxed: true } for the
// caller to decide (pull converts to duyenPhan, exchange rejects) - spec section 5.
export function applyConstellationRank(instance: CompanionInstance): ApplyConstellationRankResult {
  if (instance.constellationRank >= MAX_CONSTELLATION_RANK) {
    return { maxed: true }
  }

  return { maxed: false, instance: { ...instance, constellationRank: instance.constellationRank + 1 } }
}

// Resolved combat stats: base x level growth x constellation, then 'stat'
// perks (flat first, percent on the post-flat value). Speed ignores
// level growth but still takes the constellation multiplier and stat perks.
export function companionStatsAt(definition: CompanionDefinition, instance: CompanionInstance): CompanionBaseStats {
  const globalLevel = companionGlobalLevel(instance)
  const growth = 1 + definition.growthRate * (globalLevel - 1)
  const constellation = 1 + CONSTELLATION_STAT_PER_RANK * instance.constellationRank

  const stats: CompanionBaseStats = {
    maxHp: definition.baseStats.maxHp * growth * constellation,
    attack: definition.baseStats.attack * growth * constellation,
    speed: definition.baseStats.speed * constellation,
  }

  for (const perk of definition.constellationPerks ?? []) {
    if (perk.kind !== 'stat' || perk.atRank > instance.constellationRank) {
      continue
    }

    const withFlat = stats[perk.stat] + (perk.flat ?? 0)
    stats[perk.stat] = withFlat * (1 + (perk.percent ?? 0) / 100)
  }

  return {
    maxHp: Math.round(stats.maxHp),
    attack: Math.round(stats.attack),
    speed: stats.speed,
  }
}

// basic is always unlocked; special/ultimate need both the declared skill
// and its unlockThresholds entry, then realm index (never string equality)
// first and tier second.
export function isCompanionSkillUnlocked(
  definition: CompanionDefinition,
  instance: Pick<CompanionInstance, 'realmId' | 'realmLevel'>,
  slot: CompanionSkillSlot,
): boolean {
  if (slot === 'basic') {
    return true
  }

  const threshold = definition.unlockThresholds[slot]

  if (!definition[slot] || !threshold) {
    return false
  }

  const thresholdRealmIndex = getRealmIndex(threshold.realmId)

  if (thresholdRealmIndex === -1) {
    return false // threshold references an unknown realm: treat as locked
  }

  const instanceRealmIndex = getRealmIndex(instance.realmId)

  if (instanceRealmIndex !== thresholdRealmIndex) {
    return instanceRealmIndex > thresholdRealmIndex
  }

  return instance.realmLevel >= threshold.realmLevel
}

export interface CompanionSkillKit {
  basic: TurnSkillDefinition
  special?: TurnSkillDefinition
  ultimate?: TurnSkillDefinition
}

// Resolved per-instance kit: basic always present, special/ultimate gated by
// unlockThresholds, then every skill_override perk with atRank <=
// constellationRank applied to its slot. All returned skills are clones -
// definition objects are never mutated.
export function resolveCompanionSkillKit(
  definition: CompanionDefinition,
  instance: CompanionInstance,
): CompanionSkillKit {
  const kit: CompanionSkillKit = { basic: cloneSkill(definition.basic) }

  if (definition.special && isCompanionSkillUnlocked(definition, instance, 'special')) {
    kit.special = cloneSkill(definition.special)
  }

  if (definition.ultimate && isCompanionSkillUnlocked(definition, instance, 'ultimate')) {
    kit.ultimate = cloneSkill(definition.ultimate)
  }

  for (const perk of definition.constellationPerks ?? []) {
    if (perk.kind !== 'skill_override' || perk.atRank > instance.constellationRank) {
      continue
    }

    const skill = kit[perk.slot]

    if (skill) {
      kit[perk.slot] = applySkillOverride(skill, perk.overrides)
    }
  }

  return kit
}

function cloneSkill(skill: TurnSkillDefinition): TurnSkillDefinition {
  const clone: TurnSkillDefinition = { ...skill }

  if (clone.damage) {
    clone.damage = { ...clone.damage }
  }

  return clone
}

function applySkillOverride(skill: TurnSkillDefinition, overrides: CompanionSkillOverride): TurnSkillDefinition {
  const next: TurnSkillDefinition = { ...skill }

  if (overrides.cooldownTurns !== undefined) {
    next.cooldownTurns = overrides.cooldownTurns
  }

  if (overrides.damageMultiplierPercent !== undefined && next.damage) {
    next.damage = { ...next.damage, multiplier: next.damage.multiplier * (1 + overrides.damageMultiplierPercent / 100) }
  }

  if (overrides.healPercentOfDamage !== undefined) {
    next.healPercentOfDamage = overrides.healPercentOfDamage
  }

  return next
}

// Feed value of one material: profession materials scale with their realm
// index, everything else is a flat 10.
export function companionFeedExpValue(material: Material): number {
  if (!material.profession) {
    return FEED_EXP_BASE
  }

  return FEED_EXP_BASE * (getRealmIndex(material.profession.realmId) + 1)
}
