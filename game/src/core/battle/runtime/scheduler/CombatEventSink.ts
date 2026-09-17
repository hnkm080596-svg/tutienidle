// runtime/scheduler/CombatEventSink.ts -- the scoped sink implementation
// (review r4 MEDIUM 3).
//
// Producers emit ENVELOPE-FREE CombatEventPayload objects. The sink mints
// `eventId` = `evt.${scopeId}.${ordinal}` + the scope's causation id
// (operation scope -> causationOperationId, event scope ->
// causationEventId, lifecycle scope -> none), then hands the built
// PendingCombatEvent to the scheduler -- which stamps combatSequence and
// dedups at the single enqueue point (r4 HIGH 1).
//
// Ordinals live in the scheduler-owned `eventOrdinalByScope` map
// (r5 HIGH 2): the sink asks the host for the next ordinal, so two sinks
// created for the same scope never mint the same eventId.

import type {
  CombatEvent,
  CombatEventPayload,
  PendingCombatEvent,
} from '../../contracts/events'
import type { CombatEventId, CombatOperationId } from '../../contracts/ids'
import type { CombatEventSink } from '../../contracts/sink'

/** Narrow internal surface the scheduler exposes to its sinks. */
export interface CombatEventSinkHost {
  nextEventOrdinal(scopeId: string): number
  commitEvent(pending: PendingCombatEvent, target: CombatEvent[]): void
}

export type CombatEventSinkScope =
  | { kind: 'operation'; scopeId: string; causationOperationId: CombatOperationId }
  | { kind: 'event'; scopeId: string; causationEventId: CombatEventId }
  | { kind: 'lifecycle'; scopeId: string }

export class ScopedCombatEventSink implements CombatEventSink {
  constructor(
    private readonly scope: CombatEventSinkScope,
    private readonly target: CombatEvent[],
    private readonly host: CombatEventSinkHost,
  ) {}

  emit(payload: CombatEventPayload): void {
    const ordinal = this.host.nextEventOrdinal(this.scope.scopeId)
    const eventId = `evt.${this.scope.scopeId}.${ordinal}`
    let pending: PendingCombatEvent
    switch (this.scope.kind) {
      case 'operation':
        pending = {
          ...payload,
          eventId,
          causationOperationId: this.scope.causationOperationId,
        }
        break
      case 'event':
        pending = {
          ...payload,
          eventId,
          causationEventId: this.scope.causationEventId,
        }
        break
      case 'lifecycle':
        pending = { ...payload, eventId }
        break
    }
    this.host.commitEvent(pending, this.target)
  }
}
