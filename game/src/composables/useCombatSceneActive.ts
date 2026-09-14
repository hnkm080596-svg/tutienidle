import { computed, inject } from 'vue'
import { useGameManager, useStateVersion } from './useGameState'
import { useUiStore } from '../stores/ui'
import { VUE_ROUTE_ADAPTER_KEY } from '@/presentation/PresentationContracts'

/**
 * Combat UI Redesign — Combat Scene (CombatSceneOverlay.vue + Phaser's
 * CombatScene.ts) chiếm TOÀN màn hình trong lúc 1 trận đang diễn ra.
 * Derived from coordinator activeRoute when presentation is wired,
 * with fallback for standalone tests.
 */
export function useCombatSceneActive() {
  const routeAdapter = inject(VUE_ROUTE_ADAPTER_KEY, null)

  if (routeAdapter) {
    return computed(() => routeAdapter.activeRoute.value === 'combat')
  }

  const gameManager = useGameManager()
  const { stateVersion } = useStateVersion()
  const ui = useUiStore()

  return computed(() => {
    stateVersion.value

    if (ui.combatSceneDismissed) {
      return false
    }

    // M13: TurnBattleState has no 'idle' — a non-null TurnBattle is an
    // active combat session (idle meant "no battle" on the legacy engine).
    return gameManager.getTurnBattle() !== null
  })
}
