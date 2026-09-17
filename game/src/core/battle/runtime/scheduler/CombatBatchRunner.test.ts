import { describe, expect, it } from 'vitest'

import type { CombatOperationOrigin } from '../../contracts/origin'
import type { ResolvedCombatOperation } from '../../contracts/operations'
import type {
  CombatOperationBatch,
  DeferredOperation,
} from '../../contracts/settlement'

import {
  BatchResultStore,
  CombatOperationBatchRunner,
  isDeferredOperation,
  type PreconditionChecker,
} from './CombatOperationBatchRunner'
import { CombatSettlementFault } from './CombatSettlementFault'

const ORIGIN: CombatOperationOrigin = {
  kind: 'reaction',
  originId: 'dung_kim',
  sourceId: 'entity.a',
  rootActionId: 'action.turn.3.cast.1',
  causationEventId: 'evt.op.9.0',
}

function damageOp(operationId: string): ResolvedCombatOperation {
  return {
    operationId,
    type: 'deal_damage',
    origin: ORIGIN,
    payload: {
      targetId: 'entity.b',
      damageProfile: 'reaction_standard',
      coefficient: 1,
      hitCount: 1,
      canCrit: false,
      canMiss: false,
    },
  }
}

function healOp(operationId: string): ResolvedCombatOperation {
  return {
    operationId,
    type: 'heal',
    origin: ORIGIN,
    payload: { targetId: 'entity.a', amount: 3 },
  }
}

function deferred(
  operationId: string,
  resultOperationId: string,
  healTarget: 'source' | 'target' = 'source',
): DeferredOperation {
  return {
    kind: 'heal_from_damage_result',
    operationId,
    resultOperationId,
    healTarget,
    fraction: 0.5,
    origin: ORIGIN,
  }
}

function batch(
  operations: CombatOperationBatch['operations'],
  preconditions: CombatOperationBatch['preconditions'] = [],
): CombatOperationBatch {
  return { batchId: 'b.1', origin: ORIGIN, preconditions, operations }
}

const noopChecker: PreconditionChecker = { isAlive: () => true }

describe('isDeferredOperation', () => {
  it('distinguishes deferred entries from resolved ops', () => {
    expect(isDeferredOperation(damageOp('op.1'))).toBe(false)
    expect(isDeferredOperation(deferred('op.h', 'op.1'))).toBe(true)
  })
})

describe('preflight (sec.40-42)', () => {
  it('empty preconditions pass', () => {
    const runner = new CombatOperationBatchRunner(noopChecker)
    expect(runner.preflight(batch([damageOp('op.1')]))).toBe(true)
  })

  it('entity_alive passes only while the checker reports alive', () => {
    const runner = new CombatOperationBatchRunner({
      isAlive: (id) => id !== 'entity.dead',
    })
    const dead = batch([damageOp('op.1')], [
      { kind: 'entity_alive', entityId: 'entity.dead' },
    ])
    expect(runner.preflight(dead)).toBe(false)
    const ok = batch([damageOp('op.1')], [
      { kind: 'entity_alive', entityId: 'entity.a' },
    ])
    expect(runner.preflight(ok)).toBe(true)
  })

  it('buff_participant requires an exact source/target/stacks match', () => {
    const runner = new CombatOperationBatchRunner({
      isAlive: () => true,
      getBuffInstance: (id) =>
        id === 'bi.1'
          ? { sourceId: 'entity.a', targetId: 'entity.b', stacks: 3 }
          : undefined,
    })
    const base = {
      kind: 'buff_participant' as const,
      instanceId: 'bi.1',
      expectedSourceId: 'entity.a',
      expectedTargetId: 'entity.b',
      expectedStacks: 3,
    }
    const ops = [damageOp('op.1')]

    expect(runner.preflight(batch(ops, [base]))).toBe(true)
    expect(
      runner.preflight(batch(ops, [{ ...base, expectedSourceId: 'entity.x' }])),
    ).toBe(false)
    expect(
      runner.preflight(batch(ops, [{ ...base, expectedTargetId: 'entity.x' }])),
    ).toBe(false)
    expect(
      runner.preflight(batch(ops, [{ ...base, expectedStacks: 2 }])),
    ).toBe(false)
    // Missing instance -> stale.
    expect(
      runner.preflight(batch(ops, [{ ...base, instanceId: 'bi.gone' }])),
    ).toBe(false)
  })

  it('buff_participant with no getBuffInstance port fails (unverifiable = stale)', () => {
    const runner = new CombatOperationBatchRunner(noopChecker)
    const b = batch([damageOp('op.1')], [
      {
        kind: 'buff_participant',
        instanceId: 'bi.1',
        expectedSourceId: 'entity.a',
        expectedTargetId: 'entity.b',
        expectedStacks: 1,
      },
    ])
    expect(runner.preflight(b)).toBe(false)
  })
})

