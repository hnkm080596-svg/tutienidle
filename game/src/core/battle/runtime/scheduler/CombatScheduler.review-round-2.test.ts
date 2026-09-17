// CombatScheduler.review-round-2.test.ts -- regression tests for the
// P5 three-lens review round on 6ed1ea33 (Lens B/C findings). Kept in a
// separate file because CombatScheduler.test.ts carries uncommitted
// user edits.

import { describe, expect, it } from 'vitest'

import type { CombatEventPayload } from '../../contracts/events'
import type { CombatOperationOrigin } from '../../contracts/origin'
import type { ResolvedCombatOperation } from '../../contracts/operations'
import type {
  BuffPeriodicDamageRequest,
  BuffPeriodicHealRequest,
} from '../../contracts/periodic'
import type { CombatEventSink } from '../../contracts/sink'

import type { BuffAuthority, CombatAuthorityPorts } from './CombatAuthorityPorts'
import { CombatOperationExecutor } from './CombatOperationExecutor'
import { CombatScheduler, type CombatSchedulerOptions } from './CombatScheduler'
import { CombatSettlementFault } from './CombatSettlementFault'

const ORIGIN: CombatOperationOrigin = {
  kind: 'skill',
  originId: 'skill.test',
  sourceId: 'entity.a',
  rootActionId: 'action.turn.1.a',
}

