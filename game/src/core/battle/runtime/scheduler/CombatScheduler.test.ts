import { describe, expect, it } from 'vitest'

import type { CombatAuthorityExecutionContext } from '../../contracts/context'
import type {
  CombatEventPayload,
  CombatSettlementFaultEvent,
  ElementalApplicationCommitted,
  PendingCombatEvent,
} from '../../contracts/events'
import type { CombatOperationOrigin } from '../../contracts/origin'
import type {
  DealDamageOperation,
  HealOperation,
  ResolvedCombatOperation,
} from '../../contracts/operations'
import type {
  BuffPeriodicDamageRequest,
  BuffPeriodicHealRequest,
} from '../../contracts/periodic'
import type { CombatOperationBatch, ImmediateSettlement } from '../../contracts/settlement'
import type { CombatEventSink } from '../../contracts/sink'

import type { BuffAuthority, CombatAuthorityPorts } from './CombatAuthorityPorts'
import {
  CombatOperationExecutor,
  CombatOperationSkip,
} from './CombatOperationExecutor'
import type { PreconditionChecker } from './CombatOperationBatchRunner'
import { CombatScheduler, type CombatSchedulerOptions } from './CombatScheduler'
import { CombatSettlementFault } from './CombatSettlementFault'

const ORIGIN: CombatOperationOrigin = {
  kind: 'skill',
  originId: 'skill.test',
  sourceId: 'entity.a',
  rootActionId: 'action.turn.1.a',
}

function damageOp(
  operationId: string,
  origin: CombatOperationOrigin = ORIGIN,
): ResolvedCombatOperation {
  return {
    operationId,
    type: 'deal_damage',
    origin,
    payload: {
      targetId: 'entity.b',
      damageProfile: 'test',
      coefficient: 1,
      hitCount: 1,
      canCrit: false,
      canMiss: false,
    },
  }
}

function healOp(
  operationId: string,
  origin: CombatOperationOrigin = ORIGIN,
): ResolvedCombatOperation {
  return {
    operationId,
    type: 'heal',
    origin,
    payload: { targetId: 'entity.a', amount: 5 },
  }
}

/** Envelope-free elemental event payload with a distinguishable instanceId. */
function elem(instanceId: string): CombatEventPayload {
  return {
    type: 'elemental_application_committed',
    instanceId,
    sourceId: 'entity.a',
    targetId: 'entity.b',
    definitionId: 'def.x',
    element: 'fire',
    stacksBefore: 0,
    stacksAfter: 1,
    requestedStacks: 1,
    addedStacks: 1,
    reactionEligibility: 'eligible',
    origin: ORIGIN,
  }
}

function periodicDamageReq(
  sourceId: string,
  targetId = 'entity.b',
): BuffPeriodicDamageRequest {
  return {
    instanceId: `bi.${sourceId}`,
    periodicId: 'dot',
    sourceId,
    targetId,
    element: 'fire',
    damageProfile: 'legacy_dot',
    coefficient: 2,
    hitCount: 1,
    canCrit: false,
    canMiss: false,
    tags: ['periodic'],
  }
}

function periodicHealReq(sourceId: string, targetId = 'entity.b'): BuffPeriodicHealRequest {
  return {
    instanceId: `bi.${sourceId}`,
    periodicId: 'hot',
    sourceId,
    targetId,
    amount: 4,
  }
}

interface Harness {
  scheduler: CombatScheduler
  /** Ordered settle log: 'op.<id>' for op executions, 'h:<instanceId>' for
      elemental handler invocations. */
  calls: string[]
  /** op id -> payloads the authority emits via ctx.events during execute. */
  emissions: Map<string, CombatEventPayload[]>
  /** If set, EVERY executed damage op also emits these payloads. */
  alwaysEmit: CombatEventPayload[]
  /** op ids whose damage authority throws a typed runtime skip. */
  skipOps: Set<string>
  damageCalls: { payload: DealDamageOperation['payload']; ctx: CombatAuthorityExecutionContext }[]
  healCalls: { payload: HealOperation['payload']; ctx: CombatAuthorityExecutionContext }[]
  diagnosticEvents: CombatSettlementFaultEvent[]
}

function makeHarness(opts?: CombatSchedulerOptions): Harness {
  const calls: string[] = []
  const emissions = new Map<string, CombatEventPayload[]>()
  const alwaysEmit: CombatEventPayload[] = []
  const skipOps = new Set<string>()
  const damageCalls: Harness['damageCalls'] = []
  const healCalls: Harness['healCalls'] = []
  const diagnosticEvents: CombatSettlementFaultEvent[] = []

  const emitAll = (opId: string, sink: CombatEventSink): void => {
    for (const p of emissions.get(opId) ?? []) sink.emit(p)
    for (const p of alwaysEmit) sink.emit(p)
  }

  const ports: CombatAuthorityPorts = {
    damage: {
      dealDamage: (payload, ctx) => {
        calls.push(ctx.operationId)
        damageCalls.push({ payload, ctx })
        if (skipOps.has(ctx.operationId)) {
          throw new CombatOperationSkip('invalid_target_state')
        }
        emitAll(ctx.operationId, ctx.events)
        return { rawDamage: 10, hpDamage: 10, killed: false }
      },
    },
    heal: {
      heal: (payload, ctx) => {
        calls.push(ctx.operationId)
        healCalls.push({ payload, ctx })
        emitAll(ctx.operationId, ctx.events)
        return { requested: payload.amount, healed: payload.amount, after: 50 }
      },
    },
    buffs: {
      apply: () => ({ applied: true }),
      addStacks: () => ({ stacksBefore: 0, stacksAfter: 0 }),
      removeStacks: () => ({ stacksBefore: 0, stacksAfter: 0 }),
      consumeStacks: () => ({ consumed: 0, remaining: 0, removed: false }),
      addModifier: () => ({ applied: true }),
      removeModifier: () => ({ removed: true }),
      refreshDuration: () => ({ durationBefore: 0, durationAfter: 0 }),
      extendDuration: () => ({ durationBefore: 0, durationAfter: 0 }),
      triggerPeriodic: (_sel, _periodicId, ctx) => {
        calls.push(ctx.operationId)
        emitAll(ctx.operationId, ctx.events)
        return []
      },
      remove: () => undefined,
    } satisfies BuffAuthority,
  }

  const executor = new CombatOperationExecutor(ports)
  const scheduler = new CombatScheduler(executor, {
    ...opts,
    diagnosticSink: { emit: (e) => diagnosticEvents.push(e) },
  })

  return {
    scheduler,
    calls,
    emissions,
    alwaysEmit,
    skipOps,
    damageCalls,
    healCalls,
    diagnosticEvents,
  }
}

