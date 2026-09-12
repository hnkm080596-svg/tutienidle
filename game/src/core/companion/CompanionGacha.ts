// CompanionGacha (companion-gacha Task 3, 2026-09-12) - mechanism only:
// rate-table values and the pull currency are content/balance decisions,
// not designed here. A pull increments the pity counter first and arms
// PITY_ELEVATED_WEIGHTS once the counter reaches PITY_THRESHOLD; a
// rare-or-better grade (dia+) resets the counter even on a natural hit.
// Duplicate pulls raise constellationRank via applyConstellationRank; a
// duplicate on a maxed constellation reports duyenPhanBonus for the ops
// layer to credit (the +1 duyenPhan per pull is added there, not here).
import type { ItemGrade } from '@/core/item/ItemGrade'
import type { CompanionDefinition, CompanionInstance } from '@/data/companion/Companions'
import { applyConstellationRank, MAX_CONSTELLATION_RANK } from './CompanionProgression'

const GRADE_ORDER: readonly ItemGrade[] = ['hoang', 'huyen', 'dia', 'thien', 'tien']

// Rare-or-better cutoff for the pity reset. Rarity rank is GRADE_ORDER
// position, never string comparison ('hoang' > 'dia' alphabetically).
const DIA_GRADE_INDEX = GRADE_ORDER.indexOf('dia')

export const COMPANION_BASE_RATES: Record<ItemGrade, number> = {
  hoang: 0.8399, huyen: 0.10, dia: 0.05, thien: 0.01, tien: 0.0001,
}

export const PITY_THRESHOLD = 30

// Relative weights - renormalized internally; also filtered to grades
// that exist in the pool.
export const PITY_ELEVATED_WEIGHTS: Partial<Record<ItemGrade, number>> = { dia: 5, thien: 1, tien: 0.01 }

export const DUPLICATE_MAXED_DUYEN_PHAN = 5

// Zero-out grades with no definition in the pool, then renormalize the
// rest to sum 1. Filtering is load-bearing: pickDefinitionOfGrade throws
// on an empty grade pool, so an unfiltered rate would be a crash slot.
export function effectiveCompanionRates(
  rates: Record<ItemGrade, number>,
  pool: readonly CompanionDefinition[],
): Record<ItemGrade, number> {
  const pooledGrades = new Set(pool.map((definition) => definition.grade))
  const effective: Record<ItemGrade, number> = { hoang: 0, huyen: 0, dia: 0, thien: 0, tien: 0 }

  let total = 0

  for (const grade of GRADE_ORDER) {
    if (pooledGrades.has(grade)) {
      effective[grade] = rates[grade]
      total += rates[grade]
    }
  }

  if (total <= 0) {
    return effective
  }

  for (const grade of GRADE_ORDER) {
    effective[grade] /= total
  }

  return effective
}

// Roll a grade against the cumulative rate table in GRADE_ORDER: the
// first grade whose cumulative sum exceeds the roll wins. A 0-rate
// grade can never trigger `roll < cumulative`.
export function rollCompanionGrade(rates: Record<ItemGrade, number>, random: () => number = Math.random): ItemGrade {
  const roll = random()

  let cumulative = 0

  for (const grade of GRADE_ORDER) {
    cumulative += rates[grade]

    if (roll < cumulative) {
      return grade
    }
  }

  // Floating-point guard (rates summing under 1.0): fall back to the
  // last grade in the table.
  return GRADE_ORDER[GRADE_ORDER.length - 1]!
}

// Pick uniformly at random among the pool definitions of the rolled
// grade. The throw is an unreachable-by-construction guard: callers must
// pass rates already filtered by effectiveCompanionRates.
export function pickDefinitionOfGrade(
  grade: ItemGrade,
  pool: readonly CompanionDefinition[],
  random: () => number = Math.random,
): CompanionDefinition {
  const candidates = pool.filter((definition) => definition.grade === grade)

  if (candidates.length === 0) {
    throw new Error(`pickDefinitionOfGrade: no companion definitions of grade "${grade}" in the pool`)
  }

  const index = Math.floor(random() * candidates.length)

  return candidates[index]!
}

