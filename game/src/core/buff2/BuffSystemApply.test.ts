import { describe, expect, it } from 'vitest'
import type { ApplyBuffRequest } from '../battle/contracts/operations'
import type { BuffDefinition } from './BuffDefinition'
import {
  makeBuffSystemWorld,
  TEST_ENTITIES,
  type BuffSystemWorld,
} from './testing/BuffTestFixtures'

function def(w: BuffSystemWorld, overrides: Partial<BuffDefinition> = {}): BuffDefinition {
  const d = w.makeTestDefinition(overrides)
  w.registry.register(d)
  return d
}

function req(overrides: Partial<ApplyBuffRequest> = {}): ApplyBuffRequest {
  return {
    definitionId: 'test_buff.1',
    sourceId: TEST_ENTITIES.sourceA,
    targetId: TEST_ENTITIES.targetA,
    stacks: 1,
    baseChance: 1,
    reactionEligibility: 'eligible',
    origin: {
      kind: 'skill',
      originId: 'test',
      sourceId: TEST_ENTITIES.sourceA,
      rootActionId: 'root.test.1',
    },
    ...overrides,
  }
}

describe('BuffSystem.apply -- new instance', () => {
  it('creates an instance with resolved duration + stacks clamped to maxStacks', () => {
    const w = makeBuffSystemWorld()
    def(w, { stacking: { maxStacks: 3, onReapplyStacks: 'add', onReapplyDuration: 'refresh' } })
    const result = w.system.apply(req({ stacks: 5 }), w.makeCtx())
    expect(result.applied).toBe(true)
    expect(result.created).toBe(true)
    const instance = w.store.get(result.instanceId!)!
    expect(instance.stacks).toBe(3)
    expect(instance.remaining).toBe(3) // def lifetime.duration
    expect(instance.createdSequence).toBeGreaterThan(0)
    expect(result.addedStacks).toBe(3)
    expect(result.overflowStacks).toBe(2)
    expect(w.sink.ofType('buff_applied')).toHaveLength(1)
    expect(w.sink.ofType('buff_applied')[0]!.created).toBe(true)
  })

  it('failed roll mutates nothing and emits only buff_application_failed', () => {
    const w = makeBuffSystemWorld()
    def(w)
    w.rng.queue(0.6) // 0.6 >= baseChance 0.5 -> fail
    const r = w.system.apply(req({ baseChance: 0.5 }), w.makeCtx())
    expect(r.applied).toBe(false)
    expect(w.store.all()).toHaveLength(0)
    const failed = w.sink.ofType('buff_application_failed')
    expect(failed).toHaveLength(1)
    expect(failed[0]!.reason).toBe('application_roll_failed')
    expect(w.sink.events).toHaveLength(1)
  })
})

