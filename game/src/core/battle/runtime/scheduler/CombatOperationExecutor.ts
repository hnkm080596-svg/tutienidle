// runtime/scheduler/CombatOperationExecutor.ts -- pure router
// (contract sec.5 + sec.50): op.type -> authority port -> typed result.
//
// The executor NEVER reads scheduler state, never queries result history,
// and never picks "the closest existing method" on an authority -- the
// port signatures are intent-level inputs; the authority resolves
// formulas/channels itself.
//
// Every authority call receives a CombatAuthorityExecutionContext
// ({operationId, origin, events: <op-scoped sink>}) -- review r3 BLOCKER 1.
//
// Result mapping:
// - normal port return            -> { status: 'resolved', <typed payload> }
// - authority threw CombatOperationSkip -> { status: 'skipped', reason }
//   (contract sec.51: runtime invalidation returns a typed skip; the throw is
//   the authority's only signaling channel -- port returns carry no status)
// - missing port / unknown op.type -> CombatSettlementFault (sec.50
//   structural failure -- broken wiring is not a combat outcome; NEVER a
//   typed 'failed' result)

import type { CombatAuthorityExecutionContext } from '../../contracts/context'
import type { ResolvedCombatOperation } from '../../contracts/operations'
import type {
  CombatOperationResult,
  CombatOperationResultReason,
} from '../../contracts/results'
import type { CombatEventSink } from '../../contracts/sink'

import type { CombatAuthorityPorts } from './CombatAuthorityPorts'
import { CombatSettlementFault } from './CombatSettlementFault'

/** Thrown by an authority to request a typed runtime skip (sec.51). The
    executor converts it into {status:'skipped', reason}; anything else
    thrown by an authority propagates unchanged. */
export class CombatOperationSkip extends Error {
  readonly reason: CombatOperationResultReason

  constructor(reason: CombatOperationResultReason, message?: string) {
    super(message ?? `operation skipped: ${reason}`)
    this.name = 'CombatOperationSkip'
    this.reason = reason
  }
}

export class CombatOperationExecutor {
  constructor(private readonly ports: CombatAuthorityPorts) {}

  /** Routes op -> port. `sink` is the OP-SCOPED sink the scheduler creates
      per execution -- it mints `evt.${op.operationId}.${n}` +
      `causationOperationId` itself; authorities emit envelope-free
      payloads. Returns the FULL discriminated result -- batch runners and
      traces need op-specific payloads (review r2). */
  execute(
    op: ResolvedCombatOperation,
    sink: CombatEventSink,
  ): CombatOperationResult {
    const ctx: CombatAuthorityExecutionContext = {
      operationId: op.operationId,
      origin: op.origin,
      events: sink,
    }
    try {
      return this.dispatch(op, ctx)
    } catch (error) {
      if (error instanceof CombatOperationSkip) {
        return this.skippedResult(op, error.reason)
      }
      throw error
    }
  }

  private skippedResult(
    op: ResolvedCombatOperation,
    reason: CombatOperationResultReason,
  ): CombatOperationResult {
    // Every result member accepts {operationId, type:<its literal>,
    // status:'skipped', reason} -- `op.type` is the union of all member
    // literals, so the correlation is asserted rather than re-switched.
    return {
      operationId: op.operationId,
      type: op.type,
      status: 'skipped',
      reason,
    } as CombatOperationResult
  }

  private requirePort<K extends keyof CombatAuthorityPorts>(
    key: K,
  ): NonNullable<CombatAuthorityPorts[K]> {
    const port = this.ports[key]
    if (port === undefined || port === null) {
      throw new CombatSettlementFault(
        `CombatOperationExecutor: no '${String(key)}' authority port wired`,
      )
    }
    return port
  }

