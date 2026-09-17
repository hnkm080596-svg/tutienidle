import { describe, expect, it } from 'vitest'
import type { ApplyBuffRequest } from '../battle/contracts/operations'
import { ApplicationResolver } from './ApplicationResolver'
import type { BuffDefinition } from './BuffDefinition'
import type { BuffInstance } from './BuffInstance'
import { makeTestRng } from './testing/BuffTestFixtures'

function def(overrides: Partial<BuffDefinition> = {}): BuffDefinition {
  return {
    id: 'test_buff.r',
    name: 'r',
    kind: 'ailment',
    instanceScope: 'per_source',
    stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 4, scaling: 'ailment_scaled' },
    application: { resistance: 'ailment' },
    dispellable: true,
    ...overrides,
  }
}

function req(overrides: Partial<ApplyBuffRequest> = {}): ApplyBuffRequest {
  return {
    definitionId: 'test_buff.r',
    sourceId: 'test_entity.src.a',
    targetId: 'test_entity.tgt.a',
    stacks: 1,
    baseChance: 0.5,
    reactionEligibility: 'eligible',
    origin: { kind: 'skill', originId: 't', sourceId: 'test_entity.src.a', rootActionId: 'r.1' },
    ...overrides,
  }
}

function inst(overrides: Partial<BuffInstance> = {}): BuffInstance {
  return {
    instanceId: 'buff.b.1',
    definitionId: 'test_buff.r',
    sourceId: 'test_entity.src.a',
    targetId: 'test_entity.tgt.a',
    stacks: 1,
    remaining: 4,
    continuousTurns: 0,
    continuousSeconds: 0,
    modifiers: [],
    createdSequence: 0,
    lastAppliedSequence: 0,
    ...overrides,
  }
}

const NO_STATS = { stats: {} }

describe('ApplicationResolver -- spec sec.12 multiplicative chance', () => {
  it('chance = base x (1+app%) x application_chance-channel x (1-resist)', () => {
    const rng = makeTestRng(0.99) // roll 0.99 -> fails unless chance >= 0.99... use queued
    const resolver = new ApplicationResolver(rng)
    const existing = inst({
      modifiers: [
        {
          id: 'm1',
          instanceId: 'buff.b.1',
          modifierRuntimeId: 'bmr.1',
          channel: 'application_chance',
          operation: 'multiply',
          value: 2,
          reapply: 'stack',
          priority: 0,
          lifetime: { type: 'buff_lifetime' },
        },
      ],
    })
    const result = resolver.resolve(req(), {
      source: { stats: { elementApplicationPercent: 0.5 } }, // x1.5
      target: { stats: { ailmentResistPercent: 0.25 } }, // x0.75
      definition: def(),
      existing,
    })
    // 0.5 * 1.5 * 2 * 0.75 = 1.125 -> clamped to 1 -> roll 0.99 < 1 -> success
    expect(result.chance).toBe(1)
    expect(result.success).toBe(true)
    expect(rng.rolls).toBe(1)
  })

  it("resistance:'none' ignores target resist", () => {
    const rng = makeTestRng(0.6)
    const resolver = new ApplicationResolver(rng)
    const result = resolver.resolve(req({ baseChance: 0.5 }), {
      source: NO_STATS,
      target: { stats: { ailmentResistPercent: 0.9 } },
      definition: def({ application: { resistance: 'none' } }),
    })
    expect(result.chance).toBe(0.5) // resist ignored -- base only
    expect(result.success).toBe(false) // 0.6 < 0.5 is false
  })

  it('clampChance:false passes chance through unclamped', () => {
    const rng = makeTestRng(0.5)
    const resolver = new ApplicationResolver(rng)
    const result = resolver.resolve(req({ baseChance: 4 }), {
      source: NO_STATS,
      target: NO_STATS,
      definition: def({ application: { resistance: 'none', clampChance: false } }),
    })
    expect(result.chance).toBe(4)
    expect(result.success).toBe(true)
  })

  it.each([0, 0.5, 1])(
    'exactly one rollChance consumed at chance=%i (stream parity)',
    (baseChance) => {
      const rng = makeTestRng(0.25)
      const resolver = new ApplicationResolver(rng)
      resolver.resolve(req({ baseChance }), {
        source: NO_STATS,
        target: NO_STATS,
        definition: def({ application: { resistance: 'none' } }),
      })
      expect(rng.rolls).toBe(1)
    },
  )

  it('chance 0 still consumes the roll and fails', () => {
    const rng = makeTestRng(0)
    const resolver = new ApplicationResolver(rng)
    const result = resolver.resolve(req({ baseChance: 0 }), {
      source: NO_STATS,
      target: NO_STATS,
      definition: def({ application: { resistance: 'none' } }),
    })
    expect(result.success).toBe(false)
    expect(rng.rolls).toBe(1)
  })
})

describe('ApplicationResolver -- duration (spec sec.17-20)', () => {
  it("'fixed' scaling returns base verbatim", () => {
    const resolver = new ApplicationResolver(makeTestRng(0))
    const result = resolver.resolve(req(), {
      source: { stats: { ailmentDurationPercent: 5 } },
      target: { stats: { ailmentResistPercent: 0.9 } },
      definition: def({ lifetime: { clock: 'holder_turns', duration: 7, scaling: 'fixed' } }),
    })
    expect(result.duration).toBe(7)
  })

  it("'ailment_scaled' = base x (1-resist) x (1+dur%) x duration-channel", () => {
    const resolver = new ApplicationResolver(makeTestRng(0))
    const existing = inst({
      modifiers: [
        {
          id: 'd1',
          instanceId: 'buff.b.1',
          modifierRuntimeId: 'bmr.2',
          channel: 'duration',
          operation: 'multiply',
          value: 2,
          reapply: 'stack',
          priority: 0,
          lifetime: { type: 'buff_lifetime' },
        },
      ],
    })
    const result = resolver.resolve(req(), {
      source: { stats: { ailmentDurationPercent: 0.5 } },
      target: { stats: { ailmentResistPercent: 0.5 } },
      definition: def({ lifetime: { clock: 'holder_turns', duration: 10, scaling: 'ailment_scaled' } }),
      existing,
    })
    // 10 * 0.5 * 1.5 * 2 = 15
    expect(result.duration).toBe(15)
  })

  it('ailment resist is capped at 0.75', () => {
    const resolver = new ApplicationResolver(makeTestRng(0))
    const result = resolver.resolve(req(), {
      source: NO_STATS,
      target: { stats: { ailmentResistPercent: 0.95 } },
      definition: def({ lifetime: { clock: 'holder_turns', duration: 10, scaling: 'ailment_scaled' } }),
    })
    expect(result.duration).toBeCloseTo(10 * 0.25)
  })

  it('durationOverride wins over authored duration', () => {
    const resolver = new ApplicationResolver(makeTestRng(0))
    const result = resolver.resolve(req({ durationOverride: 9 }), {
      source: NO_STATS,
      target: NO_STATS,
      definition: def({ lifetime: { clock: 'holder_turns', duration: 4, scaling: 'fixed' } }),
    })
    expect(result.duration).toBe(9)
  })

  it("'permanent' clock yields undefined duration", () => {
    const resolver = new ApplicationResolver(makeTestRng(0))
    const result = resolver.resolve(req(), {
      source: NO_STATS,
      target: NO_STATS,
      definition: def({ lifetime: { clock: 'permanent', scaling: 'fixed' } }),
    })
    expect(result.duration).toBeUndefined()
  })
})
