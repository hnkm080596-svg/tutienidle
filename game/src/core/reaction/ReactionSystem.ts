// ReactionSystem.ts -- the evaluation facade. M2 scope: candidate build
// + fixed-point selection (contract sec.28-35, INV-R04/R05/R06).
// The bias query is consulted ONCE per evaluation and the normalized
// snapshot is recorded per candidate (contract sec.80). Gate runs,
// resolution building, batch execution and trace emission land in
// M3/M4/M5.

import type { ElementType } from '../element/ElementType'
import type { CombatEntityId } from '../battle/contracts/ids'
import {
  buildCandidates as buildCandidateList,
  selectCandidate as selectFromList,
} from './ReactionCandidate'
import {
  IdentityReactionBiasQuery,
  normalizeReactionBias,
  type ReactionBiasQuery,
} from './ReactionBias'
import type { ReactionRegistry } from './ReactionRegistry'
import type {
  ReactionBoard,
  ReactionCandidate,
} from './ReactionTypes'

export class ReactionSystem {
  constructor(
    private readonly registry: ReactionRegistry,
    private readonly biasQuery: ReactionBiasQuery = new IdentityReactionBiasQuery(),
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
}