// Fresh instance from a pull/exchange: always mortal realmLevel 1,
// constellation rank 0. newInstanceId is injectable for tests; the
// default wraps crypto.randomUUID (a bare `crypto.randomUUID` reference
// would throw - the browser brand-checks `this` on crypto methods).
export function createCompanionInstance(
  definition: CompanionDefinition,
  newInstanceId: () => string = () => crypto.randomUUID(),
): CompanionInstance {
  return {
    instanceId: newInstanceId(),
    definitionId: definition.id,
    realmId: 'mortal',
    realmLevel: 1,
    exp: 0,
    constellationRank: 0,
  }
}

export interface CompanionPullOutcome {
  definition: CompanionDefinition
  grade: ItemGrade
  isDuplicate: boolean
  pityTriggered: boolean
  kind: 'new' | 'constellation_up' | 'constellation_maxed'
  constellationRankAfter?: number
  duyenPhanBonus: number // 0 normally, DUPLICATE_MAXED_DUYEN_PHAN when maxed
}

// Pure: returns a NEW owned array (input never mutated), the next pity
// counter, and everything the ops layer needs to credit duyenPhan and
// render the reveal. Order per spec section 2: increment counter, arm
// pity at the threshold, roll against pool-filtered rates, then reset
// the counter on any dia+ grade (natural or pity).
export function pullCompanion(
  owned: CompanionInstance[],
  pool: readonly CompanionDefinition[],
  pullsSinceRare: number,
  random: () => number = Math.random,
  newInstanceId: () => string = () => crypto.randomUUID(),
): { owned: CompanionInstance[]; pullsSinceRare: number; outcome: CompanionPullOutcome } {
  const counter = pullsSinceRare + 1
  const pityTriggered = counter >= PITY_THRESHOLD

  // Pity weights are relative with the floor at dia - hoang/huyen stay
  // 0 so an armed pity can never roll below dia. effectiveCompanionRates
  // filters grades missing from the pool and renormalizes.
  const pityWeights: Record<ItemGrade, number> = {
    hoang: 0,
    huyen: 0,
    dia: 0,
    thien: 0,
    tien: 0,
    ...PITY_ELEVATED_WEIGHTS,
  }

  const grade = rollCompanionGrade(
    effectiveCompanionRates(pityTriggered ? pityWeights : COMPANION_BASE_RATES, pool),
    random,
  )
  const definition = pickDefinitionOfGrade(grade, pool, random)

  const nextPullsSinceRare = GRADE_ORDER.indexOf(grade) >= DIA_GRADE_INDEX ? 0 : counter

  const existingIndex = owned.findIndex((instance) => instance.definitionId === definition.id)

  if (existingIndex === -1) {
    return {
      owned: [...owned, createCompanionInstance(definition, newInstanceId)],
      pullsSinceRare: nextPullsSinceRare,
      outcome: {
        definition,
        grade,
        isDuplicate: false,
        pityTriggered,
        kind: 'new',
        duyenPhanBonus: 0,
      },
    }
  }

  const ranked = applyConstellationRank(owned[existingIndex]!)

  if (ranked.maxed) {
    // Pull cannot be rejected after the roll - convert to duyenPhan.
    return {
      owned,
      pullsSinceRare: nextPullsSinceRare,
      outcome: {
        definition,
        grade,
        isDuplicate: true,
        pityTriggered,
        kind: 'constellation_maxed',
        constellationRankAfter: MAX_CONSTELLATION_RANK,
        duyenPhanBonus: DUPLICATE_MAXED_DUYEN_PHAN,
      },
    }
  }

  const updated = [...owned]
  updated[existingIndex] = ranked.instance

  return {
    owned: updated,
    pullsSinceRare: nextPullsSinceRare,
    outcome: {
      definition,
      grade,
      isDuplicate: true,
      pityTriggered,
      kind: 'constellation_up',
      constellationRankAfter: ranked.instance.constellationRank,
      duyenPhanBonus: 0,
    },
  }
}
