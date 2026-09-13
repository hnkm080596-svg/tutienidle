import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CombatEntity } from '../combat/CombatEntity'
import { createDeadEnemy, createLootTestSetup } from './battleLootTestSetup'

// F3 (2026-09-13): processDefeatedEnemies takes an explicit heal target
// instead of reading `battle.player`. The heal-on-kill effect is retired
// from the v4 talent catalog (huyet_chien resolves to no effects), so the
// percent getter is mocked here to exercise the branch the contract
// still owns:
// - a live healTarget (the real-battle player entity) receives the heal;
// - healTarget = null (the auto-farm idle channel) opts out entirely -
//   no phantom vitals events for a dead enemy standing in as `player`.
const mocks = vi.hoisted(() => ({
  healOnKillPercent: vi.fn(() => 0),
}))

vi.mock('../talent/TalentEffects', async (importOriginal) => {
  const original = await importOriginal<typeof import('../talent/TalentEffects')>()
  return {
    ...original,
    getHealOnKillMaxHpPercent: mocks.healOnKillPercent,
  }
})

const QI_REFINING_STAGE = {
  stageId: 'qr_5',
  requiredRealmId: 'qi_refining',
  floor: 5,
}

function livePlayer(overrides: Partial<CombatEntity> = {}): CombatEntity {
  return {
    id: 'player',
    alive: true,
    currentHp: 500,
    maxHp: 1000,
    ...overrides,
  } as CombatEntity
}

describe('BattleLootSystem - heal-on-kill target contract', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    mocks.healOnKillPercent.mockReturnValue(0)
  })

  it('heals the explicit healTarget when a heal-on-kill effect is active', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99) // keep random drops out
    mocks.healOnKillPercent.mockReturnValue(0.1)
    const { loot, applyHealing } = createLootTestSetup({
      realmId: 'qi_refining',
      stage: QI_REFINING_STAGE,
    })
    const target = livePlayer()

    loot.processDefeatedEnemies([createDeadEnemy('mob')], target)

    // amount = maxHp * percent routed through the vitals owner with the
    // entity's own id as source - same as the old battle.player call.
    expect(applyHealing).toHaveBeenCalledWith(target, 100, 'player', 'healing')
  })

  it('healTarget = null opts out: no applyHealing even with a heal-on-kill effect (auto-farm contract)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    mocks.healOnKillPercent.mockReturnValue(0.1)
    const { loot, applyHealing } = createLootTestSetup({
      realmId: 'qi_refining',
      stage: QI_REFINING_STAGE,
    })

    loot.processDefeatedEnemies([createDeadEnemy('mob')], null)

    expect(applyHealing).not.toHaveBeenCalled()
  })

  it('a drained healTarget (currentHp 0) is not healed', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    mocks.healOnKillPercent.mockReturnValue(0.1)
    const { loot, applyHealing } = createLootTestSetup({
      realmId: 'qi_refining',
      stage: QI_REFINING_STAGE,
    })

    loot.processDefeatedEnemies(
      [createDeadEnemy('mob')],
      livePlayer({ currentHp: 0 }),
    )

    expect(applyHealing).not.toHaveBeenCalled()
  })
})
