import { describe, expect, it } from 'vitest'
import type { BuffDefinition } from './BuffDefinition'
import {
  makeBuffWorld,
  makeTestDamageProfiles,
} from './testing/BuffTestFixtures'

function baseDef(overrides: Partial<BuffDefinition> = {}): BuffDefinition {
  const w = makeBuffWorld()
  return w.makeTestDefinition({ id: 'test_buff.subject', ...overrides })
}

function registerAndSeal(def: BuffDefinition) {
  const w = makeBuffWorld()
  w.registry.register(def)
  w.registry.seal()
  return w
}

describe('BuffRegistry (M1 step 2 -- spec sec.56 full validation list)', () => {
  it('registers + freezes a valid definition; get/has/all work', () => {
    const w = registerAndSeal(baseDef())
    const def = w.registry.get('test_buff.subject')
    expect(def.id).toBe('test_buff.subject')
    expect(Object.isFrozen(def)).toBe(true)
    expect(Object.isFrozen(def.stacking)).toBe(true)
    expect(w.registry.has('test_buff.subject')).toBe(true)
    expect(w.registry.all()).toHaveLength(1)
    expect(() => w.registry.get('test_buff.missing')).toThrow(/unknown definition/)
  })

  it('duplicate id throws', () => {
    const w = makeBuffWorld()
    w.registry.register(baseDef())
    expect(() => w.registry.register(baseDef())).toThrow(/duplicate id/)
  })

  it('register() after seal() throws', () => {
    const w = makeBuffWorld()
    w.registry.register(baseDef())
    w.registry.seal()
    expect(() =>
      w.registry.register(baseDef({ id: 'test_buff.late' })),
    ).toThrow(/after seal/)
  })

  it('stacking.maxStacks < 1 throws', () => {
    expect(() =>
      registerAndSeal(
        baseDef({ stacking: { maxStacks: 0, onReapplyStacks: 'add', onReapplyDuration: 'refresh' } }),
      ),
    ).toThrow(/maxStacks must be >= 1/)
  })

  it('invalid instanceScope throws', () => {
    expect(() =>
      registerAndSeal(baseDef({ instanceScope: 'all' as BuffDefinition['instanceScope'] })),
    ).toThrow(/invalid instanceScope/)
  })

  it('sourceOwnership without per_target scope throws', () => {
    expect(() =>
      registerAndSeal(baseDef({ sourceOwnership: 'latest' })),
    ).toThrow(/only meaningful with instanceScope/)
  })

  it('lifetime.duration required unless clock is permanent; absent for permanent', () => {
    expect(() =>
      registerAndSeal(baseDef({ lifetime: { clock: 'holder_turns', scaling: 'fixed' } })),
    ).toThrow(/lifetime\.duration/)
    expect(() =>
      registerAndSeal(
        baseDef({ lifetime: { clock: 'permanent', scaling: 'fixed', duration: 3 } }),
      ),
    ).toThrow(/must be absent when clock is 'permanent'/)
    // permanent without duration is fine
    const w = registerAndSeal(
      baseDef({ lifetime: { clock: 'permanent', scaling: 'fixed' } }),
    )
    expect(w.registry.get('test_buff.subject').lifetime.clock).toBe('permanent')
  })

  it('negative duration throws', () => {
    expect(() =>
      registerAndSeal(
        baseDef({ lifetime: { clock: 'holder_turns', duration: -1, scaling: 'fixed' } }),
      ),
    ).toThrow(/must be >= 0/)
  })

  it('duplicate periodic ids within one definition throw', () => {
    const periodic = {
      id: 'dup',
      type: 'heal' as const,
      amount: 5,
      timing: 'holder_turn_end' as const,
      stackScaling: 'ignore' as const,
    }
    expect(() =>
      registerAndSeal(baseDef({ periodic: [periodic, { ...periodic }] })),
    ).toThrow(/duplicate periodic id/)
  })

  it('intervalSeconds required iff timing is interval; must be > 0', () => {
    const intervalDot = {
      id: 'i',
      type: 'heal' as const,
      amount: 1,
      timing: 'interval' as const,
      stackScaling: 'ignore' as const,
    }
    expect(() =>
      registerAndSeal(baseDef({ periodic: [intervalDot] })),
    ).toThrow(/intervalSeconds/)
    expect(() =>
      registerAndSeal(baseDef({ periodic: [{ ...intervalDot, intervalSeconds: 0 }] })),
    ).toThrow(/> 0/)
    expect(() =>
      registerAndSeal(baseDef({ periodic: [{ ...intervalDot, intervalSeconds: 2 }] })),
    ).not.toThrow()
  })

  it('snapshotFields required iff scaling is snapshot AND must be a subset of the profile schema (MEDIUM 2)', () => {
    const dot = {
      id: 'p',
      type: 'damage' as const,
      element: 'fire' as const,
      damageProfile: 'test_profile',
      coefficient: 1,
      scaling: 'snapshot' as const,
      timing: 'holder_turn_end' as const,
      stackScaling: 'multiply' as const,
      canCrit: false,
      canMiss: false,
      hitCount: 1,
    }
    // missing snapshotFields
    expect(() => registerAndSeal(baseDef({ periodic: [dot] }))).toThrow(/snapshotFields required/)
    // subset of declared schema ['attack','element_mastery'] -> ok
    expect(() =>
      registerAndSeal(baseDef({ periodic: [{ ...dot, snapshotFields: ['attack'] }] })),
    ).not.toThrow()
    // outside the schema -> throw
    expect(() =>
      registerAndSeal(baseDef({ periodic: [{ ...dot, snapshotFields: ['mana'] }] })),
    ).toThrow(/outside damageProfile/)
    // dynamic + snapshotFields -> throw
    expect(() =>
      registerAndSeal(
        baseDef({ periodic: [{ ...dot, scaling: 'dynamic' as const, snapshotFields: ['attack'] }] }),
      ),
    ).toThrow(/must be absent when scaling is 'dynamic'/)
    // empty-schema profile -> any selection fails
    expect(() =>
      registerAndSeal(
        baseDef({ periodic: [{ ...dot, damageProfile: 'test_profile_empty', snapshotFields: ['attack'] }] }),
      ),
    ).toThrow(/outside damageProfile/)
  })

  it('unknown damageProfile throws', () => {
    const dot = {
      id: 'p',
      type: 'damage' as const,
      element: 'fire' as const,
      damageProfile: 'no_such_profile',
      coefficient: 1,
      scaling: 'dynamic' as const,
      timing: 'holder_turn_end' as const,
      stackScaling: 'multiply' as const,
      canCrit: false,
      canMiss: false,
      hitCount: 1,
    }
    expect(() => registerAndSeal(baseDef({ periodic: [dot] }))).toThrow(/unknown damageProfile/)
  })

  it('unknown element on def or periodic throws', () => {
    expect(() =>
      registerAndSeal(baseDef({ element: 'shadow' as BuffDefinition['element'] })),
    ).toThrow(/unknown element/)
    const dot = {
      id: 'p',
      type: 'damage' as const,
      element: 'shadow' as 'fire',
      damageProfile: 'test_profile',
      coefficient: 1,
      scaling: 'dynamic' as const,
      timing: 'holder_turn_end' as const,
      stackScaling: 'multiply' as const,
      canCrit: false,
      canMiss: false,
      hitCount: 1,
    }
    expect(() => registerAndSeal(baseDef({ periodic: [dot] }))).toThrow(/unknown element/)
  })

  it('unknown control type throws', () => {
    expect(() =>
      registerAndSeal(baseDef({ controls: [{ type: 'sleep' as 'stun' }] })),
    ).toThrow(/unknown control type/)
  })

  it('unregistered capability type throws at register', () => {
    const w = makeBuffWorld()
    expect(() =>
      w.registry.register(
        w.makeTestDefinition({
          capabilities: [{ id: 'cap.1', type: 'unregistered_type', payload: {} }],
        }),
      ),
    ).toThrow(/failed validation|unknown/i)
  })

  it('registered capability type whose validator rejects the payload throws', () => {
    const w = makeBuffWorld()
    w.capabilityValidators.register('on_hit_proc', (payload) => {
      const p = payload as { chance?: unknown }
      if (typeof p?.chance !== 'number') throw new Error('chance must be a number')
    })
    expect(() =>
      w.registry.register(
        w.makeTestDefinition({
          capabilities: [{ id: 'cap.1', type: 'on_hit_proc', payload: { chance: 'high' } }],
        }),
      ),
    ).toThrow(/chance must be a number/)
    // valid payload passes
    expect(() =>
      w.registry.register(
        w.makeTestDefinition({
          id: 'test_buff.ok',
          capabilities: [{ id: 'cap.2', type: 'on_hit_proc', payload: { chance: 0.5 } }],
        }),
      ),
    ).not.toThrow()
  })

  it('convertsToId must resolve inside the catalog at seal()', () => {
    const w = makeBuffWorld()
    w.registry.register(baseDef({ convertsToId: 'test_buff.missing_target' }))
    expect(() => w.registry.seal()).toThrow(/convertsToId.*does not resolve/)
    // resolvable target passes
    const w2 = makeBuffWorld()
    w2.registry.register(baseDef({ id: 'test_buff.into' }))
    w2.registry.register(baseDef({ id: 'test_buff.from', convertsToId: 'test_buff.into' }))
    expect(() => w2.registry.seal()).not.toThrow()
  })

  it('dispellable must be a present boolean', () => {
    expect(() =>
      registerAndSeal(baseDef({ dispellable: undefined as unknown as boolean })),
    ).toThrow(/dispellable must be a boolean/)
  })

  it('stat modifier with neither flat nor percent throws', () => {
    expect(() =>
      registerAndSeal(baseDef({ statModifiers: [{ stat: 'might' }] })),
    ).toThrow(/flat or percent required/)
  })
})
