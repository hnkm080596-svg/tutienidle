// ReactionBias.ts -- spec sec.54 shape, contract sec.31 fixed-point
// representation + sec.79-80 query contract.
//
// All biases are integer basis-points on BIAS_SCALE (10_000 = x1.00):
// selection weight math is EXACT integer product, never float compare.
// The query is consulted ONCE per evaluation (contract sec.80) -- the
// normalized snapshot is recorded per candidate in evaluatedBias.

import type { ElementType } from '../element/ElementType'
import type { CombatEntityId } from '../battle/contracts/ids'
import type {
  ReactionId,
  ReactionRelation,
} from './ReactionTypes'

export const BIAS_SCALE = 10_000 as const

export interface ReactionBias {
  readonly relationBiasBps?: { sinh?: number; khac?: number }
  /** Keyed by the AGENT element (R-D): sinh -> parent, khac -> attacker. */
  readonly elementBiasBps?: Partial<Record<ElementType, number>>
  readonly reactionBiasBps?: Partial<Record<ReactionId, number>>
}

/** Defaults-materialized view: every absent field reads as x1.00. */
export interface NormalizedReactionBias {
  readonly relationBps: Record<ReactionRelation, number>
  readonly elementBps: (agentElement: ElementType) => number
  readonly reactionBps: (reactionId: ReactionId) => number
}

export function normalizeReactionBias(
  bias: ReactionBias | undefined,
): NormalizedReactionBias {
  return {
    relationBps: {
      sinh: bias?.relationBiasBps?.sinh ?? BIAS_SCALE,
      khac: bias?.relationBiasBps?.khac ?? BIAS_SCALE,
    },
    elementBps: (agentElement) =>
      bias?.elementBiasBps?.[agentElement] ?? BIAS_SCALE,
    reactionBps: (reactionId) =>
      bias?.reactionBiasBps?.[reactionId] ?? BIAS_SCALE,
  }
}

/** Contract sec.79 -- the per-source, per-trigger bias feed. Production
    default is IdentityReactionBiasQuery (all x1.00); later stat/buff
    channels implement this port. */
export interface ReactionBiasQuery {
  getFor(sourceId: CombatEntityId, triggerElement: ElementType): ReactionBias
}

export class IdentityReactionBiasQuery implements ReactionBiasQuery {
  getFor(
    _sourceId: CombatEntityId,
    _triggerElement: ElementType,
  ): ReactionBias {
    return {}
  }
}
