// runtime/scheduler/CombatTrace.ts -- the execution + event journal
// (contract sec.85/sec.86).
//
// The CAUSAL tree is built from causation fields -- rootActionId /
// parentOperationId / causationOperationId / causationEventId -- NEVER by
// sorting on combatSequence (r6): sequence is chronological
// creation/execution-start order; depth-first settlement makes numeric
// order != tree order (A=1, E1=2, E2=3, X=4 settles A -> E1 -> X -> E2).

import type { CombatEvent } from '../../contracts/events'
import type { CombatOperationId } from '../../contracts/ids'
import type {
  CombatOperationResult,
  CombatOperationResultReason,
} from '../../contracts/results'
import type { CombatExecutionRecord } from '../../contracts/trace'

export interface CombatFaultRecord {
  /** Guard reasons ('settlement_depth_exceeded' /
      'settlement_work_budget_exceeded') for settlement faults, or
      'structural_fault' for broken command graphs / wiring. */
  reason: string
  traceDigest: string
}

/** Batch-level atomic stale-skip record (contract sec.42): the "skip
    event-equivalent" -- no queued gameplay event exists for it, so the
    trace carries the invalidation. */
export interface CombatBatchSkipRecord {
  batchId: string
  reason: CombatOperationResultReason
  operationIds: readonly CombatOperationId[]
}

export class CombatTrace {
  private readonly executions: CombatExecutionRecord[] = []
  private readonly eventLog: CombatEvent[] = []
  private readonly faultLog: CombatFaultRecord[] = []
  private readonly batchSkipLog: CombatBatchSkipRecord[] = []
  private readonly skippedResultLog: CombatOperationResult[] = []

  get records(): readonly CombatExecutionRecord[] {
    return this.executions
  }

  get events(): readonly CombatEvent[] {
    return this.eventLog
  }

  get faults(): readonly CombatFaultRecord[] {
    return this.faultLog
  }

  get batchSkips(): readonly CombatBatchSkipRecord[] {
    return this.batchSkipLog
  }

  /** Results recorded for ops that never executed (batch stale-skip
      entries, deferred dependency_not_resolved). */
  get skippedResults(): readonly CombatOperationResult[] {
    return this.skippedResultLog
  }

  recordExecution(record: CombatExecutionRecord): void {
    this.executions.push(record)
  }

  recordEvent(event: CombatEvent): void {
    this.eventLog.push(event)
  }

  recordFault(reason: string, traceDigest: string): void {
    this.faultLog.push({ reason, traceDigest })
  }

  recordBatchSkip(
    batchId: string,
    reason: CombatOperationResultReason,
    operationIds: readonly CombatOperationId[],
  ): void {
    this.batchSkipLog.push({ batchId, reason, operationIds })
  }

  recordSkippedResult(result: CombatOperationResult): void {
    this.skippedResultLog.push(result)
  }

  /** Compact deterministic summary stamped onto fault diagnostics. */
  digest(): string {
    const lastOp =
      this.executions.length > 0
        ? this.executions[this.executions.length - 1]?.operation.operationId
        : undefined
    const lastEvent =
      this.eventLog.length > 0
        ? this.eventLog[this.eventLog.length - 1]?.eventId
        : undefined
    return (
      `ops=${this.executions.length} events=${this.eventLog.length}` +
      ` lastOp=${lastOp ?? '-'} lastEvent=${lastEvent ?? '-'}`
    )
  }