  private dispatch(
    op: ResolvedCombatOperation,
    ctx: CombatAuthorityExecutionContext,
  ): CombatOperationResult {
    const { operationId } = op
    switch (op.type) {
      case 'deal_damage': {
        const damage = this.requirePort('damage').dealDamage(op.payload, ctx)
        return { operationId, type: 'deal_damage', status: 'resolved', damage }
      }
      case 'heal': {
        const result = this.requirePort('heal').heal(op.payload, ctx)
        return { operationId, type: 'heal', status: 'resolved', result }
      }
      case 'apply_buff': {
        // Payload omits sourceId/origin -- the op's origin envelope is the
        // single canonical source (review r2 HIGH 3).
        const result = this.requirePort('buffs').apply(
          { ...op.payload, sourceId: op.origin.sourceId, origin: op.origin },
          ctx,
        )
        return { operationId, type: 'apply_buff', status: 'resolved', result }
      }
      case 'add_buff_stacks': {
        const result = this.requirePort('buffs').addStacks(
          op.payload.selector,
          op.payload.stacks,
          ctx,
        )
        return {
          operationId,
          type: 'add_buff_stacks',
          status: 'resolved',
          result,
        }
      }
      case 'remove_buff_stacks': {
        const result = this.requirePort('buffs').removeStacks(
          op.payload.selector,
          op.payload.stacks,
          ctx,
        )
        return {
          operationId,
          type: 'remove_buff_stacks',
          status: 'resolved',
          result,
        }
      }
      case 'consume_buff_stacks': {
        const result = this.requirePort('buffs').consumeStacks(
          op.payload.selector,
          op.payload.stacks,
          op.payload.removalReason,
          ctx,
        )
        return {
          operationId,
          type: 'consume_buff_stacks',
          status: 'resolved',
          result,
        }
      }
      case 'add_buff_modifier': {
        const r = this.requirePort('buffs').addModifier(
          op.payload.selector,
          op.payload.modifier,
          ctx,
        )
        return {
          operationId,
          type: 'add_buff_modifier',
          status: 'resolved',
          result: { modifierId: op.payload.modifier.id, applied: r.applied },
        }
      }
      case 'remove_buff_modifier': {
        const r = this.requirePort('buffs').removeModifier(
          op.payload.selector,
          op.payload.modifierId,
          ctx,
        )
        return {
          operationId,
          type: 'remove_buff_modifier',
          status: 'resolved',
          result: { modifierId: op.payload.modifierId, applied: r.removed },
        }
      }
      case 'refresh_buff_duration': {
        const result = this.requirePort('buffs').refreshDuration(
          op.payload.selector,
          op.payload.duration,
          ctx,
        )
        return {
          operationId,
          type: 'refresh_buff_duration',
          status: 'resolved',
          result,
        }
      }
      case 'extend_buff_duration': {
        const result = this.requirePort('buffs').extendDuration(
          op.payload.selector,
          op.payload.turns,
          op.payload.maxRemaining,
          ctx,
        )
        return {
          operationId,
          type: 'extend_buff_duration',
          status: 'resolved',
          result,
        }
      }
      case 'trigger_buff_periodic': {
        const resolutions = this.requirePort('buffs').triggerPeriodic(
          op.payload.selector,
          op.payload.periodicId,
          ctx,
        )
        return {
          operationId,
          type: 'trigger_buff_periodic',
          status: 'resolved',
          result: { resolutionsEmitted: resolutions.length },
        }
      }
      case 'remove_buff': {
        this.requirePort('buffs').remove(
          op.payload.selector,
          op.payload.removalReason,
          ctx,
        )
        return { operationId, type: 'remove_buff', status: 'resolved' }
      }
      case 'push_gauge': {
        const result = this.requirePort('gauge').pushGauge(
          op.payload.targetId,
          op.payload.fractionOfMax,
          ctx,
        )
        return { operationId, type: 'push_gauge', status: 'resolved', result }
      }
      case 'gain_resource': {
        const result = this.requirePort('resource').gain(
          op.payload.targetId,
          op.payload.resourceId,
          op.payload.amount,
          ctx,
        )
        return { operationId, type: 'gain_resource', status: 'resolved', result }
      }
      case 'consume_resource': {
        const result = this.requirePort('resource').consume(
          op.payload.targetId,
          op.payload.resourceId,
          op.payload.amount,
          op.payload.valueSource,
          ctx,
        )
        return {
          operationId,
          type: 'consume_resource',
          status: 'resolved',
          result,
        }
      }
      case 'apply_shield': {
        const result = this.requirePort('shield').applyShield(
          op.payload.targetId,
          op.payload.amount,
          ctx,
        )
        return { operationId, type: 'apply_shield', status: 'resolved', result }
      }
      default: {
        // Exhaustiveness: an unknown op.type reaching here is a structural
        // failure (sec.50), not a skippable outcome.
        const exhaustive: never = op
        void exhaustive
        throw new CombatSettlementFault(
          'CombatOperationExecutor: unknown operation type',
        )
      }
    }
  }
}
