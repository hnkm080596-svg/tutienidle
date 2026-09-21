import type { Technique } from '@/core/technique/Technique'
import { getTechniqueEffects } from '@/core/technique/TechniqueProgression'
import { statLabel } from '@/core/stats/StatLabels'
import { COMBAT_TECHNIQUE_TYPES } from '@/data/technique/CombatTechniqueTypes'
import type { TooltipSection } from './useTooltip'

/**
 * Extracted from TechniqueSlotCard.vue (2026-08-20) - shared by the
 * (hover) tooltip AND the inline info block in TechniqueBand.vue.
 * P7-M3 - effect rows resolve via getTechniqueEffects(technique): the
 * active grade's table at the current rank band (rank/mastery/grade
 * model, see TechniqueProgression.ts).
 *
 * P7-M2 - no passive rows here: realm-entry passives are way-owned
 * (realmRewards/passiveSkillIds), the technique display has no business
 * rendering way-owned rewards.
 */
export function buildTechniqueSections(
  technique: Technique,
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

  const tierEffect = getTechniqueEffects(technique)

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
