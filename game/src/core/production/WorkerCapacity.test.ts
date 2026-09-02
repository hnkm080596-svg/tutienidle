import { describe, expect, it } from 'vitest'
import { getWorkerCapacityForLevel } from './WorkerCapacity'

describe('getWorkerCapacityForLevel — công thức 1 + level×2 (user chốt)', () => {
  it('chưa xây (0/negative/NaN/Infinity) → 0', () => {
    expect(getWorkerCapacityForLevel(0)).toBe(0)
    expect(getWorkerCapacityForLevel(-1)).toBe(0)
    expect(getWorkerCapacityForLevel(Number.NaN)).toBe(0)
    expect(getWorkerCapacityForLevel(Number.POSITIVE_INFINITY)).toBe(0)
  })

  it('cấp 1 → 3; cấp 9 → 19; tuyến tính', () => {
    expect(getWorkerCapacityForLevel(1)).toBe(3)
    expect(getWorkerCapacityForLevel(9)).toBe(19)
    expect(getWorkerCapacityForLevel(5)).toBe(11)
  })
})
