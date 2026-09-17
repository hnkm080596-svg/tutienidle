// runtime/scheduler/CombatScheduler.ts -- the intra-action operation
// scheduler (contract sec.55-59 + review r5/r6 corrections).
//
// Owns: combatSequence allocation (sole allocator), the per-operation
// settlement barrier, per-execution event frames (depth-first consequence
// trees), batch frames, exactly-once event delivery, the dual settlement
// guard, and the out-of-band fault lane.
//
// Key locked invariants:
// - EVENT QUEUES ARE PER-EXECUTION FRAMES (r5 BLOCKER 1): an op's
//   emissions drain inside ITS barrier -- before its siblings and before
//   outer queued events. A global FIFO would produce E1 -> X -> E2 -> E3;
//   the correct order is E1 -> X -> E3 -> Z -> Y -> E2. ROOT events get
//   the same frame treatment: their consequence tree drains before the
//   next queued root, inside the root's single work budget.
// - combatSequence = chronological creation/execution-start order (r6):
//   ops stamp at execution-START (before executor.execute -- an authority
//   emits mid-execute), events stamp at enqueue-commit. It is NOT a
//   depth-first completion order; causality lives in the causation
//   fields.
// - Handler-emitted events settle AFTER the handler's returned
//   settlement (r5 HIGH 4).
// - Op-id reservation is group-atomic (r5 BLOCKER 3): enqueueAuthored,
//   handler-returned op lists and batches all validate + reserve every
//   id before the first member executes.
// - Batch frames: structural validation BEFORE runtime preflight
//   (r5 HIGH 1); preflight failure is an atomic stale-skip (sec.40-42).
// - FAULT (r3 HIGH 6 + r4 MEDIUM 2): trace.recordFault +
//   diagnosticSink.emit(CombatSettlementFaultEvent) + state='faulted' +
//   halt; dev/test throws CombatSettlementFault. The fault event is
//   stamped for trace completeness but NEVER pushed to any event queue.

import type {
  CombatEvent,
  CombatSettlementFaultEvent,
  PendingCombatEvent,
  PeriodicOperationSettled,
} from '../../contracts/events'
import type { CombatAuthorityExecutionContext } from '../../contracts/context'
import type { CombatOperationId } from '../../contracts/ids'
import type { ResolvedCombatOperation } from '../../contracts/operations'
import type { CombatOperationOrigin } from '../../contracts/origin'
import type { PeriodicRequestsCommitted } from '../../contracts/events'
import type { CombatOperationResult, CombatOperationResultStatus } from '../../contracts/results'
import type {
  CombatOperationBatch,
  DeferredOperation,
  ImmediateSettlement,
} from '../../contracts/settlement'
import type { CombatEventSink } from '../../contracts/sink'

import {
  ScopedCombatEventSink,
  type CombatEventSinkHost,
} from './CombatEventSink'
import {
  CombatSettlementFault,
  type CombatDiagnosticSink,
  type CombatSettlementGuardReason,
} from './CombatSettlementFault'
import { CombatOperationExecutor } from './CombatOperationExecutor'
import {
  BatchResultStore,
  CombatOperationBatchRunner,
  isDeferredOperation,
  resultTypeOfBatchEntry,
  type PreconditionChecker,
} from './CombatOperationBatchRunner'
import { CombatTrace } from './CombatTrace'

export const MAX_SETTLEMENT_NESTING_DEPTH = 64
export const MAX_IMMEDIATE_WORK_PER_BARRIER = 1024
/** Whole-drain work bound (Lens C M1): mid-run intake (lifecycle-sink /
    enqueueEvent / enqueueAuthored during an in-flight run) lands on the
    root queues, and each root unit legitimately resets the per-root
    budget -- so a cross-root ping-pong could mint unbounded fresh-budget
    roots forever. This bound caps TOTAL work across every root inside one
    drain call; the per-root budget still bounds each root's own tree. */
export const MAX_TOTAL_WORK_PER_RUN = 65536

export type ImmediateEventHandler = (
  event: CombatEvent,
  sink: CombatEventSink,
) => ImmediateSettlement | void

