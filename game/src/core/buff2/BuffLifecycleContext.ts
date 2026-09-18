// BuffLifecycleContext.ts -- the lifecycle-boundary execution context
// (R-B8, contract v7.2/v7.3). Synthesized by the composition root per
// lifecycle root transaction; every lifecycle method takes it as `lctx`.
//
// `events` is the lifecycle-scoped CombatEventSink; `settle` is the
// contract v7.2 createLifecycleSink lane -- it drains the scheduler and
// returns the per-operation status map (diagnostics/tests ONLY -- `uses`
// finalization rides the PeriodicOperationSettled event, v7.3).

import type { CombatOperationId } from '../battle/contracts/ids'
import type { CombatOperationResultStatus } from '../battle/contracts/results'
import type { CombatEventSink } from '../battle/contracts/sink'

export interface BuffLifecycleContext {
  /** Root transaction id (`status.turn.N.*` etc.) -- provenance for the
      PeriodicRequestsCommitted events this boundary emits. */
  rootActionId: string
  /** The lifecycle root's combatSequence -- stamps instances created by
      lifecycle paths (conversions). */
  sequence: number
  events: CombatEventSink
  /** Per-unit + final barrier. INVARIANT: only while the scheduler is
      quiescent -- lifecycle roots are root transactions, never invoked
      mid-settlement. The returned map is diagnostics/tests only. */
  settle(): ReadonlyMap<CombatOperationId, CombatOperationResultStatus>
}