  /** sec.85 tree dump -- parents resolved by causation fields; children
      ordered by combatSequence (chronological creation order). */
  toString(): string {
    interface Node {
      key: string
      label: string
      seq: number
      parentKey: string | null
    }
    const nodes = new Map<string, Node>()
    const rootOrder: string[] = []

    const ensureRoot = (rootActionId: string): string => {
      const key = `root:${rootActionId}`
      if (!nodes.has(key)) {
        nodes.set(key, {
          key,
          label: `root ${rootActionId}`,
          seq: Number.MAX_SAFE_INTEGER,
          parentKey: null,
        })
        rootOrder.push(key)
      }
      return key
    }

    const eventRootActionId = (event: CombatEvent): string | undefined => {
      switch (event.type) {
        case 'periodic_requests_committed':
          return event.rootActionId
        case 'elemental_application_committed':
        case 'buff_application_failed':
          return event.origin.rootActionId
        default:
          return undefined
      }
    }

    // Pass 1 -- create all nodes (parents resolve in pass 2 so forward
    // references work regardless of record/emit order).
    for (const rec of this.executions) {
      const op = rec.operation
      nodes.set(`op:${op.operationId}`, {
        key: `op:${op.operationId}`,
        label:
          `op ${op.operationId} seq=${rec.combatSequence}` +
          ` type=${op.type} status=${rec.result.status}` +
          (rec.result.reason !== undefined ? ` reason=${rec.result.reason}` : ''),
        seq: rec.combatSequence,
        parentKey: null,
      })
    }
    for (const event of this.eventLog) {
      nodes.set(`evt:${event.eventId}`, {
        key: `evt:${event.eventId}`,
        label: `evt ${event.eventId} seq=${event.combatSequence} type=${event.type}`,
        seq: event.combatSequence,
        parentKey: null,
      })
    }

    // Pass 2 -- resolve parents by causation.
    for (const rec of this.executions) {
      const node = nodes.get(`op:${rec.operation.operationId}`)
      if (node === undefined) continue
      const origin = rec.operation.origin
      if (
        origin.causationEventId !== undefined &&
        nodes.has(`evt:${origin.causationEventId}`)
      ) {
        node.parentKey = `evt:${origin.causationEventId}`
      } else if (
        origin.parentOperationId !== undefined &&
        nodes.has(`op:${origin.parentOperationId}`)
      ) {
        node.parentKey = `op:${origin.parentOperationId}`
      } else {
        node.parentKey = ensureRoot(origin.rootActionId)
      }
    }
    for (const event of this.eventLog) {
      const node = nodes.get(`evt:${event.eventId}`)
      if (node === undefined) continue
      if (
        event.causationOperationId !== undefined &&
        nodes.has(`op:${event.causationOperationId}`)
      ) {
        node.parentKey = `op:${event.causationOperationId}`
      } else if (
        event.causationEventId !== undefined &&
        nodes.has(`evt:${event.causationEventId}`)
      ) {
        node.parentKey = `evt:${event.causationEventId}`
      } else {
        const rootActionId = eventRootActionId(event)
        node.parentKey =
          rootActionId !== undefined ? ensureRoot(rootActionId) : null
      }
    }

    // Pass 3 -- attach children (chronological order within a parent) and
    // render. Root-group nodes keep first-encounter order; orphan nodes
    // (e.g. the out-of-band fault event) render top-level by sequence.
    const children = new Map<string, Node[]>()
    const topLevel: Node[] = []
    for (const node of nodes.values()) {
      if (node.key.startsWith('root:')) continue
      if (node.parentKey === null) {
        topLevel.push(node)
        continue
      }
      const list = children.get(node.parentKey)
      if (list === undefined) children.set(node.parentKey, [node])
      else list.push(node)
    }
    for (const list of children.values()) {
      list.sort((a, b) => a.seq - b.seq)
    }
    const roots = rootOrder
      .map((key) => nodes.get(key))
      .filter((n): n is Node => n !== undefined)
    topLevel.sort((a, b) => a.seq - b.seq)

    const lines: string[] = []
    const render = (node: Node, prefix: string, isLast: boolean): void => {
      lines.push(`${prefix}${isLast ? '`- ' : '+- '}${node.label}`)
      const kids = children.get(node.key) ?? []
      const childPrefix = `${prefix}${isLast ? '   ' : '|  '}`
      kids.forEach((kid, i) => render(kid, childPrefix, i === kids.length - 1))
    }
    const renderTop = (node: Node): void => {
      lines.push(node.label)
      const kids = children.get(node.key) ?? []
      kids.forEach((kid, i) => render(kid, '', i === kids.length - 1))
    }
    for (const root of roots) renderTop(root)
    for (const node of topLevel) renderTop(node)

    if (this.faultLog.length > 0) {
      lines.push('faults:')
      for (const f of this.faultLog) {
        lines.push(`  ${f.reason} digest=${f.traceDigest}`)
      }
    }
    if (this.batchSkipLog.length > 0) {
      lines.push('batch-skips:')
      for (const s of this.batchSkipLog) {
        lines.push(`  ${s.batchId} reason=${s.reason} ops=${s.operationIds.join(',')}`)
      }
    }
    if (this.skippedResultLog.length > 0) {
      lines.push('skipped:')
      for (const s of this.skippedResultLog) {
        lines.push(`  ${s.operationId} type=${s.type} reason=${s.reason ?? '-'}`)
      }
    }
    return lines.join('\n')
  }
}
