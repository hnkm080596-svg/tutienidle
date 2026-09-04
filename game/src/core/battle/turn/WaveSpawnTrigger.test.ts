import { describe, expect, it } from 'vitest'
import { shouldSpawnNextEnemy, isStageComplete } from './WaveSpawnTrigger'

describe('shouldSpawnNextEnemy', () => {
  it('true khi sân trống và stage còn enemy chưa spawn', () => {
    expect(shouldSpawnNextEnemy(2, 5, 0)).toBe(true)
  })

  it('false khi vẫn còn enemy sống trong sân', () => {
    expect(shouldSpawnNextEnemy(2, 5, 1)).toBe(false)
  })

  it('false khi stage đã spawn hết, kể cả sân trống', () => {
    expect(shouldSpawnNextEnemy(5, 5, 0)).toBe(false)
  })

  it('false khi spawnedCount vượt totalEnemyCount (defensive)', () => {
    expect(shouldSpawnNextEnemy(6, 5, 0)).toBe(false)
  })
})

describe('isStageComplete', () => {
  it('true khi mọi enemy đã spawn và sân trống', () => {
    expect(isStageComplete(5, 5, 0)).toBe(true)
  })

  it('false khi vẫn còn enemy sống, dù đã spawn hết', () => {
    expect(isStageComplete(5, 5, 1)).toBe(false)
  })

  it('false khi còn enemy chưa spawn, dù sân trống', () => {
    expect(isStageComplete(2, 5, 0)).toBe(false)
  })
})
