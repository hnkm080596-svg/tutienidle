// BuffOrdering.test.ts -- spec sec.55: every observable multi-instance
// sweep (queries, cleanse, expiry, death, battle end) emits in the
// canonical order targetId -> definitionId -> sourceId -> instanceId
// (periodicId last on periodic units). Insertion order must never leak.

import { describe, expect, it } from 'vitest'
import type { ApplyBuffRequest } from '../battle/contracts/operations'
import type { BuffDefinition } from './BuffDefinition'
import type { BuffInstance } from './BuffInstance'
import {
  makeBuffSystemWorld,
  TEST_ENTITIES,
  type BuffSystemWorld,
} from './testing/BuffTestFixtures'

const { sourceA, sourceB, targetA, targetB } = TEST_ENTITIES

function def(w: BuffSystemWorld, id: string, overrides: Partial<BuffDefinition> = {}): BuffDefinition {
  const d = w.makeTestDefinition({ id: id as BuffDefinition['id'], ...overrides })
  w.registry.register(d)
  return d
}

function seed(
  w: BuffSystemWorld,
  definitionId: string,
  overrides: Partial<BuffInstance> = {},
): BuffInstance {
  const i = w.makeTestInstance({ definitionId: definitionId as BuffInstance['definitionId'], ...overrides })
  w.store.add(i)
  return i
}

function req(overrides: Partial<ApplyBuffRequest> = {}): ApplyBuffRequest {
  return {
    definitionId: 'test_buff.1',
    sourceId: sourceA,
    targetId: targetA,
    stacks: 1,
    baseChance: 1,
    reactionEligibility: 'eligible',
    origin: { kind: 'skill', originId: 't', sourceId: sourceA, rootActionId: 'r' },
    ...overrides,
  }
}

describe('canonical sweep ordering (sec.55)', () => {
  it('expiry emits buff_removed in targetId order regardless of insertion order', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, 'test_buff.a', { lifetime: { clock: 'rounds', duration: 1, scaling: 'fixed' } })
    // Insert targetB first -- canonical order must still emit A first.
    seed(w, d.id, { targetId: targetB, remaining: 1 })
    seed(w, d.id, { targetId: targetA, remaining: 1 })
    w.system.onRoundEnd(w.makeLctx())
    const removed = w.sink.ofType('buff_removed')
    expect(removed.map((e) => e.targetId)).toEqual([targetA, targetB])
  })

  it('expiry tie-breaks by definitionId then sourceId then instanceId', () => {
    const w = makeBuffSystemWorld()
    const dB = def(w, 'test_buff.b', { lifetime: { clock: 'rounds', duration: 1, scaling: 'fixed' } })
    const dA = def(w, 'test_buff.a', { lifetime: { clock: 'rounds', duration: 1, scaling: 'fixed' } })
    // Same target -- definitionId 'test_buff.a' sorts before '.b'
    // regardless of registration order.
    seed(w, dB.id, { targetId: targetA, remaining: 1 })
    seed(w, dA.id, { targetId: targetA, sourceId: sourceB, remaining: 1 })
    seed(w, dA.id, { targetId: targetA, sourceId: sourceA, remaining: 1 })
    w.system.onRoundEnd(w.makeLctx())
    const removed = w.sink.ofType('buff_removed')
    expect(removed.map((e) => `${e.definitionId}:${e.sourceId}`)).toEqual([
      `test_buff.a:${sourceA}`,
      `test_buff.a:${sourceB}`,
      `test_buff.b:${sourceA}`,
    ])
  })

  it('cleanse removes dispellable matches in canonical order, skips non-dispellable', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, 'test_buff.a')
    const protected_ = def(w, 'test_buff.p', { dispellable: false })
    seed(w, d.id, { targetId: targetA, sourceId: sourceB })
    seed(w, d.id, { targetId: targetA, sourceId: sourceA })
    seed(w, protected_.id, { targetId: targetA })
    const r = w.system.cleanse(targetA, {}, undefined, w.makeCtx())
    expect(r.cleansed).toHaveLength(2)
    expect(r.skipped).toHaveLength(1)
    const removed = w.sink.ofType('buff_removed')
    expect(removed.map((e) => e.sourceId)).toEqual([sourceA, sourceB])
    expect(removed.every((e) => e.reason === 'cleansed')).toBe(true)
  })

  it('getForTarget returns canonical-sorted snapshots', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, 'test_buff.a')
    seed(w, d.id, { targetId: targetA, sourceId: sourceB })
    seed(w, d.id, { targetId: targetA, sourceId: sourceA })
    const list = w.query.getForTarget(targetA)
    expect(list.map((i) => i.sourceId)).toEqual([sourceA, sourceB])
  })

  it('death sweep is canonical-sorted across defs', () => {
    const w = makeBuffSystemWorld()
    const dB = def(w, 'test_buff.b')
    const dA = def(w, 'test_buff.a')
    seed(w, dB.id, { targetId: targetA })
    seed(w, dA.id, { targetId: targetA })
    w.system.onEntityDeath(targetA, w.makeLctx())
    const removed = w.sink.ofType('buff_removed')
    expect(removed.map((e) => e.definitionId)).toEqual(['test_buff.a', 'test_buff.b'])
    expect(removed.every((e) => e.reason === 'death')).toBe(true)
  })

  it('apply on a target with existing instances does not disturb canonical query order', () => {
    const w = makeBuffSystemWorld()
    const dB = def(w, 'test_buff.b')
    const dA = def(w, 'test_buff.a')
    w.system.apply(req({ definitionId: dB.id }), w.makeCtx())
    w.system.apply(req({ definitionId: dA.id }), w.makeCtx())
    const list = w.query.getForTarget(targetA)
    expect(list.map((i) => i.definitionId)).toEqual(['test_buff.a', 'test_buff.b'])
  })
})
