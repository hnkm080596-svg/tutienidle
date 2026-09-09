import { computed, inject } from 'vue'
import { useGameManager, useStateVersion } from './useGameState'
import { useUiStore } from '../stores/ui'
import { isBattleInProgress } from '../core/battle/BattleTypes'
import { VUE_ROUTE_ADAPTER_KEY } from '@/presentation/PresentationContracts'

// Trích từ HomeBuildingIcons.vue (Động Phủ UI redesign, giờ DongFuScene.vue
// cũng cần đúng check này) — đang ở giữa 1 Stage hoặc trận đang đánh,
// camera MainScene.ts đang zoom vào khung combat nên mọi thứ tĩnh của
// Home Scene (building icon, background động phủ) phải tự ẩn, tránh
// đè lên khung combat.
export function useStageActive() {
  const routeAdapter = inject(VUE_ROUTE_ADAPTER_KEY, null)

  if (routeAdapter) {
    return computed(() => {
      const route = routeAdapter.activeRoute.value
      return route === 'combat' || route === 'tribulation'
    })
  }

  const gameManager = useGameManager()
  const ui = useUiStore()
  const { stateVersion } = useStateVersion()

  return computed(() => {
    stateVersion.value

    if (ui.combatOrigin !== null && !ui.combatSceneDismissed) {
      return true
    }

    // Scene Độ Kiếp có overlay riêng — Động Phủ không được lộ xuyên.
    if (ui.isTribulationSceneActive) {
      return true
    }

    return gameManager.stageManager.get() !== null || isBattleInProgress(gameManager.getBattle()?.state)
  })
}
