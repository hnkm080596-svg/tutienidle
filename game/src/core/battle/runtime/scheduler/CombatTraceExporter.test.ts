// CombatTraceExporter.test.ts -- the dev-only export facade: full
// serializable journal + the sec.85 tree, multi-root causation
// reconstruction, and the faults/batchSkips/skipped sections.

import { describe, expect, it } from 'vitest'

import type {
  CombatEvent,
  CombatEventPayload,
  CombatSettlementFaultEvent,
  ElementalApplicationCommitted,
} from '../../contracts/events'
import type { CombatOperationOrigin } from '../../contracts/origin'
import type { ResolvedCombatOperation } from '../../contracts/operations'
import type { BuffPeriodicDamageRequest } from '../../contracts/periodic'
import type { CombatOperationBatch, ImmediateSettlement } from '../../contracts/settlement'
import type { CombatEventSink } from '../../contracts/sink'
import type { CombatExecutionRecord } from '../../contracts/trace'

import type { CombatAuthorityPorts } from './CombatAuthorityPorts'
import { CombatOperationExecutor } from './CombatOperationExecutor'
import { CombatScheduler, type CombatSchedulerOptions } from './CombatScheduler'
import { CombatSettlementFault } from './CombatSettlementFault'
import { CombatTraceExporter, type CombatTraceExport } from './CombatTraceExporter'

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

function periodicDamageReq(sourceId: string): BuffPeriodicDamageRequest {
  return {
    instanceId: `bi.${sourceId}`,
    periodicId: 'dot',
    sourceId,
    targetId: 'entity.b',
    element: 'fire',
    damageProfile: 'legacy_dot',
    coefficient: 2,
    hitCount: 1,
    canCrit: false,
    canMiss: false,
    tags: ['periodic'],
  }
}

interface Harness {
  scheduler: CombatScheduler
  calls: string[]
  emissions: Map<string, CombatEventPayload[]>
  diagnosticEvents: CombatSettlementFaultEvent[]
}

function makeHarness(opts?: CombatSchedulerOptions): Harness {
  const calls: string[] = []
  const emissions = new Map<string, CombatEventPayload[]>()
  const diagnosticEvents: CombatSettlementFaultEvent[] = []

  const ports: CombatAuthorityPorts = {
    damage: {
      dealDamage: (_payload, ctx) => {
        calls.push(ctx.operationId)
        for (const p of emissions.get(ctx.operationId) ?? []) {
          ctx.events.emit(p)
        }
        return { rawDamage: 10, hpDamage: 10, killed: false }
      },
    },
  }

  const scheduler = new CombatScheduler(new CombatOperationExecutor(ports), {
    ...opts,
    diagnosticSink: { emit: (e) => diagnosticEvents.push(e) },
  })
  return { scheduler, calls, emissions, diagnosticEvents }
}

type ElemHandler = (
  event: ElementalApplicationCommitted,
  sink: CombatEventSink,
) => ImmediateSettlement | void

/** One handler per event type -- tests multiplex on instanceId. */
function routeElemental(h: Harness, routes: Record<string, ElemHandler>): void {
  h.scheduler.registerImmediateHandler(
    'elemental_application_committed',
    (event, sink) => {
      if (event.type !== 'elemental_application_committed') return
      h.calls.push(`h:${event.instanceId}`)
      return routes[event.instanceId]?.(event, sink)
    },
  )
}

// ---------------------------------------------------------------------------
// Independent re-derivation of the sec.85 parent rule -- the export carries
// raw journals; the causal tree must be reconstructable from the causation
// fields alone (never from combatSequence order).
// ---------------------------------------------------------------------------

function parentKeyOfExecution(rec: CombatExecutionRecord): string {
  const origin = rec.operation.origin
  if (origin.causationEventId !== undefined) {
    return `evt:${origin.causationEventId}`
  }
  if (origin.parentOperationId !== undefined) {
    return `op:${origin.parentOperationId}`
  }
  return `root:${origin.rootActionId}`
}

function parentKeyOfEvent(event: CombatEvent): string | null {
  if (event.causationOperationId !== undefined) {
    return `op:${event.causationOperationId}`
  }
  if (event.causationEventId !== undefined) {
    return `evt:${event.causationEventId}`
  }
  switch (event.type) {
    case 'periodic_requests_committed':
      return `root:${event.rootActionId}`
    case 'elemental_application_committed':
    case 'buff_application_failed':
      return `root:${event.origin.rootActionId}`
    default:
      return null
  }
}

/** Column where the '+- '/`- ' connector starts -- the rendered depth. */
function treeDepth(line: string): number {
  const plus = line.indexOf('+- ')
  const last = line.indexOf('`- ')
  if (plus === -1) return last
  if (last === -1) return plus
  return Math.min(plus, last)
}

function lineAt(text: string, needle: string): string {
  const i = text.indexOf(needle)
  if (i === -1) throw new Error(`tree is missing '${needle}'`)
  const start = text.lastIndexOf('\n', i) + 1
  const end = text.indexOf('\n', i)
  return text.slice(start, end === -1 ? text.length : end)
}

