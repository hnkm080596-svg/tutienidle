import { describe, expect, it } from 'vitest'

import {
  ESSENCE_LOCK_SEEDS,
  ESSENCE_RATIO_CANDIDATES,
  bodyChapterRequirement,
  expectedBandEssence,
  expectedBandEssencePerKill,
  lockConversionRatio,
  measureBandResidency,
  measureEssenceRatioLock,
  measureStrandedCompletion,
} from './EssenceSubstitutionEconomy'
import { PHYSIQUE_ESSENCE_CONVERSION_RATIO } from '../../../data/realm/PhysiqueEssence'

// M-QI-09 (QI-D4c + C2C ruling 4) - the deterministic economy sim:
// the mortal band residency stands in for the stranded band's own
// arc (structurally identical: 10-floor chain, level-12 gate, the
// same pinned 0.7 / 1-3 essence rate), candidate ratios are evaluated
// against the authored parity income, the smallest passing candidate
// is written into production data, and THIS test re-derives the lock
// from production values so a drifted ratio fails loudly.
describe('essence substitution economy sim (M-QI-09)', () => {
  it('measures a deterministic band residency per seed', { timeout: 900_000 }, () => {
    const first = measureBandResidency(11)
    const second = measureBandResidency(11)
    expect(second).toEqual(first)
    expect(first.realmId).toBe('qi_refining')
    expect(first.boundaryReached).toBe(true)
    expect(first.kills).toBeGreaterThan(0)
  })

  it('reaches the band boundary on every lock seed', { timeout: 900_000 }, () => {
    for (const seed of ESSENCE_LOCK_SEEDS) {
      expect(measureBandResidency(seed).boundaryReached).toBe(true)
    }
  })

  it('derives per-band income from the pinned authored drop entries', () => {
    // Every pinned band drops essence at 0.7 chance of 1-3 units ->
    // 1.4 expected essence per kill, symmetric across the bands.
    for (const realm of ['mortal', 'qi_refining', 'foundation_establishment'] as const) {
      expect(expectedBandEssencePerKill(realm)).toBeCloseTo(1.4, 10)
    }
    expect(expectedBandEssence('mortal', 0)).toBe(0)
    expect(expectedBandEssencePerKill('golden_core')).toBe(0)
  })

  it('evaluates candidates and locks the smallest passing ratio from production data', { timeout: 900_000 }, () => {
    const measurement = measureEssenceRatioLock('qi_refining')
    const residual = bodyChapterRequirement()

    // The lock rule, recomputed from the pinned inputs: the authored
    // residency income is parity (residual at 1:1), so candidate 2 is
    // the smallest satisfying candidate - and production MUST carry
    // the sim-locked value (C2C 4: no placeholders in shipped data).
    expect(measurement.residual).toBe(residual)
    // Parity within a single per-kill unit: the authored residency
    // kill budget is ceil(residual / 1.4), so the expected income
    // overshoots the residual by less than one kill's essence.
    expect(measurement.surplus).toBeGreaterThanOrEqual(residual)
    expect(measurement.surplus).toBeLessThan(residual + expectedBandEssencePerKill('mortal'))
    expect(measurement.lockedRatio).toBe(ESSENCE_RATIO_CANDIDATES[0])
    expect(measurement.authoredRatio).toBe(PHYSIQUE_ESSENCE_CONVERSION_RATIO.bao)
    expect(measurement.authoredRatio).toBe(measurement.lockedRatio)
    expect(PHYSIQUE_ESSENCE_CONVERSION_RATIO.bao).toBe(measurement.lockedRatio)
  })

  it('lockConversionRatio is the spec rule in pure form', () => {
    expect(lockConversionRatio(10, 10)).toBe(2) // parity -> floor 2
    // Smallest candidate covering residual: 20 * 5 = 100 >= 100.
    expect(lockConversionRatio(100, 20)).toBe(5)
    expect(lockConversionRatio(81, 20)).toBe(5)
    // No candidate covers a surplus this thin, and a dead surplus
    // can never cover.
    expect(lockConversionRatio(100, 10)).toBe(Number.MAX_SAFE_INTEGER)
    expect(lockConversionRatio(1, 0)).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('retires the full lower chapter inside one authored-residency budget at the locked ratio', { timeout: 900_000 }, () => {
    const residual = bodyChapterRequirement()
    const locked = PHYSIQUE_ESSENCE_CONVERSION_RATIO.bao ?? 0
    const budget = Math.ceil(residual / locked)
    for (const seed of ESSENCE_LOCK_SEEDS) {
      const result = measureStrandedCompletion(seed, 'qi_refining', budget)
      expect(
        result.completed,
        `seed ${seed} must retire the chapter at the locked budget`,
      ).toBe(true)
      expect(result.tiersCompleted).toBe(6)
      expect(result.requiredLeft).toBe(0)
    }
  })

  it('fails the full retirement one unit below the locked budget - the lock is tight', { timeout: 900_000 }, () => {
    const residual = bodyChapterRequirement()
    const locked = PHYSIQUE_ESSENCE_CONVERSION_RATIO.bao ?? 0
    const under = measureStrandedCompletion(11, 'qi_refining', Math.ceil(residual / locked) - 1)
    expect(under.completed).toBe(false)
    expect(under.tiersCompleted).toBeLessThan(6)
  })
})
