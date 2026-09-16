// Coverage extension for EquipmentDissolve.ts — branches not exercised by
// EquipmentSystem.dissolve.test.ts (commit) or EquipmentDissolve.quote.test.ts
// (quote): empty/not_found/favorite/no_conversion_rule rejections, guard
// priority, reward-roll boundaries for every quality, the discardRefinePreview
// callback contract, per-item commit rewards, and exact quote aggregation.
// Tests the module directly (bare EquipmentBag + injected callback) instead of
// going through EquipmentSystem.
import { describe, expect, it, vi } from 'vitest'
import { dissolveInstances, quoteDissolveRewards } from './EquipmentDissolve'
import { EquipmentBag } from './EquipmentBag'
import { makeInstance } from './EquipmentInstance.fixture'
import { ITEM_QUALITY_ESSENCE_RANGE } from './ItemQualityBalance'
import { LUYEN_KHI_TINH_HOA_ID } from './TinhHoaMaterial'
import { ITEM_QUALITY_ORDER, type ItemQuality } from '../item/ItemQuality'

const makeDiscard = () => vi.fn<(instanceId: string) => void>()

// Simulates a corrupted save payload carrying a foreign quality value; the
// essence table has no entry for it, so both paths must refuse the dissolve.
const corruptedQuality = (): ItemQuality => 'corrupted_save_quality' as unknown as ItemQuality

describe('dissolveInstances — rejection guards', () => {
  it('rejects an empty selection without touching the bag or the preview', () => {
    const bag = new EquipmentBag()
    const discard = makeDiscard()

    const result = dissolveInstances([], bag, discard)

    expect(result).toEqual({ ok: false, reason: 'empty_selection' })
    expect(result.rewards).toBeUndefined()
    expect(discard).not.toHaveBeenCalled()
  })

  it('rejects a missing id with not_found and keeps the rest of the batch', () => {
    const bag = new EquipmentBag()
    bag.add(makeInstance({ instanceId: 'kept' }))
    const discard = makeDiscard()

    const result = dissolveInstances(['kept', 'ghost-id'], bag, discard)

    expect(result).toEqual({ ok: false, reason: 'not_found' })
    // All-or-nothing: the valid item survives and no preview is discarded.
    expect(bag.has('kept')).toBe(true)
    expect(discard).not.toHaveBeenCalled()
  })

  it('rejects a favorite item with favorite', () => {
    const bag = new EquipmentBag()
    bag.add(makeInstance({ instanceId: 'fav', favorite: true }))
    const discard = makeDiscard()

    const result = dissolveInstances(['fav'], bag, discard)

    expect(result).toEqual({ ok: false, reason: 'favorite' })
    expect(bag.has('fav')).toBe(true)
    expect(discard).not.toHaveBeenCalled()
  })

  it('applies guards in priority order: equipped > locked > favorite', () => {
    const bag = new EquipmentBag()
    bag.add(
      makeInstance({ instanceId: 'all-flags', equipped: true, locked: true, favorite: true }),
    )
    bag.add(makeInstance({ instanceId: 'locked-fav', locked: true, favorite: true }))

    expect(dissolveInstances(['all-flags'], bag, makeDiscard()).reason).toBe('equipped')
    expect(dissolveInstances(['locked-fav'], bag, makeDiscard()).reason).toBe('locked')
  })

  it('reports the first invalid id in selection order', () => {
    const bag = new EquipmentBag()
    bag.add(makeInstance({ instanceId: 'locked-1', locked: true }))
    bag.add(makeInstance({ instanceId: 'equipped-1', equipped: true }))

    expect(dissolveInstances(['locked-1', 'equipped-1'], bag, makeDiscard()).reason).toBe('locked')
    expect(dissolveInstances(['equipped-1', 'locked-1'], bag, makeDiscard()).reason).toBe('equipped')
  })

  it('rejects a quality with no conversion rule instead of dissolving blind', () => {
    const bag = new EquipmentBag()
    bag.add(makeInstance({ instanceId: 'corrupt', quality: corruptedQuality() }))
    const discard = makeDiscard()

    const result = dissolveInstances(['corrupt'], bag, discard)

    expect(result).toEqual({ ok: false, reason: 'no_conversion_rule' })
    expect(bag.has('corrupt')).toBe(true)
    expect(discard).not.toHaveBeenCalled()
  })
})

