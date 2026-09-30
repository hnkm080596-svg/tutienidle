// BETA FE-CONTRACT (work-order sec.4A) - canonical read-model for the
// Technique surface. The frontend renders this model; it must never
// rederive grade-advance eligibility (canAdvanceTechniqueGrade), the
// upgrade cost (getTechniqueGradeUpgradeCost), the bag comparison
// (materialBag.getAmount), or the display sections itself.
//
// Same conventions as betaScopeSkillDomain.ts: a pure query composing
// the domain predicates in TechniqueProgression.ts - nothing here
// writes state, consumes RNG, or grants content. The mutation stays
// the domain authority (realmAdvanceOps.tryAdvanceTechniqueGrade);
// this model only REPORTS eligibility.
import type { ElementType } from './element/ElementType'
import type { ItemQuality } from './item/ItemQuality'
import type { PlayerData } from './player/Player'
import type { Technique, TechniqueTier } from './technique/Technique'
import {
  canAdvanceTechniqueGrade,
  getTechniqueEffects,
  getTechniqueGradeUpgradeCost,
  getTechniqueMasteryForNextRank,
  getTechniqueTierForRank,
  TECHNIQUE_RANK_CAP,
} from './technique/TechniqueProgression'
import { statLabel } from './stats/StatLabels'
import { COMBAT_TECHNIQUE_TYPES } from '../data/technique/CombatTechniqueTypes'

// ---------------------------------------------------------------------------
// Display sections - the 'Chien Dau' block the tooltip and the inline
// band both render. Moved out of composables/useTechniqueSections.ts so
// the read-model owns it; the frontend never builds rows itself.
// ---------------------------------------------------------------------------

export interface TechniqueDisplayRow {
  label: string
  value: string
}

export interface TechniqueDisplaySection {
  label: string
  rows: TechniqueDisplayRow[]
}

/** The technique's 'Chien Dau' section (combat type, resource label,
 *  live band effects). Empty when the technique declares no combat
 *  vocabulary - display-only, no runtime binding. */
export function buildTechniqueDisplaySections(
  technique: Technique,
): TechniqueDisplaySection[] {
  const combatRows: TechniqueDisplayRow[] = []

  if (technique.combatTypeId) {
    const config = COMBAT_TECHNIQUE_TYPES.find((entry) => entry.id === technique.combatTypeId)

    combatRows.push({ label: 'Hệ', value: config?.name ?? technique.combatTypeId })

    if (config) {
      combatRows.push({ label: 'Chỉ số chính', value: config.mainStats.map(statLabel).join(' / ') })
      combatRows.push({ label: 'Chỉ số phụ', value: config.substatPool.map(statLabel).join(', ') })
    }
  }

  if (technique.resourceLabel) {
    combatRows.push({ label: 'Tài nguyên', value: technique.resourceLabel })
  }

  const tierEffect = getTechniqueEffects(technique)

  if (tierEffect) {
    if (tierEffect.mightFlat !== undefined) {
      combatRows.push({ label: 'Sức mạnh', value: `+${tierEffect.mightFlat}` })
    }

    if (tierEffect.defenseFlat !== undefined) {
      combatRows.push({ label: 'Phòng ngự', value: `+${tierEffect.defenseFlat}` })
    }

    if (tierEffect.maxMpIncreasePercent !== undefined) {
      combatRows.push({ label: 'Linh lực tối đa', value: `+${(tierEffect.maxMpIncreasePercent * 100).toFixed(1)}%` })
    }

    if (tierEffect.manaRegenIncreasePercent !== undefined) {
      combatRows.push({ label: 'Hồi Linh lực', value: `+${(tierEffect.manaRegenIncreasePercent * 100).toFixed(1)}%` })
    }
  }

  return combatRows.length > 0 ? [{ label: 'Chiến Đấu', rows: combatRows }] : []
}

// ---------------------------------------------------------------------------
// Technique surface read-model
// ---------------------------------------------------------------------------

export type BetaTechniqueState = 'unavailable' | 'available'

/**
 * Why grade advance is unavailable. Resolution order mirrors
 * tryAdvanceTechniqueGrade's own check sequence:
 *   'no-technique'         - no active technique holder
 *   'grade-ceiling'        - absolute display cap (grade >= 99)
 *   'realm-gate'           - grade below the legal floor (forged state)
 *                            or at/above the realm-derived ceiling
 *                            (canAdvanceTechniqueGrade) - break through
 *   'busy'                 - a turn battle is in progress
 *   'insufficient-material'- the spirit-stone cost outruns the bag
 */
