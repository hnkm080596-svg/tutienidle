// Enemy spawn position resolver tests (standing-slot model, 2026-09-07) --
// regular enemies land on one of the 9 standing slots; the boss always
// takes the region center (== the middle standing slot).
import { describe, expect, it } from 'vitest'
import { resolveEnemySpawnPosition } from './EnemySpawnPlacement'
import { ENEMY_SIDE_REGION, standingSlotPosition, STANDING_SLOT_COUNT } from './BattlefieldRegions'

function fixedRandom(value: number): () => number {
  return () => value
}

describe('resolveEnemySpawnPosition', () => {
  it('random placement always lands on one of the 9 standing slots', () => {
    const validPositions: { row: number; column: number }[] = []

    for (let r = 0; r < STANDING_SLOT_COUNT; r++) {
      for (let c = 0; c < STANDING_SLOT_COUNT; c++) {
        validPositions.push(standingSlotPosition(ENEMY_SIDE_REGION, r, c))
      }
    }

    for (let i = 0; i < 50; i++) {
      const position = resolveEnemySpawnPosition({ isBoss: false, random: Math.random })

      expect(validPositions).toContainEqual(position)
    }
  })

  it('regular enemy: fixedRandom(0) rolls the first standing slot (region origin)', () => {
    const position = resolveEnemySpawnPosition({ isBoss: false, random: fixedRandom(0) })

    expect(position).toEqual(standingSlotPosition(ENEMY_SIDE_REGION, 0, 0))
  })

  it('regular enemy: fixedRandom(0.999...) rolls the last standing slot', () => {
    const position = resolveEnemySpawnPosition({ isBoss: false, random: fixedRandom(0.9999) })

    expect(position).toEqual(standingSlotPosition(ENEMY_SIDE_REGION, STANDING_SLOT_COUNT - 1, STANDING_SLOT_COUNT - 1))
  })

  it('boss: always forced to the exact center of ENEMY_SIDE_REGION, ignores random()', () => {
    const position = resolveEnemySpawnPosition({ isBoss: true, random: fixedRandom(0) })

    expect(position).toEqual({ row: 5, column: 9 })

    const positionAgain = resolveEnemySpawnPosition({ isBoss: true, random: fixedRandom(0.9999) })

    expect(positionAgain).toEqual({ row: 5, column: 9 })
  })

  it('never returns a cell in the neutral divider or player side', () => {
    for (const sample of [0, 0.25, 0.5, 0.75, 0.999]) {
      const position = resolveEnemySpawnPosition({ isBoss: false, random: fixedRandom(sample) })

      expect(position.column).toBeGreaterThanOrEqual(ENEMY_SIDE_REGION.columnMin)
      expect(position.column).toBeLessThanOrEqual(ENEMY_SIDE_REGION.columnMax)
    }
  })

  it('assigns distinct slots to every enemy spawned in the same wave when the wave fits within the slot pool', () => {
    const occupied = new Set<string>()
    const positions = new Set<string>()

    for (let i = 0; i < STANDING_SLOT_COUNT * STANDING_SLOT_COUNT; i++) {
      const position = resolveEnemySpawnPosition({ isBoss: false, random: Math.random }, ENEMY_SIDE_REGION, occupied)

      positions.add(`${position.row}-${position.column}`)
    }

    expect(positions.size).toBe(STANDING_SLOT_COUNT * STANDING_SLOT_COUNT)
  })

  it('falls back to uniform-random-among-all-9 (never null/throw) once the wave exceeds the slot pool', () => {
    const occupied = new Set<string>()

    for (let i = 0; i < STANDING_SLOT_COUNT * STANDING_SLOT_COUNT; i++) {
      resolveEnemySpawnPosition({ isBoss: false, random: Math.random }, ENEMY_SIDE_REGION, occupied)
    }

    // every slot is now occupied — the resolver must still return a valid position
    for (let i = 0; i < 5; i++) {
      const position = resolveEnemySpawnPosition({ isBoss: false, random: Math.random }, ENEMY_SIDE_REGION, occupied)

      expect(position.column).toBeGreaterThanOrEqual(ENEMY_SIDE_REGION.columnMin)
      expect(position.column).toBeLessThanOrEqual(ENEMY_SIDE_REGION.columnMax)
    }
  })

  it('boss branch is unaffected by occupiedSlots', () => {
    const occupied = new Set<string>(['0-0'])
    const position = resolveEnemySpawnPosition({ isBoss: true, random: fixedRandom(0) }, ENEMY_SIDE_REGION, occupied)

    expect(position).toEqual({ row: 5, column: 9 })
  })
})
