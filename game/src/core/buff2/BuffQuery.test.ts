import { describe, expect, it } from 'vitest'
import type { BuffInstance } from './BuffInstance'
import {
  makeBuffWorld,
  TEST_ENTITIES,
  type BuffWorld,
} from './testing/BuffTestFixtures'

/** Registers a def + adds an instance of it to the store. */
function seed(
  w: BuffWorld,
  defOverrides: Parameters<BuffWorld['makeTestDefinition']>[0],
  instOverrides: Partial<BuffInstance> = {},
) {
  const def = w.makeTestDefinition(defOverrides)
  w.registry.register(def)
  const instance = w.makeTestInstance({ definitionId: def.id, ...instOverrides })
  w.store.add(instance)
  return { def, instance }
}

describe('BuffQuery (M1 step 3 -- spec sec.51 read port)', () => {
  it('getInstance resolves all three selector kinds (spec sec.52)', () => {
    const w = makeBuffWorld()
    const { instance } = seed(w, { id: 'test_buff.sel' })

    expect(
      w.query.getInstance({ kind: 'instance', instanceId: instance.instanceId })?.instanceId,
    ).toBe(instance.instanceId)
    expect(
      w.query.getInstance({
        kind: 'identity',
        definitionId: 'test_buff.sel',
        sourceId: instance.sourceId,
        targetId: instance.targetId,
      })?.instanceId,
    ).toBe(instance.instanceId)
    expect(
      w.query.getInstance({
        kind: 'target_definition',
        targetId: instance.targetId,
        definitionId: 'test_buff.sel',
      })?.instanceId,
    ).toBe(instance.instanceId)
    expect(
      w.query.getInstance({ kind: 'instance', instanceId: 'buff.test_battle.1.99' }),
    ).toBeUndefined()
  })

  it('snapshots are DEEP-frozen copies -- mutating one cannot corrupt the store', () => {
    const w = makeBuffWorld()
    const { instance } = seed(w, { id: 'test_buff.snap' }, { stacks: 2 })
    instance.modifiers.push({
      id: 'mod.1',
      instanceId: instance.instanceId,
      modifierRuntimeId: 'bmr.1',
      channel: 'potency',
      operation: 'add',
      value: 1,
      reapply: 'max',
      priority: 0,
      lifetime: { type: 'buff_lifetime' },
    })

    const snap = w.query.getInstance({ kind: 'instance', instanceId: instance.instanceId })!
    expect(Object.isFrozen(snap)).toBe(true)
    expect(Object.isFrozen(snap.modifiers)).toBe(true)
    expect(Object.isFrozen(snap.modifiers[0])).toBe(true)
    // a fresh snapshot is a different object with equal content
    const snap2 = w.query.getInstance({ kind: 'instance', instanceId: instance.instanceId })!
    expect(snap2).not.toBe(snap)
    expect(snap2.modifiers[0]).not.toBe(instance.modifiers[0])
    // store instance still reachable + unmodified by snapshot reads
    expect(w.store.get(instance.instanceId)?.modifiers[0]?.value).toBe(1)
  })

  it('getStacks returns 0 for missing, live stacks for present', () => {
    const w = makeBuffWorld()
    const { instance } = seed(w, { id: 'test_buff.st' }, { stacks: 4 })
    expect(w.query.getStacks({ kind: 'instance', instanceId: instance.instanceId })).toBe(4)
    expect(
      w.query.getStacks({
        kind: 'target_definition',
        targetId: instance.targetId,
        definitionId: 'test_buff.st',
      }),
    ).toBe(4)
    expect(w.query.getStacks({ kind: 'instance', instanceId: 'buff.test_battle.1.42' })).toBe(0)
  })

  it('getStatModifiers projects legacy shape incl. stacks + polarity-derived sourceType (R-B5)', () => {
    const w = makeBuffWorld()
    const { instance } = seed(
      w,
      {
        id: 'test_buff.stats',
        kind: 'debuff',
        statModifiers: [
          { stat: 'might', percent: 10 },
          { stat: 'defense', flat: 5 },
        ],
      },
      { stacks: 3 },
    )

    const mods = w.query.getStatModifiers(instance.targetId)
    expect(mods).toHaveLength(2)
    expect(mods[0]).toMatchObject({
      id: `buff:test_buff.stats:${instance.sourceId}:might`,
      sourceId: instance.sourceId,
      sourceType: 'debuff',
      stat: 'might',
      percent: 10,
      stacks: 3,
    })
    expect(mods[1]).toMatchObject({ stat: 'defense', flat: 5, stacks: 3 })
  })

  it('stat projection order is the canonical comparator, not insertion order', () => {
    const w = makeBuffWorld()
    // Insert 'zzz' def first, 'aaa' def second on the same target --
    // output must still sort definitionId ascending.
    seed(w, { id: 'test_buff.zzz', statModifiers: [{ stat: 'might', flat: 1 }] })
    seed(w, { id: 'test_buff.aaa', statModifiers: [{ stat: 'might', flat: 2 }] })
    const mods = w.query.getStatModifiers(TEST_ENTITIES.targetA)
    expect(mods.map((m) => m.id)).toEqual([
      `buff:test_buff.aaa:${TEST_ENTITIES.sourceA}:might`,
      `buff:test_buff.zzz:${TEST_ENTITIES.sourceA}:might`,
    ])
  })

  it('getCapabilities returns grants in canonical order regardless of insertion history (r4 HIGH 2)', () => {
    const grantsFor = (order: string[]) => {
      const w = makeBuffWorld()
      w.capabilityValidators.register('on_hit_proc', () => {})
      for (const [i, id] of order.entries()) {
        seed(
          w,
          {
            id: `test_buff.${id}`,
            capabilities: [{ id: `cap.${id}`, type: 'on_hit_proc', payload: {} }],
          },
          // different sources per instance so sourceId also participates
          { sourceId: `test_entity.src.${i}` },
        )
      }
      return w.query.getCapabilities(TEST_ENTITIES.targetA)
    }

    const forward = grantsFor(['aaa', 'bbb', 'ccc'])
    const reverse = grantsFor(['ccc', 'bbb', 'aaa'])

    const key = (g: { definitionId: string; capability: { id: string } }) =>
      `${g.definitionId}/${g.capability.id}`
    expect(forward.map(key)).toEqual(reverse.map(key))
    expect(forward.map(key)).toEqual([
      'test_buff.aaa/cap.aaa',
      'test_buff.bbb/cap.bbb',
      'test_buff.ccc/cap.ccc',
    ])
  })

  it('hasControl matches controls[] on the TARGET only (ARCH-009)', () => {
    const w = makeBuffWorld()
    seed(w, { id: 'test_buff.stun', controls: [{ type: 'stun' }] }, {
      targetId: TEST_ENTITIES.targetA,
    })
    seed(w, { id: 'test_buff.root', controls: [{ type: 'root' }] }, {
      targetId: TEST_ENTITIES.targetB,
    })

    expect(w.query.hasControl(TEST_ENTITIES.targetA, 'stun')).toBe(true)
    expect(w.query.hasControl(TEST_ENTITIES.targetA, 'root')).toBe(false)
    expect(w.query.hasControl(TEST_ENTITIES.targetB, 'root')).toBe(true)
    expect(w.query.hasControl(TEST_ENTITIES.targetB, 'stun')).toBe(false)
    expect(w.query.hasControl('test_entity.nobody', 'stun')).toBe(false)
  })

  it('hasForbiddenTags resolves forbiddenActionTags across the entity\'s instances', () => {
    const w = makeBuffWorld()
    seed(
      w,
      { id: 'test_buff.silence', forbiddenActionTags: ['cast', 'channeled'] },
      { targetId: TEST_ENTITIES.targetA },
    )
    seed(
      w,
      { id: 'test_buff.disarm', forbiddenActionTags: ['attack'] },
      { targetId: TEST_ENTITIES.targetA },
    )

    const tags = w.query.hasForbiddenTags(TEST_ENTITIES.targetA)
    expect([...tags].sort()).toEqual(['attack', 'cast', 'channeled'])
    expect(w.query.hasForbiddenTags(TEST_ENTITIES.targetB).size).toBe(0)
  })

  it('has() resolves via selector; getForTarget/getForSource/getByDefinition filter', () => {
    const w = makeBuffWorld()
    const a = seed(w, { id: 'test_buff.a' }, { targetId: TEST_ENTITIES.targetA })
    seed(w, { id: 'test_buff.b' }, { targetId: TEST_ENTITIES.targetB })
    seed(w, { id: 'test_buff.a2' }, {
      targetId: TEST_ENTITIES.targetA,
      sourceId: TEST_ENTITIES.sourceB,
      definitionId: 'test_buff.a2',
    })

    expect(w.query.has({ kind: 'instance', instanceId: a.instance.instanceId })).toBe(true)
    expect(w.query.has({ kind: 'instance', instanceId: 'buff.test_battle.1.77' })).toBe(false)
    expect(w.query.getForTarget(TEST_ENTITIES.targetA)).toHaveLength(2)
    expect(w.query.getForSource(TEST_ENTITIES.sourceB)).toHaveLength(1)
    expect(
      w.query.getByDefinition(TEST_ENTITIES.targetA, 'test_buff.a2'),
    ).toHaveLength(1)
    expect(
      w.query.getByDefinition(TEST_ENTITIES.targetB, 'test_buff.a2'),
    ).toHaveLength(0)
  })

  it('getModifiers returns frozen copies', () => {
    const w = makeBuffWorld()
    const { instance } = seed(w, { id: 'test_buff.mods' })
    instance.modifiers.push({
      id: 'mod.x',
      instanceId: instance.instanceId,
      modifierRuntimeId: 'bmr.x',
      channel: 'duration',
      operation: 'multiply',
      value: 2,
      reapply: 'replace',
      priority: 1,
      lifetime: { type: 'uses', remaining: 1 },
    })

    const mods = w.query.getModifiers({ kind: 'instance', instanceId: instance.instanceId })
    expect(mods).toHaveLength(1)
    expect(Object.isFrozen(mods[0])).toBe(true)
    expect(mods[0]).not.toBe(instance.modifiers[0])
    expect(
      w.query.getModifiers({ kind: 'instance', instanceId: 'buff.test_battle.1.9' }),
    ).toEqual([])
  })
})
