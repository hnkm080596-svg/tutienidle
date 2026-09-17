import { describe, expect, it, vi } from 'vitest'
import { createDeadEnemy, createLootTestSetup } from './battleLootTestSetup'

describe('BattleLootSystem kill-hook identity (Mission E Task 1 / audit T3-16)', () => {
  it('quest kill hook receives the enemy TEMPLATE id, not the instance id', () => {
    const { loot, deps } = createLootTestSetup()
    loot.processDefeatedEnemies(
      [createDeadEnemy('wild_wolf_abc-123', { templateId: 'wild_wolf' })],
      null,
    )
    const calls = vi.mocked(deps.questSystem.onEnemyDefeated).mock.calls
    expect(calls[0]?.[2]).toBe('wild_wolf')
  })

  it('hidden-beast reset hook receives the template id', () => {
    const { loot, deps } = createLootTestSetup()
    loot.processDefeatedEnemies(
      [createDeadEnemy('huyet_mong_abc-123', { templateId: 'huyet_mong' })],
      null,
    )
    expect(vi.mocked(deps.hiddenBeast.onEnemyDefeated).mock.calls[0]?.[1]).toBe('huyet_mong')
  })

  it('entities without templateId fall back to their id (raw template records)', () => {
    const { loot, deps } = createLootTestSetup()
    loot.processDefeatedEnemies([createDeadEnemy('mob', {})], null)
    const calls = vi.mocked(deps.questSystem.onEnemyDefeated).mock.calls
    expect(calls[0]?.[2]).toBe('mob')
  })
})
