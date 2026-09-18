// contracts/sink.ts -- SCOPED sink (review r4 MEDIUM 3): producers emit
// envelope-free `CombatEventPayload`; the sink implementation is created
// per-scope by the scheduler and mints `eventId`
// (`evt.${scopeId}.${counter++}`) + the causation id itself (op scope ->
// causationOperationId, event scope -> causationEventId, lifecycle scope
// -> no causation). Forwards the built PendingCombatEvent to
// scheduler.enqueueEvent (single dedup + stamp point).

import type { CombatEventPayload } from './events'

export interface CombatEventSink {
  emit(event: CombatEventPayload): void
}
