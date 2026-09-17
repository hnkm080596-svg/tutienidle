import { describe, expect, it } from 'vitest'
import type { ApplyBuffRequest } from '../battle/contracts/operations'
import type { BuffDefinition } from './BuffDefinition'
import {
  makeBuffSystemWorld,
  TEST_ENTITIES,
  type BuffSystemWorld,
} from './testing/BuffTestFixtures'

function applyDef(w: BuffSystemWorld, overrides: Partial<BuffDefinition>, target = TEST_ENTITIES.targetA): void {
  const d = w.makeTestDefinition(overrides)
  w.registry.register(d)
  const req: ApplyBuffRequest = {
    definitionId: d.id,
    sourceId: TEST_ENTITIES.sourceA,
    targetId: target,
    stacks: 1,
    baseChance: 1,
    reactionEligibility: 'eligible',
    origin: {
      kind: 'skill',
      originId: 't',
      sourceId: TEST_ENTITIES.sourceA,
      rootActionId: 'r.1',
    },
  }
  w.system.apply(req, w.makeCtx())
}

describe('BuffSystem.cleanse -- spec sec.42', () => {
  it('removes only dispellable matches; non-dispellable matches land in skipped', () => {
    const w = makeBuffSystemWorld()
    applyDef(w, { id: 'test_buff.a', kind: 'debuff', dispellable: true })
    applyDef(w, { id: 'test_buff.b', kind: 'debuff', dispellable: false })
    applyDef(w, { id: 'test_buff.c', kind: 'buff', dispellable: true })

    const r = w.system.cleanse(TEST_ENTITIES.targetA, { kind: 'debuff' }, w.makeCtx())
    expect(r.cleansed).toHaveLength(1)
    expect(r.skipped).toHaveLength(1)
    const remaining = w.store.forTarget(TEST_ENTITIES.targetA)
    expect(remaining).toHaveLength(2) // b (non-dispellable) + c (kind mismatch)
    const removed = w.sink.ofType('buff_removed')
    expect(removed).toHaveLength(1)
    expect(removed[0]!.reason).toBe('cleansed')
  })

  it('query filters: element + tags + definitionId compose', () => {
    const w = makeBuffSystemWorld()
    applyDef(w, { id: 'test_buff.fire', kind: 'ailment', element: 'fire', tags: ['dot', 'fire'] })
    applyDef(w, { id: 'test_buff.water', kind: 'ailment', element: 'water', tags: ['dot'] })

    const r = w.system.cleanse(
      TEST_ENTITIES.targetA,
      { element: 'fire', tags: ['dot'] },
      w.makeCtx(),
    )
    expect(r.cleansed).toHaveLength(1)
    const remaining = w.store.forTarget(TEST_ENTITIES.targetA)
    expect(remaining.map((i) => i.definitionId)).toEqual(['test_buff.water'])

    const r2 = w.system.cleanse(TEST_ENTITIES.targetA, { definitionId: 'test_buff.water' }, w.makeCtx())
    expect(r2.cleansed).toHaveLength(1)
    expect(w.store.forTarget(TEST_ENTITIES.targetA)).toHaveLength(0)
  })

  it('tags query requires ALL listed tags on the def', () => {
    const w = makeBuffSystemWorld()
    applyDef(w, { id: 'test_buff.x', tags: ['a'] })
    applyDef(w, { id: 'test_buff.y', tags: ['a', 'b'] })
    const r = w.system.cleanse(TEST_ENTITIES.targetA, { tags: ['a', 'b'] }, w.makeCtx())
    expect(r.cleansed).toHaveLength(1)
    expect(w.store.forTarget(TEST_ENTITIES.targetA).map((i) => i.definitionId)).toEqual(['test_buff.x'])
  })

  it('targets only the named entity (ARCH-009)', () => {
    const w = makeBuffSystemWorld()
    applyDef(w, { id: 'test_buff.ta' }, TEST_ENTITIES.targetA)
    applyDef(w, { id: 'test_buff.tb' }, TEST_ENTITIES.targetB)
    const r = w.system.cleanse(TEST_ENTITIES.targetA, {}, w.makeCtx())
    expect(r.cleansed).toHaveLength(1)
    expect(w.store.forTarget(TEST_ENTITIES.targetA)).toHaveLength(0)
    expect(w.store.forTarget(TEST_ENTITIES.targetB)).toHaveLength(1)
  })

  it('non-dispellable non-matches are neither cleansed nor skipped', () => {
    const w = makeBuffSystemWorld()
    applyDef(w, { id: 'test_buff.keep', kind: 'buff', dispellable: false })
    const r = w.system.cleanse(TEST_ENTITIES.targetA, { kind: 'debuff' }, w.makeCtx())
    expect(r.cleansed).toHaveLength(0)
    expect(r.skipped).toHaveLength(0) // kind didn't match -> not counted
    expect(w.store.all()).toHaveLength(1)
  })
})
