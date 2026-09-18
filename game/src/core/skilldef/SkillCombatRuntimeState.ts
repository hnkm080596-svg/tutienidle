// skilldef/SkillCombatRuntimeState.ts -- R6 state layer 3: battle-scoped
// cast state. The turn runtime owns it (today's home is
// TurnSkillSlot.remainingCooldownTurns + the actor's charge fields); it is
// NOT saved. The executor never writes it directly -- CAST_COMMIT routes
// through SkillCastCommitPort, whose implementation lives with the owner
// (executor requests, owner writes).

import type { SkillId } from '../battle/contracts/ids'

export interface SkillCombatRuntimeState {
  skillId: SkillId
  /** R8 turn-unit cadence -- today's remainingCooldownTurns. */
  cooldownRemainingTurns: number
  /** chargeTurns progress (chargingTurnsRemaining parity): set at the
      charge-init cast's CAST_COMMIT; the deferred resolution is a
      non-committing follow-up plan. */
  chargeProgress?: number
  /** last committed cast's sequence -- bookkeeping for
      cooldown/status-phase exclusions. */
  lastCastSequence?: number
}
