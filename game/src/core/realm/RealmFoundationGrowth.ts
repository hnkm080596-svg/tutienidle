import type { PlayerData } from '../player/Player'
import type { StatModifier } from '../stats/StatCalculator'
import type { Stats } from '../stats/StatBlock'
import { REALMS } from '../../data/realms/realm'
import { getCurrentRealm, getRealmIndex } from './realmSystem'

export interface RealmFoundationTotals {
  maxHp: number
  might: number
  defense: number
  hpRegenPerTurn: number
  speed: number
  cultivationPercent: number
  productionSpeedMultiplier: number
  affixDeltaPercent: number
  realmPassivePercent: number
}

interface RealmTierGrowthConfig {
  entryLeap: RealmFoundationTotals
  perFloor: RealmFoundationTotals
  milestoneBonus: Pick<RealmFoundationTotals, 'maxHp' | 'might' | 'defense' | 'cultivationPercent'>
}

// Non-primary foundation & cultivation resonance growth per realm tier and floor.
// Mortal floor 1 is the baseline (0 breakthroughs -> all zeros).
const REALM_TIER_GROWTH: Record<string, RealmTierGrowthConfig> = {
  mortal: {
    entryLeap: {
      maxHp: 0,
      might: 0,
      defense: 0,
      hpRegenPerTurn: 0,
      speed: 0,
      cultivationPercent: 0,
      productionSpeedMultiplier: 0,
      affixDeltaPercent: 0,
      realmPassivePercent: 0,
    },
    perFloor: {
      maxHp: 12,
      might: 1.5,
      defense: 1,
      hpRegenPerTurn: 0.3,
      speed: 0,
      cultivationPercent: 0.01,
      productionSpeedMultiplier: 0.015,
      affixDeltaPercent: 0.005,
      realmPassivePercent: 0.008,
    },
    milestoneBonus: { maxHp: 10, might: 1.5, defense: 1, cultivationPercent: 0.01 },
  },
  qi_refining: {
    entryLeap: {
      maxHp: 50,
      might: 6,
      defense: 4,
      hpRegenPerTurn: 1.5,
      speed: 2,
      cultivationPercent: 0.04,
      productionSpeedMultiplier: 0.06,
      affixDeltaPercent: 0.02,
      realmPassivePercent: 0.03,
    },
    perFloor: {
      maxHp: 28,
      might: 3,
      defense: 2,
      hpRegenPerTurn: 0.6,
      speed: 0,
      cultivationPercent: 0.015,
      productionSpeedMultiplier: 0.02,
      affixDeltaPercent: 0.008,
      realmPassivePercent: 0.012,
    },
    milestoneBonus: { maxHp: 25, might: 3, defense: 2, cultivationPercent: 0.015 },
  },
  foundation_establishment: {
    entryLeap: {
      maxHp: 140,
      might: 15,
      defense: 10,
      hpRegenPerTurn: 3.5,
      speed: 3,
      cultivationPercent: 0.06,
      productionSpeedMultiplier: 0.1,
      affixDeltaPercent: 0.03,
      realmPassivePercent: 0.05,
    },
    perFloor: {
      maxHp: 65,
      might: 7,
      defense: 4.5,
      hpRegenPerTurn: 1.4,
      speed: 0,
      cultivationPercent: 0.02,
      productionSpeedMultiplier: 0.03,
      affixDeltaPercent: 0.01,
      realmPassivePercent: 0.015,
    },
    milestoneBonus: { maxHp: 60, might: 6, defense: 4, cultivationPercent: 0.02 },
  },
  golden_core: {
    entryLeap: {
      maxHp: 320,
      might: 35,
      defense: 24,
      hpRegenPerTurn: 8,
      speed: 4,
      cultivationPercent: 0.08,
      productionSpeedMultiplier: 0.14,
      affixDeltaPercent: 0.04,
      realmPassivePercent: 0.07,
    },
    perFloor: {
      maxHp: 140,
      might: 15,
      defense: 10,
      hpRegenPerTurn: 3,
      speed: 0,
      cultivationPercent: 0.025,
      productionSpeedMultiplier: 0.04,
      affixDeltaPercent: 0.012,
      realmPassivePercent: 0.02,
    },
    milestoneBonus: { maxHp: 120, might: 12, defense: 8, cultivationPercent: 0.025 },
  },
  nascent_soul: {
    entryLeap: {
      maxHp: 700,
      might: 75,
      defense: 50,
      hpRegenPerTurn: 18,
      speed: 5,
      cultivationPercent: 0.1,
      productionSpeedMultiplier: 0.18,
      affixDeltaPercent: 0.05,
      realmPassivePercent: 0.09,
    },
    perFloor: {
      maxHp: 300,
      might: 32,
      defense: 22,
      hpRegenPerTurn: 6.5,
      speed: 0,
      cultivationPercent: 0.03,
      productionSpeedMultiplier: 0.05,
      affixDeltaPercent: 0.015,
      realmPassivePercent: 0.025,
    },
    milestoneBonus: { maxHp: 250, might: 25, defense: 18, cultivationPercent: 0.03 },
  },
  spirit_severing: {
    entryLeap: {
      maxHp: 1500,
      might: 160,
      defense: 110,
      hpRegenPerTurn: 40,
      speed: 6,
      cultivationPercent: 0.12,
      productionSpeedMultiplier: 0.22,
      affixDeltaPercent: 0.06,
      realmPassivePercent: 0.12,
    },
    perFloor: {
      maxHp: 620,
      might: 68,
      defense: 45,
      hpRegenPerTurn: 14,
      speed: 0,
      cultivationPercent: 0.035,
      productionSpeedMultiplier: 0.06,
      affixDeltaPercent: 0.02,
      realmPassivePercent: 0.03,
    },
    milestoneBonus: { maxHp: 500, might: 50, defense: 35, cultivationPercent: 0.035 },
  },
}