export type BetaTechniqueGradeAdvanceDisabledReason =
  | 'no-technique'
  | 'grade-ceiling'
  | 'realm-gate'
  | 'insufficient-material'
  | 'busy'

export interface BetaTechniqueGradeAdvance {
  available: boolean
  disabledReason: BetaTechniqueGradeAdvanceDisabledReason | null
  /** Present whenever a cost is quotable (technique && grade < 99),
   *  even while another reason disables the action - the button renders
   *  the cost line inside a disabled state. */
  targetGrade?: number
  materialId?: string
  materialName?: string
  cost?: number
  owned?: number
}

export interface BetaTechniqueSurfaceModel {
  /** Canonical technique id; absent when no technique is active. */
  techniqueId?: string
  state: BetaTechniqueState
  name?: string
  grade?: number
  rank?: number
  mastery?: number
  /** Display fields the slot card renders verbatim. */
  icon?: string
  description?: string
  element?: ElementType
  quality?: ItemQuality
  /** Four-tier display band resolved from rank (getTechniqueTierForRank). */
  tier?: TechniqueTier
  /** Mastery cost of the next rank inside the live grade. */
  masteryForNextRank?: number
  /** rank >= TECHNIQUE_RANK_CAP - the exp bar shows full. */
  rankCapped?: boolean
  sections: readonly TechniqueDisplaySection[]
  gradeAdvance: BetaTechniqueGradeAdvance
}

export interface BetaTechniqueSurfaceDeps {
  /** The holder's active technique (techniqueManager.getActive()). */
  activeTechnique: Technique | undefined
  /** materialBag.getAmount - live bag read for the cost preview. */
  materialAmount: (materialId: string) => number
  /** Registry-resolved material display name (fallback: the id). */
  materialName: (materialId: string) => string
  /** isTurnBattleInProgress - grade advance is blocked mid-battle. */
  turnBattleInProgress: boolean
}

function gradeAdvanceFor(
  technique: Technique | undefined,
  player: PlayerData,
  deps: BetaTechniqueSurfaceDeps,
): BetaTechniqueGradeAdvance {
  if (!technique) {
    return { available: false, disabledReason: 'no-technique' }
  }

  // Absolute display cap - the surface never quotes a 100th grade
  // (mirrors the panel's own grade < 99 guard).
  const costPreview: Pick<
    BetaTechniqueGradeAdvance,
    'targetGrade' | 'materialId' | 'materialName' | 'cost' | 'owned'
  > = {}
  if (technique.grade < 99) {
    const quote = getTechniqueGradeUpgradeCost(technique.grade + 1, player.realmId)
    costPreview.targetGrade = technique.grade + 1
    costPreview.materialId = quote.materialId
    costPreview.materialName = deps.materialName(quote.materialId)
    costPreview.cost = quote.amount
    costPreview.owned = deps.materialAmount(quote.materialId)
  } else {
    return { available: false, disabledReason: 'grade-ceiling' }
  }

  if (!canAdvanceTechniqueGrade(technique, player.realmId)) {
    return { available: false, disabledReason: 'realm-gate', ...costPreview }
  }

  if (deps.turnBattleInProgress) {
    return { available: false, disabledReason: 'busy', ...costPreview }
  }

  if ((costPreview.owned ?? 0) < (costPreview.cost ?? 0)) {
    return { available: false, disabledReason: 'insufficient-material', ...costPreview }
  }

  return { available: true, disabledReason: null, ...costPreview }
}

/**
 * The beta Technique surface (work-order sec.4A). 'unavailable' when no
 * technique is active; every display/eligibility field resolves here -
 * the frontend renders the model and never calls the predicates itself.
 */
export function betaTechniqueSurfaceFor(
  player: PlayerData,
  deps: BetaTechniqueSurfaceDeps,
): BetaTechniqueSurfaceModel {
  const technique = deps.activeTechnique
  const gradeAdvance = gradeAdvanceFor(technique, player, deps)

  if (!technique) {
    return { state: 'unavailable', sections: [], gradeAdvance }
  }

  const rankCapped = technique.rank >= TECHNIQUE_RANK_CAP

  return {
    techniqueId: technique.id,
    state: 'available',
    name: technique.name,
    grade: technique.grade,
    rank: technique.rank,
    mastery: technique.mastery,
    icon: technique.icon,
    description: technique.description,
    element: technique.element,
    quality: technique.quality,
    tier: getTechniqueTierForRank(technique.rank),
    masteryForNextRank: rankCapped ? undefined : getTechniqueMasteryForNextRank(technique.grade),
    rankCapped,
    sections: buildTechniqueDisplaySections(technique),
    gradeAdvance,
  }
}
