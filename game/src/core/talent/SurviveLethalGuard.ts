import { getSurviveLethalUsesPerBattle } from './TalentEffects'

/**
 * Bat Tu The talent (talent-direction-choice-plan sec.6) - battle-
 * scoped lethal-survival charge counter:
 * - beginBattle() resets charges from the player's talent each NEW
 *   battle.
 * - Tribulation is a real rite and may NEVER trigger it - the contract
 *   is tribulation resolution via TribulationDirector, not via
 *   beginBattleCycle/CombatSystem, so no session guard is ever bound
 *   to that fight.
 *
 * Consumed at CombatSystem.killIfDead() - the ONLY point declaring
 * death (HP <= 0 -> alive = false) across every damage path.
 */
export class SurviveLethalGuard {
  private remainingUses = 0

  beginBattle(selectedTalentIds: readonly string[] | undefined): void {
    this.remainingUses = getSurviveLethalUsesPerBattle(selectedTalentIds)
  }

  getRemainingUses(): number {
    return this.remainingUses
  }

  /** Trừ 1 lượt nếu còn — true nếu đòn chí mạng lần này được sống sót. */
  tryConsumeUse(): boolean {
    if (this.remainingUses <= 0) {
      return false
    }

    this.remainingUses -= 1

    return true
  }
}
