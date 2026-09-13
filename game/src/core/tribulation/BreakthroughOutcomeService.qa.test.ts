/**
 * QA probe (R8.2 slice 2): the auto-breakthrough tick path (App.vue calls
 * breakthrough() once per tick) through the new facade — repeated successes
 * accumulate levels/points exactly once per call, and the announcement
 * fires only on a major-realm change (which cannot happen through this
 * path — see BreakthroughOutcomeService header).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../stores/player'
import { GameManager } from '../game/GameManager'
import { addCultivation } from '../cultivation/CultivationSystem'

describe('R8.2 slice 2 — auto-breakthrough tick path via facade', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('three consecutive breakthroughs: exactly one level + one attribute point per call', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    const pointsBefore = player.attributePoints

    for (let i = 0; i < 3; i++) {
      addCultivation(player.$state, player.cultivationRequired)
      const result = gameManager.realmAdvanceOps.breakthroughWithConsequences(player)
      expect(result.kind).toBe('success')
    }

    expect(player.realmLevel).toBe(4) // 1 + 3
    expect(player.attributePoints).toBe(pointsBefore + 3)
    // No major-realm change occurred: no announcement fact produced.
    expect(player.realmId).toBe('mortal')
  })

  it('failure after exhausting cultivation does not consume anything', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    const pointsBefore = player.attributePoints
    const levelBefore = player.realmLevel

    const result = gameManager.realmAdvanceOps.breakthroughWithConsequences(player)

    expect(result.kind).toBe('failure')
    expect(player.realmLevel).toBe(levelBefore)
    expect(player.attributePoints).toBe(pointsBefore)
  })
})
