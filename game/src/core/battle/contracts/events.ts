// contracts/events.ts -- event identity vs sequence vs causality are
// SEPARATE authorities (review r2/r3/r4).
//
// Producers emit ENVELOPE-FREE payloads (`CombatEventPayload` -- no
// eventId/causation/combatSequence at all); the scoped CombatEventSink
// mints `eventId` = `evt.${scopeId}.${counter++}` + the causation id
// (review r4 MEDIUM 3 -- no per-authority ordinal bookkeeping). The
// scheduler stamps only `combatSequence` at enqueueEvent and dedups on
// the producer eventId there -- the SINGLE dedup point (r4 HIGH 1).
//
// Causality: `causationOperationId` (authority-emitted) or
// `causationEventId` (handler-emitted) gives the trace an explicit edge --
// never parse eventIds.
//
// CLOSED unions (review r3 MEDIUM): TS type aliases cannot be
// declaration-merged -- sibling plans add members by EDITING this file,
// not by augmenting.

import type { ElementType } from '../../element/ElementType'

import type {
  BuffDefinitionId,
  BuffInstanceId,
  CombatEntityId,
  CombatEventId,
  CombatOperationId,
} from './ids'
import type { ReactionEligibility } from './operations'
import type { CombatOperationOrigin } from './origin'
import type { BuffPeriodicDamageRequest, BuffPeriodicHealRequest } from './periodic'
import type { CombatOperationResultReason } from './results'

export interface CombatEventBase {
  eventId: CombatEventId // sink-minted `evt.${scopeId}.${n}` (see sink.ts)
  causationOperationId?: CombatOperationId // set by an op-scoped sink
  causationEventId?: CombatEventId // set by an event-scoped sink
  combatSequence: number // scheduler-stamped -- sole allocator
}

export interface ElementalApplicationCommitted extends CombatEventBase {
  type: 'elemental_application_committed'
  instanceId: BuffInstanceId
  sourceId: CombatEntityId
  targetId: CombatEntityId
  definitionId: BuffDefinitionId
  element: ElementType
  stacksBefore: number
  stacksAfter: number
  requestedStacks: number
  addedStacks: number
  reactionEligibility: ReactionEligibility
  origin: CombatOperationOrigin
}

/** Spec sec.18 -- a failed application commits nothing; BuffSystem may emit
    this for log/debug. */
export interface BuffApplicationFailedEvent extends CombatEventBase {
  type: 'buff_application_failed'
  definitionId: BuffDefinitionId
  sourceId: CombatEntityId
  targetId: CombatEntityId
  reason: CombatOperationResultReason
  origin: CombatOperationOrigin
}

// Periodic bridge (review r4 BLOCKER 2 + r5 BLOCKER 2):
// BuffAuthority.triggerPeriodic commits its use/modifier semantics, then
// emits THIS event via ctx.events carrying the typed requests. The
// scheduler's built-in handler converts each request 1:1 into
// deal_damage/heal ops (`periodic.${eventId}.${i}` ids) settled in the
// same barrier. The SAME event is emitted by buff lifecycle ticks via
// lctx.events -- one lane for op-triggered AND lifecycle periodic
// resolution. Executor stays a pure router (it never sees the requests).
//
// NO `origin: CombatOperationOrigin` on the event (r5 BLOCKER 2): a
// lifecycle tick is not an operation and one event can carry requests
// from MANY different sourceIds -- provenance lives on each request. The
// built-in handler mints each emitted op's origin itself:
//   {kind:'buff_periodic', originId:`${req.instanceId}:${req.periodicId}`,
//    sourceId:req.sourceId, rootActionId:event.rootActionId,
//    causationEventId:event.eventId}
export interface PeriodicRequestsCommitted extends CombatEventBase {
  type: 'periodic_requests_committed'
  holderId: CombatEntityId
  /** ctx.origin.rootActionId (op) or lctx.rootActionId (lifecycle). */
  rootActionId: string
  requests: readonly (BuffPeriodicDamageRequest | BuffPeriodicHealRequest)[]
}

export interface CombatSettlementFaultEvent extends CombatEventBase {
  type: 'combat_settlement_fault'
  // r4 MEDIUM 2
  reason: 'settlement_depth_exceeded' | 'settlement_work_budget_exceeded'
  traceDigest: string
}

/** What authorities/handlers emit -- envelope-free. */
export type CombatEventPayload =
  | Omit<
      ElementalApplicationCommitted,
      'eventId' | 'causationOperationId' | 'causationEventId' | 'combatSequence'
    >
  | Omit<
      BuffApplicationFailedEvent,
      'eventId' | 'causationOperationId' | 'causationEventId' | 'combatSequence'
    >
  | Omit<
      PeriodicRequestsCommitted,
      'eventId' | 'causationOperationId' | 'causationEventId' | 'combatSequence'
    >

/** What the sink hands the scheduler. */
// NOT CombatSettlementFaultEvent -- faults are OUT-OF-BAND diagnostics
// (review r3 HIGH 6): a halted scheduler cannot drain its own fault
// event. Faults go to trace.recordFault + diagnosticSink, never the
// gameplay queue.
export type PendingCombatEvent =
  | Omit<ElementalApplicationCommitted, 'combatSequence'>
  | Omit<BuffApplicationFailedEvent, 'combatSequence'>
  | Omit<PeriodicRequestsCommitted, 'combatSequence'>

// PendingCombatEvent / CombatEventPayload are CLOSED unions -- sibling
// plans add members by editing this file in their own missions (reaction
// adds ReactionResolvedEvent/ReactionSkippedEvent; buff adds
// BuffApplied/BuffStacksChanged/...).
export type CombatEvent =
  | ElementalApplicationCommitted
  | BuffApplicationFailedEvent
  | PeriodicRequestsCommitted
  | CombatSettlementFaultEvent // stamped for trace, diagnostic lane only