type ElemHandler = (
  event: ElementalApplicationCommitted,
  sink: CombatEventSink,
) => ImmediateSettlement | void

/** Registers the single 'elemental_application_committed' handler and routes
    by instanceId -- the one-handler-per-type rule means tests multiplex on a
    payload field. */
function routeElemental(
  h: Harness,
  routes: Record<string, ElemHandler>,
): void {
  h.scheduler.registerImmediateHandler(
    'elemental_application_committed',
    (event, sink) => {
      if (event.type !== 'elemental_application_committed') return
      h.calls.push(`h:${event.instanceId}`)
      return routes[event.instanceId]?.(event, sink)
    },
  )
}

function batchOf(
  batchId: string,
  operations: CombatOperationBatch['operations'],
  preconditions: CombatOperationBatch['preconditions'] = [],
): CombatOperationBatch {
  return { batchId, origin: ORIGIN, preconditions, operations }
}

describe('settlement barrier (sec.55)', () => {
  it('handler-returned ops complete before the next authored op', () => {
    const h = makeHarness()
    h.emissions.set('op.A', [elem('e1')])
    routeElemental(h, {
      e1: () => ({
        kind: 'operations',
        operations: [damageOp('op.X'), damageOp('op.Y')],
      }),
    })
    h.scheduler.enqueueAuthored([damageOp('op.A'), damageOp('op.B')])

    h.scheduler.run()
    expect(h.calls).toEqual(['op.A', 'h:e1', 'op.X', 'op.Y', 'op.B'])
  })

  it('chained immediate consequences fully drain before the next authored op', () => {
    const h = makeHarness()
    h.emissions.set('op.A', [elem('e1')])
    h.emissions.set('op.X', [elem('e2')])
    routeElemental(h, {
      e1: () => ({ kind: 'operations', operations: [damageOp('op.X')] }),
      e2: () => ({ kind: 'operations', operations: [healOp('op.Y')] }),
    })
    h.scheduler.enqueueAuthored([damageOp('op.A'), damageOp('op.B')])

    h.scheduler.run()
    expect(h.calls).toEqual(['op.A', 'h:e1', 'op.X', 'h:e2', 'op.Y', 'op.B'])
  })
})

describe('depth-first consequence frames (r5 BLOCKER 1)', () => {
  it('X emits E2 -> Z settles inside X barrier: order X, Z, Y -- never X, Y, Z', () => {
    const h = makeHarness()
    h.emissions.set('op.A', [elem('e1')])
    h.emissions.set('op.X', [elem('e2')])
    routeElemental(h, {
      e1: () => ({
        kind: 'operations',
        operations: [damageOp('op.X'), damageOp('op.Y')],
      }),
      e2: () => ({ kind: 'operations', operations: [damageOp('op.Z')] }),
    })
    h.scheduler.enqueueAuthored([damageOp('op.A')])

    h.scheduler.run()
    expect(h.calls).toEqual(['op.A', 'h:e1', 'op.X', 'h:e2', 'op.Z', 'op.Y'])
  })

  it('nested event isolation: E3 settles inside X barrier before E2', () => {
    const h = makeHarness()
    h.emissions.set('op.A', [elem('e1'), elem('e2')])
    h.emissions.set('op.X', [elem('e3')])
    routeElemental(h, {
      e1: () => ({
        kind: 'operations',
        operations: [damageOp('op.X'), damageOp('op.Y')],
      }),
      e3: () => ({ kind: 'operations', operations: [damageOp('op.Z')] }),
      e2: () => undefined,
    })
    h.scheduler.enqueueAuthored([damageOp('op.A')])

    h.scheduler.run()
    expect(h.calls).toEqual([
      'op.A',
      'h:e1',
      'op.X',
      'h:e3',
      'op.Z',
      'op.Y',
      'h:e2',
    ])
  })

  it('batch variant: outer E2 never interleaves mid-batch', () => {
    const h = makeHarness()
    h.emissions.set('op.A', [elem('e1'), elem('e2')])
    h.emissions.set('batch.B1', [elem('e3')])
    routeElemental(h, {
      e1: () => ({
        kind: 'batch',
        batch: batchOf('b.1', [damageOp('batch.B1'), damageOp('batch.B2')]),
      }),
      e3: () => ({
        kind: 'operations',
        operations: [damageOp('op.Z1'), damageOp('op.Z2')],
      }),
      e2: () => undefined,
    })
    h.scheduler.enqueueAuthored([damageOp('op.A')])

    h.scheduler.run()
    expect(h.calls).toEqual([
      'op.A',
      'h:e1',
      'batch.B1',
      'h:e3',
      'op.Z1',
      'op.Z2',
      'batch.B2',
      'h:e2',
    ])
  })

  it('Option B: an event consequence tree completes before the next queued event handler', () => {
    const h = makeHarness()
    h.emissions.set('op.A', [elem('e1'), elem('e2')])
    routeElemental(h, {
      e1: () => ({ kind: 'operations', operations: [damageOp('op.X')] }),
      e2: () => undefined,
    })
    h.scheduler.enqueueAuthored([damageOp('op.A')])

    h.scheduler.run()
    expect(h.calls).toEqual(['op.A', 'h:e1', 'op.X', 'h:e2'])
  })
})

