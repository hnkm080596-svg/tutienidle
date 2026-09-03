import { describe, expect, it } from 'vitest'
import {
  onHitLanded,
  onTurnStartWithoutHit,
  checkBreakThreshold,
  tickBreakOnTurnStart,
  isBroken,
  type MomentumState,
} from './MomentumBreak'

describe('MomentumBreak', () => {
  it('onHitLanded: stack cộng dồn theo gain', () => {
    const state: MomentumState = { stack: 10, breakTurnsRemaining: 0 }
    expect(onHitLanded(state, 5).stack).toBe(15)
  })

  it('onTurnStartWithoutHit: decay không xuống dưới 0', () => {
    const state: MomentumState = { stack: 3, breakTurnsRemaining: 0 }
    expect(onTurnStartWithoutHit(state, 5).stack).toBe(0)
  })

  it('checkBreakThreshold: vượt ngưỡng thì reset stack và bắt đầu Break N lượt', () => {
    const state: MomentumState = { stack: 100, breakTurnsRemaining: 0 }
    const result = checkBreakThreshold(state, 100, 3)
    expect(result).toEqual({ stack: 0, breakTurnsRemaining: 3 })
  })

  it('checkBreakThreshold: chưa đủ ngưỡng thì giữ nguyên state', () => {
    const state: MomentumState = { stack: 50, breakTurnsRemaining: 0 }
    expect(checkBreakThreshold(state, 100, 3)).toEqual(state)
  })

  it('tickBreakOnTurnStart: đếm lùi breakTurnsRemaining mỗi lượt', () => {
    const state: MomentumState = { stack: 0, breakTurnsRemaining: 2 }
    const afterOne = tickBreakOnTurnStart(state)
    expect(afterOne.breakTurnsRemaining).toBe(1)
    expect(isBroken(afterOne)).toBe(true)
    const afterTwo = tickBreakOnTurnStart(afterOne)
    expect(afterTwo.breakTurnsRemaining).toBe(0)
    expect(isBroken(afterTwo)).toBe(false)
  })

  it('tickBreakOnTurnStart: không xuống âm khi đã hết Break', () => {
    const state: MomentumState = { stack: 0, breakTurnsRemaining: 0 }
    expect(tickBreakOnTurnStart(state).breakTurnsRemaining).toBe(0)
  })
})