describe('CombatTraceExporter', () => {
  it('export reconstructs a multi-root causal tree (authored chain + lifecycle root)', () => {
    const h = makeHarness()
    // Authored chain: op.A -> evt E1 -> op.X -> evt E3 -> evt GC; E2 is
    // E1's sibling under op.A.
    h.emissions.set('op.A', [elem('e1'), elem('e2')])
    h.emissions.set('op.X', [elem('e3')])
    routeElemental(h, {
      e1: (event) => ({
        kind: 'operations',
        operations: [
          damageOp('op.X', { ...ORIGIN, causationEventId: event.eventId }),
        ],
      }),
      e2: () => undefined,
      e3: (_event, sink) => {
        sink.emit(elem('gc')) // grandchild event, caused BY e3
      },
      gc: () => undefined,
    })
    // Lifecycle root: a periodic tick with one damage request -- the
    // built-in bridge mints a child op caused by the lifecycle event.
    h.scheduler.createLifecycleSink('status.turn.1.p').emit({
      type: 'periodic_requests_committed',
      holderId: 'entity.b',
      rootActionId: 'status.turn.1.p',
      requests: [periodicDamageReq('entity.a')],
    })
    h.scheduler.enqueueAuthored([damageOp('op.A')])

    h.scheduler.run()
    const exp = new CombatTraceExporter(h.scheduler.trace).export()

    // The tree is the trace's own sec.85 render -- reused, not rebuilt.
    expect(exp.tree).toBe(h.scheduler.trace.toString())
    expect(exp.tree).toContain('root status.turn.1.p')
    expect(exp.tree).toContain('root action.turn.1.a')

    // Causation reconstructed from the exported fields alone.
    const parentOfOp = new Map(
      exp.executions.map((r) => [
        r.operation.operationId,
        parentKeyOfExecution(r),
      ]),
    )
    const parentOfEvt = new Map(
      exp.events.map((e) => [e.eventId, parentKeyOfEvent(e)]),
    )
    expect(parentOfEvt.get('evt.op.A.0')).toBe('op:op.A')
    expect(parentOfOp.get('op.X')).toBe('evt:evt.op.A.0')
    expect(parentOfEvt.get('evt.op.X.0')).toBe('op:op.X')
    expect(parentOfEvt.get('evt.evt.op.X.0.0')).toBe('evt:evt.op.X.0')
    expect(parentOfEvt.get('evt.op.A.1')).toBe('op:op.A')
    expect(parentOfEvt.get('evt.status.turn.1.p.0')).toBe(
      'root:status.turn.1.p',
    )
    expect(parentOfOp.get('periodic.evt.status.turn.1.p.0.0')).toBe(
      'evt:evt.status.turn.1.p.0',
    )

    // The rendered tree nests X under E1 and GC under E3; E2 stays at
    // E1's depth (a sibling, not a descendant of the X subtree).
    expect(treeDepth(lineAt(exp.tree, 'op op.X'))).toBeGreaterThan(
      treeDepth(lineAt(exp.tree, 'evt evt.op.A.0')),
    )
    expect(treeDepth(lineAt(exp.tree, 'evt evt.evt.op.X.0.0'))).toBeGreaterThan(
      treeDepth(lineAt(exp.tree, 'evt evt.op.X.0')),
    )
    expect(treeDepth(lineAt(exp.tree, 'evt evt.op.A.1'))).toBe(
      treeDepth(lineAt(exp.tree, 'evt evt.op.A.0')),
    )
    expect(
      treeDepth(lineAt(exp.tree, 'op periodic.evt.status.turn.1.p.0.0')),
    ).toBeGreaterThan(
      treeDepth(lineAt(exp.tree, 'evt evt.status.turn.1.p.0')),
    )

    // Chronological journal: unique, strictly increasing sequences.
    const seqs = exp.journal.map((j) => j.sequence)
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b))
    expect(new Set(seqs).size).toBe(seqs.length)
    expect(exp.journal).toHaveLength(
      exp.executions.length + exp.events.length,
    )
    // The lifecycle event was committed first (sink emit precedes run()).
    expect(exp.journal[0]).toMatchObject({
      kind: 'event',
      event: { eventId: 'evt.status.turn.1.p.0' },
    })

    // Fully serializable.
    const roundTripped = JSON.parse(JSON.stringify(exp)) as CombatTraceExport
    expect(roundTripped.tree).toBe(exp.tree)
    expect(roundTripped.executions).toHaveLength(exp.executions.length)
    expect(roundTripped.journal).toHaveLength(exp.journal.length)

    // No faults/skips occurred: the sections stay empty AND the tree
    // renders no section headers for them.
    expect(exp.faults).toHaveLength(0)
    expect(exp.batchSkips).toHaveLength(0)
    expect(exp.skippedResults).toHaveLength(0)
    expect(exp.tree).not.toContain('faults:')
    expect(exp.tree).not.toContain('batch-skips:')
    expect(exp.tree).not.toContain('skipped:')
  })

  it('export is a frozen snapshot -- later settlement does not mutate it', () => {
    const h = makeHarness()
    routeElemental(h, {})
    h.scheduler.enqueueAuthored([damageOp('op.A')])
    h.scheduler.run()

    const exp = new CombatTraceExporter(h.scheduler.trace).export()
    const execCount = exp.executions.length

    h.scheduler.enqueueAuthored([damageOp('op.B')])
    h.scheduler.run()

    expect(h.scheduler.trace.records.length).toBe(execCount + 1)
    expect(exp.executions).toHaveLength(execCount)
    expect(exp.executions.some((r) => r.operation.operationId === 'op.B')).toBe(
      false,
    )
  })

  it('fault / batchSkip / skipped sections populate when the trace carries them', () => {
    const h = makeHarness({
      maxImmediateWorkPerBarrier: 6,
      preconditions: { isAlive: (id) => id !== 'entity.b' },
    })
    let faultHandlerCalls = 0
    h.scheduler.registerImmediateHandler('combat_settlement_fault', () => {
      faultHandlerCalls++
    })
    h.emissions.set('op.A', [elem('e1'), elem('e2')])
    const staleBatch: CombatOperationBatch = {
      batchId: 'b.1',
      origin: ORIGIN,
      preconditions: [{ kind: 'entity_alive', entityId: 'entity.b' }],
      operations: [damageOp('batch.B1'), damageOp('batch.B2')],
    }
    routeElemental(h, {
      // e1: stale batch -> atomic skip (batchSkips + skippedResults).
      e1: () => ({ kind: 'batch', batch: staleBatch }),
      // e2 + loop: flat self-emitting chain -> work-budget guard fault.
      e2: (_e, sink) => {
        sink.emit(elem('loop'))
      },
      loop: (_e, sink) => {
        sink.emit(elem('loop'))
      },
    })
    h.scheduler.enqueueAuthored([damageOp('op.A')])

    expect(() => h.scheduler.run()).toThrow(CombatSettlementFault)
    // A throwing run() still leaves the committed journal exportable.
    const exp = new CombatTraceExporter(h.scheduler.trace).export()

    expect(exp.faults).toHaveLength(1)
    expect(exp.faults[0]?.reason).toBe('settlement_work_budget_exceeded')
    expect(exp.faults[0]?.traceDigest).toBeTypeOf('string')
    expect(exp.batchSkips).toEqual([
      {
        batchId: 'b.1',
        reason: 'stale_reaction_snapshot',
        operationIds: ['batch.B1', 'batch.B2'],
      },
    ])
    expect(exp.skippedResults).toEqual([
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

    // The fault event was stamped for trace completeness but reached NO
    // handler -- it lives in the events journal + the faults section only.
    expect(faultHandlerCalls).toBe(0)
    expect(
      exp.events.filter((e) => e.type === 'combat_settlement_fault'),
    ).toHaveLength(1)
    expect(
      exp.executions.find((r) => r.operation.operationId === 'op.A')?.result
        .status,
    ).toBe('resolved')

    expect(exp.tree).toContain('faults:')
    expect(exp.tree).toContain('batch-skips:')
    expect(exp.tree).toContain('skipped:')
    expect(exp.tree).toContain('settlement_work_budget_exceeded')
    expect(exp.tree).toContain('stale_reaction_snapshot')
    expect(h.diagnosticEvents).toHaveLength(1)
  })
})