describe('handler-emitted events (r5 HIGH 4)', () => {
  it('returned settlement completes before handler-emitted events settle', () => {
    const h = makeHarness()
    h.emissions.set('op.A', [elem('e1')])
    h.emissions.set('op.X', [elem('ex')])
    routeElemental(h, {
      e1: (_event, sink) => {
        sink.emit(elem('child'))
        return { kind: 'operations', operations: [damageOp('op.X')] }
      },
      ex: () => undefined,
      child: () => undefined,
    })
    h.scheduler.enqueueAuthored([damageOp('op.A')])

    h.scheduler.run()
    // X's whole frame (incl. h:ex) completes before h:child runs.
    expect(h.calls).toEqual(['op.A', 'h:e1', 'op.X', 'h:ex', 'h:child'])
  })
})

describe('malformed handler settlement', () => {
  it('an unknown settlement kind is a structural fault, not a silent no-op', () => {
    const h = makeHarness()
    h.emissions.set('op.A', [elem('e1')])
    routeElemental(h, {
      e1: () =>
        ({ kind: 'mystery' }) as unknown as ImmediateSettlement,
    })
    h.scheduler.enqueueAuthored([damageOp('op.A')])

    expect(() => h.scheduler.run()).toThrow(CombatSettlementFault)
    expect(h.scheduler.state).toBe('faulted')
    expect(h.scheduler.trace.faults[0]?.reason).toBe('structural_fault')
    // Fault fires at the malformed settlement -- no consequence op ran.
    expect(h.calls).toEqual(['op.A', 'h:e1'])
  })
})

describe('operation id uniqueness (r3 HIGH + r5 BLOCKER 3)', () => {
  it('enqueueAuthored([A,B]) with a pre-seen B id faults before A executes', () => {
    const h = makeHarness()
    h.scheduler.reserveOperationId('op.B')
    expect(() =>
      h.scheduler.enqueueAuthored([damageOp('op.A'), damageOp('op.B')]),
    ).toThrow(CombatSettlementFault)

    h.scheduler.run()
    expect(h.calls).toEqual([])
  })

  it('authored-vs-authored collision throws', () => {
    const h = makeHarness()
    h.scheduler.enqueueAuthored([damageOp('op.A')])
    expect(() => h.scheduler.enqueueAuthored([healOp('op.A')])).toThrow(
      CombatSettlementFault,
    )
  })

  it('handler-returned group reserves atomically -- dup in Y faults before X runs', () => {
    const h = makeHarness()
    h.scheduler.reserveOperationId('op.Y')
    h.emissions.set('op.A', [elem('e1')])
    routeElemental(h, {
      e1: () => ({
        kind: 'operations',
        operations: [damageOp('op.X'), damageOp('op.Y')],
      }),
    })
    h.scheduler.enqueueAuthored([damageOp('op.A')])

    expect(() => h.scheduler.run()).toThrow(CombatSettlementFault)
    expect(h.calls).toEqual(['op.A', 'h:e1'])
  })

  it('authored-vs-immediate collision throws', () => {
    const h = makeHarness()
    h.emissions.set('op.A', [elem('e1')])
    routeElemental(h, {
      e1: () => ({ kind: 'operations', operations: [damageOp('op.B')] }),
    })
    h.scheduler.enqueueAuthored([damageOp('op.A'), damageOp('op.B')])

    expect(() => h.scheduler.run()).toThrow(CombatSettlementFault)
    expect(h.calls).toEqual(['op.A', 'h:e1'])
  })

  it('batch duplicate id faults before the first batch op', () => {
    const h = makeHarness()
    h.emissions.set('op.A', [elem('e1')])
    routeElemental(h, {
      e1: () => ({
        kind: 'batch',
        batch: batchOf('b.1', [damageOp('batch.B1'), damageOp('batch.B1')]),
      }),
    })
    h.scheduler.enqueueAuthored([damageOp('op.A')])

    expect(() => h.scheduler.run()).toThrow(CombatSettlementFault)
    expect(h.calls).toEqual(['op.A', 'h:e1'])
  })

  it('batch-vs-deferred in-batch id collision is a structural fault', () => {
    const h = makeHarness()
    h.emissions.set('op.A', [elem('e1')])
    routeElemental(h, {
      e1: () => ({
        kind: 'batch',
        batch: batchOf('b.1', [
          damageOp('batch.B1'),
          {
            kind: 'heal_from_damage_result',
            operationId: 'batch.B1',
            resultOperationId: 'batch.B1',
            healTarget: 'source',
            fraction: 0.5,
            origin: ORIGIN,
          },
        ]),
      }),
    })
    h.scheduler.enqueueAuthored([damageOp('op.A')])

    expect(() => h.scheduler.run()).toThrow(CombatSettlementFault)
    expect(h.calls).toEqual(['op.A', 'h:e1'])
  })

  it('batch id colliding with a globally reserved id faults before any batch op', () => {
    const h = makeHarness()
    h.scheduler.reserveOperationId('batch.B1')
    h.emissions.set('op.A', [elem('e1')])
    routeElemental(h, {
      e1: () => ({
        kind: 'batch',
        batch: batchOf('b.1', [damageOp('batch.B1'), damageOp('batch.B2')]),
      }),
    })
    h.scheduler.enqueueAuthored([damageOp('op.A')])

    expect(() => h.scheduler.run()).toThrow(CombatSettlementFault)
    expect(h.calls).toEqual(['op.A', 'h:e1'])
  })
})

