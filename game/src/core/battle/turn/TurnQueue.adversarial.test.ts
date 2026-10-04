import { describe, expect, it } from 'vitest'
import { resolveNextTurn, type TurnQueueActor } from './TurnQueue'

// QA adversarial probe (2026-09-04 quick review) - attack operator: value
// mutation (speed 0/am cho toan bo actor, dung kich ban Break/CC dua speed
// ve 0). Invariant: resolveNextTurn phai terminate co gioi han va tra ve
// null thay vi treo vo han.
describe('TurnQueue adversarial: degenerate speeds', () => {
  it('toàn bộ actor speed=0 vẫn terminate và trả về null', () => {
    const actors: TurnQueueActor[] = [
      { id: 'a', speed: 0, priority: 0, actionGauge: 0, alive: true },
      { id: 'b', speed: 0, priority: 1, actionGauge: 0, alive: true },
    ]
    expect(resolveNextTurn(actors)).toBeNull()
  })

  it('toàn bộ actor speed âm cũng terminate và trả về null', () => {
    const actors: TurnQueueActor[] = [
      { id: 'a', speed: -5, priority: 0, actionGauge: 0, alive: true },
    ]
    expect(resolveNextTurn(actors)).toBeNull()
  })
})
