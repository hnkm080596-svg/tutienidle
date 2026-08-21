import { computed } from 'vue'
import { useGameManager, useStateVersion } from './useGameState'
import { REALMS } from '@/data/realms/realm'
import { SKILLS } from '@/data/skill/Skills'
import { TECHNIQUES } from '@/data/technique/Techniques'

/**
 * Trích từ LoadoutManager.vue's tab Passive cũ (2026-08-20 — dời hẳn
 * sang CharacterPanel.vue, đặt dưới Ngũ Hành, xem PLAN HOÀN CHỈNH mục
 * 8 rework). Gộp passiveSkillIdsByRealm từ MỌI Tâm Pháp trong data
 * (hiện chỉ có 1 — spirit_gathering_scripture — nhưng gộp thay vì đọc
 * từ tâm pháp ĐANG TRANG BỊ) để lưới 9 ô luôn hiện đủ, không phụ thuộc
 * có đang trang bị tâm pháp tu luyện nào hay không.
 */
export function usePassiveRows() {
  const gameManager = useGameManager()
  const { stateVersion } = useStateVersion()

  const passiveMapping = computed(() => {
    const merged: Record<string, string> = {}

    for (const technique of TECHNIQUES) {
      Object.assign(merged, technique.passiveSkillIdsByRealm ?? {})
    }

    return merged
  })

  const passiveRows = computed(() => {
    stateVersion.value

    const mapping = passiveMapping.value

    return REALMS
      .filter(realm => mapping[realm.id])
      .map(realm => {
        const skillId = mapping[realm.id]!
        const template = SKILLS.find(skill => skill.id === skillId)

        return {
          skillId,
          realmName: realm.name,
          name: template?.name ?? skillId,
          description: template?.description ?? '',
          unlocked: gameManager.skillManager.has(skillId),
        }
      })
  })

  const unlockedPassiveCount = computed(() => passiveRows.value.filter(row => row.unlocked).length)

  return { passiveRows, unlockedPassiveCount }
}