describe('batch structural preflight (r4 BLOCKER 3)', () => {
  const badBatches: { name: string; operations: CombatOperationBatch['operations'] }[] = [
    {
      name: 'deferred ref to a nonexistent id',
      operations: [
        damageOp('batch.B1'),
        {
          kind: 'heal_from_damage_result',
          operationId: 'batch.H',
          resultOperationId: 'batch.MISSING',
          healTarget: 'source',
          fraction: 0.5,
          origin: ORIGIN,
        },
      ],
    },
    {
      name: 'deferred ref to a LATER entry',
      operations: [
        {
          kind: 'heal_from_damage_result',
          operationId: 'batch.H',
          resultOperationId: 'batch.B1',
          healTarget: 'source',
          fraction: 0.5,
          origin: ORIGIN,
        },
        damageOp('batch.B1'),
      ],
    },
    {
      name: 'deferred ref to a non-deal_damage entry',
      operations: [
        healOp('batch.B1'),
        {
          kind: 'heal_from_damage_result',
          operationId: 'batch.H',
          resultOperationId: 'batch.B1',
          healTarget: 'source',
          fraction: 0.5,
          origin: ORIGIN,
        },
      ],
    },
  ]

  for (const { name, operations } of badBatches) {
    it(`faults before any op: ${name}`, () => {
      const h = makeHarness()
      h.emissions.set('op.A', [elem('e1')])
      routeElemental(h, {
        e1: () => ({ kind: 'batch', batch: batchOf('b.1', operations) }),
      })
      h.scheduler.enqueueAuthored([damageOp('op.A')])

      expect(() => h.scheduler.run()).toThrow(CombatSettlementFault)
      // Zero batch ops executed -- a broken command graph is not a runtime skip.
      expect(h.calls).toEqual(['op.A', 'h:e1'])
    })
  }

  it('faults on a malformed op payload before any op runs', () => {
    const h = makeHarness()
    const malformed = {
      operationId: 'batch.B1',
      type: 'deal_damage',
      origin: ORIGIN,
      payload: { targetId: 'entity.b' },
    } as unknown as ResolvedCombatOperation
    h.emissions.set('op.A', [elem('e1')])
    routeElemental(h, {
      e1: () => ({ kind: 'batch', batch: batchOf('b.1', [malformed]) }),
    })
    h.scheduler.enqueueAuthored([damageOp('op.A')])

    expect(() => h.scheduler.run()).toThrow(CombatSettlementFault)
    expect(h.calls).toEqual(['op.A', 'h:e1'])
  })

  it('faults on an unknown precondition kind / missing preconditions field before any op runs', () => {
    const h = makeHarness()
    const badKind = batchOf(
      'b.bad',
      [damageOp('batch.B1')],
      [
        { kind: 'time_travel', entityId: 'entity.a' },
      ] as unknown as CombatOperationBatch['preconditions'],
    )
    const noField = {
      batchId: 'b.missing',
      origin: ORIGIN,
      operations: [damageOp('batch.B2')],
    } as unknown as CombatOperationBatch
    h.emissions.set('op.A', [elem('e1'), elem('e2')])
    routeElemental(h, {
      e1: () => ({ kind: 'batch', batch: badKind }),
      e2: () => ({ kind: 'batch', batch: noField }),
    })
    h.scheduler.enqueueAuthored([damageOp('op.A')])

    // Unknown kind: structural fault -- a broken command graph must not
    // fail closed into a stale-skip. (The second malformed batch is
    // unreachable once the first faults, so it is covered by the
    // runner-level unit test.)
    expect(() => h.scheduler.run()).toThrow(CombatSettlementFault)
    expect(h.calls).toEqual(['op.A', 'h:e1'])
    expect(h.scheduler.state).toBe('faulted')
  })
})