export interface CombatSchedulerOptions {
  /** Recursive frame guard (default 64). */
  maxSettlementNestingDepth?: number
  /** Flat-chain work budget PER ROOT unit (default 1024). */
  maxImmediateWorkPerBarrier?: number
  /** Total work budget across ALL roots of one drain call (default
      65536) -- closes the mid-run-intake livelock hole where each
      cross-root hop mints a fresh per-root budget. */
  maxTotalWorkPerRun?: number
  /** Batch precondition read-port (M2: isAlive + getBuffInstance only). */
  preconditions?: PreconditionChecker
  /** Out-of-band fault lane -- receives the stamped fault event. */
  diagnosticSink?: CombatDiagnosticSink
}

export class CombatScheduler {
  private readonly executor: CombatOperationExecutor
  private readonly maxSettlementNestingDepth: number
  private readonly maxImmediateWorkPerBarrier: number
  private readonly maxTotalWorkPerRun: number
  private readonly diagnosticSink: CombatDiagnosticSink | undefined
  private readonly batchRunner: CombatOperationBatchRunner

  /** Authored intent -- a settlement barrier after EACH op. */
  private readonly authoredQueue: ResolvedCombatOperation[] = []
  /** Events with no parent op (lifecycle/script/proc roots). */
  private readonly rootEventQueue: CombatEvent[] = []
  /** THE dedup point -- checked at enqueue only (r4 HIGH 1). */
  private readonly acceptedEventIds = new Set<string>()
  /** GLOBAL op-id uniqueness (r3 HIGH). */
  private readonly seenOperationIds = new Set<CombatOperationId>()
  /** Scope-id -> next event ordinal; shared by ALL sinks of one scope
      (r5 HIGH 2). */
  private readonly eventOrdinalByScope = new Map<string, number>()
  private readonly handlers = new Map<string, ImmediateEventHandler>()

  /** The accumulated journal -- public so a faulted run() (which throws)
      still leaves the committed records inspectable. */
  readonly trace = new CombatTrace()

  private nextSequence = 1
  private settlementNestingDepth = 0
  /** Per-ROOT work budget (r5 HIGH 3) -- reset at each root unit. */
  private workThisBarrier = 0
  /** Whole-drain work budget (Lens C M1) -- reset once per drain call;
      counts every work unit across ALL roots so mid-run root intake
      cannot mint unbounded fresh-budget roots. */
  private workThisRun = 0
  /** v7.5 -- periodic correlation is SCHEDULER-PRIVATE: the built-in
      bridge records generatedOpId -> requestId here (post-reservation,
      v7.6); the post-barrier site reads+deletes it to emit
      PeriodicOperationSettled. No public op field -- unforgeable. */
  private readonly periodicRequestByOpId = new Map<CombatOperationId, string>()
  /** Scratch correlation written by the bridge while building ops;
      merged into periodicRequestByOpId only AFTER the produced group
      passes atomic id reservation (v7.6 r6 MINOR 2 hygiene). */
  private readonly pendingPeriodicCorrelation = new Map<CombatOperationId, string>()
  /** When set (inside a lifecycle settle()), every executed op's status is
      collected for the settle() result map. */
  private executionStatusCollector: Map<CombatOperationId, CombatOperationResultStatus> | null =
    null
  private schedulerState: 'running' | 'faulted' = 'running'
  /** Single-flight guard (P5 F-E): settlement is not reentrant -- an
      authority/handler calling run() mid-execute is a structural fault. */
  private runInFlight = false

  private readonly sinkHost: CombatEventSinkHost = {
    nextEventOrdinal: (scopeId) => this.nextEventOrdinal(scopeId),
    commitEvent: (pending, target) => this.commitEvent(pending, target),
  }

