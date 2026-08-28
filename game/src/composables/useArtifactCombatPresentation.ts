import { computed } from 'vue'
import { useGameManager, useStateVersion } from './useGameState'
import { usePlayerStore } from '@/stores/player'
import { buildArtifactCombatPresentation } from '@/core/artifact/ArtifactCombatPresentation'
import { selectAttackableTarget } from '@/core/battle/ActionTargetingSystem'

// Bản Mệnh Pháp Bảo — cầu nối reactivity DUY NHẤT giữa Vue và
// ArtifactCombatPresentation.ts thuần, cùng nhịp/pattern
// useCombatSkillPresentation.ts (đọc lại mỗi khi stateVersion đổi).
export function useArtifactCombatPresentation() {
  const gameManager = useGameManager()
  const player = usePlayerStore()
  const { stateVersion } = useStateVersion()

  const presentation = computed(() => {
    stateVersion.value

    const battle = gameManager.getBattle()

    if (!battle) {
      return buildArtifactCombatPresentation(null)
    }

    const primaryTarget = selectAttackableTarget(battle, player.combatAiStrategy)

    return buildArtifactCombatPresentation(battle, primaryTarget?.id)
  })

  return { presentation }
}
