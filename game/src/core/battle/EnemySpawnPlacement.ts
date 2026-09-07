// EnemySpawnPlacement — pure enemy spawn position resolver, resolved
// inside ENEMY_SIDE_REGION (Combat Art Pipeline spec §6/§7, 2026-09-05).
// Boss ALWAYS takes the region center. Regular enemies land on one of
// the 9 standing slots (standing-slot model, 2026-09-07) — multiple
// enemies MAY share a cell; the resolver accepts no occupied/reserved
// cells and NEVER returns null.
import type { GridPosition } from './BattleGrid'
import {
  ENEMY_SIDE_REGION,
  centerOfRegion,
  standingSlotPosition,
  STANDING_SLOT_COUNT,
  type BattlefieldUsableRegion,
} from './BattlefieldRegions'

export interface EnemySpawnPlacementInput {
  isBoss: boolean

  /** External RNG (Math.random or seeded) — keeps tests deterministic. */
  random: () => number
}

/** Integer in [min, max] using EXACTLY ONE random() call. */
function randomIntInclusive(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1))
}

export function resolveEnemySpawnPosition(
  input: EnemySpawnPlacementInput,
  region: BattlefieldUsableRegion = ENEMY_SIDE_REGION,
): GridPosition {
  if (input.isBoss) {
    return centerOfRegion(region)
  }

  const slotRow = randomIntInclusive(input.random, 0, STANDING_SLOT_COUNT - 1)
  const slotColumn = randomIntInclusive(input.random, 0, STANDING_SLOT_COUNT - 1)

  return standingSlotPosition(region, slotRow, slotColumn)
}
