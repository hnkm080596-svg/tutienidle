// ReactionBatchRunner.ts -- contract sec.40-51, the inert engine's
// batch driver (megaplan M3). The PRODUCTION path runs the scheduler's
// own batch frame on the same CombatOperationBatch shape (M-INT); this
// runner exists so the semantics are provable headlessly before wiring.
// It delegates atomic preflight, deferred materialization AND the
// per-op validity gate (contract sec.49) to the contract's
// CombatOperationBatchRunner/BatchResultStore -- one authority for
// batch semantics, shared with the production scheduler frame -- and
// adds only the resolved/skipped event emissions (spec sec.50).
//
// Preflight-all -> ordered execution -> typed skips. No interleaving
// (sec.43), no rollback once the first op commits (sec.48). A stale
// participant aborts the WHOLE batch with zero ops dispatched
// (sec.40); an op whose target dies mid-batch earns a typed
// 'invalid_target_state' result and the batch continues (sec.49).

import type { CombatAuthorityExecutionContext } from '../battle/contracts/context'
import type { CombatEventSink } from '../battle/contracts/sink'
import type { ResolvedCombatOperation } from '../battle/contracts/operations'
import type {
  CombatOperationResult,
  CombatOperationResultBase,
} from '../battle/contracts/results'
import type { DeferredOperation } from '../battle/contracts/settlement'
import type {
  BuffDefinitionId,
  CombatEntityId,
} from '../battle/contracts/ids'
import type { CombatOperationExecutor } from '../battle/runtime/scheduler/CombatOperationExecutor'
import {
  BatchResultStore,
  CombatOperationBatchRunner,
  isDeferredOperation,
  resultTypeOfBatchEntry,
  type PreconditionChecker,
} from '../battle/runtime/scheduler/CombatOperationBatchRunner'
import type { BuffReadPort } from '../buff2/BuffQuery'
import {
  reactionResolvedPayload,
  reactionSkippedPayload,
} from './ReactionEvents'
import {
  isConsumedParticipantRole,
  resolutionToBatch,
  type ReactionBatchOutcome,
  type ReactionResolution,
} from './ReactionResolution'

export class ReactionBatchRunner {
  private readonly batchRunner: CombatOperationBatchRunner

  constructor(
    private readonly executor: CombatOperationExecutor,
    private readonly buffs: BuffReadPort,
    private readonly alive: (id: CombatEntityId) => boolean,
  ) {
    const preconditions: PreconditionChecker = {
      isAlive: (id) => this.alive(id),
      getBuffInstance: (instanceId) =>
        this.buffs.getInstance({ kind: 'instance', instanceId }),
      getBuffInstanceBySelector: (selector) => this.buffs.getInstance(selector),
    }
    this.batchRunner = new CombatOperationBatchRunner(preconditions)
  }

  /** contract sec.40-51. `sink` is the EVENT-SCOPED sink supplied by the
      caller (scheduler in production, collecting sink in tests) -- it
      mints eventId + causationEventId for the resolved/skipped events. */
  execute(
    resolution: ReactionResolution,
    sink: CombatEventSink,
  ): ReactionBatchOutcome {
    const batch = resolutionToBatch(resolution)

    // 1. Preflight -- contract sec.40-42: ALL preconditions before ANY
    //    op; ANY stale participant aborts the whole batch, zero ops
    //    dispatched. Structural validation runs first so a malformed
    //    command graph faults before mutation.
    this.batchRunner.validateBatchStructure(batch)
    // Capture participant definitionIds while the instances are still
    // live -- post-consume they are gone, but the resolved event's
    // consumed list needs them.
    const definitionIds = new Map<string, BuffDefinitionId>()
    for (const pre of resolution.preconditions) {
      const instance = this.buffs.getInstance({
        kind: 'instance',
        instanceId: pre.instanceId,
      })
      if (instance !== undefined) {
        definitionIds.set(pre.instanceId, instance.definitionId)
      }
    }
    if (!this.batchRunner.preflight(batch)) {
      sink.emit(
        reactionSkippedPayload(
          resolution.reactionId,
          resolution.context.rootActionId,
        ),
      )
      return {
        status: 'skipped',
        reactionId: resolution.reactionId,
        reason: 'stale_reaction_snapshot',
      }
    }

    // 2. Ordered execution -- consume ops first (sec.44, by
    //    construction), then authored payoff order. No rollback once
    //    the first op commits (sec.48).
    const inBatch = new BatchResultStore()
    const results: CombatOperationResultBase[] = []
    for (const entry of batch.operations) {
      if (isDeferredOperation(entry)) {
        results.push(
          this.materializeDeferred(entry, inBatch, resolution, sink),
        )
        continue
      }
      const result = this.executeOne(entry, resolution, sink)
      inBatch.record(entry, result)
      results.push(result)
    }

    // 3. Post-commit event (spec sec.50) -- the consumed list is the
    //    pre-consume snapshot of the consumed participants.
    const consumed = resolution.context.participants.filter((p) =>
      isConsumedParticipantRole(p.role, resolution.context.relation),
    )
    sink.emit(
      reactionResolvedPayload(resolution.context, consumed, (p) => {
        const defId = definitionIds.get(p.instanceId)
        if (defId === undefined) {
          throw new Error(
            `reaction_resolved: no definitionId captured for participant '${p.role}'`,
          )
        }
        return defId
      }),
    )

    const allResolved = results.every((r) => r.status === 'resolved')
    return allResolved
      ? { status: 'resolved', reactionId: resolution.reactionId, results }
      : { status: 'partial', reactionId: resolution.reactionId, results }
  }

  /** Per-op validity gate (contract sec.49): an op whose target is dead
      or whose buff instance no longer exists earns a typed skip without
      dispatching. Ops on instances consumed earlier in THIS batch
      legitimately skip -- consumption is the batch's own doing. The
      gate itself lives on CombatOperationBatchRunner so the production
      scheduler frame enforces the identical check. */
  private executeOne(
    op: ResolvedCombatOperation,
    resolution: ReactionResolution,
    sink: CombatEventSink,
  ): CombatOperationResult {
    const invalid = this.batchRunner.opTargetSkipReason(op)
    if (invalid !== undefined) {
      return {
        operationId: op.operationId,
        type: op.type,
        status: 'skipped',
        reason: invalid,
      } as CombatOperationResult
    }
    const ctx: CombatAuthorityExecutionContext = {
      operationId: op.operationId,
      origin: op.origin,
      events: sink,
      combatSequence: resolution.context.combatSequence,
    }
    return this.executor.execute(op, ctx)
  }

  /** contract settlement.ts + sec.49: a deferred op materializes from
      the referenced in-batch deal_damage result. A non-resolved
      reference yields dependency_not_resolved -- never a silent 0.
      The materialized heal then validates live target state like any
      other op. */
  private materializeDeferred(
    deferred: DeferredOperation,
    inBatch: BatchResultStore,
    resolution: ReactionResolution,
    sink: CombatEventSink,
  ): CombatOperationResultBase {
    const referenced = inBatch.get(deferred.resultOperationId)
    if (referenced?.status !== 'resolved') {
      return {
        operationId: deferred.operationId,
        type: resultTypeOfBatchEntry(deferred),
        status: 'skipped',
        reason: 'dependency_not_resolved',
      } as CombatOperationResult
    }
    const op = this.batchRunner.materialize(deferred, inBatch)
    return this.executeOne(op, resolution, sink)
  }
}