  constructor(
    executor: CombatOperationExecutor,
    opts?: CombatSchedulerOptions,
  ) {
    this.executor = executor
    this.maxSettlementNestingDepth =
      opts?.maxSettlementNestingDepth ?? MAX_SETTLEMENT_NESTING_DEPTH
    this.maxImmediateWorkPerBarrier =
      opts?.maxImmediateWorkPerBarrier ?? MAX_IMMEDIATE_WORK_PER_BARRIER
    this.maxTotalWorkPerRun =
      opts?.maxTotalWorkPerRun ?? MAX_TOTAL_WORK_PER_RUN
    this.diagnosticSink = opts?.diagnosticSink
    this.batchRunner = new CombatOperationBatchRunner(
      opts?.preconditions ?? { isAlive: () => true },
    )
    // Periodic bridge (r4 BLOCKER 2): the built-in handler converts each
    // typed request 1:1 into deal_damage/heal ops -- the scheduler is the
    // PRODUCER here (R-C2 consistent). One lane serves op-triggered and
    // lifecycle periodic resolution.
    this.handlers.set('periodic_requests_committed', (event) =>
      this.periodicBridge(event),
    )
  }

  get state(): 'running' | 'faulted' {
    return this.schedulerState
  }

  /** Validates + reserves ALL ids in the group ATOMICALLY before enqueue
      (r5 BLOCKER 3). Duplicate/malformed -> structural fault, zero
      enqueued. */
  enqueueAuthored(ops: readonly ResolvedCombatOperation[]): void {
    this.assertAccepting('enqueueAuthored')
    const ids = ops.map((op) => {
      if (typeof op !== 'object' || op === null) {
        this.structuralFault('enqueueAuthored: non-object operation entry')
      }
      return op.operationId
    })
    this.reserveOperationGroup(ids)
    for (const op of ops) this.authoredQueue.push(op)
  }

  /** Global op-id uniqueness (r3 HIGH) -- single-id form. Called per-GROUP
      atomically by the scheduler internals; producers may pre-reserve. */
  reserveOperationId(id: CombatOperationId): void {
    this.assertAccepting('reserveOperationId')
    this.assertReservable(id)
    this.seenOperationIds.add(id)
  }

  /** ONE handler per event type -- duplicate registration is a structural
      fault (r5 MEDIUM 3). The sink param is EVENT-SCOPED. */
  registerImmediateHandler(
    type: string,
    handler: ImmediateEventHandler,
  ): void {
    this.assertAccepting('registerImmediateHandler')
    if (typeof type !== 'string' || type.length === 0) {
      this.structuralFault('registerImmediateHandler: blank event type')
    }
    if (this.handlers.has(type)) {
      this.structuralFault(
        `duplicate immediate handler for event type '${type}'`,
      )
    }
    this.handlers.set(type, handler)
  }

  /** THE dedup point (r4 HIGH 1): external producers land on
      rootEventQueue; internal sinks route to their scope's target list
      via commitEvent. Duplicate eventId -> dropped, stamped once. */
  enqueueEvent(pending: PendingCombatEvent): void {
    this.commitEvent(pending, this.rootEventQueue)
  }

  /** PUBLIC lifecycle sink factory (r5 HIGH 2) -- buff lifecycle / proc
      roots emit via this; events land on rootEventQueue. Command-lane
      intake: post-fault creation is a structural fault (the sink's emits
      would silently drop anyway -- fail fast at creation instead).

      v7.1 -- returns the sink AND the root transaction's own
      combatSequence, allocated once at creation (R-C2 roots are real
      transactions; `status.turn.N.*` needs a truthful sequence for
      lifecycle-created state e.g. convertsToId). Sole allocator stays
      the scheduler.
      v7.2 -- also returns `settle`: runs the drain and reports
      opId -> status for every op EXECUTED during that call. Lifecycle
      authorities use it as the spec-sec.28 barrier; it is legal to call
      it once PER sequential periodic unit (v7.3 -- several settles
      inside one lifecycle entry).
      v7.3 -- `uses`-modifier correlation NO LONGER depends on this map:
      PeriodicOperationSettled events finalize pending marks inside the
      settlement tree itself. The map remains for diagnostics/tests. */
  createLifecycleSink(rootActionId: string): {
    sink: CombatEventSink
    sequence: number
    settle(): ReadonlyMap<CombatOperationId, CombatOperationResultStatus>
  } {
    this.assertAccepting('createLifecycleSink')
    const sequence = this.allocateSeq()
    const sink = new ScopedCombatEventSink(
      { kind: 'lifecycle', scopeId: rootActionId },
      this.rootEventQueue,
      this.sinkHost,
    )
    return {
      sink,
      sequence,
      settle: () => this.drainForLifecycle(),
    }
  }

