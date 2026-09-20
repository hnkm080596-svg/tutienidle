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
  resultTypeOfBatchEntry,
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

  it('unknown precondition kind is a structural fault, not a fail-closed stale-skip', () => {
    const runner = new CombatOperationBatchRunner(noopChecker)
    const bad = batch([damageOp('op.1')], [
      { kind: 'time_travel', entityId: 'entity.a' },
    ] as unknown as CombatOperationBatch['preconditions'])
    expect(() => runner.preflight(bad)).toThrow(CombatSettlementFault)
  })

  it('missing/malformed preconditions field is a structural fault, not a TypeError', () => {
    const runner = new CombatOperationBatchRunner(noopChecker)
    const noField = {
      batchId: 'b.1',
      origin: ORIGIN,
      operations: [damageOp('op.1')],
    } as unknown as CombatOperationBatch
    expect(() => runner.preflight(noField)).toThrow(CombatSettlementFault)
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

  it('rejects a missing preconditions field and unknown/malformed kinds', () => {
    const noField = {
      batchId: 'b.1',
      origin: ORIGIN,
      operations: [damageOp('op.1')],
    } as unknown as CombatOperationBatch
    expect(() => runner.validateBatchStructure(noField)).toThrow(
      CombatSettlementFault,
    )

    const badKind = batch([damageOp('op.1')], [
      { kind: 'time_travel', entityId: 'entity.a' },
    ] as unknown as CombatOperationBatch['preconditions'])
    expect(() => runner.validateBatchStructure(badKind)).toThrow(
      CombatSettlementFault,
    )

    const malformedBuff = batch([damageOp('op.1')], [
      { kind: 'buff_participant', instanceId: 'bi.1' },
    ] as unknown as CombatOperationBatch['preconditions'])
    expect(() => runner.validateBatchStructure(malformedBuff)).toThrow(
      CombatSettlementFault,
    )
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

// ---------------------------------------------------------------------------
// canonical-seals addendum -- add_modifier_on_apply_result deferred kind +
// elementalPenetrationBonus carrier legality.
// ---------------------------------------------------------------------------

const PERIODIC_ORIGIN: CombatOperationOrigin = {
  kind: 'buff_periodic',
  originId: 'bi.entity.a:dot',
  sourceId: 'entity.a',
  rootActionId: 'action.turn.3.p.1',
}

function applyBuffOp(operationId: string): ResolvedCombatOperation {
  return {
    operationId,
    type: 'apply_buff',
    origin: ORIGIN,
    payload: {
      definitionId: 'test_bleed',
      targetId: 'entity.b',
      stacks: 2,
      baseChance: 1,
      reactionEligibility: 'suppressed',
    },
  }
}

function deferredModifier(
  operationId: string,
  resultOperationId: string,
): Extract<DeferredOperation, { kind: 'add_modifier_on_apply_result' }> {
  return {
    kind: 'add_modifier_on_apply_result',
    operationId,
    resultOperationId,
    modifier: {
      id: 'doan_moc',
      channel: 'potency',
      operation: 'multiply',
      value: 1.25,
      reapply: 'max',
      priority: 0,
      lifetime: { type: 'buff_lifetime' },
    },
    origin: ORIGIN,
  }
}

function storeWithApplyResult(result: {
  applied: boolean
  instanceId?: string
}): BatchResultStore {
  const store = new BatchResultStore()
  store.record(applyBuffOp('op.a'), {
    operationId: 'op.a',
    type: 'apply_buff',
    status: 'resolved',
    result,
  })
  return store
}

describe('add_modifier_on_apply_result (canonical-seals addendum)', () => {
  const runner = new CombatOperationBatchRunner(noopChecker)

  it('is a deferred entry producing an add_buff_modifier result type', () => {
    const entry = deferredModifier('op.m', 'op.1')
    expect(isDeferredOperation(entry)).toBe(true)
    expect(resultTypeOfBatchEntry(entry)).toBe('add_buff_modifier')
    expect(resultTypeOfBatchEntry(deferred('op.h', 'op.1'))).toBe('heal')
  })

  it('accepts an apply_buff reference; rejects deal_damage/heal references', () => {
    expect(() =>
      runner.validateBatchStructure(
        batch([applyBuffOp('op.1'), deferredModifier('op.m', 'op.1')]),
      ),
    ).not.toThrow()
    expect(() =>
      runner.validateBatchStructure(
        batch([damageOp('op.1'), deferredModifier('op.m', 'op.1')]),
      ),
    ).toThrow(CombatSettlementFault)
    // The heal kind still cannot reference apply_buff.
    expect(() =>
      runner.validateBatchStructure(
        batch([applyBuffOp('op.1'), deferred('op.h', 'op.1')]),
      ),
    ).toThrow(CombatSettlementFault)
  })

  it('rejects a malformed modifier payload', () => {
    const bad = {
      ...deferredModifier('op.m', 'op.1'),
      modifier: { id: '' },
    } as unknown as DeferredOperation
    expect(() =>
      runner.validateBatchStructure(batch([applyBuffOp('op.1'), bad])),
    ).toThrow(CombatSettlementFault)
  })

  it('deferredSkipReason: dependency_not_resolved / application_roll_failed / proceed', () => {
    // Missing prior.
    expect(
      runner.deferredSkipReason(deferredModifier('op.m', 'op.a'), new BatchResultStore()),
    ).toBe('dependency_not_resolved')
    // Skipped prior.
    const skipped = new BatchResultStore()
    skipped.recordResult({
      operationId: 'op.a',
      type: 'apply_buff',
      status: 'skipped',
      reason: 'invalid_target_state',
    })
    expect(
      runner.deferredSkipReason(deferredModifier('op.m', 'op.a'), skipped),
    ).toBe('dependency_not_resolved')
    // resolved + applied:false -> application_roll_failed ('resolved' is
    // NOT application success -- contract sec.17).
    expect(
      runner.deferredSkipReason(
        deferredModifier('op.m', 'op.a'),
        storeWithApplyResult({ applied: false }),
      ),
    ).toBe('application_roll_failed')
    // resolved + applied:true -> materialize.
    expect(
      runner.deferredSkipReason(
        deferredModifier('op.m', 'op.a'),
        storeWithApplyResult({ applied: true, instanceId: 'bi.9' }),
      ),
    ).toBeUndefined()
    // resolved wrong-type prior -> structural fault, not a skip.
    const wrongType = new BatchResultStore()
    wrongType.record(damageOp('op.d'), {
      operationId: 'op.d',
      type: 'deal_damage',
      status: 'resolved',
      damage: { rawDamage: 1, hpDamage: 1, killed: false },
    })
    expect(() =>
      runner.deferredSkipReason(deferredModifier('op.m', 'op.d'), wrongType),
    ).toThrow(CombatSettlementFault)
  })

  it('materializes onto the EXACT returned instanceId; faults on applied:false / missing instanceId', () => {
    const op = runner.materialize(
      deferredModifier('op.m', 'op.a'),
      storeWithApplyResult({ applied: true, instanceId: 'bi.9' }),
    )
    expect(op).toEqual({
      operationId: 'op.m',
      type: 'add_buff_modifier',
      origin: ORIGIN,
      payload: {
        selector: { kind: 'instance', instanceId: 'bi.9' },
        modifier: deferredModifier('op.m', 'op.a').modifier,
      },
    })
    expect(() =>
      runner.materialize(
        deferredModifier('op.m', 'op.a'),
        storeWithApplyResult({ applied: false }),
      ),
    ).toThrow(CombatSettlementFault)
    expect(() =>
      runner.materialize(
        deferredModifier('op.m', 'op.a'),
        storeWithApplyResult({ applied: true }),
      ),
    ).toThrow(CombatSettlementFault)
  })
})

describe('deal_damage elementalPenetrationBonus (canonical-seals addendum)', () => {
  const runner = new CombatOperationBatchRunner(noopChecker)

  function periodicDamage(
    overrides: {
      bonus?: number
      element?: 'fire' | 'physical'
      damageProfile?: string
      origin?: CombatOperationOrigin
    } = {},
  ): ResolvedCombatOperation {
    return {
      operationId: 'op.p',
      type: 'deal_damage',
      origin: overrides.origin ?? PERIODIC_ORIGIN,
      payload: {
        targetId: 'entity.b',
        damageProfile: overrides.damageProfile ?? 'legacy_dot',
        coefficient: 1,
        hitCount: 1,
        canCrit: false,
        canMiss: false,
        ...(overrides.element !== undefined
          ? { element: overrides.element }
          : { element: 'fire' }),
        ...(overrides.bonus !== undefined
          ? { elementalPenetrationBonus: overrides.bonus }
          : {}),
      },
    }
  }

  it('accepts the legal carrier (buff_periodic + legacy_dot + ElementType)', () => {
    expect(() =>
      runner.validateBatchStructure(batch([periodicDamage({ bonus: 20 })])),
    ).not.toThrow()
    // Negative stays legal -- the generic channel may debuff penetration.
    expect(() =>
      runner.validateBatchStructure(batch([periodicDamage({ bonus: -5 })])),
    ).not.toThrow()
  })

  it('rejects physical/undefined element, wrong profile, wrong origin, non-finite', () => {
    expect(() =>
      runner.validateBatchStructure(
        batch([periodicDamage({ bonus: 20, element: 'physical' })]),
      ),
    ).toThrow(CombatSettlementFault)
    expect(() =>
      runner.validateBatchStructure(
        batch([periodicDamage({ bonus: 20, damageProfile: 'test' })]),
      ),
    ).toThrow(CombatSettlementFault)
    expect(() =>
      runner.validateBatchStructure(
        batch([periodicDamage({ bonus: 20, origin: ORIGIN })]),
      ),
    ).toThrow(CombatSettlementFault)
    expect(() =>
      runner.validateBatchStructure(
        batch([periodicDamage({ bonus: Number.NaN })]),
      ),
    ).toThrow(CombatSettlementFault)
    expect(() =>
      runner.validateBatchStructure(
        batch([periodicDamage({ bonus: Number.POSITIVE_INFINITY })]),
      ),
    ).toThrow(CombatSettlementFault)
    // element absent is illegal too.
    const noElement = periodicDamage({ bonus: 20 })
    delete (noElement.payload as { element?: unknown }).element
    expect(() =>
      runner.validateBatchStructure(batch([noElement])),
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
