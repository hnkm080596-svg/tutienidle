// ReactionSystem.ts -- the evaluation facade. Candidate build +
// fixed-point selection (contract sec.28-35, INV-R04/R05/R06) plus the
// M3 full chain: gate -> board snapshot -> candidates -> once-normalized
// bias -> select -> resolve (snapshot + preconditions + consume ops +
// payoff-emission seam for M4's ReactionOperations).
//
// The bias query is consulted ONCE per evaluation and the normalized
// snapshot is recorded per candidate (contract sec.80). The engine is
// production-INERT: no scheduler registration, no capability grant --
// M-INT wires nothing.

import type { ElementType } from '../element/ElementType'
import type { CombatEntityId } from '../battle/contracts/ids'
import type { ElementalApplicationCommitted } from '../battle/contracts/events'
import type { ResolvedCombatOperation } from '../battle/contracts/operations'
import type { DeferredOperation } from '../battle/contracts/settlement'
import {
  buildCandidates as buildCandidateList,
  selectCandidate as selectFromList,
} from './ReactionCandidate'
import {
  IdentityReactionBiasQuery,
  normalizeReactionBias,
  type ReactionBiasQuery,
} from './ReactionBias'
import type { ElementalBoardQuery } from './ReactionBoard'
import type { ReactionDefinition } from './ReactionDefinition'
import type { ReactionRegistry } from './ReactionRegistry'
import {
  resolveCandidate as buildResolution,
  type ReactionContext,
  type ReactionEvaluationTrace,
  type ReactionResolution,
} from './ReactionResolution'
import type { ReactionGateCheck } from './ReactionTriggerGate'
import type {
  ReactionBoard,
  ReactionCandidate,
  ReactionEvaluationResult,
} from './ReactionTypes'

import { emitPayoffOperations } from './ReactionOperations'

/** The authored payoff ops for a selected definition, built against the
    FROZEN context (snapshot participants/stacks). The production
    default is ReactionOperations' emitPayoffOperations; tests may
    inject a scripted emitter. */
export type ReactionPayoffEmitter = (
  def: ReactionDefinition,
  context: ReactionContext,
) => readonly (ResolvedCombatOperation | DeferredOperation)[]

export class ReactionSystem {
  constructor(
    private readonly registry: ReactionRegistry,
    private readonly board: ElementalBoardQuery,
    private readonly gate: ReactionGateCheck,
    private readonly biasQuery: ReactionBiasQuery = new IdentityReactionBiasQuery(),
    private readonly payoffEmitter: ReactionPayoffEmitter = emitPayoffOperations,
  ) {}

  /** spec sec.15/28 -- registry-scan candidates for a trigger element on
      a board. Bias is normalized once and folded into every candidate
      (contract sec.80). */
  buildCandidates(
    sourceId: CombatEntityId,
    triggerElement: ElementType,
    board: ReactionBoard,
  ): ReactionCandidate[] {
    const bias = normalizeReactionBias(
      this.biasQuery.getFor(sourceId, triggerElement),
    )
    return buildCandidateList(
      triggerElement,
      board,
      this.registry.all(),
      bias,
    )
  }

  /** contract sec.33 -- fixed-point winner: max weight -> khac > sinh ->
      lower selectionTiePriority. */
  selectCandidate(
    candidates: readonly ReactionCandidate[],
  ): ReactionCandidate | undefined {
    return selectFromList(candidates)
  }

  /** contract sec.36-39 -- the resolution record for a selected
      candidate: participant snapshot, one precondition per participant,
      consume ops heading the batch (sec.44), authored payoff via the
      injected emitter (M4 wires ReactionOperations). */
  resolveCandidate(
    candidate: ReactionCandidate,
    event: ElementalApplicationCommitted,
    board: ReactionBoard,
  ): ReactionResolution {
    return buildResolution(candidate, event, board, this.payoffEmitter)
  }

  /** The full evaluation chain for one elemental application
      (contract sec.23-39): gate verdict -> board read -> candidates ->
      selection -> resolution. Produces at most ONE resolution
      (INV-R05). The trace records board, evaluated candidates, winner,
      preconditions and emitted op ids (contract sec.85). */
  evaluateAfterElementalApplication(
    event: ElementalApplicationCommitted,
  ): ReactionEvaluationResult {
    const verdict = this.gate.check(event)
    if (verdict !== 'evaluate') {
      return { kind: 'no_reaction', gate: verdict }
    }

    const board = this.board.read(event.sourceId, event.targetId)
    const candidates = this.buildCandidates(
      event.sourceId,
      event.element,
      board,
    )
    const winner = this.selectCandidate(candidates)
    if (winner === undefined) {
      return { kind: 'no_reaction', gate: 'evaluate', reason: 'no_candidates' }
    }

    const resolution = this.resolveCandidate(winner, event, board)
    const trace: ReactionEvaluationTrace = {
      eventId: event.eventId,
      combatSequence: event.combatSequence,
      board,
      candidates: candidates.map((c) => ({
        reactionId: c.definition.id,
        baseStrength: c.baseStrength,
        evaluatedBias: c.evaluatedBias,
        finalWeightScaled: c.finalWeightScaled,
      })),
      selected: winner.definition.id,
      preconditions: resolution.preconditions,
      operationIds: resolution.operations.map((op) => op.operationId),
    }
    return { kind: 'resolved', resolution, trace }
  }
}
