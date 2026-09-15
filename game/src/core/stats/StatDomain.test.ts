import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  calculateEffectiveStats,
  calculateStats,
  registerDomainDeltaDeriver,
  unregisterDomainDeltaDeriver,
  type StatModifier,
} from './StatCalculator'
import { createBaseStats } from './StatBlock'
import {
  DOMAIN_SOURCE_WHITELIST,
  STAT_DOMAIN,
  applyDomainGate,
  clearDomainViolations,
  domainViolations,
} from './StatDomain'

// Task 1 (D10) -- domain gate infrastructure. Task 7 populated
// STAT_DOMAIN/DOMAIN_SOURCE_WHITELIST with the real phap_tu gate; tests
// that register temporary entries restore the production registry after
// each run (a bare `delete` would strip the real registration).

const GATED_STAT = 'maxMp'
const GATED_DOMAIN = 'phap_tu'

const PRODUCTION_STAT_DOMAIN = { ...STAT_DOMAIN }

function mod(partial: Partial<StatModifier> & Pick<StatModifier, 'stat'>): StatModifier {
  return {
    id: `test:${partial.stat}:${partial.domain ?? 'universal'}`,
    sourceId: 'test',
    sourceType: 'buff',
    ...partial,
  }
}

afterEach(() => {
  for (const key of Object.keys(STAT_DOMAIN)) {
    delete STAT_DOMAIN[key as keyof typeof STAT_DOMAIN]
  }
  Object.assign(STAT_DOMAIN, PRODUCTION_STAT_DOMAIN)
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

  it('ungated stats accept absent or foreign domains regardless of the phap_tu gate', () => {
    const base = createBaseStats()

    const result = calculateStats(base, [
      mod({ stat: 'wardMax', flat: 33 }),
      mod({ stat: 'might', domain: 'kiem_tu', flat: 10 }),
    ])

    expect(result.wardMax).toBe(33)
    expect(result.might).toBeGreaterThan(base.might)
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

  it('Task 7: the real phap_tu gate is populated -- MP/reaction stats are gated', () => {
    expect(STAT_DOMAIN.maxMp).toBe('phap_tu')
    expect(STAT_DOMAIN.manaRegenPerTurn).toBe('phap_tu')
    expect(STAT_DOMAIN.manaShieldPercent).toBe('phap_tu')
    expect(STAT_DOMAIN.reactionEffectPercent).toBe('phap_tu')
  })

  it('Task 7: DOMAIN_SOURCE_WHITELIST declares the phap_tu emitters', () => {
    const entries = DOMAIN_SOURCE_WHITELIST.phap_tu ?? []
    const files = entries.map((e) => e.file)

    expect(files).toContain('data/progression/PhapTu*')
    expect(files).toContain('data/realm/RealmPassives.ts')
    expect(files).toContain('data/technique/Techniques.ts')
  })

  it('Task 9 (D15): meta stats are gated to their owning domain', () => {
    expect(STAT_DOMAIN.productionSpeedMultiplier).toBe('production')
    expect(STAT_DOMAIN.cultivationPercent).toBe('cultivation')
    expect(STAT_DOMAIN.affixDeltaPercent).toBe('equipment_meta')
    expect(STAT_DOMAIN.artifactGradeMultiplier).toBe('artifact')
    expect(STAT_DOMAIN.realmPassivePercent).toBe('realm')
  })

  it('Task 9: a production-domain modifier still delivers productionSpeedMultiplier', () => {
    const base = createBaseStats()

    const result = calculateStats(base, [
      mod({ stat: 'productionSpeedMultiplier', domain: 'production', flat: 0.5 }),
    ])

    expect(result.productionSpeedMultiplier).toBeCloseTo(1.5, 6)
  })

  it('deriver-emitted gated stat with the WRONG domain is rejected (derivers cannot bypass the gate)', () => {
    // Review fix (2026-09-15): deltaDeriver output is system-generated,
    // so applyDomainGate is its only guard — the whitelist lint never
    // scans it. A kiem_tu deriver must not be able to emit maxMp.
    const resolved = calculateStats(createBaseStats(), [])

    registerDomainDeltaDeriver('kiem_tu', () => [
      mod({ stat: GATED_STAT, domain: 'kiem_tu', flat: 999 }),
    ])

    try {
      expect(() =>
        calculateEffectiveStats(resolved, [mod({ stat: 'attunement', flat: 5 })], {
          activeDomains: new Set(['kiem_tu' as const]),
        }),
      ).toThrow(/domain/i)
      expect(domainViolations).toHaveLength(1)
    } finally {
      unregisterDomainDeltaDeriver('kiem_tu')
    }
  })

  it('Task 9: an untagged or foreign-domain meta modifier is rejected', () => {
    const base = createBaseStats()

    expect(() =>
      calculateStats(base, [mod({ stat: 'cultivationPercent', flat: 0.5 })]),
    ).toThrow(/domain/i)
    expect(() =>
      calculateStats(base, [mod({ stat: 'realmPassivePercent', domain: 'phap_tu', flat: 0.5 })]),
    ).toThrow(/domain/i)
  })
})
