import { describe, expect, it } from 'vitest'
import { applyTurnStartDeltas, type TurnResourceDelta } from './ResourceTurnHook'

describe('applyTurnStartDeltas', () => {
  it('cộng amount vào stat hiện có', () => {
    const result = applyTurnStartDeltas({ hoaThe: 2 }, [{ stat: 'hoaThe', amount: 1 }])
    expect(result.hoaThe).toBe(3)
  })

  it('stat chưa tồn tại coi như bắt đầu từ 0', () => {
    const result = applyTurnStartDeltas({}, [{ stat: 'kiemThe', amount: 5 }])
    expect(result.kiemThe).toBe(5)
  })

  it('amount âm dùng để decay (vd Kim Thế discrete decay)', () => {
    const result = applyTurnStartDeltas({ kimThe: 10 }, [{ stat: 'kimThe', amount: -3 }])
    expect(result.kimThe).toBe(7)
  })

  it('clamp theo min/max nếu có khai báo', () => {
    const result = applyTurnStartDeltas({ kimThe: 1 }, [
      { stat: 'kimThe', amount: -10, min: 0 },
    ])
    expect(result.kimThe).toBe(0)
  })

  it('không mutate object đầu vào (trả về object mới)', () => {
    const current = { hoaThe: 2 }
    const result = applyTurnStartDeltas(current, [{ stat: 'hoaThe', amount: 1 }])
    expect(current.hoaThe).toBe(2)
    expect(result).not.toBe(current)
  })

  it('nhiều delta độc lập trong cùng 1 lượt', () => {
    const result = applyTurnStartDeltas({ hoaThe: 0, kimThe: 5 }, [
      { stat: 'hoaThe', amount: 2 },
      { stat: 'kimThe', amount: -1 },
    ])
    expect(result).toEqual({ hoaThe: 2, kimThe: 4 })
  })
})
