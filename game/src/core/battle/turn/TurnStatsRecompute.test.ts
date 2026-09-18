import { describe, expect, it } from 'vitest'
import { recomputeEffectiveStats } from './TurnStatsRecompute'
import { calculateStats, type StatModifier } from '../../stats/StatCalculator'
import { createBaseStats } from '../../stats/StatBlock'

// R2 (AR-02) — recomputeEffectiveStats now treats its first argument as an
// ALREADY-RESOLVED base (attribute derivation happened exactly once when
// the entity was built). Fixture mirrors the audit probe: raw might 10 +
// strength 100 resolves to might 70; an in-battle +50% might buff must
// fold onto 70 (=105), not re-derive strength (+60) first (=130).

function buffModifier(overrides: Partial<StatModifier> & { stat: StatModifier['stat'] }): StatModifier {
  return {
    id: 'qa_mod',
    sourceId: 'qa_src',
    sourceType: 'buff',
    ...overrides,
  }
}

function attackBuffModifiers(percent: number, stacks: number): StatModifier[] {
  // buff2 getStatModifiers folds instance stacks onto the returned
  // modifier — the query output, not the pool, is the function's input.
  return [
    buffModifier({ stat: 'might', percent, stacks }),
  ]
}

describe('recomputeEffectiveStats (R2 effective boundary)', () => {
  it('folds buff modifiers onto the RESOLVED base without re-deriving attributes', () => {
    const raw = createBaseStats({ strength: 100, might: 10 })
    const resolved = calculateStats(raw, [])
    expect(resolved.might).toBe(70)

    // 2 stacks × +50% increased pool → 70 × (1 + 0.5 + 0.5) = 140.
    const effective = recomputeEffectiveStats(resolved, attackBuffModifiers(0.5, 2))
    expect(effective.might).toBe(140)
  })

  it('no buffs: effective equals resolved base exactly', () => {
    const raw = createBaseStats({ strength: 100, might: 10 })
    const resolved = calculateStats(raw, [])

    expect(recomputeEffectiveStats(resolved, [])).toEqual(resolved)
  })
})

describe('recomputeEffectiveStats', () => {
  it('folds active statModifier buff effects into the resolved base via the effective pipeline', () => {
    // R2: the input is a RESOLVED base — attribute derivation must NOT
    // run again, so the old strength-derivation expectations (+0.6) are
    // gone. Resolved might 100 + flat buff 50 = 150 exactly.
    const base = createBaseStats({ might: 100 })

    const effective = recomputeEffectiveStats(base, [
      buffModifier({ stat: 'might', flat: 50 }),
    ])

    expect(effective.might).toBeCloseTo(150, 5)
  })

  it('returns resolved base unchanged when no statModifier buffs are active', () => {
    // R2: no re-derivation — the resolved snapshot comes back untouched.
    const base = createBaseStats({ might: 100 })

    const effective = recomputeEffectiveStats(base, [])

    expect(effective.might).toBeCloseTo(100, 5)
  })

  it('percent statModifier folds multiplicatively with the resolved base', () => {
    // R2: (100 resolved) × (1 + 0.5) = 150 — attribute derivation no
    // longer inflates the base before the percent fold.
    const base = createBaseStats({ might: 100 })

    const effective = recomputeEffectiveStats(base, [
      buffModifier({ stat: 'might', percent: 0.5 }),
    ])

    expect(effective.might).toBeCloseTo(150, 5)
  })
})