  /** The lifecycle barrier (spec sec.28): same drain loop as run(),
      single-flight guarded, and reports every op EXECUTED during this
      call (opId -> status). */
  private drainForLifecycle(): ReadonlyMap<
    CombatOperationId,
    CombatOperationResultStatus
  > {
    this.assertAccepting('lifecycle settle')
    if (this.runInFlight) {
      this.structuralFault(
        'lifecycle settle(): reentrant call during settlement',
      )
    }
    this.runInFlight = true
    const collector = new Map<CombatOperationId, CombatOperationResultStatus>()
    this.executionStatusCollector = collector
    try {
      this.drain()
    } catch (error) {
      this.schedulerState = 'faulted'
      if (this.trace.faults.length === 0) {
        this.trace.recordFault(
          error instanceof CombatSettlementFault
            ? 'structural_fault'
            : 'unexpected_error',
          this.trace.digest(),
        )
      }
      throw error
    } finally {
      this.executionStatusCollector = null
      this.runInFlight = false
    }
    return collector
  }

  /** Drains authored ops + root events until quiescent. Throws
      CombatSettlementFault on any guard/structural fault (dev/test).
      Single-flight + fail-fast post-fault (P5 F-E/T1): reentrant or
      post-fault calls are structural faults, never silent no-ops. */
  run(): CombatTrace {
    if (this.runInFlight) {
      this.structuralFault('run(): reentrant call during settlement')
    }
    this.assertAccepting('run')
    this.runInFlight = true
    try {
      this.drain()
    } catch (error) {
      // Any escape (guard fault, structural fault, authority error) kills
      // the scheduler -- it can never silently continue mid-frame.
      this.schedulerState = 'faulted'
      if (this.trace.faults.length === 0) {
        // Guard/structural faults already recorded themselves at their
        // site; record faults that originated elsewhere (e.g. an
        // executor missing-port throw or an authority error).
        this.trace.recordFault(
          error instanceof CombatSettlementFault
            ? 'structural_fault'
            : 'unexpected_error',
          this.trace.digest(),
        )
      }
      throw error
    } finally {
      this.runInFlight = false
    }
    return this.trace
  }

  /** The shared drain loop -- run() and lifecycle settle() both drive it.
      Each invocation gets a fresh WHOLE-DRAIN work budget (Lens C M1):
      mid-run root intake (lifecycle-sink emits / enqueueEvent /
      enqueueAuthored landing on the root queues) still mints fresh
      per-root budgets, but workThisRun caps the total so a cross-root
      ping-pong faults instead of livelocking. */
  private drain(): void {
    this.workThisRun = 0
    while (
      this.authoredQueue.length > 0 ||
      this.rootEventQueue.length > 0
    ) {
      if (this.schedulerState === 'faulted') break
      this.workThisBarrier = 0 // fresh budget per ROOT unit
      const rootEvent = this.rootEventQueue.shift()
      if (rootEvent !== undefined) {
        // Root events settle inside a frame-local queue -- symmetric
        // with op frames (r5 BLOCKER 1 + Option B). Handler emissions
        // land on THIS frame, share this root unit's work budget, and
        // drain depth-first before the next queued root event; pushing
        // them to rootEventQueue would grant each emission a fresh
        // budget + depth reset (an unguarded ping-pong loop).
        const frameEvents: CombatEvent[] = []
        this.settleEvent(rootEvent, frameEvents)
        this.drainEvents(frameEvents)
        continue
      }
      const op = this.authoredQueue.shift()
      if (op === undefined) continue
      this.executeOpWithBarrier(op)
    }
  }

  // ---------------------------------------------------------------------
  // Internals -- the corrected settlement semantics.
  // ---------------------------------------------------------------------

