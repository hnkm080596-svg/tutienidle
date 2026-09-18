// BuffConversion.test.ts -- M3: conversion continuations. Stack-cap
// (apply lane) + continuous-threshold (lifecycle lane); both ride the
// internal apply at stacks:1 / baseChance:1 / suppressed, old instance
// removed 'replaced'.

import { describe, expect, it } from 'vitest'
import type { BuffDefinition } from './BuffDefinition'
import type { BuffInstance } from './BuffInstance'
import type { ApplyBuffRequest } from '../battle/contracts/operations'
import {
  makeBuffSystemWorld,
  TEST_ENTITIES,
  type BuffSystemWorld,
} from './testing/BuffTestFixtures'

const { sourceA, targetA } = TEST_ENTITIES

function def(w: BuffSystemWorld, overrides: Partial<BuffDefinition> = {}): BuffDefinition {
  const d = w.makeTestDefinition(overrides)
  w.registry.register(d)
  return d
}

function req(overrides: Partial<ApplyBuffRequest> = {}): ApplyBuffRequest {
  return {
    definitionId: 'test_buff.1',
    sourceId: sourceA,
    targetId: targetA,
    stacks: 1,
    baseChance: 1,
    reactionEligibility: 'eligible',
    origin: { kind: 'skill', originId: 'test', sourceId: sourceA, rootActionId: 'root.test.1' },
    ...overrides,
  }
}

function seed(w: BuffSystemWorld, definitionId: string, overrides: Partial<BuffInstance> = {}): BuffInstance {
  const i = w.makeTestInstance({ definitionId: definitionId as BuffInstance['definitionId'], ...overrides })
  w.store.add(i)
  return i
}

describe('convertsAtStackCap (apply lane)', () => {
  function capDef(): Partial<BuffDefinition> {
    return {
      stacking: { maxStacks: 3, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
      convertsToId: 'test_buff.2',
      convertsAtStackCap: true,
    }
  }

  it('reapply reaching maxStacks converts instead of stacking', () => {
    const w = makeBuffSystemWorld()
    def(w, capDef())
    def(w, { id: 'test_buff.2' as BuffDefinition['id'], name: 'Stage 2' })
    w.system.apply(req({ stacks: 2 }), w.makeCtx())
    const r = w.system.apply(req({ stacks: 2 }), w.makeCtx())
    expect(r.applied).toBe(true)
    expect(r.created).toBe(true)
    const instances = w.store.all()
    expect(instances).toHaveLength(1)
    expect(instances[0]!.definitionId).toBe('test_buff.2')
    expect(instances[0]!.stacks).toBe(1)
    expect(removedReasons(w)).toEqual(['replaced'])
  })

  it('reapply below the cap does NOT convert', () => {
    const w = makeBuffSystemWorld()
    def(w, capDef())
    def(w, { id: 'test_buff.2' as BuffDefinition['id'] })
    w.system.apply(req({ stacks: 1 }), w.makeCtx())
    w.system.apply(req({ stacks: 1 }), w.makeCtx())
    expect(w.store.all()[0]!.definitionId).toBe('test_buff.1')
    expect(w.store.all()[0]!.stacks).toBe(2)
  })
})

describe('convertsAfterContinuousTurns (lifecycle lane)', () => {
  function continuousDef(turns = 2): Partial<BuffDefinition> {
    return {
      lifetime: { clock: 'holder_turns', duration: 9, scaling: 'fixed' },
      convertsToId: 'test_buff.2',
      convertsAfterContinuousTurns: turns,
    }
  }

  it('fires once at threshold: old leaves as replaced, new instance stacks=1 counters=0', () => {
    const w = makeBuffSystemWorld()
    def(w, continuousDef(2))
    def(w, { id: 'test_buff.2' as BuffDefinition['id'] })
    const i = seed(w, 'test_buff.1', { stacks: 2 })
    w.system.onHolderTurnEnd(targetA, w.makeLctx())
    expect(i.continuousTurns).toBe(1)
    expect(w.store.get(i.instanceId)).toBeDefined()
    w.system.onHolderTurnEnd(targetA, w.makeLctx())
    const remaining = w.store.all()
    expect(remaining).toHaveLength(1)
    const next = remaining[0]!
    expect(next.definitionId).toBe('test_buff.2')
    expect(next.stacks).toBe(1)
    expect(next.continuousTurns).toBe(0)
    expect(next.instanceId).not.toBe(i.instanceId)
    expect(removedReasons(w)).toEqual(['replaced'])
    // Suppressed eligibility -- conversion emits buff_applied but the
    // canonical elemental lane stays suppressed (no eligibility event).
    expect(w.sink.ofType('elemental_application_committed')).toHaveLength(0)
    expect(w.sink.ofType('buff_applied')).toHaveLength(1)
  })

  it('continuousTurns counts holder boundaries ONLY for the holder', () => {
    const w = makeBuffSystemWorld()
    def(w, continuousDef(2))
    def(w, { id: 'test_buff.2' as BuffDefinition['id'] })
    const i = seed(w, 'test_buff.1')
    w.system.onHolderTurnEnd(TEST_ENTITIES.targetB, w.makeLctx())
    expect(i.continuousTurns).toBe(0)
    w.system.onHolderTurnEnd(targetA, w.makeLctx())
    expect(i.continuousTurns).toBe(1)
  })

  it('conversion apply consumes exactly one rollChance (uniform roll contract)', () => {
    const w = makeBuffSystemWorld()
    def(w, continuousDef(1))
    def(w, { id: 'test_buff.2' as BuffDefinition['id'] })
    seed(w, 'test_buff.1')
    const before = w.rng.rolls
    w.system.onHolderTurnEnd(targetA, w.makeLctx())
    expect(w.rng.rolls - before).toBe(1)
  })
})

describe('convertsAfterContinuousSeconds (onTimePassed lane)', () => {
  it('fires at the seconds threshold', () => {
    const w = makeBuffSystemWorld()
    def(w, {
      lifetime: { clock: 'seconds', duration: 60, scaling: 'fixed' },
      convertsToId: 'test_buff.2',
      convertsAfterContinuousSeconds: 5,
    })
    def(w, { id: 'test_buff.2' as BuffDefinition['id'] })
    const i = seed(w, 'test_buff.1', { remaining: 60 })
    w.system.onTimePassed(3, w.makeLctx())
    expect(w.store.get(i.instanceId)).toBeDefined()
    expect(i.continuousSeconds).toBe(3)
    w.system.onTimePassed(3, w.makeLctx())
    const next = w.store.all()[0]!
    expect(next.definitionId).toBe('test_buff.2')
    expect(next.stacks).toBe(1)
    expect(removedReasons(w)).toEqual(['replaced'])
  })
})

function removedReasons(w: BuffSystemWorld): readonly string[] {
  return w.sink.ofType('buff_removed').map((e) => e.reason)
}
