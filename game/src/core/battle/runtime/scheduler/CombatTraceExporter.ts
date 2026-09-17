// runtime/scheduler/CombatTraceExporter.ts -- dev-only export facade
// over CombatTrace (contract sec.85).
//
// The trace journals are already plain serializable data; this facade
// bundles them into ONE frozen snapshot for debugging/replay tooling.
// The sec.85 causal tree is NOT re-implemented here -- `tree` carries
// the trace's own toString() render. Programmatic consumers rebuild the
// causal graph from the causation fields on the exported records/events
// (origin.rootActionId / origin.parentOperationId /
// origin.causationEventId / event.causationOperationId /
// event.causationEventId) -- the same fields toString() resolves.
//
// DEV/DEBUG SURFACE ONLY: nothing on the gameplay path may depend on
// this module -- the scheduler/executor never touch it.

import type { CombatEvent } from '../../contracts/events'
import type { CombatOperationResult } from '../../contracts/results'
import type { CombatExecutionRecord } from '../../contracts/trace'

import type {
  CombatBatchSkipRecord,
  CombatFaultRecord,
  CombatTrace,
} from './CombatTrace'

/** One chronological journal entry -- an executed op or a stamped
    event, merged in combatSequence order. combatSequence is unique per
    stamp, so the merge order is unambiguous; note it is chronological
    creation/execution-start order, NOT the causal tree order. */
export type CombatTraceJournalEntry =
  | { kind: 'operation'; sequence: number; record: CombatExecutionRecord }
  | { kind: 'event'; sequence: number; event: CombatEvent }

/** Frozen serializable snapshot of a CombatTrace. */
export interface CombatTraceExport {
  /** sec.85 tree dump -- exactly `trace.toString()` at export time. */
  readonly tree: string
  /** Executions + events merged by combatSequence (chronological). */
  readonly journal: readonly CombatTraceJournalEntry[]
  /** Executed ops in record order (each op's combatSequence lives on
      the record -- r2 HIGH 2). */
  readonly executions: readonly CombatExecutionRecord[]
  /** Every stamped event in record order. */
  readonly events: readonly CombatEvent[]
  /** Guard/structural fault records (out-of-band lane mirror). */
  readonly faults: readonly CombatFaultRecord[]
  /** Atomic stale-skip records (sec.40-42 -- no queued event exists). */
  readonly batchSkips: readonly CombatBatchSkipRecord[]
  /** Results of ops that never executed (stale-skip entries, deferred
      dependency_not_resolved). */
  readonly skippedResults: readonly CombatOperationResult[]
}

export class CombatTraceExporter {
  constructor(private readonly trace: CombatTrace) {}

  /** Deep-cloned snapshot: an export taken mid-run stays frozen while
      settlement keeps mutating the live trace. */
  export(): CombatTraceExport {
    const executions = structuredClone(this.trace.records)
    const events = structuredClone(this.trace.events)
    const journal: CombatTraceJournalEntry[] = [
      ...executions.map(
        (record): CombatTraceJournalEntry => ({
          kind: 'operation',
          sequence: record.combatSequence,
          record,
        }),
      ),
      ...events.map(
        (event): CombatTraceJournalEntry => ({
          kind: 'event',
          sequence: event.combatSequence,
          event,
        }),
      ),
    ]
    journal.sort((a, b) => a.sequence - b.sequence)

    return {
      tree: this.trace.toString(),
      journal,
      executions,
      events,
      faults: structuredClone(this.trace.faults),
      batchSkips: structuredClone(this.trace.batchSkips),
      skippedResults: structuredClone(this.trace.skippedResults),
    }
  }
}
