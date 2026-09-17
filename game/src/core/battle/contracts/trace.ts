// contracts/trace.ts -- CombatExecutionRecord (review r2 HIGH 2: an op's
// combatSequence lives on the RECORD, not on the op).
//
// `combatSequence` is allocated at EXECUTION-START -- before
// executor.execute() -- so an op's sequence always precedes the events it
// emits (r6 BLOCKER). Sole allocator: CombatScheduler.

import type { ResolvedCombatOperation } from './operations'
import type { CombatOperationResult } from './results'

export interface CombatExecutionRecord {
  combatSequence: number
  operation: ResolvedCombatOperation
  result: CombatOperationResult
}
