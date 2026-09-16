// ProductionCycles.test.ts — unit coverage for the cycle factory leaf.
// The factory is exercised indirectly through ProductionSystem.startCycle
// and WorkerLaneAdvance spawned successors; this file locks the factory
// contract itself: verbatim snapshot fields, deadline math (speed-table
// clamping at boundary levels), cycleId uniqueness/format, rollSeed bounds,
// and the rewardTableVersion stamp.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildProductionCycle, REWARD_TABLE_VERSION } from './ProductionCycles'
import { computeCycleSeconds } from './ProductionBalance'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('buildProductionCycle — snapshot fields', () => {
  it('passes siteId, collectionRealmId, siteLevelAtStart and nowMs through verbatim', () => {
    const nowMs = 1_234_567

    const cycle = buildProductionCycle('thanh_van_lam', 'qi_refining', 3, 300, nowMs)

    expect(cycle.siteId).toBe('thanh_van_lam')
    expect(cycle.collectionRealmId).toBe('qi_refining')
    expect(cycle.siteLevelAtStart).toBe(3)
    expect(cycle.startedAtMs).toBe(nowMs)
  })

  it('stamps the exported REWARD_TABLE_VERSION on every cycle', () => {
    expect(Number.isInteger(REWARD_TABLE_VERSION)).toBe(true)
    expect(REWARD_TABLE_VERSION).toBeGreaterThan(0)

    const cycle = buildProductionCycle('site_a', 'mortal', 1, 100, 0)

    expect(cycle.rewardTableVersion).toBe(REWARD_TABLE_VERSION)
  })
})

describe('buildProductionCycle — deadline math', () => {
  it('completesAtMs = startedAtMs + computeCycleSeconds(base, level) * 1000', () => {
    const nowMs = 42_000

    for (const [baseSeconds, level] of [
      [100, 1],
      [300, 2],
      [900, 9],
    ] as const) {
      const cycle = buildProductionCycle('site', 'realm', level, baseSeconds, nowMs)

      expect(cycle.completesAtMs).toBe(nowMs + computeCycleSeconds(baseSeconds, level) * 1000)
    }
  })

  it('boundary levels clamp through the speed table: <=0/NaN run at x1, >max/Infinity at x4.6', () => {
    const baseSeconds = 100

    // getSiteSpeedMultiplier clamps level into [1, 9]; the factory must
    // propagate out-of-range snapshot levels through that same rule.
    for (const level of [0, -3, Number.NaN]) {
      const cycle = buildProductionCycle('site', 'realm', level, baseSeconds, 0)

      expect(cycle.completesAtMs - cycle.startedAtMs).toBe(baseSeconds * 1000)
    }

    // ceil(100 / 4.6) = 22s for every level beyond the table.
    for (const level of [10, 99, Number.POSITIVE_INFINITY]) {
      const cycle = buildProductionCycle('site', 'realm', level, baseSeconds, 0)

      expect(cycle.completesAtMs - cycle.startedAtMs).toBe(22 * 1000)
    }
  })

  it('fractional durations ceil up to whole seconds; zero base collapses to an instant cycle', () => {
    const fractional = buildProductionCycle('site', 'realm', 1, 100.4, 1_000)

    expect(fractional.completesAtMs).toBe(1_000 + 101 * 1000)

    const instant = buildProductionCycle('site', 'realm', 1, 0, 5_000)

    expect(instant.completesAtMs).toBe(instant.startedAtMs)
  })
})

describe('buildProductionCycle — cycleId', () => {
  it('embeds siteId and the base-36 start clock', () => {
    const frozenMs = 1_700_000_000_000

    vi.spyOn(Date, 'now').mockReturnValue(frozenMs)

    const cycle = buildProductionCycle('thanh_van_quang', 'mortal', 1, 100, 0)

    expect(cycle.cycleId.startsWith(`cycle_thanh_van_quang_${frozenMs.toString(36)}_`)).toBe(true)
  })

  it('stays unique across identical calls under a frozen clock (monotonic counter)', () => {
    vi.spyOn(Date, 'now').mockReturnValue(123)

    const first = buildProductionCycle('site', 'realm', 1, 100, 0)
    const second = buildProductionCycle('site', 'realm', 1, 100, 0)

    expect(first.cycleId).not.toBe(second.cycleId)

    const counterOf = (cycleId: string): number => Number(cycleId.slice(cycleId.lastIndexOf('_') + 1))

    expect(counterOf(second.cycleId)).toBe(counterOf(first.cycleId) + 1)
  })

  it('differs across sites even for identical inputs', () => {
    const lam = buildProductionCycle('thanh_van_lam', 'mortal', 1, 100, 0)
    const quang = buildProductionCycle('thanh_van_quang', 'mortal', 1, 100, 0)

    expect(lam.cycleId).not.toBe(quang.cycleId)
    expect(lam.cycleId).toContain('thanh_van_lam')
    expect(quang.cycleId).toContain('thanh_van_quang')
  })
})

describe('buildProductionCycle — rollSeed', () => {
  it('is an integer in [0, 0x7fffffff) across samples', () => {
    for (let index = 0; index < 200; index += 1) {
      const seed = buildProductionCycle('site', 'realm', 1, 100, 0).rollSeed

      expect(Number.isInteger(seed)).toBe(true)
      expect(seed).toBeGreaterThanOrEqual(0)
      expect(seed).toBeLessThan(0x7fffffff)
    }
  })

  it('maps Math.random exactly: floor(roll * 0x7fffffff), including boundary rolls', () => {
    const spy = vi.spyOn(Math, 'random')

    spy.mockReturnValue(0)
    expect(buildProductionCycle('site', 'realm', 1, 100, 0).rollSeed).toBe(0)

    spy.mockReturnValue(0.5)
    expect(buildProductionCycle('site', 'realm', 1, 100, 0).rollSeed).toBe(
      Math.floor(0.5 * 0x7fffffff),
    )

    // Largest roll below 1.0 still lands strictly inside the seed space.
    spy.mockReturnValue(0.999999)
    expect(buildProductionCycle('site', 'realm', 1, 100, 0).rollSeed).toBe(
      Math.floor(0.999999 * 0x7fffffff),
    )
  })
})