describe('trace determinism (sec.87 -- the trace half)', () => {
  it('the same scenario twice produces identical exported traces (ops, events, combatSequence)', () => {
    // Two-level causal chain, RNG-free path: op.A -> E1 -> op.X -> E3
    // -> op.Z, plus sibling event E2. Exported/journaled traces must be
    // deep-equal -- same operation order, same event order, same
    // combatSequence assignment -- proving trace determinism by
    // mechanism rather than vacuously on an empty dormant trace.
    const runScenario = (): CombatTraceExport => {
      const h = makeHarness()
      h.emissions.set('op.A', [elem('e1'), elem('e2')])
      h.emissions.set('op.X', [elem('e3')])
      routeElemental(h, {
        e1: (event) => ({
          kind: 'operations',
          operations: [
            damageOp('op.X', { ...ORIGIN, causationEventId: event.eventId }),
          ],
        }),
        e2: () => undefined,
        e3: (event) => ({
          kind: 'operations',
          operations: [
            damageOp('op.Z', { ...ORIGIN, causationEventId: event.eventId }),
          ],
        }),
      })
      h.scheduler.enqueueAuthored([damageOp('op.A')])
      h.scheduler.run()
      return new CombatTraceExporter(h.scheduler.trace).export()
    }

    const first = runScenario()
    const second = runScenario()

    expect(second).toEqual(first)
    expect(second.tree).toBe(first.tree)
    // Named assertions so a diff reports the drifted axis directly.
    expect(
      second.executions.map((r) => r.operation.operationId),
    ).toEqual(['op.A', 'op.X', 'op.Z'])
    expect(second.events.map((e) => e.eventId)).toEqual([
      'evt.op.A.0',
      'evt.op.A.1',
      'evt.op.X.0',
    ])
    expect(second.journal.map((j) => j.sequence)).toEqual(
      first.journal.map((j) => j.sequence),
    )
  })
})