function damageOp(operationId: string): ResolvedCombatOperation {
  return {
    operationId,
    type: 'deal_damage',
    origin: ORIGIN,
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

function damageReq(
  requestId: string,
  extra: Partial<BuffPeriodicDamageRequest> = {},
): BuffPeriodicDamageRequest {
  return {
    requestId,
    instanceId: `bi.${requestId}`,
    periodicId: 'dot',
    sourceId: 'entity.a',
    targetId: 'entity.b',
    element: 'fire',
    damageProfile: 'legacy_dot',
    coefficient: 2,
    hitCount: 1,
    canCrit: false,
    canMiss: false,
    ...extra,
  }
}

function healReq(requestId: string): BuffPeriodicHealRequest {
  return {
    requestId,
    instanceId: `bi.${requestId}`,
    periodicId: 'hot',
    sourceId: 'entity.a',
    targetId: 'entity.b',
    amount: 4,
  }
}

interface Harness {
  scheduler: CombatScheduler
  calls: string[]
  damagePayloads: ResolvedCombatOperation extends never
    ? never
    : import('../../contracts/operations').DealDamageOperation['payload'][]
  emitsPerExecute: Map<string, number>
  periodicEmits: number
}

function makeHarness(opts?: CombatSchedulerOptions): Harness {
  const calls: string[] = []
  const damagePayloads: Harness['damagePayloads'] = []
  const emitsPerExecute = new Map<string, number>()
  let periodicEmits = 0

  const emitN = (opId: string, sink: CombatEventSink): void => {
    const n = emitsPerExecute.get(opId) ?? 0
    for (let i = 0; i < n; i++) {
      sink.emit({
        type: 'buff_application_failed',
        definitionId: 'def.x',
        sourceId: 'entity.a',
        targetId: 'entity.b',
        reason: 'application_roll_failed',
        origin: ORIGIN,
      })
    }
    for (let i = 0; i < periodicEmits; i++) {
      sink.emit({
        type: 'periodic_requests_committed',
        trigger: { type: 'interval' },
        rootActionId: 'root.flood',
        requests: [damageReq(`req.flood.${i}`)],
      })
    }
  }

  const ports: CombatAuthorityPorts = {
    damage: {
      dealDamage: (payload, ctx) => {
        calls.push(ctx.operationId)
        damagePayloads.push(payload)
        emitN(ctx.operationId, ctx.events)
        return { rawDamage: 10, hpDamage: 10, killed: false }
      },
    },
    heal: {
      heal: (payload, ctx) => {
        calls.push(ctx.operationId)
        return { requested: payload.amount, healed: payload.amount, after: 50 }
      },
    },
    buffs: {
      apply: () => ({ applied: true }),
      addStacks: () => ({ stacksBefore: 0, stacksAfter: 0 }),
      removeStacks: () => ({ stacksBefore: 0, stacksAfter: 0 }),
      consumeStacks: () => ({ consumed: 0, remaining: 0, removed: false }),
      addModifier: () => ({ applied: true }),
      removeModifier: () => ({ removed: true, removedRuntimeIds: [] }),
      refreshDuration: () => ({ durationBefore: 0, durationAfter: 0 }),
      extendDuration: () => ({ durationBefore: 0, durationAfter: 0 }),
      triggerPeriodic: () => ({ started: false, candidateUnitCount: 0 }),
      remove: () => ({ removed: false }),
      setStacks: () => ({ stacksBefore: 0, stacksAfter: 0 }),
      setRemainingDuration: () => ({ durationBefore: 0, durationAfter: 0 }),
      cleanse: () => ({ cleansed: [], skipped: [] }),
    } satisfies BuffAuthority,
  }

  return {
    scheduler: new CombatScheduler(new CombatOperationExecutor(ports), opts),
    calls,
    damagePayloads,
    emitsPerExecute,
    get periodicEmits() {
      return periodicEmits
    },
    set periodicEmits(v: number) {
      periodicEmits = v
    },
  }
}

describe('Lens C3 -- multi-request settled ordering', () => {
  it('all sibling periodic ops settle BEFORE any settled event fires, in request order', () => {
    const h = makeHarness()
    const order: string[] = []
    h.scheduler.registerImmediateHandler('periodic_operation_settled', (event) => {
      order.push(`settled:${(event as { requestId: string }).requestId}`)
    })
    const { sink } = h.scheduler.createLifecycleSink('status.turn.1.p')
    sink.emit({
      type: 'periodic_requests_committed',
      trigger: { type: 'interval' },
      rootActionId: 'status.turn.1.p',
      requests: [damageReq('req.a.1'), damageReq('req.a.2')],
    })
    h.scheduler.run()
    const full = [...h.calls, ...order]
    expect(full).toEqual([
      'periodic.req.a.1',
      'periodic.req.a.2',
      'settled:req.a.1',
      'settled:req.a.2',
    ])
  })
})

describe('Lens C4 -- lifecycle settle() drain semantics', () => {
  it('settle() drains authored ops AND root events; collector reports every executed op', () => {
    const h = makeHarness()
    h.scheduler.enqueueAuthored([damageOp('op.authored.1')])
    const { sink, settle } = h.scheduler.createLifecycleSink('status.turn.9.x')
    sink.emit({
      type: 'periodic_requests_committed',
      trigger: { type: 'interval' },
      rootActionId: 'status.turn.9.x',
      requests: [damageReq('req.x.1')],
    })
    const statuses = settle()
    // Both the authored op and the bridge-minted periodic op drained +
    // reported by the collector. Drain order pinned: root events settle
    // BEFORE authored ops (the drain loop's queue priority).
    expect(statuses.get('op.authored.1')).toBe('resolved')
    expect(statuses.get('periodic.req.x.1')).toBe('resolved')
    expect(h.calls).toEqual(['periodic.req.x.1', 'op.authored.1'])
    // settle() twice is legal (second drain is empty)
    expect(settle().size).toBe(0)
  })
})

describe('Lens C2 -- event mint flood counts against the whole-run budget', () => {
  it('an authority emitting more events than the run budget faults instead of flooding', () => {
    const h = makeHarness({ maxTotalWorkPerRun: 10 })
    h.emitsPerExecute.set('op.flood', 30)
    h.scheduler.enqueueAuthored([damageOp('op.flood')])
    expect(() => h.scheduler.run()).toThrow(CombatSettlementFault)
    expect(h.scheduler.trace.faults[0]?.reason).toBe(
      'settlement_work_budget_exceeded',
    )
  })
})

describe('Lens B6 -- scheduler-originated event types are unforgeable', () => {
  it.each(['periodic_operation_settled', 'combat_settlement_fault'] as const)(
    "a sink emit smuggling type '%s' is a structural fault",
    (type) => {
      const h = makeHarness()
      const { sink } = h.scheduler.createLifecycleSink('status.turn.1.f')
      expect(() =>
        sink.emit({ type, requestId: 'req.x' } as unknown as CombatEventPayload),
      ).toThrow(CombatSettlementFault)
    },
  )
})

describe('Lens B3 (rejected: pinned contract) + C8 -- intake API hardening', () => {
  it('enqueueEvent post-fault silently drops -- pinned P5 T1 contract, NOT a hole', () => {
    const h = makeHarness()
    h.scheduler.registerImmediateHandler('elemental_application_committed', () => {
      throw new Error('boom')
    })
    const { sink } = h.scheduler.createLifecycleSink('status.turn.1.e')
    sink.emit({
      type: 'elemental_application_committed',
      instanceId: 'bi.1',
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
    })
    expect(() => h.scheduler.run()).toThrow()
    const stamped = h.scheduler.trace.events.length
    // Event lanes silently drop post-fault: a throwing intake inside a
    // drain frame would mask the originating fault. Command lanes
    // (enqueueAuthored/run/createLifecycleSink) still fail fast.
    h.scheduler.enqueueEvent({
      eventId: 'evt.post.fault',
      type: 'buff_application_failed',
      definitionId: 'def.x',
      sourceId: 'entity.a',
      targetId: 'entity.b',
      reason: 'application_roll_failed',
      origin: ORIGIN,
    })
    expect(h.scheduler.trace.events.length).toBe(stamped)
    expect(() =>
      h.scheduler.enqueueAuthored([damageOp('op.late')]),
    ).toThrow(CombatSettlementFault)
  })

  it('malformed intake is a structural fault, not a raw TypeError', () => {
    // Separate harnesses: the first malformed intake faults the scheduler,
    // after which event lanes correctly enter silent-drop mode.
    expect(() =>
      makeHarness().scheduler.enqueueAuthored(null as never),
    ).toThrow(CombatSettlementFault)
    expect(() =>
      makeHarness().scheduler.registerImmediateHandler('x', null as never),
    ).toThrow(CombatSettlementFault)
    expect(() =>
      makeHarness().scheduler.enqueueEvent({
        type: 'buff_application_failed',
      } as never),
    ).toThrow(CombatSettlementFault)
  })
})

describe('Lens C6 + C5 -- batch structural validation tightenings', () => {
  it("'periodic.*' op ids are rejected inside batches (scheduler-reserved namespace)", () => {
    const h = makeHarness()
    h.scheduler.registerImmediateHandler('elemental_application_committed', () => ({
      kind: 'batch',
      batch: {
        batchId: 'batch.evil',
        origin: ORIGIN,
        preconditions: [],
        operations: [damageOp('periodic.req.forged.1')],
      },
    }))
    const { sink } = h.scheduler.createLifecycleSink('status.turn.1.b')
    sink.emit({
      type: 'elemental_application_committed',
      instanceId: 'bi.1',
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
    })
    expect(() => h.scheduler.run()).toThrow(CombatSettlementFault)
  })

  it('negative deferred fraction is a structural fault (would mint negative heal)', () => {
    const h = makeHarness()
    h.scheduler.registerImmediateHandler('elemental_application_committed', () => ({
      kind: 'batch',
      batch: {
        batchId: 'batch.neg',
        origin: ORIGIN,
        preconditions: [],
        operations: [
          damageOp('op.src'),
          {
            kind: 'heal_from_damage_result',
            operationId: 'op.heal.neg',
            resultOperationId: 'op.src',
            healTarget: 'source',
            fraction: -0.5,
            origin: ORIGIN,
          },
        ],
      },
    }))
    const { sink } = h.scheduler.createLifecycleSink('status.turn.1.n')
    sink.emit({
      type: 'elemental_application_committed',
      instanceId: 'bi.2',
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
    })
    expect(() => h.scheduler.run()).toThrow(CombatSettlementFault)
  })
})

describe('Lens B2 + B5 -- periodic bridge request validation + forwarding', () => {
  it('malformed request (heal missing amount) is a structural fault', () => {
    const h = makeHarness()
    const { sink } = h.scheduler.createLifecycleSink('status.turn.1.m')
    sink.emit({
      type: 'periodic_requests_committed',
      trigger: { type: 'interval' },
      rootActionId: 'status.turn.1.m',
      requests: [
        { ...healReq('req.bad.1'), amount: undefined } as never,
      ],
    })
    expect(() => h.scheduler.run()).toThrow(CombatSettlementFault)
  })

  it('snapshot + stackCount forward onto the deal_damage payload', () => {
    const h = makeHarness()
    const { sink } = h.scheduler.createLifecycleSink('status.turn.1.s')
    sink.emit({
      type: 'periodic_requests_committed',
      trigger: { type: 'interval' },
      rootActionId: 'status.turn.1.s',
      requests: [
        damageReq('req.snap.1', {
          stackCount: 3,
          snapshot: { attack: 100, element_mastery: 5 },
        }),
      ],
    })
    h.scheduler.run()
    expect(h.damagePayloads[0]?.stackCount).toBe(3)
    expect(h.damagePayloads[0]?.snapshot).toEqual({ attack: 100, element_mastery: 5 })
  })
})
