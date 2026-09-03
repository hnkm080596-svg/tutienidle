import { describe, expect, it } from 'vitest'
import { isTurnTriggerReady, type TurnTriggerCondition } from './BossTurnTriggers'

describe('isTurnTriggerReady', () => {
  it('false trước khi đủ số lượt', () => {
    const condition: TurnTriggerCondition = { afterTurns: 5 }
    expect(isTurnTriggerReady(condition, 4)).toBe(false)
  })

  it('true đúng lúc đạt mốc và sau đó', () => {
    const condition: TurnTriggerCondition = { afterTurns: 5 }
    expect(isTurnTriggerReady(condition, 5)).toBe(true)
    expect(isTurnTriggerReady(condition, 10)).toBe(true)
  })

  it('afterTurns=0 luôn sẵn sàng ngay từ lượt đầu', () => {
    expect(isTurnTriggerReady({ afterTurns: 0 }, 0)).toBe(true)
  })
})
