// BuffPersistence.test.ts -- M3 step 3: standalone pool mode. No
// scheduler: local ctx/lctx synthesis, `buff.persistent.${ownerId}.${n}`
// ids, exactly-one-roll parity, periodic defs rejected at construction,
// onTimePassed as the only ticking clock.

import { describe, expect, it } from 'vitest'
import type { ApplyBuffRequest } from '../battle/contracts/operations'
import type { BuffDefinition } from './BuffDefinition'
import { BuffPersistence } from './BuffPersistence'
import {
  makeBuffSystemWorld,
  makeTestRng,
  makeCollectingSink,
  TEST_ENTITIES,
  type BuffSystemWorld,
} from './testing/BuffTestFixtures'

const { sourceA, targetA } = TEST_ENTITIES
const OWNER = 'test_player.1'

function makePool(w: BuffSystemWorld, rng = makeTestRng()): {
  pool: BuffPersistence
  sink: ReturnType<typeof makeCollectingSink>
  rng: ReturnType<typeof makeTestRng>
} {
  const sink = makeCollectingSink()
  return {
    pool: new BuffPersistence({
      ownerId: OWNER,
      registry: w.registry,
      stats: { getStats: (id) => w.stats.get(id) },
      entities: { isAlive: (id) => w.alive.has(id) },
      snapshots: {
        capture: () => ({}),
      },
      elemental: {
        getDefinitionId: () => undefined as never,
        getElement: () => null,
      },
      rng,
      sink,
    }),
    sink,
    rng,
  }
}

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
    origin: { kind: 'scripted', originId: 'x', sourceId: sourceA, rootActionId: 'x' },
    ...overrides,
  }
}

describe('BuffPersistence -- standalone pool mode', () => {
  it('apply works with NO scheduler; instanceId mints buff.persistent.<owner>.<n>', () => {
    const w = makeBuffSystemWorld()
    const d = def(w)
    const { pool } = makePool(w)
    const r = pool.apply(req({ definitionId: d.id }))
    expect(r.applied).toBe(true)
    expect(r.instanceId).toMatch(/^buff\.persistent\.test_player\.1\.1$/)
  })

  it('exactly one rollChance per apply -- stream parity with battle mode', () => {
    const w = makeBuffSystemWorld()
    const d = def(w)
    const rng = makeTestRng()
    const { pool } = makePool(w, rng)
    pool.apply(req({ definitionId: d.id }))
    expect(rng.rolls).toBe(1)
  })

  it('query + getStatModifiers read through the wrapped system', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, {
      statModifiers: [{ stat: 'attack' as never, percent: 10 }],
    })
    const { pool } = makePool(w)
    pool.apply(req({ definitionId: d.id }))
    const instances = pool.query.getForTarget(targetA)
    expect(instances).toHaveLength(1)
    expect(instances[0]!.definitionId).toBe(d.id)
    expect(pool.getStatModifiers(targetA).length).toBeGreaterThan(0)
  })

  it('remove works; reason reaches the emitted event', () => {
    const w = makeBuffSystemWorld()
    const d = def(w)
    const { pool, sink } = makePool(w)
    pool.apply(req({ definitionId: d.id }))
    const instanceId = pool.query.getForTarget(targetA)[0]!.instanceId
    const r = pool.remove({ kind: 'instance', instanceId }, 'scripted')
    expect(r.removed).toBe(true)
    expect(sink.ofType('buff_removed')[0]!.reason).toBe('scripted')
  })

  it('onTimePassed decrements seconds clocks and expires at 0', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, { lifetime: { clock: 'seconds', duration: 5, scaling: 'fixed' } })
    const { pool } = makePool(w)
    pool.apply(req({ definitionId: d.id }))
    const instance = pool.query.getForTarget(targetA)[0]!
    pool.onTimePassed(2)
    expect(pool.query.getInstance({ kind: 'instance', instanceId: instance.instanceId })!.remaining).toBe(3)
    pool.onTimePassed(3)
    expect(pool.query.getForTarget(targetA)).toHaveLength(0)
  })

  it('a registry containing a periodic def is rejected at construction', () => {
    const w = makeBuffSystemWorld()
    def(w, {
      periodic: [
        {
          id: 'dot',
          type: 'damage',
          element: 'fire',
          damageProfile: 'test_profile',
          coefficient: 1,
          scaling: 'dynamic',
          timing: 'holder_turn_end',
          stackScaling: 'ignore',
          canCrit: false,
          canMiss: false,
          hitCount: 1,
        },
      ],
    })
    expect(() => makePool(w)).toThrow(/periodic/)
  })

  it('emitted events reach the injected sink (rootActionId persistent)', () => {
    const w = makeBuffSystemWorld()
    const d = def(w)
    const { pool, sink } = makePool(w)
    pool.apply(req({ definitionId: d.id }))
    const applied = sink.ofType('buff_applied')
    expect(applied).toHaveLength(1)
    expect(applied[0]!.rootActionId).toBe('persistent')
  })
})
