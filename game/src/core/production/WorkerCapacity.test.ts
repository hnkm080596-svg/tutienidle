import { describe, expect, it } from 'vitest'
import { getWorkerCapacityForLevel, resolveProductionWorkerCapacity } from './WorkerCapacity'

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

describe('resolveProductionWorkerCapacity - ONE split rule (Mission D / spec D5)', () => {
  it('decompose claims its workers first; production gets the remainder', () => {
    expect(resolveProductionWorkerCapacity(7, 2)).toBe(5)
    expect(resolveProductionWorkerCapacity(3, 3)).toBe(0)
    expect(resolveProductionWorkerCapacity(0, 0)).toBe(0)
  })

  it('never negative: a stale decompose reservation above the pool yields 0, not debt', () => {
    expect(resolveProductionWorkerCapacity(3, 10)).toBe(0)
    expect(resolveProductionWorkerCapacity(0, 4)).toBe(0)
  })

  it('non-finite / fractional inputs floor defensively', () => {
    expect(resolveProductionWorkerCapacity(Number.NaN, 2)).toBe(0)
    expect(resolveProductionWorkerCapacity(5.9, 1.9)).toBe(4)
    expect(resolveProductionWorkerCapacity(5, Number.NaN)).toBe(5)
  })
})