describe('BuffSystem.apply -- reapply axes (9 combos)', () => {
  const cases: Array<{
    stacksAxis: 'add' | 'replace' | 'keep'
    durationAxis: 'refresh' | 'keep' | 'extend'
    expectStacks: number
    expectRemaining: number
  }> = [
    { stacksAxis: 'add', durationAxis: 'refresh', expectStacks: 3, expectRemaining: 3 },
    { stacksAxis: 'add', durationAxis: 'keep', expectStacks: 3, expectRemaining: 1 },
    { stacksAxis: 'add', durationAxis: 'extend', expectStacks: 3, expectRemaining: 4 },
    { stacksAxis: 'replace', durationAxis: 'refresh', expectStacks: 1, expectRemaining: 3 },
    { stacksAxis: 'replace', durationAxis: 'keep', expectStacks: 1, expectRemaining: 1 },
    { stacksAxis: 'replace', durationAxis: 'extend', expectStacks: 1, expectRemaining: 4 },
    { stacksAxis: 'keep', durationAxis: 'refresh', expectStacks: 2, expectRemaining: 3 },
    { stacksAxis: 'keep', durationAxis: 'keep', expectStacks: 2, expectRemaining: 1 },
    { stacksAxis: 'keep', durationAxis: 'extend', expectStacks: 2, expectRemaining: 4 },
  ]

  it.each(cases)(
    'stacks:$stacksAxis + duration:$durationAxis -> stacks=$expectStacks remaining=$expectRemaining',
    ({ stacksAxis, durationAxis, expectStacks, expectRemaining }) => {
      const w = makeBuffSystemWorld()
      def(w, {
        stacking: {
          maxStacks: 9,
          onReapplyStacks: stacksAxis,
          onReapplyDuration: durationAxis,
        },
      })
      const first = w.system.apply(req({ stacks: 2 }), w.makeCtx())
      const instance = w.store.get(first.instanceId!)!
      instance.remaining = 1 // simulate elapsed time
      const second = w.system.apply(req({ stacks: 1 }), w.makeCtx())
      expect(second.instanceId).toBe(first.instanceId)
      expect(second.created).toBe(false)
      expect(instance.stacks).toBe(expectStacks)
      expect(instance.remaining).toBe(expectRemaining)
    },
  )

  it('at-cap add -> addedStacks:0, overflowStacks counted, duration still refreshed', () => {
    const w = makeBuffSystemWorld()
    def(w, {
      stacking: { maxStacks: 2, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
    })
    w.system.apply(req({ stacks: 2 }), w.makeCtx())
    const instance = w.store.all()[0]!
    instance.remaining = 1
    const r = w.system.apply(req({ stacks: 2 }), w.makeCtx())
    expect(r.addedStacks).toBe(0)
    expect(r.overflowStacks).toBe(2)
    expect(instance.stacks).toBe(2)
    expect(instance.remaining).toBe(3) // refreshed
  })

  it("per_target + sourceOwnership:'latest' keeps instanceId, transfers sourceId", () => {
    const w = makeBuffSystemWorld()
    def(w, {
      instanceScope: 'per_target',
      sourceOwnership: 'latest',
      stacking: { maxStacks: 5, onReapplyStacks: 'replace', onReapplyDuration: 'refresh' },
    })
    const first = w.system.apply(req(), w.makeCtx())
    const second = w.system.apply(req({ sourceId: TEST_ENTITIES.sourceB }), w.makeCtx())
    expect(second.instanceId).toBe(first.instanceId)
    const instance = w.store.get(first.instanceId!)!
    expect(instance.sourceId).toBe(TEST_ENTITIES.sourceB)
    // source index follows the transfer
    expect(w.store.fromSource(TEST_ENTITIES.sourceA)).toHaveLength(0)
    expect(w.store.fromSource(TEST_ENTITIES.sourceB)).toHaveLength(1)
  })

  it('replaceInstanceOnReapply mints a new instanceId + emits replaced removal', () => {
    const w = makeBuffSystemWorld()
    def(w, {
      stacking: {
        maxStacks: 5,
        onReapplyStacks: 'replace',
        onReapplyDuration: 'refresh',
        replaceInstanceOnReapply: true,
      },
    })
    const first = w.system.apply(req(), w.makeCtx())
    const second = w.system.apply(req(), w.makeCtx())
    expect(second.instanceId).not.toBe(first.instanceId)
    expect(w.store.get(first.instanceId!)).toBeUndefined()
    const removed = w.sink.ofType('buff_removed')
    expect(removed).toHaveLength(1)
    expect(removed[0]!.reason).toBe('replaced')
  })

  it('clearsCcOnApply strips control instances first (reason cleansed)', () => {
    const w = makeBuffSystemWorld()
    def(w, { id: 'test_buff.stun', controls: [{ type: 'stun' }] })
    def(w, { id: 'test_buff.cleanse', clearsCcOnApply: true })
    w.system.apply(req({ definitionId: 'test_buff.stun' }), w.makeCtx())
    expect(w.store.all()).toHaveLength(1)
    w.system.apply(req({ definitionId: 'test_buff.cleanse' }), w.makeCtx())
    const removed = w.sink.ofType('buff_removed')
    expect(removed).toHaveLength(1)
    expect(removed[0]!.reason).toBe('cleansed')
    expect(w.store.all()).toHaveLength(1)
    expect(w.store.all()[0]!.definitionId).toBe('test_buff.cleanse')
  })
})

describe('BuffSystem.apply -- canonical elemental gate (review HIGH)', () => {
  it('canonical def + addedStacks>0 emits ElementalApplicationCommitted FIRST', () => {
    const w = makeBuffSystemWorld({
      elementalMap: new Map([['test_buff.1', 'fire']]),
    })
    def(w, { element: 'fire' })
    w.system.apply(req(), w.makeCtx())
    const types = w.sink.events.map((e) => e.type)
    expect(types[0]).toBe('elemental_application_committed')
    const committed = w.sink.ofType('elemental_application_committed')[0]!
    expect(committed.element).toBe('fire')
    expect(committed.reactionEligibility).toBe('eligible')
    expect(committed.addedStacks).toBe(1)
  })

  it('element-tagged NON-canonical def emits nothing (registry is the gate)', () => {
    const w = makeBuffSystemWorld() // empty elementalMap -> getElement -> null
    def(w, { element: 'fire' })
    w.system.apply(req(), w.makeCtx())
    expect(w.sink.ofType('elemental_application_committed')).toHaveLength(0)
    expect(w.sink.ofType('buff_applied')).toHaveLength(1)
  })

  it('cap refresh (addedStacks:0) emits no elemental event', () => {
    const w = makeBuffSystemWorld({
      elementalMap: new Map([['test_buff.1', 'fire']]),
    })
    def(w, {
      element: 'fire',
      stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
    })
    w.system.apply(req(), w.makeCtx())
    w.sink.clear()
    w.system.apply(req(), w.makeCtx())
    expect(w.sink.ofType('elemental_application_committed')).toHaveLength(0)
    expect(w.sink.ofType('buff_applied')).toHaveLength(1)
  })

  it('suppressed eligibility rides the emitted event', () => {
    const w = makeBuffSystemWorld({
      elementalMap: new Map([['test_buff.1', 'fire']]),
    })
    def(w, { element: 'fire' })
    w.system.apply(req({ reactionEligibility: 'suppressed' }), w.makeCtx())
    expect(w.sink.ofType('elemental_application_committed')[0]!.reactionEligibility).toBe('suppressed')
  })
})

describe('BuffSystem.apply -- convertsAtStackCap (R-B7)', () => {
  it('add-axis reaching maxStacks converts instead: old removed, convertsToId applied suppressed', () => {
    const w = makeBuffSystemWorld()
    def(w, {
      id: 'test_buff.hoa_an',
      element: 'fire',
      convertsToId: 'test_buff.bung_no',
      convertsAtStackCap: true,
      stacking: { maxStacks: 2, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
    })
    def(w, { id: 'test_buff.bung_no' })
    w.registry.seal()

    w.system.apply(req({ definitionId: 'test_buff.hoa_an' }), w.makeCtx()) // stacks 1
    const r = w.system.apply(req({ definitionId: 'test_buff.hoa_an' }), w.makeCtx()) // would reach 2 -> convert

    const removed = w.sink.ofType('buff_removed')
    expect(removed).toHaveLength(1)
    expect(removed[0]!.reason).toBe('replaced')

    const instances = w.store.all()
    expect(instances).toHaveLength(1)
    expect(instances[0]!.definitionId).toBe('test_buff.bung_no')
    expect(instances[0]!.stacks).toBe(1)
    expect(r.applied).toBe(true)
    expect(r.created).toBe(true)
  })

  it('no convertsAtStackCap -> reaching cap just clamps', () => {
    const w = makeBuffSystemWorld()
    def(w, {
      stacking: { maxStacks: 2, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
    })
    w.system.apply(req({ stacks: 2 }), w.makeCtx())
    w.system.apply(req(), w.makeCtx())
    expect(w.store.all()).toHaveLength(1)
    expect(w.store.all()[0]!.stacks).toBe(2)
  })
})

describe('BuffSystem.apply -- snapshot recapture (R-B9/BLOCKER 4)', () => {
  it('every successful apply recaptures snapshot AFTER source-ownership resolution', () => {
    const w = makeBuffSystemWorld()
    def(w, {
      id: 'test_buff.snap',
      instanceScope: 'per_target',
      sourceOwnership: 'latest',
      stacking: { maxStacks: 3, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
      periodic: [
        {
          id: 'tick',
          type: 'damage',
          element: 'fire',
          damageProfile: 'test_profile',
          coefficient: 1,
          scaling: 'snapshot',
          snapshotFields: ['attack'],
          timing: 'holder_turn_end',
          stackScaling: 'multiply',
          canCrit: false,
          canMiss: false,
          hitCount: 1,
        },
      ],
    })
    w.snapshots.set('test_profile:' + TEST_ENTITIES.sourceA, { attack: 100 })
    w.system.apply(req({ definitionId: 'test_buff.snap' }), w.makeCtx())
    let instance = w.store.all()[0]!
    expect(instance.snapshots!['tick']).toEqual({ attack: 100 })

    // Reapply from sourceB -> sourceId transfers THEN snapshot recaptures
    w.snapshots.set('test_profile:' + TEST_ENTITIES.sourceB, { attack: 777 })
    w.system.apply(req({ definitionId: 'test_buff.snap', sourceId: TEST_ENTITIES.sourceB }), w.makeCtx())
    instance = w.store.all()[0]!
    expect(instance.sourceId).toBe(TEST_ENTITIES.sourceB)
    expect(instance.snapshots!['tick']).toEqual({ attack: 777 })
  })
})
