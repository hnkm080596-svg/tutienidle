import { describe, expect, it } from 'vitest'
import type { BuffModifierPayload } from '../battle/contracts/operations'
import {
  attachModifier,
  decrementModifierLifetimes,
  removeModifiersById,
  resolveChannel,
} from './BuffModifierEngine'
import type { BuffInstance } from './BuffInstance'
import type { BuffModifier } from './BuffModifier'
import { makeBuffWorld } from './testing/BuffTestFixtures'

function mod(overrides: Partial<BuffModifier> = {}): BuffModifier {
  return {
    id: 'mod.1',
    instanceId: 'buff.b.1',
    modifierRuntimeId: 'bmr.1',
    channel: 'potency',
    operation: 'add',
    value: 1,
    reapply: 'stack',
    priority: 0,
    lifetime: { type: 'buff_lifetime' },
    ...overrides,
  }
}

function payload(overrides: Partial<BuffModifierPayload> = {}): BuffModifierPayload {
  return {
    id: 'mod.1',
    channel: 'potency',
    operation: 'add',
    value: 1,
    reapply: 'stack',
    priority: 0,
    lifetime: { type: 'buff_lifetime' },
    ...overrides,
  }
}

function instance(mods: BuffModifier[] = []): BuffInstance {
  const w = makeBuffWorld()
  return w.makeTestInstance({ modifiers: mods })
}

describe('resolveChannel -- spec sec.31 resolution math', () => {
  it('(base + Sigma add) x Pi multiply', () => {
    const mods = [
      mod({ operation: 'add', value: 2 }),
      mod({ id: 'm2', modifierRuntimeId: 'bmr.2', operation: 'add', value: 3 }),
      mod({ id: 'm3', modifierRuntimeId: 'bmr.3', operation: 'multiply', value: 2 }),
      mod({ id: 'm4', modifierRuntimeId: 'bmr.4', operation: 'multiply', value: 1.5 }),
    ]
    // (10 + 2 + 3) * 2 * 1.5 = 45
    expect(resolveChannel(mods, 'potency', 10)).toBe(45)
  })

  it("'set' wins outright -- highest priority", () => {
    const mods = [
      mod({ operation: 'add', value: 100 }),
      mod({ id: 'm2', modifierRuntimeId: 'bmr.2', operation: 'set', value: 7, priority: 1 }),
      mod({ id: 'm3', modifierRuntimeId: 'bmr.3', operation: 'set', value: 9, priority: 5 }),
    ]
    expect(resolveChannel(mods, 'potency', 10)).toBe(9)
  })

  it("'set' priority tie -> smallest authored id wins", () => {
    const mods = [
      mod({ id: 'zzz', modifierRuntimeId: 'bmr.1', operation: 'set', value: 8, priority: 3 }),
      mod({ id: 'aaa', modifierRuntimeId: 'bmr.2', operation: 'set', value: 5, priority: 3 }),
    ]
    expect(resolveChannel(mods, 'potency', 10)).toBe(5)
  })

  it('channel isolation -- other channels do not fold', () => {
    const mods = [mod({ channel: 'duration', operation: 'add', value: 99 })]
    expect(resolveChannel(mods, 'potency', 10)).toBe(10)
  })

  it('pending-marked entries are excluded (reserved for in-flight request)', () => {
    const mods = [
      mod({ operation: 'add', value: 2 }),
      mod({ id: 'm2', modifierRuntimeId: 'bmr.2', operation: 'add', value: 50, pendingRequestId: 'req.x.1' }),
    ]
    expect(resolveChannel(mods, 'potency', 10)).toBe(12)
  })
})