describe('batch runtime semantics (sec.40-44)', () => {
  const aliveChecker: PreconditionChecker = {
    isAlive: () => true,
    getBuffInstance: () => undefined,
  }

  it('preflight fail -> zero ops run + atomic stale-skip is recorded', () => {
    const h = makeHarness({
      preconditions: { isAlive: (id) => id !== 'entity.b', getBuffInstance: () => undefined },
    })
    h.emissions.set('op.A', [elem('e1')])
    routeElemental(h, {
      e1: () => ({
        kind: 'batch',
        batch: batchOf(
          'b.1',
          [damageOp('batch.B1'), damageOp('batch.B2')],
          [{ kind: 'entity_alive', entityId: 'entity.b' }],
        ),
      }),
    })
    h.scheduler.enqueueAuthored([damageOp('op.A')])

    h.scheduler.run()
    expect(h.calls).toEqual(['op.A', 'h:e1'])
    expect(h.scheduler.trace.batchSkips).toEqual([
      {
        batchId: 'b.1',
        reason: 'stale_reaction_snapshot',
        operationIds: ['batch.B1', 'batch.B2'],
      },
    ])
    expect(h.scheduler.trace.skippedResults).toEqual([
      {
        operationId: 'batch.B1',
        type: 'deal_damage',
        status: 'skipped',
        reason: 'stale_reaction_snapshot',
      },
      {
        operationId: 'batch.B2',
        type: 'deal_damage',
        status: 'skipped',
        reason: 'stale_reaction_snapshot',
      },
    ])
  })

  it('preflight pass -> ops run in order; authored ops cannot interleave mid-batch', () => {
    const h = makeHarness({ preconditions: aliveChecker })
    h.emissions.set('op.A', [elem('e1')])
    routeElemental(h, {
      e1: () => ({
        kind: 'batch',
        batch: batchOf('b.1', [damageOp('batch.B1'), damageOp('batch.B2')]),
      }),
    })
    h.scheduler.enqueueAuthored([damageOp('op.A'), damageOp('op.C')])

    h.scheduler.run()
    expect(h.calls).toEqual(['op.A', 'h:e1', 'batch.B1', 'batch.B2', 'op.C'])
  })

  it('per-op settle inside the batch frame: B1 consequences drain before B2', () => {
    const h = makeHarness({ preconditions: aliveChecker })
    h.emissions.set('op.A', [elem('e1')])
    h.emissions.set('batch.B1', [elem('e3')])
    routeElemental(h, {
      e1: () => ({
        kind: 'batch',
        batch: batchOf('b.1', [damageOp('batch.B1'), damageOp('batch.B2')]),
      }),
      e3: () => ({ kind: 'operations', operations: [damageOp('op.Z')] }),
    })
    h.scheduler.enqueueAuthored([damageOp('op.A')])

    h.scheduler.run()
    expect(h.calls).toEqual(['op.A', 'h:e1', 'batch.B1', 'h:e3', 'op.Z', 'batch.B2'])
  })

  it('nested batch runs to completion inside the parent frame', () => {
    const h = makeHarness({ preconditions: aliveChecker })
    h.emissions.set('op.A', [elem('e1')])
    h.emissions.set('batch.B1', [elem('e2')])
    routeElemental(h, {
      e1: () => ({
        kind: 'batch',
        batch: batchOf('b.outer', [damageOp('batch.B1'), damageOp('batch.B2')]),
      }),
      e2: () => ({
        kind: 'batch',
        batch: batchOf('b.inner', [damageOp('batch.C1')]),
      }),
    })
    h.scheduler.enqueueAuthored([damageOp('op.A')])

    h.scheduler.run()
    expect(h.calls).toEqual([
      'op.A',
      'h:e1',
      'batch.B1',
      'h:e2',
      'batch.C1',
      'batch.B2',
    ])
  })

  it('deferred entry materializes from a prior in-batch result and keeps its id', () => {
    const h = makeHarness({ preconditions: aliveChecker })
    h.emissions.set('op.A', [elem('e1')])
    routeElemental(h, {
      e1: () => ({
        kind: 'batch',
        batch: batchOf('b.1', [
          damageOp('batch.D1'),
          {
            kind: 'heal_from_damage_result',
            operationId: 'batch.H1',
            resultOperationId: 'batch.D1',
            healTarget: 'source',
            fraction: 0.5,
            origin: ORIGIN,
          },
        ]),
      }),
    })
    h.scheduler.enqueueAuthored([damageOp('op.A')])

    h.scheduler.run()
    expect(h.calls).toEqual(['op.A', 'h:e1', 'batch.D1', 'batch.H1'])
    // hpDamage 10 * 0.5 -> heal 5 on the damage op's source.
    expect(h.healCalls[0]?.payload).toEqual({ targetId: 'entity.a', amount: 5 })
    expect(h.healCalls[0]?.ctx.operationId).toBe('batch.H1')
    const record = h.scheduler.trace.records.find(
      (r) => r.operation.operationId === 'batch.H1',
    )
    expect(record?.operation.type).toBe('heal')
    expect(record?.result.status).toBe('resolved')
  })

  it('deferred healTarget target resolves to the damage op payload target', () => {
    const h = makeHarness({ preconditions: aliveChecker })
    h.emissions.set('op.A', [elem('e1')])
    routeElemental(h, {
      e1: () => ({
        kind: 'batch',
        batch: batchOf('b.1', [
          damageOp('batch.D1'),
          {
            kind: 'heal_from_damage_result',
            operationId: 'batch.H1',
            resultOperationId: 'batch.D1',
            healTarget: 'target',
            fraction: 0.25,
            origin: ORIGIN,
          },
        ]),
      }),
    })
    h.scheduler.enqueueAuthored([damageOp('op.A')])

    h.scheduler.run()
    expect(h.healCalls[0]?.payload).toEqual({ targetId: 'entity.b', amount: 2.5 })
  })

  it('deferred runtime dependency: skipped damage op -> dependency_not_resolved, never a silent heal-0', () => {
    const h = makeHarness({ preconditions: aliveChecker })
    h.skipOps.add('batch.D1')
    h.emissions.set('op.A', [elem('e1')])
    routeElemental(h, {
      e1: () => ({
        kind: 'batch',
        batch: batchOf('b.1', [
          damageOp('batch.D1'),
          {
            kind: 'heal_from_damage_result',
            operationId: 'batch.H1',
            resultOperationId: 'batch.D1',
            healTarget: 'source',
            fraction: 0.5,
            origin: ORIGIN,
          },
        ]),
      }),
    })
    h.scheduler.enqueueAuthored([damageOp('op.A')])

    h.scheduler.run()
    expect(h.calls).toEqual(['op.A', 'h:e1', 'batch.D1'])
    expect(h.healCalls).toHaveLength(0)
    expect(h.scheduler.trace.skippedResults).toContainEqual({
      operationId: 'batch.H1',
      type: 'heal',
      status: 'skipped',
      reason: 'dependency_not_resolved',
    })
  })
})

