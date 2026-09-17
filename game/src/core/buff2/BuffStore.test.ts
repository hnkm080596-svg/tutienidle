import { describe, expect, it } from 'vitest'
import { makeBuffWorld, TEST_ENTITIES } from './testing/BuffTestFixtures'

describe('BuffStore (M1 step 1)', () => {
  it('keys instances by instanceId; get/remove hit the same instance', () => {
    const w = makeBuffWorld()
    const a = w.makeTestInstance({ targetId: TEST_ENTITIES.targetA })
    const b = w.makeTestInstance({ targetId: TEST_ENTITIES.targetB })
    w.store.add(a)
    w.store.add(b)

    expect(w.store.get(a.instanceId)).toBe(a)
    expect(w.store.get(b.instanceId)).toBe(b)
    expect(w.store.get('buff.test_battle.1.999')).toBeUndefined()
  })

  it('duplicate instanceId throws -- never a silent overwrite', () => {
    const w = makeBuffWorld()
    const a = w.makeTestInstance()
    w.store.add(a)
    expect(() => w.store.add({ ...a })).toThrow(/duplicate instanceId/)
  })

  it('forTarget/fromSource/byDefinition index filters', () => {
    const w = makeBuffWorld()
    const a = w.makeTestInstance({
      targetId: TEST_ENTITIES.targetA,
      sourceId: TEST_ENTITIES.sourceA,
      definitionId: 'test_buff.alpha',
    })
    const b = w.makeTestInstance({
      targetId: TEST_ENTITIES.targetA,
      sourceId: TEST_ENTITIES.sourceB,
      definitionId: 'test_buff.beta',
    })
    const c = w.makeTestInstance({
      targetId: TEST_ENTITIES.targetB,
      sourceId: TEST_ENTITIES.sourceA,
      definitionId: 'test_buff.alpha',
    })
    w.store.add(a)
    w.store.add(b)
    w.store.add(c)

    expect(w.store.forTarget(TEST_ENTITIES.targetA)).toEqual([a, b])
    expect(w.store.forTarget(TEST_ENTITIES.targetB)).toEqual([c])
    expect(w.store.fromSource(TEST_ENTITIES.sourceA)).toEqual([a, c])
    expect(w.store.fromSource(TEST_ENTITIES.sourceB)).toEqual([b])
    expect(w.store.byDefinition('test_buff.alpha')).toEqual([a, c])
    expect(w.store.byDefinition('test_buff.beta')).toEqual([b])
    expect(w.store.byDefinition('test_buff.gone')).toEqual([])
  })

  it('find resolves the per_source key (def+source+target); findOnTarget ignores source', () => {
    const w = makeBuffWorld()
    const a = w.makeTestInstance({
      definitionId: 'test_buff.same',
      sourceId: TEST_ENTITIES.sourceA,
      targetId: TEST_ENTITIES.targetA,
    })
    // Same def, same target, DIFFERENT source -- a second per_source row
    // that findOnTarget would also see.
    const b = w.makeTestInstance({
      definitionId: 'test_buff.same',
      sourceId: TEST_ENTITIES.sourceB,
      targetId: TEST_ENTITIES.targetA,
    })
    w.store.add(a)
    w.store.add(b)

    expect(
      w.store.find('test_buff.same', TEST_ENTITIES.sourceA, TEST_ENTITIES.targetA),
    ).toBe(a)
    expect(
      w.store.find('test_buff.same', TEST_ENTITIES.sourceB, TEST_ENTITIES.targetA),
    ).toBe(b)
    expect(
      w.store.find('test_buff.same', TEST_ENTITIES.sourceA, TEST_ENTITIES.targetB),
    ).toBeUndefined()
    // per_target key resolves whichever source owns the instance
    const onTarget = w.store.findOnTarget('test_buff.same', TEST_ENTITIES.targetA)
    expect(onTarget === a || onTarget === b).toBe(true)
    expect(w.store.findOnTarget('test_buff.missing', TEST_ENTITIES.targetA)).toBeUndefined()
  })

  it('remove returns the removed instance (events need stacks-at-removal) and drops every index', () => {
    const w = makeBuffWorld()
    const a = w.makeTestInstance({ stacks: 4, definitionId: 'test_buff.x' })
    w.store.add(a)

    const removed = w.store.remove(a.instanceId)
    expect(removed).toBe(a)
    expect(removed?.stacks).toBe(4)
    expect(w.store.get(a.instanceId)).toBeUndefined()
    expect(w.store.forTarget(a.targetId)).toEqual([])
    expect(w.store.fromSource(a.sourceId)).toEqual([])
    expect(w.store.byDefinition('test_buff.x')).toEqual([])
    // idempotent second remove
    expect(w.store.remove(a.instanceId)).toBeUndefined()
  })

  it('indexes stay consistent when one of several same-key instances is removed', () => {
    const w = makeBuffWorld()
    const a = w.makeTestInstance({ targetId: TEST_ENTITIES.targetA })
    const b = w.makeTestInstance({ targetId: TEST_ENTITIES.targetA })
    w.store.add(a)
    w.store.add(b)

    w.store.remove(a.instanceId)
    expect(w.store.forTarget(TEST_ENTITIES.targetA)).toEqual([b])
    // removing the last instance drops the index bucket entirely
    w.store.remove(b.instanceId)
    expect(w.store.forTarget(TEST_ENTITIES.targetA)).toEqual([])
  })

  it('nextInstanceId mints through the injected battleId-scoped counter (R-B1)', () => {
    const w = makeBuffWorld({ battleId: 'test_battle.9' })
    expect(w.store.nextInstanceId()).toBe('buff.test_battle.9.1')
    expect(w.store.nextInstanceId()).toBe('buff.test_battle.9.2')
  })

  it('all() returns every instance in insertion order (sweeps sort externally)', () => {
    const w = makeBuffWorld()
    const a = w.makeTestInstance()
    const b = w.makeTestInstance()
    w.store.add(a)
    w.store.add(b)
    expect(w.store.all()).toEqual([a, b])
  })
})