  /** Every op -- authored, generated, batch, deferred-materialized -- gets
      its own frame + its own barrier. */
  private executeOpWithBarrier(
    op: ResolvedCombatOperation,
  ): CombatOperationResult {
    // r6 BLOCKER -- sequence BEFORE execute: an authority emits via opSink
    // DURING execute; allocating here guarantees
    // seq(op) < seq(every event it emits).
    const combatSequence = this.allocateSeq()
    const frameEvents: CombatEvent[] = []
    // v7.2 -- the scheduler builds the WHOLE ctx (it owns the sequence +
    // the op-scoped sink); the executor never allocates or guesses.
    const ctx: CombatAuthorityExecutionContext = {
      operationId: op.operationId,
      origin: op.origin,
      events: this.createOperationSink(op, frameEvents),
      combatSequence,
    }
    const result = this.executor.execute(op, ctx)
    this.trace.recordExecution({ combatSequence, operation: op, result })
    this.executionStatusCollector?.set(op.operationId, result.status)
    this.workThisBarrier++
    this.workThisRun++
    if (this.workThisBarrier > this.maxImmediateWorkPerBarrier) {
      this.raiseGuardFault(
        'settlement_work_budget_exceeded',
        `work budget ${this.maxImmediateWorkPerBarrier} exceeded at op '${op.operationId}'`,
      )
    }
    if (this.workThisRun > this.maxTotalWorkPerRun) {
      this.raiseGuardFault(
        'settlement_work_budget_exceeded',
        `total work budget ${this.maxTotalWorkPerRun} exceeded at op '${op.operationId}'`,
      )
    }
    // sec.55: ALL of the op's consequences settle before its siblings.
    this.drainEvents(frameEvents)
    return result
  }

  private drainEvents(frameQueue: CombatEvent[]): void {
    while (frameQueue.length > 0 && this.schedulerState !== 'faulted') {
      const event = frameQueue.shift()
      if (event === undefined) break
      this.settleEvent(event, frameQueue)
    }
  }

  private settleEvent(event: CombatEvent, frameQueue: CombatEvent[]): void {
    this.settlementNestingDepth++
    try {
      if (this.settlementNestingDepth > this.maxSettlementNestingDepth) {
        this.raiseGuardFault(
          'settlement_depth_exceeded',
          `nesting depth ${this.maxSettlementNestingDepth} exceeded at event '${event.eventId}'`,
        )
      }
      this.workThisBarrier++
      this.workThisRun++
      if (this.workThisBarrier > this.maxImmediateWorkPerBarrier) {
        this.raiseGuardFault(
          'settlement_work_budget_exceeded',
          `work budget ${this.maxImmediateWorkPerBarrier} exceeded at event '${event.eventId}'`,
        )
      }
      if (this.workThisRun > this.maxTotalWorkPerRun) {
        this.raiseGuardFault(
          'settlement_work_budget_exceeded',
          `total work budget ${this.maxTotalWorkPerRun} exceeded at event '${event.eventId}'`,
        )
      }

      const emitted: CombatEvent[] = []
      const handler = this.handlers.get(event.type)
      // v7.6 hygiene -- a handler that mints bridge ops records scratch
      // correlation while building them; it only commits after the
      // produced group passes atomic reservation below. Clear leftovers
      // from any earlier frame before invoking this handler.
      this.pendingPeriodicCorrelation.clear()
      // The handler may emit via the event-scoped sink AND return a
      // settlement -- the returned settlement always runs first.
      const settlement = handler?.(
        event,
        this.createEventSink(event, emitted),
      )
      if (settlement !== undefined && settlement !== null) {
        if (settlement.kind === 'operations') {
          // r5 BLOCKER 3 -- validate + reserve the WHOLE produced group
          // atomically before its first member executes.
          const ops = settlement.operations
          if (!Array.isArray(ops)) {
            this.structuralFault(
              `handler for '${event.type}' returned a malformed operations settlement`,
            )
          }
          this.reserveOperationGroup(
            ops.map((op) =>
              typeof op === 'object' &&
              op !== null &&
              typeof op.operationId === 'string'
                ? op.operationId
                : '',
            ),
          )
          // v7.6 (r6 MINOR 2) -- the bridge's scratch correlation commits
          // ONLY now: after the whole group reserved successfully. A
          // structural fault above never reached this point, so no stale
          // entries pollute the private map.
          for (const [opId, reqId] of this.pendingPeriodicCorrelation) {
            this.periodicRequestByOpId.set(opId, reqId)
          }
          this.pendingPeriodicCorrelation.clear()
          for (const op of ops) {
            // each frame drains before the next sibling
            const result = this.executeOpWithBarrier(op)
            this.publishPeriodicOutcome(op, result, frameQueue)
          }
        } else if (settlement.kind === 'batch') {
          this.runBatchFrame(settlement.batch)
        } else {
          // Unknown settlement kind -- a broken command graph, not a
          // silent no-op.
          this.structuralFault(
            `handler for '${event.type}' returned a settlement with unknown kind '${String((settlement as { kind?: unknown }).kind)}'`,
          )
        }
      }
      // r5 HIGH 4 -- handler-emitted events settle AFTER the returned
      // settlement (already stamped at emit time; transfer only).
      for (const e of emitted) frameQueue.push(e)
    } finally {
      this.settlementNestingDepth--
    }
  }

