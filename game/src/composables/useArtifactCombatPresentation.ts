import { computed } from 'vue'
import { useStateVersion } from './useGameState'
import { buildArtifactCombatPresentation } from '@/core/artifact/ArtifactCombatPresentation'

// Bản Mệnh Pháp Bảo — cầu nối reactivity DUY NHẤT giữa Vue và
// ArtifactCombatPresentation.ts thuần, cùng nhịp/pattern
// useCombatSkillPresentation.ts (đọc lại mỗi khi stateVersion đổi).
//
// M13: TurnBattle has no `artifactRuntime` field — the artifact combat
// runtime (ArtifactSystem) is a legacy real-time feature that is not
// wired into the turn engine, so this reader always yields EMPTY_STATE
// until a turn-based artifact owner lands. The builder contract now
// takes the runtime directly instead of a fake `as unknown as Battle`.
export function useArtifactCombatPresentation() {
  const { stateVersion } = useStateVersion()

  const presentation = computed(() => {
    stateVersion.value

    return buildArtifactCombatPresentation(null)
  })

  return { presentation }
}