describe('attachModifier -- spec sec.32 reapply semantics', () => {
  it("'stack' appends a distinct entry every time", () => {
    const inst = instance()
    let n = 0
    const mint = () => `bmr.${++n}`
    attachModifier(inst, payload(), mint)
    attachModifier(inst, payload(), mint)
    expect(inst.modifiers).toHaveLength(2)
    expect(inst.modifiers[0]!.modifierRuntimeId).not.toBe(inst.modifiers[1]!.modifierRuntimeId)
  })

  it("'replace' overwrites same-id and mints a NEW runtime id", () => {
    const inst = instance()
    let n = 0
    const mint = () => `bmr.${++n}`
    const first = attachModifier(inst, payload({ reapply: 'replace', value: 1 }), mint).entry
    const second = attachModifier(inst, payload({ reapply: 'replace', value: 9 }), mint).entry
    expect(inst.modifiers).toHaveLength(1)
    expect(inst.modifiers[0]!.value).toBe(9)
    expect(second.modifierRuntimeId).not.toBe(first.modifierRuntimeId)
  })

  it("'replace' evicts the old generation", () => {
    const inst = instance()
    let n = 0
    const mint = () => `bmr.${++n}`
    attachModifier(inst, payload({ reapply: 'replace' }), mint)
    const { evicted } = attachModifier(inst, payload({ reapply: 'replace' }), mint)
    expect(evicted).toHaveLength(1)
    expect(evicted[0]!.modifierRuntimeId).toBe('bmr.1')
  })

  it("'max' keeps the larger value; 'min' keeps the smaller", () => {
    const inst = instance()
    let n = 0
    const mint = () => `bmr.${++n}`
    attachModifier(inst, payload({ reapply: 'max', value: 5 }), mint)
    attachModifier(inst, payload({ reapply: 'max', value: 3 }), mint)
    expect(inst.modifiers).toHaveLength(1)
    expect(inst.modifiers[0]!.value).toBe(5)
    attachModifier(inst, payload({ reapply: 'max', value: 9 }), mint)
    expect(inst.modifiers[0]!.value).toBe(9)

    const inst2 = instance()
    let m = 0
    const mint2 = () => `bmr.${++m}`
    attachModifier(inst2, payload({ reapply: 'min', value: 5 }), mint2)
    attachModifier(inst2, payload({ reapply: 'min', value: 8 }), mint2)
    expect(inst2.modifiers[0]!.value).toBe(5)
  })

  it('identity = id + appliedBy -- different appliedBy are different modifiers', () => {
    const inst = instance()
    let n = 0
    const mint = () => `bmr.${++n}`
    attachModifier(inst, payload({ appliedBy: 'test_entity.src.a' }), mint)
    attachModifier(inst, payload({ appliedBy: 'test_entity.src.b' }), mint)
    expect(inst.modifiers).toHaveLength(2)
  })
})

describe('removeModifiersById -- all_matching (r5 HIGH 1)', () => {
  it('removes EVERY generation carrying the authored id', () => {
    const inst = instance()
    let n = 0
    const mint = () => `bmr.${++n}`
    attachModifier(inst, payload(), mint)
    attachModifier(inst, payload(), mint) // same id, stacked generation
    attachModifier(inst, payload({ id: 'other' }), mint)
    const removed = removeModifiersById(inst, 'mod.1')
    expect(removed).toHaveLength(2)
    expect(inst.modifiers).toHaveLength(1)
    expect(inst.modifiers[0]!.id).toBe('other')
  })
})

describe('decrementModifierLifetimes -- spec sec.33-34', () => {
  it('decrements only the matching clock; expired entries are removed', () => {
    const inst = instance([
      mod({ id: 'a', modifierRuntimeId: 'bmr.1', lifetime: { type: 'holder_turns', remaining: 1 } }),
      mod({ id: 'b', modifierRuntimeId: 'bmr.2', lifetime: { type: 'holder_turns', remaining: 3 } }),
      mod({ id: 'c', modifierRuntimeId: 'bmr.3', lifetime: { type: 'source_turns', remaining: 1 } }),
      mod({ id: 'd', modifierRuntimeId: 'bmr.4', lifetime: { type: 'uses', remaining: 1 } }),
      mod({ id: 'e', modifierRuntimeId: 'bmr.5', lifetime: { type: 'buff_lifetime' } }),
    ])
    const expired = decrementModifierLifetimes(inst, 'holder_turns')
    expect(expired.map((m) => m.id)).toEqual(['a'])
    expect(inst.modifiers.map((m) => m.id)).toEqual(['b', 'c', 'd', 'e'])
    const b = inst.modifiers.find((m) => m.id === 'b')!
    expect(b.lifetime).toEqual({ type: 'holder_turns', remaining: 2 })
    // 'uses' untouched by turn decrements (consumed only via settled event)
    const d = inst.modifiers.find((m) => m.id === 'd')!
    expect(d.lifetime).toEqual({ type: 'uses', remaining: 1 })
  })
})
