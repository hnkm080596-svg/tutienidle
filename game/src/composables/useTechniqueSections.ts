import type { Technique } from '@/core/technique/Technique'
import { getTechniqueInsightTotalRequired, getTechniqueTier } from '@/core/technique/TechniqueTier'
import { statLabel } from '@/core/stats/StatLabels'
import { getCurrentRealm } from '@/core/realm/realmSystem'
import { COMBAT_TECHNIQUE_TYPES } from '@/data/technique/CombatTechniqueTypes'
import type { TooltipSection } from './useTooltip'
import type { GameManager } from '@/core/game/GameManager'

/**
 * Trích từ TechniqueSlotCard.vue (2026-08-20) — dùng chung cho tooltip
 * (hover) VÀ khối thông tin inline mới ở LoadoutManager.vue's tab Tâm
 * Pháp (PLAN HOÀN CHỈNH mục 5/9 rework — không còn ô "Đã Học" để bấm
 * đổi công pháp, thay bằng đọc thẳng thông tin công pháp đang mang).
 * Pháp Tu Redesign (magicpath) — Tâm Pháp không còn cộng chỉ số dưới
 * bất kỳ hình thức nào ngoài `tierEffects` (đúng ĐÚNG tier hiện tại,
 * xem TechniqueTier.ts — giờ suy từ techniqueExperience thay vì
 * player.realmId).
 */
export function buildTechniqueSections(
  technique: Technique,
  gameManager: GameManager,
  techniqueInsight: number,
): TooltipSection[] {
  const sections: TooltipSection[] = []

  function skillName(skillId: string): string {
    return gameManager.skillManager.get(skillId)?.name ?? skillId
  }

  const combatRows: { label: string; value: string }[] = []

  if (technique.combatTypeId) {
    const config = COMBAT_TECHNIQUE_TYPES.find(entry => entry.id === technique.combatTypeId)

    combatRows.push({ label: 'Hệ', value: config?.name ?? technique.combatTypeId })

    if (config) {
      combatRows.push({ label: 'Chỉ số chính', value: config.mainStats.map(statLabel).join(' / ') })
      combatRows.push({ label: 'Chỉ số phụ', value: config.substatPool.map(statLabel).join(', ') })
    }
  }

  if (technique.innateSkillId) {
    combatRows.push({ label: 'Tuyệt kỹ nội tại', value: skillName(technique.innateSkillId) })
  }

  if (technique.resourceLabel) {
    combatRows.push({ label: 'Tài nguyên', value: technique.resourceLabel })
  }

  if (technique.usesSwordIntentResource) {
    combatRows.push({ label: 'Nguồn lực', value: 'Kiếm Ý — tầng vĩnh viễn theo boss diệt + pool trong trận' })
  }

  const tierEffect = technique.tierEffects?.[
    getTechniqueTier(techniqueInsight, getTechniqueInsightTotalRequired(technique))
  ]

  if (tierEffect) {
    if (tierEffect.attackFlat !== undefined) {
      combatRows.push({ label: 'Công kích', value: `+${tierEffect.attackFlat}` })
    }

    if (tierEffect.defenseFlat !== undefined) {
      combatRows.push({ label: 'Phòng ngự', value: `+${tierEffect.defenseFlat}` })
    }

    if (tierEffect.maxMpPercent !== undefined) {
      combatRows.push({ label: 'Linh lực tối đa', value: `+${(tierEffect.maxMpPercent * 100).toFixed(1)}%` })
    }

    if (tierEffect.manaRegenPercent !== undefined) {
      combatRows.push({ label: 'Hồi Linh lực', value: `+${(tierEffect.manaRegenPercent * 100).toFixed(2)}%/s` })
    }
  }

  if (combatRows.length > 0) {
    sections.push({ label: 'Chiến Đấu', rows: combatRows })
  }

  const cultivationRows: { label: string; value: string }[] = []

  if (technique.passiveSkillIdsByRealm) {
    for (const [realmId, skillId] of Object.entries(technique.passiveSkillIdsByRealm)) {
      cultivationRows.push({ label: getCurrentRealm(realmId).name, value: skillName(skillId) })
    }
  }

  if (cultivationRows.length > 0) {
    sections.push({ label: 'Tu Luyện', rows: cultivationRows })
  }

  return sections
}
