// ReactionEvents.ts -- spec sec.50 payload factories. The event
// INTERFACES live in contracts/events.ts (closed unions); this module
// owns the envelope-free payload construction for the reaction batch
// lane. Emission goes through the event-scoped sink, which mints
// eventId (`evt.${triggerEventId}.${n}`) + causationEventId itself.

import type { CombatEventPayload } from '../battle/contracts/events'
import type { BuffDefinitionId } from '../battle/contracts/ids'
import type {
  ReactionParticipantSnapshot,
  ReactionContext,
} from './ReactionResolution'
import type { ReactionId } from './ReactionTypes'

/** spec sec.50 -- the consumed list is the PRE-CONSUME snapshot: every
    participant the reaction consumed (sinh: parent; khac: both),
    with the stacks it carried at selection. */
export function reactionResolvedPayload(
  context: ReactionContext,
  consumedParticipants: readonly ReactionParticipantSnapshot[],
  buffIdOf: (p: ReactionParticipantSnapshot) => BuffDefinitionId,
): Extract<CombatEventPayload, { type: 'reaction_resolved' }> {
  return {
    type: 'reaction_resolved',
    rootActionId: context.rootActionId,
    reactionId: context.reactionId,
    relation: context.relation,
    sourceId: context.sourceId,
    targetId: context.targetId,
    consumed: consumedParticipants.map((p) => ({
      buffId: buffIdOf(p),
      stacks: p.stacks,
    })),
  }
}

export function reactionSkippedPayload(
  reactionId: ReactionId,
  rootActionId: string,
): Extract<CombatEventPayload, { type: 'reaction_skipped' }> {
  return {
    type: 'reaction_skipped',
    rootActionId,
    reactionId,
    reason: 'stale_reaction_snapshot',
  }
}
