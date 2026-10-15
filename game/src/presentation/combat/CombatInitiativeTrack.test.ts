import { describe, expect, it } from 'vitest'
import { advanceInitiativeCycle, advanceInitiativeDisplay, initiativeGroups } from './CombatInitiativeTrack'
it('finishes the visible trip to 100 before resetting after authoritative gauge consumption', () => {
  let state = advanceInitiativeCycle(undefined, 100, 100)
  expect(state.percent).toBe(10)
  state = advanceInitiativeCycle(state, 0, 100)
  expect(state.percent).toBe(20)
  expect(state.finishing).toBe(true)
  for (let step = 0; step < 8; step++) state = advanceInitiativeCycle(state, 0, 100)
  expect(state.percent).toBe(100)
  state = advanceInitiativeCycle(state, 0, 16)
  expect(state.percent).toBe(0)
  expect(state.finishing).toBe(false)
})
it('travels linearly at a fixed rate without snapping to a newly calculated destination', () => {
  expect(advanceInitiativeDisplay(0, 100, 100)).toBe(10)
  expect(advanceInitiativeDisplay(10, 100, 100)).toBe(20)
  expect(advanceInitiativeDisplay(20, 35, 200)).toBe(35)
  expect(advanceInitiativeDisplay(90, 0, 100)).toBe(80)
  expect(advanceInitiativeDisplay(10, 100, 0)).toBe(10)
})
it('uses live gauge positions, keeps every living identity and groups overlapping markers', () => {
  const actors = [
    { id: 'fast', speed: 200, actionGauge: 500, alive: true },
    { id: 'slow', speed: 50, actionGauge: 900, alive: true },
    { id: 'peer', speed: 100, actionGauge: 500, alive: true },
    { id: 'dead', speed: 500, actionGauge: 1000, alive: false },
  ]
  expect(initiativeGroups(actors).map(g => [g.percent, g.actors.map(a => a.id)])).toEqual([[50, ['fast', 'peer']], [90, ['slow']]])
  expect(actors[0]?.actionGauge).toBe(500)
})
describe('initiative bounds', () => {
  it.each([-400, 1200, Number.NaN])('keeps gauge %s inside the visible track without changing the original value', gauge => {
    const actor = { id: 'p', speed: 100, actionGauge: gauge, alive: true }
    expect(initiativeGroups([actor])[0]?.percent).toBe(gauge === 1200 ? 100 : 0)
    expect(actor.actionGauge).toBe(gauge)
  })
})
