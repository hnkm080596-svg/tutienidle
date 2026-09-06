import { describe, expect, it } from 'vitest'
import { effectiveTotalEnemyCount } from './EffectiveEnemyCount'
import type { Stage } from './Stage'

function stageFixture(overrides: Partial<Stage> = {}): Stage {
  return {
    id: 'test_stage', name: 'Test', description: '',
    enemyPool: [{ enemyId: 'dummy', weight: 1 }],
    totalEnemyCount: 5, waves: [5],
    spawnIntervalSeconds: 1,
    ...overrides,
  }
}

describe('effectiveTotalEnemyCount', () => {
  it('a floor-10 stage with bossEnemyId is ALWAYS 1, regardless of the raw totalEnemyCount', () => {
    const stage = stageFixture({ floor: 10, bossEnemyId: 'test_boss', totalEnemyCount: 5 })

    expect(effectiveTotalEnemyCount(stage)).toBe(1)
  })

  it('a floor-10 stage WITHOUT bossEnemyId keeps its raw totalEnemyCount (metadata-only bossEnemyId on non-final floors, per pickEnemyForSpawn\'s own floor===10 gate)', () => {
    const stage = stageFixture({ floor: 10, totalEnemyCount: 5 })

    expect(effectiveTotalEnemyCount(stage)).toBe(5)
  })

  it('a non-floor-10 stage WITH bossEnemyId keeps its raw totalEnemyCount (bossEnemyId is reserved/metadata on floors 1-9, per Stage.ts\'s own comment)', () => {
    const stage = stageFixture({ floor: 3, bossEnemyId: 'test_boss', totalEnemyCount: 5 })

    expect(effectiveTotalEnemyCount(stage)).toBe(5)
  })

  it('already-1 stages are unaffected', () => {
    const stage = stageFixture({ floor: 10, bossEnemyId: 'test_boss', totalEnemyCount: 1 })

    expect(effectiveTotalEnemyCount(stage)).toBe(1)
  })
})