const SUB_REALM_MILESTONE_FLOORS = [4, 7, 10] as const

function countMilestonesReached(level: number): number {
  let count = 0
  for (const milestone of SUB_REALM_MILESTONE_FLOORS) {
    if (level >= milestone) {
      count += 1
    }
  }
  return count
}

function addInto(target: RealmFoundationTotals, addition: RealmFoundationTotals): void {
  target.maxHp += addition.maxHp
  target.might += addition.might
  target.defense += addition.defense
  target.hpRegenPerTurn += addition.hpRegenPerTurn
  target.speed += addition.speed
  target.cultivationPercent += addition.cultivationPercent
  target.productionSpeedMultiplier += addition.productionSpeedMultiplier
  target.affixDeltaPercent += addition.affixDeltaPercent
  target.realmPassivePercent += addition.realmPassivePercent
}

function computeSingleRealmContribution(realmId: string, levelReached: number): RealmFoundationTotals {
  const config = REALM_TIER_GROWTH[realmId] ?? REALM_TIER_GROWTH.spirit_severing!
  const floorsAdvanced = Math.max(0, Math.floor(levelReached) - 1)
  const milestones = countMilestonesReached(Math.floor(levelReached))

  return {
    maxHp:
      config.entryLeap.maxHp +
      floorsAdvanced * config.perFloor.maxHp +
      milestones * config.milestoneBonus.maxHp,
    might:
      config.entryLeap.might +
      floorsAdvanced * config.perFloor.might +
      milestones * config.milestoneBonus.might,
    defense:
      config.entryLeap.defense +
      floorsAdvanced * config.perFloor.defense +
      milestones * config.milestoneBonus.defense,
    hpRegenPerTurn:
      Math.round((config.entryLeap.hpRegenPerTurn + floorsAdvanced * config.perFloor.hpRegenPerTurn) * 100) /
      100,
    speed: config.entryLeap.speed + floorsAdvanced * config.perFloor.speed,
    cultivationPercent:
      config.entryLeap.cultivationPercent +
      floorsAdvanced * config.perFloor.cultivationPercent +
      milestones * config.milestoneBonus.cultivationPercent,
    productionSpeedMultiplier:
      config.entryLeap.productionSpeedMultiplier +
      floorsAdvanced * config.perFloor.productionSpeedMultiplier,
    affixDeltaPercent:
      config.entryLeap.affixDeltaPercent +
      floorsAdvanced * config.perFloor.affixDeltaPercent,
    realmPassivePercent:
      config.entryLeap.realmPassivePercent +
      floorsAdvanced * config.perFloor.realmPassivePercent,
  }
}

/**
 * Computes the cumulative non-primary stat foundation totals for a given
 * `(realmId, realmLevel)`. At `(mortal, 1)`, returns all zeros.
 */
export function computeRealmFoundationTotals(
  realmId: string,
  realmLevel: number,
): RealmFoundationTotals {
  const totals: RealmFoundationTotals = {
    maxHp: 0,
    might: 0,
    defense: 0,
    hpRegenPerTurn: 0,
    speed: 0,
    cultivationPercent: 0,
    productionSpeedMultiplier: 0,
    affixDeltaPercent: 0,
    realmPassivePercent: 0,
  }

  const targetIndex = getRealmIndex(realmId)
  if (targetIndex < 0) {
    return totals
  }

  for (let i = 0; i < targetIndex; i += 1) {
    const pastRealm = REALMS[i]!
    addInto(totals, computeSingleRealmContribution(pastRealm.id, pastRealm.maxLevel))
  }

  const currentRealm = getCurrentRealm(realmId)
  const clampedLevel = Math.max(1, Math.min(realmLevel, currentRealm.maxLevel))
  addInto(totals, computeSingleRealmContribution(realmId, clampedLevel))

  totals.maxHp = Math.round(totals.maxHp)
  totals.might = Math.round(totals.might * 10) / 10
  totals.defense = Math.round(totals.defense * 10) / 10
  totals.hpRegenPerTurn = Math.round(totals.hpRegenPerTurn * 100) / 100
  totals.speed = Math.round(totals.speed * 10) / 10
  totals.cultivationPercent = Math.round(totals.cultivationPercent * 1000) / 1000
  totals.productionSpeedMultiplier = Math.round(totals.productionSpeedMultiplier * 1000) / 1000
  totals.affixDeltaPercent = Math.round(totals.affixDeltaPercent * 1000) / 1000
  totals.realmPassivePercent = Math.round(totals.realmPassivePercent * 1000) / 1000

  return totals
}

