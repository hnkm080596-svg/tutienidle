// BuffPeriodic.test.ts -- M3 step 1: request computation semantics.
// Requests only, never damage: coefficient folding, stack scaling,
// dynamic vs snapshot, heal requests, pending-mark behavior.

import { describe, expect, it } from 'vitest'
import type { PeriodicRequestsCommitted } from '../battle/contracts/events'
import type { BuffPeriodicDamageRequest } from '../battle/contracts/periodic'
import type { BuffModifierPayload } from '../battle/contracts/operations'
import type { BuffDefinition } from './BuffDefinition'
import type { BuffInstance } from './BuffInstance'
import type { BuffModifier } from './BuffModifier'
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

function dotDef(overrides: Partial<BuffDefinition> = {}): Partial<BuffDefinition> {
  return {
    stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
    periodic: [
      {
        id: 'dot',
        type: 'damage',
        element: 'fire',
        damageProfile: 'test_profile',
        coefficient: 2,
        scaling: 'dynamic',
        timing: 'holder_turn_end',
        stackScaling: 'multiply',
        canCrit: false,
        canMiss: false,
        hitCount: 1,
      },
    ],
    ...overrides,
  }
}

function apply(w: BuffSystemWorld, definitionId: string, stacks = 1): BuffInstance {
  w.system.apply(
    {
      definitionId: definitionId as BuffInstance['definitionId'],
      sourceId: TEST_ENTITIES.sourceA,
      targetId: TEST_ENTITIES.targetA,
      stacks,
      baseChance: 1,
      reactionEligibility: 'eligible',
      origin: {
        kind: 'skill',
        originId: 'test',
        sourceId: TEST_ENTITIES.sourceA,
        rootActionId: 'root.test.1',
      },
    },
    w.makeCtx(),
  )
  return w.store.all()[0]!
}

function lastRequests(w: BuffSystemWorld): readonly BuffPeriodicDamageRequest[] {
  const events = w.sink
    .ofType('periodic_requests_committed')
    .map((e) => e as PeriodicRequestsCommitted)
  const last = events[events.length - 1]
  return (last?.requests ?? []) as readonly BuffPeriodicDamageRequest[]
}

function modifier(overrides: Partial<BuffModifierPayload> = {}): BuffModifierPayload {
  return {
    id: 'test_mod.1',
    channel: 'next_periodic_damage',
    operation: 'multiply',
    value: 2,
    reapply: 'replace',
    priority: 0,
    lifetime: { type: 'uses', remaining: 1 },
    ...overrides,
  }
}

describe('periodic request computation', () => {
  it('3-stack DoT emits coefficient = authored x stacks', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, dotDef())
    apply(w, d.id, 3)
    const lctx = w.makeLctx()
    w.system.onHolderTurnEnd(TEST_ENTITIES.targetA, lctx)
    const reqs = lastRequests(w)
    expect(reqs).toHaveLength(1)
    expect(reqs[0]!.coefficient).toBe(6)
    expect(reqs[0]!.stackCount).toBe(3)
    expect(reqs[0]!.damageProfile).toBe('test_profile')
    expect(reqs[0]!.canCrit).toBe(false)
    expect(reqs[0]!.canMiss).toBe(false)
    expect(reqs[0]!.hitCount).toBe(1)
    expect(reqs[0]!.requestId).toMatch(/^req\.buff\.test_battle\.1\.1\.dot\.1$/)
  })

  it("stackScaling:'ignore' emits flat authored coefficient", () => {
    const w = makeBuffSystemWorld()
    const d = def(
      w,
      dotDef({
        periodic: [
          {
            id: 'dot',
            type: 'damage',
            element: 'fire',
            damageProfile: 'test_profile',
            coefficient: 2,
            scaling: 'dynamic',
            timing: 'holder_turn_end',
            stackScaling: 'ignore',
            canCrit: false,
            canMiss: false,
            hitCount: 2,
          },
        ],
      }),
    )
    apply(w, d.id, 3)
    w.system.onHolderTurnEnd(TEST_ENTITIES.targetA, w.makeLctx())
    expect(lastRequests(w)[0]!.coefficient).toBe(2)
    expect(lastRequests(w)[0]!.hitCount).toBe(2)
  })

  it('snapshot-scaled periodic forwards the apply-time snapshot verbatim', () => {
    const w = makeBuffSystemWorld()
    const d = def(
      w,
      dotDef({
        periodic: [
          {
            id: 'dot',
            type: 'damage',
            element: 'fire',
            damageProfile: 'test_profile',
            coefficient: 2,
            scaling: 'snapshot',
            snapshotFields: ['attack'],
            timing: 'holder_turn_end',
            stackScaling: 'ignore',
            canCrit: false,
            canMiss: false,
            hitCount: 1,
          },
        ],
      }),
    )
    w.snapshots.set('test_profile:' + TEST_ENTITIES.sourceA, { attack: 42 })
    apply(w, d.id)
    w.system.onHolderTurnEnd(TEST_ENTITIES.targetA, w.makeLctx())
    const req = lastRequests(w)[0]!
    expect(req.snapshot).toEqual({ attack: 42 })
  })

  it('dynamic scaling emits NO snapshot field', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, dotDef())
    apply(w, d.id)
    w.system.onHolderTurnEnd(TEST_ENTITIES.targetA, w.makeLctx())
    expect(lastRequests(w)[0]!.snapshot).toBeUndefined()
  })

  it('heal periodic emits BuffPeriodicHealRequest with stack-multiplied amount', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, {
      stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
      periodic: [
        {
          id: 'hot',
          type: 'heal',
          amount: 5,
          timing: 'holder_turn_end',
          stackScaling: 'multiply',
        },
      ],
    })
    apply(w, d.id, 2)
    w.system.onHolderTurnEnd(TEST_ENTITIES.targetA, w.makeLctx())
    const reqs = lastRequests(w)
    expect(reqs).toHaveLength(1)
    const r = reqs[0] as unknown as { amount: number; requestId: string }
    expect(r.amount).toBe(10)
    expect(r.requestId).toMatch(/\.hot\.1$/)
  })

  it('dead source + removeOnSourceDeath:false still emits the request', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, dotDef())
    apply(w, d.id)
    w.alive.delete(TEST_ENTITIES.sourceA)
    w.system.onHolderTurnEnd(TEST_ENTITIES.targetA, w.makeLctx())
    expect(lastRequests(w)).toHaveLength(1)
  })
})

