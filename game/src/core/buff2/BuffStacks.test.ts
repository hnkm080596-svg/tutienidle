import { describe, expect, it } from 'vitest'
import type { ApplyBuffRequest } from '../battle/contracts/operations'
import type { BuffInstanceSelector } from '../battle/contracts/selectors'
import type { BuffDefinition } from './BuffDefinition'
import {
  makeBuffSystemWorld,
  TEST_ENTITIES,
  type BuffSystemWorld,
} from './testing/BuffTestFixtures'

function setup(
  overrides: Partial<BuffDefinition> = {},
  stacks = 2,
): { w: BuffSystemWorld; sel: BuffInstanceSelector; instanceId: string } {
  const w = makeBuffSystemWorld()
  const d = w.makeTestDefinition({
    stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
    ...overrides,
  })
  w.registry.register(d)
  const req: ApplyBuffRequest = {
    definitionId: d.id,
    sourceId: TEST_ENTITIES.sourceA,
    targetId: TEST_ENTITIES.targetA,
    stacks,
    baseChance: 1,
    reactionEligibility: 'eligible',
    origin: {
      kind: 'skill',
      originId: 't',
      sourceId: TEST_ENTITIES.sourceA,
      rootActionId: 'r.1',
    },
  }
  const applied = w.system.apply(req, w.makeCtx())
  return {
    w,
    sel: { kind: 'instance', instanceId: applied.instanceId! },
    instanceId: applied.instanceId!,
  }
}

describe('BuffSystem stacks mutations', () => {
  it('addStacks adds clamped to maxStacks + emits stacks_changed', () => {
    const { w, sel, instanceId } = setup()
    const r = w.system.addStacks(sel, 10, w.makeCtx())
    expect(r).toEqual({ stacksBefore: 2, stacksAfter: 5 })
    const evt = w.sink.ofType('buff_stacks_changed')[0]!
    expect(evt).toMatchObject({ instanceId, stacksBefore: 2, stacksAfter: 5, addedStacks: 3 })
  })

  it('removeStacks decrements; zero -> removed reason consumed', () => {
    const { w, sel } = setup()
    const r = w.system.removeStacks(sel, 2, w.makeCtx())
    expect(r).toEqual({ stacksBefore: 2, stacksAfter: 0 })
    const removed = w.sink.ofType('buff_removed')[0]!
    expect(removed.reason).toBe('consumed')
    expect(removed.stacksAtRemoval).toBe(0)
    expect(w.store.all()).toHaveLength(0)
  })

  it('setStacks sets absolutely clamped [0..maxStacks]', () => {
    const { w, sel } = setup()
    expect(w.system.setStacks(sel, 4, w.makeCtx())).toEqual({ stacksBefore: 2, stacksAfter: 4 })
    expect(w.system.setStacks(sel, 99, w.makeCtx())).toEqual({ stacksBefore: 4, stacksAfter: 5 })
  })

  it('setStacks to 0 removes (zero-stack rule)', () => {
    const { w, sel } = setup()
    const r = w.system.setStacks(sel, 0, w.makeCtx())
    expect(r.stacksAfter).toBe(0)
    expect(w.store.all()).toHaveLength(0)
    expect(w.sink.ofType('buff_removed')[0]!.reason).toBe('consumed')
  })

  it("consumeStacks('all','reaction') -> removed {consumed,remaining:0,removed:true}", () => {
    const { w, sel } = setup({}, 3)
    const r = w.system.consumeStacks(sel, 'all', 'reaction', w.makeCtx())
    expect(r).toEqual({ consumed: 3, remaining: 0, removed: true })
    expect(w.sink.ofType('buff_removed')[0]!.reason).toBe('reaction')
  })

  it('consumeStacks partial keeps instance alive', () => {
    const { w, sel } = setup({}, 3)
    const r = w.system.consumeStacks(sel, 1, 'consumed', w.makeCtx())
    expect(r).toEqual({ consumed: 1, remaining: 2, removed: false })
    expect(w.store.all()).toHaveLength(1)
    expect(w.store.all()[0]!.stacks).toBe(2)
  })

  it('stack mutations emit NO elemental event (contract sec.22)', () => {
    const w = makeBuffSystemWorld({
      elementalMap: new Map([['test_buff.1', 'fire']]),
    })
    const d = w.makeTestDefinition({
      element: 'fire',
      stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
    })
    w.registry.register(d)
    const applied = w.system.apply(
      {
        definitionId: d.id,
        sourceId: TEST_ENTITIES.sourceA,
        targetId: TEST_ENTITIES.targetA,
        stacks: 1,
        baseChance: 1,
        reactionEligibility: 'eligible',
        origin: { kind: 'skill', originId: 't', sourceId: TEST_ENTITIES.sourceA, rootActionId: 'r.1' },
      },
      w.makeCtx(),
    )
    w.sink.clear()
    const sel: BuffInstanceSelector = { kind: 'instance', instanceId: applied.instanceId! }
    w.system.addStacks(sel, 1, w.makeCtx())
    w.system.consumeStacks(sel, 1, 'consumed', w.makeCtx())
    expect(w.sink.ofType('elemental_application_committed')).toHaveLength(0)
  })

  it('unresolvable selector returns zero-result without throwing', () => {
    const w = makeBuffSystemWorld()
    const sel: BuffInstanceSelector = { kind: 'instance', instanceId: 'buff.test_battle.1.99' }
    expect(w.system.addStacks(sel, 1, w.makeCtx())).toEqual({ stacksBefore: 0, stacksAfter: 0 })
    expect(w.system.removeStacks(sel, 1, w.makeCtx())).toEqual({ stacksBefore: 0, stacksAfter: 0 })
    expect(w.system.consumeStacks(sel, 'all', 'consumed', w.makeCtx())).toEqual({
      consumed: 0,
      remaining: 0,
      removed: false,
    })
  })
})

