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
import type {
  CombatOperationBatch,
  DeferredOperation,
} from '../battle/contracts/settlement'
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
  /** Causal identifiers copied from the event/context (sec.59) so the
      trace stands alone for formatting + ordering (sec.60). */
  readonly rootActionId: string
  readonly sourceId: CombatEntityId
  readonly targetId: CombatEntityId
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

// ---------------------------------------------------------------------------
// M3 -- resolution builder (contract sec.36-39). The snapshot is captured
// ONCE at selection from the board; every payoff reads the frozen values.
// ---------------------------------------------------------------------------

import type { ElementalApplicationCommitted } from '../battle/contracts/events'
import type { CombatOperationOrigin } from '../battle/contracts/origin'
import type { ConsumeBuffStacksOperation } from '../battle/contracts/operations'
import type { ReactionDefinition } from './ReactionDefinition'
import type { ReactionCandidate } from './ReactionTypes'
import { boardStacks } from './ReactionTypes'
import type { BuffDefinitionId, CombatOperationId } from '../battle/contracts/ids'
import type { ElementalStateRegistry } from './ElementalStateRegistry'

/** Which participant roles are consumed by a reaction (spec sec.77/78):
    sinh consumes the parent (child is kept + converted); khac consumes
    BOTH attacker and defender. */
export function isConsumedParticipantRole(
  role: ReactionParticipantRole,
  relation: ReactionRelation,
): boolean {
  return relation === 'sinh'
    ? role === 'parent'
    : role === 'attacker' || role === 'defender'
}

export function consumedRoles(
  def: ReactionDefinition,
): readonly ReactionParticipantRole[] {
  return def.relation === 'sinh' ? ['parent'] : ['attacker', 'defender']
}

/** Participant roles in snapshot order (sinh: parent+child; khac:
    attacker+defender -- contract sec.38). */
export function participantRoles(
  def: ReactionDefinition,
): readonly { role: ReactionParticipantRole; element: ElementType }[] {
  return def.relation === 'sinh'
    ? [
        { role: 'parent', element: def.elements.parent! },
        { role: 'child', element: def.elements.child! },
      ]
    : [
        { role: 'attacker', element: def.elements.attacker! },
        { role: 'defender', element: def.elements.defender! },
      ]
}

/** Snapshot participants from the board. Every participant must have a
    live instance recorded (board.instances[element]) -- a role with
    stacks>0 but no recorded instance is a structural desync and throws. */
export function snapshotParticipants(
  def: ReactionDefinition,
  board: ReactionBoard,
): readonly ReactionParticipantSnapshot[] {
  return participantRoles(def).map(({ role, element }) => {
    const instanceId = board.instances[element]
    const stacks = boardStacks(board, element)
    if (instanceId === undefined || stacks <= 0) {
      throw new Error(
        `resolveCandidate: participant '${role}' (${element}) has no live ` +
          `instance on the board (stacks=${stacks})`,
      )
    }
    return { role, element, instanceId, stacks }
  })
}

/** contract sec.41 -- one precondition per participant; expected values
    are the board snapshot's. */
export function buildPreconditions(
  participants: readonly ReactionParticipantSnapshot[],
  board: ReactionBoard,
): readonly ReactionParticipantPrecondition[] {
  return participants.map((p) => ({
    instanceId: p.instanceId,
    expectedSourceId: board.sourceId,
    expectedTargetId: board.targetId,
    expectedStacks: p.stacks,
  }))
}

/** The reaction-scoped origin stamped on every emitted op (contract
    sec.59): kind 'reaction', originId = reactionId, causationEventId =
    the triggering application event. */
export function reactionOrigin(
  def: ReactionDefinition,
  event: ElementalApplicationCommitted,
): CombatOperationOrigin {
  return {
    kind: 'reaction',
    originId: def.id,
    sourceId: event.sourceId,
    rootActionId: event.origin.rootActionId,
    causationEventId: event.eventId,
    reactionId: def.id,
  }
}