describe('modifier channels + pending uses', () => {
  it("next_periodic_damage folds once into the request's coefficient", () => {
    const w = makeBuffSystemWorld()
    const d = def(w, dotDef())
    const instance = apply(w, d.id)
    instance.modifiers.push({
      ...modifier(),
      modifierRuntimeId: w.mintModifierRuntimeId(instance.instanceId),
      instanceId: instance.instanceId,
    })
    w.system.onHolderTurnEnd(TEST_ENTITIES.targetA, w.makeLctx())
    expect(lastRequests(w)[0]!.coefficient).toBe(4)
  })

  it('resolved settled event consumes the uses mark (entry removed + evented)', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, dotDef())
    const instance = apply(w, d.id)
    const entry: BuffModifier = {
      ...modifier(),
      modifierRuntimeId: w.mintModifierRuntimeId(instance.instanceId),
      instanceId: instance.instanceId,
    }
    instance.modifiers.push(entry)
    const lctx = w.makeLctx()
    w.system.onHolderTurnEnd(TEST_ENTITIES.targetA, lctx)
    const req = lastRequests(w)[0]!
    // The mark is pending until the settled event arrives.
    expect(entry.pendingRequestId).toBe(req.requestId)
    w.settlePeriodic(req.requestId, 'resolved')
    expect(instance.modifiers).toHaveLength(0)
    const removed = w.sink.ofType('buff_modifier_removed')
    expect(removed).toHaveLength(1)
    expect(removed[0]!.modifierRuntimeId).toBe(entry.modifierRuntimeId)
  })

  it('skipped settled event releases the mark -- a later tick refolds it', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, dotDef())
    const instance = apply(w, d.id)
    const entry: BuffModifier = {
      ...modifier(),
      modifierRuntimeId: w.mintModifierRuntimeId(instance.instanceId),
      instanceId: instance.instanceId,
    }
    instance.modifiers.push(entry)
    const lctx = w.makeLctx()
    w.system.onHolderTurnEnd(TEST_ENTITIES.targetA, lctx)
    const req1 = lastRequests(w)[0]!
    w.settlePeriodic(req1.requestId, 'skipped')
    expect(entry.pendingRequestId).toBeUndefined()
    expect(instance.modifiers).toHaveLength(1)
    // Next boundary refolds the same released modifier.
    w.system.onHolderTurnEnd(TEST_ENTITIES.targetA, w.makeLctx())
    const req2 = lastRequests(w)[0]!
    expect(req2.requestId).not.toBe(req1.requestId)
    expect(req2.coefficient).toBe(4)
  })
})
