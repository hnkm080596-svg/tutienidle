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
  ReactionId,
} from './ids'
import type { BuffRemovalReason, ReactionEligibility } from './operations'
import type { CombatOperationOrigin } from './origin'
import type { BuffPeriodicDamageRequest, BuffPeriodicHealRequest } from './periodic'
import type {
  CombatOperationResultReason,
  CombatOperationResultStatus,
} from './results'

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
// deal_damage/heal ops (`periodic.${requestId}` ids) settled in the
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
  /** v7.2 -- provenance of the lifecycle boundary that produced the
      requests. NOT 'holderId': source-turn boundaries anchor on the
      SOURCE and `onTimePassed(seconds)` is battle-wide with NO anchor
      entity. The handler needs nothing here -- every request
      self-carries sourceId/targetId/instanceId/periodicId. */
  trigger: { type: PeriodicTriggerKind; anchorEntityId?: CombatEntityId }
  /** ctx.origin.rootActionId (op) or lctx.rootActionId (lifecycle). */
  rootActionId: string
  /** v7.4 -- emitters send ONE request per event whenever units are
      sequential: lifecycle emits per-unit (each followed by
      lctx.settle()); manual triggers emit the first unit and chain the
      rest via the periodic_operation_settled continuation.
      Multi-request events remain legal only where no later request can
      depend on an earlier settlement. */
  requests: readonly (BuffPeriodicDamageRequest | BuffPeriodicHealRequest)[]
}

export type PeriodicTriggerKind =
  | 'holder_turn_start'
  | 'holder_turn_end'
  | 'source_turn_start'
  | 'source_turn_end'
  | 'interval'
  | 'manual'

// v7.3/v7.5 -- PeriodicOperationSettled is SCHEDULER-ORIGINATED: no
// authority or handler emits it (it is NOT a member of
// CombatEventPayload / PendingCombatEvent -- the sink unions stay
// unchanged). After every op the built-in bridge recorded in the
// scheduler-private `periodicRequestByOpId` map (v7.5 -- correlation
// lives INSIDE the scheduler; no public op field, nothing to forge or
// collide -- r5 HIGH 3) completes its barrier, the scheduler enqueues
// this event into the frame that produced the op. It carries the
// settled status so the periodic emitter's registered immediate handler
// can finalize `uses`-modifier pending marks: 'resolved' -> consume,
// anything else -> release -- and drive manual-trigger continuation
// (the handler emits the next unit's PeriodicRequestsCommitted through
// its event-scoped sink). This is the ONLY post-result correlation
// channel that works for EVERY entry path -- manual triggerPeriodic
// (whose generated ops settle inside the triggering op's own barrier,
// after the authority returned), lifecycle boundaries, and interval
// crossings all see it identically.
//
// STAMPING (v7.5 -- locked): eventId mints through the CANONICAL
// per-scope allocator --
// `evt.${op.operationId}.${eventOrdinalByScope[op.operationId]++}`, the
// same scope+counter the op's own sink uses (r5 HIGH 2 -- globally
// collision-proof by construction: the scope is a globally-unique op id
// and all ids in it share one counter; supersedes v7.4's
// `evt.settled.${opId}`). causationOperationId = the periodic op's id;
// rootActionId copied from the op's origin; combatSequence =
// allocateSeq() at enqueue (op's seq allocated at ITS execution-start
// -> seq(op) < seq(settled)); recordEvent exactly once -- the emission
// site runs once per periodic op barrier, so exactly-once is
// structural.
export interface PeriodicOperationSettled extends CombatEventBase {
  type: 'periodic_operation_settled'
  /** The request that produced the op. */
  requestId: string
  /** `periodic.${requestId}` (naming convention). */
  operationId: CombatOperationId
  /** The op's origin.rootActionId -- the continuation needs it to mint
      the next unit's PeriodicRequestsCommitted. */
  rootActionId: string
  /** 'resolved' | 'skipped' | 'failed' -- mirrors the op result. */
  status: CombatOperationResultStatus
  reason?: CombatOperationResultReason
}

export interface CombatSettlementFaultEvent extends CombatEventBase {
  type: 'combat_settlement_fault'
  // r4 MEDIUM 2
  reason: 'settlement_depth_exceeded' | 'settlement_work_budget_exceeded'
  traceDigest: string
}

// ---------------------------------------------------------------------------
// Buff events (buff-plan amendment 5 -- spec sec.45; the buff-side fact IS
// PeriodicRequestsCommitted for periodic outcomes -- no
// buff_periodic_resolved.amount exists; damage/heal outcomes live on the
// deal_damage/heal op results, owned by Damage/Heal authorities).
// ---------------------------------------------------------------------------

export interface BuffAppliedEvent extends CombatEventBase {
  type: 'buff_applied'
  /** ctx.origin.rootActionId (op) or lctx.rootActionId (lifecycle) --
      lifecycle-scope emissions carry no causation; the root rides the
      event so the trace can parent it (same lane as
      PeriodicRequestsCommitted). */
  rootActionId: string
  instanceId: BuffInstanceId
  definitionId: BuffDefinitionId
  sourceId: CombatEntityId
  targetId: CombatEntityId
  /** true = the apply created the instance; false = reapply onto it. */
  created: boolean
}

export interface BuffStacksChangedEvent extends CombatEventBase {
  type: 'buff_stacks_changed'
  /** ctx.origin.rootActionId (op) or lctx.rootActionId (lifecycle) --
      lifecycle-scope emissions carry no causation; the root rides the
      event so the trace can parent it (same lane as
      PeriodicRequestsCommitted). */
  rootActionId: string
  instanceId: BuffInstanceId
  stacksBefore: number
  stacksAfter: number
  addedStacks: number
}