/** Deterministic op-id minting under the reaction scope:
    `rx.${eventId}.${reactionId}.${label}` (contract M4 heal convention:
    `rx.${eventId}.${reactionId}.heal`). */
export function reactionOpId(
  event: ElementalApplicationCommitted,
  def: ReactionDefinition,
  label: string,
): CombatOperationId {
  return `rx.${event.eventId}.${def.id}.${label}` as CombatOperationId
}

/** contract sec.44 -- consume ops head the batch, one per consumed
    participant, 'all' stacks, removalReason 'reaction' (sec.47). */
export function buildConsumeOperations(
  def: ReactionDefinition,
  participants: readonly ReactionParticipantSnapshot[],
  event: ElementalApplicationCommitted,
): ResolvedCombatOperation[] {
  const consumed = new Set(consumedRoles(def))
  const origin = reactionOrigin(def, event)
  return participants
    .filter((p) => consumed.has(p.role))
    .map(
      (p): ResolvedCombatOperation => ({
        type: 'consume_buff_stacks',
        operationId: reactionOpId(event, def, `consume.${p.role}`),
        origin,
        payload: {
          selector: { kind: 'instance', instanceId: p.instanceId },
          stacks: 'all',
          removalReason: 'reaction',
        } satisfies ConsumeBuffStacksOperation['payload'],
      }),
    )
}

/** contract sec.36-39 -- the full resolution record for a selected
    candidate. `emitPayoff` is the M4 seam: given the definition + frozen
    context it returns the authored payoff ops (ReactionOperations); the
    M3 default emits none. Consume ops always precede payoff ops (sec.44). */
export function resolveCandidate(
  candidate: ReactionCandidate,
  event: ElementalApplicationCommitted,
  board: ReactionBoard,
  emitPayoff: (
    def: ReactionDefinition,
    context: ReactionContext,
  ) => readonly (ResolvedCombatOperation | DeferredOperation)[] = () => [],
): ReactionResolution {
  const def = candidate.definition
  const participants = snapshotParticipants(def, board)
  const context: ReactionContext = {
    reactionId: def.id,
    relation: def.relation,
    sourceId: event.sourceId,
    targetId: event.targetId,
    triggerElement: event.element,
    participants,
    rootActionId: event.origin.rootActionId,
    causationEventId: event.eventId,
    combatSequence: event.combatSequence,
  }
  const preconditions = buildPreconditions(participants, board)
  const consumeOps = buildConsumeOperations(def, participants, event)
  const payoffOps = emitPayoff(def, context)
  return {
    reactionId: def.id,
    context,
    preconditions,
    operations: [...consumeOps, ...payoffOps],
  }
}

/** DefinitionId lookup for the consumed-event payload: resolves each
    participant's element through the shared elemental registry (never a
    literal id -- the registry is the element->def authority). */
export function participantBuffIdLookup(
  elements: ElementalStateRegistry,
): (p: ReactionParticipantSnapshot) => BuffDefinitionId {
  return (p) => elements.getDefinitionId(p.element)
}

/** The resolution maps onto the contract's CombatOperationBatch --
    preconditions gain their 'buff_participant' kind tag; ops pass
    through in resolution order (consume-first by construction).
    Shared by the headless batch runner and the M5 dispatcher's
    batchFactory so both lanes produce identical batches. */
export function resolutionToBatch(
  resolution: ReactionResolution,
): CombatOperationBatch {
  return {
    batchId: `rxbatch.${resolution.context.causationEventId}.${resolution.reactionId}`,
    origin: {
      kind: 'reaction',
      originId: resolution.reactionId,
      sourceId: resolution.context.sourceId,
      rootActionId: resolution.context.rootActionId,
      causationEventId: resolution.context.causationEventId,
      reactionId: resolution.reactionId,
    },
    preconditions: resolution.preconditions.map((p) => ({
      kind: 'buff_participant' as const,
      instanceId: p.instanceId,
      expectedSourceId: p.expectedSourceId,
      expectedTargetId: p.expectedTargetId,
      expectedStacks: p.expectedStacks,
    })),
    operations: resolution.operations,
  }
}