describe('event sinks + dedup (r4 MEDIUM 3 / r4 HIGH 1)', () => {
  it('op-scoped sink mints evt.OP.n ids + causationOperationId (no envelope work in authorities)', () => {
    const h = makeHarness()
    h.emissions.set('op.A', [elem('m1'), elem('m2')])
    routeElemental(h, { m1: () => undefined, m2: () => undefined })
    h.scheduler.enqueueAuthored([damageOp('op.A')])

    h.scheduler.run()
    const emitted = h.scheduler.trace.events.filter(
      (e) => e.type === 'elemental_application_committed',
    )
    expect(emitted.map((e) => e.eventId)).toEqual(['evt.op.A.0', 'evt.op.A.1'])
    expect(emitted[0]?.causationOperationId).toBe('op.A')
    expect(emitted[1]?.causationOperationId).toBe('op.A')
    expect(emitted[0]?.combatSequence).toBeTypeOf('number')
  })

  it('handler-emitted events carry causationEventId -- trace shows op->event->op edges', () => {
    const h = makeHarness()
    h.emissions.set('op.A', [elem('e1')])
    routeElemental(h, {
      e1: (event, sink) => {
        sink.emit(elem('child'))
        return {
          kind: 'operations',
          operations: [
            damageOp('op.X', { ...ORIGIN, causationEventId: event.eventId }),
          ],
        }
      },
      child: () => undefined,
    })
    h.scheduler.enqueueAuthored([damageOp('op.A')])

    h.scheduler.run()
    const e1 = h.scheduler.trace.events.find((e) => e.eventId === 'evt.op.A.0')
    const child = h.scheduler.trace.events.find((e) => e.eventId === `evt.${e1?.eventId}.0`)
    expect(e1?.causationOperationId).toBe('op.A')
    expect(child?.causationEventId).toBe(e1?.eventId)
    const x = h.scheduler.trace.records.find((r) => r.operation.operationId === 'op.X')
    expect(x?.operation.origin.causationEventId).toBe(e1?.eventId)
  })

  it('exactly-once: a duplicated enqueueEvent is stamped once and drained once', () => {
    const h = makeHarness()
    routeElemental(h, { e1: () => undefined })
    const pending: PendingCombatEvent = { ...elem('e1'), eventId: 'evt.external.0' } as PendingCombatEvent

    h.scheduler.enqueueEvent(pending)
    h.scheduler.enqueueEvent(pending)
    h.scheduler.run()

    expect(h.calls).toEqual(['h:e1'])
    expect(
      h.scheduler.trace.events.filter((e) => e.eventId === 'evt.external.0'),
    ).toHaveLength(1)
  })
})

describe('combatSequence ownership (r6)', () => {
  it('op sequence is allocated at execution-START; a cause precedes its effects', () => {
    const h = makeHarness()
    h.emissions.set('op.A', [elem('e1'), elem('e2')])
    routeElemental(h, {
      e1: (event) => ({
        kind: 'operations',
        operations: [damageOp('op.X', { ...ORIGIN, causationEventId: event.eventId })],
      }),
      e2: () => undefined,
    })
    h.scheduler.enqueueAuthored([damageOp('op.A')])

    h.scheduler.run()
    const seqOfOp = (id: string): number => {
      const rec = h.scheduler.trace.records.find(
        (r) => r.operation.operationId === id,
      )
      if (!rec) throw new Error(`missing record ${id}`)
      return rec.combatSequence
    }
    const seqOfEvent = (id: string): number => {
      const ev = h.scheduler.trace.events.find((e) => e.eventId === id)
      if (!ev) throw new Error(`missing event ${id}`)
      return ev.combatSequence
    }
    const seqA = seqOfOp('op.A')
    const seqE1 = seqOfEvent('evt.op.A.0')
    const seqE2 = seqOfEvent('evt.op.A.1')
    const seqX = seqOfOp('op.X')

    expect(seqA).toBe(1)
    expect(seqA).toBeLessThan(seqE1)
    expect(seqA).toBeLessThan(seqE2)
    expect(seqE1).toBeLessThan(seqX)
  })

  it('trace renders the causal tree from causation fields, not sequence order', () => {
    const h = makeHarness()
    h.emissions.set('op.A', [elem('e1'), elem('e2')])
    h.emissions.set('op.X', [elem('e3')])
    routeElemental(h, {
      e1: (event) => ({
        kind: 'operations',
        operations: [damageOp('op.X', { ...ORIGIN, causationEventId: event.eventId })],
      }),
      e2: () => undefined,
      e3: () => undefined,
    })
    h.scheduler.enqueueAuthored([damageOp('op.A')])

    h.scheduler.run()
    // Chronology: A=1, E1=2, E2=3, X=4, E3=5 -- the TREE parents by causation.
    const text = h.scheduler.trace.toString()
    const iA = text.indexOf('op op.A')
    const iE1 = text.indexOf('evt evt.op.A.0')
    const iX = text.indexOf('op op.X')
    const iE3 = text.indexOf('evt evt.op.X.0')
    const iE2 = text.indexOf('evt evt.op.A.1')
    expect(iA).toBeGreaterThanOrEqual(0)
    // Tree order: A -> E1 -> X -> E3 -> E2 (E2 nested under A, after E1 subtree).
    expect(iA).toBeLessThan(iE1)
    expect(iE1).toBeLessThan(iX)
    expect(iX).toBeLessThan(iE3)
    expect(iE3).toBeLessThan(iE2)
    // E2 is a sibling of E1 (same tree depth), not a child of X.
    const line = (s: string, i: number): string => {
      const start = s.lastIndexOf('\n', i) + 1
      const end = s.indexOf('\n', i)
      return s.slice(start, end === -1 ? s.length : end)
    }
    // Depth metric = column where the '+- '/`- ' connector starts.
    const depth = (s: string): number => {
      const plus = s.indexOf('+- ')
      const last = s.indexOf('`- ')
      if (plus === -1) return last
      if (last === -1) return plus
      return Math.min(plus, last)
    }
    expect(depth(line(text, iE2))).toBe(depth(line(text, iE1)))
    expect(depth(line(text, iE3))).toBeGreaterThan(depth(line(text, iX)))
  })
})

