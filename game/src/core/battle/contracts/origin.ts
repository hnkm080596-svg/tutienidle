// contracts/origin.ts -- CombatOperationOrigin (contract sec.10).
//
// Every runtime operation carries provenance. `sourceId` on the origin is
// the single canonical source field -- operations deliberately have no
// top-level sourceId (review r2 HIGH 3: three mutable copies would drift).

import type {
  CombatEntityId,
  CombatEventId,
  CombatOperationId,
  ReactionId,
} from './ids'

export type CombatOperationOriginKind =
  | 'skill'
  | 'reaction'
  | 'buff_periodic'
  | 'proc'
  | 'scripted'

export interface CombatOperationOrigin {
  kind: CombatOperationOriginKind
  originId: string
  sourceId: CombatEntityId
  /** Id of the root combat resolution transaction -- NOT restricted to
      skill casts: `action.turn.N.*` for declared actions,
      `status.turn.N.*` for buff/status phase ticks, `script.*` for
      scripted beats, `proc.*` for proc-driven roots (R-C2). */
  rootActionId: string
  parentOperationId?: CombatOperationId
  causationEventId?: CombatEventId
  castId?: string
  subcastIndex?: number
  reactionId?: ReactionId
}
