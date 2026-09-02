import { describe, expect, it } from 'vitest'
import {
  ITEM_QUALITY_AFFIX_TIER,
  ITEM_QUALITY_DROP_WEIGHT,
  ITEM_QUALITY_ESSENCE_RANGE,
  ITEM_QUALITY_FORGE_USES,
  ITEM_QUALITY_IMPLICIT_MULTIPLIER,
  ITEM_QUALITY_SUBSTATS_RANGE,
  ITEM_QUALITY_UNLOCKED_POOLS,
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
})
