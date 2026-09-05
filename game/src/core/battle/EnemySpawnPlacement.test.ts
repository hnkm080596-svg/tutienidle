// Resolver vị trí spawn quái (Combat Art Pipeline spec §6/§7, 2026-09-05) —
// quái giới hạn trong ENEMY_SIDE_REGION, Boss LUÔN ở trung tâm vùng địch.
import { describe, expect, it } from 'vitest'
import { resolveEnemySpawnPosition } from './EnemySpawnPlacement'
import { ENEMY_SIDE_REGION } from './BattlefieldRegions'

function fixedRandom(value: number): () => number {
  return () => value
}

describe('resolveEnemySpawnPosition', () => {
  it('regular enemy: row and column both randomized within ENEMY_SIDE_REGION', () => {
    const position = resolveEnemySpawnPosition({ isBoss: false, random: fixedRandom(0) })

    expect(position.row).toBe(ENEMY_SIDE_REGION.rowMin)
    expect(position.column).toBe(ENEMY_SIDE_REGION.columnMin)
  })

  it('regular enemy: random(0.999...) rolls the top of the region range', () => {
    const position = resolveEnemySpawnPosition({ isBoss: false, random: fixedRandom(0.9999) })

    expect(position.row).toBe(ENEMY_SIDE_REGION.rowMax)
    expect(position.column).toBe(ENEMY_SIDE_REGION.columnMax)
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
})