describe('dual settlement guard (r3 HIGH 5)', () => {
  it('recursive op->event->op nesting past maxSettlementNestingDepth faults with depth reason', () => {
    const h = makeHarness({ maxSettlementNestingDepth: 4 })
    let faultHandlerCalls = 0
    h.scheduler.registerImmediateHandler('combat_settlement_fault', () => {
      faultHandlerCalls++
    })
    let n = 0
    h.alwaysEmit.push(elem('loop'))
    routeElemental(h, {
      loop: () => ({ kind: 'operations', operations: [damageOp(`op.L${n++}`)] }),
    })
    h.scheduler.enqueueAuthored([damageOp('op.A')])

    expect(() => h.scheduler.run()).toThrow(CombatSettlementFault)
    expect(h.diagnosticEvents).toHaveLength(1)
    expect(h.diagnosticEvents[0]?.reason).toBe('settlement_depth_exceeded')
    expect(h.scheduler.trace.faults[0]?.reason).toBe('settlement_depth_exceeded')
    expect(h.scheduler.state).toBe('faulted')
    // Same out-of-band contract as the budget variant below: the stamped
    // fault event reached diagnosticSink + trace but NEVER an event queue,
    // and every committed op keeps its resolved result (sec.48).
    expect(faultHandlerCalls).toBe(0)
    expect(
      h.scheduler.trace.events.filter(
        (e) => e.type === 'combat_settlement_fault',
      ),
    ).toHaveLength(1)
    expect(h.scheduler.trace.records.length).toBeGreaterThan(0)
    for (const rec of h.scheduler.trace.records) {
      expect(rec.result.status).toBe('resolved')
    }
  })

  it('flat handler-emitted chain past maxImmediateWorkPerBarrier faults with budget reason', () => {
    const h = makeHarness({ maxImmediateWorkPerBarrier: 5 })
    h.emissions.set('op.A', [elem('loop')])
    routeElemental(h, {
      // Each handler emits the next event and returns nothing -- the chain
      // never nests deeper but never quiesces.
      loop: (_e, sink) => {
        sink.emit(elem('loop'))
      },
    })
    h.scheduler.enqueueAuthored([damageOp('op.A')])

    expect(() => h.scheduler.run()).toThrow(CombatSettlementFault)
    expect(h.diagnosticEvents[0]?.reason).toBe('settlement_work_budget_exceeded')
    expect(h.scheduler.trace.faults[0]?.reason).toBe(
      'settlement_work_budget_exceeded',
    )
  })

  it('work budget resets per ROOT unit: two authored roots of N work each pass with N < budget < 2N', () => {
    // Each authored root = 1 op + 2 emitted events = 3 work units.
    // Budget 4 sits between N(3) and 2N(6): without the per-root reset the
    // second root's cumulative 6 units would fault mid-frame.
    const h = makeHarness({ maxImmediateWorkPerBarrier: 4 })
    h.emissions.set('op.A', [elem('a1'), elem('a2')])
    h.emissions.set('op.B', [elem('b1'), elem('b2')])
    routeElemental(h, {})
    h.scheduler.enqueueAuthored([damageOp('op.A'), damageOp('op.B')])

    h.scheduler.run()
    expect(h.calls).toEqual([
      'op.A',
      'h:a1',
      'h:a2',
      'op.B',
      'h:b1',
      'h:b2',
    ])
    expect(
      h.scheduler.trace.records.map((r) => r.operation.operationId),
    ).toEqual(['op.A', 'op.B'])
    expect(h.scheduler.state).toBe('running')
    expect(h.diagnosticEvents).toHaveLength(0)
  })

  it('work budget reset also covers lifecycle root events', () => {
    // Root 1 (lifecycle event): settle + 2 handler-returned ops = 3 units.
    // Root 2 (authored op): execute + 2 emitted events = 3 units.
    // Budget 4 < combined 6 -- pass only if root 2 gets a fresh budget.
    const h = makeHarness({ maxImmediateWorkPerBarrier: 4 })
    h.emissions.set('op.A', [elem('a1'), elem('a2')])
    routeElemental(h, {
      e1: () => ({
        kind: 'operations',
        operations: [damageOp('op.X'), damageOp('op.Y')],
      }),
      a1: () => undefined,
      a2: () => undefined,
    })
    h.scheduler.createLifecycleSink('action.life.1').emit(elem('e1'))
    h.scheduler.enqueueAuthored([damageOp('op.A')])

    h.scheduler.run()
    // Root events drain before authored ops in each run() iteration.
    expect(h.calls).toEqual([
      'h:e1',
      'op.X',
      'op.Y',
      'op.A',
      'h:a1',
      'h:a2',
    ])
    expect(h.scheduler.state).toBe('running')
    expect(h.diagnosticEvents).toHaveLength(0)
  })
})

describe('out-of-band fault lane (r3 HIGH 6)', () => {
  it('fault event reaches diagnosticSink + trace but NEVER any event queue; committed op stays resolved', () => {
    const h = makeHarness({ maxImmediateWorkPerBarrier: 3 })
    let faultHandlerCalls = 0
    h.scheduler.registerImmediateHandler('combat_settlement_fault', () => {
      faultHandlerCalls++
    })
    h.emissions.set('op.A', [elem('loop')])
    routeElemental(h, {
      loop: (_e, sink) => {
        sink.emit(elem('loop'))
      },
    })
    h.scheduler.enqueueAuthored([damageOp('op.A')])

    expect(() => h.scheduler.run()).toThrow(CombatSettlementFault)
    expect(h.diagnosticEvents).toHaveLength(1)
    expect(h.diagnosticEvents[0]?.type).toBe('combat_settlement_fault')
    expect(h.diagnosticEvents[0]?.combatSequence).toBeTypeOf('number')
    expect(h.diagnosticEvents[0]?.traceDigest).toBeTypeOf('string')
    // Stamped for trace completeness, but never queued -- no handler saw it.
    expect(faultHandlerCalls).toBe(0)
    expect(
      h.scheduler.trace.events.filter(
        (e) => e.type === 'combat_settlement_fault',
      ),
    ).toHaveLength(1)
    // The committed originating op is never retro-failed (sec.48).
    const a = h.scheduler.trace.records.find(
      (r) => r.operation.operationId === 'op.A',
    )
    expect(a?.result.status).toBe('resolved')
    expect(h.scheduler.state).toBe('faulted')
  })
})

