import { describe, expect, it } from 'vitest'
import { createBaseStats } from './StatBlock'
import {
  calculateStats,
  explainStatBreakdown,
  type StatModifier,
} from './StatCalculator'

// Character-board source hover (fidelity surface): the breakdown must
// report the SAME fold the canonical 2-pass pipeline produces - grouped
// by (sourceType, sourceId), flat/percent-per-tag/multiplier preserved,
// attribute-derivation modifiers attributed to their attribute.

function statMod(overrides: Partial<StatModifier>): StatModifier {
  return {
    id: 'test',
    sourceId: 'test',
    sourceType: 'equipment',
    stat: 'might',
    ...overrides,
  }
}

describe('explainStatBreakdown', () => {
  it('groups contributions by (sourceType, sourceId) with flat/per-tag/multiplier parts', () => {
    const base = createBaseStats({ might: 100 })
    const modifiers: StatModifier[] = [
      statMod({ id: 'a', sourceId: 'sword-1', flat: 10 }),
      statMod({ id: 'b', sourceId: 'sword-1', flat: 5, percent: 0.1 }),
      statMod({ id: 'c', sourceId: 'sword-1', percent: 0.2, tag: 'fire' }),
      statMod({ id: 'd', sourceId: 'ring-1', sourceType: 'equipment', multiplier: 1.5, stacks: 2 }),
      statMod({ id: 'e', sourceId: 'nhap_dao', sourceType: 'realm', percent: 0.05 }),
      statMod({ id: 'other-stat', sourceId: 'sword-1', stat: 'defense', flat: 999 }),
    ]

    const breakdown = explainStatBreakdown(base, modifiers, 'might')

    expect(breakdown.base).toBe(100)
    // 3 authored sources + the attribute channel (default strength=1
    // derives +0.6 might); a zero-strength base would prune it.
    expect(breakdown.contributions).toHaveLength(4)

    const sword = breakdown.contributions.find((c) => c.sourceId === 'sword-1')!
    expect(sword.sourceType).toBe('equipment')
    expect(sword.flat).toBe(15)
    expect(sword.percents).toEqual([
      { tag: undefined, amount: 0.1 },
      { tag: 'fire', amount: 0.2 },
    ])
    expect(sword.modifierIds).toEqual(['a', 'b', 'c'])

    const ring = breakdown.contributions.find((c) => c.sourceId === 'ring-1')!
    expect(ring.multiplier).toBeCloseTo(2.25)

    const realm = breakdown.contributions.find((c) => c.sourceType === 'realm')!
    expect(realm.percents).toEqual([{ tag: undefined, amount: 0.05 }])
  })

  it('attributes attribute-derived bonuses to their attribute source', () => {
    const base = createBaseStats({ strength: 50, might: 100 })
    const breakdown = explainStatBreakdown(base, [], 'might')

    // strength * ATTRIBUTE_MIGHT_PER_POINT lands as an 'attribute'
    // contribution - the derived modifier set is part of the truth.
    const attribute = breakdown.contributions.find((c) => c.sourceType === 'attribute')!
    expect(attribute.sourceId).toBe('strength')
    expect(attribute.flat).toBeCloseTo(30)
    expect(attribute.modifierIds[0]).toBe('attribute:strength:might')
  })

  it('attribute totals come from pass 1 - a strength buff raises the derived contribution', () => {
    const base = createBaseStats({ strength: 50, might: 100 })
    const modifiers: StatModifier[] = [
      statMod({ id: 'str-buff', stat: 'strength', sourceType: 'buff', flat: 10 }),
    ]

    const breakdown = explainStatBreakdown(base, modifiers, 'might')
    const attribute = breakdown.contributions.find((c) => c.sourceType === 'attribute')!

    // (50 + 10) * 0.6 = 36 - the derived read sees post-pass-1 totals.
    expect(attribute.flat).toBeCloseTo(36)
  })

  it('matches the canonical pipeline: reconstructing from the breakdown reproduces calculateStats', () => {
    const base = createBaseStats({ might: 100, strength: 40 })
    const modifiers: StatModifier[] = [
      statMod({ id: 'a', sourceId: 'eq-1', flat: 10 }),
      statMod({ id: 'b', sourceId: 'eq-1', percent: 0.1, tag: 'fire' }),
      statMod({ id: 'c', sourceId: 'eq-2', percent: 0.25 }),
      statMod({ id: 'd', sourceId: 'eq-2', multiplier: 1.2 }),
    ]

    const breakdown = explainStatBreakdown(base, modifiers, 'might')

    // Fold the breakdown back through the pipeline formula:
    // (base + sum flat) * prod_tag(1 + sum pct_tag) * prod mult.
    const flat = breakdown.contributions.reduce((sum, c) => sum + c.flat, 0)
    const tagPools = new Map<string | undefined, number>()
    const mults: number[] = []
    for (const c of breakdown.contributions) {
      for (const pool of c.percents) {
        tagPools.set(pool.tag, (tagPools.get(pool.tag) ?? 0) + pool.amount)
      }
      if (c.multiplier !== 1) mults.push(c.multiplier)
    }
    let value = breakdown.base + flat
    for (const pct of tagPools.values()) value *= 1 + pct
    for (const m of mults) value *= m

    expect(value).toBeCloseTo(calculateStats(base, modifiers).might, 6)
  })
})