/**
 * Emits flat non-primary cultivation/realm foundation StatModifiers for the
 * player's current realm & floor. Returns `[]` at `mortal` level 1 (0 breakthroughs).
 * Keeps combat stat-wall and deterministic battle seed fingerprints untouched while
 * raising real non-primary Stats (`cultivationPercent`, `productionSpeedMultiplier`,
 * `affixDeltaPercent`, `realmPassivePercent`) on every breakthrough.
 */
export function getRealmFoundationModifiers(
  player: Pick<PlayerData, 'realmId' | 'realmLevel'>,
): StatModifier[] {
  const totals = computeRealmFoundationTotals(player.realmId, player.realmLevel)
  const modifiers: StatModifier[] = []

  const entries: Array<[
    keyof Pick<
      RealmFoundationTotals,
      'cultivationPercent' | 'productionSpeedMultiplier' | 'affixDeltaPercent' | 'realmPassivePercent'
    >,
    number,
    StatModifier['domain'],
  ]> = [
    ['cultivationPercent', totals.cultivationPercent, 'cultivation'],
    ['productionSpeedMultiplier', totals.productionSpeedMultiplier, 'production'],
    ['affixDeltaPercent', totals.affixDeltaPercent, 'equipment_meta'],
    ['realmPassivePercent', totals.realmPassivePercent, 'realm'],
  ]

  for (const [stat, value, domain] of entries) {
    if (value > 0) {
      modifiers.push({
        id: `realm-foundation:${stat}`,
        sourceId: 'realm_foundation',
        sourceType: 'realm',
        stat,
        domain,
        flat: value,
      })
    }
  }

  return modifiers
}

export interface BreakthroughGrowthStatRow {
  stat: keyof RealmFoundationTotals
  before: number
  after: number
  delta: number
}

export interface BreakthroughGrowthSnapshot {
  fromRealmId: string
  fromRealmName: string
  fromLevel: number
  toRealmId: string
  toRealmName: string
  toLevel: number
  isMajorRealm: boolean
  statRows: BreakthroughGrowthStatRow[]
  attributePointsGained: number
  totalAttributePoints: number
}

/**
 * Builds a presentation-ready growth summary comparing pre- and post-breakthrough
 * realm foundation stats (plus any live finalStats delta).
 */
export function buildBreakthroughGrowthSnapshot(params: {
  fromRealmId: string
  fromLevel: number
  fromAttributePoints: number
  fromStats?: Pick<Stats, keyof RealmFoundationTotals>
  toRealmId: string
  toLevel: number
  toAttributePoints: number
  toStats?: Pick<Stats, keyof RealmFoundationTotals>
}): BreakthroughGrowthSnapshot {
  const beforeFoundation = computeRealmFoundationTotals(params.fromRealmId, params.fromLevel)
  const afterFoundation = computeRealmFoundationTotals(params.toRealmId, params.toLevel)

  const keys: Array<keyof RealmFoundationTotals> = [
    'maxHp',
    'might',
    'defense',
    'hpRegenPerTurn',
    'speed',
    'cultivationPercent',
    'productionSpeedMultiplier',
  ]

  const statRows: BreakthroughGrowthStatRow[] = []
  for (const stat of keys) {
    const foundationDelta = Math.round((afterFoundation[stat] - beforeFoundation[stat]) * 1000) / 1000
    const liveBefore = params.fromStats ? params.fromStats[stat] : beforeFoundation[stat]
    const liveAfter = params.toStats
      ? Math.max(params.toStats[stat], liveBefore + foundationDelta)
      : afterFoundation[stat]
    const delta = Math.round((liveAfter - liveBefore) * 1000) / 1000

    if (delta > 0) {
      statRows.push({
        stat,
        before: Math.round(liveBefore * 1000) / 1000,
        after: Math.round(liveAfter * 1000) / 1000,
        delta,
      })
    }
  }

  return {
    fromRealmId: params.fromRealmId,
    fromRealmName: getCurrentRealm(params.fromRealmId).name,
    fromLevel: params.fromLevel,
    toRealmId: params.toRealmId,
    toRealmName: getCurrentRealm(params.toRealmId).name,
    toLevel: params.toLevel,
    isMajorRealm: params.fromRealmId !== params.toRealmId,
    statRows,
    attributePointsGained: Math.max(0, params.toAttributePoints - params.fromAttributePoints),
    totalAttributePoints: params.toAttributePoints,
  }
}
