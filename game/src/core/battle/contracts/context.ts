// contracts/context.ts — review r3 BLOCKER 1: the executor hands each
// authority call this context; ctx.events is an OP-SCOPED sink so the
// authority never does id bookkeeping — it just emits {type, ...fields}.

import type { CombatOperationId } from './ids'
import type { CombatOperationOrigin } from './origin'
import type { CombatEventSink } from './sink'

export interface CombatAuthorityExecutionContext {
  /** The op currently executing. */
  operationId: CombatOperationId
  origin: CombatOperationOrigin
  /** Scoped to this op — mints `evt.${operationId}.${n}`. */
  events: CombatEventSink
}