  private runBatchFrame(batch: CombatOperationBatch): void {
    const batchLabel =
      typeof batch === 'object' && batch !== null
        ? String(batch.batchId)
        : '<malformed>'
    this.settlementNestingDepth++
    try {
      if (this.settlementNestingDepth > this.maxSettlementNestingDepth) {
        this.raiseGuardFault(
          'settlement_depth_exceeded',
          `nesting depth ${this.maxSettlementNestingDepth} exceeded at batch '${batchLabel}'`,
        )
      }
      // r5 HIGH 1 -- structural BEFORE runtime: a malformed command graph
      // is a fault independent of combat state.
      this.batchRunner.validateBatchStructure(batch)
      this.reserveOperationGroup(
        batch.operations.map((entry) => entry.operationId),
      )
      if (!this.batchRunner.preflight(batch)) {
        // sec.40-42 atomic stale-skip: zero ops run; the invalidation is
        // recorded (no queued gameplay event exists for it).
        this.trace.recordBatchSkip(
          batch.batchId,
          'stale_reaction_snapshot',
          batch.operations.map((entry) => entry.operationId),
        )
        for (const entry of batch.operations) {
          this.trace.recordSkippedResult({
            operationId: entry.operationId,
            type: resultTypeOfBatchEntry(entry),
            status: 'skipped',
            reason: 'stale_reaction_snapshot',
          } as CombatOperationResult)
        }
        return
      }

      const results = new BatchResultStore()
      for (const entry of batch.operations) {
        // Ordered, non-interleaved; per-op settle inside the frame (sec.43).
        if (this.schedulerState === 'faulted') return
        let op: ResolvedCombatOperation
        if (isDeferredOperation(entry)) {
          const prior = results.get(entry.resultOperationId)
          if (prior === undefined || prior.status !== 'resolved') {
            // r4 HIGH 2 -- never a silent heal-0.
            this.recordDeferredSkip(entry, results)
            continue
          }
          op = this.batchRunner.materialize(entry, results)
        } else {
          op = entry
        }
        const result = this.executeOpWithBarrier(op)
        results.record(op, result)
      }
      // Nested batches are allowed -- a batch op's event may return
      // {kind:'batch'}; it runs inside this frame via settleEvent.
    } finally {
      this.settlementNestingDepth--
    }
  }

  private recordDeferredSkip(
    entry: DeferredOperation,
    results: BatchResultStore,
  ): void {
    const skipped = {
      operationId: entry.operationId,
      type: 'heal',
      status: 'skipped',
      reason: 'dependency_not_resolved',
    } as CombatOperationResult
    results.recordResult(skipped)
    this.trace.recordSkippedResult(skipped)
  }

