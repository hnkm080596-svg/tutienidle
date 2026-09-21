import type { Technique } from '@/core/technique/Technique'
import { getTechniqueInsightTotalRequired, getTechniqueTier } from '@/core/technique/TechniqueTier'
import { statLabel } from '@/core/stats/StatLabels'
import { COMBAT_TECHNIQUE_TYPES } from '@/data/technique/CombatTechniqueTypes'
import type { TooltipSection } from './useTooltip'

/**
 * Extracted from TechniqueSlotCard.vue (2026-08-20) - shared by the
 * (hover) tooltip AND the inline info block in LoadoutManager.vue's Tam
 * Phap tab (PLAN HOAN CHINH item 5/9 rework - no "Da Hoc" cell to click
 * for technique switching; reads the equipped technique's info
 * directly). Phap Tu Redesign (magicpath) - Tam Phap grants no stats in
 * any form outside `tierEffects` (exactly the CURRENT tier, see
 * TechniqueTier.ts - now derived from techniqueExperience instead of
 * player.realmId).
 *
 * P7-M2 - no passive rows here: realm-entry passives are way-owned
 * (realmRewards/passiveSkillIds), the technique display has no business
 * rendering way-owned rewards.
 */
export function buildTechniqueSections(
  technique: Technique,
  techniqueInsight: number,
): TooltipSection[] {
  const sections: TooltipSection[] = []

  const combatRows: { label: string; value: string }[] = []

  if (technique.combatTypeId) {
    const config = COMBAT_TECHNIQUE_TYPES.find(entry => entry.id === technique.combatTypeId)

    combatRows.push({ label: 'Hệ', value: config?.name ?? technique.combatTypeId })

    if (config) {
      combatRows.push({ label: 'Chỉ số chính', value: config.mainStats.map(statLabel).join(' / ') })
      combatRows.push({ label: 'Chỉ số phụ', value: config.substatPool.map(statLabel).join(', ') })
    }
  }

  if (technique.resourceLabel) {
    combatRows.push({ label: 'Tài nguyên', value: technique.resourceLabel })
  }

  const tierEffect = technique.tierEffects?.[
    getTechniqueTier(techniqueInsight, getTechniqueInsightTotalRequired(technique))
  ]

  if (tierEffect) {
    if (tierEffect.mightFlat !== undefined) {
      combatRows.push({ label: 'Sức mạnh', value: `+${tierEffect.mightFlat}` })
    }

    if (tierEffect.defenseFlat !== undefined) {
      combatRows.push({ label: 'Phòng ngự', value: `+${tierEffect.defenseFlat}` })
    }

    // Task 3 (D17): the tier fields are plain authoring percents that
    // become {stat, percent, domain:'spell'} modifiers — display them
    // as % directly (the retired bespoke stat keys no longer exist to
    // feed formatStat()).
    if (tierEffect.maxMpIncreasePercent !== undefined) {
      combatRows.push({ label: 'Linh lực tối đa', value: `+${(tierEffect.maxMpIncreasePercent * 100).toFixed(1)}%` })
    }

    if (tierEffect.manaRegenIncreasePercent !== undefined) {
      combatRows.push({ label: 'Hồi Linh lực', value: `+${(tierEffect.manaRegenIncreasePercent * 100).toFixed(1)}%` })
    }
  }

  if (combatRows.length > 0) {
    sections.push({ label: 'Chiến Đấu', rows: combatRows })
  }

  return sections
}
