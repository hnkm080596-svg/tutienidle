import { familyDropTableFor } from '../../data/drop/FamilyDropTables'
import { stageDropTableFor } from '../../data/drop/StageDropTables'
import type { DropModifier } from './DropModifier'
import { resolveDrops } from './resolveDrops'

const DEFAULT_SAMPLE_SIZE = 100_000

/**
 * Mulberry32 - small, seedable, good enough for expectation sampling.
 *
 * Shared by the characterization test (Task 6) and any later task that needs
 * the same repeatable sampler (economy guard). Do not inline a second copy of
 * this: two seeded rng implementations that are meant to agree is exactly the
 * kind of drift this module exists to prevent.
 */
export function seededRng(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface DropExpectation {
  spiritStonePerKill: number
  techniqueMasteryPerKill: number
  itemsPerKill: number

  /** Fraction of kills where resolveDrops produced zero equipment items. */
  noEquipmentRate: number
}

/**
 * Runs resolveDrops SAMPLE_SIZE times against the given realm/family
 * combination and modifier set, using a fixed seed so results are
 * repeatable across runs and across whoever calls this.
 *
 * familyId may be undefined: the Foundation Establishment tier's 20 enemies
 * carry no `family` field at all, so that tier draws from its stage table
 * alone. familyDropTableFor(undefined) already returns undefined, which
 * resolveDrops treats as "no family layer" - no special-casing needed here.
 */
export function sampleDropExpectation(
  realmId: string,
  familyId: string | undefined,
  modifiers: DropModifier[],
  sampleSize: number = DEFAULT_SAMPLE_SIZE,
): DropExpectation {
  const rng = seededRng(0x5eed)
  const stageTable = stageDropTableFor(realmId, 1)
  const familyTable = familyDropTableFor(familyId)

  let spiritStone = 0
  let techniqueMastery = 0
  let items = 0
  let killsWithoutEquipment = 0

  for (let index = 0; index < sampleSize; index++) {
    const result = resolveDrops({ modifiers, channel: 'active', stageTable, familyTable, rng })

    spiritStone += result.spiritStone
    techniqueMastery += result.techniqueMastery
    items += result.items.length

    const gotEquipment = result.items.some(
      (item) => item.kind === 'equipment' || item.kind === 'equipment_any',
    )

    if (!gotEquipment) {
      killsWithoutEquipment++
    }
  }

  return {
    spiritStonePerKill: spiritStone / sampleSize,
    techniqueMasteryPerKill: techniqueMastery / sampleSize,
    itemsPerKill: items / sampleSize,
    noEquipmentRate: killsWithoutEquipment / sampleSize,
  }
}
