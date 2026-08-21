import { computed } from 'vue'
import { useGameManager, useStateVersion } from './useGameState'

// Trích từ HomeBuildingIcons.vue (Động Phủ UI redesign, giờ DongFuScene.vue
// cũng cần đúng check này) — đang ở giữa 1 Stage hoặc trận đang đánh,
// camera MainScene.ts đang zoom vào khung combat nên mọi thứ tĩnh của
// Home Scene (building icon, background động phủ) phải tự ẩn, tránh
// đè lên khung combat.
export function useStageActive() {
  const gameManager = useGameManager()
  const { stateVersion } = useStateVersion()

  return computed(() => {
    stateVersion.value

    return gameManager.stageManager.get() !== null || gameManager.getBattle()?.state === 'fighting'
  })
}
