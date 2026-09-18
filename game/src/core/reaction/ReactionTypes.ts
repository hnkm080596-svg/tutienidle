// ReactionTypes.ts -- shared reaction vocabulary (megaplan M1 +
// contract sec.23/26/27). Pure types + constants; no logic lives here.
//
// ElementType/WuxingRelations remain the element + relation authorities
// (core/element/) -- this module only names the reaction-domain roles,
// the board snapshot, and the locked gate-verdict vocabulary.

import type { ElementType } from '../element/ElementType'
import type {
  BuffInstanceId,
  CombatEntityId,
} from '../battle/contracts/ids'
import type { ReactionDefinition } from './ReactionDefinition'
import type {
  ReactionEvaluationTrace,
  ReactionResolution,
} from './ReactionResolution'

export type ReactionId = string
export type ReactionRelation = 'sinh' | 'khac'

/** Participant roles keyed by RELATION, not cast order (contract sec.36):
    sinh pairs snapshot {parent, child}; khac pairs {attacker, defender}.
    Direction comes from WuxingRelations -- never arrival order. */
export type ReactionParticipantRole = 'parent' | 'child' | 'attacker' | 'defender'

/** Contract sec.26 board snapshot: same-source, same-target stack counts
    per element + the live instanceId per element present (stacks > 0). */
export interface ReactionBoard {
  readonly sourceId: CombatEntityId
  readonly targetId: CombatEntityId
  readonly fireStacks: number
  readonly waterStacks: number
  readonly woodStacks: number
  readonly metalStacks: number
  readonly earthStacks: number
  /** Live instance per element present on the board (stacks > 0). */
  readonly instances: Readonly<Partial<Record<ElementType, BuffInstanceId>>>
}

/** Stack accessor -- element-keyed board fields stay the storage shape;
    payoff/candidate math reads through this so elements stay data. */
export function boardStacks(board: ReactionBoard, element: ElementType): number {
  switch (element) {
    case 'fire': return board.fireStacks
    case 'water': return board.waterStacks
    case 'wood': return board.woodStacks
    case 'metal': return board.metalStacks
    case 'earth': return board.earthStacks
  }
}

/** Contract sec.23 -- the LOCKED gate vocabulary. check() returns the
    FIRST failing gate in the authored chain order:
    suppressed -> not_elemental -> no_stack_gain -> capability_missing
    -> evaluate. */
export type ReactionGateVerdict =
  | 'evaluate'            // all gates passed
  | 'not_elemental'       // definitionId not registered / element mismatch (structural guard)
  | 'suppressed'          // reactionEligibility !== 'eligible'
  | 'no_stack_gain'       // addedStacks <= 0 (pure refresh / failed add)
  | 'capability_missing'  // source lacks 'elemental_reaction_enabled'

export const ELEMENTAL_REACTION_CAPABILITY = 'elemental_reaction_enabled' as const

/** Canonical seal ceiling (contract sec.27) -- fixture defs cap at 5;
    real defs author their own maxStacks. Board math never hard-codes it. */
export const REACTION_MAX_STACKS = 5 as const

// ---------------------------------------------------------------------------
// M2 -- candidates + evaluation result (contract sec.31-35).
// ---------------------------------------------------------------------------

/** A qualified relation on the board with its evaluated selection weight
    (contract sec.31-33). Built by buildCandidates; selected by
    selectCandidate -- payoff is NEVER inspected during selection. */
export interface ReactionCandidate {
  readonly definition: ReactionDefinition
  /** P^2 for sinh, A*D for khac -- integer, from board stacks. */
  readonly baseStrength: number
  /** Exact integer weight: baseStrength * relationBps * elementBps *
      reactionBps (max 25*10^12 << 2^53 -- contract sec.31). */
  readonly finalWeightScaled: number
  /** The bias snapshot evaluated for this candidate (contract sec.80 --
      queried once per evaluation, recorded in the trace). */
  readonly evaluatedBias: {
    relationBps: number
    elementBps: number
    reactionBps: number
  }
}

/** What one ElementalApplicationCommitted evaluation produced.
    Gate-rejected evaluations carry no trace (no board read ever ran);
    a 'no_candidates' evaluation DOES carry the trace -- the board +
    evaluated candidates are the debugging record (contract sec.85). */
export type ReactionEvaluationResult =
  | { kind: 'no_reaction'; gate: Exclude<ReactionGateVerdict, 'evaluate'> }
  | {
      kind: 'no_reaction'
      gate: 'evaluate'
      reason: 'no_candidates'
      trace: ReactionEvaluationTrace
    }
  | { kind: 'resolved'; resolution: ReactionResolution; trace: ReactionEvaluationTrace }
