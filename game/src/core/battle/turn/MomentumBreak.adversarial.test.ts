import { describe, expect, it } from 'vitest'
import { onHitLanded, type MomentumState } from './MomentumBreak'

// QA adversarial probe (2026-09-04 quick review) — attack operator: value
// mutation (gain âm). Invariant: momentum stack không âm (decay đã clamp
// ở 0, gain cũng phải giữ stack trong miền hợp lệ).
describe('MomentumBreak adversarial: negative gain', () => {
  it('gain âm không được đẩy stack xuống dưới 0', () => {
    const state: MomentumState = { stack: 10, breakTurnsRemaining: 0 }
    expect(onHitLanded(state, -50).stack).toBeGreaterThanOrEqual(0)
  })
})
