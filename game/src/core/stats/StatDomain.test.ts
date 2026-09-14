import { afterEach, describe, expect, it, vi } from 'vitest'
import { calculateEffectiveStats, calculateStats, type StatModifier } from './StatCalculator'
import { createBaseStats } from './StatBlock'
import {
  DOMAIN_SOURCE_WHITELIST,
  STAT_DOMAIN,
  applyDomainGate,
  clearDomainViolations,
  domainViolations,
} from './StatDomain'

// Task 1 (D10) -- domain gate infrastructure. STAT_DOMAIN starts EMPTY
// in production code; each test that needs a gated stat registers a
// temporary entry and afterEach restores the empty registry.

const GATED_STAT = 'maxMp'
const GATED_DOMAIN = 'phap_tu'

function mod(partial: Partial<StatModifier> & Pick<StatModifier, 'stat'>): StatModifier {
  return {
    id: `test:${partial.stat}:${partial.domain ?? 'universal'}`,
    sourceId: 'test',
    sourceType: 'buff',
    ...partial,
  }
}

afterEach(() => {
  delete STAT_DOMAIN[GATED_STAT]
  clearDomainViolations()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('domain gate (D10)', () => {
  it('INV-9: a phap_tu-domain modifier targeting universal stats applies normally', () => {
    const base = createBaseStats()

    // A domain tag on a universal stat must be a no-op: identical
    // outcome to the same modifier without a domain. Compared pairwise
    // so attribute derivation can never make the assertion drift.
    const tagged = calculateStats(base, [
      mod({ stat: 'might', domain: 'phap_tu', flat: 5 }),
      mod({ stat: 'firePower', domain: 'phap_tu', flat: 7 }),
    ])
    const untagged = calculateStats(base, [
      mod({ stat: 'might', flat: 5 }),
      mod({ stat: 'firePower', flat: 7 }),
    ])

    expect(tagged.might).toBe(untagged.might)
    expect(tagged.firePower).toBe(untagged.firePower)
    expect(untagged.might).toBeGreaterThan(base.might)
    expect(untagged.firePower).toBeGreaterThan(base.firePower)
    expect(domainViolations).toHaveLength(0)
  })

  it('INV-1: gated stat + absent domain throws in dev/test', () => {
    STAT_DOMAIN[GATED_STAT] = GATED_DOMAIN
    const base = createBaseStats()

    expect(() => calculateStats(base, [mod({ stat: GATED_STAT, flat: 50 })])).toThrow(/domain/i)
  })

  it('INV-1: gated stat + wrong domain throws in dev/test', () => {
    STAT_DOMAIN[GATED_STAT] = GATED_DOMAIN
    const base = createBaseStats()

    expect(() =>
      calculateStats(base, [mod({ stat: GATED_STAT, domain: 'kiem_tu', flat: 50 })]),
    ).toThrow(/domain/i)
  })

  it('gated stat + matching domain applies', () => {
    STAT_DOMAIN[GATED_STAT] = GATED_DOMAIN
    const base = createBaseStats()

    const result = calculateStats(base, [mod({ stat: GATED_STAT, domain: GATED_DOMAIN, flat: 50 })])

    expect(result.maxMp).toBe(50)
  })

  it('calculateEffectiveStats runs the same gate on temp modifiers', () => {
    STAT_DOMAIN[GATED_STAT] = GATED_DOMAIN
    const resolved = calculateStats(createBaseStats(), [])

    expect(() => calculateEffectiveStats(resolved, [mod({ stat: GATED_STAT, flat: 50 })])).toThrow(
      /domain/i,
    )

    const accepted = calculateEffectiveStats(resolved, [
      mod({ stat: GATED_STAT, domain: GATED_DOMAIN, flat: 50 }),
    ])
    expect(accepted.maxMp).toBe(50)
  })

  it('empty STAT_DOMAIN gates nothing -- absent or foreign domain still applies', () => {
    const base = createBaseStats()

    const result = calculateStats(base, [
      mod({ stat: GATED_STAT, flat: 33 }),
      mod({ stat: 'wardMax', domain: 'kiem_tu', flat: 10 }),
    ])

    expect(result.maxMp).toBe(33)
    expect(result.wardMax).toBe(10)
    expect(domainViolations).toHaveLength(0)
  })

  it('production mode filters the violating modifier, collects it, and reports via console.error', () => {
    // import.meta.env.MODE/DEV are build-time constants vitest cannot
    // restub, so the rejection policy is exercised through the gate's
    // throwOnViolation parameter (production = false).
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    STAT_DOMAIN[GATED_STAT] = GATED_DOMAIN

    const accepted = applyDomainGate(
      [mod({ stat: 'might', flat: 5 }), mod({ stat: GATED_STAT, flat: 50 })],
      false,
    )

    expect(accepted).toHaveLength(1)
    expect(accepted[0]?.stat).toBe('might')
    expect(domainViolations).toHaveLength(1)
    expect(domainViolations[0]?.modifier.stat).toBe(GATED_STAT)
    expect(domainViolations[0]?.statDomain).toBe(GATED_DOMAIN)
    expect(domainViolations[0]?.modifierDomain).toBe('universal')
    expect(errorSpy).toHaveBeenCalledTimes(1)
  })

  it('dev/test records the violation before throwing', () => {
    STAT_DOMAIN[GATED_STAT] = GATED_DOMAIN
    const base = createBaseStats()

    expect(() => calculateStats(base, [mod({ stat: GATED_STAT, flat: 50 })])).toThrow(/domain/i)
    expect(domainViolations).toHaveLength(1)
  })

  it('DOMAIN_SOURCE_WHITELIST starts empty', () => {
    expect(DOMAIN_SOURCE_WHITELIST).toEqual({})
  })
})