describe('dissolveInstances — commit semantics', () => {
  it('rolls exactly range.min at random()=0 and range.max just under 1 for every quality', () => {
    for (const quality of ITEM_QUALITY_ORDER) {
      const range = ITEM_QUALITY_ESSENCE_RANGE[quality]!
      const bag = new EquipmentBag()
      bag.add(makeInstance({ instanceId: `min-${quality}`, quality }))
      bag.add(makeInstance({ instanceId: `max-${quality}`, quality }))

      const atMin = dissolveInstances([`min-${quality}`], bag, makeDiscard(), () => 0)
      const atMax = dissolveInstances(
        [`max-${quality}`],
        bag,
        makeDiscard(),
        () => 0.999_999_999,
      )

      expect(atMin.ok).toBe(true)
      expect(atMin.rewards![0]!.amount).toBe(range.min)
      expect(atMax.ok).toBe(true)
      expect(atMax.rewards![0]!.amount).toBe(range.max)
    }
  })

  it('removes every selected item, returns one reward per instance in selection order, and discards each preview before removal', () => {
    const bag = new EquipmentBag()
    bag.add(makeInstance({ instanceId: 'b-first', quality: 'hoang' }))
    bag.add(makeInstance({ instanceId: 'a-second', quality: 'tien' }))

    // The refine preview must be discarded while the item is still in the
    // bag (pass-2 contract): capture membership at callback time.
    const discardOrder: string[] = []
    const membershipAtDiscard: boolean[] = []
    const discard = (instanceId: string): void => {
      discardOrder.push(instanceId)
      membershipAtDiscard.push(bag.has(instanceId))
    }

    const result = dissolveInstances(['b-first', 'a-second'], bag, discard, () => 0)

    expect(result.ok).toBe(true)
    // Commit path reports per-instance rewards (the quote aggregates instead).
    expect(result.rewards).toEqual([
      { materialId: LUYEN_KHI_TINH_HOA_ID, amount: 1 },
      { materialId: LUYEN_KHI_TINH_HOA_ID, amount: 5 },
    ])
    expect(discardOrder).toEqual(['b-first', 'a-second'])
    expect(membershipAtDiscard).toEqual([true, true])
    expect(bag.has('b-first')).toBe(false)
    expect(bag.has('a-second')).toBe(false)
  })

  it('dedupes a repeated id so its preview discard runs exactly once', () => {
    const bag = new EquipmentBag()
    bag.add(makeInstance({ instanceId: 'dup' }))
    const discard = makeDiscard()

    const result = dissolveInstances(['dup', 'dup'], bag, discard, () => 0)

    expect(result.ok).toBe(true)
    expect(result.rewards).toHaveLength(1)
    expect(discard).toHaveBeenCalledTimes(1)
    expect(discard).toHaveBeenCalledWith('dup')
  })
})

describe('quoteDissolveRewards — uncovered guards and aggregation', () => {
  it('rejects an empty selection', () => {
    expect(quoteDissolveRewards([], new EquipmentBag())).toEqual({
      ok: false,
      reason: 'empty_selection',
    })
  })

  it('rejects equipped and favorite items with their guard reasons', () => {
    const bag = new EquipmentBag()
    bag.add(makeInstance({ instanceId: 'eq', equipped: true }))
    bag.add(makeInstance({ instanceId: 'fav', favorite: true }))

    expect(quoteDissolveRewards(['eq'], bag)).toEqual({ ok: false, reason: 'equipped' })
    expect(quoteDissolveRewards(['fav'], bag)).toEqual({ ok: false, reason: 'favorite' })
  })

  it('rejects a quality with no conversion rule', () => {
    const bag = new EquipmentBag()
    bag.add(makeInstance({ instanceId: 'corrupt', quality: corruptedQuality() }))

    expect(quoteDissolveRewards(['corrupt'], bag)).toEqual({
      ok: false,
      reason: 'no_conversion_rule',
    })
  })

  it('aggregates exact min/max across mixed qualities into a single material total', () => {
    const bag = new EquipmentBag()
    // Ranges: hoang 1-3, dia 3-5, tien 5-7 -> min 1+1+3+5, max 3+3+5+7.
    bag.add(makeInstance({ instanceId: 'h1', quality: 'hoang' }))
    bag.add(makeInstance({ instanceId: 'h2', quality: 'hoang' }))
    bag.add(makeInstance({ instanceId: 'd', quality: 'dia' }))
    bag.add(makeInstance({ instanceId: 't', quality: 'tien' }))

    const quote = quoteDissolveRewards(['h1', 'h2', 'd', 't'], bag)

    expect(quote).toEqual({
      ok: true,
      totals: [{ materialId: LUYEN_KHI_TINH_HOA_ID, minAmount: 10, maxAmount: 18 }],
    })
    // Read-only: quoting removes nothing.
    expect(bag.getAll()).toHaveLength(4)
  })
})
