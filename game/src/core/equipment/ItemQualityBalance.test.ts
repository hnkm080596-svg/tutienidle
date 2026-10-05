import { describe, expect, it } from 'vitest'
import {
  AFFIX_TIER_ROLL_WEIGHT,
  ITEM_QUALITY_AFFIX_TIER,
  ITEM_QUALITY_DROP_WEIGHT,
  ITEM_QUALITY_ESSENCE_RANGE,
  ITEM_QUALITY_FLOOR_CEILING,
  ITEM_QUALITY_FORGE_USES,
  ITEM_QUALITY_IMPLICIT_MULTIPLIER,
  ITEM_QUALITY_SUBSTATS_RANGE,
  ITEM_QUALITY_UNLOCKED_POOLS,
  itemQualityCeilingForFloor,
} from './ItemQualityBalance'
import { ITEM_QUALITY_ORDER } from '../item/ItemQuality'

describe('ItemQuality balance tables', () => {
  it('keeps drop weights normalized to 100', () => {
    const sum = ITEM_QUALITY_ORDER.reduce((total, quality) => total + ITEM_QUALITY_DROP_WEIGHT[quality], 0)
    expect(Math.abs(sum - 100)).toBeLessThan(1e-9)
  })

  it('uses the specified forge-use progression', () => {
    expect(ITEM_QUALITY_ORDER.map((quality) => ITEM_QUALITY_FORGE_USES[quality])).toEqual([5, 10, 20, 40, 80])
  })

  it('raises affix tier from one through five', () => {
    expect(ITEM_QUALITY_ORDER.map((quality) => ITEM_QUALITY_AFFIX_TIER[quality])).toEqual([1, 2, 3, 4, 5])
  })

  it('starts substat ranges at zero and raises their maxima', () => {
    const ranges = ITEM_QUALITY_ORDER.map((quality) => ITEM_QUALITY_SUBSTATS_RANGE[quality])
    expect(ranges.map(({ min }) => min)).toEqual([0, 0, 0, 0, 0])
    expect(ranges.map(({ max }) => max)).toEqual([1, 2, 3, 4, 5])
  })

  it('raises implicit multipliers from one', () => {
    expect(ITEM_QUALITY_ORDER.map((quality) => ITEM_QUALITY_IMPLICIT_MULTIPLIER[quality])).toEqual([
      1, 1.15, 1.3, 1.5, 1.75,
    ])
  })

  it('only adds affix pools as quality increases', () => {
    const pools = ITEM_QUALITY_ORDER.map((quality) => ITEM_QUALITY_UNLOCKED_POOLS[quality])
    expect(pools).toEqual([
      ['basic'],
      ['basic', 'advanced'],
      ['basic', 'advanced', 'specialized'],
      ['basic', 'advanced', 'specialized', 'supreme'],
      ['basic', 'advanced', 'specialized', 'supreme'],
    ])
    for (let index = 1; index < pools.length; index += 1) {
      const previousPools = pools[index - 1]
      if (!previousPools) throw new Error(`Missing pool table entry at index ${index - 1}`)
      expect(pools[index]).toEqual(expect.arrayContaining(previousPools))
    }
  })

  it('raises essence ranges while keeping each range non-empty', () => {
    const ranges = ITEM_QUALITY_ORDER.map((quality) => ITEM_QUALITY_ESSENCE_RANGE[quality])
    expect(ranges.every(({ min, max }) => min < max)).toBe(true)
    expect(ranges.map(({ min }) => min)).toEqual([1, 2, 3, 4, 5])
    expect(ranges.map(({ max }) => max)).toEqual([3, 4, 5, 6, 7])
  })

  // Gear-pace retune (2026-10-05) - the floor ceiling IS the wall
  // expression: floors 1-3 may only roll huyen-or-below, 4-6 dia, 7-9
  // thien, and floor 10 opens the full ladder (tien). Bands are chapter
  // floors (1-10); a floor outside every authored band falls through to
  // the last band's ceiling.
  it('gates rolled quality by stage floor band', () => {
    expect(
      ITEM_QUALITY_FLOOR_CEILING.map((band) => [band.maxFloor, band.ceiling]),
    ).toEqual([
      [3, 'huyen'],
      [6, 'dia'],
      [9, 'thien'],
      [Number.POSITIVE_INFINITY, 'tien'],
    ])

    expect(itemQualityCeilingForFloor(undefined)).toBeUndefined()
    expect(itemQualityCeilingForFloor(1)).toBe('huyen')
    expect(itemQualityCeilingForFloor(3)).toBe('huyen')
    expect(itemQualityCeilingForFloor(4)).toBe('dia')
    expect(itemQualityCeilingForFloor(6)).toBe('dia')
    expect(itemQualityCeilingForFloor(7)).toBe('thien')
    expect(itemQualityCeilingForFloor(9)).toBe('thien')
    expect(itemQualityCeilingForFloor(10)).toBe('tien')
    expect(itemQualityCeilingForFloor(99)).toBe('tien')
  })

  // Affix tiers roll weighted toward the low end so hunting better-tiered
  // affixes keeps demanding drops inside a band. Strictly decreasing,
  // normalized weights per tier index.
  it('weights affix tier rolls toward low tiers', () => {
    expect(AFFIX_TIER_ROLL_WEIGHT).toEqual({ 1: 10, 2: 6, 3: 3, 4: 2, 5: 1 })
    const weights = [1, 2, 3, 4, 5].map((tier) => AFFIX_TIER_ROLL_WEIGHT[tier]!)
    for (let index = 1; index < weights.length; index += 1) {
      expect(weights[index]!).toBeLessThan(weights[index - 1]!)
    }
  })
})
