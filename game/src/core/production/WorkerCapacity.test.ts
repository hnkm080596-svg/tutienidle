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

describe('resolveProductionWorkerCapacity - ONE pool rule (Mission D / spec D5)', () => {
  // DIRECT DECOMPOSE REWORK (2026-10-11): decompose retired its worker
  // claim - the production pool IS the whole CHQ capacity, no split.
  it('production gets the whole pool', () => {
    expect(resolveProductionWorkerCapacity(7)).toBe(7)
    expect(resolveProductionWorkerCapacity(3)).toBe(3)
    expect(resolveProductionWorkerCapacity(0)).toBe(0)
  })

  it('never negative: a stale pool below zero yields 0, not debt', () => {
    expect(resolveProductionWorkerCapacity(-3)).toBe(0)
    expect(resolveProductionWorkerCapacity(-10.5)).toBe(0)
  })

  it('non-finite / fractional inputs floor defensively', () => {
    expect(resolveProductionWorkerCapacity(Number.NaN)).toBe(0)
    expect(resolveProductionWorkerCapacity(Number.POSITIVE_INFINITY)).toBe(0)
    expect(resolveProductionWorkerCapacity(5.9)).toBe(5)
  })
})