describe('lifecycle roots + periodic bridge (r4 BLOCKER 2 / r5 BLOCKER 2 / r5 HIGH 2+3)', () => {
  it('lifecycle sink emits PeriodicRequestsCommitted while quiescent -> built-in handler mints per-request origins', () => {
    const h = makeHarness()
    const sink = h.scheduler.createLifecycleSink('status.turn.5.p')
    sink.emit({
      type: 'periodic_requests_committed',
      holderId: 'entity.b',
      rootActionId: 'status.turn.5.p',
      requests: [periodicDamageReq('entity.a'), periodicHealReq('entity.a')],
    })

    h.scheduler.run()
    expect(h.calls).toEqual([
      'periodic.evt.status.turn.5.p.0.0',
      'periodic.evt.status.turn.5.p.0.1',
    ])
    const damage = h.damageCalls[0]
    expect(damage?.payload).toMatchObject({
      targetId: 'entity.b',
      damageProfile: 'legacy_dot',
      coefficient: 2,
      periodicId: 'dot',
    })
    expect(damage?.ctx.origin).toEqual({
      kind: 'buff_periodic',
      originId: 'bi.entity.a:dot',
      sourceId: 'entity.a',
      rootActionId: 'status.turn.5.p',
      causationEventId: 'evt.status.turn.5.p.0',
    })
    const heal = h.healCalls[0]
    expect(heal?.payload).toEqual({ targetId: 'entity.b', amount: 4 })
    expect(heal?.ctx.origin.causationEventId).toBe('evt.status.turn.5.p.0')
  })

  it('two lifecycle sinks for one rootActionId mint distinct eventIds (shared ordinal counter)', () => {
    const h = makeHarness()
    const s1 = h.scheduler.createLifecycleSink('status.turn.5.p')
    const s2 = h.scheduler.createLifecycleSink('status.turn.5.p')
    s1.emit({
      type: 'periodic_requests_committed',
      holderId: 'e',
      rootActionId: 'status.turn.5.p',
      requests: [],
    })
    s2.emit({
      type: 'periodic_requests_committed',
      holderId: 'e',
      rootActionId: 'status.turn.5.p',
      requests: [],
    })

    h.scheduler.run()
    const evts = h.scheduler.trace.events.filter(
      (e) => e.type === 'periodic_requests_committed',
    )
    expect(evts.map((e) => e.eventId)).toEqual([
      'evt.status.turn.5.p.0',
      'evt.status.turn.5.p.1',
    ])
  })

  it('op-scoped emission takes the same lane; multi-sourceId requests mint distinct origins', () => {
    const h = makeHarness()
    h.emissions.set('op.T', [
      {
        type: 'periodic_requests_committed',
        holderId: 'entity.b',
        rootActionId: 'action.turn.1.a',
        requests: [
          periodicDamageReq('entity.a'),
          periodicDamageReq('entity.c'),
          periodicHealReq('entity.d'),
        ],
      },
    ])
    h.scheduler.enqueueAuthored([
      {
        operationId: 'op.T',
        type: 'trigger_buff_periodic',
        origin: ORIGIN,
        payload: { selector: { kind: 'instance', instanceId: 'bi.1' } },
      },
    ])

    h.scheduler.run()
    expect(h.calls).toEqual([
      'op.T',
      'periodic.evt.op.T.0.0',
      'periodic.evt.op.T.0.1',
      'periodic.evt.op.T.0.2',
    ])
    // Per-request origins -- no fabricated shared sourceId (r5 BLOCKER 2).
    expect(h.damageCalls.map((c) => c.ctx.origin.sourceId)).toEqual([
      'entity.a',
      'entity.c',
    ])
    expect(h.healCalls[0]?.ctx.origin.sourceId).toBe('entity.d')
    for (const c of [...h.damageCalls, ...h.healCalls]) {
      expect(c.ctx.origin.kind).toBe('buff_periodic')
      expect(c.ctx.origin.causationEventId).toBe('evt.op.T.0')
    }
  })

  it('registerImmediateHandler is one-per-type -- duplicate registration is a structural fault', () => {
    const h = makeHarness()
    h.scheduler.registerImmediateHandler('elemental_application_committed', () => undefined)
    expect(() =>
      h.scheduler.registerImmediateHandler(
        'elemental_application_committed',
        () => undefined,
      ),
    ).toThrow(CombatSettlementFault)
    // The built-in periodic bridge handler counts too.
    expect(() =>
      h.scheduler.registerImmediateHandler(
        'periodic_requests_committed',
        () => undefined,
      ),
    ).toThrow(CombatSettlementFault)
  })
})

describe('root event frames (P5 F-A)', () => {
  it('a root-scope emission loop faults on the work budget -- the root lane is guarded', () => {
    const h = makeHarness({ maxImmediateWorkPerBarrier: 5 })
    const sink = h.scheduler.createLifecycleSink('action.life.1')
    routeElemental(h, {
      // Each emission re-queues the same event. Before frame-local root
      // queues this looped forever: every emitted event became a new root
      // unit with a fresh budget and a depth reset.
      loop: (_e, s) => {
        s.emit(elem('loop'))
      },
    })
    sink.emit(elem('loop'))

    expect(() => h.scheduler.run()).toThrow(CombatSettlementFault)
    expect(h.diagnosticEvents[0]?.reason).toBe(
      'settlement_work_budget_exceeded',
    )
    expect(h.scheduler.trace.faults[0]?.reason).toBe(
      'settlement_work_budget_exceeded',
    )
    expect(h.scheduler.state).toBe('faulted')
  })

  it('a root event\'s consequence tree drains before the next queued root (Option B)', () => {
    const h = makeHarness()
    const sink = h.scheduler.createLifecycleSink('action.life.1')
    routeElemental(h, {
      e1: (_e, s) => {
        s.emit(elem('e3'))
      },
      e3: () => ({ kind: 'operations', operations: [damageOp('op.X')] }),
      e2: () => undefined,
    })
    sink.emit(elem('e1'))
    sink.emit(elem('e2')) // queued behind e1 before run()

    h.scheduler.run()
    // e1 -> e3's whole consequence tree (h:e3 + its returned op.X) -> e2.
    expect(h.calls).toEqual(['h:e1', 'h:e3', 'op.X', 'h:e2'])
  })
})