describe('BuffSystem.remove / duration APIs', () => {
  it('remove() returns RemoveBuffResult with stacksAtRemoval', () => {
    const { w, sel, instanceId } = setup({}, 4)
    const r = w.system.remove(sel, 'scripted', w.makeCtx())
    expect(r).toEqual({ removed: true, instanceId, stacksAtRemoval: 4 })
    expect(w.store.get(instanceId as never)).toBeUndefined()
  })

  it('remove() on missing selector -> {removed:false}', () => {
    const w = makeBuffSystemWorld()
    const r = w.system.remove(
      { kind: 'instance', instanceId: 'buff.test_battle.1.5' },
      'scripted',
      w.makeCtx(),
    )
    expect(r.removed).toBe(false)
  })

  it('refreshDuration/extendDuration/setRemainingDuration emit duration_changed', () => {
    const { w, sel } = setup()
    const instance = w.store.all()[0]!
    instance.remaining = 1

    const r1 = w.system.refreshDuration(sel, undefined, w.makeCtx())
    expect(r1).toEqual({ durationBefore: 1, durationAfter: 3 }) // def duration

    const r2 = w.system.extendDuration(sel, 2, undefined, w.makeCtx())
    expect(r2).toEqual({ durationBefore: 3, durationAfter: 5 })

    const r3 = w.system.extendDuration(sel, 10, 6, w.makeCtx())
    expect(r3).toEqual({ durationBefore: 5, durationAfter: 6 }) // capped by maxRemaining

    const r4 = w.system.setRemainingDuration(sel, 2, w.makeCtx())
    expect(r4).toEqual({ durationBefore: 6, durationAfter: 2 })
    expect(w.sink.ofType('buff_duration_changed')).toHaveLength(4)
  })
})

describe('BuffSystem modifiers via authority surface', () => {
  it('addModifier mints + reports modifierRuntimeId; removeModifier is all_matching', () => {
    const { w, sel } = setup()
    const a = w.system.addModifier(
      sel,
      {
        id: 'sharpen',
        channel: 'potency',
        operation: 'add',
        value: 2,
        reapply: 'stack',
        priority: 0,
        lifetime: { type: 'buff_lifetime' },
      },
      w.makeCtx(),
    )
    expect(a.applied).toBe(true)
    expect(a.modifierRuntimeId).toMatch(/^bmr\./)

    w.system.addModifier(
      sel,
      {
        id: 'sharpen',
        channel: 'potency',
        operation: 'add',
        value: 3,
        reapply: 'stack',
        priority: 0,
        lifetime: { type: 'buff_lifetime' },
      },
      w.makeCtx(),
    )
    expect(w.store.all()[0]!.modifiers).toHaveLength(2)

    const r = w.system.removeModifier(sel, 'sharpen', w.makeCtx())
    expect(r.removed).toBe(true)
    expect(r.removedRuntimeIds).toHaveLength(2)
    expect(w.sink.ofType('buff_modifier_removed')).toHaveLength(2)
    expect(w.store.all()[0]!.modifiers).toHaveLength(0)
  })
})
