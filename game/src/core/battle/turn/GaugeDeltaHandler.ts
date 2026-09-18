// GaugeDeltaHandler.ts -- megaplan M4 (HIGH 6 + r4 HIGH 3): the
// gauge-owned `buff_applied` immediate handler. An applied def carrying a
// 'gauge_delta' grant produces a PushGaugeOperation -- only a COMMITTED
// application pushes gauge (a failed roll emits no buff_applied, so it
// can never leak a push).
//
// This module owns the 'gauge_delta' payload schema + validator AND the
// push DECISION (which grants push how much). Settlement TIMING belongs
// to the caller: pushes stage in `pending` and drain via drainPending()
// -- TurnBattleSystem drains at completeAction AFTER the action's gauge
// consume (legacy ordering: a self-targeted gauge buff pushed before
// consume would have its push zeroed -- the stage preserves "push lands
// on top of the reset" for every producer lane uniformly).

import type { BuffRegistry } from '../../buff2/BuffRegistry'
import type { BuffAppliedEvent } from '../contracts/events'
import type { ActiveCapabilityGrant } from '../contracts/capability'
import type { CapabilityValidatorRegistry } from '../runtime/capability/CapabilityValidatorRegistry'
import type { ResolvedCombatOperation } from '../contracts/operations'
import type { CombatOperationId } from '../contracts/ids'

export interface GaugeDeltaPayload {
  /** Percent of GAUGE_MAX (legacy gaugeDelta.percentOfMax semantics --
      20 = 20%). */
  percentOfMax: number
}

export function validateGaugeDelta(payload: unknown): asserts payload is GaugeDeltaPayload {
  const type = 'gauge_delta'
  if (typeof payload !== 'object' || payload === null) {
    throw new Error(`capability '${type}': payload must be an object`)
  }
  const record = payload as Record<string, unknown>
  if (typeof record.percentOfMax !== 'number' || !Number.isFinite(record.percentOfMax)) {
    throw new Error(`capability '${type}': percentOfMax must be a finite number`)
  }
}

export function asGaugeDelta(grant: ActiveCapabilityGrant): GaugeDeltaPayload | undefined {
  return grant.capability.type === 'gauge_delta'
    ? (grant.capability.payload as GaugeDeltaPayload)
    : undefined
}

export function registerGaugeDeltaCapabilities(validators: CapabilityValidatorRegistry): void {
  validators.register('gauge_delta', validateGaugeDelta)
}

/** Immediate handler for `buff_applied`: each gauge_delta grant on the
    applied def stages one PushGaugeOperation (percent -> fraction). The
    staged ops carry apply-time ids; the caller drains + settles them at
    its post-consume boundary. */
export class GaugeDeltaHandler {
  constructor(private readonly registry: BuffRegistry) {}

  private pending: ResolvedCombatOperation[] = []

  handleBuffApplied(event: BuffAppliedEvent): void {
    const definition = this.registry.tryGet(event.definitionId)
    if (definition === undefined) return

    for (const grant of definition.capabilities ?? []) {
      if (grant.type !== 'gauge_delta') continue
      const payload = grant.payload as GaugeDeltaPayload
      this.pending.push({
        type: 'push_gauge',
        operationId: `gauge.${event.eventId}.${grant.id}` as CombatOperationId,
        payload: {
          targetId: event.targetId,
          fractionOfMax: payload.percentOfMax / 100,
        },
        origin: {
          kind: 'proc',
          originId: `gauge_delta.${event.definitionId}.${grant.id}`,
          sourceId: event.sourceId,
          rootActionId: event.rootActionId,
          causationEventId: event.eventId,
        },
      })
    }
  }

  /** Drain staged pushes (one call = one consume boundary). */
  drainPending(): ResolvedCombatOperation[] {
    const ops = this.pending
    this.pending = []
    return ops
  }
}