  /** v7.3/v7.5 -- periodic outcome publication: after a bridge-generated
      op's barrier, emit PeriodicOperationSettled into the ENCLOSING
      frame (FIFO after already-queued siblings -- deterministic; still
      inside this root transaction). PRIVATE correlation: the bridge
      recorded periodicRequestByOpId at generation time -- no public op
      field, no id parsing (r5 HIGH 3). The buff-side registered handler
      finalizes `uses` marks and drives manual-trigger continuation.

      STAMPING (v7.5 locked): eventId mints through the canonical
      per-scope allocator in the op's OWN scope --
      `evt.${opId}.${scopeOrdinal}` -- the same eventOrdinalByScope
      counter the op's sink uses (r5 HIGH 2: globally collision-proof by
      construction). causationOperationId = the periodic op's id;
      rootActionId copied from the op's origin; combatSequence =
      allocateSeq() at enqueue (op's seq allocated at ITS
      execution-start -> seq(op) < seq(settled)); recordEvent exactly
      once -- this site runs once per periodic op barrier. */
  private publishPeriodicOutcome(
    op: ResolvedCombatOperation,
    result: CombatOperationResult,
    frameQueue: CombatEvent[],
  ): void {
    const requestId = this.periodicRequestByOpId.get(op.operationId)
    if (requestId === undefined) return
    this.periodicRequestByOpId.delete(op.operationId) // one-shot entry
    const settled: PeriodicOperationSettled = {
      eventId: `evt.${op.operationId}.${this.nextEventOrdinal(op.operationId)}`,
      type: 'periodic_operation_settled',
      causationOperationId: op.operationId,
      requestId,
      operationId: op.operationId,
      rootActionId: op.origin.rootActionId,
      status: result.status,
      reason: result.reason,
      combatSequence: this.allocateSeq(), // seq(op) < seq(settled)
    }
    this.acceptedEventIds.add(settled.eventId)
    this.trace.recordEvent(settled)
    frameQueue.push(settled)
  }

  /** THE dedup point (r4 HIGH 1) -- stamps combatSequence only for
      never-seen eventIds (CON-19). `target` is the emitting scope's frame
      list -- op-local frameEvents / the handler's emitted list /
      rootEventQueue for lifecycle sinks. There is no shared global
      immediateQueue (r5 BLOCKER 1). */
  private commitEvent(pending: PendingCombatEvent, target: CombatEvent[]): void {
    if (this.schedulerState === 'faulted') return // halted: intake closed
    if (this.acceptedEventIds.has(pending.eventId)) return // stamped once
    this.acceptedEventIds.add(pending.eventId)
    const stamped = { ...pending, combatSequence: this.allocateSeq() } as CombatEvent
    this.trace.recordEvent(stamped)
    target.push(stamped)
  }

  // ---------------------------------------------------------------------
  // Faults.
  // ---------------------------------------------------------------------

  /** Guard fault -- r3 HIGH 6 + r4 MEDIUM 2: out-of-band diagnostic, NOT a
      queued event. NEVER retro-fails committed ops (sec.48). */
  private raiseGuardFault(
    reason: CombatSettlementGuardReason,
    detail: string,
  ): never {
    const digest = this.trace.digest()
    const faultEvent: CombatSettlementFaultEvent = {
      eventId: `evt.settlement_fault.${this.nextEventOrdinal('settlement_fault')}`,
      type: 'combat_settlement_fault',
      reason,
      traceDigest: digest,
      combatSequence: this.allocateSeq(),
    }
    // Stamped for trace completeness -- never pushed to any event queue.
    this.trace.recordEvent(faultEvent)
    this.trace.recordFault(reason, digest)
    this.schedulerState = 'faulted'
    this.diagnosticSink?.emit(faultEvent)
    throw new CombatSettlementFault(detail)
  }

  /** Structural fault -- broken command graph / wiring (sec.50). Throws; the
      diagnostic event's reason union only covers guard reasons, so the
      trace carries these as 'structural_fault' records. */
  private structuralFault(detail: string): never {
    this.trace.recordFault('structural_fault', this.trace.digest())
    this.schedulerState = 'faulted'
    throw new CombatSettlementFault(detail)
  }

  private assertAccepting(api: string): void {
    if (this.schedulerState === 'faulted') {
      this.structuralFault(`${api}: scheduler is faulted`)
    }
  }

  // ---------------------------------------------------------------------
  // Id + sequence allocation.
  // ---------------------------------------------------------------------

