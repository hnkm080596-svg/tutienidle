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

  beginBattle(
    selectedTalentIds: readonly string[] | undefined,
    talentLevels?: Readonly<Record<string, number>>,
  ): void {
    this.remainingUses = getSurviveLethalUsesPerBattle(selectedTalentIds, talentLevels)
  }

  getRemainingUses(): number {
    return this.remainingUses
  }

  /** Tru 1 luot neu con - true neu don chi mang lan nay duoc song sot. */
  tryConsumeUse(): boolean {
    if (this.remainingUses <= 0) {
      return false
    }

    this.remainingUses -= 1

    return true
  }
}
