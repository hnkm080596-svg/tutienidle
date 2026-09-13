// EnemySpawnPlacement — pure enemy spawn position resolver, resolved
// inside ENEMY_SIDE_REGION (Combat Art Pipeline spec §6/§7, 2026-09-05).
// Boss ALWAYS takes the region center. Regular enemies land on one of
// the 9 standing slots (standing-slot model, 2026-09-07) — multiple
// enemies MAY share a cell across DIFFERENT waves; the resolver never
// returns null.
//
// Within-wave dedupe (2026-09-07 bugfix): callers spawning several
// enemies in the same wave-batch may pass an `occupiedSlots` set (keyed
// "row-column" by slot index, not grid coordinate) -- the resolver then
// picks uniformly among the remaining free slots and records its pick
// into that same set, so the next call in the batch avoids it. Once the
// wave outgrows the 9-slot pool, it falls back to uniform-random-among-
// all-9 (slots necessarily get reused past that point -- expected).
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

function slotKey(slotRow: number, slotColumn: number): string {
  return `${slotRow}-${slotColumn}`
}

export function resolveEnemySpawnPosition(
  input: EnemySpawnPlacementInput,
  region: BattlefieldUsableRegion = ENEMY_SIDE_REGION,
  occupiedSlots?: Set<string>,
): GridPosition {
  if (input.isBoss) {
    return centerOfRegion(region)
  }

  if (occupiedSlots) {
    const freeKeys: string[] = []

    for (let slotRow = 0; slotRow < STANDING_SLOT_COUNT; slotRow++) {
      for (let slotColumn = 0; slotColumn < STANDING_SLOT_COUNT; slotColumn++) {
        const key = slotKey(slotRow, slotColumn)

        if (!occupiedSlots.has(key)) {
          freeKeys.push(key)
        }
      }
    }

    if (freeKeys.length > 0) {
      const pickIndex = randomIntInclusive(input.random, 0, freeKeys.length - 1)
      const pickedKey = freeKeys[pickIndex]!
      const [slotRow, slotColumn] = pickedKey.split('-').map(Number) as [number, number]

      occupiedSlots.add(pickedKey)

      return standingSlotPosition(region, slotRow, slotColumn)
    }

    // Wave outgrew the 9-slot pool -- fall through to plain random reuse.
  }

  const slotRow = randomIntInclusive(input.random, 0, STANDING_SLOT_COUNT - 1)
  const slotColumn = randomIntInclusive(input.random, 0, STANDING_SLOT_COUNT - 1)

  if (occupiedSlots) {
    occupiedSlots.add(slotKey(slotRow, slotColumn))
  }

  return standingSlotPosition(region, slotRow, slotColumn)
}
