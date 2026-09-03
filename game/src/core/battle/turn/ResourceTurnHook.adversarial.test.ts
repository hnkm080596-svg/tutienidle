import { describe, expect, it } from 'vitest'
import { applyTurnStartDeltas } from './ResourceTurnHook'

// QA adversarial probe (2026-09-04 quick review) — attack operator: value
// mutation (NaN/Infinity truyền qua amount). Invariant boundedness: stat
// phải giữ giá trị hữu hạn sau khi áp delta, hoặc bị clamp về min/max.
describe('ResourceTurnHook adversarial: non-finite delta', () => {
  it('amount=NaN không tạo ra stat NaN', () => {
    const result = applyTurnStartDeltas({ kimThe: 5 }, [{ stat: 'kimThe', amount: NaN, min: 0 }])
    expect(Number.isFinite(result.kimThe)).toBe(true)
  })

  it('amount=Infinity (delta không hợp lệ) bị bỏ qua, stat giữ nguyên', () => {
    const result = applyTurnStartDeltas({ kimThe: 5 }, [
      { stat: 'kimThe', amount: Infinity, min: 0, max: 99 },
    ])
    expect(result.kimThe).toBe(5)
  })
})