export interface BuffDurationChangedEvent extends CombatEventBase {
  type: 'buff_duration_changed'
  /** ctx.origin.rootActionId (op) or lctx.rootActionId (lifecycle) --
      lifecycle-scope emissions carry no causation; the root rides the
      event so the trace can parent it (same lane as
      PeriodicRequestsCommitted). */
  rootActionId: string
  instanceId: BuffInstanceId
  durationBefore: number
  durationAfter: number
}

export interface BuffModifierAddedEvent extends CombatEventBase {
  type: 'buff_modifier_added'
  /** ctx.origin.rootActionId (op) or lctx.rootActionId (lifecycle) --
      lifecycle-scope emissions carry no causation; the root rides the
      event so the trace can parent it (same lane as
      PeriodicRequestsCommitted). */
  rootActionId: string
  instanceId: BuffInstanceId
  modifierId: string
  /** The runtime ENTRY identity (r5 HIGH 1) -- same authored modifierId,
      different generations are distinguishable in the trace. */
  modifierRuntimeId: string
}

export interface BuffModifierRemovedEvent extends CombatEventBase {
  type: 'buff_modifier_removed'
  /** ctx.origin.rootActionId (op) or lctx.rootActionId (lifecycle) --
      lifecycle-scope emissions carry no causation; the root rides the
      event so the trace can parent it (same lane as
      PeriodicRequestsCommitted). */
  rootActionId: string
  instanceId: BuffInstanceId
  modifierId: string
  modifierRuntimeId: string
}

export interface BuffRemovedEvent extends CombatEventBase {
  type: 'buff_removed'
  /** ctx.origin.rootActionId (op) or lctx.rootActionId (lifecycle) --
      lifecycle-scope emissions carry no causation; the root rides the
      event so the trace can parent it (same lane as
      PeriodicRequestsCommitted). */
  rootActionId: string
  instanceId: BuffInstanceId
  definitionId: BuffDefinitionId
  sourceId: CombatEntityId
  targetId: CombatEntityId
  reason: BuffRemovalReason
  stacksAtRemoval: number
}

// ---------------------------------------------------------------------------
// Reaction events (reaction megaplan M3 -- spec sec.50). Emitted by the
// reaction batch lane through the EVENT-SCOPED sink (causationEventId =
// the triggering elemental_application_committed event). rootActionId rides
// the payload for the same orphan-fallback reason as the buff events.
// ---------------------------------------------------------------------------

export interface ReactionResolvedEvent extends CombatEventBase {
  type: 'reaction_resolved'
  rootActionId: string
  reactionId: ReactionId
  relation: 'sinh' | 'khac'
  sourceId: CombatEntityId
  targetId: CombatEntityId
  /** The pre-consume participant snapshot -- which seals were consumed
      and how many stacks each carried (spec sec.50). */
  consumed: readonly { buffId: BuffDefinitionId; stacks: number }[]
}

export interface ReactionSkippedEvent extends CombatEventBase {
  type: 'reaction_skipped'
  rootActionId: string
  reactionId: ReactionId
  reason: 'stale_reaction_snapshot'
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
  | Omit<
      BuffAppliedEvent,
      'eventId' | 'causationOperationId' | 'causationEventId' | 'combatSequence'
    >
  | Omit<
      BuffStacksChangedEvent,
      'eventId' | 'causationOperationId' | 'causationEventId' | 'combatSequence'
    >
  | Omit<
      BuffDurationChangedEvent,
      'eventId' | 'causationOperationId' | 'causationEventId' | 'combatSequence'
    >
  | Omit<
      BuffModifierAddedEvent,
      'eventId' | 'causationOperationId' | 'causationEventId' | 'combatSequence'
    >
  | Omit<
      BuffModifierRemovedEvent,
      'eventId' | 'causationOperationId' | 'causationEventId' | 'combatSequence'
    >
  | Omit<
      BuffRemovedEvent,
      'eventId' | 'causationOperationId' | 'causationEventId' | 'combatSequence'
    >
  | Omit<
      ReactionResolvedEvent,
      'eventId' | 'causationOperationId' | 'causationEventId' | 'combatSequence'
    >
  | Omit<
      ReactionSkippedEvent,
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
  | Omit<BuffAppliedEvent, 'combatSequence'>
  | Omit<BuffStacksChangedEvent, 'combatSequence'>
  | Omit<BuffDurationChangedEvent, 'combatSequence'>
  | Omit<BuffModifierAddedEvent, 'combatSequence'>
  | Omit<BuffModifierRemovedEvent, 'combatSequence'>
  | Omit<BuffRemovedEvent, 'combatSequence'>
  | Omit<ReactionResolvedEvent, 'combatSequence'>
  | Omit<ReactionSkippedEvent, 'combatSequence'>

// PendingCombatEvent / CombatEventPayload are CLOSED unions -- sibling
// plans add members by editing this file in their own missions (reaction
// adds ReactionResolvedEvent/ReactionSkippedEvent; buff adds
// BuffApplied/BuffStacksChanged/...).
export type CombatEvent =
  | ElementalApplicationCommitted
  | BuffApplicationFailedEvent
  | PeriodicRequestsCommitted
  | PeriodicOperationSettled // v7.3 -- scheduler-originated (above)
  | CombatSettlementFaultEvent // stamped for trace, diagnostic lane only
  | BuffAppliedEvent
  | BuffStacksChangedEvent
  | BuffDurationChangedEvent
  | BuffModifierAddedEvent
  | BuffModifierRemovedEvent
  | BuffRemovedEvent
  | ReactionResolvedEvent
  | ReactionSkippedEvent
