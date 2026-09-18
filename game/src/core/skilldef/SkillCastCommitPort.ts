// skilldef/SkillCastCommitPort.ts -- R-S9: the ONE command surface the
// executor owns. Cooldown/charge commit is skill-domain battle state --
// NOT a contract authority domain -- so it rides this narrow port
// instead of a CombatOperation; resource cost DOES ride the canonical
// ConsumeResourceOperation (vitals/resource authority + events).
//
// Composition root wires this to the turn-runtime owner of
// SkillCombatRuntimeState -- the executor requests, the owner writes
// (R6 state ownership intact).

import type { ResolvedSkillPlan } from './ResolvedSkillPlan'

export interface SkillCastCommitPort {
  /** CAST_COMMIT for a root cast (subcastIndex===0): the owner writes
      cooldownRemainingTurns = plan.cadence.cooldownTurns onto the
      owning SkillCombatRuntimeState (and chargeProgress for
      chargeTurns>0 charge-init casts). Called exactly once per root
      cast -- follow-up plans never reach it, and committed
      cooldown+cost never roll back on whiff (spec sec.14). */
  commit(plan: ResolvedSkillPlan): void
}
