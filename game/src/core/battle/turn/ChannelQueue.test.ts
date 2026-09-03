import { describe, expect, it } from 'vitest'
import { beginCharge, isCharging, tickChargesOnTurnResolved } from './ChannelQueue'

describe('ChannelQueue', () => {
  it('beginCharge: chargeSteps < 1 vẫn chốt tối thiểu 1 lượt', () => {
    expect(beginCharge('boss', 0).remainingTurns).toBe(1)
    expect(beginCharge('boss', 3).remainingTurns).toBe(3)
  })

  it('isCharging: true khi actorId có mặt trong danh sách charges', () => {
    const charges = [beginCharge('boss', 2)]
    expect(isCharging(charges, 'boss')).toBe(true)
    expect(isCharging(charges, 'player')).toBe(false)
  })

  it('tickChargesOnTurnResolved: giảm dần, chưa hết thì còn trong remaining', () => {
    const charges = [beginCharge('boss', 2)]
    const first = tickChargesOnTurnResolved(charges)
    expect(first.resolved).toEqual([])
    expect(first.remaining).toEqual([{ actorId: 'boss', remainingTurns: 1 }])
  })

  it('tickChargesOnTurnResolved: về 0 thì actorId chuyển sang resolved', () => {
    const charges = [{ actorId: 'boss', remainingTurns: 1 }]
    const result = tickChargesOnTurnResolved(charges)
    expect(result.resolved).toEqual(['boss'])
    expect(result.remaining).toEqual([])
  })

  it('tickChargesOnTurnResolved: nhiều charge độc lập nhau', () => {
    const charges = [
      { actorId: 'boss', remainingTurns: 1 },
      { actorId: 'kiem_tu', remainingTurns: 3 },
    ]
    const result = tickChargesOnTurnResolved(charges)
    expect(result.resolved).toEqual(['boss'])
    expect(result.remaining).toEqual([{ actorId: 'kiem_tu', remainingTurns: 2 }])
  })
})
