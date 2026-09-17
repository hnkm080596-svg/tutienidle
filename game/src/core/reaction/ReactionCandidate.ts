// ReactionCandidate.ts -- contract sec.28-35. Candidate generation scans
// the registry (no pair-table): a def qualifies iff both its relation
// elements have stacks > 0 on the board AND the trigger element is one
// of them -- at most 4 candidates per trigger element. Direction comes
// from WuxingRelations inside the def, never arrival order (INV-R06).
//
// Selection (contract sec.33): max finalWeightScaled -> khac beats sinh
// -> lower selectionTiePriority. Payoff is NEVER inspected (sec.35).

import type { ElementType } from '../element/ElementType'
import type { ReactionDefinition } from './ReactionDefinition'
import type { NormalizedReactionBias } from './ReactionBias'
import {
  boardStacks,
  type ReactionBoard,
  type ReactionCandidate,
} from './ReactionTypes'

/** The element driving the reaction (R-D): sinh -> parent, khac ->
    attacker. Element bias is keyed on this. */
export function agentElement(def: ReactionDefinition): ElementType {
  return def.relation === 'sinh'
    ? def.elements.parent!
    : def.elements.attacker!
}

/** sinh: P^2; khac: A*D -- integer board-stack products (spec sec.74). */
export function computeBaseStrength(
  def: ReactionDefinition,
  board: ReactionBoard,
): number {
  if (def.relation === 'sinh') {
    const p = boardStacks(board, def.elements.parent!)
    return p * p
  }
  return (
    boardStacks(board, def.elements.attacker!) *
    boardStacks(board, def.elements.defender!)
  )
}

/** Exact integer weight (contract sec.31): base * rBps * eBps * xBps.
    Max 25 * 10^4 * 10^4 * 10^4 = 25e12 << 2^53. */
export function computeFinalWeight(
  base: number,
  def: ReactionDefinition,
  bias: NormalizedReactionBias,
): number {
  return (
    base *
    bias.relationBps[def.relation] *
    bias.elementBps(agentElement(def)) *
    bias.reactionBps(def.id)
  )
}

/** spec sec.15/28: scan the catalog, keep defs whose two elements both
    have stacks > 0 on the board AND include the trigger element. */
export function buildCandidates(
  triggerElement: ElementType,
  board: ReactionBoard,
  defs: readonly ReactionDefinition[],
  bias: NormalizedReactionBias,
): ReactionCandidate[] {
  const candidates: ReactionCandidate[] = []
  for (const def of defs) {
    const [a, b] =
      def.relation === 'sinh'
        ? [def.elements.parent!, def.elements.child!]
        : [def.elements.attacker!, def.elements.defender!]
    if (a !== triggerElement && b !== triggerElement) continue
    if (boardStacks(board, a) <= 0 || boardStacks(board, b) <= 0) continue
    const base = computeBaseStrength(def, board)
    const evaluatedBias = {
      relationBps: bias.relationBps[def.relation],
      elementBps: bias.elementBps(agentElement(def)),
      reactionBps: bias.reactionBps(def.id),
    }
    candidates.push({
      definition: def,
      baseStrength: base,
      finalWeightScaled:
        base * evaluatedBias.relationBps * evaluatedBias.elementBps * evaluatedBias.reactionBps,
      evaluatedBias,
    })
  }
  return candidates
}

/** contract sec.33 -- one winner per evaluation (INV-R05: one application
    evaluates at most one reaction). */
export function selectCandidate(
  candidates: readonly ReactionCandidate[],
): ReactionCandidate | undefined {
  let best: ReactionCandidate | undefined
  for (const candidate of candidates) {
    if (best === undefined || outranks(candidate, best)) {
      best = candidate
    }
  }
  return best
}

function outranks(a: ReactionCandidate, b: ReactionCandidate): boolean {
  if (a.finalWeightScaled !== b.finalWeightScaled) {
    return a.finalWeightScaled > b.finalWeightScaled
  }
  if (a.definition.relation !== b.definition.relation) {
    return a.definition.relation === 'khac'
  }
  return a.definition.selectionTiePriority < b.definition.selectionTiePriority
}
