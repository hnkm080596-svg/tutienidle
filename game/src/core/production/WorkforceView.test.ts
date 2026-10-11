import { describe, expect, it } from 'vitest'
import { buildWorkforceView } from './WorkforceView'
import type { ProductionSiteState } from './ProductionTypes'

function state(siteId: string, overrides: Partial<ProductionSiteState> = {}): ProductionSiteState {
  return {
    siteId,
    level: 1,
    autoRestart: true,
    activeWorkerSlots: 0,
    workerCycles: [],
    ...overrides,
  }
}

describe('buildWorkforceView (Mission D / spec D1)', () => {
  // DIRECT DECOMPOSE REWORK (2026-10-11): no claimant reserves workers
  // ahead of production - reserved is always 0, available = total.
  it('total/reserved/available come from the one pool rule', () => {
    const view = buildWorkforceView(7, [])
    expect(view.total).toBe(7)
    expect(view.reserved).toBe(0)
    expect(view.available).toBe(7)
  })

  it('requested (player intent) and effective (allocator grant) stay distinct; idle is the domain remainder', () => {
    const view = buildWorkforceView(7, [
      state('thanh_van_lam', { assignedWorkers: 4, activeWorkerSlots: 3 }),
      state('thanh_van_quang', { activeWorkerSlots: 2 }),
    ])
    // Requested 4 but the allocator only granted 3 - the UI must not
    // conflate the two (slider shows requested, workers line shows effective).
    expect(view.requested).toEqual({ thanh_van_lam: 4 })
    expect(view.effective).toEqual({ thanh_van_lam: 3, thanh_van_quang: 2 })
    expect(view.idle).toBe(2) // 7 available - 5 granted
  })

  it('no states -> everything idle; non-finite totals floor to 0', () => {
    expect(buildWorkforceView(Number.NaN, [])).toEqual({
      total: 0, reserved: 0, available: 0, requested: {}, effective: {}, idle: 0,
    })
    const view = buildWorkforceView(5, [state('thanh_van_lam')])
    expect(view.idle).toBe(5)
  })
})
