// ReactionResolution.ts -- contract sec.36-41 + sec.85 type shapes.
// M2 declares the types so ReactionEvaluationResult can name them;
// the builder + batch runner land in M3, the trace recorder in M5.
//
// SNAPSHOT RULE (contract sec.38): all payoff math reads
// participants[*].stacks -- pre-consume values captured at selection.
// Preconditions cover EVERY participant (contract sec.41).

import type { ElementType } from '../element/ElementType'
import type {
  BuffInstanceId,
  CombatEntityId,
} from '../battle/contracts/ids'
import type { DeferredOperation } from '../battle/contracts/settlement'
import type { ResolvedCombatOperation } from '../battle/contracts/operations'
import type {
  ReactionBoard,
  ReactionId,
  ReactionParticipantRole,
  ReactionRelation,
} from './ReactionTypes'
import type { CombatOperationResultBase } from '../battle/contracts/results'

export interface ReactionParticipantSnapshot {
  readonly role: ReactionParticipantRole
  readonly element: ElementType
  readonly instanceId: BuffInstanceId
  readonly stacks: number
}

export interface ReactionContext {
  readonly reactionId: ReactionId
  readonly relation: ReactionRelation
  readonly sourceId: CombatEntityId
  readonly targetId: CombatEntityId
  readonly triggerElement: ElementType
  /** sinh: parent+child; khac: attacker+defender. */
  readonly participants: readonly ReactionParticipantSnapshot[]
  readonly rootActionId: string          // copied from event.origin.rootActionId
  readonly causationEventId: string      // = event.eventId (contract sec.59)
  readonly combatSequence: number        // = event.combatSequence (scheduler owns allocation)
}

/** Contract sec.40 -- a stale participant aborts the WHOLE batch
    (stale_reaction_snapshot, zero ops execute). */
export interface ReactionParticipantPrecondition {
  readonly instanceId: BuffInstanceId
  readonly expectedSourceId: CombatEntityId
  readonly expectedTargetId: CombatEntityId
  readonly expectedStacks: number
}

export interface ReactionResolution {
  readonly reactionId: ReactionId
  readonly context: ReactionContext
  readonly preconditions: readonly ReactionParticipantPrecondition[]
  /** Contract v1.1+review: may contain DeferredOperation entries
      (heal_from_damage) materialized by the batch runner at their
      position from prior in-batch results. */
  readonly operations: readonly (ResolvedCombatOperation | DeferredOperation)[]
}

/** Contract sec.85 -- the deterministic evaluation record (candidates
    with base + evaluated bias + final weight, winner, preconditions,
    emitted op ids). Recorded through evaluation; M5 formats it. */
export interface ReactionEvaluationTrace {
  readonly eventId: string
  readonly combatSequence: number
  readonly board: ReactionBoard
  readonly candidates: readonly {
    reactionId: ReactionId
    baseStrength: number
    evaluatedBias: {
      relationBps: number
      elementBps: number
      reactionBps: number
    }
    finalWeightScaled: number
  }[]
  readonly selected?: ReactionId
  readonly preconditions?: readonly ReactionParticipantPrecondition[]
  readonly operationIds: readonly string[]
}

/** Contract sec.40-51 outcome of a reaction batch. */
export type ReactionBatchOutcome =
  | { status: 'resolved'; reactionId: ReactionId; results: readonly CombatOperationResultBase[] }
  | { status: 'skipped'; reactionId: ReactionId; reason: 'stale_reaction_snapshot' }
  | { status: 'partial'; reactionId: ReactionId; results: readonly CombatOperationResultBase[] }
