import type { RealmPassiveTooltipContent } from '@/composables/useTooltip'
export interface RealmUiPassive {
  id: string
  name: string
  description: string
  iconUrl?: string
  tierLabel?: string
  tierIndex?: number
  tierCount?: number
  tooltip?: RealmPassiveTooltipContent
  effectLines: readonly string[]
}

export interface RealmUiModel {
  name: string
  currentFloor: number
  /** realm.maxLevel (12 for CORE realms, 18 extended) - bounds markers. */
  maxFloor: number
  progress: number
  cultivation: string
  rate: string
  /** Granted realm passives (grantedRealmPassiveIds) - real state, kept
      even though the reference omits them (compact list under the
      breakthrough block). */
  passives: readonly RealmUiPassive[]
  nextRealmName: string
  ctaLabel: string
  /** cultivation >= required && floor < realm.maxLevel - the "Dot Pha"
      floor-advance button renders (auto floor-advance removed
      2026-10-11: a floor only moves when the player presses it). */
  canAdvanceFloor: boolean
  /** canTriggerBreakthrough - one input of the floor-12+ ritual gate. */
  ctaEnabled: boolean
  /** Which canonical action the floor-12+ ritual button fires: mortal
      sword-path re-entry rides 'quanKhi', everything else rides the
      shared 'breakthrough' ceremony. Defaults to 'breakthrough'. */
  ritualAction?: 'breakthrough' | 'quanKhi'
}
