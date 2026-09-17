// ReactionTriggerGate.ts -- contract sec.23. The gate decides whether an
// ElementalApplicationCommitted event MAY produce a reaction evaluation.
// It never evaluates: 'evaluate' is a verdict, not an answer.
//
// Chain order is LOCKED (first failure wins the verdict):
//   suppressed -> not_elemental -> no_stack_gain -> capability_missing
//   -> evaluate
// Capability is queried LAST -- only after the structural gates pass
// (proven by spy tests, contract sec.23).

import type { CombatCapabilityQuery } from '../battle/contracts/capability'
import type { ElementalApplicationCommitted } from '../battle/contracts/events'
import type { ElementalStateRegistry } from './ElementalStateRegistry'
import {
  ELEMENTAL_REACTION_CAPABILITY,
  type ReactionGateVerdict,
} from './ReactionTypes'

export class ReactionTriggerGate {
  constructor(
    private readonly capabilities: CombatCapabilityQuery,
    private readonly elements: ElementalStateRegistry,
  ) {}

  check(event: ElementalApplicationCommitted): ReactionGateVerdict {
    if (event.reactionEligibility !== 'eligible') return 'suppressed'
    // Structural guard: the event's element must round-trip through the
    // shared registry for its own definitionId -- a def id the registry
    // doesn't know (or maps to another element) is not canonical state.
    if (this.elements.getElement(event.definitionId) !== event.element) {
      return 'not_elemental'
    }
    if (event.addedStacks <= 0) return 'no_stack_gain'
    if (
      !this.capabilities.has(event.sourceId, ELEMENTAL_REACTION_CAPABILITY)
    ) {
      return 'capability_missing'
    }
    return 'evaluate'
  }
}
