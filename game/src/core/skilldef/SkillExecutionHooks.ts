// skilldef/SkillExecutionHooks.ts -- the orchestration seam (M4).
//
// The executor emits authored semantics through the scheduler; battle
// orchestration (TurnBattleSystem's resolveDeclaredHit consequence
// chain -- defender income, on-hit procs, reactive windows, stat
// refresh, death sweep) interleaves BETWEEN settlement barriers via
// these hooks. Hooks observe; they never feed results back into the
// plan -- orchestration state stays outside the executor.
//
// Ordering contract (TBS per-hit parity):
//   hit op settles        -> onOperationSettled (hit result visible)
//   landed gate entered   -> pre-consequence slot (procs/reactive)
//   gated ops settle      -> per-op settled (no gate events)
//   landed gate exited    -> post-consequence slot (taken windows,
//                            refresh, sweep)
//   next op will settle   -> flush point for tails that never got a
//                            gate (landed hit with no authored
//                            consequences)
//   plan completed        -> final flush point.
//
// The executor fires willSettle BEFORE enqueueing (pre-mutation point)
// and settled AFTER the barrier drains (result committed). A landed
// hit with no authored gate still gets its tail flushed at the next
// op's willSettle or at onPlanCompleted -- nothing mutates between, so
// the timing is equivalent to "immediately after the hit".

import type { ResolvedCombatOperation } from '../battle/contracts/operations'
import type { CombatOperationResult } from '../battle/contracts/results'
import type { ResolvedLandedGate, ResolvedSkillPlan } from './ResolvedSkillPlan'

export interface SkillExecutionHooks {
  /** Pre-mutation point: the op is about to enqueue+settle. */
  onOperationWillSettle?(operation: ResolvedCombatOperation): void
  /** Post-barrier point: the op settled and its result committed.
      `plan` is the executing plan -- composite extras carry their own
      def id (TBS pickedSkill parity for basic-income checks). */
  onOperationSettled?(
    operation: ResolvedCombatOperation,
    result: CombatOperationResult,
    plan: ResolvedSkillPlan,
  ): void
  /** The compiled target_hit_landed branch's condition evaluated TRUE
      and its body is about to run -- the pre-consequence orchestration
      slot (TBS: on-hit procs + reactive follow-up trigger). `plan` is
      the executing plan (composite extras carry their own def id). */
  onLandedGateEntered?(gate: ResolvedLandedGate, plan: ResolvedSkillPlan): void
  /** The gated branch body finished -- the post-consequence slot
      (TBS: taken-side reactive windows, stat refresh, death sweep). */
  onLandedGateExited?(gate: ResolvedLandedGate, plan: ResolvedSkillPlan): void
  /** One plan's steps (incl. inline composite lanes) finished -- the
      final flush point before the next plan/follow-up begins. */
  onPlanCompleted?(plan: ResolvedSkillPlan): void
}
