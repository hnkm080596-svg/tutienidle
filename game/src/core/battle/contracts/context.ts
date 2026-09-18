// contracts/context.ts -- review r3 BLOCKER 1: the executor hands each
// authority call this context; ctx.events is an OP-SCOPED sink so the
// authority never does id bookkeeping -- it just emits {type, ...fields}.

import type { CombatOperationId } from './ids'
import type { CombatOperationOrigin } from './origin'
import type { CombatEventSink } from './sink'

export interface CombatAuthorityExecutionContext {
  /** The op currently executing. */
  operationId: CombatOperationId
  origin: CombatOperationOrigin
  /** Scoped to this op -- mints `evt.${operationId}.${n}`. */
  events: CombatEventSink
  /** v7.1 (buff-plan review amendment) -- the executing op's OWN
      combatSequence, allocated at execution-START before this ctx is
      built (r6). Read channel for authorities stamping internal state
      (BuffInstance.createdSequence / lastAppliedSequence). Allocation
      stays with the scheduler -- the ctx is never an allocator. */
  combatSequence: number
}