describe('validateBatchStructure (r4 BLOCKER 3)', () => {
  const runner = new CombatOperationBatchRunner(noopChecker)

  it('accepts a well-formed batch', () => {
    expect(() =>
      runner.validateBatchStructure(
        batch([damageOp('op.1'), deferred('op.h', 'op.1')]),
      ),
    ).not.toThrow()
  })

  it('rejects duplicate in-batch ids', () => {
    expect(() =>
      runner.validateBatchStructure(batch([damageOp('op.1'), healOp('op.1')])),
    ).toThrow(CombatSettlementFault)
  })

  it('rejects a deferred ref to a nonexistent entry', () => {
    expect(() =>
      runner.validateBatchStructure(
        batch([damageOp('op.1'), deferred('op.h', 'op.missing')]),
      ),
    ).toThrow(CombatSettlementFault)
  })

  it('rejects a deferred ref to a LATER entry', () => {
    expect(() =>
      runner.validateBatchStructure(
        batch([deferred('op.h', 'op.1'), damageOp('op.1')]),
      ),
    ).toThrow(CombatSettlementFault)
  })

  it('rejects a deferred ref to a non-deal_damage entry', () => {
    expect(() =>
      runner.validateBatchStructure(
        batch([healOp('op.1'), deferred('op.h', 'op.1')]),
      ),
    ).toThrow(CombatSettlementFault)
  })

  it('rejects a deferred ref to another deferred entry', () => {
    expect(() =>
      runner.validateBatchStructure(
        batch([
          damageOp('op.1'),
          deferred('op.h1', 'op.1'),
          deferred('op.h2', 'op.h1'),
        ]),
      ),
    ).toThrow(CombatSettlementFault)
  })

  it('rejects malformed payloads and blank ids', () => {
    const malformed = {
      operationId: 'op.bad',
      type: 'deal_damage',
      origin: ORIGIN,
      payload: { targetId: 'entity.b' },
    } as unknown as ResolvedCombatOperation
    expect(() =>
      runner.validateBatchStructure(batch([malformed])),
    ).toThrow(CombatSettlementFault)

    const blankId = {
      operationId: '',
      type: 'heal',
      origin: ORIGIN,
      payload: { targetId: 'e', amount: 1 },
    } as unknown as ResolvedCombatOperation
    expect(() =>
      runner.validateBatchStructure(batch([blankId])),
    ).toThrow(CombatSettlementFault)
  })
})

describe('materialize (r4 HIGH 2 / R-C7)', () => {
  const runner = new CombatOperationBatchRunner(noopChecker)

  function storeWithDamage(hpDamage: number): BatchResultStore {
    const store = new BatchResultStore()
    store.record(damageOp('op.d'), {
      operationId: 'op.d',
      type: 'deal_damage',
      status: 'resolved',
      damage: { rawDamage: hpDamage, hpDamage, killed: false },
    })
    return store
  }

  it('materializes a heal from the prior damage result -- source target', () => {
    const op = runner.materialize(
      deferred('op.h', 'op.d', 'source'),
      storeWithDamage(10),
    )
    expect(op).toEqual({
      operationId: 'op.h',
      type: 'heal',
      origin: ORIGIN,
      payload: { targetId: 'entity.a', amount: 5 },
    })
  })

  it('materializes healTarget target from the damage op payload targetId', () => {
    const op = runner.materialize(
      deferred('op.h', 'op.d', 'target'),
      storeWithDamage(8),
    )
    expect(op.type).toBe('heal')
    if (op.type !== 'heal') throw new Error('narrow')
    expect(op.payload).toEqual({ targetId: 'entity.b', amount: 4 })
  })

  it('throws (structural) when the referenced result is missing or not resolved', () => {
    expect(() =>
      runner.materialize(deferred('op.h', 'op.missing'), new BatchResultStore()),
    ).toThrow(CombatSettlementFault)

    const skipped = new BatchResultStore()
    skipped.recordResult({
      operationId: 'op.d',
      type: 'deal_damage',
      status: 'skipped',
      reason: 'invalid_target_state',
    })
    expect(() =>
      runner.materialize(deferred('op.h', 'op.d'), skipped),
    ).toThrow(CombatSettlementFault)
  })
})

describe('BatchResultStore', () => {
  it('records op+result pairs; result-only entries have no operation', () => {
    const store = new BatchResultStore()
    const op = damageOp('op.1')
    const result = {
      operationId: 'op.1',
      type: 'deal_damage',
      status: 'resolved',
      damage: { rawDamage: 4, hpDamage: 4, killed: false },
    } as const
    store.record(op, result)
    store.recordResult({
      operationId: 'op.skip',
      type: 'heal',
      status: 'skipped',
      reason: 'dependency_not_resolved',
    })

    expect(store.get('op.1')).toEqual(result)
    expect(store.getOperation('op.1')).toBe(op)
    expect(store.get('op.skip')?.status).toBe('skipped')
    expect(store.getOperation('op.skip')).toBeUndefined()
    expect(store.get('op.none')).toBeUndefined()
  })
})
