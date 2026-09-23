import { describe, expect, it } from 'vitest'
import { createLootTestSetup } from './battleLootTestSetup'

// P7-M3 - technique mastery is a PENDING channel: kills accumulate it,
// settleTechniqueMastery() (victory terminal / auto-farm cycle) flushes
// it through TechniqueSystem.gainMastery exactly once. Repeat cycles
// skip beginBattle() (preserveLootSession), so pending must be
// consumed-and-zeroed on flush or the next cycle re-pays it.
describe('BattleLootSystem technique mastery', () => {
  it('accumulates pending mastery per kill without touching the summary mid-battle', () => {
    const { loot, gainMastery, killEnemy } = createLootTestSetup({
      stage: { stageId: 's1', requiredRealmId: 'mortal' },
    })

    killEnemy()
    killEnemy()

    // Stage currency band is rolled - pending grew, summary untouched,
    // gainMastery not called yet (no flush mid-battle).
    expect(loot.getSummary().techniqueMastery).toBe(0)
    expect(gainMastery).not.toHaveBeenCalled()
  })

  it('settleTechniqueMastery flushes pending through gainMastery and records the gained amount', () => {
    const { loot, gainMastery, killEnemy } = createLootTestSetup({
      stage: { stageId: 's1', requiredRealmId: 'mortal' },
    })

    killEnemy()
    loot.settleTechniqueMastery('player')

    expect(gainMastery).toHaveBeenCalledTimes(1)
    const flushed = gainMastery.mock.calls[0]![0] as number
    expect(flushed).toBeGreaterThan(0)
    expect(loot.getSummary().techniqueMastery).toBe(flushed)

    // M-F-TECHNIQUE - the session player's realm context rides the
    // flush (the realm-scaled ceiling lives inside TechniqueSystem).
    expect(gainMastery).toHaveBeenLastCalledWith(flushed, 'mortal', 1)
  })

  it('consumes pending exactly once — a second settle pays nothing', () => {
    const { loot, gainMastery, killEnemy } = createLootTestSetup({
      stage: { stageId: 's1', requiredRealmId: 'mortal' },
    })

    killEnemy()
    loot.settleTechniqueMastery('player')
    const firstTotal = loot.getSummary().techniqueMastery
    expect(firstTotal).toBeGreaterThan(0)

    loot.settleTechniqueMastery('player')
    expect(gainMastery).toHaveBeenCalledTimes(1)
    expect(loot.getSummary().techniqueMastery).toBe(firstTotal)
  })

  it('beginBattle resets pending — a stale buffer cannot leak into a new session', () => {
    const { loot, gainMastery, killEnemy } = createLootTestSetup({
      stage: { stageId: 's1', requiredRealmId: 'mortal' },
    })

    killEnemy()
    loot.beginBattle()
    loot.settleTechniqueMastery('player')
    expect(gainMastery).not.toHaveBeenCalled()
  })

  it('records only the amount gainMastery actually consumed (rank-cap clipping)', () => {
    const { loot, gainMastery, killEnemy } = createLootTestSetup({
      stage: { stageId: 's1', requiredRealmId: 'mortal' },
    })
    gainMastery.mockReturnValue({ gained: 10, rankUps: 0 })

    killEnemy()
    loot.settleTechniqueMastery('player')
    expect(loot.getSummary().techniqueMastery).toBe(10)
  })

  it('emits one insight particle on a non-zero flush when a source id is given', () => {
    const { loot, eventBus, killEnemy } = createLootTestSetup({
      stage: { stageId: 's1', requiredRealmId: 'mortal' },
    })

    killEnemy()
    loot.settleTechniqueMastery('player')

    const particles = eventBus.emit.mock.calls.filter(
      (call) => call[0] === 'reward_particle' && (call[1] as { kind?: string }).kind === 'insight',
    )
    expect(particles).toHaveLength(1)
  })
})