  private allocateSeq(): number {
    return this.nextSequence++
  }

  private nextEventOrdinal(scopeId: string): number {
    const ordinal = this.eventOrdinalByScope.get(scopeId) ?? 0
    this.eventOrdinalByScope.set(scopeId, ordinal + 1)
    return ordinal
  }

  private assertReservable(id: CombatOperationId): void {
    if (typeof id !== 'string' || id.length === 0) {
      this.structuralFault('blank operationId')
    }
    if (this.seenOperationIds.has(id)) {
      this.structuralFault(`operationId '${id}' is already reserved`)
    }
  }

  /** Group-atomic reservation (r5 BLOCKER 3): validates every id
      (non-empty, unique in-group, unreserved globally) BEFORE adding any --
      a produced group never commits its first member then discovers a
      bad id in a later sibling. */
  private reserveOperationGroup(ids: readonly CombatOperationId[]): void {
    const local = new Set<CombatOperationId>()
    for (const id of ids) {
      this.assertReservable(id)
      if (local.has(id)) {
        this.structuralFault(`duplicate operationId '${id}' in produced group`)
      }
      local.add(id)
    }
    for (const id of ids) this.seenOperationIds.add(id)
  }

  // ---------------------------------------------------------------------
  // Sink factories (r5 HIGH 2) -- op/event sinks are internal; the
  // lifecycle sink is the public createLifecycleSink above.
  // ---------------------------------------------------------------------

  private createOperationSink(
    op: ResolvedCombatOperation,
    target: CombatEvent[],
  ): CombatEventSink {
    return new ScopedCombatEventSink(
      {
        kind: 'operation',
        scopeId: op.operationId,
        causationOperationId: op.operationId,
      },
      target,
      this.sinkHost,
    )
  }

  private createEventSink(
    event: CombatEvent,
    target: CombatEvent[],
  ): CombatEventSink {
    return new ScopedCombatEventSink(
      { kind: 'event', scopeId: event.eventId, causationEventId: event.eventId },
      target,
      this.sinkHost,
    )
  }

  // ---------------------------------------------------------------------
  // Periodic bridge (r4 BLOCKER 2 + r5 BLOCKER 2): each typed request ->
  // one op; the op mints its OWN origin from the request (an event can
  // carry requests from MANY sourceIds -- no fabricated shared origin).
  // ---------------------------------------------------------------------

  private periodicBridge(event: CombatEvent): ImmediateSettlement | void {
    if (event.type !== 'periodic_requests_committed') return
    const operations = event.requests.map((req) =>
      this.periodicRequestToOp(event, req),
    )
    return { kind: 'operations', operations }
  }

  private periodicRequestToOp(
    event: PeriodicRequestsCommitted,
    req: PeriodicRequestsCommitted['requests'][number],
  ): ResolvedCombatOperation {
    const origin: CombatOperationOrigin = {
      kind: 'buff_periodic',
      originId: `${req.instanceId}:${req.periodicId}`,
      sourceId: req.sourceId,
      rootActionId: event.rootActionId,
      causationEventId: event.eventId,
    }
    // v7.2 -- `periodic.${requestId}` is a naming/debugging convention,
    // never parsed. The requestId correlation rides in the scheduler's
    // PRIVATE map (v7.5): written to scratch here, committed to
    // periodicRequestByOpId only after the produced group passes atomic
    // reservation in settleEvent (v7.6 hygiene).
    const operationId = `periodic.${req.requestId}`
    this.pendingPeriodicCorrelation.set(operationId, req.requestId)
    if ('damageProfile' in req) {
      return {
        operationId,
        type: 'deal_damage',
        origin,
        payload: {
          targetId: req.targetId,
          element: req.element,
          damageProfile: req.damageProfile,
          coefficient: req.coefficient,
          hitCount: req.hitCount,
          canCrit: req.canCrit,
          canMiss: req.canMiss,
          periodicId: req.periodicId,
          tags: req.tags,
        },
      }
    }
    return {
      operationId,
      type: 'heal',
      origin,
      payload: { targetId: req.targetId, amount: req.amount },
    }
  }
}
